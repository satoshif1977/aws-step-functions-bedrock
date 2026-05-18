from lambda_function import lambda_handler


class TestStep1Transform:
    """Step1Transform Lambda: テキスト加工・answer_type 判定のテスト"""

    # ── 正常系 ─────────────────────────────────────────

    def test_returns_original_message(self):
        """original に入力メッセージが保持されること"""
        result = lambda_handler({"message": "hello"}, context=None)
        assert result["original"] == "hello"

    def test_returns_transformed_uppercase(self):
        """transformed に大文字変換されたメッセージが入ること"""
        result = lambda_handler({"message": "hello"}, context=None)
        assert result["transformed"] == "HELLO"

    def test_short_answer_type_for_short_message(self):
        """20文字以下のメッセージは answer_type=short になること"""
        result = lambda_handler({"message": "短いメッセージ"}, context=None)
        assert result["answer_type"] == "short"

    def test_detail_answer_type_for_long_message(self):
        """21文字以上のメッセージは answer_type=detail になること"""
        long_message = "あ" * 21
        result = lambda_handler({"message": long_message}, context=None)
        assert result["answer_type"] == "detail"

    def test_calculates_length_correctly(self):
        """length にメッセージの文字数が入ること"""
        result = lambda_handler({"message": "hello"}, context=None)
        assert result["length"] == 5

    def test_all_fields_present(self):
        """出力に必要なキーがすべて含まれること"""
        result = lambda_handler({"message": "test"}, context=None)
        assert set(result.keys()) == {"original", "transformed", "answer_type", "length"}

    # ── デフォルト値 ──────────────────────────────────

    def test_default_message_when_key_missing(self):
        """message キーがない場合はデフォルト "Hello" が使われること"""
        result = lambda_handler({}, context=None)
        assert result["original"] == "Hello"
        assert result["length"] == 5
        assert result["answer_type"] == "short"

    # ── 境界値 ────────────────────────────────────────

    def test_exactly_20_chars_is_short(self):
        """ちょうど20文字は answer_type=short になること（ASL Choice と一致）"""
        result = lambda_handler({"message": "a" * 20}, context=None)
        assert result["answer_type"] == "short"

    def test_21_chars_is_detail(self):
        """21文字は answer_type=detail になること"""
        result = lambda_handler({"message": "a" * 21}, context=None)
        assert result["answer_type"] == "detail"

    def test_japanese_text_length(self):
        """日本語テキストの文字数が文字単位でカウントされること"""
        result = lambda_handler({"message": "こんにちは"}, context=None)
        assert result["length"] == 5

    def test_japanese_not_uppercased(self):
        """日本語テキストは大文字変換の影響を受けないこと"""
        result = lambda_handler({"message": "こんにちは"}, context=None)
        assert result["transformed"] == "こんにちは"
