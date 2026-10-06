"""
2 つの Lambda ハンドラが logger / metrics を「実際に経由している」ことを固定する。

ユーティリティを置いただけで呼び出し元に結線していない、という欠陥は
カバレッジでは検出できない（test_logger.py / test_metrics.py は通ってしまう）。
ここでは各ハンドラを実行し、出力された JSON ログと EMF ドキュメントを観測する。

デプロイパッケージへの同梱漏れも同じ系統の欠陥なので、
Terraform の shared_modules に 4 ファイルが揃っていることも合わせて確認する。
"""

import importlib.util
import json
import os
import re
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError
from logger import create_logger
from metrics import create_metrics

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load(name: str, directory: str):
    """同名モジュールの衝突を避けるため importlib で直接ロードする"""
    spec = importlib.util.spec_from_file_location(
        name,
        os.path.join(os.path.dirname(__file__), directory, "lambda_function.py"),
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


step1 = _load("lambda_function_step1_obs", "sfn-step1-transform")
step2 = _load("lambda_function_step2_obs", "sfn-step2-format")


class Collector:
    """sink は 1 行の JSON を受け取るので、パースして貯める"""

    def __init__(self):
        self.logs: list[dict] = []
        self.emf: list[dict] = []
        self.logger = create_logger(
            level="debug", sink=lambda line, level: self.logs.append(json.loads(line))
        )
        self.metrics = create_metrics(
            "TestNamespace", sink=lambda line: self.emf.append(json.loads(line))
        )

    def levels(self, level: str) -> list[dict]:
        return [e for e in self.logs if e["level"] == level]

    def metric_names(self) -> set[str]:
        names = set()
        for doc in self.emf:
            for directive in doc["_aws"]["CloudWatchMetrics"]:
                names.update(m["Name"] for m in directive["Metrics"])
        return names


def _bedrock_response(text: str) -> dict:
    body = MagicMock()
    body.read.return_value = json.dumps({"content": [{"text": text}]}).encode()
    return {"body": body}


def _throttling() -> ClientError:
    """Bedrock のスロットリングを模した、リトライ可能な例外"""
    return ClientError(
        {"Error": {"Code": "ThrottlingException", "Message": "Rate exceeded"}},
        "InvokeModel",
    )


# ── step1_transform ───────────────────────────────────────


class TestStep1Observability:
    def _invoke(self, event: dict, col: Collector, answer: str = "回答"):
        with patch.object(step1, "bedrock") as mock:
            mock.invoke_model.return_value = _bedrock_response(answer)
            return step1.lambda_handler(
                event, None, log=col.logger, metrics=col.metrics
            )

    def test_logs_carry_step_name(self):
        """すべてのログにステート名が載ること"""
        col = Collector()
        self._invoke({"message": "hello"}, col)

        assert col.logs
        assert all(e["step"] == "step1_transform" for e in col.logs)

    def test_info_records_answer_length(self):
        """成功時に info で回答長を残すこと"""
        col = Collector()
        self._invoke({"message": "hello"}, col, answer="12345")

        infos = col.levels("info")
        assert len(infos) == 1
        assert infos[0]["answer_length"] == 5
        assert infos[0]["answer_type"] == "short"

    def test_warns_when_message_missing(self):
        """message 未指定なら warn を出すこと"""
        col = Collector()
        self._invoke({}, col)

        warns = col.levels("warn")
        assert len(warns) == 1
        assert warns[0]["default_used"] is True

    def test_emits_metrics(self):
        """呼び出し回数・レイテンシ・回答長をメトリクス化すること"""
        col = Collector()
        self._invoke({"message": "hello"}, col)

        assert col.metric_names() == {
            "BedrockLatency",
            "Invocations",
            "AnswerLength",
        }

    def test_metrics_dimension_is_step(self):
        """ディメンションはステート名だけに絞ること（課金が効くため）"""
        col = Collector()
        self._invoke({"message": "hello"}, col)

        directive = col.emf[0]["_aws"]["CloudWatchMetrics"][0]
        assert directive["Dimensions"] == [["Step"]]
        assert col.emf[0]["Step"] == "step1_transform"

    def test_retry_emits_warn_and_metric(self):
        """リトライ時に warn とリトライメトリクスが出ること"""
        col = Collector()
        calls = {"n": 0}

        def flaky(**kwargs):
            calls["n"] += 1
            if calls["n"] < 2:
                raise _throttling()
            return _bedrock_response("回答")

        with patch.object(step1, "bedrock") as mock, patch.object(
            step1, "RETRY_SLEEP", lambda _: None
        ):
            mock.invoke_model.side_effect = flaky
            step1.lambda_handler(
                {"message": "hello"}, None, log=col.logger, metrics=col.metrics
            )

        warns = col.levels("warn")
        assert len(warns) == 1
        assert warns[0]["operation"] == "InvokeModel"
        assert warns[0]["attempt"] == 1
        assert "RetryAttempts" in col.metric_names()

    def test_failure_emits_error_and_flushes(self):
        """失敗してもメトリクスを出し切ってから例外を送出すること"""
        col = Collector()

        with patch.object(step1, "bedrock") as mock:
            mock.invoke_model.side_effect = ValueError("壊れた")
            with pytest.raises(ValueError):
                step1.lambda_handler(
                    {"message": "hello"}, None, log=col.logger, metrics=col.metrics
                )

        errors = col.levels("error")
        assert len(errors) == 1
        assert errors[0]["error"]["type"] == "ValueError"
        # 失敗時のレイテンシも見たいので、計測値は捨てない
        assert {"Errors", "BedrockLatency"} <= col.metric_names()


# ── step2_format ──────────────────────────────────────────


class TestStep2Observability:
    def _invoke(self, event: dict, col: Collector, answer: str = "整形後"):
        with patch.object(step2, "bedrock") as mock:
            mock.invoke_model.return_value = _bedrock_response(answer)
            return step2.lambda_handler(
                event, None, log=col.logger, metrics=col.metrics
            )

    def test_logs_carry_step_name(self):
        col = Collector()
        self._invoke({"bedrock_answer": "元の回答", "answer_type": "short"}, col)

        assert col.logs
        assert all(e["step"] == "step2_format" for e in col.logs)

    def test_info_records_result_length(self):
        col = Collector()
        result = self._invoke(
            {"bedrock_answer": "元の回答", "answer_type": "short"}, col
        )

        infos = col.levels("info")
        assert len(infos) == 1
        assert infos[0]["result_length"] == len(result["result"])

    def test_empty_input_warns_and_skips_bedrock(self):
        """入力が空なら warn を出し、Bedrock を呼ばないこと"""
        col = Collector()
        with patch.object(step2, "bedrock") as mock:
            step2.lambda_handler(
                {"bedrock_answer": ""}, None, log=col.logger, metrics=col.metrics
            )
            mock.invoke_model.assert_not_called()

        assert len(col.levels("warn")) == 1
        assert "EmptyInput" in col.metric_names()
        # Bedrock を呼んでいないのでレイテンシは計測されない
        assert "BedrockLatency" not in col.metric_names()

    def test_success_emits_no_warn(self):
        col = Collector()
        self._invoke({"bedrock_answer": "元の回答", "answer_type": "detail"}, col)

        assert col.levels("warn") == []
        assert {"Invocations", "BedrockLatency"} <= col.metric_names()


# ── 共通 ──────────────────────────────────────────────────


class TestObservabilityCommon:
    def test_secrets_are_redacted(self):
        """ログに機密情報がそのまま出ないこと"""
        col = Collector()
        with patch.object(step1, "bedrock") as mock:
            mock.invoke_model.return_value = _bedrock_response("回答")
            step1.lambda_handler(
                {"message": "hi"},
                None,
                log=col.logger.child(api_key="secret-value"),
                metrics=col.metrics,
            )

        dumped = json.dumps(col.logs, ensure_ascii=False)
        assert "secret-value" not in dumped
        assert "[REDACTED]" in dumped

    def test_handler_works_without_injection(self):
        """log / metrics を渡さなくても落ちないこと（環境変数から組み立てる）"""
        with patch.object(step1, "bedrock") as mock:
            mock.invoke_model.return_value = _bedrock_response("回答")
            result = step1.lambda_handler({"message": "hello"}, None)

        assert result["bedrock_answer"] == "回答"

    def test_shared_modules_cover_every_import(self):
        """★ デプロイ ZIP の同梱リストが、実際の import を網羅していること

        結線しても zip に入っていなければ実行時 ImportError になる。
        過去に同じ欠陥を踏んでいるので、Terraform の既定値をテストで固定する。
        """
        path = os.path.join(_ROOT, "modules", "lambda", "variables.tf")
        with open(path, encoding="utf-8") as fp:
            tf = fp.read()

        block = re.search(
            r'variable "shared_modules".*?default\s*=\s*\[(.*?)\]', tf, re.S
        )
        assert block, "shared_modules の default が読み取れない"
        declared = set(re.findall(r'"([^"]+)"', block.group(1)))

        expected = {"retry.py", "logger.py", "metrics.py", "observability.py"}
        assert expected <= declared, f"同梱漏れ: {expected - declared}"
