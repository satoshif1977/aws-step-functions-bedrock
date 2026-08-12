"""
Step1Transform lambda_function.py 詳細ユニットテスト

基本テスト（test_step1_transform.py）を補完するエッジケース・ペイロード詳細・
環境変数・型検証テストを追加する。
"""

from __future__ import annotations

import importlib.util
import json
import os
from unittest.mock import MagicMock, patch

import pytest

# lambda_function.py を importlib で直接ロード（同名モジュール衝突を回避）
_spec = importlib.util.spec_from_file_location(
    "lambda_function_step1_detail",
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


def _invoke(event: dict, bedrock_response: str = "Bedrockの回答") -> dict:
    with patch.object(_mod, "bedrock") as mock_bedrock:
        mock_bedrock.invoke_model.return_value = _make_bedrock_response(
            bedrock_response
        )
        return lambda_handler(event, context=None)


# ── MODEL_ID 環境変数 ─────────────────────────────────────────────────


def test_model_id_passed_to_bedrock():
    """MODEL_ID 環境変数が Bedrock invoke_model の modelId に渡されること"""
    with patch.dict(os.environ, {"MODEL_ID": "anthropic.claude-3-opus-20240229-v1:0"}):
        with patch.object(_mod, "bedrock") as mock_bedrock:
            mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
            # モジュールの MODEL_ID を上書きしてテスト
            original = _mod.MODEL_ID
            _mod.MODEL_ID = "anthropic.claude-3-opus-20240229-v1:0"
            try:
                lambda_handler({"message": "test"}, context=None)
                call_kwargs = mock_bedrock.invoke_model.call_args.kwargs
                assert call_kwargs["modelId"] == "anthropic.claude-3-opus-20240229-v1:0"
            finally:
                _mod.MODEL_ID = original


def test_default_model_id_is_haiku():
    """デフォルトの MODEL_ID が claude-3-5-haiku を含むこと"""
    assert "haiku" in _mod.MODEL_ID.lower()


# ── Bedrock ペイロード詳細 ────────────────────────────────────────────


def test_bedrock_body_is_valid_json():
    """Bedrock に渡す body が有効な JSON 文字列であること"""
    with patch.object(_mod, "bedrock") as mock_bedrock:
        mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
        lambda_handler({"message": "テスト"}, context=None)
        raw_body = mock_bedrock.invoke_model.call_args.kwargs["body"]
        parsed = json.loads(raw_body)  # パースできれば OK
        assert isinstance(parsed, dict)


def test_bedrock_payload_has_required_keys():
    """Bedrock ペイロードに必須キー（anthropic_version/max_tokens/messages）があること"""
    with patch.object(_mod, "bedrock") as mock_bedrock:
        mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
        lambda_handler({"message": "テスト"}, context=None)
        body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
        for key in ("anthropic_version", "max_tokens", "messages", "system"):
            assert key in body, f"必須キー {key!r} が存在しない"


def test_bedrock_not_called_multiple_times():
    """1回のリクエストで Bedrock が複数回呼ばれないこと"""
    with patch.object(_mod, "bedrock") as mock_bedrock:
        mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
        lambda_handler({"message": "テスト"}, context=None)
        assert mock_bedrock.invoke_model.call_count == 1


# ── 出力型・構造検証 ──────────────────────────────────────────────────


def test_original_field_is_str():
    """original フィールドが str 型であること"""
    result = _invoke({"message": "hello"})
    assert isinstance(result["original"], str)


def test_bedrock_answer_field_is_str():
    """bedrock_answer フィールドが str 型であること"""
    result = _invoke({"message": "hello"}, bedrock_response="回答")
    assert isinstance(result["bedrock_answer"], str)


def test_answer_type_field_is_str():
    """answer_type フィールドが str 型であること"""
    result = _invoke({"message": "hello"})
    assert isinstance(result["answer_type"], str)


def test_length_field_is_int():
    """length フィールドが int 型であること"""
    result = _invoke({"message": "hello"})
    assert isinstance(result["length"], int)


# ── エッジケース ──────────────────────────────────────────────────────


def test_very_long_message_returns_detail():
    """1000文字のメッセージは answer_type=detail になること"""
    result = _invoke({"message": "あ" * 1000})
    assert result["answer_type"] == "detail"
    assert result["length"] == 1000


def test_special_chars_in_message():
    """特殊文字を含むメッセージが正常に処理されること"""
    msg = 'SELECT * FROM users; DROP TABLE--\n<script>alert("xss")</script>'
    result = _invoke({"message": msg})
    assert result["original"] == msg
    assert result["length"] == len(msg)


def test_message_with_only_spaces():
    """スペースのみのメッセージが正常に処理されること（スペースも文字数に含む）"""
    result = _invoke({"message": "   "})
    assert result["length"] == 3
    assert result["answer_type"] == "short"


@pytest.mark.parametrize(
    "msg,expected_length",
    [
        ("", 0),
        ("a", 1),
        ("あ" * 20, 20),
        ("あ" * 21, 21),
    ],
)
def test_length_matches_input(msg: str, expected_length: int):
    """length が入力文字列の len() と一致すること"""
    result = _invoke({"message": msg})
    assert result["length"] == expected_length
