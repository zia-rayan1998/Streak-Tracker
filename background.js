/**
 * Background Service Worker
 * Handles session persistence and periodic data refresh
 */

importScripts('vendor/supabase.min.js', 'supabaseClient.js');

const supabase = globalThis.supabaseClient;

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
    await refreshUserData();
  }
});

/**
 * Refresh user data in the background
 */
async function refreshUserData() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('No active session');
      return;
    }

    console.log('Refreshing user data...');
    
    // Fetch fresh data (this will be cached for popup)
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profile) {
      // Store in chrome.storage for quick access
      await chrome.storage.local.set({
        cachedProfile: profile,
        lastRefresh: new Date().toISOString()
      });
      
      console.log('Data refreshed successfully');
    }
  } catch (error) {
    console.error('Error refreshing data:', error);
  }
}

/**
 * Listen for messages from popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'refreshData') {
    refreshUserData().then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
});