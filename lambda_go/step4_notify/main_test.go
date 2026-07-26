package main

import (
	"strings"
	"testing"
	"time"
)

// ── buildSubject テスト ───────────────────────────────────────

func TestBuildSubjectSuccess(t *testing.T) {
	if got := buildSubject("success", false); got != subjectSuccess {
		t.Errorf("正常完了: 期待 %q, 実際 %q", subjectSuccess, got)
	}
}

func TestBuildSubjectTruncated(t *testing.T) {
	if got := buildSubject("success", true); got != subjectTruncated {
		t.Errorf("切り捨てあり: 期待 %q, 実際 %q", subjectTruncated, got)
	}
}

func TestBuildSubjectErrorOverridesTruncated(t *testing.T) {
	// error は truncated より優先される
	if got := buildSubject("error", true); got != subjectError {
		t.Errorf("エラー+切り捨て: エラーが優先されること 期待 %q, 実際 %q", subjectError, got)
	}
}

func TestBuildSubjectErrorStatus(t *testing.T) {
	if got := buildSubject("error", false); got != subjectError {
		t.Errorf("エラー: 期待 %q, 実際 %q", subjectError, got)
	}
}

func TestBuildSubjectFailedStatus(t *testing.T) {
	if got := buildSubject("failed", false); got != subjectError {
		t.Errorf("failed ステータス: 期待 %q, 実際 %q", subjectError, got)
	}
}

func TestBuildSubjectEmptyStatus(t *testing.T) {
	if got := buildSubject("", false); got != subjectError {
		t.Errorf("空ステータス: 期待 %q, 実際 %q", subjectError, got)
	}
}

func TestBuildSubjectTableDriven(t *testing.T) {
	tests := []struct {
		status      string
		isTruncated bool
		want        string
	}{
		{"success", false, subjectSuccess},
		{"success", true, subjectTruncated},
		{"error", false, subjectError},
		{"error", true, subjectError},
		{"failed", false, subjectError},
		{"", false, subjectError},
	}
	for _, tt := range tests {
		got := buildSubject(tt.status, tt.isTruncated)
		if got != tt.want {
			t.Errorf("buildSubject(%q, %v): 期待 %q, 実際 %q", tt.status, tt.isTruncated, tt.want, got)
		}
	}
}

// ── buildMessage テスト ──────────────────────────────────────

func TestBuildMessageSuccess(t *testing.T) {
	event := Event{
		Summary:    "AIとは人工知能のことです",
		AnswerType: "short",
		Status:     "success",
		Metadata:   Metadata{CharCount: 15, WordCount: 3, ProcessedAt: "2026-07-27T00:00:00Z"},
	}
	msg := buildMessage(event)
	if !strings.Contains(msg, "short") {
		t.Error("メッセージに AnswerType が含まれること")
	}
	if !strings.Contains(msg, "15") {
		t.Error("メッセージに CharCount が含まれること")
	}
	if !strings.Contains(msg, "AIとは人工知能のことです") {
		t.Error("メッセージに Summary が含まれること")
	}
}

func TestBuildMessageError(t *testing.T) {
	event := Event{Status: "error"}
	msg := buildMessage(event)
	if !strings.Contains(msg, "error") {
		t.Errorf("エラーメッセージにステータスが含まれること: %q", msg)
	}
	if strings.Contains(msg, "回答種別") {
		t.Error("エラー時は通常メッセージを含まないこと")
	}
}

func TestBuildMessageFailedStatus(t *testing.T) {
	event := Event{Status: "failed"}
	msg := buildMessage(event)
	if !strings.Contains(msg, "failed") {
		t.Errorf("failed メッセージにステータスが含まれること: %q", msg)
	}
}

func TestBuildMessageContainsWordCount(t *testing.T) {
	event := Event{
		Status:   "success",
		Metadata: Metadata{CharCount: 10, WordCount: 5, ProcessedAt: "2026-07-27T00:00:00Z"},
	}
	msg := buildMessage(event)
	if !strings.Contains(msg, "5") {
		t.Error("メッセージに WordCount が含まれること")
	}
}

// ── buildAttributes テスト ────────────────────────────────────

func TestBuildAttributesAnswerType(t *testing.T) {
	attr := buildAttributes(Event{AnswerType: "detail", Status: "success"})
	if attr.AnswerType != "detail" {
		t.Errorf("AnswerType: 期待 detail, 実際 %q", attr.AnswerType)
	}
}

func TestBuildAttributesStatus(t *testing.T) {
	attr := buildAttributes(Event{Status: "success"})
	if attr.Status != "success" {
		t.Errorf("Status: 期待 success, 実際 %q", attr.Status)
	}
}

func TestBuildAttributesCharCountToString(t *testing.T) {
	attr := buildAttributes(Event{Metadata: Metadata{CharCount: 42}})
	if attr.CharCount != "42" {
		t.Errorf("CharCount の文字列変換: 期待 \"42\", 実際 %q", attr.CharCount)
	}
}

func TestBuildAttributesIsTruncatedTrue(t *testing.T) {
	attr := buildAttributes(Event{Metadata: Metadata{IsTruncated: true}})
	if attr.IsTruncated != "true" {
		t.Errorf("IsTruncated=true の文字列変換: 期待 \"true\", 実際 %q", attr.IsTruncated)
	}
}

func TestBuildAttributesIsTruncatedFalse(t *testing.T) {
	attr := buildAttributes(Event{Metadata: Metadata{IsTruncated: false}})
	if attr.IsTruncated != "false" {
		t.Errorf("IsTruncated=false の文字列変換: 期待 \"false\", 実際 %q", attr.IsTruncated)
	}
}

func TestBuildAttributesZeroCharCount(t *testing.T) {
	attr := buildAttributes(Event{Metadata: Metadata{CharCount: 0}})
	if attr.CharCount != "0" {
		t.Errorf("CharCount=0 の変換: 期待 \"0\", 実際 %q", attr.CharCount)
	}
}

// ── buildNotification テスト ──────────────────────────────────

func TestBuildNotificationSubjectSuccess(t *testing.T) {
	n := buildNotification(Event{Status: "success"})
	if n.Subject != subjectSuccess {
		t.Errorf("正常時 Subject: 期待 %q, 実際 %q", subjectSuccess, n.Subject)
	}
}

func TestBuildNotificationSubjectError(t *testing.T) {
	n := buildNotification(Event{Status: "error"})
	if n.Subject != subjectError {
		t.Errorf("エラー時 Subject: 期待 %q, 実際 %q", subjectError, n.Subject)
	}
}

func TestBuildNotificationMessageNotEmpty(t *testing.T) {
	n := buildNotification(Event{Status: "success", AnswerType: "short", Summary: "test"})
	if n.Message == "" {
		t.Error("Message が空であってはならない")
	}
}

func TestBuildNotificationAttributesPopulated(t *testing.T) {
	n := buildNotification(Event{
		Status:     "success",
		AnswerType: "short",
		Metadata:   Metadata{CharCount: 10, IsTruncated: false},
	})
	if n.Attributes.Status != "success" {
		t.Errorf("Attributes.Status: 期待 success, 実際 %q", n.Attributes.Status)
	}
	if n.Attributes.CharCount != "10" {
		t.Errorf("Attributes.CharCount: 期待 \"10\", 実際 %q", n.Attributes.CharCount)
	}
}

// ── ハンドラーテスト ──────────────────────────────────────────

func TestHandlerErrorAlwaysNil(t *testing.T) {
	cases := []Event{
		{Summary: "test", AnswerType: "short", Status: "success"},
		{Status: "error"},
		{},
	}
	for _, e := range cases {
		if _, err := handler(nil, e); err != nil {
			t.Errorf("handler はエラーを返さないこと（Status=%q）: %v", e.Status, err)
		}
	}
}

func TestHandlerSummaryPreserved(t *testing.T) {
	input := "[簡潔回答] AIとは"
	resp, _ := handler(nil, Event{Summary: input, Status: "success"})
	if resp.Summary != input {
		t.Errorf("Summary: 期待 %q, 実際 %q", input, resp.Summary)
	}
}

func TestHandlerAnswerTypePreserved(t *testing.T) {
	resp, _ := handler(nil, Event{AnswerType: "detail", Status: "success"})
	if resp.AnswerType != "detail" {
		t.Errorf("AnswerType: 期待 detail, 実際 %q", resp.AnswerType)
	}
}

func TestHandlerStatusPreserved(t *testing.T) {
	resp, _ := handler(nil, Event{Status: "success"})
	if resp.Status != "success" {
		t.Errorf("Status: 期待 success, 実際 %q", resp.Status)
	}
}

func TestHandlerMetadataPreserved(t *testing.T) {
	meta := Metadata{CharCount: 99, WordCount: 10, ProcessedAt: "2026-07-27T00:00:00Z", IsTruncated: true}
	resp, _ := handler(nil, Event{Status: "success", Metadata: meta})
	if resp.Metadata.CharCount != 99 {
		t.Errorf("Metadata.CharCount: 期待 99, 実際 %d", resp.Metadata.CharCount)
	}
	if !resp.Metadata.IsTruncated {
		t.Error("Metadata.IsTruncated: 期待 true, 実際 false")
	}
}

func TestHandlerPipelineCompletedAtRFC3339(t *testing.T) {
	resp, _ := handler(nil, Event{Status: "success"})
	if _, err := time.Parse(time.RFC3339, resp.PipelineCompletedAt); err != nil {
		t.Errorf("PipelineCompletedAt が RFC3339 形式でない: %q, err: %v", resp.PipelineCompletedAt, err)
	}
}

func TestHandlerPipelineCompletedAtIsUTC(t *testing.T) {
	before := time.Now().UTC().Truncate(time.Second)
	resp, _ := handler(nil, Event{Status: "success"})
	after := time.Now().UTC().Add(time.Second)
	parsed, _ := time.Parse(time.RFC3339, resp.PipelineCompletedAt)
	if parsed.Before(before) || parsed.After(after) {
		t.Errorf("PipelineCompletedAt が現在時刻の範囲外: %s", resp.PipelineCompletedAt)
	}
}

func TestHandlerNotificationSubjectSuccess(t *testing.T) {
	resp, _ := handler(nil, Event{Status: "success", Metadata: Metadata{IsTruncated: false}})
	if resp.Notification.Subject != subjectSuccess {
		t.Errorf("正常時 Notification.Subject: 期待 %q, 実際 %q", subjectSuccess, resp.Notification.Subject)
	}
}

func TestHandlerNotificationSubjectTruncated(t *testing.T) {
	resp, _ := handler(nil, Event{Status: "success", Metadata: Metadata{IsTruncated: true}})
	if resp.Notification.Subject != subjectTruncated {
		t.Errorf("切り捨て時 Notification.Subject: 期待 %q, 実際 %q", subjectTruncated, resp.Notification.Subject)
	}
}

func TestHandlerNotificationSubjectError(t *testing.T) {
	resp, _ := handler(nil, Event{Status: "error"})
	if resp.Notification.Subject != subjectError {
		t.Errorf("エラー時 Notification.Subject: 期待 %q, 実際 %q", subjectError, resp.Notification.Subject)
	}
}

func TestHandlerTableDriven(t *testing.T) {
	tests := []struct {
		name            string
		event           Event
		wantSubject     string
		wantAttrStatus  string
	}{
		{
			"正常・短文",
			Event{Summary: "[簡潔回答] test", AnswerType: "short", Status: "success"},
			subjectSuccess,
			"success",
		},
		{
			"正常・切り捨てあり",
			Event{Status: "success", Metadata: Metadata{IsTruncated: true}},
			subjectTruncated,
			"success",
		},
		{
			"エラー",
			Event{Status: "error"},
			subjectError,
			"error",
		},
		{
			"空イベント",
			Event{},
			subjectError,
			"",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := handler(nil, tt.event)
			if err != nil {
				t.Fatalf("エラーが発生: %v", err)
			}
			if resp.Notification.Subject != tt.wantSubject {
				t.Errorf("Subject: 期待 %q, 実際 %q", tt.wantSubject, resp.Notification.Subject)
			}
			if resp.Notification.Attributes.Status != tt.wantAttrStatus {
				t.Errorf("Attributes.Status: 期待 %q, 実際 %q", tt.wantAttrStatus, resp.Notification.Attributes.Status)
			}
		})
	}
}
