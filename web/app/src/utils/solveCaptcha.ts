/**
 * 安全的 captcha 验证工具
 * 在 HTTP 环境下 crypto.subtle 不可用，cap.solve() 会失败
 * 此工具在验证失败时返回空 token，由后端决定是否放行
 */
export async function solveCaptcha(apiEndpoint: string): Promise<string> {
  // HTTP 环境下 crypto.subtle 不可用，@cap.js/widget 内部 Worker 会反复报错
  // 直接跳过，避免控制台刷屏
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return '';
  }
  try {
    const Cap = (await import(`@cap.js/widget`)).default;
    const cap = new Cap({ apiEndpoint });
    const solution = await cap.solve();
    return solution.token;
  } catch {
    // 其他异常情况兜底
    console.warn('[captcha] solve failed, skipping');
    return '';
  }
}
