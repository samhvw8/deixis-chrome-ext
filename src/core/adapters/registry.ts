/**
 * Site Adapter Registry
 * Central registration and lookup for all site adapters
 */

import type { SiteAdapter } from './types';
import { geminiAdapter } from '../../adapters/gemini';

// Re-exported so runtime code has one import site, while wxt.config.ts can
// import ./matches directly and keep the build config free of runtime code.
export { getAllMatches, ADAPTER_MATCHES } from './matches';

/**
 * Registry of all supported site adapters
 * Add new adapters here to enable Deixis on additional sites
 */
export const siteAdapters: SiteAdapter[] = [
  geminiAdapter,
  // Add new adapters here:
  // chatgptAdapter,
  // higgsFieldAdapter,
];

/**
 * Find adapter for a given URL
 */
export function getAdapterForUrl(url: string): SiteAdapter | null {
  for (const adapter of siteAdapters) {
    for (const pattern of adapter.matches) {
      if (matchesPattern(url, pattern)) {
        return adapter;
      }
    }
  }
  return null;
}

/** Escape every regex metacharacter except `*`, which callers turn into `.*`. */
function escapeExceptWildcard(value: string): string {
  return value.replace(/[.+^${}()|[\]\\?]/g, '\\$&');
}

/**
 * Match a URL against a Chrome extension match pattern
 * (`<scheme>://<host><path>`, e.g. `https://example.com/*`, `*://*.example.com/*`).
 *
 * Scheme and host are compared structurally rather than by a single regex over
 * the whole URL — a naive `*` → `.*` substitution is unanchored, so a pattern
 * like `*://example.com/*` would also match `https://evil.com/?x=https://example.com/`.
 *
 * Exported for testing.
 */
export function matchesPattern(url: string, pattern: string): boolean {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return false;
  }

  if (pattern === '<all_urls>') {
    return ['http:', 'https:', 'file:', 'ftp:'].includes(target.protocol);
  }

  const parts = /^(\*|[a-z][a-z0-9+.-]*):\/\/([^/]*)(\/.*)$/i.exec(pattern);
  if (!parts) return false;
  const [, scheme, host, path] = parts;

  // Scheme: '*' means http or https only (per the Chrome match-pattern spec)
  if (scheme === '*') {
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return false;
  } else if (target.protocol !== `${scheme.toLowerCase()}:`) {
    return false;
  }

  // Host: '*' matches anything; '*.example.com' matches example.com and any
  // subdomain; otherwise it must match exactly.
  const hostname = target.hostname.toLowerCase();
  if (host !== '*') {
    const expected = host.toLowerCase();
    if (expected.startsWith('*.')) {
      const base = expected.slice(2);
      if (hostname !== base && !hostname.endsWith(`.${base}`)) return false;
    } else if (hostname !== expected) {
      return false;
    }
  }

  // Path: only '*' is a wildcard, everything else is literal
  const pathRegex = new RegExp(`^${escapeExceptWildcard(path).replace(/\*/g, '.*')}$`);
  return pathRegex.test(`${target.pathname}${target.search}`);
}
