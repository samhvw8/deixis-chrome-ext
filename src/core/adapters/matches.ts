/**
 * URL match patterns for every supported site.
 *
 * This module MUST stay free of imports. `wxt.config.ts` reads it to derive
 * `host_permissions` and the content script's `matches`, and config evaluation
 * runs in Node during `wxt prepare` (which is `postinstall`). Importing the
 * adapter modules there would pull the browser polyfill — and eventually a
 * `document` reference — into a context that has neither, turning a mistake in
 * any adapter into a failed `bun install`.
 */

/** Match patterns keyed by adapter id. Adding an adapter starts here. */
export const ADAPTER_MATCHES: Record<string, string[]> = {
  gemini: ['https://gemini.google.com/*'],
};

/**
 * Every distinct pattern across all adapters, for manifest.json and the context
 * menu. Deduped: two adapters sharing a pattern must not emit it twice.
 */
export function getAllMatches(): string[] {
  return [...new Set(Object.values(ADAPTER_MATCHES).flat())];
}
