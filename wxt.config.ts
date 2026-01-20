import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { execSync } from 'node:child_process';

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
    version: '0.3.2',
    permissions: ['activeTab', 'contextMenus', 'clipboardWrite', 'tabs', 'storage'],
    host_permissions: [
      '<all_urls>',
    ],
  },
});
