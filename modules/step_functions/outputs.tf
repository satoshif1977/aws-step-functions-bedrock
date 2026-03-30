output "state_machine_arn" {
  description = "ステートマシンの ARN"
  value       = aws_sfn_state_machine.this.arn
}

output "state_machine_name" {
  description = "ステートマシン名"
  value       = aws_sfn_state_machine.this.name
}
