# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
