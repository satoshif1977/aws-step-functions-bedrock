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
