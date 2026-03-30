terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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

# Lambda モジュール × 2
module "lambda_step1" {
  source          = "../../modules/lambda"
  function_name   = "sfn-step1-transform"
  lambda_role_arn = aws_iam_role.lambda_role.arn
  environment     = var.environment
  project         = var.project
}

module "lambda_step2" {
  source          = "../../modules/lambda"
  function_name   = "sfn-step2-format"
  lambda_role_arn = aws_iam_role.lambda_role.arn
  environment     = var.environment
  project         = var.project
}

# Step Functions モジュール
module "step_functions" {
  source      = "../../modules/step_functions"
  project     = var.project
  environment = var.environment
  lambda_arns = [
    module.lambda_step1.function_arn,
    module.lambda_step2.function_arn
  ]

  definition = templatefile("${path.module}/definition.json", {
    step1_arn = module.lambda_step1.function_arn
    step2_arn = module.lambda_step2.function_arn
  })
}
