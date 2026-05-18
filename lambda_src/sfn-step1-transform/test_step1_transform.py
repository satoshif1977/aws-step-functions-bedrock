import json
from unittest.mock import MagicMock, patch

import pytest
from lambda_function import lambda_handler


def _make_bedrock_response(text: str) -> dict:
    """Bedrock invoke_model の戻り値をモックするヘルパー"""
    body_bytes = json.dumps({"content": [{"text": text}]}).encode()
    mock_body = MagicMock()
    mock_body.read.return_value = body_bytes
    return {"body": mock_body}


class TestStep1Transform:
    """Step1Transform Lambda: Bedrock 呼び出し・answer_type 判定のテスト"""

    def _invoke(self, event: dict, bedrock_response: str = "テスト回答") -> dict:
        with patch("lambda_function.bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response(bedrock_response)
            return lambda_handler(event, context=None)

    # ── 正常系 ─────────────────────────────────────────

    def test_returns_original_message(self):
        """original に入力メッセージが保持されること"""
        result = self._invoke({"message": "hello"})
        assert result["original"] == "hello"

    def test_returns_bedrock_answer(self):
        """bedrock_answer に Bedrock の回答が入ること"""
        result = self._invoke({"message": "今日の天気は？"}, bedrock_response="晴れです。")
        assert result["bedrock_answer"] == "晴れです。"

    def test_short_answer_type_for_short_message(self):
        """50文字以下のメッセージは answer_type=short になること"""
        result = self._invoke({"message": "短いメッセージ"})
        assert result["answer_type"] == "short"

    def test_detail_answer_type_for_long_message(self):
        """51文字以上のメッセージは answer_type=detail になること"""
        long_message = "あ" * 51
        result = self._invoke({"message": long_message})
        assert result["answer_type"] == "detail"

    def test_calculates_length_correctly(self):
        """length にメッセージの文字数が入ること"""
        result = self._invoke({"message": "hello"})
        assert result["length"] == 5

    def test_all_fields_present(self):
        """出力に必要なキーがすべて含まれること"""
        result = self._invoke({"message": "test"})
        assert set(result.keys()) == {"original", "bedrock_answer", "answer_type", "length"}

    # ── デフォルト値 ──────────────────────────────────

    def test_default_message_when_key_missing(self):
        """message キーがない場合はデフォルト "Hello" が使われること"""
        result = self._invoke({})
        assert result["original"] == "Hello"
        assert result["length"] == 5
        assert result["answer_type"] == "short"

    # ── 境界値 ────────────────────────────────────────

    def test_exactly_50_chars_is_short(self):
        """ちょうど50文字は answer_type=short になること"""
        result = self._invoke({"message": "a" * 50})
        assert result["answer_type"] == "short"

    def test_51_chars_is_detail(self):
        """51文字は answer_type=detail になること"""
        result = self._invoke({"message": "a" * 51})
        assert result["answer_type"] == "detail"

    def test_japanese_text_length(self):
        """日本語テキストの文字数が文字単位でカウントされること"""
        result = self._invoke({"message": "こんにちは"})
        assert result["length"] == 5

    def test_bedrock_invoke_called_with_message(self):
        """Bedrock が入力メッセージを含むプロンプトで呼び出されること"""
        with patch("lambda_function.bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response("回答")
            lambda_handler({"message": "テスト質問"}, context=None)
            call_args = mock_bedrock.invoke_model.call_args
            body = json.loads(call_args.kwargs["body"])
            assert body["messages"][0]["content"] == "テスト質問"
