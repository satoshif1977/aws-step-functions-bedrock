/**
 * Lambda ハンドラ向けの観測ユーティリティ
 *
 * logger.ts / metrics.ts はそれぞれ単体では完成しているが、「どのハンドラで
 * どう組み合わせるか」が各ステートに散らばると、ログのキー名やメトリクスの
 * 名前空間がステートごとにずれていく。組み立て方を 1 か所に寄せ、Step Functions
 * の全ステートで同じ形の観測データが出るようにする。
 *
 * 同リポジトリの lambda_src/observability.py（Python 版）と対になる並置実装。
 * 関数名・ディメンション名・既定の名前空間を Python 版に揃えてある。
 *
 * 使い方:
 *   const { log, metrics } = observe("step1_transform", options);
 *   const stopTimer = metrics?.timer("HandlerLatency");
 *   try {
 *     ...
 *     recordMetrics(() => metrics?.count("Invocations"));
 *   } finally {
 *     recordMetrics(() => {
 *       stopTimer?.();
 *       metrics?.flush();
 *     });
 *   }
 */

import { handlerLogger } from "./handler-logger";
import type { HandlerOptions } from "./handler-logger";
import type { Logger } from "./logger";
import { createMetrics } from "./metrics";
import type { Metrics } from "./metrics";

// ── 定数（Python 版と揃える） ─────────────────────────────────

/** EMF のディメンションに載せるステート名のキー */
export const STEP_DIMENSION = "Step";

/** METRICS_NAMESPACE 未設定時に使う名前空間 */
export const DEFAULT_NAMESPACE = "Application";

/** 名前空間を指定する環境変数名 */
export const NAMESPACE_ENV_VAR = "METRICS_NAMESPACE";

// ── メトリクス ────────────────────────────────────────────────

/**
 * ステート名をディメンションに持つメトリクスを返す。作れなければ null。
 *
 * ディメンションはステート名だけに絞る。呼び出し箇所や answer_type まで
 * ディメンション化すると、カスタムメトリクスの本数がそのぶん増えて課金に効く。
 * 値の種類が多いものは setProperty() で持たせること。
 *
 * metrics.ts は設定ミス（空の名前空間など）を例外にする。CloudWatch が不正な
 * EMF を黙って破棄するため、モジュール単体では大きな声で失敗させたい。
 * ただしハンドラの仕事は本処理であって、環境変数の設定ミスでそこまで
 * 落とすのは割に合わないので、ここでは null に倒す。
 */
export function handlerMetrics(step: string, injected?: Metrics): Metrics | null {
  if (injected !== undefined) {
    recordMetrics(() => injected.setDimensions({ [STEP_DIMENSION]: step }));
    return injected;
  }
  try {
    return createMetrics({
      namespace: process.env[NAMESPACE_ENV_VAR] ?? DEFAULT_NAMESPACE,
      dimensions: { [STEP_DIMENSION]: step },
    });
  } catch {
    // ここでログを出すとロガー生成と順序が絡むため、黙って無効化する。
    // メトリクスが出ないことは、本処理が落ちることより軽い。
    return null;
  }
}

// ── まとめて組み立てる ────────────────────────────────────────

/** observe() の戻り値 */
export interface Observability {
  log: Logger;
  /** 組み立てに失敗した場合は null。呼び出し側は `?.` で扱う */
  metrics: Metrics | null;
}

/**
 * ハンドラ冒頭で呼ぶ。ロガーとメトリクスをまとめて組み立てる。
 *
 * EMF は 1 回の呼び出しで 1 ドキュメントを書くため、呼び出しごとに作る。
 * モジュール直下に置くと、実行環境が使い回されたときに前回のプロパティが残る。
 */
export function observe(step: string, options: HandlerOptions = {}): Observability {
  return {
    log: handlerLogger(step, options.logger),
    metrics: handlerMetrics(step, options.metrics),
  };
}

// ── 記録の補助 ────────────────────────────────────────────────

/**
 * メトリクスの記録を行う。失敗しても本処理を落とさない。
 *
 * 上限超過や設定ミスで metrics.ts が投げることがある。記録できないこと自体は
 * ステートの失敗ではないため、ここで握りつぶす。
 */
export function recordMetrics(fn: () => void): void {
  try {
    fn();
  } catch {
    // 握りつぶす
  }
}
