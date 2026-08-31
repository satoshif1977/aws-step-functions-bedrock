import {
  // 型
  ValidationError,
  Step1Input,
  Step1Output,
  Step2Input,
  Step2Output,
  Step3Output,
  Step4Input,
  // 定数
  VALID_ANSWER_TYPES,
  VALID_STATUSES,
  MAX_MESSAGE_LENGTH,
  MAX_BEDROCK_ANSWER_LENGTH,
  MAX_SNS_SUBJECT_BYTES,
  ISO8601_PATTERN,
  // 基本バリデーション
  isValidAnswerType,
  isValidStatus,
  isValidIso8601,
  unicodeLength,
  isNonNegativeInteger,
  // Step バリデーション
  validateStep1Input,
  validateStep1Output,
  validateStep2Input,
  validateStep2Output,
  validateMetadata,
  validateStep3Output,
  validateStep4Input,
  // パイプライン横断
  validateStep1ToStep2,
  validateStep2ToStep3,
  // ユーティリティ
  hasErrors,
  hasWarnings,
  formatErrors,
} from "./validators";

import { Metadata } from "./types";

// ── テストヘルパー ────────────────────────────────────────────

function validMetadata(overrides?: Partial<Metadata>): Metadata {
  return {
    char_count: 5,
    word_count: 1,
    processed_at: "2026-09-01T00:00:00.000Z",
    is_truncated: false,
    ...overrides,
  };
}

function errorsOnly(errors: ValidationError[]): ValidationError[] {
  return errors.filter((e) => e.severity === "error");
}

function warningsOnly(errors: ValidationError[]): ValidationError[] {
  return errors.filter((e) => e.severity === "warning");
}

// ── 定数 ─────────────────────────────────────────────────────

describe("定数", () => {
  test("VALID_ANSWER_TYPES は short と detail を含む", () => {
    expect(VALID_ANSWER_TYPES).toContain("short");
    expect(VALID_ANSWER_TYPES).toContain("detail");
    expect(VALID_ANSWER_TYPES).toHaveLength(2);
  });

  test("VALID_STATUSES は success, empty, error を含む", () => {
    expect(VALID_STATUSES).toContain("success");
    expect(VALID_STATUSES).toContain("empty");
    expect(VALID_STATUSES).toContain("error");
    expect(VALID_STATUSES).toHaveLength(3);
  });

  test("MAX_MESSAGE_LENGTH は正の整数", () => {
    expect(MAX_MESSAGE_LENGTH).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_MESSAGE_LENGTH)).toBe(true);
  });

  test("MAX_BEDROCK_ANSWER_LENGTH は正の整数", () => {
    expect(MAX_BEDROCK_ANSWER_LENGTH).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_BEDROCK_ANSWER_LENGTH)).toBe(true);
  });

  test("MAX_SNS_SUBJECT_BYTES は 256", () => {
    expect(MAX_SNS_SUBJECT_BYTES).toBe(256);
  });

  test("ISO8601_PATTERN は有効なパターン", () => {
    expect(ISO8601_PATTERN).toBeInstanceOf(RegExp);
  });
});

// ── isValidAnswerType ────────────────────────────────────────

describe("isValidAnswerType", () => {
  test.each(["short", "detail"])('"%s" は有効', (v) => {
    expect(isValidAnswerType(v)).toBe(true);
  });

  test.each(["unknown", "SHORT", "Detail", "", "other"])(
    '"%s" は無効',
    (v) => {
      expect(isValidAnswerType(v)).toBe(false);
    }
  );
});

// ── isValidStatus ────────────────────────────────────────────

describe("isValidStatus", () => {
  test.each(["success", "empty", "error"])('"%s" は有効', (v) => {
    expect(isValidStatus(v)).toBe(true);
  });

  test.each(["failed", "SUCCESS", "pending", ""])(
    '"%s" は無効',
    (v) => {
      expect(isValidStatus(v)).toBe(false);
    }
  );
});

// ── isValidIso8601 ───────────────────────────────────────────

describe("isValidIso8601", () => {
  test("ミリ秒付き ISO 8601", () => {
    expect(isValidIso8601("2026-09-01T12:34:56.789Z")).toBe(true);
  });

  test("ミリ秒なし ISO 8601", () => {
    expect(isValidIso8601("2026-09-01T00:00:00Z")).toBe(true);
  });

  test("1桁ミリ秒", () => {
    expect(isValidIso8601("2026-01-01T00:00:00.1Z")).toBe(true);
  });

  test("2桁ミリ秒", () => {
    expect(isValidIso8601("2026-01-01T00:00:00.12Z")).toBe(true);
  });

  test("タイムゾーンオフセット付きは不正", () => {
    expect(isValidIso8601("2026-09-01T12:00:00+09:00")).toBe(false);
  });

  test("日付のみは不正", () => {
    expect(isValidIso8601("2026-09-01")).toBe(false);
  });

  test("空文字は不正", () => {
    expect(isValidIso8601("")).toBe(false);
  });

  test("無効な日付（13月）は不正", () => {
    expect(isValidIso8601("2026-13-01T00:00:00Z")).toBe(false);
  });

  test("文字列は不正", () => {
    expect(isValidIso8601("not-a-date")).toBe(false);
  });
});

// ── unicodeLength ────────────────────────────────────────────

describe("unicodeLength", () => {
  test("ASCII 文字列", () => {
    expect(unicodeLength("hello")).toBe(5);
  });

  test("日本語文字列", () => {
    expect(unicodeLength("こんにちは")).toBe(5);
  });

  test("絵文字（サロゲートペア）", () => {
    expect(unicodeLength("👍")).toBe(1);
  });

  test("混合文字列", () => {
    expect(unicodeLength("Hello世界👍")).toBe(8);
  });

  test("空文字列", () => {
    expect(unicodeLength("")).toBe(0);
  });
});

// ── isNonNegativeInteger ─────────────────────────────────────

describe("isNonNegativeInteger", () => {
  test("0 は有効", () => {
    expect(isNonNegativeInteger(0)).toBe(true);
  });

  test("正の整数は有効", () => {
    expect(isNonNegativeInteger(42)).toBe(true);
  });

  test("負の整数は無効", () => {
    expect(isNonNegativeInteger(-1)).toBe(false);
  });

  test("小数は無効", () => {
    expect(isNonNegativeInteger(1.5)).toBe(false);
  });

  test("NaN は無効", () => {
    expect(isNonNegativeInteger(NaN)).toBe(false);
  });

  test("Infinity は無効", () => {
    expect(isNonNegativeInteger(Infinity)).toBe(false);
  });
});

// ── validateStep1Input ───────────────────────────────────────

describe("validateStep1Input", () => {
  test("message 未指定はエラーなし（デフォルト使用）", () => {
    expect(validateStep1Input({})).toHaveLength(0);
  });

  test("通常メッセージはエラーなし", () => {
    expect(validateStep1Input({ message: "Hello" })).toHaveLength(0);
  });

  test("空文字は warning", () => {
    const result = validateStep1Input({ message: "" });
    expect(warningsOnly(result)).toHaveLength(1);
    expect(errorsOnly(result)).toHaveLength(0);
  });

  test("上限超過は error", () => {
    const longMsg = "a".repeat(MAX_MESSAGE_LENGTH + 1);
    const result = validateStep1Input({ message: longMsg });
    expect(errorsOnly(result)).toHaveLength(1);
    expect(result[0].field).toBe("message");
  });

  test("上限ちょうどはエラーなし", () => {
    const maxMsg = "a".repeat(MAX_MESSAGE_LENGTH);
    expect(validateStep1Input({ message: maxMsg })).toHaveLength(0);
  });

  test("Unicode 文字で上限チェック", () => {
    const emojiMsg = "👍".repeat(MAX_MESSAGE_LENGTH + 1);
    const result = validateStep1Input({ message: emojiMsg });
    expect(errorsOnly(result)).toHaveLength(1);
  });
});

// ── validateStep1Output ──────────────────────────────────────

describe("validateStep1Output", () => {
  test("正常な出力はエラーなし", () => {
    const output: Step1Output = {
      original: "hello",
      transformed: "HELLO",
      length: 5,
      answer_type: "short",
    };
    expect(validateStep1Output(output)).toHaveLength(0);
  });

  test("transformed が大文字変換でない場合はエラー", () => {
    const output: Step1Output = {
      original: "hello",
      transformed: "hello",
      length: 5,
      answer_type: "short",
    };
    const result = errorsOnly(validateStep1Output(output));
    expect(result.some((e) => e.field === "transformed")).toBe(true);
  });

  test("length が実際の文字数と不一致", () => {
    const output: Step1Output = {
      original: "hello",
      transformed: "HELLO",
      length: 10,
      answer_type: "short",
    };
    const result = errorsOnly(validateStep1Output(output));
    expect(result.some((e) => e.field === "length")).toBe(true);
  });

  test("負の length はエラー", () => {
    const output: Step1Output = {
      original: "",
      transformed: "",
      length: -1,
      answer_type: "short",
    };
    const result = errorsOnly(validateStep1Output(output));
    expect(result.some((e) => e.field === "length")).toBe(true);
  });

  test("無効な answer_type はエラー", () => {
    const output: Step1Output = {
      original: "hi",
      transformed: "HI",
      length: 2,
      answer_type: "unknown",
    };
    const result = errorsOnly(validateStep1Output(output));
    expect(result.some((e) => e.field === "answer_type")).toBe(true);
  });

  test("空文字は正常（length=0, answer_type=short）", () => {
    const output: Step1Output = {
      original: "",
      transformed: "",
      length: 0,
      answer_type: "short",
    };
    expect(validateStep1Output(output)).toHaveLength(0);
  });

  test("絵文字の文字数が正しい場合はエラーなし", () => {
    const output: Step1Output = {
      original: "👍👍",
      transformed: "👍👍",
      length: 2,
      answer_type: "short",
    };
    expect(validateStep1Output(output)).toHaveLength(0);
  });
});

// ── validateStep2Input ───────────────────────────────────────

describe("validateStep2Input", () => {
  test("全フィールド正常", () => {
    const input: Step2Input = {
      bedrock_answer: "Hello world",
      answer_type: "short",
    };
    expect(validateStep2Input(input)).toHaveLength(0);
  });

  test("空オブジェクトはエラーなし", () => {
    expect(validateStep2Input({})).toHaveLength(0);
  });

  test("無効な answer_type は warning", () => {
    const input: Step2Input = { answer_type: "unknown" };
    const result = validateStep2Input(input);
    expect(warningsOnly(result)).toHaveLength(1);
    expect(errorsOnly(result)).toHaveLength(0);
  });

  test("空の bedrock_answer は warning", () => {
    const input: Step2Input = { bedrock_answer: "" };
    const result = validateStep2Input(input);
    expect(warningsOnly(result)).toHaveLength(1);
  });

  test("bedrock_answer 上限超過は error", () => {
    const input: Step2Input = {
      bedrock_answer: "x".repeat(MAX_BEDROCK_ANSWER_LENGTH + 1),
    };
    const result = errorsOnly(validateStep2Input(input));
    expect(result).toHaveLength(1);
    expect(result[0].field).toBe("bedrock_answer");
  });

  test("bedrock_answer 上限ちょうどはエラーなし", () => {
    const input: Step2Input = {
      bedrock_answer: "x".repeat(MAX_BEDROCK_ANSWER_LENGTH),
      answer_type: "detail",
    };
    expect(validateStep2Input(input)).toHaveLength(0);
  });
});

// ── validateStep2Output ──────────────────────────────────────

describe("validateStep2Output", () => {
  test("success + 結果ありは正常", () => {
    const output: Step2Output = {
      result: "[簡潔回答] test",
      answer_type: "short",
      status: "success",
    };
    expect(validateStep2Output(output)).toHaveLength(0);
  });

  test("empty + 結果なしは正常", () => {
    const output: Step2Output = {
      result: "",
      answer_type: "short",
      status: "empty",
    };
    expect(validateStep2Output(output)).toHaveLength(0);
  });

  test("無効な status はエラー", () => {
    const output: Step2Output = {
      result: "test",
      answer_type: "short",
      status: "invalid",
    };
    const result = errorsOnly(validateStep2Output(output));
    expect(result.some((e) => e.field === "status")).toBe(true);
  });

  test("success なのに result 空はエラー", () => {
    const output: Step2Output = {
      result: "",
      answer_type: "short",
      status: "success",
    };
    const result = errorsOnly(validateStep2Output(output));
    expect(result.some((e) => e.field === "result")).toBe(true);
  });

  test("empty なのに result ありはエラー", () => {
    const output: Step2Output = {
      result: "something",
      answer_type: "short",
      status: "empty",
    };
    const result = errorsOnly(validateStep2Output(output));
    expect(result.some((e) => e.field === "result")).toBe(true);
  });
});

// ── validateMetadata ─────────────────────────────────────────

describe("validateMetadata", () => {
  test("正常な Metadata はエラーなし", () => {
    expect(validateMetadata(validMetadata())).toHaveLength(0);
  });

  test("負の char_count はエラー", () => {
    const result = errorsOnly(
      validateMetadata(validMetadata({ char_count: -1 }))
    );
    expect(result.some((e) => e.field === "metadata.char_count")).toBe(true);
  });

  test("小数の char_count はエラー", () => {
    const result = errorsOnly(
      validateMetadata(validMetadata({ char_count: 1.5 }))
    );
    expect(result.some((e) => e.field === "metadata.char_count")).toBe(true);
  });

  test("負の word_count はエラー", () => {
    const result = errorsOnly(
      validateMetadata(validMetadata({ word_count: -1 }))
    );
    expect(result.some((e) => e.field === "metadata.word_count")).toBe(true);
  });

  test("無効な processed_at はエラー", () => {
    const result = errorsOnly(
      validateMetadata(validMetadata({ processed_at: "invalid" }))
    );
    expect(result.some((e) => e.field === "metadata.processed_at")).toBe(true);
  });

  test("char_count > 0 && word_count === 0 は warning", () => {
    const result = warningsOnly(
      validateMetadata(validMetadata({ char_count: 5, word_count: 0 }))
    );
    expect(result).toHaveLength(1);
    expect(result[0].field).toBe("metadata.word_count");
  });

  test("char_count === 0 && word_count === 0 はエラーなし", () => {
    const result = validateMetadata(
      validMetadata({ char_count: 0, word_count: 0 })
    );
    expect(errorsOnly(result)).toHaveLength(0);
    expect(warningsOnly(result)).toHaveLength(0);
  });
});

// ── validateStep3Output ──────────────────────────────────────

describe("validateStep3Output", () => {
  test("正常な出力はエラーなし", () => {
    const output: Step3Output = {
      summary: "hello",
      answer_type: "short",
      status: "success",
      metadata: validMetadata(),
    };
    expect(validateStep3Output(output)).toHaveLength(0);
  });

  test("char_count が summary と不一致はエラー", () => {
    const output: Step3Output = {
      summary: "hello",
      answer_type: "short",
      status: "success",
      metadata: validMetadata({ char_count: 999 }),
    };
    const result = errorsOnly(validateStep3Output(output));
    expect(result.some((e) => e.field === "metadata.char_count")).toBe(true);
  });

  test("無効な status はエラー", () => {
    const output: Step3Output = {
      summary: "",
      answer_type: "short",
      status: "invalid",
      metadata: validMetadata({ char_count: 0, word_count: 0 }),
    };
    const result = errorsOnly(validateStep3Output(output));
    expect(result.some((e) => e.field === "status")).toBe(true);
  });

  test("空 summary + char_count=0 は正常", () => {
    const output: Step3Output = {
      summary: "",
      answer_type: "short",
      status: "empty",
      metadata: validMetadata({ char_count: 0, word_count: 0 }),
    };
    expect(errorsOnly(validateStep3Output(output))).toHaveLength(0);
  });
});

// ── validateStep4Input ───────────────────────────────────────

describe("validateStep4Input", () => {
  test("全フィールド正常はエラーなし", () => {
    const input: Step4Input = {
      summary: "test",
      answer_type: "short",
      status: "success",
      metadata: validMetadata(),
    };
    expect(validateStep4Input(input)).toHaveLength(0);
  });

  test("空オブジェクトはエラーなし", () => {
    expect(validateStep4Input({})).toHaveLength(0);
  });

  test("無効な answer_type は warning", () => {
    const input: Step4Input = { answer_type: "unknown" };
    const result = validateStep4Input(input);
    expect(warningsOnly(result)).toHaveLength(1);
  });

  test("無効な status は error", () => {
    const input: Step4Input = { status: "invalid" };
    const result = errorsOnly(validateStep4Input(input));
    expect(result.some((e) => e.field === "status")).toBe(true);
  });

  test("無効な metadata はエラーを伝播", () => {
    const input: Step4Input = {
      metadata: validMetadata({ char_count: -1 }),
    };
    const result = errorsOnly(validateStep4Input(input));
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── validateStep1ToStep2 ─────────────────────────────────────

describe("validateStep1ToStep2", () => {
  const step1Out: Step1Output = {
    original: "hello",
    transformed: "HELLO",
    length: 5,
    answer_type: "short",
  };

  test("answer_type 一致はエラーなし", () => {
    const step2In: Step2Input = {
      bedrock_answer: "response",
      answer_type: "short",
    };
    expect(validateStep1ToStep2(step1Out, step2In)).toHaveLength(0);
  });

  test("answer_type 不一致はエラー", () => {
    const step2In: Step2Input = {
      bedrock_answer: "response",
      answer_type: "detail",
    };
    const result = errorsOnly(validateStep1ToStep2(step1Out, step2In));
    expect(result.some((e) => e.field === "answer_type")).toBe(true);
  });

  test("Step2 の answer_type が未指定ならスキップ", () => {
    const step2In: Step2Input = { bedrock_answer: "response" };
    expect(validateStep1ToStep2(step1Out, step2In)).toHaveLength(0);
  });
});

// ── validateStep2ToStep3 ─────────────────────────────────────

describe("validateStep2ToStep3", () => {
  test("全フィールド一致はエラーなし", () => {
    const step2Out: Step2Output = {
      result: "[簡潔回答] test",
      answer_type: "short",
      status: "success",
    };
    const step3Out: Step3Output = {
      summary: "[簡潔回答] test",
      answer_type: "short",
      status: "success",
      metadata: validMetadata(),
    };
    expect(validateStep2ToStep3(step2Out, step3Out)).toHaveLength(0);
  });

  test("answer_type 不一致はエラー", () => {
    const step2Out: Step2Output = {
      result: "test",
      answer_type: "short",
      status: "success",
    };
    const step3Out: Step3Output = {
      summary: "test",
      answer_type: "detail",
      status: "success",
      metadata: validMetadata(),
    };
    const result = errorsOnly(validateStep2ToStep3(step2Out, step3Out));
    expect(result.some((e) => e.field === "answer_type")).toBe(true);
  });

  test("status 不一致はエラー", () => {
    const step2Out: Step2Output = {
      result: "",
      answer_type: "short",
      status: "empty",
    };
    const step3Out: Step3Output = {
      summary: "",
      answer_type: "short",
      status: "success",
      metadata: validMetadata({ char_count: 0, word_count: 0 }),
    };
    const result = errorsOnly(validateStep2ToStep3(step2Out, step3Out));
    expect(result.some((e) => e.field === "status")).toBe(true);
  });
});

// ── hasErrors / hasWarnings ──────────────────────────────────

describe("hasErrors / hasWarnings", () => {
  test("エラーありは true", () => {
    const errors: ValidationError[] = [
      { field: "x", message: "err", severity: "error" },
    ];
    expect(hasErrors(errors)).toBe(true);
  });

  test("warning のみは hasErrors=false", () => {
    const errors: ValidationError[] = [
      { field: "x", message: "warn", severity: "warning" },
    ];
    expect(hasErrors(errors)).toBe(false);
  });

  test("warning ありは hasWarnings=true", () => {
    const errors: ValidationError[] = [
      { field: "x", message: "warn", severity: "warning" },
    ];
    expect(hasWarnings(errors)).toBe(true);
  });

  test("空配列はどちらも false", () => {
    expect(hasErrors([])).toBe(false);
    expect(hasWarnings([])).toBe(false);
  });

  test("error と warning 混在", () => {
    const errors: ValidationError[] = [
      { field: "a", message: "err", severity: "error" },
      { field: "b", message: "warn", severity: "warning" },
    ];
    expect(hasErrors(errors)).toBe(true);
    expect(hasWarnings(errors)).toBe(true);
  });
});

// ── formatErrors ─────────────────────────────────────────────

describe("formatErrors", () => {
  test("空配列は通過メッセージ", () => {
    expect(formatErrors([])).toBe("すべてのチェックが通過しました");
  });

  test("エラー1件のフォーマット", () => {
    const errors: ValidationError[] = [
      { field: "message", message: "テストエラー", severity: "error" },
    ];
    expect(formatErrors(errors)).toBe("[ERROR] message: テストエラー");
  });

  test("warning のフォーマット", () => {
    const errors: ValidationError[] = [
      { field: "x", message: "テスト警告", severity: "warning" },
    ];
    expect(formatErrors(errors)).toBe("[WARNING] x: テスト警告");
  });

  test("複数件は改行区切り", () => {
    const errors: ValidationError[] = [
      { field: "a", message: "err1", severity: "error" },
      { field: "b", message: "warn1", severity: "warning" },
    ];
    const formatted = formatErrors(errors);
    expect(formatted).toContain("[ERROR] a: err1");
    expect(formatted).toContain("[WARNING] b: warn1");
    expect(formatted.split("\n")).toHaveLength(2);
  });
});
