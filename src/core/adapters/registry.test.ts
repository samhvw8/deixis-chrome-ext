import { describe, expect, it } from 'bun:test';
import {
  ADAPTER_MATCHES,
  getAdapterForUrl,
  getAllMatches,
  matchesPattern,
  siteAdapters,
} from './registry';

describe('matchesPattern', () => {
  it('matches an exact host with a path wildcard', () => {
    expect(matchesPattern('https://gemini.google.com/app', 'https://gemini.google.com/*')).toBe(true);
    expect(matchesPattern('https://gemini.google.com/', 'https://gemini.google.com/*')).toBe(true);
  });

  it('rejects a different host', () => {
    expect(matchesPattern('https://evil.com/app', 'https://gemini.google.com/*')).toBe(false);
  });

  it('rejects a host that merely ends with the pattern host', () => {
    expect(matchesPattern('https://notgemini.google.com/x', 'https://gemini.google.com/*')).toBe(false);
  });

  it('does not let a wildcard scheme escape the host anchor', () => {
    // The old `*` -> `.*` substitution matched this, because `.*://` could
    // swallow "https://evil.com/?x=https".
    expect(
      matchesPattern('https://evil.com/?x=https://example.com/steal', '*://example.com/*')
    ).toBe(false);
  });

  it('does not let a path wildcard escape into the host', () => {
    expect(matchesPattern('https://evil.com/https://example.com/', 'https://example.com/*')).toBe(false);
  });

  it('restricts a wildcard scheme to http and https', () => {
    expect(matchesPattern('http://example.com/a', '*://example.com/*')).toBe(true);
    expect(matchesPattern('https://example.com/a', '*://example.com/*')).toBe(true);
    expect(matchesPattern('ftp://example.com/a', '*://example.com/*')).toBe(false);
  });

  it('matches subdomains only for a leading *. host', () => {
    expect(matchesPattern('https://a.example.com/x', 'https://*.example.com/*')).toBe(true);
    expect(matchesPattern('https://example.com/x', 'https://*.example.com/*')).toBe(true);
    expect(matchesPattern('https://exampleXcom/x', 'https://*.example.com/*')).toBe(false);
  });

  it('honours a literal path prefix', () => {
    expect(matchesPattern('https://example.com/app/chat', 'https://example.com/app/*')).toBe(true);
    expect(matchesPattern('https://example.com/other', 'https://example.com/app/*')).toBe(false);
  });

  it('treats regex metacharacters in the pattern as literals', () => {
    expect(matchesPattern('https://example.com/aXb', 'https://example.com/a.b')).toBe(false);
    expect(matchesPattern('https://example.com/a.b', 'https://example.com/a.b')).toBe(true);
  });

  it('returns false for an unparseable url or pattern', () => {
    expect(matchesPattern('not a url', 'https://example.com/*')).toBe(false);
    expect(matchesPattern('https://example.com/', 'nonsense')).toBe(false);
  });

  it('supports <all_urls>', () => {
    expect(matchesPattern('https://anything.dev/x', '<all_urls>')).toBe(true);
    expect(matchesPattern('chrome://settings', '<all_urls>')).toBe(false);
  });
});

describe('registry', () => {
  it('exposes every adapter match pattern', () => {
    const matches = getAllMatches();
    expect(matches.length).toBeGreaterThan(0);
    expect(matches).toContain('https://gemini.google.com/*');
  });

  it('resolves the gemini adapter for a gemini url', () => {
    expect(getAdapterForUrl('https://gemini.google.com/app/123')?.id).toBe('gemini');
  });

  it('returns null for an unsupported site', () => {
    expect(getAdapterForUrl('https://example.com/')).toBeNull();
  });

  // wxt.config.ts derives host_permissions from ADAPTER_MATCHES without
  // importing any adapter, so nothing at runtime would catch the two drifting
  // apart — an adapter would silently run on a host the manifest never granted.
  it('keeps every adapter in sync with the manifest pattern table', () => {
    for (const adapter of siteAdapters) {
      expect(ADAPTER_MATCHES[adapter.id]).toBeDefined();
      expect(adapter.matches).toEqual(ADAPTER_MATCHES[adapter.id]);
    }
    expect(Object.keys(ADAPTER_MATCHES).sort()).toEqual(
      siteAdapters.map((adapter) => adapter.id).sort()
    );
  });

  it('deduplicates patterns shared by two adapters', () => {
    expect(getAllMatches().length).toBe(new Set(getAllMatches()).size);
  });
});
