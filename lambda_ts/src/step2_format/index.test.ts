import { resolveLabel, formatResult, handler } from "./index";

describe("resolveLabel()", () => {
  it("short → 簡潔回答", () => {
    expect(resolveLabel("short")).toBe("簡潔回答");
  });

  it("detail → 詳細回答", () => {
    expect(resolveLabel("detail")).toBe("詳細回答");
  });

  it("未知の type → 不明", () => {
    expect(resolveLabel("unknown")).toBe("不明");
    expect(resolveLabel("")).toBe("不明");
  });
});

describe("formatResult()", () => {
  it("short の回答をラベル付きで整形する", () => {
    expect(formatResult("これが回答です", "short")).toBe("[簡潔回答] これが回答です");
  });

  it("detail の回答をラベル付きで整形する", () => {
    expect(formatResult("詳細な説明...", "detail")).toBe("[詳細回答] 詳細な説明...");
  });
});

describe("handler()", () => {
  it("bedrock_answer がある場合は success で整形する", async () => {
    const result = await handler({
      bedrock_answer: "AWSはAmazon Web Servicesの略です",
      answer_type: "short",
    });
    expect(result.status).toBe("success");
    expect(result.result).toBe("[簡潔回答] AWSはAmazon Web Servicesの略です");
    expect(result.answer_type).toBe("short");
  });

  it("bedrock_answer が空の場合は empty を返す", async () => {
    const result = await handler({ bedrock_answer: "", answer_type: "detail" });
    expect(result.status).toBe("empty");
    expect(result.result).toBe("");
  });

  it("bedrock_answer が未指定の場合も empty を返す", async () => {
    const result = await handler({});
    expect(result.status).toBe("empty");
  });

  it("answer_type が未指定の場合は unknown を使う", async () => {
    const result = await handler({ bedrock_answer: "回答" });
    expect(result.answer_type).toBe("unknown");
    expect(result.result).toBe("[不明] 回答");
  });
});
