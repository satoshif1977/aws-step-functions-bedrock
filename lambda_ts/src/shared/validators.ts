/**
 * Step Functions パイプライン横断バリデーター
 *
 * 4ステップ（transform → format → summarize → notify）の
 * 入出力データを検証する純粋関数群。
 * CDK/SDK に依存しないため単体テストが容易。
 *
 * 検証内容:
 *   - answer_type の有効値チェック
 *   - status の有効値チェック
 *   - テキスト長の上限チェック
 *   - Metadata フィールドの妥当性
 *   - ISO 8601 日時フォーマット
 *   - ステップ間データ整合性
 */

import { Metadata } from "./types";

// ── 型定義 ────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface Step1Input {
  message?: string;
}

export interface Step1Output {
  original: string;
  transformed: string;
  length: number;
  answer_type: string;
}

export interface Step2Input {
  bedrock_answer?: string;
  answer_type?: string;
}

export interface Step2Output {
  result: string;
  answer_type: string;
  status: string;
}

export interface Step3Output {
  summary: string;
  answer_type: string;
  status: string;
  metadata: Metadata;
}

export interface Step4Input {
  summary?: string;
  answer_type?: string;
  status?: string;
  metadata?: Metadata;
}

// ── 定数 ─────────────────────────────────────────────────────

/** パイプラインで有効な answer_type 値 */
export const VALID_ANSWER_TYPES = ["short", "detail"] as const;

/** パイプラインで有効な status 値 */
export const VALID_STATUSES = ["success", "empty", "error"] as const;

/** Step1 入力メッセージの最大文字数 */
export const MAX_MESSAGE_LENGTH = 10000;

/** Bedrock 回答の最大文字数 */
export const MAX_BEDROCK_ANSWER_LENGTH = 50000;

/** SNS Subject の最大バイト数（AWS 制約） */
export const MAX_SNS_SUBJECT_BYTES = 256;

/** ISO 8601 日時フォーマット正規表現 */
export const ISO8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

// ── 基本バリデーション ────────────────────────────────────────

/** answer_type が有効な値か */
export function isValidAnswerType(value: string): boolean {
  return (VALID_ANSWER_TYPES as readonly string[]).includes(value);
}

/** status が有効な値か */
export function isValidStatus(value: string): boolean {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

/** ISO 8601 フォーマットの日時文字列か */
export function isValidIso8601(value: string): boolean {
  if (!ISO8601_PATTERN.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

/** Unicode 文字数を返す（サロゲートペア対応） */
export function unicodeLength(text: string): number {
  return [...text].length;
}

/** 非負整数か */
export function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

// ── Step1 バリデーション ──────────────────────────────────────

/** Step1 入力を検証する */
export function validateStep1Input(input: Step1Input): ValidationError[] {
  const errors: ValidationError[] = [];

  if (input.message !== undefined) {
    if (typeof input.message !== "string") {
      errors.push({
        field: "message",
        message: "message は文字列である必要があります",
        severity: "error",
      });
      return errors;
    }

    if (input.message.length === 0) {
      errors.push({
        field: "message",
        message: "message が空文字です。デフォルト値 'Hello' が使用されます",
        severity: "warning",
      });
    }

    if (unicodeLength(input.message) > MAX_MESSAGE_LENGTH) {
      errors.push({
        field: "message",
        message: `message が上限 ${MAX_MESSAGE_LENGTH} 文字を超えています（${unicodeLength(input.message)} 文字）`,
        severity: "error",
      });
    }
  }

  return errors;
}

/** Step1 出力を検証する */
export function validateStep1Output(output: Step1Output): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!output.original && output.original !== "") {
    errors.push({
      field: "original",
      message: "original フィールドが未定義です",
      severity: "error",
    });
  }

  if (!output.transformed && output.transformed !== "") {
    errors.push({
      field: "transformed",
      message: "transformed フィールドが未定義です",
      severity: "error",
    });
  }

  if (!isNonNegativeInteger(output.length)) {
    errors.push({
      field: "length",
      message: `length は 0 以上の整数である必要があります（現在: ${output.length}）`,
      severity: "error",
    });
  }

  if (output.transformed !== output.original.toUpperCase()) {
    errors.push({
      field: "transformed",
      message: "transformed が original の大文字変換と一致しません",
      severity: "error",
    });
  }

  const expectedLength = unicodeLength(output.original);
  if (output.length !== expectedLength) {
    errors.push({
      field: "length",
      message: `length（${output.length}）が original の文字数（${expectedLength}）と一致しません`,
      severity: "error",
    });
  }

  if (!isValidAnswerType(output.answer_type)) {
    errors.push({
      field: "answer_type",
      message: `無効な answer_type: "${output.answer_type}"。有効値: ${VALID_ANSWER_TYPES.join(", ")}`,
      severity: "error",
    });
  }

  return errors;
}

// ── Step2 バリデーション ──────────────────────────────────────

/** Step2 入力を検証する */
export function validateStep2Input(input: Step2Input): ValidationError[] {
  const errors: ValidationError[] = [];

  if (
    input.answer_type !== undefined &&
    !isValidAnswerType(input.answer_type)
  ) {
    errors.push({
      field: "answer_type",
      message: `無効な answer_type: "${input.answer_type}"。有効値: ${VALID_ANSWER_TYPES.join(", ")}`,
      severity: "warning",
    });
  }

  if (input.bedrock_answer !== undefined) {
    if (input.bedrock_answer.length === 0) {
      errors.push({
        field: "bedrock_answer",
        message:
          "bedrock_answer が空文字です。status: 'empty' として処理されます",
        severity: "warning",
      });
    }

    if (unicodeLength(input.bedrock_answer) > MAX_BEDROCK_ANSWER_LENGTH) {
      errors.push({
        field: "bedrock_answer",
        message: `bedrock_answer が上限 ${MAX_BEDROCK_ANSWER_LENGTH} 文字を超えています`,
        severity: "error",
      });
    }
  }

  return errors;
}

/** Step2 出力を検証する */
export function validateStep2Output(output: Step2Output): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isValidStatus(output.status)) {
    errors.push({
      field: "status",
      message: `無効な status: "${output.status}"。有効値: ${VALID_STATUSES.join(", ")}`,
      severity: "error",
    });
  }

  if (output.status === "success" && output.result.length === 0) {
    errors.push({
      field: "result",
      message: "status が 'success' なのに result が空です",
      severity: "error",
    });
  }

  if (output.status === "empty" && output.result.length > 0) {
    errors.push({
      field: "result",
      message: "status が 'empty' なのに result が空ではありません",
      severity: "error",
    });
  }

  return errors;
}

// ── Metadata バリデーション ───────────────────────────────────

/** Metadata を検証する */
export function validateMetadata(metadata: Metadata): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isNonNegativeInteger(metadata.char_count)) {
    errors.push({
      field: "metadata.char_count",
      message: `char_count は 0 以上の整数である必要があります（現在: ${metadata.char_count}）`,
      severity: "error",
    });
  }

  if (!isNonNegativeInteger(metadata.word_count)) {
    errors.push({
      field: "metadata.word_count",
      message: `word_count は 0 以上の整数である必要があります（現在: ${metadata.word_count}）`,
      severity: "error",
    });
  }

  if (!isValidIso8601(metadata.processed_at)) {
    errors.push({
      field: "metadata.processed_at",
      message: `無効な ISO 8601 日時: "${metadata.processed_at}"`,
      severity: "error",
    });
  }

  if (typeof metadata.is_truncated !== "boolean") {
    errors.push({
      field: "metadata.is_truncated",
      message: "is_truncated は boolean である必要があります",
      severity: "error",
    });
  }

  if (metadata.char_count > 0 && metadata.word_count === 0) {
    errors.push({
      field: "metadata.word_count",
      message:
        "char_count > 0 なのに word_count が 0 です。空白のみの可能性があります",
      severity: "warning",
    });
  }

  return errors;
}

// ── Step3 出力バリデーション ──────────────────────────────────

/** Step3 出力を検証する */
export function validateStep3Output(output: Step3Output): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isValidStatus(output.status)) {
    errors.push({
      field: "status",
      message: `無効な status: "${output.status}"。有効値: ${VALID_STATUSES.join(", ")}`,
      severity: "error",
    });
  }

  errors.push(...validateMetadata(output.metadata));

  const actualCharCount = unicodeLength(output.summary);
  if (output.metadata.char_count !== actualCharCount) {
    errors.push({
      field: "metadata.char_count",
      message: `char_count（${output.metadata.char_count}）が summary の実際の文字数（${actualCharCount}）と一致しません`,
      severity: "error",
    });
  }

  return errors;
}

// ── Step4 入力バリデーション ──────────────────────────────────

/** Step4 入力を検証する */
export function validateStep4Input(input: Step4Input): ValidationError[] {
  const errors: ValidationError[] = [];

  if (
    input.answer_type !== undefined &&
    !isValidAnswerType(input.answer_type)
  ) {
    errors.push({
      field: "answer_type",
      message: `無効な answer_type: "${input.answer_type}"。有効値: ${VALID_ANSWER_TYPES.join(", ")}`,
      severity: "warning",
    });
  }

  if (input.status !== undefined && !isValidStatus(input.status)) {
    errors.push({
      field: "status",
      message: `無効な status: "${input.status}"。有効値: ${VALID_STATUSES.join(", ")}`,
      severity: "error",
    });
  }

  if (input.metadata !== undefined) {
    errors.push(...validateMetadata(input.metadata));
  }

  return errors;
}

// ── パイプライン横断バリデーション ────────────────────────────

/** Step1→Step2 のデータ伝播を検証する */
export function validateStep1ToStep2(
  step1Output: Step1Output,
  step2Input: Step2Input
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (
    step2Input.answer_type !== undefined &&
    step1Output.answer_type !== step2Input.answer_type
  ) {
    errors.push({
      field: "answer_type",
      message: `answer_type が Step1 出力（"${step1Output.answer_type}"）と Step2 入力（"${step2Input.answer_type}"）で不一致`,
      severity: "error",
    });
  }

  return errors;
}

/** Step2→Step3 のデータ伝播を検証する */
export function validateStep2ToStep3(
  step2Output: Step2Output,
  step3Output: Step3Output
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (step2Output.answer_type !== step3Output.answer_type) {
    errors.push({
      field: "answer_type",
      message: `answer_type が Step2（"${step2Output.answer_type}"）と Step3（"${step3Output.answer_type}"）で不一致`,
      severity: "error",
    });
  }

  if (step2Output.status !== step3Output.status) {
    errors.push({
      field: "status",
      message: `status が Step2（"${step2Output.status}"）と Step3（"${step3Output.status}"）で不一致`,
      severity: "error",
    });
  }

  return errors;
}

// ── ユーティリティ ────────────────────────────────────────────

/** エラーの有無を判定する（warning は含まない） */
export function hasErrors(errors: ValidationError[]): boolean {
  return errors.some((e) => e.severity === "error");
}

/** warning の有無を判定する */
export function hasWarnings(errors: ValidationError[]): boolean {
  return errors.some((e) => e.severity === "warning");
}

/** エラーをフォーマットする */
export function formatErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return "すべてのチェックが通過しました";
  return errors
    .map((e) => `[${e.severity.toUpperCase()}] ${e.field}: ${e.message}`)
    .join("\n");
}
