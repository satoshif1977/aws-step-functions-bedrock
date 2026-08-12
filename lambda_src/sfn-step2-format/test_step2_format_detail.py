"""
Step2Format lambda_function.py 詳細ユニットテスト

基本テスト（test_step2_format.py）を補完する Bedrock ペイロード詳細・
ラベルマッピング・環境変数・型検証テストを追加する。
"""

from __future__ import annotations

import importlib.util
import json
import os
from unittest.mock import MagicMock, patch

import pytest

# lambda_function.py を importlib で直接ロード（同名モジュール衝突を回避）
_spec = importlib.util.spec_from_file_location(
    "lambda_function_step2_detail",
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


def _invoke(event: dict, bedrock_response: str = "整形済み回答") -> dict:
    with patch.object(_mod, "bedrock") as mock_bedrock:
        mock_bedrock.invoke_model.return_value = _make_bedrock_response(
            bedrock_response
        )
        return lambda_handler(event, context=None)


# ── Bedrock 呼び出し回数 ──────────────────────────────────────────────


def test_bedrock_called_once():
    """1回のリクエストで Bedrock が1回だけ呼ばれること"""
    with patch.object(_mod, "bedrock") as mock_bedrock:
        mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
        lambda_handler(
            {"bedrock_answer": "元の回答", "answer_type": "short"}, context=None
        )
        mock_bedrock.invoke_model.assert_called_once()


# ── Bedrock ペイロード詳細 ────────────────────────────────────────────


def test_bedrock_max_tokens():
    """Bedrock リクエストに max_tokens が含まれること"""
    with patch.object(_mod, "bedrock") as mock_bedrock:
        mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
        lambda_handler(
            {"bedrock_answer": "元の回答", "answer_type": "short"}, context=None
        )
        body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
        assert "max_tokens" in body
        assert body["max_tokens"] > 0


def test_bedrock_anthropic_version_in_payload():
    """Bedrock リクエストに anthropic_version が含まれること"""
    with patch.object(_mod, "bedrock") as mock_bedrock:
        mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
        lambda_handler(
            {"bedrock_answer": "元の回答", "answer_type": "short"}, context=None
        )
        body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
        assert "anthropic_version" in body


def test_bedrock_messages_role_is_user():
    """Bedrock リクエストの messages[0].role が 'user' であること"""
    with patch.object(_mod, "bedrock") as mock_bedrock:
        mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
        lambda_handler(
            {"bedrock_answer": "元の回答", "answer_type": "short"}, context=None
        )
        body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
        assert body["messages"][0]["role"] == "user"


def test_bedrock_messages_is_single_item_list():
    """Bedrock リクエストの messages が1要素のリストであること"""
    with patch.object(_mod, "bedrock") as mock_bedrock:
        mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
        lambda_handler(
            {"bedrock_answer": "元の回答", "answer_type": "short"}, context=None
        )
        body = json.loads(mock_bedrock.invoke_model.call_args.kwargs["body"])
        assert isinstance(body["messages"], list)
        assert len(body["messages"]) == 1


def test_bedrock_body_is_valid_json():
    """Bedrock に渡す body が有効な JSON 文字列であること"""
    with patch.object(_mod, "bedrock") as mock_bedrock:
        mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
        lambda_handler(
            {"bedrock_answer": "元の回答", "answer_type": "detail"}, context=None
        )
        raw_body = mock_bedrock.invoke_model.call_args.kwargs["body"]
        parsed = json.loads(raw_body)
        assert isinstance(parsed, dict)


# ── ラベルマッピング（parametrize） ───────────────────────────────────


@pytest.mark.parametrize(
    "answer_type,expected_label",
    [
        ("short", "[簡潔回答]"),
        ("detail", "[詳細回答]"),
        ("unknown", "[詳細回答]"),
        ("", "[詳細回答]"),
    ],
)
def test_label_mapping(answer_type: str, expected_label: str):
    """answer_type に対応するラベルが result に付くこと"""
    result = _invoke({"bedrock_answer": "test", "answer_type": answer_type})
    assert result["result"].startswith(
        expected_label
    ), f"answer_type={answer_type!r} → expected {expected_label!r}, got {result['result']!r}"


# ── MODEL_ID 環境変数 ─────────────────────────────────────────────────


def test_default_model_id_is_haiku():
    """デフォルトの MODEL_ID が claude-3-5-haiku を含むこと"""
    assert "haiku" in _mod.MODEL_ID.lower()


def test_model_id_passed_to_bedrock():
    """MODEL_ID が Bedrock invoke_model の modelId に渡されること"""
    with patch.object(_mod, "bedrock") as mock_bedrock:
        mock_bedrock.invoke_model.return_value = _make_bedrock_response("ok")
        original = _mod.MODEL_ID
        _mod.MODEL_ID = "anthropic.claude-3-sonnet-20240229-v1:0"
        try:
            lambda_handler(
                {"bedrock_answer": "元の回答", "answer_type": "short"}, context=None
            )
            call_kwargs = mock_bedrock.invoke_model.call_args.kwargs
            assert call_kwargs["modelId"] == "anthropic.claude-3-sonnet-20240229-v1:0"
        finally:
            _mod.MODEL_ID = original


# ── 出力型・構造検証 ──────────────────────────────────────────────────


def test_result_field_is_str():
    """result フィールドが str 型であること"""
    result = _invoke({"bedrock_answer": "test", "answer_type": "short"})
    assert isinstance(result["result"], str)


def test_answer_type_field_is_str():
    """answer_type フィールドが str 型であること"""
    result = _invoke({"bedrock_answer": "test", "answer_type": "short"})
    assert isinstance(result["answer_type"], str)


def test_status_field_is_str():
    """status フィールドが str 型であること"""
    result = _invoke({"bedrock_answer": "test", "answer_type": "short"})
    assert isinstance(result["status"], str)


# ── エッジケース ──────────────────────────────────────────────────────


def test_very_long_bedrock_answer():
    """1000文字の bedrock_answer でも正常に処理されること"""
    long_answer = "あ" * 1000
    result = _invoke({"bedrock_answer": long_answer, "answer_type": "detail"})
    assert result["status"] == "success"
    assert result["result"].startswith("[詳細回答]")


def test_missing_bedrock_answer_key():
    """bedrock_answer キー自体がない場合は Bedrock を呼ばず status=success を返すこと"""
    with patch.object(_mod, "bedrock") as mock_bedrock:
        result = lambda_handler({"answer_type": "short"}, context=None)
        mock_bedrock.invoke_model.assert_not_called()
    assert result["status"] == "success"
