// Step3Summarize（Go版）: 最終サマリー生成 Lambda
// Step Functions の最終ステートとして起動する。
// step2_format の出力を受け取り、メタデータ（文字数・単語数・処理時刻・切り捨て判定）を付与して返す。
//
// Python版との比較:
//   - 時刻取得: Go は time.Now().UTC() vs Python は datetime.utcnow()
//   - 文字列分割: Go は strings.Fields vs Python は str.split()
//   - 文字数: Go は utf8.RuneCountInString（Unicode対応） vs Python は len()
package main

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/aws/aws-lambda-go/lambda"
)

// ── 定数 ──────────────────────────────────────────────────────

// truncateLimit は「長文」と判定する文字数の閾値
const truncateLimit = 500

// ── 入出力構造体 ──────────────────────────────────────────────

// Event は Step Functions から受け取る入力（step2_format の出力）
type Event struct {
	Result     string `json:"result"`
	AnswerType string `json:"answer_type"`
	Status     string `json:"status"`
}

// Metadata はレスポンスに付与する付加情報
type Metadata struct {
	CharCount   int    `json:"char_count"`
	WordCount   int    `json:"word_count"`
	ProcessedAt string `json:"processed_at"`
	IsTruncated bool   `json:"is_truncated"`
}

// Response は Step Functions ワークフローの最終出力
type Response struct {
	Summary    string   `json:"summary"`
	AnswerType string   `json:"answer_type"`
	Status     string   `json:"status"`
	Metadata   Metadata `json:"metadata"`
}

// ── ヘルパー関数 ──────────────────────────────────────────────

// countChars は Unicode 文字数（ルーン数）を返す。
// Go の len() はバイト数を返すため utf8.RuneCountInString を使う。
func countChars(text string) int {
	return utf8.RuneCountInString(text)
}

// countWords は空白区切りの単語数を返す。
// strings.Fields は連続する空白をまとめて分割するため、余分なスペースも安全に処理できる。
func countWords(text string) int {
	return len(strings.Fields(text))
}

// isTruncated は文字数が limit を超えているか判定する。
func isTruncated(text string, limit int) bool {
	return utf8.RuneCountInString(text) > limit
}

// buildMetadata はサマリーテキストからメタデータを生成する。
func buildMetadata(text string) Metadata {
	return Metadata{
		CharCount:   countChars(text),
		WordCount:   countWords(text),
		ProcessedAt: time.Now().UTC().Format(time.RFC3339),
		IsTruncated: isTruncated(text, truncateLimit),
	}
}

// ── ハンドラー ────────────────────────────────────────────────

func handler(_ context.Context, event Event) (Response, error) {
	return Response{
		Summary:    event.Result,
		AnswerType: event.AnswerType,
		Status:     event.Status,
		Metadata:   buildMetadata(event.Result),
	}, nil
}

func main() {
	lambda.Start(handler)
}
