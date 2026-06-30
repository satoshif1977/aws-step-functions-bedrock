"""
aws-step-functions-bedrock スタック検証スクリプト

CDK/Terraform デプロイ後に Lambda・CloudWatch Logs・Step Functions の
リソースが正しく作成されているかを boto3 で確認する。

TypeScript/Go 実装との比較ポイント:
  - boto3 クライアントを引数で受け取る（依存注入）→ pytest でモック差し替え可能
  - VerifyResult dataclass で OK/NG を集計 → 終了コードに反映
  - 検証関数を独立させることで単体テストが容易

使用方法:
    python scripts/verify_stack.py [--project <プロジェクト名>] [--env <環境名>] [--region <リージョン>]

前提条件:
    pip install boto3
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass, field
from typing import Any

import boto3

# ── デフォルト設定 ────────────────────────────────────────────
DEFAULT_PROJECT   = "sfn-bedrock"
DEFAULT_ENV       = "dev"
DEFAULT_REGION    = "ap-northeast-1"
EXPECTED_RUNTIME  = "python3.12"
EXPECTED_LOG_RETENTION_DAYS = 30  # modules/lambda/variables.tf: default = 30


# ── 結果型 ────────────────────────────────────────────────────
@dataclass
class ResultItem:
    status: str   # "OK" | "NG" | "SKIP"
    message: str


@dataclass
class VerifyResult:
    section: str
    items: list[ResultItem] = field(default_factory=list)

    def ok(self, msg: str) -> None:
        self.items.append(ResultItem("OK", msg))

    def ng(self, msg: str) -> None:
        self.items.append(ResultItem("NG", msg))

    def skip(self, msg: str) -> None:
        self.items.append(ResultItem("SKIP", msg))

    @property
    def ok_count(self) -> int:
        return sum(1 for it in self.items if it.status == "OK")

    @property
    def ng_count(self) -> int:
        return sum(1 for it in self.items if it.status == "NG")

    def print(self) -> None:
        print(f"\n{'=' * 50}")
        print(f"  {self.section}")
        print("=" * 50)
        for it in self.items:
            prefix = {"OK": "[OK] ", "NG": "[NG] ", "SKIP": "[--] "}[it.status]
            print(f"  {prefix}{it.message}")


# ── Lambda 検証 ───────────────────────────────────────────────
def verify_lambda_function(
    function_name: str,
    client: Any,
    *,
    expected_runtime: str = EXPECTED_RUNTIME,
) -> VerifyResult:
    """Lambda 関数の存在・ランタイム・状態を検証する。"""
    result = VerifyResult(section=f"Lambda: {function_name}")

    try:
        resp = client.get_function(FunctionName=function_name)
    except client.exceptions.ResourceNotFoundException:
        result.ng(f"Lambda 関数 '{function_name}' が見つかりません")
        return result
    except Exception as e:
        result.ng(f"GetFunction エラー: {e}")
        return result

    config = resp["Configuration"]
    result.ok(f"Lambda 関数が存在します: {function_name}")

    runtime = config.get("Runtime", "")
    if runtime == expected_runtime:
        result.ok(f"ランタイム正常: {runtime}")
    else:
        result.ng(f"ランタイムが想定外: {runtime} (期待: {expected_runtime})")

    state = config.get("State", "")
    if state == "Active":
        result.ok(f"関数ステータス正常: {state}")
    else:
        result.ng(f"関数ステータスが想定外: {state} (期待: Active)")

    tracing = config.get("TracingConfig", {}).get("Mode", "")
    if tracing == "PassThrough":
        result.ok(f"X-Ray トレーシング正常: {tracing}（コスト無料）")
    else:
        result.ng(f"X-Ray トレーシングが想定外: {tracing} (期待: PassThrough)")

    return result


# ── CloudWatch Logs 検証 ──────────────────────────────────────
def verify_log_group(
    log_group_name: str,
    client: Any,
    *,
    expected_retention_days: int = EXPECTED_LOG_RETENTION_DAYS,
) -> VerifyResult:
    """CloudWatch Logs グループの存在・保持期間を検証する。"""
    result = VerifyResult(section=f"CloudWatch Logs: {log_group_name}")

    try:
        resp = client.describe_log_groups(logGroupNamePrefix=log_group_name)
    except Exception as e:
        result.ng(f"DescribeLogGroups エラー: {e}")
        return result

    groups = [g for g in resp.get("logGroups", []) if g["logGroupName"] == log_group_name]
    if not groups:
        result.ng(f"ロググループ '{log_group_name}' が見つかりません")
        return result

    result.ok(f"ロググループが存在します: {log_group_name}")

    retention = groups[0].get("retentionInDays")
    if retention == expected_retention_days:
        result.ok(f"保持期間正常: {retention}日")
    else:
        result.ng(f"保持期間が想定外: {retention}日 (期待: {expected_retention_days}日)")

    return result


# ── Step Functions 検証 ───────────────────────────────────────
def verify_state_machine(
    state_machine_name: str,
    client: Any,
) -> VerifyResult:
    """Step Functions ステートマシンの存在・状態を検証する。"""
    result = VerifyResult(section=f"Step Functions: {state_machine_name}")

    try:
        resp = client.list_state_machines()
    except Exception as e:
        result.ng(f"ListStateMachines エラー: {e}")
        return result

    machines = [m for m in resp.get("stateMachines", []) if m.get("name") == state_machine_name]
    if not machines:
        result.ng(f"ステートマシン '{state_machine_name}' が見つかりません")
        return result

    machine = machines[0]
    result.ok(f"ステートマシンが存在します: {state_machine_name}")

    # ステートマシンの詳細を取得して状態確認
    try:
        detail = client.describe_state_machine(stateMachineArn=machine["stateMachineArn"])
        status = detail.get("status", "")
        if status == "ACTIVE":
            result.ok(f"ステータス正常: {status}")
        else:
            result.ng(f"ステータスが想定外: {status} (期待: ACTIVE)")

        sm_type = detail.get("type", "")
        result.ok(f"タイプ: {sm_type}")
    except Exception as e:
        result.ng(f"DescribeStateMachine エラー: {e}")

    return result


# ── メイン ────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="aws-step-functions-bedrock スタック検証")
    parser.add_argument("--project",  default=DEFAULT_PROJECT)
    parser.add_argument("--env",      default=DEFAULT_ENV)
    parser.add_argument("--region",   default=DEFAULT_REGION)
    parser.add_argument("--profile",  default=None)
    args = parser.parse_args()

    project = args.project
    env     = args.env
    session = boto3.Session(profile_name=args.profile, region_name=args.region)

    print(f"\naws-step-functions-bedrock スタック検証")
    print(f"プロジェクト : {project}")
    print(f"環境         : {env}")
    print(f"リージョン   : {args.region}")

    results = [
        verify_lambda_function("sfn-step1-transform", session.client("lambda")),
        verify_lambda_function("sfn-step2-format",    session.client("lambda")),
        verify_log_group(f"/aws/lambda/sfn-step1-transform", session.client("logs")),
        verify_log_group(f"/aws/lambda/sfn-step2-format",    session.client("logs")),
        verify_log_group(f"/aws/states/{project}-{env}-sfn", session.client("logs")),
        verify_state_machine(f"{project}-{env}-sfn",         session.client("stepfunctions")),
        verify_state_machine(f"{project}-{env}-sfn-express", session.client("stepfunctions")),
    ]

    total_ng = 0
    for r in results:
        r.print()
        total_ng += r.ng_count

    print(f"\n{'=' * 50}")
    print(f"  検証完了（NG: {total_ng}件）")
    print("=" * 50)

    if total_ng > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
