// Step1Transform（Go版）: テキスト加工 Lambda
// Step Functions の最初のステートとして起動する。
// 入力テキストを大文字変換し、文字数をカウントして返す。
//
// Python版との比較:
//   - コールドスタート: Go ~100ms vs Python ~300ms
//   - len() の扱い: Go は rune 単位（Unicode対応） vs Python は文字単位
package main

import (
	"context"
	"strings"
	"unicode/utf8"

	"github.com/aws/aws-lambda-go/lambda"
)

// ── 入出力構造体 ──────────────────────────────────────────────

// Event は Step Functions から受け取る入力
type Event struct {
	Message string `json:"message"`
}

// Response は次のステートへ渡す出力
type Response struct {
	Original    string `json:"original"`
	Transformed string `json:"transformed"`
	Length      int    `json:"length"`
}

// ── ヘルパー関数 ──────────────────────────────────────────────

// transform は入力テキストを大文字変換し、文字数を返す。
// Go の len() はバイト数を返すため、Unicode 文字数には utf8.RuneCountInString を使う。
// （Python の len() は文字数を返す挙動に合わせる）
func transform(text string) (string, int) {
	return strings.ToUpper(text), utf8.RuneCountInString(text)
}

// ── ハンドラー ────────────────────────────────────────────────

func handler(_ context.Context, event Event) (Response, error) {
	text := event.Message
	if text == "" {
		text = "Hello"
	}

	transformed, length := transform(text)

	return Response{
		Original:    text,
		Transformed: transformed,
		Length:      length,
	}, nil
}

func main() {
	lambda.Start(handler)
}
