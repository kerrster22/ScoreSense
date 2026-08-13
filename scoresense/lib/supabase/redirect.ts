const DEFAULT_REDIRECT = "/app"

/**
 * Restricts post-auth redirect targets to internal application paths, so a crafted
 * `?redirect=` query param can't be used for an open redirect (e.g. `https://evil.com`,
 * `//evil.com`, `/\evil.com`).
 */
export function safeRedirectPath(path: string | null | undefined): string {
  if (!path) return DEFAULT_REDIRECT
  if (!path.startsWith("/")) return DEFAULT_REDIRECT
  if (path.startsWith("//") || path.startsWith("/\\")) return DEFAULT_REDIRECT
  if (path.includes("://")) return DEFAULT_REDIRECT
  return path
}
