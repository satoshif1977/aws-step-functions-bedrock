import json
import os
import time

import boto3
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


# ── システムプロンプト ─────────────────────────────────────
_SYSTEM_PROMPT = (
    "あなたは親切なアシスタントです。"
    "質問に対して正確で分かりやすく回答してください。"
)


# ── Bedrock 呼び出し ──────────────────────────────────────
def _ask_bedrock(message: str) -> str:
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "system": _SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": message}],
        }
    )
    response = retry_call(
        bedrock.invoke_model,
        modelId=MODEL_ID,
        body=body,
        config=RETRY_CONFIG,
        sleep=RETRY_SLEEP,
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


# ── エントリーポイント ────────────────────────────────────
def lambda_handler(event, context):
    message = event.get("message", "Hello")
    length = len(message)
    answer_type = "short" if length <= 20 else "detail"

    bedrock_answer = _ask_bedrock(message)

    return {
        "original": message,
        "bedrock_answer": bedrock_answer,
        "answer_type": answer_type,
        "length": length,
    }
