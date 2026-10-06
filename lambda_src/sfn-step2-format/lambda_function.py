import json
import os
import time

import boto3
from observability import observe, retry_hooks
from retry import RetryConfig, retry_call

MODEL_ID = os.environ.get("MODEL_ID", "anthropic.claude-3-5-haiku-20241022-v1:0")

bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.environ.get("AWS_REGION", "ap-northeast-1"),
)

# ── リトライ設定 ──────────────────────────────────────────
# Bedrock のスロットリング対策。指数バックオフ + フルジッターで最大3回試行する。
# テストからは RETRY_SLEEP を差し替えて実待機なしに検証する。
RETRY_CONFIG = RetryConfig(max_attempts=3, base_delay=0.5, max_delay=8.0)
RETRY_SLEEP = time.sleep

# ── 観測 ─────────────────────────────────────────────────
STEP_NAME = "step2_format"
RETRY_OPERATION = "InvokeModel"


# ── プロンプトテンプレート ─────────────────────────────────
_PROMPTS = {
    "short": (
        "次の回答を1〜2文で簡潔にまとめてください。"
        "余計な前置きや説明は省いてください。\n\n{answer}"
    ),
    "detail": (
        "次の回答を読みやすい箇条書き形式に整形してください。"
        "重要なポイントを箇条書きで示してください。\n\n{answer}"
    ),
}


# ── Bedrock 呼び出し ──────────────────────────────────────
def _reformat(bedrock_answer: str, answer_type: str, *, log, metrics) -> str:
    template = _PROMPTS.get(answer_type, _PROMPTS["detail"])
    prompt = template.format(answer=bedrock_answer)
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 500,
            "messages": [{"role": "user", "content": prompt}],
        }
    )
    with metrics.timer("BedrockLatency"):
        response = retry_call(
            bedrock.invoke_model,
            modelId=MODEL_ID,
            body=body,
            config=RETRY_CONFIG,
            sleep=RETRY_SLEEP,
            on_retry=retry_hooks(log, metrics, RETRY_OPERATION),
        )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


# ── エントリーポイント ────────────────────────────────────
def lambda_handler(event, context, *, log=None, metrics=None):
    log, metrics = observe(STEP_NAME, log, metrics)
    try:
        bedrock_answer = event.get("bedrock_answer", "")
        answer_type = event.get("answer_type", "unknown")
        label = "簡潔回答" if answer_type == "short" else "詳細回答"
        log.debug(
            "入力を受け取りました",
            answer_type=answer_type,
            answer_length=len(bedrock_answer),
        )

        if not bedrock_answer:
            # 整形対象が無いので Bedrock は呼ばない。Step1 側の異常を疑う材料として残す
            log.warn("入力が空のため整形をスキップします", answer_type=answer_type)
            metrics.add_metric("EmptyInput", 1, unit="Count")
            refined = ""
        else:
            refined = _reformat(bedrock_answer, answer_type, log=log, metrics=metrics)
            metrics.add_metric("Invocations", 1, unit="Count")

        result = f"[{label}] {refined}"
        log.info(
            "応答を整形しました",
            answer_type=answer_type,
            result_length=len(result),
        )

        return {
            "result": result,
            "answer_type": answer_type,
            "status": "success",
        }
    except Exception as exc:
        metrics.add_metric("Errors", 1, unit="Count")
        log.error("応答の整形に失敗しました", error=exc)
        raise
    finally:
        # メトリクスは本処理の成否によらず必ず出す（失敗時のレイテンシも見たいため）
        metrics.flush()
