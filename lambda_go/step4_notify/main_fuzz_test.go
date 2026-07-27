package main

import (
	"strings"
	"testing"
	"unicode/utf8"
)

// FuzzBuildSubjectNoPanic は buildSubject が任意の status 文字列でパニックしないことを検証する。
// 不変条件: 返値は3種類の定数のいずれかでなければならない。
func FuzzBuildSubjectNoPanic(f *testing.F) {
	// シードコーパス: 正常・エラー・想定外の値
	f.Add("success", false)
	f.Add("success", true)
	f.Add("error", false)
	f.Add("error", true)
	f.Add("empty", false)
	f.Add("", false)
	f.Add("UNKNOWN_STATUS_XYZ", true)

	f.Fuzz(func(t *testing.T, status string, isTruncated bool) {
		if !utf8.ValidString(status) {
			t.Skip()
		}
		result := buildSubject(status, isTruncated)

		// 不変条件: 返値は定義済みの3定数のいずれか
		valid := []string{subjectSuccess, subjectTruncated, subjectError}
		for _, v := range valid {
			if result == v {
				return
			}
		}
		t.Errorf("buildSubject(%q, %v)=%q: 未定義の Subject が返却された", status, isTruncated, result)
	})
}

// FuzzBuildSubjectErrorPriority は status != "success" のとき常に subjectError が返ることを検証する。
// 不変条件: エラーは切り捨てより優先される（どんな status でも success 以外はエラー扱い）。
func FuzzBuildSubjectErrorPriority(f *testing.F) {
	f.Add("error", false)
	f.Add("error", true)
	f.Add("empty", true)
	f.Add("timeout", false)
	f.Add("", true)

	f.Fuzz(func(t *testing.T, status string, isTruncated bool) {
		if !utf8.ValidString(status) || status == "success" {
			t.Skip()
		}
		result := buildSubject(status, isTruncated)
		if result != subjectError {
			t.Errorf("buildSubject(%q, %v)=%q: success 以外は必ず %q でなければならない", status, isTruncated, result, subjectError)
		}
	})
}

// FuzzBuildMessageNoPanic は buildMessage が任意の入力でパニックしないことを検証する。
// 不変条件: 出力は空でない文字列（エラー時もエラーメッセージを返す）。
func FuzzBuildMessageNoPanic(f *testing.F) {
	f.Add("success", "short", "Bedrock summary", 100, 20, "2026-07-27T10:00:00Z", false)
	f.Add("error", "unknown", "", 0, 0, "", false)
	f.Add("empty", "detail", "", 0, 0, "2026-07-27T10:00:00Z", true)

	f.Fuzz(func(t *testing.T, status, answerType, summary string, charCount, wordCount int, processedAt string, isTruncated bool) {
		if !utf8.ValidString(status) || !utf8.ValidString(answerType) ||
			!utf8.ValidString(summary) || !utf8.ValidString(processedAt) {
			t.Skip()
		}
		if charCount < 0 {
			charCount = -charCount // 負数を正数に正規化
		}
		if wordCount < 0 {
			wordCount = -wordCount
		}

		event := Event{
			Summary:    summary,
			AnswerType: answerType,
			Status:     status,
			Metadata: Metadata{
				CharCount:   charCount,
				WordCount:   wordCount,
				ProcessedAt: processedAt,
				IsTruncated: isTruncated,
			},
		}

		msg := buildMessage(event)

		// 不変条件: 出力は必ず空でない
		if msg == "" {
			t.Errorf("buildMessage: 空のメッセージが返却された（status=%q）", status)
		}

		// 不変条件: success 時は summary を含む
		if status == "success" && !strings.Contains(msg, summary) {
			t.Errorf("buildMessage(status=success): summary %q が出力に含まれていない", summary)
		}
	})
}
