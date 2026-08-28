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
export const handler = async (event: Step1Event): Promise<Step1Response> => {
  const message = event.message ?? DEFAULT_MESSAGE;
  const { transformed, length } = transform(message);
  const answerType = classifyByLength(length);

  return {
    original: message,
    transformed,
    length,
    answer_type: answerType,
  };
};
