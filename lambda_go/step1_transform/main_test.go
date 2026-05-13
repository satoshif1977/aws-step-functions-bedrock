package main

import (
	"testing"
)

// ── transform テスト ──────────────────────────────────────────

func TestTransformUpperCase(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		wantUpper   string
		wantLength  int
	}{
		{"英小文字", "hello", "HELLO", 5},
		{"英大文字（変化なし）", "WORLD", "WORLD", 5},
		{"混合", "Hello World", "HELLO WORLD", 11},
		{"空文字", "", "", 0},
		{"数字・記号", "abc123!", "ABC123!", 7},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotUpper, gotLen := transform(tt.input)
			if gotUpper != tt.wantUpper {
				t.Errorf("大文字変換: 期待 %q, 実際 %q", tt.wantUpper, gotUpper)
			}
			if gotLen != tt.wantLength {
				t.Errorf("文字数: 期待 %d, 実際 %d", tt.wantLength, gotLen)
			}
		})
	}
}

// ── 日本語（マルチバイト）テスト ──────────────────────────────
// Go の len() はバイト数を返す（日本語1文字 = 3バイト）。
// utf8.RuneCountInString を使うことで Python の len() と同じ文字数が得られることを確認する。

func TestTransformJapanese(t *testing.T) {
	got, length := transform("こんにちは")
	if got != "こんにちは" {
		t.Errorf("日本語は大文字変換されない: %q", got)
	}
	if length != 5 {
		t.Errorf("日本語5文字の文字数: 期待 5, 実際 %d（バイト数でなく文字数であること）", length)
	}
}

// ── ハンドラー デフォルト値テスト ────────────────────────────

func TestHandlerDefaultMessage(t *testing.T) {
	resp, err := handler(nil, Event{Message: ""})
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if resp.Original != "Hello" {
		t.Errorf("デフォルトメッセージ: 期待 Hello, 実際 %q", resp.Original)
	}
	if resp.Transformed != "HELLO" {
		t.Errorf("デフォルト変換後: 期待 HELLO, 実際 %q", resp.Transformed)
	}
	if resp.Length != 5 {
		t.Errorf("デフォルト文字数: 期待 5, 実際 %d", resp.Length)
	}
}

// ── Response 構造体テスト ─────────────────────────────────────

func TestResponseFields(t *testing.T) {
	resp, err := handler(nil, Event{Message: "test"})
	if err != nil {
		t.Fatalf("エラーが発生: %v", err)
	}
	if resp.Original != "test" {
		t.Errorf("Original: 期待 test, 実際 %q", resp.Original)
	}
	if resp.Transformed != "TEST" {
		t.Errorf("Transformed: 期待 TEST, 実際 %q", resp.Transformed)
	}
	if resp.Length != 4 {
		t.Errorf("Length: 期待 4, 実際 %d", resp.Length)
	}
}
