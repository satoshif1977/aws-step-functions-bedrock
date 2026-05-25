variable "project" {
  description = "プロジェクト名"
  type        = string
}

variable "environment" {
  description = "環境名（dev / stg / prod）"
  type        = string
}

variable "state_machine_arn" {
  description = "Pipes のターゲット: Step Functions ステートマシン ARN"
  type        = string
}
