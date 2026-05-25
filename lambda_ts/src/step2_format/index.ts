/**
 * Step2Format（TypeScript版）: 回答整形 Lambda
 * Step Functions の最終ステートとして起動する。
 * Bedrock の回答を answer_type に応じてラベル付きで整形して返す。
 *
 * 注: TypeScript版はテキスト処理に専念（Bedrock 呼び出しは Step Functions が直接実施）
 */

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

// ── ラベルマッピング ──────────────────────────────────────────
const LABEL_MAP: Record<string, string> = {
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

// ── Lambda ハンドラー ─────────────────────────────────────────
export const handler = async (event: Step2Event): Promise<Step2Response> => {
  const bedrockAnswer = event.bedrock_answer ?? "";
  const answerType = event.answer_type ?? "unknown";

  if (!bedrockAnswer) {
    return {
      result: "",
      answer_type: answerType,
      status: "empty",
    };
  }

  return {
    result: formatResult(bedrockAnswer, answerType),
    answer_type: answerType,
    status: "success",
  };
};
