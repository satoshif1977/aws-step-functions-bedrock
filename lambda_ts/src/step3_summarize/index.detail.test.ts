import { countChars, countWords, isTruncated, buildMetadata, handler } from "./index";

// ── countChars 詳細 ─────────────────────────────────────────────

describe("countChars / 詳細", () => {
  it("タブと改行を含む文字列を正しくカウントする", () => {
    expect(countChars("a\tb\nc")).toBe(5);
  });

  it("複数の絵文字を正しくカウントする", () => {
    expect(countChars("🎉🚀✨")).toBe(3);
  });

  it("ASCII と日本語の混合文字列を正しくカウントする", () => {
    expect(countChars("Hello世界")).toBe(7);
  });

  it("500 文字ちょうどをカウントする", () => {
    expect(countChars("a".repeat(500))).toBe(500);
  });
});

// ── countWords 詳細 ─────────────────────────────────────────────

describe("countWords / 詳細", () => {
  it("タブ区切りの文字列で単語数を返す", () => {
    expect(countWords("hello\tworld")).toBe(2);
  });

  it("改行区切りの文字列で単語数を返す", () => {
    expect(countWords("hello\nworld\nfoo")).toBe(3);
  });

  it("先頭と末尾に空白がある場合も正しくカウントする", () => {
    expect(countWords("  hello world  ")).toBe(2);
  });

  it("日本語文（スペースなし）は1語としてカウントする", () => {
    expect(countWords("こんにちは世界")).toBe(1);
  });
});

// ── isTruncated 詳細 ────────────────────────────────────────────

describe("isTruncated / 詳細", () => {
  it("ちょうど limit と同じ文字数は false", () => {
    expect(isTruncated("a".repeat(500), 500)).toBe(false);
  });

  it("limit + 1 文字で true", () => {
    expect(isTruncated("a".repeat(501), 500)).toBe(true);
  });

  it("絵文字を含むテキストでも Unicode 文字数で判定する", () => {
    // 絵文字 5 文字 = limit 5 → false、limit 4 → true
    expect(isTruncated("🎉🚀✨🌟💫", 5)).toBe(false);
    expect(isTruncated("🎉🚀✨🌟💫", 4)).toBe(true);
  });

  it("limit=0 のとき空文字列は false", () => {
    expect(isTruncated("", 0)).toBe(false);
  });

  it("limit=0 のとき1文字は true", () => {
    expect(isTruncated("a", 0)).toBe(true);
  });
});

// ── buildMetadata 詳細 ──────────────────────────────────────────

describe("buildMetadata / 詳細", () => {
  it("processed_at が ISO 8601 形式である", () => {
    const meta = buildMetadata("test");
    expect(new Date(meta.processed_at).toISOString()).toBe(meta.processed_at);
  });

  it("日本語テキストの文字数が正しい", () => {
    const meta = buildMetadata("テスト文字列");
    expect(meta.char_count).toBe(6);
  });

  it("500 文字テキストで is_truncated が false", () => {
    const meta = buildMetadata("x".repeat(500));
    expect(meta.is_truncated).toBe(false);
    expect(meta.char_count).toBe(500);
  });

  it("501 文字テキストで is_truncated が true", () => {
    const meta = buildMetadata("x".repeat(501));
    expect(meta.is_truncated).toBe(true);
  });
});

// ── handler 詳細 ────────────────────────────────────────────────

describe("handler / 詳細", () => {
  it("answer_type が 'detail' のとき正しく返される", async () => {
    const result = await handler({
      result: "長い回答です",
      answer_type: "detail",
      status: "success",
    });
    expect(result.answer_type).toBe("detail");
  });

  it("status が 'error' でもメタデータが生成される", async () => {
    const result = await handler({
      result: "エラーテキスト",
      status: "error",
    });
    expect(result.status).toBe("error");
    expect(result.metadata.char_count).toBeGreaterThan(0);
  });

  it("result が 501 文字のとき metadata.is_truncated が true", async () => {
    const result = await handler({
      result: "a".repeat(501),
    });
    expect(result.metadata.is_truncated).toBe(true);
  });

  it("summary が result と同じ値を返す", async () => {
    const result = await handler({ result: "同一確認テスト" });
    expect(result.summary).toBe("同一確認テスト");
  });
});
