import json
import os

import boto3

MODEL_ID = os.environ.get("MODEL_ID", "anthropic.claude-3-5-haiku-20241022-v1:0")

bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.environ.get("AWS_REGION", "ap-northeast-1"),
)

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
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 500,
        "messages": [{"role": "user", "content": prompt}],
    })
    response = bedrock.invoke_model(modelId=MODEL_ID, body=body)
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
