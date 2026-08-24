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

// ── buildSubject 詳細 ──────────────────────────────────────────

describe("buildSubject / 詳細", () => {
  it("status が 'failed' でもエラー Subject になる", () => {
    expect(buildSubject("failed", false)).toBe("Bedrock Pipeline Error");
  });

  it("status が 'timeout' でもエラー Subject になる", () => {
    expect(buildSubject("timeout", true)).toBe("Bedrock Pipeline Error");
  });

  it("正常 Subject に 'Ready' が含まれる", () => {
    expect(buildSubject("success", false)).toContain("Ready");
  });

  it("切り捨て Subject に 'Truncated' が含まれる", () => {
    expect(buildSubject("success", true)).toContain("Truncated");
  });
});

// ── buildMessage 詳細 ──────────────────────────────────────────

describe("buildMessage / 詳細", () => {
  it("success メッセージに処理時刻が含まれる", () => {
    const msg = buildMessage(baseEvent);
    expect(msg).toContain("処理時刻:");
    expect(msg).toContain("2026-07-27T10:00:00.000Z");
  });

  it("success メッセージが複数行で構成される", () => {
    const msg = buildMessage(baseEvent);
    expect(msg.split("\n").length).toBeGreaterThanOrEqual(4);
  });

  it("error メッセージに 'ステータス:' が含まれる", () => {
    const msg = buildMessage({ ...baseEvent, status: "failed" });
    expect(msg).toContain("ステータス: failed");
  });

  it("detail 回答種別が正しく表示される", () => {
    const msg = buildMessage({ ...baseEvent, answer_type: "detail" });
    expect(msg).toContain("回答種別: detail");
  });
});

// ── buildAttributes 詳細 ───────────────────────────────────────

describe("buildAttributes / 詳細", () => {
  it("char_count=0 のとき '0' 文字列になる", () => {
    const meta: Metadata = { ...successMeta, char_count: 0 };
    const attrs = buildAttributes({ ...baseEvent, metadata: meta });
    expect(attrs.char_count).toBe("0");
  });

  it("answer_type が 'detail' のとき正しく設定される", () => {
    const attrs = buildAttributes({ ...baseEvent, answer_type: "detail" });
    expect(attrs.answer_type).toBe("detail");
  });

  it("全フィールドが string 型である", () => {
    const attrs = buildAttributes(baseEvent);
    Object.values(attrs).forEach((val) => {
      expect(typeof val).toBe("string");
    });
  });
});

// ── buildNotification 詳細 ─────────────────────────────────────

describe("buildNotification / 詳細", () => {
  it("error 時のペイロードにエラー Subject が使われる", () => {
    const notif = buildNotification({ ...baseEvent, status: "error" });
    expect(notif.subject).toBe("Bedrock Pipeline Error");
    expect(notif.message).toContain("エラーが発生しました");
  });

  it("attributes にすべての必須フィールドが含まれる", () => {
    const notif = buildNotification(baseEvent);
    expect(notif.attributes.answer_type).toBeDefined();
    expect(notif.attributes.status).toBeDefined();
    expect(notif.attributes.char_count).toBeDefined();
    expect(notif.attributes.is_truncated).toBeDefined();
  });

  it("message に summary テキストが含まれる", () => {
    const notif = buildNotification(baseEvent);
    expect(notif.message).toContain("Bedrockの要約結果です");
  });
});

// ── handler 詳細 ────────────────────────────────────────────────

describe("handler / 詳細", () => {
  it("pipeline_completed_at が ISO 8601 形式である", async () => {
    const result = await handler(baseEvent);
    expect(new Date(result.pipeline_completed_at).toISOString()).toBe(
      result.pipeline_completed_at
    );
  });

  it("metadata が入力からそのまま返される", async () => {
    const result = await handler(baseEvent);
    expect(result.metadata).toEqual(successMeta);
  });

  it("summary のみ指定した場合のデフォルト値が正しい", async () => {
    const result = await handler({ summary: "テスト" });
    expect(result.answer_type).toBe("unknown");
    expect(result.status).toBe("success");
    expect(result.metadata.char_count).toBe(0);
  });

  it("truncated metadata を渡すと notification.subject に Truncated が含まれる", async () => {
    const result = await handler({ ...baseEvent, metadata: truncatedMeta });
    expect(result.notification.subject).toContain("Truncated");
    expect(result.metadata.is_truncated).toBe(true);
  });

  it("notification.attributes.status と result.status が一致する", async () => {
    const result = await handler({ ...baseEvent, status: "error" });
    expect(result.notification.attributes.status).toBe(result.status);
  });
});
