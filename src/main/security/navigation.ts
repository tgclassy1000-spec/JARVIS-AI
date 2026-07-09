export function isTrustedRendererUrl(
  rawUrl: string,
  isDevelopment: boolean,
  developmentRendererUrl = 'http://localhost:5173',
): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'file:') return !isDevelopment;
    if (!isDevelopment) return false;

    const trustedDevelopmentOrigin = new URL(developmentRendererUrl).origin;
    return url.origin === trustedDevelopmentOrigin;
  } catch {
    return false;
  }
}
