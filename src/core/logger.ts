/**
 * Deixis Logger
 * Diagnostic output is gated behind the popup's "Enable Logging" toggle so a
 * production install stays quiet. Errors always print — they are actionable
 * whether or not the user opted into verbose logging.
 */

import { browser } from 'wxt/browser';

const STORAGE_KEY = 'loggingEnabled';

/**
 * `null` until the stored preference has been read. Reading storage is async,
 * so the first messages of a session are emitted before the answer arrives —
 * including "Content script loaded" and each adapter's init message, which the
 * adapter guide tells authors to look for first. Those are buffered rather than
 * dropped, then replayed if logging turns out to be on.
 */
let enabled: boolean | null = null;

interface BufferedMessage {
  level: 'log' | 'warn';
  args: unknown[];
}

/** Bounded so a context that never calls initLogging() can't grow forever. */
const MAX_BUFFERED = 100;
let buffered: BufferedMessage[] = [];

let listenerAttached = false;

function flushBuffer(): void {
  const pending = buffered;
  buffered = [];
  if (!enabled) return;
  for (const message of pending) {
    if (message.level === 'warn') console.warn(...message.args);
    else console.log(...message.args);
  }
}

/**
 * Start tracking the logging toggle. Call once per extension context
 * (background, content script, popup) during initialization. Safe to call
 * again — a bfcache restore re-runs initialization in the same JS context.
 */
export function initLogging(): void {
  browser.storage.local
    .get<{ loggingEnabled?: boolean }>([STORAGE_KEY])
    .then((result) => {
      enabled = result.loggingEnabled ?? false;
      flushBuffer();
    })
    .catch(() => {
      // Storage unavailable — stay silent rather than crash the caller.
      enabled = false;
      buffered = [];
    });

  if (listenerAttached) return;
  listenerAttached = true;

  // Only the local area is read above, so only the local area may flip the flag
  // — otherwise a write to storage.sync would desync the two.
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const change = changes[STORAGE_KEY];
    if (change) {
      enabled = Boolean(change.newValue);
      flushBuffer();
    }
  });
}

export interface Logger {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

function emit(level: 'log' | 'warn', args: unknown[]): void {
  if (enabled === null) {
    if (buffered.length < MAX_BUFFERED) buffered.push({ level, args });
    return;
  }
  if (!enabled) return;
  if (level === 'warn') console.warn(...args);
  else console.log(...args);
}

/**
 * Create a scoped logger, e.g. `createLogger('BG')` prints "[Deixis BG] ...".
 */
export function createLogger(scope?: string): Logger {
  const prefix = scope ? `[Deixis ${scope}]` : '[Deixis]';
  return {
    log: (...args) => emit('log', [prefix, ...args]),
    warn: (...args) => emit('warn', [prefix, ...args]),
    error: (...args) => console.error(prefix, ...args),
  };
}
