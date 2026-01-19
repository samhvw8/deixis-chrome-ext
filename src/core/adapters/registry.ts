/**
 * Site Adapter Registry
 * Central registration and lookup for all site adapters
 */

import type { SiteAdapter } from './types';
import { geminiAdapter } from '../../adapters/gemini';

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
 * Get all URL patterns for manifest.json / context menu
 */
export function getAllMatches(): string[] {
  return siteAdapters.flatMap(adapter => adapter.matches);
}

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

/**
 * Match URL against Chrome extension pattern
 * Supports patterns like: https://example.com/*, *://example.com/*
 */
function matchesPattern(url: string, pattern: string): boolean {
  // Convert Chrome extension pattern to regex
  // Escape special regex chars except *
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
    .replace(/\*/g, '.*'); // Convert * to .*

  return new RegExp(`^${regexPattern}$`).test(url);
}
