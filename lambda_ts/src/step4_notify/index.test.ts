import {
  buildSubject,
  buildMessage,
  buildAttributes,
  buildNotification,
  handler,
} from "./index";
import type { Metadata } from "./index";

// ── テスト用フィクスチャ ──────────────────────────────────────

const successMeta: Metadata = {
  char_count: 120,
  word_count: 20,
  processed_at: "2026-07-27T10:00:00.000Z",
  is_truncated: false,
};

const truncatedMeta: Metadata = {
  char_count: 600,
  word_count: 100,
  processed_at: "2026-07-27T10:00:00.000Z",
  is_truncated: true,
};

const baseEvent = {
  summary: "Bedrockの要約結果です",
  answer_type: "short",
  status: "success",
  metadata: successMeta,
};

// ── buildSubject() ────────────────────────────────────────────

describe("buildSubject()", () => {
  it("status が success かつ is_truncated が false → 正常 Subject", () => {
    expect(buildSubject("success", false)).toBe("Bedrock Summary Ready");
  });

  it("status が success かつ is_truncated が true → 切り捨て Subject", () => {
    expect(buildSubject("success", true)).toBe("Bedrock Summary Ready (Truncated)");
  });

  it("status が error → エラー Subject（truncated より優先）", () => {
    expect(buildSubject("error", true)).toBe("Bedrock Pipeline Error");
    expect(buildSubject("error", false)).toBe("Bedrock Pipeline Error");
  });

  it("status が empty → エラー Subject", () => {
    expect(buildSubject("empty", false)).toBe("Bedrock Pipeline Error");
  });
});

// ── buildMessage() ────────────────────────────────────────────

describe("buildMessage()", () => {
  it("success 時はサマリーを含むメッセージを返す", () => {
    const msg = buildMessage(baseEvent);
    expect(msg).toContain("Bedrockの要約結果です");
    expect(msg).toContain("回答種別: short");
    expect(msg).toContain("文字数: 120 語数: 20");
  });

  it("error 時はエラーメッセージを返す（サマリーを含まない）", () => {
    const msg = buildMessage({ ...baseEvent, status: "error" });
    expect(msg).toContain("エラーが発生しました");
    expect(msg).toContain("error");
    expect(msg).not.toContain("回答種別");
  });

  it("empty 時もエラーメッセージを返す", () => {
    const msg = buildMessage({ ...baseEvent, status: "empty" });
    expect(msg).toContain("empty");
  });
});

// ── buildAttributes() ────────────────────────────────────────

describe("buildAttributes()", () => {
  it("各フィールドが string に変換される", () => {
    const attrs = buildAttributes(baseEvent);
    expect(attrs.answer_type).toBe("short");
    expect(attrs.status).toBe("success");
    expect(attrs.char_count).toBe("120");
    expect(attrs.is_truncated).toBe("false");
  });

  it("is_truncated が true のとき 'true' 文字列になる", () => {
    const attrs = buildAttributes({ ...baseEvent, metadata: truncatedMeta });
    expect(attrs.is_truncated).toBe("true");
    expect(attrs.char_count).toBe("600");
  });
});

// ── buildNotification() ──────────────────────────────────────

describe("buildNotification()", () => {
  it("success 時のペイロードが正しく組み立てられる", () => {
    const notif = buildNotification(baseEvent);
    expect(notif.subject).toBe("Bedrock Summary Ready");
    expect(notif.message).toContain("Bedrockの要約結果です");
    expect(notif.attributes.status).toBe("success");
  });

  it("truncated 時のペイロードに切り捨て Subject が使われる", () => {
    const notif = buildNotification({ ...baseEvent, metadata: truncatedMeta });
    expect(notif.subject).toBe("Bedrock Summary Ready (Truncated)");
    expect(notif.attributes.is_truncated).toBe("true");
  });
});

// ── handler() ────────────────────────────────────────────────

describe("handler()", () => {
  it("step3_summarize の出力を受け取り SNS ペイロードを返す", async () => {
    const result = await handler(baseEvent);
    expect(result.notification.subject).toBe("Bedrock Summary Ready");
    expect(result.summary).toBe("Bedrockの要約結果です");
    expect(result.answer_type).toBe("short");
    expect(result.status).toBe("success");
    expect(result.pipeline_completed_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it("is_truncated が true のとき truncated Subject になる", async () => {
    const result = await handler({ ...baseEvent, metadata: truncatedMeta });
    expect(result.notification.subject).toBe("Bedrock Summary Ready (Truncated)");
  });

  it("status が error のときエラー Subject になる", async () => {
    const result = await handler({ ...baseEvent, status: "error" });
    expect(result.notification.subject).toBe("Bedrock Pipeline Error");
    expect(result.notification.message).toContain("エラーが発生しました");
  });

  it("全フィールド未指定でもデフォルト値で動作する", async () => {
    const result = await handler({});
    expect(result.summary).toBe("");
    expect(result.answer_type).toBe("unknown");
    expect(result.status).toBe("success");
    expect(result.notification.subject).toBe("Bedrock Summary Ready");
    expect(result.pipeline_completed_at).toBeDefined();
  });

  it("metadata が指定されている場合は char_count が正しく通る", async () => {
    const result = await handler(baseEvent);
    expect(result.metadata.char_count).toBe(120);
    expect(result.notification.attributes.char_count).toBe("120");
  });
});
