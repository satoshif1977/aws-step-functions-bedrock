def lambda_handler(event, context):
    bedrock_answer = event.get("bedrock_answer", "")
    answer_type = event.get("answer_type", "unknown")
    label = "簡潔回答" if answer_type == "short" else "詳細回答"
    return {
        "result": f"[{label}] {bedrock_answer}",
        "answer_type": answer_type,
        "status": "success"
    }
