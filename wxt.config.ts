import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { execSync } from 'node:child_process';
// Imported from the zero-import pattern module, NOT the registry: config
// evaluation runs in Node, so pulling in adapter runtime code would drag the
// browser polyfill (and any DOM access) into a context without a DOM.
import { getAllMatches } from './src/core/adapters/matches';

// Get git version info at build time
function getGitVersion(): string {
  try {
    // git describe gives: v0.3.0-beta-4-g56fe0ce (tag-commits-hash)
    return execSync('git describe --tags --always', { encoding: 'utf-8' }).trim();
  } catch {
    return 'dev';
  }
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  // Don't use the module, configure React plugin directly
  vite: () => ({
    plugins: [
      react({
        jsxRuntime: 'classic',
      }),
    ],
    define: {
      __GIT_VERSION__: JSON.stringify(getGitVersion()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  }),
  manifest: {
    name: 'Deixis - Visual Annotation for AI',
    description: 'Annotate images in AI chats. Show what you mean instead of describing it with words.',
    // `version` is intentionally omitted — WXT reads it from package.json, which
    // is the single source of truth (release.yml verifies the tag against it).
    // `tabs` is deliberately NOT requested: tabs.query/reload/sendMessage work
    // without it, and captureVisibleTab is gated by activeTab, not tabs.
    permissions: ['activeTab', 'contextMenus', 'clipboardWrite', 'storage'],
    host_permissions: getAllMatches(),
  },
});
