const DEFAULT_PROXY_BASE_URL = "http://localhost:3001";

function normalizeProxyBaseUrl(value: string): string {
  const trimmedValue = value.trim();
  const resolvedValue = trimmedValue || DEFAULT_PROXY_BASE_URL;

  return resolvedValue.endsWith("/")
    ? resolvedValue.slice(0, -1)
    : resolvedValue;
}

export const proxyBaseUrl = normalizeProxyBaseUrl(__COPILOT_PROXY_BASE_URL__);
