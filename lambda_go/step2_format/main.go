// Step2Format（Go版）: 最終整形 Lambda
// Step Functions の最後のステートとして起動する。
// Bedrock の回答を受け取り、回答種別ラベルを付けて整形して返す。
//
// Python版との比較:
//   - 文字列フォーマット: Go は fmt.Sprintf vs Python は f-string
//   - 条件分岐: Go は if/else vs Python は 条件式（三項演算子なし）
package main

import (
	"context"
	"fmt"

	"github.com/aws/aws-lambda-go/lambda"
)

// ── 入出力構造体 ──────────────────────────────────────────────

// Event は Step Functions から受け取る入力（BedrockShortAnswer / BedrockDetailAnswer の出力）
type Event struct {
	BedrockAnswer string `json:"bedrock_answer"`
	AnswerType    string `json:"answer_type"`
}

// Response は Step Functions ワークフローの最終出力
type Response struct {
	Result     string `json:"result"`
	AnswerType string `json:"answer_type"`
	Status     string `json:"status"`
}

// ── ヘルパー関数 ──────────────────────────────────────────────

// formatResult は回答種別に応じたラベルを付けて最終結果文字列を生成する。
func formatResult(answerType, bedrockAnswer string) string {
	label := "詳細回答"
	if answerType == "short" {
		label = "簡潔回答"
	}
	return fmt.Sprintf("[%s] %s", label, bedrockAnswer)
}

// ── ハンドラー ────────────────────────────────────────────────

func handler(_ context.Context, event Event) (Response, error) {
	return Response{
		Result:     formatResult(event.AnswerType, event.BedrockAnswer),
		AnswerType: event.AnswerType,
		Status:     "success",
	}, nil
}

func main() {
	lambda.Start(handler)
}
