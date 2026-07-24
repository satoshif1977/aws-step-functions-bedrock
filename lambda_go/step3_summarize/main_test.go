package main

import (
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

// ── countChars テスト ─────────────────────────────────────────

func TestCountCharsASCII(t *testing.T) {
	if got := countChars("hello"); got != 5 {
		t.Errorf("ASCII 5文字: 期待 5, 実際 %d", got)
	}
}

func TestCountCharsJapanese(t *testing.T) {
	// 日本語1文字 = 3バイトだが countChars はルーン数を返す
	if got := countChars("こんにちは"); got != 5 {
		t.Errorf("日本語5文字: 期待 5, 実際 %d", got)
	}
}

func TestCountCharsEmpty(t *testing.T) {
	if got := countChars(""); got != 0 {
		t.Errorf("空文字: 期待 0, 実際 %d", got)
	}
}

func TestCountCharsEmoji(t *testing.T) {
	// 絵文字（4バイト）でも文字数 1 になること
	if got := countChars("A🎉B"); got != 3 {
		t.Errorf("絵文字含む文字数: 期待 3, 実際 %d", got)
	}
}

func TestCountCharsMatchesRuneCount(t *testing.T) {
	inputs := []string{"hello", "こんにちは", "[簡潔回答] AIとは", "A🎉B", ""}
	for _, s := range inputs {
		want := utf8.RuneCountInString(s)
		if got := countChars(s); got != want {
			t.Errorf("入力 %q: 期待 %d, 実際 %d", s, want, got)
		}
	}
}

// ── countWords テスト ─────────────────────────────────────────

func TestCountWordsNormal(t *testing.T) {
	if got := countWords("hello world foo"); got != 3 {
		t.Errorf("3単語: 期待 3, 実際 %d", got)
	}
}

func TestCountWordsEmpty(t *testing.T) {
	if got := countWords(""); got != 0 {
		t.Errorf("空文字: 期待 0, 実際 %d", got)
	}
}

func TestCountWordsSingleWord(t *testing.T) {
	if got := countWords("hello"); got != 1 {
		t.Errorf("1単語: 期待 1, 実際 %d", got)
	}
}

func TestCountWordsMultipleSpaces(t *testing.T) {
	// strings.Fields は連続スペースをまとめて処理する
	if got := countWords("hello   world"); got != 2 {
		t.Errorf("連続スペース: 期待 2, 実際 %d", got)
	}
}

func TestCountWordsTableDriven(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  int
	}{
		{"空文字", "", 0},
		{"1単語", "hello", 1},
		{"2単語", "hello world", 2},
		{"タブ区切り", "a\tb", 2},
		{"改行区切り", "a\nb\nc", 3},
		{"先頭末尾空白", "  hello  ", 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := countWords(tt.input); got != tt.want {
				t.Errorf("期待 %d, 実際 %d", tt.want, got)
			}
		})
	}
}

// ── isTruncated テスト ────────────────────────────────────────

func TestIsTruncatedBelowLimit(t *testing.T) {
	text := strings.Repeat("a", 499)
	if isTruncated(text, 500) {
		t.Error("499文字は500文字制限を超えないこと")
	}
}

func TestIsTruncatedAtLimit(t *testing.T) {
	text := strings.Repeat("a", 500)
	if isTruncated(text, 500) {
		t.Error("500文字はちょうど制限値のため超えていないこと")
	}
}

func TestIsTruncatedAboveLimit(t *testing.T) {
	text := strings.Repeat("a", 501)
	if !isTruncated(text, 500) {
		t.Error("501文字は500文字制限を超えること")
	}
}

func TestIsTruncatedEmptyString(t *testing.T) {
	if isTruncated("", 500) {
		t.Error("空文字は制限を超えないこと")
	}
}

// ── buildMetadata テスト ──────────────────────────────────────

func TestBuildMetadataCharCount(t *testing.T) {
	m := buildMetadata("こんにちは")
	if m.CharCount != 5 {
		t.Errorf("日本語5文字の CharCount: 期待 5, 実際 %d", m.CharCount)
	}
}

func TestBuildMetadataWordCount(t *testing.T) {
	m := buildMetadata("hello world")
	if m.WordCount != 2 {
		t.Errorf("2単語の WordCount: 期待 2, 実際 %d", m.WordCount)
	}
}

func TestBuildMetadataNotTruncated(t *testing.T) {
	m := buildMetadata("short text")
	if m.IsTruncated {
		t.Error("短いテキストは IsTruncated=false であること")
	}
}

func TestBuildMetadataTruncated(t *testing.T) {
	long := strings.Repeat("あ", 501)
	m := buildMetadata(long)
	if !m.IsTruncated {
		t.Error("501文字のテキストは IsTruncated=true であること")
	}
}

func TestBuildMetadataProcessedAtRFC3339(t *testing.T) {
	m := buildMetadata("test")
	if _, err := time.Parse(time.RFC3339, m.ProcessedAt); err != nil {
		t.Errorf("ProcessedAt が RFC3339 形式でない: %q, err: %v", m.ProcessedAt, err)
	}
}

func TestBuildMetadataProcessedAtIsUTC(t *testing.T) {
	before := time.Now().UTC().Truncate(time.Second)
	m := buildMetadata("test")
	after := time.Now().UTC().Add(time.Second)
	parsed, _ := time.Parse(time.RFC3339, m.ProcessedAt)
	if parsed.Before(before) || parsed.After(after) {
		t.Errorf("ProcessedAt が現在時刻の範囲外: %s", m.ProcessedAt)
	}
}

// ── ハンドラーテスト ──────────────────────────────────────────

func TestHandlerShortAnswer(t *testing.T) {
	event := Event{Result: "[簡潔回答] AIとは", AnswerType: "short", Status: "success"}
	resp, err := handler(nil, event)
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if resp.Summary != event.Result {
		t.Errorf("Summary: 期待 %q, 実際 %q", event.Result, resp.Summary)
	}
	if resp.AnswerType != "short" {
		t.Errorf("AnswerType: 期待 short, 実際 %q", resp.AnswerType)
	}
}

func TestHandlerDetailAnswer(t *testing.T) {
	event := Event{Result: "[詳細回答] 詳細説明...", AnswerType: "detail", Status: "success"}
	resp, err := handler(nil, event)
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if resp.AnswerType != "detail" {
		t.Errorf("AnswerType: 期待 detail, 実際 %q", resp.AnswerType)
	}
}

func TestHandlerStatusPreserved(t *testing.T) {
	resp, err := handler(nil, Event{Result: "test", AnswerType: "short", Status: "success"})
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if resp.Status != "success" {
		t.Errorf("Status: 期待 success, 実際 %q", resp.Status)
	}
}

func TestHandlerMetadataPopulated(t *testing.T) {
	resp, err := handler(nil, Event{Result: "hello world", AnswerType: "short", Status: "success"})
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if resp.Metadata.CharCount == 0 {
		t.Error("Metadata.CharCount が 0 であってはならない")
	}
	if resp.Metadata.WordCount == 0 {
		t.Error("Metadata.WordCount が 0 であってはならない")
	}
	if resp.Metadata.ProcessedAt == "" {
		t.Error("Metadata.ProcessedAt が空であってはならない")
	}
}

func TestHandlerEmptyFields(t *testing.T) {
	resp, err := handler(nil, Event{})
	if err != nil {
		t.Fatalf("空フィールドでもエラーが発生しないこと: %v", err)
	}
	if resp.Metadata.CharCount != 0 {
		t.Errorf("空 Result の CharCount: 期待 0, 実際 %d", resp.Metadata.CharCount)
	}
}

func TestHandlerErrorAlwaysNil(t *testing.T) {
	cases := []Event{
		{Result: "[簡潔回答] test", AnswerType: "short", Status: "success"},
		{Result: "", AnswerType: "", Status: ""},
		{Result: strings.Repeat("あ", 1000), AnswerType: "detail", Status: "success"},
	}
	for _, e := range cases {
		if _, err := handler(nil, e); err != nil {
			t.Errorf("handler はエラーを返さないこと（AnswerType=%q）: %v", e.AnswerType, err)
		}
	}
}

func TestHandlerLongResultIsTruncated(t *testing.T) {
	long := strings.Repeat("あ", 501)
	resp, err := handler(nil, Event{Result: long, AnswerType: "detail", Status: "success"})
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if !resp.Metadata.IsTruncated {
		t.Error("501文字の Result は IsTruncated=true であること")
	}
}

func TestHandlerShortResultNotTruncated(t *testing.T) {
	resp, err := handler(nil, Event{Result: "short", AnswerType: "short", Status: "success"})
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if resp.Metadata.IsTruncated {
		t.Error("短い Result は IsTruncated=false であること")
	}
}

func TestHandlerSummaryMatchesResult(t *testing.T) {
	input := "[詳細回答] AWS Step Functions の詳細説明"
	resp, err := handler(nil, Event{Result: input, AnswerType: "detail", Status: "success"})
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if resp.Summary != input {
		t.Errorf("Summary は Result をそのまま返すこと: 期待 %q, 実際 %q", input, resp.Summary)
	}
}

func TestHandlerTableDriven(t *testing.T) {
	tests := []struct {
		name       string
		answerType string
		result     string
		wantWords  int
	}{
		{"簡潔短文", "short", "[簡潔回答] AIとは", 2},
		{"詳細長文", "detail", "[詳細回答] 詳細な説明文です", 2},
		{"空文字", "", "", 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := handler(nil, Event{Result: tt.result, AnswerType: tt.answerType, Status: "success"})
			if err != nil {
				t.Fatalf("エラーが発生: %v", err)
			}
			if resp.Metadata.WordCount != tt.wantWords {
				t.Errorf("WordCount: 期待 %d, 実際 %d", tt.wantWords, resp.Metadata.WordCount)
			}
		})
	}
}
