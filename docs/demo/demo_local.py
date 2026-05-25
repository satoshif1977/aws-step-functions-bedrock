#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
aws-step-functions-bedrock ローカルデモスクリプト
AWS 接続不要・標準ライブラリのみで動作します。

使い方:
    python docs/demo/demo_local.py

ScreenToGif 推奨設定:
    - 録画範囲: このターミナルウィンドウ全体
    - fps: 10
    - 最終 GIF サイズ: 幅 800-900px 程度
"""

import io
import json
import sys
import time

# Windows ターミナルで UTF-8 を強制出力
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
else:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


# ── ANSI カラー定数 ────────────────────────────────────────
class C:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    WHITE   = "\033[97m"
    CYAN    = "\033[96m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    BLUE    = "\033[94m"
    MAGENTA = "\033[95m"
    RED     = "\033[91m"
    GRAY    = "\033[90m"


# ── ユーティリティ ─────────────────────────────────────────
W = 68  # 表示幅


def hr(char: str = "-", color: str = C.GRAY) -> None:
    print(f"{color}{char * W}{C.RESET}")


def section(title: str, icon: str, color: str = C.CYAN) -> None:
    print()
    hr("-", C.GRAY)
    print(f"  {icon}  {C.BOLD}{color}{title}{C.RESET}")
    hr("-", C.GRAY)


def step_label(name: str, kind: str, color: str = C.CYAN) -> None:
    tag = f"{C.DIM}[{kind}]{C.RESET}"
    print(f"\n  {color}{C.BOLD}>> {name}{C.RESET}  {tag}")


def show_json(obj: dict, indent: int = 4, color: str = C.YELLOW) -> None:
    lines = json.dumps(obj, ensure_ascii=False, indent=2).splitlines()
    for line in lines:
        print(f"{' ' * indent}{color}{line}{C.RESET}")


def spinner(label: str, duration: float = 1.2, color: str = C.CYAN) -> None:
    frames = ["|", "/", "-", "\\"]
    end = time.time() + duration
    i = 0
    while time.time() < end:
        sys.stdout.write(f"\r  {color}{frames[i % len(frames)]}{C.RESET}  {label} ")
        sys.stdout.flush()
        time.sleep(0.1)
        i += 1
    sys.stdout.write(f"\r  {C.GREEN}OK{C.RESET} {label}         \n")
    sys.stdout.flush()


def pause(sec: float) -> None:
    time.sleep(sec)


# ── ステップ別シミュレーション ────────────────────────────


def run_step1(message: str) -> dict:
    """Step1Transform Lambda"""
    step_label("Step1Transform", "Lambda", C.CYAN)
    print(f"  {C.GRAY}入力テキストを変換中...{C.RESET}")
    spinner("テキスト加工 (大文字変換・文字数カウント)", duration=1.0)

    result = {
        "original": message,
        "transformed": message.upper(),
        "length": len(message),
        "answer_type": "short" if len(message) <= 20 else "detail",
    }
    print(f"  {C.GRAY}Lambda 出力:{C.RESET}")
    show_json(result)
    return result


def run_choice(step1_out: dict) -> str:
    """ClassifyByLength Choice ステート"""
    step_label("ClassifyByLength", "Choice State", C.MAGENTA)
    length = step1_out["length"]
    print(f"  {C.GRAY}条件評価:  $.length ({length}) <= 20{C.RESET}")
    pause(0.6)

    if length <= 20:
        route = "BedrockShortAnswer"
        print(f"  +-- length <= 20  -->  {C.BOLD}{C.GREEN}{route}{C.RESET}")
    else:
        route = "BedrockDetailAnswer"
        print(f"  +-- length > 20   -->  {C.BOLD}{C.YELLOW}{route}{C.RESET}")
    return route


def run_bedrock_short(step1_out: dict) -> dict:
    """BedrockShortAnswer (Step Functions SDK 統合)"""
    step_label("BedrockShortAnswer", "Bedrock SDK Integration", C.BLUE)
    print(f"  {C.GRAY}Resource : arn:aws:states:::bedrock:invokeModel{C.RESET}")
    print(f"  {C.GRAY}Model    : Claude 3.5 Haiku  |  max_tokens: 200{C.RESET}")
    spinner("Bedrock 呼び出し中 (Claude 3.5 Haiku)...", duration=1.5)

    canned = {
        "こんにちは": "こんにちは！何かお手伝いできることはありますか？",
        "AWS とは": "AWS は Amazon が提供するクラウドプラットフォームです。",
    }
    text = step1_out["original"]
    answer = canned.get(text, "ご質問ありがとうございます！一文で簡潔にお答えします。")

    result = {"bedrock_answer": answer, "answer_type": "short"}
    print(f"  {C.GRAY}ResultSelector 適用後:{C.RESET}")
    show_json(result)
    return result


def run_bedrock_detail(step1_out: dict) -> dict:
    """BedrockDetailAnswer (Step Functions SDK 統合)"""
    step_label("BedrockDetailAnswer", "Bedrock SDK Integration", C.BLUE)
    print(f"  {C.GRAY}Resource : arn:aws:states:::bedrock:invokeModel{C.RESET}")
    print(f"  {C.GRAY}Model    : Claude 3.5 Haiku  |  max_tokens: 500{C.RESET}")
    spinner("Bedrock 呼び出し中 (Claude 3.5 Haiku)...", duration=2.0)

    answer = (
        "クラウドコンピューティングは以下の方向に進化すると考えられます:\n"
        "  1. エッジコンピューティングとの統合が加速する\n"
        "  2. AI/ML ワークロードの最適化が進む\n"
        "  3. サーバーレスアーキテクチャがさらに普及する\n"
        "  4. マルチクラウド戦略が標準となる"
    )

    result = {"bedrock_answer": answer, "answer_type": "detail"}
    print(f"  {C.GRAY}ResultSelector 適用後:{C.RESET}")
    show_json(result)
    return result


def run_step2(bedrock_out: dict) -> dict:
    """Step2Format Lambda"""
    step_label("Step2Format", "Lambda", C.CYAN)
    answer_type = bedrock_out["answer_type"]
    label = "簡潔回答" if answer_type == "short" else "詳細回答"
    print(f"  {C.GRAY}Bedrock 回答を [{label}] フォーマットで整形中...{C.RESET}")
    spinner("最終整形", duration=0.9)

    return {
        "result": f"[{label}] {bedrock_out['bedrock_answer']}",
        "answer_type": answer_type,
        "status": "success",
    }


# ── デモ本体 ──────────────────────────────────────────────


def run_demo(message: str, demo_num: int) -> None:
    print()
    hr("=", C.CYAN)
    print(
        f"  {C.BOLD}{C.CYAN}DEMO {demo_num}  |  "
        f"aws-step-functions-bedrock  Workflow Execution{C.RESET}"
    )
    hr("=", C.CYAN)

    section("INPUT", ">>", C.WHITE)
    show_json({"message": message})
    pause(0.5)

    step1_out = run_step1(message)
    pause(0.3)

    route = run_choice(step1_out)
    pause(0.3)

    if route == "BedrockShortAnswer":
        bedrock_out = run_bedrock_short(step1_out)
    else:
        bedrock_out = run_bedrock_detail(step1_out)
    pause(0.3)

    final = run_step2(bedrock_out)
    pause(0.3)

    section("OUTPUT", "OK", C.GREEN)
    show_json(final, color=C.GREEN)

    print()
    hr("=", C.GREEN)
    print(
        f"  {C.GREEN}{C.BOLD}EXECUTION SUCCEEDED{C.RESET}  "
        f"{C.GRAY}route={route}{C.RESET}"
    )
    hr("=", C.GREEN)
    pause(1.0)


def main() -> None:
    print("\n")
    hr("=", C.MAGENTA)
    print(f"  {C.BOLD}{C.MAGENTA}aws-step-functions-bedrock  |  Local Pipeline Demo{C.RESET}")
    print(f"  {C.GRAY}AWS Step Functions + Amazon Bedrock  AI Workflow{C.RESET}")
    hr("=", C.MAGENTA)
    pause(1.0)

    # DEMO 1: 短いメッセージ -> BedrockShortAnswer ルート
    run_demo("こんにちは", demo_num=1)
    pause(1.2)

    # DEMO 2: 長いメッセージ -> BedrockDetailAnswer ルート
    run_demo("クラウドコンピューティングの将来について教えてください", demo_num=2)

    print()
    hr("-", C.GRAY)
    print(f"  {C.DIM}実際の実行は AWS コンソール -> Step Functions から行えます{C.RESET}")
    hr("-", C.GRAY)
    print()


if __name__ == "__main__":
    main()
