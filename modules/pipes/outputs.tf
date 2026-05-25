output "pipe_arn" {
  description = "EventBridge Pipe ARN"
  value       = aws_pipes_pipe.this.arn
}

output "pipe_name" {
  description = "EventBridge Pipe 名"
  value       = aws_pipes_pipe.this.name
}

output "sqs_queue_url" {
  description = "SQS キュー URL（メッセージ送信先）"
  value       = aws_sqs_queue.source.url
}

output "sqs_queue_arn" {
  description = "SQS キュー ARN"
  value       = aws_sqs_queue.source.arn
}
