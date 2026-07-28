/**
 * Deixis Background Script
 * Handles context menu registration and message passing
 * Uses adapter registry for dynamic URL patterns
 */

import { getAllMatches } from '../src/core/adapters/registry';
import { createLogger, initLogging } from '../src/core/logger';

const logger = createLogger('BG');

export default defineBackground(() => {
  initLogging();

  // On startup, check if we need to reload a tab (after extension reload)
  browser.storage.local
    .get<{ pendingTabReload?: { tabId: number; timestamp: number } }>('pendingTabReload')
    .then(async (result) => {
      const pending = result.pendingTabReload;
      if (!pending) return;

      const { tabId, timestamp } = pending;
      // Only reload if the flag was set within the last 5 seconds
      if (Date.now() - timestamp < 5000) {
        try {
          await browser.tabs.reload(tabId);
          logger.log('Reloaded tab after extension restart:', tabId);
        } catch (error) {
          logger.warn('Could not reload tab:', error);
        }
      }
      // Clear the flag
      await browser.storage.local.remove('pendingTabReload');
    });

  // Create context menu on install with all supported site patterns
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'deixis-annotate',
      title: 'Annotate with Deixis',
      contexts: ['image'],
      documentUrlPatterns: getAllMatches(),
    });
  });

  // Handle context menu clicks
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'deixis-annotate' && tab?.id) {
      // Send message to content script to open annotation mode
      browser.tabs.sendMessage(tab.id, {
        type: 'DEIXIS_OPEN_ANNOTATION',
        imageUrl: info.srcUrl,
      });
    }
  });

  // Handle messages from content script
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DEIXIS_READY') {
      logger.log('Content script ready on:', sender.tab?.url, 'adapter:', message.adapterId);
      sendResponse({ status: 'ok' });
      return true;
    }

    // Capture visible tab as screenshot. Used as the export fallback when the
    // annotation canvas is tainted by a cross-origin image.
    if (message.type === 'DEIXIS_CAPTURE_TAB' && sender.tab?.id) {
      logger.log('Capturing tab screenshot');
      browser.tabs
        .captureVisibleTab(sender.tab.windowId, { format: 'png' })
        .then((dataUrl) => {
          logger.log('Tab captured successfully');
          sendResponse({ success: true, dataUrl });
        })
        .catch((error: unknown) => {
          logger.error('Capture error:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      return true; // Keep message channel open for async response
    }

    return false;
  });
});
