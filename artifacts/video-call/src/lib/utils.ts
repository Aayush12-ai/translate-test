import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function getConfiguredApiBaseUrl(): string {
  if (!isLocalHostname(window.location.hostname)) {
    return window.location.origin.replace(/\/$/, "");
  }

  const configuredTarget =
    typeof __APP_API_TARGET__ === "string" && __APP_API_TARGET__.trim().length > 0
      ? __APP_API_TARGET__
      : window.location.origin;

  return configuredTarget.replace(/\/$/, "");
}

function buildApiWebSocketUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, baseUrl.replace(/\/$/, ""));

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return url.toString();
}

export function getApiHttpBaseUrl(): string {
  return getConfiguredApiBaseUrl();
}

export function getApiWebSocketUrl(path: string): string {
  return buildApiWebSocketUrl(getConfiguredApiBaseUrl(), path);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function addApiBaseCandidate(candidates: Set<string>, baseUrl: string) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  candidates.add(normalizedBaseUrl);

  try {
    const url = new URL(normalizedBaseUrl);

    if (url.hostname === "127.0.0.1") {
      url.hostname = "localhost";
      candidates.add(normalizeBaseUrl(url.toString()));
    } else if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
      candidates.add(normalizeBaseUrl(url.toString()));
    }
  } catch {
    // Ignore malformed URLs and keep the original candidate only.
  }
}

function getApiBaseCandidates(): string[] {
  const candidates = new Set<string>();

  addApiBaseCandidate(candidates, getConfiguredApiBaseUrl());
  addApiBaseCandidate(candidates, window.location.origin);

  return [...candidates];
}

async function canReachApi(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(`${baseUrl}/api/healthz`, {
      method: "GET",
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

let resolvedApiBaseUrlPromise: Promise<string> | null = null;
let resolvedApiBaseUrlExpiresAt = 0;
const API_BASE_REVALIDATE_MS = 5_000;

export async function resolveApiBaseUrl(): Promise<string> {
  const now = Date.now();

  if (!resolvedApiBaseUrlPromise || now >= resolvedApiBaseUrlExpiresAt) {
    resolvedApiBaseUrlExpiresAt = now + API_BASE_REVALIDATE_MS;
    resolvedApiBaseUrlPromise = (async () => {
      const uniqueCandidates = getApiBaseCandidates();

      for (const candidate of uniqueCandidates) {
        if (await canReachApi(candidate)) {
          return candidate;
        }
      }

      return getConfiguredApiBaseUrl();
    })();
  }

  return resolvedApiBaseUrlPromise;
}

export function getApiWebSocketCandidates(path: string): string[] {
  const candidates = new Set<string>();

  for (const baseUrl of getApiBaseCandidates()) {
    candidates.add(buildApiWebSocketUrl(baseUrl, path));
  }

  return [...candidates];
}

export async function resolveApiWebSocketCandidates(path: string): Promise<string[]> {
  const resolvedBaseUrl = await resolveApiBaseUrl();

  return [
    buildApiWebSocketUrl(resolvedBaseUrl, path),
    ...getApiWebSocketCandidates(path),
  ].filter((candidate, index, allCandidates) => allCandidates.indexOf(candidate) === index);
}
