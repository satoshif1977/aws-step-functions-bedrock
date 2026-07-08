import { resolveLabel, formatResult, handler } from "./index";

// ── resolveLabel() 詳細 ───────────────────────────────────────

describe("resolveLabel() / 詳細", () => {
  it("ホワイトスペースのみは 不明 を返す", () => {
    expect(resolveLabel("  ")).toBe("不明");
  });

  it("大文字 SHORT は 不明 にフォールバックする（大文字小文字を区別する）", () => {
    expect(resolveLabel("SHORT")).toBe("不明");
  });

  it("DETAIL は 不明 にフォールバックする", () => {
    expect(resolveLabel("DETAIL")).toBe("不明");
  });

  it("short と detail 以外の任意の文字列は 不明 を返す", () => {
    expect(resolveLabel("medium")).toBe("不明");
  });
});

// ── formatResult() 詳細 ───────────────────────────────────────

describe("formatResult() / 詳細", () => {
  it("unknown type は [不明] ラベルで整形される", () => {
    expect(formatResult("回答テキスト", "unknown")).toBe("[不明] 回答テキスト");
  });

  it("回答が空文字でもラベルが付与される", () => {
    expect(formatResult("", "short")).toBe("[簡潔回答] ");
  });

  it("回答の前後スペースがそのまま保持される", () => {
    expect(formatResult("  スペースあり  ", "detail")).toBe("[詳細回答]   スペースあり  ");
  });

  it("フォーマットが [ラベル] + スペース + 回答 の形式になる", () => {
    const result = formatResult("テスト", "short");
    expect(result).toMatch(/^\[.+\] .+/);
  });
});

// ── handler() 詳細 ────────────────────────────────────────────

describe("handler() / 詳細", () => {
  it("answer_type が 'short' のとき result に [簡潔回答] が含まれる", async () => {
    const result = await handler({ bedrock_answer: "回答", answer_type: "short" });
    expect(result.result).toContain("[簡潔回答]");
  });

  it("answer_type が 'detail' のとき result に [詳細回答] が含まれる", async () => {
    const result = await handler({ bedrock_answer: "詳細な説明", answer_type: "detail" });
    expect(result.result).toContain("[詳細回答]");
  });

  it("status は success か empty の二値のみ", async () => {
    const r1 = await handler({ bedrock_answer: "回答", answer_type: "short" });
    const r2 = await handler({ bedrock_answer: "" });
    expect(["success", "empty"]).toContain(r1.status);
    expect(["success", "empty"]).toContain(r2.status);
  });

  it("レスポンスに必須フィールドが全て含まれる", async () => {
    const result = await handler({ bedrock_answer: "テスト" });
    expect(result).toHaveProperty("result");
    expect(result).toHaveProperty("answer_type");
    expect(result).toHaveProperty("status");
  });

  it("半角スペースのみの bedrock_answer は success になる（falsy ではない）", async () => {
    const result = await handler({ bedrock_answer: " ", answer_type: "short" });
    expect(result.status).toBe("success");
  });

  it("answer_type が返り値にそのまま含まれる", async () => {
    const result = await handler({ bedrock_answer: "回答", answer_type: "detail" });
    expect(result.answer_type).toBe("detail");
  });
});
