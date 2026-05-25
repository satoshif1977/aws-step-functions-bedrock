import { transform, classifyByLength, handler } from "./index";

describe("transform()", () => {
  it("英字を大文字変換する", () => {
    expect(transform("hello")).toEqual({ transformed: "HELLO", length: 5 });
  });

  it("日本語の文字数を Unicode 単位で正しくカウントする", () => {
    const { transformed, length } = transform("こんにちは");
    expect(transformed).toBe("こんにちは"); // 日本語は大文字変換なし
    expect(length).toBe(5);
  });

  it("絵文字をサロゲートペア対応で1文字としてカウントする", () => {
    const { length } = transform("Hello🎉");
    expect(length).toBe(6); // H+e+l+l+o+🎉
  });

  it("空文字を受け付ける", () => {
    expect(transform("")).toEqual({ transformed: "", length: 0 });
  });
});

describe("classifyByLength()", () => {
  it("20文字以下は short", () => {
    expect(classifyByLength(20)).toBe("short");
    expect(classifyByLength(1)).toBe("short");
  });

  it("21文字以上は detail", () => {
    expect(classifyByLength(21)).toBe("detail");
    expect(classifyByLength(100)).toBe("detail");
  });
});

describe("handler()", () => {
  it("message が未指定のときデフォルト 'Hello' を使用する", async () => {
    const result = await handler({});
    expect(result.original).toBe("Hello");
    expect(result.transformed).toBe("HELLO");
    expect(result.length).toBe(5);
    expect(result.answer_type).toBe("short");
  });

  it("長いメッセージで answer_type が detail になる", async () => {
    // 21文字以上のメッセージ（正確に22文字）
    const result = await handler({ message: "これは二十一文字以上のメッセージテストです" });
    expect(result.length).toBeGreaterThan(20);
    expect(result.answer_type).toBe("detail");
  });

  it("英字メッセージが正しく大文字変換される", async () => {
    const result = await handler({ message: "aws step functions" });
    expect(result.transformed).toBe("AWS STEP FUNCTIONS");
  });
});
