package main

import (
	"testing"
	"unicode/utf8"
)

// FuzzCountCharsMatchesRuneCount は countChars が任意の文字列で
// utf8.RuneCountInString と同じ値を返すことを検証する。
// 不変条件: TS 版 [...str].length / Python 版 len() との3言語一致を保証する。
func FuzzCountCharsMatchesRuneCount(f *testing.F) {
	f.Add("hello")
	f.Add("こんにちは")
	f.Add("Hello🎉")
	f.Add("")
	f.Add("   ")
	f.Add("AWS Lambda Step Functions Bedrock")

	f.Fuzz(func(t *testing.T, input string) {
		if !utf8.ValidString(input) {
			t.Skip()
		}
		got := countChars(input)
		want := utf8.RuneCountInString(input)
		if got != want {
			t.Errorf("countChars(%q)=%d, want %d", input, got, want)
		}
	})
}

// FuzzCountWordsNonNegative は countWords が任意の入力で必ず 0 以上を返すことを検証する。
// 不変条件: 単語数は負にならない。
func FuzzCountWordsNonNegative(f *testing.F) {
	f.Add("hello world")
	f.Add("")
	f.Add("   ")
	f.Add("single")
	f.Add("a b c d e")
	f.Add("日本語 テスト")

	f.Fuzz(func(t *testing.T, input string) {
		if !utf8.ValidString(input) {
			t.Skip()
		}
		count := countWords(input)
		if count < 0 {
			t.Errorf("countWords(%q)=%d: 負の値は不正", input, count)
		}
	})
}

// FuzzIsTruncatedConsistentWithCountChars は isTruncated が countChars と矛盾しないことを検証する。
// 不変条件: countChars(text) > truncateLimit ならば isTruncated(text, truncateLimit) == true。
func FuzzIsTruncatedConsistentWithCountChars(f *testing.F) {
	f.Add("short text")
	f.Add("")
	f.Add("a")

	f.Fuzz(func(t *testing.T, input string) {
		if !utf8.ValidString(input) {
			t.Skip()
		}
		chars := countChars(input)
		truncated := isTruncated(input, truncateLimit)

		if chars > truncateLimit && !truncated {
			t.Errorf("input length=%d > limit=%d なのに isTruncated=false", chars, truncateLimit)
		}
		if chars <= truncateLimit && truncated {
			t.Errorf("input length=%d <= limit=%d なのに isTruncated=true", chars, truncateLimit)
		}
	})
}

// FuzzBuildMetadataNoPanic は buildMetadata が任意の入力でパニックしないことを検証する。
// 不変条件: Lambda ハンドラーは任意の入力に対してクラッシュしない。
func FuzzBuildMetadataNoPanic(f *testing.F) {
	f.Add("")
	f.Add("Bedrock summary text")
	f.Add("日本語テキスト")
	f.Add("Hello🎉World")
	f.Add("   spaces   ")

	f.Fuzz(func(t *testing.T, input string) {
		if !utf8.ValidString(input) {
			t.Skip()
		}
		meta := buildMetadata(input)

		// 不変条件: 返却されたメタデータは countChars と一致する
		if meta.CharCount != countChars(input) {
			t.Errorf("buildMetadata(%q).CharCount=%d, countChars=%d", input, meta.CharCount, countChars(input))
		}
		if meta.CharCount < 0 {
			t.Errorf("buildMetadata(%q).CharCount=%d: 負の値は不正", input, meta.CharCount)
		}
	})
}
