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
