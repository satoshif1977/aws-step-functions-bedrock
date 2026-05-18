def lambda_handler(event, context):
    message = event.get("message", "Hello")
    transformed = message.upper()
    length = len(message)
    answer_type = "short" if length <= 20 else "detail"
    return {
        "original": message,
        "transformed": transformed,
        "answer_type": answer_type,
        "length": length,
    }
