import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

// See https://wxt.dev/api/config.html
export default defineConfig({
  // Don't use the module, configure React plugin directly
  vite: () => ({
    plugins: [
      react({
        jsxRuntime: 'classic',
      }),
    ],
  }),
  manifest: {
    name: 'Deixis - Visual Annotation for Gemini',
    description: 'Draw visual annotations on images in Gemini chat to communicate intent precisely',
    version: '1.0.0',
    permissions: ['activeTab', 'contextMenus', 'clipboardWrite', 'tabs'],
    host_permissions: [
      '<all_urls>',
    ],
  },
});
