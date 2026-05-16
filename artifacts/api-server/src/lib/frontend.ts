const DEFAULT_FRONTEND_URL = "http://localhost:5173";

export function getFrontendBaseUrl(): string {
  return process.env.FRONTEND_URL?.trim() || DEFAULT_FRONTEND_URL;
}

export function buildFrontendUrl(
  pathname: string,
  params?: Record<string, string | undefined>,
): string {
  const url = new URL(pathname, getFrontendBaseUrl());

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}
