/**
 * Step3Summarize ヘルパー関数・定数
 * メタデータ生成ロジックを index.ts から分離。
 */

import { Metadata } from '../shared/types';

// ── 定数 ─────────────────────────────────────────────────────
export const TRUNCATE_LIMIT = 500;

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
