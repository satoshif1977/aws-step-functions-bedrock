def lambda_handler(event, context):
    return {
        "result": f"[完了] {event['transformed']} (文字数: {event['length']})",
        "status": "success"
    }
