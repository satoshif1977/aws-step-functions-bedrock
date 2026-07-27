package main

import (
	"strings"
	"testing"
)

// BenchmarkCountChars は Unicode 文字数カウントの速度を測定する。
// utf8.RuneCountInString の実行コストを確認する。
func BenchmarkCountChars(b *testing.B) {
	input := strings.Repeat("あいうえお", 100) // 500文字（1500バイト）
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		countChars(input)
	}
}

// BenchmarkCountWords は単語数カウントの速度を測定する。
// strings.Fields のアロケーションコストを確認する。
func BenchmarkCountWords(b *testing.B) {
	input := strings.Repeat("aws lambda step functions bedrock ", 30) // 210単語
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		countWords(input)
	}
}

// BenchmarkBuildMetadata はメタデータ生成全体（文字数・単語数・時刻・切り捨て）の速度を測定する。
// time.Now() のオーバーヘッドも含めた実測値を得る。
func BenchmarkBuildMetadata(b *testing.B) {
	input := strings.Repeat("Bedrock summary ", 30) // 480文字
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		buildMetadata(input)
	}
}

// BenchmarkBuildMetadataTruncated は切り捨て判定が true になるケースを測定する。
func BenchmarkBuildMetadataTruncated(b *testing.B) {
	input := strings.Repeat("a", 600) // 600文字（閾値 500 を超える）
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		buildMetadata(input)
	}
}

// BenchmarkHandlerSummarize はハンドラー全体のレイテンシを測定する。
func BenchmarkHandlerSummarize(b *testing.B) {
	event := Event{
		Result:     strings.Repeat("Bedrock summary ", 20),
		AnswerType: "detail",
		Status:     "success",
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = handler(nil, event)
	}
}
