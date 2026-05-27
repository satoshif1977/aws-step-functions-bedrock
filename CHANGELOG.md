# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [2.1.0] - 2026-05-28

### Changed
- GitHub Actions CI アクション更新（Dependabot PR #1/#3/#4/#6/#9）
  - `hashicorp/setup-terraform` v3 → v4
  - `actions/checkout` v4 → v6
  - `actions/setup-python` v5 → v6
  - `actions/setup-go` v5 → v6
  - `actions/setup-node` v4 → v6

## [2.0.0] - 2026-05-25

### Added
- EventBridge Pipes 統合（`modules/pipes/`）
  - SQS キューをソースとし、message.exists フィルターで Step Functions を自動起動
  - 起動方式: `FIRE_AND_FORGET`（非同期・低レイテンシ）
  - Terraform モジュール: `aws_pipes_pipe` + `aws_sqs_queue` + IAM ロール/ポリシー
- Express Workflow 追加（`modules/step_functions/` 拡張）
  - Standard Workflow との並置実装（`count` 条件付きリソース）
  - ログ設定: `level = "ALL"` / `include_execution_data = true`
  - CloudWatch Logs グループを専用で作成
  - 同一 Lambda を Standard/Express 両方から呼び出し可能な設計
- TypeScript 並置実装（`lambda_ts/`）
  - `step1_transform`: 大文字変換 + Unicode 文字数カウント（サロゲートペア対応 `[...str].length`）
  - `step2_format`: ラベル付き整形（`resolveLabel` / `formatResult`）
  - Jest 18 テスト・カバレッジ 100%（`npx jest --coverage`）
  - TypeScript 型チェック（`npx tsc --noEmit`）
- GitHub Actions CI ワークフロー（`.github/workflows/ts-test.yml`）
  - Node.js 20 / npm install / tsc / Jest を Ubuntu で自動実行

### Changed
- Standard Workflow のラベルを明示化（`type = "STANDARD"` 追加）
- `modules/step_functions/variables.tf` に `express_definition` / `enable_express` 変数追加
- `environments/dev/main.tf` に Express Workflow モジュール + Pipes モジュールを統合
- `environments/dev/definition_express.json` 追加（Express 専用 ASL 定義 / Retry MaxAttempts=2）
- README に バッジ3種追加（Go Test / TS Test / TypeScript）
- README アーキテクチャセクション更新（Pipes + Standard vs Express 比較表）

## [1.2.0] - 2026-05-19

### Fixed
- step1 Lambda の実装を設計図（ASL）と一致するよう修正
  - Bedrock 呼び出しを削除（step1 はテキスト加工専念）
  - 出力フィールドを `transformed / answer_type / length / original` に統一（ASL の `$.transformed` 参照と整合）
  - 閾値を 50 → 20 に修正（`definition.json` の Choice ステートと一致）
  - テストを新しい仕様に全面更新（Bedrock モック不要・境界値 20 に統一）

## [1.1.0] - 2026-05-13

### Added
- SAM テンプレート追加（`sam/template.yaml`）
- CloudFormation テンプレート追加（`cloudformation/template.yaml`）
- Go Lambda 並置実装追加（`lambda_go/`）
  - step1_transform / step2_format を Go で実装
  - Go テスト CI ワークフロー追加（`.github/workflows/go-test.yml`）

### Changed
- README にトラブルシューティング・ローカル開発テスト方法セクションを追加
- README に Step Functions ASL（JSON）定義をコードブロックで追記

## [1.0.0] - 2026-05-12

### Added
- Step Functions 全 Task ステートに `Catch` エラーハンドラを追加
- Step1・Step2 Lambda の pytest ユニットテストを追加（`conftest.py` / `test_*.py`）
- Terraform CI + Checkov セキュリティスキャン（`.github/workflows/terraform-ci.yml`）
- Dependabot 設定追加（`.github/dependabot.yml`）
- SECURITY.md 追加

### Changed
- Bedrock モデルを Claude 3 Haiku → Claude 3.5 Haiku に移行（EOL: 2026-09-10）
- step2 Lambda に Bedrock 整形呼び出しを実装（プロンプトテンプレートによる回答整形）
- `__pycache__` を `.gitignore` に追加
