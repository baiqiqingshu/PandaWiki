package rag

import "testing"

func TestNormalizeSearchTextRemovesImagePayloads(t *testing.T) {
	tests := []struct {
		name    string
		content string
		want    string
	}{
		{
			name:    "markdown image",
			content: `Intro ![diagram](/static-file/a.png) done`,
			want:    "Intro done",
		},
		{
			name:    "html image with data url",
			content: `<p>Alpha <img src="data:image/png;base64,aaaa"> Beta</p>`,
			want:    "Alpha Beta",
		},
		{
			name:    "plain url and html entity",
			content: `Tom &amp; Jerry https://example.com/image.png tail`,
			want:    "Tom & Jerry tail",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeSearchText(tt.content); got != tt.want {
				t.Fatalf("normalizeSearchText() = %q, want %q", got, tt.want)
			}
		})
	}
}
