import importlib.util
import json
import os
from unittest.mock import MagicMock, patch

import pytest

# 同名モジュールの衝突を避けるため importlib で直接パス指定してロード
_spec = importlib.util.spec_from_file_location(
    "lambda_function_step2",
    os.path.join(os.path.dirname(__file__), "lambda_function.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
lambda_handler = _mod.lambda_handler


def _make_bedrock_response(text: str) -> dict:
    """Bedrock invoke_model の戻り値をモックするヘルパー"""
    body_bytes = json.dumps({"content": [{"text": text}]}).encode()
    mock_body = MagicMock()
    mock_body.read.return_value = body_bytes
    return {"body": mock_body}


class TestStep2Format:
    """Step2Format Lambda: Bedrock による回答整形のテスト"""

    def _invoke(self, event: dict, bedrock_response: str = "整形済み回答") -> dict:
        with patch.object(_mod, "bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response(bedrock_response)
            return lambda_handler(event, context=None)

    # ── 正常系 ─────────────────────────────────────────

    def test_short_answer_label(self):
        """answer_type=short のとき result が [簡潔回答] で始まること"""
        result = self._invoke({"bedrock_answer": "晴れです。", "answer_type": "short"})
        assert result["result"].startswith("[簡潔回答]")

    def test_detail_answer_label(self):
        """answer_type=detail のとき result が [詳細回答] で始まること"""
        result = self._invoke({"bedrock_answer": "詳しく説明します。", "answer_type": "detail"})
        assert result["result"].startswith("[詳細回答]")

    def test_result_contains_refined_answer(self):
        """result に Bedrock が返した整形済み回答が含まれること"""
        refined = "まとめた回答テキスト"
        result = self._invoke({"bedrock_answer": "元の回答", "answer_type": "short"}, bedrock_response=refined)
        assert refined in result["result"]

    def test_result_format(self):
        """result が '[ラベル] 整形済み回答' の形式であること"""
        result = self._invoke({"bedrock_answer": "晴れです。", "answer_type": "short"}, bedrock_response="晴れです。")
        assert result["result"] == "[簡潔回答] 晴れです。"

    def test_status_is_always_success(self):
        """status が常に 'success' であること"""
        result = self._invoke({"bedrock_answer": "test", "answer_type": "short"})
        assert result["status"] == "success"

    def test_answer_type_preserved_in_output(self):
        """answer_type がそのまま出力に含まれること"""
        result = self._invoke({"bedrock_answer": "test", "answer_type": "detail"})
        assert result["answer_type"] == "detail"

    def test_all_fields_present(self):
        """出力に必要なキーがすべて含まれること"""
        result = self._invoke({"bedrock_answer": "test", "answer_type": "short"})
        assert set(result.keys()) == {"result", "answer_type", "status"}

    # ── Bedrock プロンプト検証 ─────────────────────────

    def test_bedrock_called_with_short_prompt(self):
        """answer_type=short のとき 簡潔 を含むプロンプトで Bedrock が呼ばれること"""
        with patch.object(_mod, "bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
            lambda_handler({"bedrock_answer": "元の回答", "answer_type": "short"}, context=None)
            body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
            assert "簡潔" in body["messages"][0]["content"]

    def test_bedrock_called_with_detail_prompt(self):
        """answer_type=detail のとき 箇条書き を含むプロンプトで Bedrock が呼ばれること"""
        with patch.object(_mod, "bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
            lambda_handler({"bedrock_answer": "元の回答", "answer_type": "detail"}, context=None)
            body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
            assert "箇条書き" in body["messages"][0]["content"]

    def test_bedrock_prompt_contains_original_answer(self):
        """Bedrock へのプロンプトに Step1 の回答が含まれること"""
        original = "Step1からの回答テキスト"
        with patch.object(_mod, "bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
            lambda_handler({"bedrock_answer": original, "answer_type": "short"}, context=None)
            body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
            assert original in body["messages"][0]["content"]

    # ── デフォルト値 ──────────────────────────────────

    def test_default_answer_type_when_missing(self):
        """answer_type がない場合は 'unknown' として詳細回答ラベルになること"""
        result = self._invoke({"bedrock_answer": "test"})
        assert result["result"].startswith("[詳細回答]")
        assert result["answer_type"] == "unknown"

    # ── 境界値 ────────────────────────────────────────

    def test_unknown_answer_type_uses_detail_label(self):
        """answer_type が short 以外（unknown など）のとき詳細回答ラベルになること"""
        result = self._invoke({"bedrock_answer": "test", "answer_type": "unknown"})
        assert result["result"].startswith("[詳細回答]")

    def test_empty_bedrock_answer_skips_bedrock(self):
        """bedrock_answer が空のときは Bedrock を呼ばず status=success を返すこと"""
        with patch.object(_mod, "bedrock") as mock_bedrock:
            result = lambda_handler({"bedrock_answer": "", "answer_type": "short"}, context=None)
            mock_bedrock.invoke_model.assert_not_called()
        assert result["status"] == "success"
        assert result["result"] == "[簡潔回答] "
