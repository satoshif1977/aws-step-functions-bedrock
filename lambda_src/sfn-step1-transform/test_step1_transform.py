import pytest
from lambda_function import lambda_handler


class TestStep1Transform:
    """Step1Transform Lambda: テキスト加工（大文字変換・文字数カウント）のテスト"""

    def _invoke(self, event: dict) -> dict:
        return lambda_handler(event, context=None)

    # ── 正常系 ─────────────────────────────────────────

    def test_transforms_message_to_uppercase(self):
        """メッセージが大文字に変換されること"""
        result = self._invoke({"message": "hello world"})
        assert result["transformed"] == "HELLO WORLD"

    def test_preserves_original_message(self):
        """変換前の元テキストが original に保持されること"""
        result = self._invoke({"message": "hello"})
        assert result["original"] == "hello"

    def test_calculates_length_correctly(self):
        """文字数が正確にカウントされること"""
        result = self._invoke({"message": "hello"})
        assert result["length"] == 5

    def test_all_fields_present(self):
        """出力に必要なキーがすべて含まれること"""
        result = self._invoke({"message": "test"})
        assert set(result.keys()) == {"original", "transformed", "length"}

    # ── デフォルト値 ──────────────────────────────────

    def test_default_message_when_key_missing(self):
        """message キーがない場合はデフォルト "Hello" が使われること"""
        result = self._invoke({})
        assert result["original"] == "Hello"
        assert result["transformed"] == "HELLO"
        assert result["length"] == 5

    # ── 境界値 ────────────────────────────────────────

    def test_empty_string(self):
        """空文字列の場合は length=0 かつ transformed が空文字であること"""
        result = self._invoke({"message": ""})
        assert result["original"] == ""
        assert result["transformed"] == ""
        assert result["length"] == 0

    def test_japanese_text_length(self):
        """日本語テキストの文字数が文字単位でカウントされること"""
        result = self._invoke({"message": "こんにちは"})
        assert result["length"] == 5
        assert result["original"] == "こんにちは"

    def test_already_uppercase(self):
        """すでに大文字の場合もそのまま返ること"""
        result = self._invoke({"message": "ALREADY UPPER"})
        assert result["transformed"] == "ALREADY UPPER"

    def test_mixed_case(self):
        """大文字・小文字混在のテキストが全大文字に変換されること"""
        result = self._invoke({"message": "Hello World"})
        assert result["transformed"] == "HELLO WORLD"

    def test_length_matches_transformed_length(self):
        """length が transformed の文字数と一致すること"""
        result = self._invoke({"message": "abc"})
        assert result["length"] == len(result["transformed"])
