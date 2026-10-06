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
STEP_NAME = "step1_transform"
RETRY_OPERATION = "InvokeModel"

#: 回答種別を分ける閾値。ここを跨ぐと Step Functions の分岐先が変わる
SHORT_ANSWER_MAX_LENGTH = 20


# ── システムプロンプト ─────────────────────────────────────
_SYSTEM_PROMPT = (
    "あなたは親切なアシスタントです。"
    "質問に対して正確で分かりやすく回答してください。"
)


# ── Bedrock 呼び出し ──────────────────────────────────────
def _ask_bedrock(message: str, *, log, metrics) -> str:
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "system": _SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": message}],
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
        message = event.get("message", "Hello")
        if "message" not in event:
            log.warn("message が無いため既定値を使います", default_used=True)

        length = len(message)
        answer_type = "short" if length <= SHORT_ANSWER_MAX_LENGTH else "detail"
        log.debug("入力を受け取りました", length=length, answer_type=answer_type)

        bedrock_answer = _ask_bedrock(message, log=log, metrics=metrics)

        metrics.add_metric("Invocations", 1, unit="Count")
        metrics.add_metric("AnswerLength", len(bedrock_answer), unit="Count")
        log.info(
            "Bedrock への問い合わせが完了しました",
            length=length,
            answer_type=answer_type,
            answer_length=len(bedrock_answer),
        )

        return {
            "original": message,
            "bedrock_answer": bedrock_answer,
            "answer_type": answer_type,
            "length": length,
        }
    except Exception as exc:
        metrics.add_metric("Errors", 1, unit="Count")
        log.error("Bedrock への問い合わせに失敗しました", error=exc)
        raise
    finally:
        # メトリクスは本処理の成否によらず必ず出す（失敗時のレイテンシも見たいため）
        metrics.flush()
