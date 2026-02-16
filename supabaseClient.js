/**
 * Supabase Client Configuration
 * Replace SUPABASE_URL and SUPABASE_ANON_KEY with your actual values
 */

// 🔧 CONFIGURATION - Replace these with your Supabase project credentials
const SUPABASE_URL = 'https://cotfjapoyvacckyceeyy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fGrcY_g8h92azmgI__VbBg_U42Yw7bY';

if (!globalThis.supabase || !globalThis.supabase.createClient) {
  throw new Error('Supabase UMD not loaded. Ensure vendor/supabase.min.js loads first.');
}

const supabase = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chrome.storage.local,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

globalThis.supabaseClient = supabase;

/**
 * Custom storage adapter for Chrome Extension
 * Supabase will use chrome.storage.local for session persistence
 */
chrome.storage.local.setItem = (key, value) => {
  return chrome.storage.local.set({ [key]: value });
};

chrome.storage.local.getItem = async (key) => {
  const result = await chrome.storage.local.get(key);
  return result[key];
};

chrome.storage.local.removeItem = (key) => {
  return chrome.storage.local.remove(key);
};