/**
 * 4 つの Lambda ハンドラが metrics を「実際に経由している」ことを固定する。
 *
 * ユーティリティを置いただけで呼び出し元に結線していない、という欠陥は
 * カバレッジでは検出できない（metrics.ts 単体のテストは通ってしまう）。
 * ここでは各ハンドラを実行し、出力された EMF ドキュメントを観測する。
 *
 * ログ側の同じ観点は handler-logging.test.ts にある。
 */

import { createMetrics, RESERVED_ROOT_KEY } from "./metrics";
import type { Metrics } from "./metrics";
import {
  DEFAULT_NAMESPACE,
  NAMESPACE_ENV_VAR,
  STEP_DIMENSION,
  handlerMetrics,
  observe,
  recordMetrics,
} from "./observability";
import { createLogger } from "./logger";

import { handler as step1 } from "../step1_transform";
import { handler as step2 } from "../step2_format";
import { handler as step3 } from "../step3_summarize";
import { handler as step4 } from "../step4_notify";

// ── テスト用ヘルパー ──────────────────────────────────────────

const FIXED_NOW = Date.UTC(2026, 10, 20, 9, 0, 0);

interface Harness {
  metrics: Metrics;
  lines: string[];
  docs(): Record<string, unknown>[];
  last(): Record<string, unknown>;
}

/** sink は EMF の 1 行 JSON を受け取るので、貯めてパースする */
function collector(): Harness {
  const lines: string[] = [];
  const metrics = createMetrics({
    namespace: "TestNs",
    sink: (line: string) => lines.push(line),
    now: () => FIXED_NOW,
  });
  const docs = () => lines.map((l) => JSON.parse(l) as Record<string, unknown>);
  return {
    metrics,
    lines,
    docs,
    last: () => {
      const all = docs();
      return all[all.length - 1];
    },
  };
}

function directiveOf(doc: Record<string, unknown>): Record<string, unknown> {
  const aws = doc[RESERVED_ROOT_KEY] as Record<string, unknown>;
  return (aws.CloudWatchMetrics as Record<string, unknown>[])[0];
}

function metricNames(doc: Record<string, unknown>): string[] {
  return (directiveOf(doc).Metrics as { Name: string }[]).map((d) => d.Name);
}

function dimensionKeys(doc: Record<string, unknown>): string[] {
  return (directiveOf(doc).Dimensions as string[][])[0];
}

/** EMF の行かどうか（console.log に混ざるログと区別する） */
function isMetricsLine(line: unknown): boolean {
  try {
    return RESERVED_ROOT_KEY in (JSON.parse(String(line)) as Record<string, unknown>);
  } catch {
    return false;
  }
}

const METADATA = {
  char_count: 10,
  word_count: 2,
  processed_at: "2026-11-20T09:00:00.000Z",
  is_truncated: false,
};

afterEach(() => {
  delete process.env[NAMESPACE_ENV_VAR];
});

// ── 各ハンドラとの結線 ────────────────────────────────────────

describe("各ハンドラと metrics の結線", () => {
  test("step1_transform: Invocations と TextLength を出す", async () => {
    const h = collector();

    await step1({ message: "hello world" }, { metrics: h.metrics });

    expect(h.lines).toHaveLength(1);
    expect(h.last().Invocations).toBe(1);
    expect(h.last().TextLength).toBe("hello world".length);
    expect(dimensionKeys(h.last())).toEqual([STEP_DIMENSION]);
    expect(h.last()[STEP_DIMENSION]).toBe("step1_transform");
  });

  test("step1_transform: message が無いと DefaultMessageUsed を出す", async () => {
    const h = collector();

    await step1({}, { metrics: h.metrics });

    expect(h.last().DefaultMessageUsed).toBe(1);
  });

  test("step1_transform: message があれば DefaultMessageUsed は出ない", async () => {
    const h = collector();

    await step1({ message: "ok" }, { metrics: h.metrics });

    expect(metricNames(h.last())).not.toContain("DefaultMessageUsed");
  });

  test("step2_format: Invocations と ResultLength を出す", async () => {
    const h = collector();

    await step2({ bedrock_answer: "答えです", answer_type: "short" }, { metrics: h.metrics });

    expect(h.last().Invocations).toBe(1);
    expect(h.last().ResultLength as number).toBeGreaterThan(0);
    expect(h.last()[STEP_DIMENSION]).toBe("step2_format");
  });

  test("step2_format: 応答が空だと EmptyAnswer を出す", async () => {
    const h = collector();

    const result = await step2({ bedrock_answer: "" }, { metrics: h.metrics });

    expect(result.status).toBe("empty");
    expect(h.last().EmptyAnswer).toBe(1);
    // 整形していないので長さは出さない
    expect(metricNames(h.last())).not.toContain("ResultLength");
  });

  test("step3_summarize: CharCount と WordCount を出す", async () => {
    const h = collector();

    await step3({ result: "hello world", answer_type: "short" }, { metrics: h.metrics });

    expect(h.last().Invocations).toBe(1);
    expect(h.last().CharCount).toBe("hello world".length);
    expect(h.last().WordCount).toBe(2);
    expect(h.last()[STEP_DIMENSION]).toBe("step3_summarize");
  });

  test("step3_summarize: 切り捨てが起きると Truncated を出す", async () => {
    const h = collector();

    await step3({ result: "あ".repeat(5000) }, { metrics: h.metrics });

    expect(h.last().Truncated).toBe(1);
  });

  test("step3_summarize: 切り捨てがなければ Truncated は出ない", async () => {
    const h = collector();

    await step3({ result: "short" }, { metrics: h.metrics });

    expect(metricNames(h.last())).not.toContain("Truncated");
  });

  test("step4_notify: Invocations を出す", async () => {
    const h = collector();

    await step4(
      { summary: "まとめ", answer_type: "short", status: "success", metadata: METADATA },
      { metrics: h.metrics },
    );

    expect(h.last().Invocations).toBe(1);
    expect(h.last()[STEP_DIMENSION]).toBe("step4_notify");
  });

  test("step4_notify: 異常終了だと ErrorNotification を出す", async () => {
    const h = collector();

    await step4(
      { summary: "", answer_type: "short", status: "failed", metadata: METADATA },
      { metrics: h.metrics },
    );

    expect(h.last().ErrorNotification).toBe(1);
  });

  test("step4_notify: 切り捨て済みだと TruncatedNotification を出す", async () => {
    const h = collector();

    await step4(
      {
        summary: "まとめ",
        answer_type: "detail",
        status: "success",
        metadata: { ...METADATA, is_truncated: true },
      },
      { metrics: h.metrics },
    );

    expect(h.last().TruncatedNotification).toBe(1);
  });
});

// ── 所要時間 ──────────────────────────────────────────────────

describe("所要時間", () => {
  test.each([
    ["step1_transform", (m: Metrics) => step1({ message: "a" }, { metrics: m })],
    ["step2_format", (m: Metrics) => step2({ bedrock_answer: "a" }, { metrics: m })],
    ["step3_summarize", (m: Metrics) => step3({ result: "a" }, { metrics: m })],
    [
      "step4_notify",
      (m: Metrics) => step4({ summary: "a", metadata: METADATA }, { metrics: m }),
    ],
  ])("%s が HandlerLatency を出す", async (step, run) => {
    const h = collector();

    await run(h.metrics);

    expect(metricNames(h.last())).toContain("HandlerLatency");
    expect(h.last()[STEP_DIMENSION]).toBe(step);
  });

  test("HandlerLatency の単位は Milliseconds", async () => {
    const h = collector();

    await step1({ message: "a" }, { metrics: h.metrics });

    const defs = directiveOf(h.last()).Metrics as { Name: string; Unit: string }[];
    expect(defs.find((d) => d.Name === "HandlerLatency")?.Unit).toBe("Milliseconds");
  });
});

// ── 設計意図: 高カーディナリティをディメンションにしない ──────

describe("高カーディナリティの値をディメンションに入れない", () => {
  test("ディメンションはステート名だけ", async () => {
    const h = collector();

    await step3({ result: "x", answer_type: "detail", status: "success" }, { metrics: h.metrics });

    expect(dimensionKeys(h.last())).toEqual([STEP_DIMENSION]);
  });

  test("answerType はプロパティとして出る（メトリクス定義には載らない）", async () => {
    const h = collector();

    await step2({ bedrock_answer: "a", answer_type: "detail" }, { metrics: h.metrics });

    expect(h.last().answerType).toBe("detail");
    expect(metricNames(h.last())).not.toContain("answerType");
  });
});

// ── 失敗時 ────────────────────────────────────────────────────

describe("ハンドラが落ちたとき", () => {
  /** log.info で投げるロガー。ハンドラ内部の例外を再現する */
  function throwingLogger() {
    const logger = createLogger({ level: "debug", sink: () => undefined });
    return {
      ...logger,
      child: () => ({
        ...logger,
        child: () => logger,
        info: () => {
          throw new Error("ログに失敗しました");
        },
      }),
    } as unknown as ReturnType<typeof createLogger>;
  }

  type Run = (m: Metrics, l: ReturnType<typeof createLogger>) => Promise<unknown>;

  const RUNS: [string, Run][] = [
    ["step1_transform", (m, l) => step1({ message: "a" }, { metrics: m, logger: l })],
    ["step2_format", (m, l) => step2({ bedrock_answer: "a" }, { metrics: m, logger: l })],
    ["step3_summarize", (m, l) => step3({ result: "a" }, { metrics: m, logger: l })],
    [
      "step4_notify",
      (m, l) => step4({ summary: "a", metadata: METADATA }, { metrics: m, logger: l }),
    ],
  ];

  test.each(RUNS)("%s: Errors を出したうえで例外を投げ直す", async (step, run) => {
    const h = collector();

    await expect(run(h.metrics, throwingLogger())).rejects.toThrow("ログに失敗しました");

    expect(h.last().Errors).toBe(1);
    expect(h.last()[STEP_DIMENSION]).toBe(step);
  });

  test("失敗してもメトリクスは flush される（失敗時のレイテンシも見たい）", async () => {
    const h = collector();

    await expect(
      step1({ message: "a" }, { metrics: h.metrics, logger: throwingLogger() }),
    ).rejects.toThrow();

    expect(h.lines).toHaveLength(1);
    expect(metricNames(h.last())).toContain("HandlerLatency");
  });
});

// ── 注入しない場合 ────────────────────────────────────────────

describe("注入しない場合は環境変数から組み立てる", () => {
  test("console.log に EMF が出る（置いただけではない）", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation();

    await step1({ message: "a" });

    const emf = spy.mock.calls.map((c) => String(c[0])).filter(isMetricsLine);
    expect(emf).toHaveLength(1);
    spy.mockRestore();
  });

  test("既定の名前空間は DEFAULT_NAMESPACE", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation();

    await step1({ message: "a" });

    const emf = spy.mock.calls.map((c) => String(c[0])).filter(isMetricsLine);
    const doc = JSON.parse(emf[0]) as Record<string, unknown>;
    expect(directiveOf(doc).Namespace).toBe(DEFAULT_NAMESPACE);
    spy.mockRestore();
  });

  test("METRICS_NAMESPACE で名前空間を上書きできる", async () => {
    process.env[NAMESPACE_ENV_VAR] = "MyPipeline";
    const spy = jest.spyOn(console, "log").mockImplementation();

    await step1({ message: "a" });

    const emf = spy.mock.calls.map((c) => String(c[0])).filter(isMetricsLine);
    const doc = JSON.parse(emf[0]) as Record<string, unknown>;
    expect(directiveOf(doc).Namespace).toBe("MyPipeline");
    spy.mockRestore();
  });

  test("名前空間が空でもハンドラは結果を返す", async () => {
    process.env[NAMESPACE_ENV_VAR] = "";
    const spy = jest.spyOn(console, "log").mockImplementation();

    const result = await step1({ message: "hello" });

    expect(result.original).toBe("hello");
    spy.mockRestore();
  });
});

// ── observability.ts 単体 ─────────────────────────────────────

describe("handlerMetrics", () => {
  test("注入されたメトリクスにステート名のディメンションを足す", () => {
    const h = collector();

    const m = handlerMetrics("step9_test", h.metrics);
    m?.count("X");
    m?.flush();

    expect(dimensionKeys(h.last())).toEqual([STEP_DIMENSION]);
    expect(h.last()[STEP_DIMENSION]).toBe("step9_test");
  });

  test("名前空間が空なら null を返す（例外にしない）", () => {
    process.env[NAMESPACE_ENV_VAR] = "";

    expect(handlerMetrics("step9_test")).toBeNull();
  });
});

describe("observe", () => {
  test("ロガーとメトリクスをまとめて返す", () => {
    const h = collector();

    const { log, metrics } = observe("step9_test", { metrics: h.metrics });

    expect(typeof log.info).toBe("function");
    expect(metrics).not.toBeNull();
  });

  test("名前空間が空でもロガーは返る", () => {
    process.env[NAMESPACE_ENV_VAR] = "";

    const { log, metrics } = observe("step9_test");

    expect(typeof log.info).toBe("function");
    expect(metrics).toBeNull();
  });
});

describe("recordMetrics", () => {
  test("中で投げても呼び出し元に伝えない", () => {
    expect(() =>
      recordMetrics(() => {
        throw new Error("boom");
      }),
    ).not.toThrow();
  });

  test("投げなければそのまま実行される", () => {
    let called = false;
    recordMetrics(() => {
      called = true;
    });
    expect(called).toBe(true);
  });
});
