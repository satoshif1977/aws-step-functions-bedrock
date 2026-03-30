def lambda_handler(event, context):
    text = event.get("message", "Hello")
    return {
        "original": text,
        "transformed": text.upper(),
        "length": len(text)
    }
