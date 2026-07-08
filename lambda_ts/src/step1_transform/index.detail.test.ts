import { transform, classifyByLength, handler } from "./index";

// ── transform() 詳細 ──────────────────────────────────────────

describe("transform() / 詳細", () => {
  it("数字は変換されない", () => {
    expect(transform("abc123").transformed).toBe("ABC123");
  });

  it("記号は変換されない", () => {
    expect(transform("hello!").transformed).toBe("HELLO!");
  });

  it("大文字はそのまま返る", () => {
    expect(transform("AWS").transformed).toBe("AWS");
  });

  it("混合文字列（英字+数字+記号）を正しく変換する", () => {
    const { transformed, length } = transform("Hello, World! 123");
    expect(transformed).toBe("HELLO, WORLD! 123");
    expect(length).toBe(17);
  });

  it("複数の絵文字を含む文字列の文字数が正しい", () => {
    // 🎉 と 🚀 はそれぞれ 1 文字（サロゲートペア）
    expect(transform("🎉🚀").length).toBe(2);
  });

  it("半角スペースのみの文字列を受け付ける", () => {
    const { transformed, length } = transform("   ");
    expect(transformed).toBe("   ");
    expect(length).toBe(3);
  });
});

// ── classifyByLength() 詳細 ───────────────────────────────────

describe("classifyByLength() / 詳細", () => {
  it("0 は short", () => {
    expect(classifyByLength(0)).toBe("short");
  });

  it("境界値 SHORT_THRESHOLD(20) の次の値 21 は detail", () => {
    expect(classifyByLength(21)).toBe("detail");
  });

  it("大きい値 1000 は detail", () => {
    expect(classifyByLength(1000)).toBe("detail");
  });
});

// ── handler() 詳細 ────────────────────────────────────────────

describe("handler() / 詳細", () => {
  it("original に入力メッセージがそのまま格納される", async () => {
    const result = await handler({ message: "StepFunctions" });
    expect(result.original).toBe("StepFunctions");
  });

  it("空文字を渡したとき length が 0 で short になる", async () => {
    const result = await handler({ message: "" });
    expect(result.length).toBe(0);
    expect(result.answer_type).toBe("short");
    expect(result.transformed).toBe("");
  });

  it("ちょうど 20 文字のメッセージは short になる", async () => {
    const result = await handler({ message: "a".repeat(20) });
    expect(result.answer_type).toBe("short");
    expect(result.length).toBe(20);
  });

  it("ちょうど 21 文字のメッセージは detail になる", async () => {
    const result = await handler({ message: "a".repeat(21) });
    expect(result.answer_type).toBe("detail");
    expect(result.length).toBe(21);
  });

  it("レスポンスに必須フィールドが全て含まれる", async () => {
    const result = await handler({ message: "test" });
    expect(result).toHaveProperty("original");
    expect(result).toHaveProperty("transformed");
    expect(result).toHaveProperty("length");
    expect(result).toHaveProperty("answer_type");
  });
});
