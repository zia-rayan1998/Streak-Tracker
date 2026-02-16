/**
 * Background Service Worker
 * Handles session persistence and periodic data refresh
 */

// Set up periodic refresh alarm (every 15 minutes)
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  
  // Create alarm for periodic refresh
  chrome.alarms.create('refreshData', {
    periodInMinutes: 15
  });
});

// Handle alarm triggers
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refreshData') {
    console.log('Refresh alarm triggered');
  }
});

/**
 * Listen for messages from popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    console.log('Background alive');
    sendResponse({ ok: true });
    return;
  }
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
});