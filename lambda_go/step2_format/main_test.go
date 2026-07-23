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

// ── テーブル駆動テスト ────────────────────────────────────────

func TestFormatResultTableDriven(t *testing.T) {
	tests := []struct {
		name       string
		answerType string
		answer     string
		wantFull   string
	}{
		{"short型", "short", "簡潔な回答", "[簡潔回答] 簡潔な回答"},
		{"detail型", "detail", "詳細な回答", "[詳細回答] 詳細な回答"},
		{"unknown型フォールバック", "unknown", "回答", "[詳細回答] 回答"},
		{"空型フォールバック", "", "回答", "[詳細回答] 回答"},
		{"空回答", "short", "", "[簡潔回答] "},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := formatResult(tt.answerType, tt.answer)
			if got != tt.wantFull {
				t.Errorf("期待 %q, 実際 %q", tt.wantFull, got)
			}
		})
	}
}

func TestFormatResultContainsAnswer(t *testing.T) {
	// 回答テキストが結果に必ず含まれること
	answers := []string{"テスト回答", "AWS Step Functions", "こんにちは世界"}
	for _, a := range answers {
		got := formatResult("short", a)
		if !strings.Contains(got, a) {
			t.Errorf("回答 %q が結果に含まれていない: %q", a, got)
		}
	}
}

func TestHandlerTableDriven(t *testing.T) {
	tests := []struct {
		name       string
		answerType string
		wantPrefix string
	}{
		{"short", "short", "[簡潔回答]"},
		{"detail", "detail", "[詳細回答]"},
		{"unknown", "unknown", "[詳細回答]"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := handler(nil, Event{BedrockAnswer: "テスト", AnswerType: tt.answerType})
			if err != nil {
				t.Fatalf("エラーが発生: %v", err)
			}
			if !strings.HasPrefix(resp.Result, tt.wantPrefix) {
				t.Errorf("Result prefix: 期待 %q, 実際 %q", tt.wantPrefix, resp.Result)
			}
			if resp.Status != "success" {
				t.Errorf("Status: 期待 success, 実際 %q", resp.Status)
			}
		})
	}
}

func TestHandlerResultContainsInput(t *testing.T) {
	// Result フィールドに入力した BedrockAnswer が含まれること
	input := "AWS Bedrock の機能説明テキスト"
	resp, err := handler(nil, Event{BedrockAnswer: input, AnswerType: "short"})
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if !strings.Contains(resp.Result, input) {
		t.Errorf("Result に入力回答が含まれていない: %q", resp.Result)
	}
}

// ── 追加テスト: エッジケース ──────────────────────────────────

func TestFormatResultUpperCaseTypeFallsToDetail(t *testing.T) {
	// "SHORT"（大文字）は "short" に一致しないため詳細回答にフォールバックすること
	got := formatResult("SHORT", "回答テキスト")
	if !strings.HasPrefix(got, "[詳細回答]") {
		t.Errorf("大文字 SHORT は [詳細回答] にフォールバックすること: %q", got)
	}
}

func TestFormatResultSpecialCharsPreserved(t *testing.T) {
	// 回答に特殊文字（引用符・パイプ・バックスラッシュ）が含まれても保持されること
	special := `"quoted" | back\slash`
	got := formatResult("short", special)
	if !strings.Contains(got, special) {
		t.Errorf("特殊文字が保持されていない: %q", got)
	}
}

func TestFormatResultNewlineInAnswer(t *testing.T) {
	// 回答に改行が含まれても結果に保持されること
	answer := "1行目\n2行目"
	got := formatResult("detail", answer)
	if !strings.Contains(got, answer) {
		t.Errorf("改行を含む回答が保持されていない: %q", got)
	}
}

func TestHandlerErrorAlwaysNil(t *testing.T) {
	// handler は常に nil エラーを返すこと
	cases := []Event{
		{BedrockAnswer: "回答", AnswerType: "short"},
		{BedrockAnswer: "", AnswerType: ""},
		{BedrockAnswer: strings.Repeat("x", 500), AnswerType: "detail"},
		{BedrockAnswer: "テスト", AnswerType: "unknown"},
	}
	for _, e := range cases {
		_, err := handler(nil, e)
		if err != nil {
			t.Errorf("handler はエラーを返さないこと（AnswerType=%q）: %v", e.AnswerType, err)
		}
	}
}

func TestHandlerLongBedrockAnswer(t *testing.T) {
	// 長い BedrockAnswer でも Result に全文が含まれること
	long := strings.Repeat("あ", 500)
	resp, err := handler(nil, Event{BedrockAnswer: long, AnswerType: "detail"})
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if !strings.Contains(resp.Result, long) {
		t.Error("長い BedrockAnswer が Result に含まれていない")
	}
}

func TestFormatResultAnswerWithBrackets(t *testing.T) {
	// 回答にブラケットが含まれても先頭ラベルが正しいこと
	answer := "[INFO] 詳細説明"
	got := formatResult("short", answer)
	if !strings.HasPrefix(got, "[簡潔回答]") {
		t.Errorf("回答にブラケットを含む場合のラベル: 期待 [簡潔回答], 実際 %q", got)
	}
	if !strings.Contains(got, answer) {
		t.Errorf("回答本文が保持されていない: %q", got)
	}
}

func TestHandlerAllFieldsPopulated(t *testing.T) {
	// レスポンスの全フィールド（Result / AnswerType / Status）が空でないこと
	resp, err := handler(nil, Event{BedrockAnswer: "テスト回答", AnswerType: "short"})
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if resp.Result == "" {
		t.Error("Result が空")
	}
	if resp.AnswerType == "" {
		t.Error("AnswerType が空")
	}
	if resp.Status == "" {
		t.Error("Status が空")
	}
}
