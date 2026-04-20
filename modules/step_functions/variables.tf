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
