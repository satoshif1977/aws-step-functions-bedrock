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
