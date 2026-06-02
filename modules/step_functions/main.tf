resource "aws_iam_role" "sfn_role" {
  name = "${var.project}-${var.environment}-sfn-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "states.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy" "sfn_lambda_policy" {
  name = "${var.project}-${var.environment}-sfn-lambda-policy"
  role = aws_iam_role.sfn_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "lambda:InvokeFunction"
        Resource = var.lambda_arns
      },
      {
        Effect = "Allow"
        Action = "bedrock:InvokeModel"
        # foundation-model（直接呼び出し）と inference-profile（クロスリージョン推論）の両方を許可
        Resource = [
          "arn:aws:bedrock:${var.aws_region}::foundation-model/anthropic.*",
          "arn:aws:bedrock:${var.aws_region}:*:inference-profile/*",
        ]
      }
    ]
  })
}

# Step Functions 実行ログ用 CloudWatch Logs グループ
resource "aws_cloudwatch_log_group" "sfn" {
  name              = "/aws/states/${var.project}-${var.environment}-sfn"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "Terraform"
  }
}

# Step Functions 実行ロールに CloudWatch Logs 書き込み権限を追加
resource "aws_iam_role_policy" "sfn_logs_policy" {
  name = "${var.project}-${var.environment}-sfn-logs-policy"
  role = aws_iam_role.sfn_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogDelivery",
        "logs:PutLogEvents",
        "logs:GetLogDelivery",
        "logs:UpdateLogDelivery",
        "logs:DeleteLogDelivery",
        "logs:ListLogDeliveries",
        "logs:PutResourcePolicy",
        "logs:DescribeResourcePolicies",
        "logs:DescribeLogGroups"
      ]
      Resource = "*"
      # checkov:skip=CKV_AWS_111: CloudWatch Logs Delivery API はリソース指定不可（AWS の制約）
      # checkov:skip=CKV_AWS_356: 同上
    }]
  })
}

resource "aws_sfn_state_machine" "this" {
  name     = "${var.project}-${var.environment}-sfn"
  role_arn = aws_iam_role.sfn_role.arn
  type     = "STANDARD"

  definition = var.definition

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.sfn.arn}:*"
    include_execution_data = false
    level                  = "ERROR"
  }

  tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "Terraform"
  }
}

# ── Express Workflow（Standard との比較用）────────────────────
# 特徴: 短時間・高頻度・低コスト / 実行履歴は CloudWatch Logs のみ
resource "aws_cloudwatch_log_group" "sfn_express" {
  count             = var.express_definition != "" ? 1 : 0
  name              = "/aws/states/${var.project}-${var.environment}-sfn-express"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "Terraform"
  }
}

resource "aws_sfn_state_machine" "express" {
  count    = var.express_definition != "" ? 1 : 0
  name     = "${var.project}-${var.environment}-sfn-express"
  role_arn = aws_iam_role.sfn_role.arn
  type     = "EXPRESS"

  definition = var.express_definition

  # Express は ALL レベルでログを取ることで実行結果を確認できる
  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.sfn_express[0].arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "Terraform"
  }
}
