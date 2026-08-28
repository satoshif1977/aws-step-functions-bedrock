/**
 * Step3Summarize（TypeScript版）: メタデータ付与 Lambda
 * Step Functions の最終ステートとして起動する。
 * step2_format の出力を受け取り、メタデータ（文字数・単語数・処理時刻・切り捨て判定）を付与して返す。
 *
 * 3言語比較:
 *   Python: len() はバイト数でなく文字数（UTF-8文字列）
 *   Go    : utf8.RuneCountInString() で Unicode 対応
 *   TS    : [...str].length で サロゲートペア（絵文字）も1文字としてカウント
 */

import { Metadata } from '../shared/types';
import { buildMetadata } from './helpers';

// ── 入出力型定義 ──────────────────────────────────────────────
export interface Step3Event {
  result?: string;
  answer_type?: string;
  status?: string;
}

export type { Metadata };

export interface Step3Response {
  summary: string;
  answer_type: string;
  status: string;
  metadata: Metadata;
}

// ── re-export ────────────────────────────────────────────────
export { countChars, countWords, isTruncated, buildMetadata } from './helpers';

// ── Lambda ハンドラー ─────────────────────────────────────────
export const handler = async (event: Step3Event): Promise<Step3Response> => {
  const result = event.result ?? "";
  const answerType = event.answer_type ?? "unknown";
  const status = event.status ?? "success";

  return {
    summary: result,
    answer_type: answerType,
    status,
    metadata: buildMetadata(result),
  };
};
