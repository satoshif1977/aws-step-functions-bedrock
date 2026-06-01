output "state_machine_arn" {
  description = "ステートマシンの ARN"
  value       = module.step_functions.state_machine_arn
}

output "state_machine_name" {
  description = "ステートマシン名"
  value       = module.step_functions.state_machine_name
}

output "lambda_step1_arn" {
  description = "Step1 Lambda ARN"
  value       = module.lambda_step1.function_arn
}

output "lambda_step2_arn" {
  description = "Step2 Lambda ARN"
  value       = module.lambda_step2.function_arn
}

output "pipe_arn" {
  description = "EventBridge Pipe ARN"
  value       = module.pipes.pipe_arn
}

output "sqs_queue_url" {
  description = "Pipes ソース SQS キュー URL（メッセージ送信先）"
  value       = module.pipes.sqs_queue_url
}
