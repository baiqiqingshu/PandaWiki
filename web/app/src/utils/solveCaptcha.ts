/**
 * 安全的 captcha 验证工具
 * 在 HTTP 环境下 crypto.subtle 不可用，cap.solve() 会失败
 * 此工具在验证失败时返回空 token，由后端决定是否放行
 */
export async function solveCaptcha(apiEndpoint: string): Promise<string> {
  try {
    const Cap = (await import(`@cap.js/widget`)).default;
    const cap = new Cap({ apiEndpoint });
    const solution = await cap.solve();
    return solution.token;
  } catch {
    // HTTP 部署下 crypto.subtle 不可用，返回空 token
    console.warn('[captcha] solve failed (likely HTTP context), skipping');
    return '';
  }
}
