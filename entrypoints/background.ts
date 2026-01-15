/**
 * Deixis Background Script
 * Handles context menu registration and message passing
 */

export default defineBackground(() => {
  // Create context menu on install
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'deixis-annotate',
      title: 'Annotate with Deixis',
      contexts: ['image'],
      documentUrlPatterns: ['https://gemini.google.com/*'],
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
      console.log('Deixis content script ready on:', sender.tab?.url);
      sendResponse({ status: 'ok' });
      return true;
    }

    // Capture visible tab as screenshot
    if (message.type === 'DEIXIS_CAPTURE_TAB' && sender.tab?.id) {
      console.log('[Deixis BG] Capturing tab screenshot');
      chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' })
        .then((dataUrl) => {
          console.log('[Deixis BG] Tab captured successfully');
          sendResponse({ success: true, dataUrl });
        })
        .catch((error) => {
          console.error('[Deixis BG] Capture error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep message channel open for async response
    }

    return true;
  });
});

/**
 * Fetch an image and convert to data URL
 * Uses fetch without credentials since Google returns Access-Control-Allow-Origin: *
 * which doesn't work with credentials mode
 */
async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
  console.log('[Deixis BG] Fetching image:', imageUrl);

  try {
    // Fetch without credentials - Google's CDN returns CORS: * which requires credentials: omit
    const response = await fetch(imageUrl, {
      credentials: 'omit',
      mode: 'cors',
    });

    console.log('[Deixis BG] Fetch response:', response.status, response.ok);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log('[Deixis BG] Got blob, size:', blob.size);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('[Deixis BG] Converted to data URL');
        resolve(reader.result as string);
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[Deixis BG] Fetch error details:', error);
    throw error;
  }
}
