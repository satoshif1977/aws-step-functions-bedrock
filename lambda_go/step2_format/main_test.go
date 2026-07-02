package main

import (
	"strings"
	"testing"
)

// ── formatResult テスト ───────────────────────────────────────

func TestFormatResultShort(t *testing.T) {
	got := formatResult("short", "これは短い回答です。")
	if !strings.HasPrefix(got, "[簡潔回答]") {
		t.Errorf("short のラベルが [簡潔回答] でない: %q", got)
	}
	if !strings.Contains(got, "これは短い回答です。") {
		t.Errorf("回答本文が含まれていない: %q", got)
	}
}

func TestFormatResultDetail(t *testing.T) {
	got := formatResult("detail", "これは詳細な回答です。")
	if !strings.HasPrefix(got, "[詳細回答]") {
		t.Errorf("detail のラベルが [詳細回答] でない: %q", got)
	}
}

func TestFormatResultUnknownType(t *testing.T) {
	// 未知の answer_type は詳細回答としてフォールバックする
	got := formatResult("unknown", "回答")
	if !strings.HasPrefix(got, "[詳細回答]") {
		t.Errorf("未知の type は [詳細回答] にフォールバックすること: %q", got)
	}
}

func TestFormatResultEmpty(t *testing.T) {
	got := formatResult("short", "")
	expected := "[簡潔回答] "
	if got != expected {
		t.Errorf("空の回答: 期待 %q, 実際 %q", expected, got)
	}
}

func TestFormatResultLabelFormat(t *testing.T) {
	// フォーマットが "[ラベル] 回答" 形式であることを確認
	got := formatResult("short", "テスト回答")
	expected := "[簡潔回答] テスト回答"
	if got != expected {
		t.Errorf("フォーマット: 期待 %q, 実際 %q", expected, got)
	}
}

func TestFormatResultDetailLabelFormat(t *testing.T) {
	got := formatResult("detail", "詳細テスト")
	expected := "[詳細回答] 詳細テスト"
	if got != expected {
		t.Errorf("詳細フォーマット: 期待 %q, 実際 %q", expected, got)
	}
}

func TestFormatResultEmptyTypeFallsToDetail(t *testing.T) {
	// answer_type が空文字の場合も詳細回答にフォールバックする
	got := formatResult("", "回答テキスト")
	if !strings.HasPrefix(got, "[詳細回答]") {
		t.Errorf("空の type は [詳細回答] にフォールバックすること: %q", got)
	}
}

func TestFormatResultLongAnswer(t *testing.T) {
	long := strings.Repeat("あ", 1000)
	got := formatResult("short", long)
	if !strings.Contains(got, long) {
		t.Error("長い回答文字列が結果に含まれていること")
	}
}

// ── ハンドラーテスト ──────────────────────────────────────────

func TestHandlerShortAnswer(t *testing.T) {
	event := Event{
		BedrockAnswer: "AIとは人工知能のことです。",
		AnswerType:    "short",
	}
	resp, err := handler(nil, event)
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if resp.Status != "success" {
		t.Errorf("Status: 期待 success, 実際 %q", resp.Status)
	}
	if resp.AnswerType != "short" {
		t.Errorf("AnswerType: 期待 short, 実際 %q", resp.AnswerType)
	}
	if !strings.HasPrefix(resp.Result, "[簡潔回答]") {
		t.Errorf("Result が [簡潔回答] で始まっていない: %q", resp.Result)
	}
}

func TestHandlerDetailAnswer(t *testing.T) {
	event := Event{
		BedrockAnswer: "詳細な解説...",
		AnswerType:    "detail",
	}
	resp, err := handler(nil, event)
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if !strings.HasPrefix(resp.Result, "[詳細回答]") {
		t.Errorf("Result が [詳細回答] で始まっていない: %q", resp.Result)
	}
}

func TestHandlerStatusAlwaysSuccess(t *testing.T) {
	// エラーがない限り status は常に success
	resp, err := handler(nil, Event{BedrockAnswer: "test", AnswerType: "short"})
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if resp.Status != "success" {
		t.Errorf("Status は常に success であること: %q", resp.Status)
	}
}

func TestHandlerAnswerTypePreserved(t *testing.T) {
	// レスポンスの AnswerType にイベントの値がそのまま保持されること
	resp, err := handler(nil, Event{BedrockAnswer: "回答", AnswerType: "detail"})
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if resp.AnswerType != "detail" {
		t.Errorf("AnswerType は入力値を保持すること: 期待 detail, 実際 %q", resp.AnswerType)
	}
}

func TestHandlerEmptyFields(t *testing.T) {
	// 両フィールドが空でも panic せず success を返すこと
	resp, err := handler(nil, Event{})
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if resp.Status != "success" {
		t.Errorf("空フィールドでも Status は success であること: %q", resp.Status)
	}
}
