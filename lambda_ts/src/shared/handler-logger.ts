/**
 * Lambda ハンドラ向けのロガー生成ヘルパー。
 *
 * 各ステートで同じ形のログを出せるよう、step 名を共通フィールドに載せた
 * 子ロガーを返す。環境変数 LOG_LEVEL で出力レベルを切り替えられる。
 */

import { createLoggerFromEnv } from "./logger";
import type { Logger } from "./logger";
import type { Metrics } from "./metrics";

/** ハンドラに渡せる差し替え用オプション（テストから注入する） */
export interface HandlerOptions {
  /** ログ出力先。省略時は環境変数からロガーを組み立てる */
  logger?: Logger;
  /** メトリクスの記録先。省略時は環境変数から組み立てる（observability.ts） */
  metrics?: Metrics;
}

/** step 名を共通フィールドに載せたロガーを返す */
export function handlerLogger(step: string, injected?: Logger): Logger {
  const base = injected ?? createLoggerFromEnv();
  return base.child({ step });
}
