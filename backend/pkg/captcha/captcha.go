package captcha

import (
	"context"

	gocap "github.com/ackcoder/go-cap"
)

type Captcha struct {
	*gocap.Cap
}

func NewCaptcha() *Captcha {
	return &Captcha{
		Cap: gocap.New(
			gocap.WithChallenge(50, 32, 3),
			gocap.WithChallengeExpires(60*2),
			gocap.WithTokenExpires(60*5),
		),
	}
}

// ValidateToken 验证 captcha token，当 token 为空时跳过验证（兼容 HTTP 部署）
func (c *Captcha) ValidateToken(ctx context.Context, token string) bool {
	if token == "" {
		return true
	}
	return c.Cap.ValidateToken(ctx, token)
}
