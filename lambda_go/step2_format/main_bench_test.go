package main

import (
	"strings"
	"testing"
)

// BenchmarkFormatResultShort は short 回答の整形速度を測定する。
func BenchmarkFormatResultShort(b *testing.B) {
	for i := 0; i < b.N; i++ {
		formatResult("short", "AWSはAmazon Web Servicesの略です")
	}
}

// BenchmarkFormatResultDetail は detail 回答の整形速度を測定する。
func BenchmarkFormatResultDetail(b *testing.B) {
	for i := 0; i < b.N; i++ {
		formatResult("detail", "Amazon Web Services（AWS）は、Amazonが提供するクラウドコンピューティングサービスです。")
	}
}

// BenchmarkFormatResultLong は長い回答テキストでの整形速度を測定する。
// Bedrock が詳細モードで長文を返す場合を想定している。
func BenchmarkFormatResultLong(b *testing.B) {
	long := strings.Repeat("AWS Lambda は ", 50) // 700文字程度
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		formatResult("detail", long)
	}
}

// BenchmarkHandlerShort はハンドラー全体（short パス）のレイテンシを測定する。
func BenchmarkHandlerShort(b *testing.B) {
	event := Event{BedrockAnswer: "AWSはクラウドサービスです", AnswerType: "short"}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = handler(nil, event)
	}
}

// BenchmarkHandlerDetail はハンドラー全体（detail パス）のレイテンシを測定する。
func BenchmarkHandlerDetail(b *testing.B) {
	event := Event{BedrockAnswer: strings.Repeat("詳細な説明 ", 30), AnswerType: "detail"}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = handler(nil, event)
	}
}
