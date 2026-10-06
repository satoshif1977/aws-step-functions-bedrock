/**
 * 4 つの Lambda ハンドラが logger を「実際に経由している」ことを固定する。
 *
 * ユーティリティを置いただけで呼び出し元に結線していない、という欠陥は
 * カバレッジでは検出できない（logger.ts 単体のテストは通ってしまう）。
 * ここでは各ハンドラを実行し、出力された JSON ログを観測する。
 */

import { createLogger } from "./logger";
import type { Logger } from "./logger";

import { handler as step1 } from "../step1_transform";
import { handler as step2 } from "../step2_format";
import { handler as step3 } from "../step3_summarize";
import { handler as step4 } from "../step4_notify";

/** sink は JSON 1 行を受け取るので、パースして貯める */
function collector(): { logger: Logger; entries: Record<string, unknown>[] } {
  const entries: Record<string, unknown>[] = [];
  const logger = createLogger({
    level: "debug",
    sink: (line: string) => {
      entries.push(JSON.parse(line) as Record<string, unknown>);
    },
  });
  return { logger, entries };
}

const levels = (entries: Record<string, unknown>[], level: string) =>
  entries.filter((e) => e.level === level);

describe("各ハンドラと logger の結線", () => {
  test("step1_transform: step 名と加工結果をログに残す", async () => {
    const { logger, entries } = collector();

    await step1({ message: "hello world" }, { logger });

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.step === "step1_transform")).toBe(true);

    const infos = levels(entries, "info");
    expect(infos).toHaveLength(1);
    expect(infos[0].length).toBe("hello world".length);
    expect(infos[0].answerType).toBeDefined();
  });

  test("step1_transform: message が無いときは warn を出す", async () => {
    const { logger, entries } = collector();

    await step1({}, { logger });

    const warns = levels(entries, "warn");
    expect(warns).toHaveLength(1);
    expect(warns[0].defaultUsed).toBe(true);
  });

  test("step2_format: 応答が空なら warn を出し status=empty で返す", async () => {
    const { logger, entries } = collector();

    const res = await step2({ bedrock_answer: "", answer_type: "short" }, { logger });

    expect(res.status).toBe("empty");
    const warns = levels(entries, "warn");
    expect(warns).toHaveLength(1);
    expect(warns[0].step).toBe("step2_format");
    expect(warns[0].status).toBe("empty");
  });

  test("step2_format: 正常時は warn を出さず info に整形後の長さを残す", async () => {
    const { logger, entries } = collector();

    await step2({ bedrock_answer: "これは回答です", answer_type: "detail" }, { logger });

    expect(levels(entries, "warn")).toHaveLength(0);
    const infos = levels(entries, "info");
    expect(infos).toHaveLength(1);
    expect(typeof infos[0].resultLength).toBe("number");
  });

  test("step3_summarize: メタデータの件数を info に残す", async () => {
    const { logger, entries } = collector();

    await step3({ result: "summary text", answer_type: "short", status: "success" }, { logger });

    const infos = levels(entries, "info");
    expect(infos).toHaveLength(1);
    expect(infos[0].step).toBe("step3_summarize");
    expect(typeof infos[0].charCount).toBe("number");
    expect(typeof infos[0].wordCount).toBe("number");
  });

  test("step4_notify: 異常終了なら warn を出す", async () => {
    const { logger, entries } = collector();

    await step4({ summary: "x", answer_type: "short", status: "failed" }, { logger });

    const warns = levels(entries, "warn");
    expect(warns).toHaveLength(1);
    expect(warns[0].step).toBe("step4_notify");
    expect(warns[0].status).toBe("failed");
  });

  test("step4_notify: 正常時は warn を出さず subject を info に残す", async () => {
    const { logger, entries } = collector();

    await step4({ summary: "ok", answer_type: "short", status: "success" }, { logger });

    expect(levels(entries, "warn")).toHaveLength(0);
    const infos = levels(entries, "info");
    expect(infos).toHaveLength(1);
    expect(typeof infos[0].subject).toBe("string");
  });

  test("ログは機密情報をマスクする", async () => {
    const { logger, entries } = collector();

    // 共通フィールドに機密っぽいキーを載せて、マスクされることを確かめる
    await step1({ message: "hi" }, { logger: logger.child({ apiKey: "secret-value" }) });

    const line = JSON.stringify(entries);
    expect(line).not.toContain("secret-value");
    expect(line).toContain("[REDACTED]");
  });

  test("ロガーを渡さなくても落ちない（既定ロガーが使われる）", async () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});
    try {
      const res = await step1({ message: "no logger" });
      expect(res.length).toBe("no logger".length);
    } finally {
      spy.mockRestore();
    }
  });
});
