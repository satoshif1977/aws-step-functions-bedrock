/**
 * Step2Format ヘルパー関数・定数
 * 回答整形ロジックを index.ts から分離。
 */

// ── ラベルマッピング ──────────────────────────────────────────
export const LABEL_MAP: Record<string, string> = {
  short: "簡潔回答",
  detail: "詳細回答",
};

// ── ヘルパー関数 ──────────────────────────────────────────────

/**
 * answer_type から表示ラベルを取得する。
 * 未知の type は "不明" として扱う。
 */
export function resolveLabel(answerType: string): string {
  return LABEL_MAP[answerType] ?? "不明";
}

/**
 * Bedrock 回答をラベル付きフォーマットに整形する。
 */
export function formatResult(answer: string, answerType: string): string {
  const label = resolveLabel(answerType);
  return `[${label}] ${answer}`;
}
