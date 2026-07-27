package main

import (
	"strings"
	"testing"
)

var benchMeta = Metadata{
	CharCount:   120,
	WordCount:   20,
	ProcessedAt: "2026-07-27T10:00:00Z",
	IsTruncated: false,
}

var benchEvent = Event{
	Summary:    strings.Repeat("Bedrock summary ", 10),
	AnswerType: "short",
	Status:     "success",
	Metadata:   benchMeta,
}

// BenchmarkBuildSubject は Subject 決定ロジックの速度を測定する。
// 条件分岐のみで外部依存なし・ナノ秒オーダーで完了する。
func BenchmarkBuildSubject(b *testing.B) {
	for i := 0; i < b.N; i++ {
		buildSubject("success", false)
	}
}

// BenchmarkBuildMessage は SNS メッセージ本文生成の速度を測定する。
// fmt.Sprintf のアロケーションコストを確認する。
func BenchmarkBuildMessage(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		buildMessage(benchEvent)
	}
}

// BenchmarkBuildAttributes は SNS 属性フラット化の速度を測定する。
// strconv.Itoa / strconv.FormatBool のコストを確認する。
func BenchmarkBuildAttributes(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		buildAttributes(benchEvent)
	}
}

// BenchmarkBuildNotification は通知ペイロード組み立て全体の速度を測定する。
func BenchmarkBuildNotification(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		buildNotification(benchEvent)
	}
}

// BenchmarkHandlerNotify はハンドラー全体（time.Now() 含む）のレイテンシを測定する。
// pipeline_completed_at の timestamp 生成コストも含まれる。
func BenchmarkHandlerNotify(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = handler(nil, benchEvent)
	}
}

// BenchmarkHandlerNotifyError はエラーパスのレイテンシを測定する。
// エラー時はメッセージ生成が短縮されるためより高速になることを確認する。
func BenchmarkHandlerNotifyError(b *testing.B) {
	errEvent := Event{
		Summary:    "",
		AnswerType: "unknown",
		Status:     "error",
		Metadata:   benchMeta,
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = handler(nil, errEvent)
	}
}
