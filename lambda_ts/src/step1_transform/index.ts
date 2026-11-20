/**
 * Step1Transform（TypeScript版）: テキスト加工 Lambda
 * Step Functions の最初のステートとして起動する。
 * 入力テキストを大文字変換し、文字数をカウントして返す。
 *
 * 3言語比較:
 *   Python: boto3 で Bedrock を呼び出し・動的型付け
 *   Go    : 構造体で型安全・コールドスタート最速
 *   TS    : 静的型付け + 型推論・Node.js エコシステム活用
 */

import { DEFAULT_MESSAGE, transform, classifyByLength } from './helpers';
import type { HandlerOptions } from "../shared/handler-logger";
import { observe, recordMetrics } from "../shared/observability";

export type { HandlerOptions } from "../shared/handler-logger";

// ── 入出力型定義 ──────────────────────────────────────────────
export interface Step1Event {
  message?: string;
}

export interface Step1Response {
  original: string;
  transformed: string;
  length: number;
  answer_type: "short" | "detail";
}

// ── re-export ────────────────────────────────────────────────
export { transform, classifyByLength } from './helpers';

// ── Lambda ハンドラー ─────────────────────────────────────────
export const handler = async (
  event: Step1Event,
  options: HandlerOptions = {},
): Promise<Step1Response> => {
  const { log, metrics } = observe("step1_transform", options);
  const stopTimer = metrics?.timer("HandlerLatency");

  try {
    log.debug("入力を受け取りました", { hasMessage: event.message !== undefined });

    const message = event.message ?? DEFAULT_MESSAGE;
    if (event.message === undefined) {
      log.warn("message が無いため既定値を使います", { defaultUsed: true });
      recordMetrics(() => metrics?.count("DefaultMessageUsed"));
    }

    const { transformed, length } = transform(message);
    const answerType = classifyByLength(length);

    log.info("テキストを加工しました", { length, answerType });

    recordMetrics(() => {
      metrics?.count("Invocations");
      metrics?.putMetric("TextLength", length, { unit: "Count" });
      // answer_type は 2 種類だがディメンションにはしない。
      // 増えたぶんだけ課金対象のカスタムメトリクスが作られるため。
      metrics?.setProperty("answerType", answerType);
    });

    return {
      original: message,
      transformed,
      length,
      answer_type: answerType,
    };
  } catch (error) {
    recordMetrics(() => metrics?.count("Errors"));
    throw error;
  } finally {
    // メトリクスは本処理の成否によらず必ず出す（失敗時のレイテンシも見たいため）
    recordMetrics(() => {
      stopTimer?.();
      metrics?.flush();
    });
  }
};
