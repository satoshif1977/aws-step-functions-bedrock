package main

import (
	"strings"
	"testing"
	"unicode/utf8"
)

// FuzzFormatResultContainsAnswer は formatResult が任意の入力で
// 必ず回答テキストを出力に含むことを検証する。
// 不変条件: 出力は必ず "[ラベル] {answer}" の形式になる。
func FuzzFormatResultContainsAnswer(f *testing.F) {
	// シードコーパス: answer_type × answer の組み合わせ
	f.Add("short", "AWSはクラウドサービスです")
	f.Add("detail", "Amazon Web Services は...")
	f.Add("unknown", "不明な回答種別の場合")
	f.Add("short", "")
	f.Add("", "空の answer_type")
	f.Add("detail", "Hello🎉World")

	f.Fuzz(func(t *testing.T, answerType, answer string) {
		if !utf8.ValidString(answerType) || !utf8.ValidString(answer) {
			t.Skip()
		}
		result := formatResult(answerType, answer)

		// 不変条件1: 出力は必ず "[" で始まる
		if !strings.HasPrefix(result, "[") {
			t.Errorf("formatResult(%q, %q)=%q: '[' で始まらない", answerType, answer, result)
		}

		// 不変条件2: 出力は必ず answer を含む
		if !strings.Contains(result, answer) {
			t.Errorf("formatResult(%q, %q)=%q: answer が含まれていない", answerType, answer, result)
		}
	})
}

// FuzzFormatResultLabelBracket は formatResult の出力が必ず "[label] answer" 形式になることを検証する。
// 不変条件: ラベルブラケット "]" が answer の前に存在する。
func FuzzFormatResultLabelBracket(f *testing.F) {
	f.Add("short", "回答テキスト")
	f.Add("detail", "詳細な回答")
	f.Add("other", "その他")

	f.Fuzz(func(t *testing.T, answerType, answer string) {
		if !utf8.ValidString(answerType) || !utf8.ValidString(answer) {
			t.Skip()
		}
		result := formatResult(answerType, answer)

		// 不変条件: "] " が含まれる（ラベル閉じ括弧 + スペース）
		if !strings.Contains(result, "] ") {
			t.Errorf("formatResult(%q, %q)=%q: '] ' が見つからない", answerType, answer, result)
		}
	})
}
