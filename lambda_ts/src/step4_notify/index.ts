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

import { Metadata } from '../shared/types';
import { buildNotification } from './helpers';
import type { Step4Event, Step4Response } from './helpers';

// ── re-export ────────────────────────────────────────────────
export type { Step4Event, SNSAttributes, Notification, Step4Response } from './helpers';
export type { Metadata } from '../shared/types';
export { buildSubject, buildMessage, buildAttributes, buildNotification } from './helpers';

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
