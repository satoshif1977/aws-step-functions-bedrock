# デプロイパッケージは許可リスト方式で組み立てる。
# source_dir でディレクトリごと固めるとテストコードや __pycache__ まで同梱されるため、
# 実行に必要なファイルだけを明示的に列挙する。
# 列挙漏れは Lambda 実行時の ImportError として即座に表面化する（黙って混入する事故が起きない）。
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/../../lambda_src/${var.function_name}/${var.function_name}.zip"

  source {
    content  = file("${path.module}/../../lambda_src/${var.function_name}/lambda_function.py")
    filename = "lambda_function.py"
  }

  # lambda_src 直下の共有モジュール（retry.py など）を各関数の zip に同梱する
  dynamic "source" {
    for_each = var.shared_modules
    content {
      content  = file("${path.module}/../../lambda_src/${source.value}")
      filename = source.value
    }
  }
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "Terraform"
  }
}

resource "aws_lambda_function" "this" {
  function_name    = var.function_name
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = var.lambda_role_arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"

  dynamic "environment" {
    for_each = length(var.env_vars) > 0 ? [1] : []
    content {
      variables = var.env_vars
    }
  }

  tracing_config {
    mode = "PassThrough"
  }

  tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "Terraform"
  }

  depends_on = [aws_cloudwatch_log_group.this]
}
