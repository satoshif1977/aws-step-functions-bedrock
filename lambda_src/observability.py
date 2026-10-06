"""
Lambda ハンドラ向けの観測ユーティリティ

logger.py / metrics.py / retry.py は、それぞれ単体では完成しているが
「どのハンドラでどう組み合わせるか」が各関数に散らばると、ログのキー名や
メトリクスの名前空間が関数ごとにずれていく。ここで組み立て方を 1 か所に寄せ、
Step Functions の全ステートで同じ形の観測データが出るようにする。

retry.py の retry_call は on_retry を 1 つしか受け取れないため、
ログとメトリクスの両方を出したい場合は合成する必要がある。
その合成も、呼び出し側に書かせずここで引き受ける。

デプロイ時の注意:
  本モジュールを import する関数は、modules/lambda の shared_modules に
  observability.py / logger.py / metrics.py を含めること。
  列挙漏れは Lambda 実行時の ImportError として表面化する。

使い方:
    log, metrics = observe("step1_transform")
    try:
        response = retry_call(
            bedrock.invoke_model,
            on_retry=retry_hooks(log, metrics, "InvokeModel"),
            ...
        )
    finally:
        metrics.flush()
"""

from __future__ import annotations

from collections.abc import Callable

from logger import StructuredLogger, create_logger_from_env, retry_logger
from metrics import MetricsCollector, create_metrics_from_env, retry_metrics

#: EMF のディメンションに載せるステート名のキー
STEP_DIMENSION = "Step"


def handler_logger(
    step: str, injected: StructuredLogger | None = None
) -> StructuredLogger:
    """ステート名を共通フィールドに載せたロガーを返す。

    環境変数 LOG_LEVEL で出力レベルを切り替えられる（未設定なら info）。
    """
    base = injected if injected is not None else create_logger_from_env()
    return base.child(step=step)


def handler_metrics(
    step: str, injected: MetricsCollector | None = None
) -> MetricsCollector:
    """ステート名をディメンションに持つコレクタを返す。

    ディメンションはステート名だけに絞る。呼び出し箇所やモデル ID まで
    ディメンション化すると、カスタムメトリクスの本数がそのぶん増えて課金に効く。
    """
    if injected is not None:
        injected.add_dimension(STEP_DIMENSION, step)
        return injected
    return create_metrics_from_env(**{STEP_DIMENSION: step})


def observe(
    step: str,
    log: StructuredLogger | None = None,
    metrics: MetricsCollector | None = None,
) -> tuple[StructuredLogger, MetricsCollector]:
    """ハンドラ冒頭で呼ぶ。ロガーとメトリクスコレクタをまとめて組み立てる。"""
    return handler_logger(step, log), handler_metrics(step, metrics)


def combine_hooks(
    *hooks: Callable[[int, float, BaseException], None] | None,
) -> Callable[[int, float, BaseException], None]:
    """複数の on_retry フックを 1 つに合成する。

    retry_call は on_retry を 1 つしか取らないため、ログとメトリクスを
    両方出したい場合はここで束ねる。None は読み飛ばす。
    """
    active = [h for h in hooks if h is not None]

    def on_retry(attempt: int, delay_seconds: float, exc: BaseException) -> None:
        for hook in active:
            hook(attempt, delay_seconds, exc)

    return on_retry


def retry_hooks(
    log: StructuredLogger,
    metrics: MetricsCollector,
    operation: str,
) -> Callable[[int, float, BaseException], None]:
    """retry_call(on_retry=...) に渡す、ログ + メトリクスの合成フックを返す。"""
    return combine_hooks(
        retry_logger(log, operation),
        retry_metrics(metrics, operation),
    )
