output "function_arn" {
  description = "Lambda 関数の ARN"
  value       = aws_lambda_function.this.arn
}

output "function_name" {
  description = "Lambda 関数名"
  value       = aws_lambda_function.this.function_name
}
