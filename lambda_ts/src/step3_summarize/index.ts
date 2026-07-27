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

// ── 定数 ─────────────────────────────────────────────────────
const TRUNCATE_LIMIT = 500;

// ── 入出力型定義 ──────────────────────────────────────────────
export interface Step3Event {
  result?: string;
  answer_type?: string;
  status?: string;
}

export interface Metadata {
  char_count: number;
  word_count: number;
  processed_at: string;
  is_truncated: boolean;
}

export interface Step3Response {
  summary: string;
  answer_type: string;
  status: string;
  metadata: Metadata;
}

// ── ヘルパー関数 ──────────────────────────────────────────────

/**
 * Unicode 文字数を返す。
 * [...str] でサロゲートペア（絵文字等）も1文字としてカウントする（Go の utf8.RuneCountInString 相当）。
 */
export function countChars(text: string): number {
  return [...text].length;
}

/**
 * 空白区切りの単語数を返す。
 * trim + split で先頭末尾の空白・連続空白を安全に処理する（Go の strings.Fields 相当）。
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * 文字数が limit を超えているか判定する。
 */
export function isTruncated(text: string, limit: number = TRUNCATE_LIMIT): boolean {
  return countChars(text) > limit;
}

/**
 * テキストからメタデータを生成する。
 */
export function buildMetadata(text: string): Metadata {
  return {
    char_count: countChars(text),
    word_count: countWords(text),
    processed_at: new Date().toISOString(),
    is_truncated: isTruncated(text),
  };
}

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
