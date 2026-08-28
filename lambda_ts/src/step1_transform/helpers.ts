/**
 * Step1Transform ヘルパー関数・定数
 * テキスト変換・分類ロジックを index.ts から分離。
 */

// ── 定数 ─────────────────────────────────────────────────────
export const SHORT_THRESHOLD = 20;
export const DEFAULT_MESSAGE = "Hello";

// ── ヘルパー関数 ──────────────────────────────────────────────

/**
 * テキストを大文字変換してUnicode文字数を返す。
 * [...str] で サロゲートペア（絵文字等）も1文字としてカウントする。
 */
export function transform(text: string): { transformed: string; length: number } {
  return {
    transformed: text.toUpperCase(),
    length: [...text].length,
  };
}

/**
 * テキスト長から回答タイプを判定する。
 */
export function classifyByLength(length: number): "short" | "detail" {
  return length <= SHORT_THRESHOLD ? "short" : "detail";
}
