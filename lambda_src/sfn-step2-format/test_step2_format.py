import importlib.util
import os
import pytest

# 同名モジュールの衝突を避けるため importlib で直接パス指定してロード
_spec = importlib.util.spec_from_file_location(
    "lambda_function_step2",
    os.path.join(os.path.dirname(__file__), "lambda_function.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
lambda_handler = _mod.lambda_handler


class TestStep2Format:
    """Step2Format Lambda: Bedrock 回答の最終整形のテスト"""

    def _invoke(self, event: dict) -> dict:
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

    def test_result_contains_bedrock_answer(self):
        """result に bedrock_answer の内容が含まれること"""
        answer = "テスト回答テキスト"
        result = self._invoke({"bedrock_answer": answer, "answer_type": "short"})
        assert answer in result["result"]

    def test_result_format(self):
        """result が '[ラベル] 回答' の形式であること"""
        result = self._invoke({"bedrock_answer": "晴れです。", "answer_type": "short"})
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

    # ── デフォルト値 ──────────────────────────────────

    def test_default_bedrock_answer_when_missing(self):
        """bedrock_answer がない場合は空文字が使われること"""
        result = self._invoke({"answer_type": "short"})
        assert result["result"] == "[簡潔回答] "

    def test_default_answer_type_when_missing(self):
        """answer_type がない場合は 'unknown' として詳細回答ラベルになること"""
        result = self._invoke({"bedrock_answer": "test"})
        assert result["result"].startswith("[詳細回答]")
        assert result["answer_type"] == "unknown"

    # ── 境界値 ────────────────────────────────────────

    def test_unknown_answer_type_uses_detail_label(self):
        """answer_type が short 以外（unknown など）のとき 詳細回答 ラベルになること"""
        result = self._invoke({"bedrock_answer": "test", "answer_type": "unknown"})
        assert result["result"].startswith("[詳細回答]")

    def test_empty_bedrock_answer(self):
        """bedrock_answer が空文字のとき status は success のまま"""
        result = self._invoke({"bedrock_answer": "", "answer_type": "short"})
        assert result["status"] == "success"
        assert result["result"] == "[簡潔回答] "
