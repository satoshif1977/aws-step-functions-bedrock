package main

import (
	"strings"
	"testing"
	"unicode/utf8"
)

// FuzzTransformRuneCount は transform が任意の文字列で
// 「返却される length == utf8.RuneCountInString(input)」を常に満たすことを検証する。
// 不変条件: length は bytes 数ではなくルーン数（Python の len() / JS の [...s].length に相当）。
func FuzzTransformRuneCount(f *testing.F) {
	// シードコーパス: ASCII / 日本語 / 絵文字 / 空文字 / 混合
	f.Add("hello world")
	f.Add("こんにちは")
	f.Add("Hello🎉World")
	f.Add("")
	f.Add("   ")
	f.Add("AWS Step Functions Bedrock")
	f.Add("abc123!@#")

	f.Fuzz(func(t *testing.T, input string) {
		// 不正な UTF-8 は Go の strings.ToUpper が未定義動作を起こす可能性があるためスキップ
		if !utf8.ValidString(input) {
			t.Skip()
		}
		_, length := transform(input)
		want := utf8.RuneCountInString(input)
		if length != want {
			t.Errorf("transform(%q): length=%d, want %d（ルーン数）", input, length, want)
		}
	})
}

// FuzzTransformIdempotent は transform を2回適用しても結果が変わらないことを検証する。
// 不変条件: strings.ToUpper は冪等（すでに大文字の文字列をもう一度大文字変換しても同じ）。
func FuzzTransformIdempotent(f *testing.F) {
	f.Add("hello")
	f.Add("WORLD")
	f.Add("Hello World")
	f.Add("こんにちは")
	f.Add("")

	f.Fuzz(func(t *testing.T, input string) {
		if !utf8.ValidString(input) {
			t.Skip()
		}
		upper1, _ := transform(input)
		upper2, _ := transform(upper1)
		if upper1 != upper2 {
			t.Errorf("冪等性違反: transform(%q)=%q, transform(transform)=%q", input, upper1, upper2)
		}
	})
}

// FuzzTransformUpperMatchesStdlib は transform の大文字変換が strings.ToUpper と一致することを検証する。
func FuzzTransformUpperMatchesStdlib(f *testing.F) {
	f.Add("aws bedrock lambda")
	f.Add("Step Functions")
	f.Add("gopher")

	f.Fuzz(func(t *testing.T, input string) {
		if !utf8.ValidString(input) {
			t.Skip()
		}
		got, _ := transform(input)
		want := strings.ToUpper(input)
		if got != want {
			t.Errorf("transform(%q)=%q, strings.ToUpper=%q", input, got, want)
		}
	})
}
