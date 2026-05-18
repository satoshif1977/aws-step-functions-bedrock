import json
import os

import boto3

MODEL_ID = os.environ.get("MODEL_ID", "anthropic.claude-3-5-haiku-20241022-v1:0")

bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.environ.get("AWS_REGION", "ap-northeast-1"),
)


def _call_bedrock(message: str) -> str:
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 500,
        "messages": [{"role": "user", "content": message}],
    })
    response = bedrock.invoke_model(modelId=MODEL_ID, body=body)
    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


def lambda_handler(event, context):
    message = event.get("message", "Hello")
    answer_type = "short" if len(message) <= 50 else "detail"
    bedrock_answer = _call_bedrock(message)
    return {
        "original": message,
        "bedrock_answer": bedrock_answer,
        "answer_type": answer_type,
        "length": len(message),
    }
