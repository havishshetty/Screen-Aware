"use strict";
// Initialize tracking data
const trackingData = {
    lastActiveTime: Date.now(),
    currentDomain: ''
};
// Debug mode for development
const DEBUG_MODE = true;
// Helper function for debug logging
function debugLog(message) {
    if (DEBUG_MODE) {
        console.log(`[DEBUG] ${message}`);
    }
}
// Convert milliseconds to minutes
function msToMinutes(ms) {
    return Math.round(ms / 60000);
}
// Update time for domain
async function updateTimeForDomain(domain, timeToAdd) {
    try {
        if (!domain || timeToAdd <= 0)
            return;
        const data = await chrome.storage.local.get(domain);
        const currentTime = data[domain] || 0;
        const newTime = currentTime + timeToAdd;
        // Reset if time is over 24 hours (prevents overflow)
        const maxDailyTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const timeToStore = newTime > maxDailyTime ? timeToAdd : newTime;
        await chrome.storage.local.set({ [domain]: timeToStore });
        await checkTimeLimit(domain, timeToStore);
        debugLog(`Updated time for ${domain}: ${msToMinutes(timeToStore)} minutes`);
    }
    catch (error) {
        console.error('Error in updateTimeForDomain:', error);
    }
}
// Check time limits and show notifications
async function checkTimeLimit(domain, timeSpent) {
    try {
        const data = await chrome.storage.local.get('timeLimits');
        const timeLimits = data.timeLimits || {};
        if (timeLimits[domain] && timeSpent >= timeLimits[domain]) {
            const timeSpentMinutes = msToMinutes(timeSpent);
            const limitMinutes = msToMinutes(timeLimits[domain]);
            // Check notification cooldown
            const notificationKey = `notification_${domain}`;
            const lastNotification = await chrome.storage.local.get(notificationKey);
            const now = Date.now();
            // Show notification if cooldown passed (5 minutes)
            if (!lastNotification[notificationKey] ||
                (now - lastNotification[notificationKey]) > 5 * 60 * 1000) {
                await chrome.notifications.create(`limit-${domain}`, {
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'Time Limit Reached!',
                    message: `You've spent ${timeSpentMinutes} minutes on ${domain} (Limit: ${limitMinutes} minutes)`,
                    priority: 2
                });
                await chrome.storage.local.set({ [notificationKey]: now });
            }
        }
    }
    catch (error) {
        console.error('Error in checkTimeLimit:', error);
    }
}
// Reset daily totals
async function resetDailyTotals() {
    try {
        const data = await chrome.storage.local.get(null);
        const preservedData = {};
        // Preserve time limits and system data
        if (data.timeLimits) {
            preservedData.timeLimits = data.timeLimits;
        }
        await chrome.storage.local.clear();
        if (Object.keys(preservedData).length > 0) {
            await chrome.storage.local.set(preservedData);
        }
        debugLog('Daily totals reset successfully');
    }
    catch (error) {
        console.error('Error resetting daily totals:', error);
    }
}
// Schedule daily reset at midnight UTC
function scheduleDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(24, 0, 0, 0);
    const timeUntilReset = tomorrow.getTime() - now.getTime();
    setTimeout(() => {
        resetDailyTotals().then(() => {
            scheduleDailyReset(); // Schedule next reset
        });
    }, timeUntilReset);
}
// Handle active tab changes
async function handleTabChange(activeInfo) {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (!tab.url)
            return;
        const url = new URL(tab.url);
        const newDomain = url.hostname;
        const now = Date.now();
        // Update time for previous domain
        if (trackingData.currentDomain) {
            const timeSpent = now - trackingData.lastActiveTime;
            await updateTimeForDomain(trackingData.currentDomain, timeSpent);
        }
        // Update tracking data
        trackingData.currentDomain = newDomain;
        trackingData.lastActiveTime = now;
        debugLog(`Switched to domain: ${newDomain}`);
    }
    catch (error) {
        console.error('Error in handleTabChange:', error);
    }
}
// Handle window focus changes
async function handleWindowFocus(windowId) {
    try {
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
            // Browser lost focus
            if (trackingData.currentDomain) {
                const timeSpent = Date.now() - trackingData.lastActiveTime;
                await updateTimeForDomain(trackingData.currentDomain, timeSpent);
                trackingData.currentDomain = '';
            }
        }
        else {
            // Browser gained focus
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id) {
                await handleTabChange({ tabId: tab.id, windowId: windowId });
            }
        }
    }
    catch (error) {
        console.error('Error in handleWindowFocus:', error);
    }
}
// Message handler for popup.ts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_CURRENT_TIME') {
        sendResponse({
            currentTime: Date.now(),
            username: 'havishshetty'
        });
    }
    return true;
});
// Set up event listeners
chrome.tabs.onActivated.addListener(handleTabChange);
chrome.windows.onFocusChanged.addListener(handleWindowFocus);
// Clean up old notification records periodically
setInterval(async () => {
    try {
        const data = await chrome.storage.local.get(null);
        const deleteKeys = Object.keys(data).filter(key => key.startsWith('notification_') &&
            Date.now() - data[key] > 24 * 60 * 60 * 1000);
        if (deleteKeys.length > 0) {
            await chrome.storage.local.remove(deleteKeys);
            debugLog(`Cleaned up ${deleteKeys.length} old notification records`);
        }
    }
    catch (error) {
        console.error('Error in cleanup:', error);
    }
}, 60 * 60 * 1000); // Run every hour
// Initialize
chrome.runtime.onInstalled.addListener(() => {
    debugLog('Extension installed/updated');
    scheduleDailyReset();
});
chrome.runtime.onStartup.addListener(() => {
    debugLog('Extension started');
    scheduleDailyReset();
});
// Schedule initial daily reset
scheduleDailyReset();
