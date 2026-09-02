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
def _reformat(bedrock_answer: str, answer_type: str) -> str:
    template = _PROMPTS.get(answer_type, _PROMPTS["detail"])
    prompt = template.format(answer=bedrock_answer)
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 500,
            "messages": [{"role": "user", "content": prompt}],
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
    bedrock_answer = event.get("bedrock_answer", "")
    answer_type = event.get("answer_type", "unknown")
    label = "簡潔回答" if answer_type == "short" else "詳細回答"

    refined = _reformat(bedrock_answer, answer_type) if bedrock_answer else ""

    return {
        "result": f"[{label}] {refined}",
        "answer_type": answer_type,
        "status": "success",
    }
