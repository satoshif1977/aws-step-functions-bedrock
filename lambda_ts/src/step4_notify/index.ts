/**
 * Step4Notify（TypeScript版）: SNS 通知ペイロード生成 Lambda
 * Step Functions の最終ステートとして起動する。
 * step3_summarize の出力を受け取り、SNS に渡す通知ペイロードを生成して返す。
 * 実際の SNS Publish は Step Functions の SDK Integration（Task State）で行うため、
 * この Lambda はペイロード構築のみを担当する（外部 API 呼び出しなし・完全テスト可能）。
 *
 * ルーティングロジック:
 *   - status !== "success"  → Subject: エラー通知
 *   - is_truncated === true → Subject: 切り捨て警告付き
 *   - それ以外              → Subject: 正常完了
 */

// ── 定数 ─────────────────────────────────────────────────────
const SUBJECT_SUCCESS = "Bedrock Summary Ready";
const SUBJECT_TRUNCATED = "Bedrock Summary Ready (Truncated)";
const SUBJECT_ERROR = "Bedrock Pipeline Error";

// ── 入出力型定義 ──────────────────────────────────────────────
export interface Metadata {
  char_count: number;
  word_count: number;
  processed_at: string;
  is_truncated: boolean;
}

export interface Step4Event {
  summary?: string;
  answer_type?: string;
  status?: string;
  metadata?: Metadata;
}

/** SNS MessageAttributes に相当するフラット構造体。数値・bool も string で保持する。 */
export interface SNSAttributes {
  answer_type: string;
  status: string;
  char_count: string;
  is_truncated: string;
}

export interface Notification {
  subject: string;
  message: string;
  attributes: SNSAttributes;
}

export interface Step4Response {
  notification: Notification;
  summary: string;
  answer_type: string;
  status: string;
  metadata: Metadata;
  pipeline_completed_at: string;
}

// ── ヘルパー関数 ──────────────────────────────────────────────

/**
 * ステータスと切り捨て状態から SNS Subject を決定する。
 * 優先度: エラー > 切り捨て > 正常
 */
export function buildSubject(status: string, isTruncated: boolean): string {
  if (status !== "success") return SUBJECT_ERROR;
  if (isTruncated) return SUBJECT_TRUNCATED;
  return SUBJECT_SUCCESS;
}

/**
 * ステータスに応じた SNS 本文を生成する。
 */
export function buildMessage(event: Required<Step4Event>): string {
  if (event.status !== "success") {
    return `パイプラインでエラーが発生しました。ステータス: ${event.status}`;
  }
  return [
    `回答種別: ${event.answer_type}`,
    `文字数: ${event.metadata.char_count} 語数: ${event.metadata.word_count}`,
    `処理時刻: ${event.metadata.processed_at}`,
    "",
    event.summary,
  ].join("\n");
}

/**
 * SNS MessageAttributes 用のフラット構造体を生成する。
 * number / boolean は string に変換して格納する。
 */
export function buildAttributes(event: Required<Step4Event>): SNSAttributes {
  return {
    answer_type: event.answer_type,
    status: event.status,
    char_count: String(event.metadata.char_count),
    is_truncated: String(event.metadata.is_truncated),
  };
}

/**
 * SNS 通知ペイロード全体を組み立てる。
 */
export function buildNotification(event: Required<Step4Event>): Notification {
  return {
    subject: buildSubject(event.status, event.metadata.is_truncated),
    message: buildMessage(event),
    attributes: buildAttributes(event),
  };
}

// ── Lambda ハンドラー ─────────────────────────────────────────
export const handler = async (event: Step4Event): Promise<Step4Response> => {
  const defaultMetadata: Metadata = {
    char_count: 0,
    word_count: 0,
    processed_at: new Date().toISOString(),
    is_truncated: false,
  };

  const normalized: Required<Step4Event> = {
    summary: event.summary ?? "",
    answer_type: event.answer_type ?? "unknown",
    status: event.status ?? "success",
    metadata: event.metadata ?? defaultMetadata,
  };

  return {
    notification: buildNotification(normalized),
    summary: normalized.summary,
    answer_type: normalized.answer_type,
    status: normalized.status,
    metadata: normalized.metadata,
    pipeline_completed_at: new Date().toISOString(),
  };
};
