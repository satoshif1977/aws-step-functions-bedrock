// Step4Notify（Go版）: SNS 通知ペイロード生成 Lambda
// Step Functions の最終ステートとして起動する。
// step3_summarize の出力を受け取り、SNS に渡す通知ペイロードを生成して返す。
// 実際の SNS Publish は Step Functions の SDK Integration（Task State）で行うため、
// この Lambda はペイロード構築のみを担当する（外部 API 呼び出しなし・完全テスト可能）。
//
// ルーティングロジック:
//   - status != "success"  → Subject: エラー通知
//   - is_truncated == true → Subject: 切り捨て警告付き
//   - それ以外              → Subject: 正常完了
package main

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
)

// ── 定数 ──────────────────────────────────────────────────────

const (
	subjectSuccess   = "Bedrock Summary Ready"
	subjectTruncated = "Bedrock Summary Ready (Truncated)"
	subjectError     = "Bedrock Pipeline Error"
)

// ── 入出力構造体 ──────────────────────────────────────────────

// Metadata は step3_summarize から受け取るメタデータ
type Metadata struct {
	CharCount   int    `json:"char_count"`
	WordCount   int    `json:"word_count"`
	ProcessedAt string `json:"processed_at"`
	IsTruncated bool   `json:"is_truncated"`
}

// Event は Step Functions から受け取る入力（step3_summarize の出力）
type Event struct {
	Summary    string   `json:"summary"`
	AnswerType string   `json:"answer_type"`
	Status     string   `json:"status"`
	Metadata   Metadata `json:"metadata"`
}

// SNSAttributes は SNS MessageAttributes に相当するフラット構造体
// SNS の文字列型属性として渡せるよう、数値・bool もすべて string で保持する。
type SNSAttributes struct {
	AnswerType  string `json:"answer_type"`
	Status      string `json:"status"`
	CharCount   string `json:"char_count"`
	IsTruncated string `json:"is_truncated"`
}

// Notification は SNS Publish に渡す通知ペイロード
type Notification struct {
	Subject    string        `json:"subject"`
	Message    string        `json:"message"`
	Attributes SNSAttributes `json:"attributes"`
}

// Response は Step Functions ワークフローの最終出力
type Response struct {
	Notification        Notification `json:"notification"`
	Summary             string       `json:"summary"`
	AnswerType          string       `json:"answer_type"`
	Status              string       `json:"status"`
	Metadata            Metadata     `json:"metadata"`
	PipelineCompletedAt string       `json:"pipeline_completed_at"`
}

// ── ヘルパー関数 ──────────────────────────────────────────────

// buildSubject はステータスと切り捨て状態から SNS Subject を決定する。
// 優先度: エラー > 切り捨て > 正常
func buildSubject(status string, isTruncated bool) string {
	if status != "success" {
		return subjectError
	}
	if isTruncated {
		return subjectTruncated
	}
	return subjectSuccess
}

// buildMessage はステータスに応じた SNS 本文を生成する。
// エラー時はエラー専用メッセージ、正常時は回答内容を含む詳細メッセージを返す。
func buildMessage(event Event) string {
	if event.Status != "success" {
		return fmt.Sprintf("パイプラインでエラーが発生しました。ステータス: %s", event.Status)
	}
	return fmt.Sprintf(
		"回答種別: %s\n文字数: %d 語数: %d\n処理時刻: %s\n\n%s",
		event.AnswerType,
		event.Metadata.CharCount,
		event.Metadata.WordCount,
		event.Metadata.ProcessedAt,
		event.Summary,
	)
}

// buildAttributes は SNS MessageAttributes 用のフラット構造体を生成する。
// int / bool は string に変換して格納する。
func buildAttributes(event Event) SNSAttributes {
	return SNSAttributes{
		AnswerType:  event.AnswerType,
		Status:      event.Status,
		CharCount:   strconv.Itoa(event.Metadata.CharCount),
		IsTruncated: strconv.FormatBool(event.Metadata.IsTruncated),
	}
}

// buildNotification は SNS 通知ペイロード全体を組み立てる。
func buildNotification(event Event) Notification {
	return Notification{
		Subject:    buildSubject(event.Status, event.Metadata.IsTruncated),
		Message:    buildMessage(event),
		Attributes: buildAttributes(event),
	}
}

// ── ハンドラー ────────────────────────────────────────────────

func handler(_ context.Context, event Event) (Response, error) {
	return Response{
		Notification:        buildNotification(event),
		Summary:             event.Summary,
		AnswerType:          event.AnswerType,
		Status:              event.Status,
		Metadata:            event.Metadata,
		PipelineCompletedAt: time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func main() {
	lambda.Start(handler)
}
