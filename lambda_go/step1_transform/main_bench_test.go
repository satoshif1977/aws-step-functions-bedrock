package main

import (
	"strings"
	"testing"
)

// BenchmarkTransformShort は短い英字入力のスループットを測定する。
// Lambda の典型的な軽量入力（短いプロンプト）を想定している。
func BenchmarkTransformShort(b *testing.B) {
	for i := 0; i < b.N; i++ {
		transform("hello world")
	}
}

// BenchmarkTransformLong は 1000文字の長い入力でのスループットを測定する。
// Bedrock の長い回答テキストを処理する場面を想定している。
func BenchmarkTransformLong(b *testing.B) {
	input := strings.Repeat("abcde", 200) // 1000文字
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		transform(input)
	}
}

// BenchmarkTransformJapanese は日本語（マルチバイト）入力の処理速度を測定する。
// utf8.RuneCountInString の実行コストを確認する。
func BenchmarkTransformJapanese(b *testing.B) {
	input := strings.Repeat("あいうえお", 20) // 100文字（300バイト）
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		transform(input)
	}
}

// BenchmarkHandlerDefault はハンドラー全体のレイテンシを測定する。
// Lambda コールドスタート後の実処理時間の基準として使用する。
func BenchmarkHandlerDefault(b *testing.B) {
	event := Event{Message: "aws step functions bedrock"}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = handler(nil, event)
	}
}
