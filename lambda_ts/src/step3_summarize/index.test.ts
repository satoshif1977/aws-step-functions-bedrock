import { countChars, countWords, isTruncated, buildMetadata, handler } from "./index";

describe("countChars()", () => {
  it("ASCII 文字を正しくカウントする", () => {
    expect(countChars("hello")).toBe(5);
  });

  it("日本語文字を Unicode 単位でカウントする", () => {
    expect(countChars("こんにちは")).toBe(5);
  });

  it("絵文字をサロゲートペア対応で1文字としてカウントする", () => {
    expect(countChars("Hello🎉")).toBe(6);
  });

  it("空文字を受け付ける", () => {
    expect(countChars("")).toBe(0);
  });
});

describe("countWords()", () => {
  it("スペース区切りで単語数を返す", () => {
    expect(countWords("hello world")).toBe(2);
  });

  it("連続する空白をまとめて処理する", () => {
    expect(countWords("hello   world")).toBe(2);
  });

  it("空文字は 0 語", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });

  it("単一単語は 1 語", () => {
    expect(countWords("Bedrock")).toBe(1);
  });
});

describe("isTruncated()", () => {
  it("500文字以下は false", () => {
    expect(isTruncated("a".repeat(500))).toBe(false);
  });

  it("501文字以上は true", () => {
    expect(isTruncated("a".repeat(501))).toBe(true);
  });

  it("空文字は false", () => {
    expect(isTruncated("")).toBe(false);
  });

  it("カスタム limit を指定できる", () => {
    expect(isTruncated("hello", 4)).toBe(true);
    expect(isTruncated("hello", 5)).toBe(false);
  });
});

describe("buildMetadata()", () => {
  it("メタデータの各フィールドが正しく生成される", () => {
    const meta = buildMetadata("hello world");
    expect(meta.char_count).toBe(11);
    expect(meta.word_count).toBe(2);
    expect(meta.is_truncated).toBe(false);
    expect(meta.processed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("501文字のテキストで is_truncated が true になる", () => {
    const meta = buildMetadata("a".repeat(501));
    expect(meta.is_truncated).toBe(true);
    expect(meta.char_count).toBe(501);
  });

  it("空文字でも正常に生成される", () => {
    const meta = buildMetadata("");
    expect(meta.char_count).toBe(0);
    expect(meta.word_count).toBe(0);
    expect(meta.is_truncated).toBe(false);
  });
});

describe("handler()", () => {
  it("step2_format の出力を受け取りメタデータを付与する", async () => {
    const result = await handler({
      result: "[簡潔回答] AWSはAmazon Web Servicesの略です",
      answer_type: "short",
      status: "success",
    });
    expect(result.summary).toBe("[簡潔回答] AWSはAmazon Web Servicesの略です");
    expect(result.answer_type).toBe("short");
    expect(result.status).toBe("success");
    expect(result.metadata.char_count).toBeGreaterThan(0);
    expect(result.metadata.word_count).toBeGreaterThan(0);
    expect(result.metadata.processed_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it("result が未指定のときデフォルト空文字を使用する", async () => {
    const result = await handler({});
    expect(result.summary).toBe("");
    expect(result.answer_type).toBe("unknown");
    expect(result.status).toBe("success");
    expect(result.metadata.char_count).toBe(0);
  });

  it("status が empty の場合もそのまま通す", async () => {
    const result = await handler({
      result: "",
      answer_type: "detail",
      status: "empty",
    });
    expect(result.status).toBe("empty");
    expect(result.metadata.char_count).toBe(0);
  });
});
