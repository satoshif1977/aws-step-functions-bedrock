# ── EventBridge Pipes ────────────────────────────────────────
# SQS → フィルター（テキスト長 > 0）→ Step Functions 直接起動
# aws_pipes_pipe 1リソースで「受信・フィルター・起動」を完結させる

# ── SQS キュー（Pipes のソース）─────────────────────────────
resource "aws_sqs_queue" "source" {
  name                       = "${var.project}-${var.environment}-pipe-source"
  message_retention_seconds  = 86400 # 1日
  visibility_timeout_seconds = 60
  sqs_managed_sse_enabled    = true  # SSE-SQS 暗号化（無料・CKV_AWS_27 対応）

  tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "Terraform"
  }
}

# ── IAM ロール（Pipes 実行用）───────────────────────────────
resource "aws_iam_role" "pipe" {
  name = "${var.project}-${var.environment}-pipe-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "pipes.amazonaws.com" }
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

resource "aws_iam_role_policy" "pipe" {
  name = "${var.project}-${var.environment}-pipe-policy"
  role = aws_iam_role.pipe.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # SQS ポーリング
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
        ]
        Resource = aws_sqs_queue.source.arn
      },
      # Step Functions 起動
      {
        Effect   = "Allow"
        Action   = "states:StartExecution"
        Resource = var.state_machine_arn
      },
    ]
  })
}

# ── EventBridge Pipe 本体 ────────────────────────────────────
resource "aws_pipes_pipe" "this" {
  name     = "${var.project}-${var.environment}-sfn-pipe"
  role_arn = aws_iam_role.pipe.arn

  # ソース: SQS キュー
  source = aws_sqs_queue.source.arn
  source_parameters {
    sqs_queue_parameters {
      batch_size                         = 1
      maximum_batching_window_in_seconds = 0
    }
    # フィルター: message（テキスト）が空でないメッセージのみ通過
    filter_criteria {
      filter {
        pattern = jsonencode({
          body = {
            message = [{ exists = true }]
          }
        })
      }
    }
  }

  # ターゲット: Step Functions Standard Workflow を直接起動
  target = var.state_machine_arn
  target_parameters {
    step_function_state_machine_parameters {
      invocation_type = "FIRE_AND_FORGET"
    }
    # SQS body をそのまま Step Functions の入力として渡す
    input_template = "<$.body>"
  }

  tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "Terraform"
  }
}
