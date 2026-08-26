/**
 * Step Functions パイプライン共通型定義
 * step3_summarize / step4_notify で共有する Metadata インターフェースを集約する。
 */

// ── パイプライン共通メタデータ ────────────────────────────────────
export interface Metadata {
  char_count: number;
  word_count: number;
  processed_at: string;
  is_truncated: boolean;
}
