"""
verify_stack.py のユニットテスト

boto3 クライアントを MagicMock で差し替えることで
AWS 接続なしに全検証関数を網羅的にテストする。
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from verify_stack import (
    VerifyResult,
    verify_lambda_function,
    verify_log_group,
    verify_state_machine,
)


# ── ヘルパー ──────────────────────────────────────────────────
def make_lambda_client(
    runtime: str = "python3.12",
    state: str = "Active",
    tracing: str = "PassThrough",
    error: Exception | None = None,
) -> MagicMock:
    client = MagicMock()
    client.exceptions.ResourceNotFoundException = type("RNF", (Exception,), {})
    if error:
        client.get_function.side_effect = error
    else:
        client.get_function.return_value = {
            "Configuration": {
                "Runtime": runtime,
                "State": state,
                "TracingConfig": {"Mode": tracing},
            }
        }
    return client


def make_logs_client(
    group_name: str = "/aws/lambda/sfn-step1-transform",
    retention: int = 30,
    error: Exception | None = None,
) -> MagicMock:
    client = MagicMock()
    if error:
        client.describe_log_groups.side_effect = error
    else:
        client.describe_log_groups.return_value = {
            "logGroups": [{"logGroupName": group_name, "retentionInDays": retention}]
        }
    return client


def make_sfn_client(
    machines: list[dict] | None = None,
    detail: dict | None = None,
    list_error: Exception | None = None,
    describe_error: Exception | None = None,
) -> MagicMock:
    client = MagicMock()
    if list_error:
        client.list_state_machines.side_effect = list_error
    else:
        client.list_state_machines.return_value = {"stateMachines": machines or []}
    if describe_error:
        client.describe_state_machine.side_effect = describe_error
    else:
        client.describe_state_machine.return_value = detail or {
            "status": "ACTIVE",
            "type": "STANDARD",
        }
    return client


def _default_machine(name: str = "sfn-bedrock-dev-sfn") -> dict:
    return {
        "name": name,
        "stateMachineArn": f"arn:aws:states:ap-northeast-1:123456789012:stateMachine:{name}",
    }


def has_ng(result: VerifyResult) -> bool:
    return result.ng_count > 0


def has_ok(result: VerifyResult) -> bool:
    return result.ok_count > 0


# ── VerifyResult テスト ───────────────────────────────────────
class TestVerifyResult:
    def test_ok_count(self) -> None:
        r = VerifyResult(section="テスト")
        r.ok("成功1"); r.ok("成功2"); r.ng("失敗1")
        assert r.ok_count == 2

    def test_ng_count(self) -> None:
        r = VerifyResult(section="テスト")
        r.ok("成功1"); r.ng("失敗1"); r.ng("失敗2")
        assert r.ng_count == 2

    def test_empty_counts(self) -> None:
        r = VerifyResult(section="空")
        assert r.ok_count == 0 and r.ng_count == 0

    def test_skip_not_counted(self) -> None:
        r = VerifyResult(section="テスト")
        r.skip("スキップ"); r.skip("スキップ2")
        assert r.ok_count == 0 and r.ng_count == 0


# ── verify_lambda_function テスト ─────────────────────────────
class TestVerifyLambdaFunction:
    def test_success(self) -> None:
        result = verify_lambda_function("sfn-step1-transform", make_lambda_client())
        assert not has_ng(result)

    def test_not_found(self) -> None:
        client = make_lambda_client()
        client.get_function.side_effect = client.exceptions.ResourceNotFoundException()
        result = verify_lambda_function("missing-fn", client)
        assert has_ng(result)

    def test_api_error(self) -> None:
        result = verify_lambda_function("sfn-step1-transform", make_lambda_client(error=Exception("エラー")))
        assert has_ng(result)

    def test_wrong_runtime(self) -> None:
        result = verify_lambda_function("sfn-step1-transform", make_lambda_client(runtime="nodejs22.x"))
        assert has_ng(result)

    def test_wrong_runtime_py311(self) -> None:
        result = verify_lambda_function("sfn-step1-transform", make_lambda_client(runtime="python3.11"))
        assert has_ng(result)

    def test_inactive_state(self) -> None:
        result = verify_lambda_function("sfn-step1-transform", make_lambda_client(state="Inactive"))
        assert has_ng(result)

    def test_active_tracing_not_passthrough(self) -> None:
        result = verify_lambda_function("sfn-step1-transform", make_lambda_client(tracing="Active"))
        assert has_ng(result)

    def test_ok_count_all_pass(self) -> None:
        result = verify_lambda_function("sfn-step1-transform", make_lambda_client())
        assert result.ok_count >= 4  # 存在・runtime・state・tracing

    def test_custom_runtime(self) -> None:
        result = verify_lambda_function(
            "sfn-step1-transform",
            make_lambda_client(runtime="python3.13"),
            expected_runtime="python3.13",
        )
        assert not has_ng(result)

    def test_section_contains_function_name(self) -> None:
        result = verify_lambda_function("sfn-step2-format", make_lambda_client())
        assert "sfn-step2-format" in result.section


# ── verify_log_group テスト ───────────────────────────────────
class TestVerifyLogGroup:
    LG = "/aws/lambda/sfn-step1-transform"

    def test_success(self) -> None:
        result = verify_log_group(self.LG, make_logs_client(self.LG, 30))
        assert not has_ng(result)

    def test_not_found(self) -> None:
        client = make_logs_client("/other/group", 30)
        result = verify_log_group(self.LG, client)
        assert has_ng(result)

    def test_api_error(self) -> None:
        result = verify_log_group(self.LG, make_logs_client(error=Exception("エラー")))
        assert has_ng(result)

    def test_wrong_retention(self) -> None:
        result = verify_log_group(self.LG, make_logs_client(self.LG, retention=7))
        assert has_ng(result)

    def test_custom_retention(self) -> None:
        result = verify_log_group(
            self.LG, make_logs_client(self.LG, retention=90),
            expected_retention_days=90,
        )
        assert not has_ng(result)

    def test_no_retention_set(self) -> None:
        client = MagicMock()
        client.describe_log_groups.return_value = {
            "logGroups": [{"logGroupName": self.LG}]  # retentionInDays なし
        }
        result = verify_log_group(self.LG, client)
        assert has_ng(result)

    def test_sfn_log_group(self) -> None:
        lg = "/aws/states/sfn-bedrock-dev-sfn"
        result = verify_log_group(lg, make_logs_client(lg, 30))
        assert not has_ng(result)


# ── verify_state_machine テスト ───────────────────────────────
class TestVerifyStateMachine:
    SM_NAME = "sfn-bedrock-dev-sfn"

    def test_success(self) -> None:
        machines = [_default_machine(self.SM_NAME)]
        result = verify_state_machine(self.SM_NAME, make_sfn_client(machines))
        assert not has_ng(result)

    def test_not_found(self) -> None:
        result = verify_state_machine(self.SM_NAME, make_sfn_client([]))
        assert has_ng(result)

    def test_list_api_error(self) -> None:
        result = verify_state_machine(
            self.SM_NAME, make_sfn_client(list_error=Exception("接続エラー"))
        )
        assert has_ng(result)

    def test_describe_api_error(self) -> None:
        machines = [_default_machine(self.SM_NAME)]
        result = verify_state_machine(
            self.SM_NAME,
            make_sfn_client(machines, describe_error=Exception("DescribeError")),
        )
        assert has_ng(result)

    def test_status_not_active(self) -> None:
        machines = [_default_machine(self.SM_NAME)]
        result = verify_state_machine(
            self.SM_NAME,
            make_sfn_client(machines, detail={"status": "DELETING", "type": "STANDARD"}),
        )
        assert has_ng(result)

    def test_ok_count_all_pass(self) -> None:
        machines = [_default_machine(self.SM_NAME)]
        result = verify_state_machine(self.SM_NAME, make_sfn_client(machines))
        assert result.ok_count >= 3  # 存在・status・type

    def test_multiple_machines_matched(self) -> None:
        machines = [
            _default_machine("other-sfn"),
            _default_machine(self.SM_NAME),
        ]
        result = verify_state_machine(self.SM_NAME, make_sfn_client(machines))
        assert not has_ng(result)

    def test_express_machine(self) -> None:
        name = "sfn-bedrock-dev-sfn-express"
        machines = [_default_machine(name)]
        result = verify_state_machine(
            name,
            make_sfn_client(machines, detail={"status": "ACTIVE", "type": "EXPRESS"}),
        )
        assert not has_ng(result)

    def test_section_contains_machine_name(self) -> None:
        machines = [_default_machine(self.SM_NAME)]
        result = verify_state_machine(self.SM_NAME, make_sfn_client(machines))
        assert self.SM_NAME in result.section
