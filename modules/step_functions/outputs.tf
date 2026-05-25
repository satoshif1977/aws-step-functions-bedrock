output "state_machine_arn" {
  description = "Standard Workflow ステートマシンの ARN"
  value       = aws_sfn_state_machine.this.arn
}

output "state_machine_name" {
  description = "Standard Workflow ステートマシン名"
  value       = aws_sfn_state_machine.this.name
}

output "express_state_machine_arn" {
  description = "Express Workflow ステートマシンの ARN（未作成時は空文字）"
  value       = length(aws_sfn_state_machine.express) > 0 ? aws_sfn_state_machine.express[0].arn : ""
}

output "express_state_machine_name" {
  description = "Express Workflow ステートマシン名（未作成時は空文字）"
  value       = length(aws_sfn_state_machine.express) > 0 ? aws_sfn_state_machine.express[0].name : ""
}
