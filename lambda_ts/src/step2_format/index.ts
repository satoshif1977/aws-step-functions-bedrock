/**
 * Step2Format（TypeScript版）: 回答整形 Lambda
 * Step Functions の最終ステートとして起動する。
 * Bedrock の回答を answer_type に応じてラベル付きで整形して返す。
 *
 * 注: TypeScript版はテキスト処理に専念（Bedrock 呼び出しは Step Functions が直接実施）
 */

import { resolveLabel, formatResult } from './helpers';
import type { HandlerOptions } from "../shared/handler-logger";
import { observe, recordMetrics } from "../shared/observability";

export type { HandlerOptions } from "../shared/handler-logger";

// ── 入出力型定義 ──────────────────────────────────────────────
export interface Step2Event {
  bedrock_answer?: string;
  answer_type?: "short" | "detail" | string;
}

export interface Step2Response {
  result: string;
  answer_type: string;
  status: "success" | "empty";
}

// ── re-export ────────────────────────────────────────────────
export { resolveLabel, formatResult } from './helpers';

// ── Lambda ハンドラー ─────────────────────────────────────────
export const handler = async (
  event: Step2Event,
  options: HandlerOptions = {},
): Promise<Step2Response> => {
  const { log, metrics } = observe("step2_format", options);
  const stopTimer = metrics?.timer("HandlerLatency");

  try {
    const bedrockAnswer = event.bedrock_answer ?? "";
    const answerType = event.answer_type ?? "unknown";

    log.debug("入力を受け取りました", { answerType, answerLength: bedrockAnswer.length });
    recordMetrics(() => {
      metrics?.count("Invocations");
      metrics?.setProperty("answerType", answerType);
    });

    if (!bedrockAnswer) {
      log.warn("Bedrock の応答が空のため整形をスキップします", { answerType, status: "empty" });
      // 空応答は例外ではないが、続くと前段が壊れている合図になる
      recordMetrics(() => metrics?.count("EmptyAnswer"));
      return {
        result: "",
        answer_type: answerType,
        status: "empty",
      };
    }

    const result = formatResult(bedrockAnswer, answerType);
    log.info("応答を整形しました", { answerType, resultLength: result.length });
    recordMetrics(() => metrics?.putMetric("ResultLength", result.length, { unit: "Count" }));

    return {
      result,
      answer_type: answerType,
      status: "success",
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
