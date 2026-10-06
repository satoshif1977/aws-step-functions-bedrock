/**
 * Step2Format（TypeScript版）: 回答整形 Lambda
 * Step Functions の最終ステートとして起動する。
 * Bedrock の回答を answer_type に応じてラベル付きで整形して返す。
 *
 * 注: TypeScript版はテキスト処理に専念（Bedrock 呼び出しは Step Functions が直接実施）
 */

import { resolveLabel, formatResult } from './helpers';
import { handlerLogger } from "../shared/handler-logger";
import type { HandlerOptions } from "../shared/handler-logger";

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
  const log = handlerLogger("step2_format", options.logger);
  const bedrockAnswer = event.bedrock_answer ?? "";
  const answerType = event.answer_type ?? "unknown";

  log.debug("入力を受け取りました", { answerType, answerLength: bedrockAnswer.length });

  if (!bedrockAnswer) {
    log.warn("Bedrock の応答が空のため整形をスキップします", { answerType, status: "empty" });
    return {
      result: "",
      answer_type: answerType,
      status: "empty",
    };
  }

  const result = formatResult(bedrockAnswer, answerType);
  log.info("応答を整形しました", { answerType, resultLength: result.length });

  return {
    result,
    answer_type: answerType,
    status: "success",
  };
};
