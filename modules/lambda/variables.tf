variable "function_name" {
  description = "Lambda 関数名"
  type        = string
}

variable "lambda_role_arn" {
  description = "Lambda 実行ロール ARN"
  type        = string
}

variable "environment" {
  description = "環境名"
  type        = string
}

variable "project" {
  description = "プロジェクト名"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch Logs の保持日数（dev: 30, prod: 90 を推奨）"
  type        = number
  default     = 30
}
