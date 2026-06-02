variable "aws_region" {
  description = "AWS リージョン（Bedrock IAM Resource ARN に使用）"
  type        = string
  default     = "ap-northeast-1"
}

variable "project" {
  description = "プロジェクト名"
  type        = string
}

variable "environment" {
  description = "環境名"
  type        = string
}

variable "lambda_arns" {
  description = "呼び出し許可する Lambda ARN のリスト"
  type        = list(string)
}

variable "definition" {
  description = "ステートマシン定義（JSON文字列）"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch Logs の保持日数（dev: 30, prod: 90 を推奨）"
  type        = number
  default     = 30
}

variable "express_definition" {
  description = "Express Workflow 定義（JSON文字列）。空文字の場合は作成しない"
  type        = string
  default     = ""
}
