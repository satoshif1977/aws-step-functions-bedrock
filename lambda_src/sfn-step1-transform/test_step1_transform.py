import importlib.util
import json
import os
from unittest.mock import MagicMock, patch

import pytest

# 同名モジュールの衝突を避けるため importlib で直接パス指定してロード
_spec = importlib.util.spec_from_file_location(
    "lambda_function_step1",
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


class TestStep1Transform:
    """Step1Transform Lambda: Bedrock 質問応答・answer_type 判定のテスト"""

    def _invoke(self, event: dict, bedrock_response: str = "Bedrockの回答") -> dict:
        with patch.object(_mod, "bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response(bedrock_response)
            return lambda_handler(event, context=None)

    # ── 正常系 ─────────────────────────────────────────

    def test_returns_original_message(self):
        """original に入力メッセージが保持されること"""
        result = self._invoke({"message": "hello"})
        assert result["original"] == "hello"

    def test_returns_bedrock_answer(self):
        """bedrock_answer に Bedrock からの回答が入ること"""
        result = self._invoke({"message": "hello"}, bedrock_response="こんにちは！")
        assert result["bedrock_answer"] == "こんにちは！"

    def test_short_answer_type_for_short_message(self):
        """20文字以下のメッセージは answer_type=short になること"""
        result = self._invoke({"message": "短いメッセージ"})
        assert result["answer_type"] == "short"

    def test_detail_answer_type_for_long_message(self):
        """21文字以上のメッセージは answer_type=detail になること"""
        result = self._invoke({"message": "あ" * 21})
        assert result["answer_type"] == "detail"

    def test_calculates_length_correctly(self):
        """length にメッセージの文字数が入ること"""
        result = self._invoke({"message": "hello"})
        assert result["length"] == 5

    def test_all_fields_present(self):
        """出力に必要なキーがすべて含まれること"""
        result = self._invoke({"message": "test"})
        assert set(result.keys()) == {"original", "bedrock_answer", "answer_type", "length"}

    # ── Bedrock 呼び出し検証 ──────────────────────────────

    def test_bedrock_called_once(self):
        """Bedrock が1回だけ呼ばれること"""
        with patch.object(_mod, "bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
            lambda_handler({"message": "テスト"}, context=None)
            mock_bedrock.invoke_model.assert_called_once()

    def test_bedrock_prompt_contains_message(self):
        """Bedrock へのプロンプトにメッセージが含まれること"""
        with patch.object(_mod, "bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
            lambda_handler({"message": "今日の天気は？"}, context=None)
            body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
            assert "今日の天気は？" in body["messages"][0]["content"]

    def test_bedrock_uses_system_prompt(self):
        """Bedrock へのリクエストにシステムプロンプトが含まれること"""
        with patch.object(_mod, "bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
            lambda_handler({"message": "テスト"}, context=None)
            body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
            assert "system" in body
            assert len(body["system"]) > 0

    # ── デフォルト値 ──────────────────────────────────────

    def test_default_message_when_key_missing(self):
        """message キーがない場合はデフォルト 'Hello' が使われること"""
        result = self._invoke({})
        assert result["original"] == "Hello"
        assert result["length"] == 5
        assert result["answer_type"] == "short"

    # ── 境界値 ────────────────────────────────────────────

    def test_exactly_20_chars_is_short(self):
        """ちょうど20文字は answer_type=short になること（ASL Choice と一致）"""
        result = self._invoke({"message": "a" * 20})
        assert result["answer_type"] == "short"

    def test_21_chars_is_detail(self):
        """21文字は answer_type=detail になること"""
        result = self._invoke({"message": "a" * 21})
        assert result["answer_type"] == "detail"

    def test_japanese_text_length(self):
        """日本語テキストの文字数が文字単位でカウントされること"""
        result = self._invoke({"message": "こんにちは"})
        assert result["length"] == 5

    # ── Bedrock ペイロード詳細 ────────────────────────────────

    def test_bedrock_max_tokens_is_1000(self):
        """Bedrock へのリクエストに max_tokens=1000 が含まれること"""
        with patch.object(_mod, "bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
            lambda_handler({"message": "テスト"}, context=None)
            body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
            assert body["max_tokens"] == 1000

    def test_bedrock_anthropic_version_in_payload(self):
        """Bedrock へのリクエストに anthropic_version が含まれること"""
        with patch.object(_mod, "bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
            lambda_handler({"message": "テスト"}, context=None)
            body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
            assert "anthropic_version" in body

    def test_bedrock_messages_role_is_user(self):
        """Bedrock へのリクエストの messages[0].role が 'user' であること"""
        with patch.object(_mod, "bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
            lambda_handler({"message": "テスト"}, context=None)
            body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
            assert body["messages"][0]["role"] == "user"

    def test_bedrock_messages_is_single_item_list(self):
        """Bedrock へのリクエストの messages は1要素のリストであること"""
        with patch.object(_mod, "bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
            lambda_handler({"message": "テスト"}, context=None)
            body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
            assert isinstance(body["messages"], list)
            assert len(body["messages"]) == 1

    # ── テーブル駆動 ──────────────────────────────────────────

    @pytest.mark.parametrize("length,expected_type", [
        (0, "short"), (1, "short"), (19, "short"),
        (20, "short"), (21, "detail"), (100, "detail"),
    ])
    def test_answer_type_boundary_table(self, length: int, expected_type: str):
        """answer_type の境界値テーブル: 文字数別に short/detail が正しいこと"""
        result = self._invoke({"message": "a" * length})
        assert result["answer_type"] == expected_type

    def test_empty_string_message(self):
        """空文字は length=0, answer_type=short になること（20文字以下）"""
        result = self._invoke({"message": ""})
        assert result["original"] == ""
        assert result["length"] == 0
        assert result["answer_type"] == "short"

    def test_result_is_dict(self):
        """戻り値が辞書型であること"""
        result = self._invoke({"message": "test"})
        assert isinstance(result, dict)
