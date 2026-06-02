terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.46"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Lambda 実行ロール
resource "aws_iam_role" "lambda_role" {
  name = "${var.project}-${var.environment}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
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

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Bedrock 呼び出し権限（step1: 質問応答 / step2: 回答整形）
resource "aws_iam_role_policy" "lambda_bedrock" {
  name = "${var.project}-${var.environment}-bedrock-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ]
        # foundation-model（直接呼び出し）と inference-profile（クロスリージョン推論）の両方を許可
        Resource = [
          "arn:aws:bedrock:${var.aws_region}::foundation-model/anthropic.*",
          "arn:aws:bedrock:${var.aws_region}:*:inference-profile/*",
        ]
      }
    ]
  })
}

# Lambda モジュール × 2
module "lambda_step1" {
  source          = "../../modules/lambda"
  function_name   = "sfn-step1-transform"
  lambda_role_arn = aws_iam_role.lambda_role.arn
  environment     = var.environment
  project         = var.project
  env_vars = {
    # クロスリージョン推論プロファイル（Haiku 4.5 / 日本リージョン最適化）
    MODEL_ID = "jp.anthropic.claude-haiku-4-5-20251001-v1:0"
  }
}

module "lambda_step2" {
  source          = "../../modules/lambda"
  function_name   = "sfn-step2-format"
  lambda_role_arn = aws_iam_role.lambda_role.arn
  environment     = var.environment
  project         = var.project
  env_vars = {
    # クロスリージョン推論プロファイル（Haiku 4.5 / 日本リージョン最適化）
    MODEL_ID = "jp.anthropic.claude-haiku-4-5-20251001-v1:0"
  }
}

# Step Functions モジュール（Standard + Express）
module "step_functions" {
  source      = "../../modules/step_functions"
  project     = var.project
  environment = var.environment
  aws_region  = var.aws_region
  lambda_arns = [
    module.lambda_step1.function_arn,
    module.lambda_step2.function_arn
  ]

  # Standard Workflow: 実行履歴を90日保持・長時間ジョブ向け
  definition = templatefile("${path.module}/definition.json", {
    step1_arn = module.lambda_step1.function_arn
    step2_arn = module.lambda_step2.function_arn
  })

  # Express Workflow: 短時間・高頻度・低コスト（Standard との比較用）
  express_definition = templatefile("${path.module}/definition_express.json", {
    step1_arn = module.lambda_step1.function_arn
    step2_arn = module.lambda_step2.function_arn
  })
}

# ── Pipes モジュール（SQS → Step Functions 直接起動）─────────
module "pipes" {
  source            = "../../modules/pipes"
  project           = var.project
  environment       = var.environment
  state_machine_arn = module.step_functions.state_machine_arn
}
