let startTime;
let currentUrl;

function debugLog(message) {
    console.log(`[Screen Time Tracker] ${message}`);
}

// Helper function to convert milliseconds to minutes
function msToMinutes(ms) {
    return Math.round(ms / 60000);
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
            debugLog(`Tab activated: ${tab.url}`);
            handleTabChange(tab.url);
        }
    } catch (error) {
        console.error('Error in onActivated:', error);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        debugLog(`URL changed: ${changeInfo.url}`);
        handleTabChange(changeInfo.url);
    }
});

function handleTabChange(url) {
    try {
        if (!url || url.startsWith('chrome://')) return;

        const domain = new URL(url).hostname;
        debugLog(`Handling tab change for domain: ${domain}`);
        
        // Save time for previous site
        if (currentUrl && startTime) {
            const timeSpent = Math.min(Date.now() - startTime, 60000); // Cap at 1 minute per switch
            debugLog(`Time spent on ${currentUrl}: ${timeSpent}ms`);
            updateTimeForDomain(currentUrl, timeSpent);
        }
        
        // Start tracking new site
        currentUrl = domain;
        startTime = Date.now();
        debugLog(`Started tracking: ${domain}`);
    } catch (error) {
        console.error('Error in handleTabChange:', error);
    }
}

async function updateTimeForDomain(domain, timeToAdd) {
    try {
        const data = await chrome.storage.local.get(domain);
        const currentTime = data[domain] || 0;
        const newTime = currentTime + timeToAdd;
        
        // Reset if the time is unreasonably large (over 24 hours)
        const maxDailyTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const timeToStore = newTime > maxDailyTime ? 0 : newTime;
        
        await chrome.storage.local.set({
            [domain]: timeToStore
        });
        
        await checkTimeLimit(domain, timeToStore);
        
        debugLog(`Updated time for ${domain}: ${Math.round(timeToStore / 60000)} minutes`);
    } catch (error) {
        console.error('Error in updateTimeForDomain:', error);
    }
}

async function checkTimeLimit(domain, timeSpent) {
    try {
        const limits = await chrome.storage.local.get('timeLimits') || {};
        const timeLimits = limits.timeLimits || {};
        
        const timeSpentMinutes = msToMinutes(timeSpent);
        const limitMinutes = timeLimits[domain] ? msToMinutes(timeLimits[domain]) : 0;
        
        if (timeLimits[domain] && timeSpent >= timeLimits[domain]) {
            // Store notification data with a distinct prefix
            const notificationKey = `_notification_${domain}`;
            const lastNotification = await chrome.storage.local.get(notificationKey);
            const now = Date.now();
            
            if (!lastNotification[notificationKey] || 
                (now - lastNotification[notificationKey]) > 5 * 60 * 1000) {
                
                chrome.notifications.create(`limit-${domain}`, {
                    type: 'basic',
                    iconUrl: 'icon48.png',
                    title: 'Time Limit Reached!',
                    message: `You've spent ${timeSpentMinutes} minutes on ${domain}`,
                    priority: 2
                });
                
                // Store with distinct prefix
                await chrome.storage.local.set({
                    [notificationKey]: now
                });
            }
        }
    } catch (error) {
        console.error('Error in checkTimeLimit:', error);
    }
}

// Auto-reset daily totals at midnight
async function resetDailyTotals() {
    try {
        const data = await chrome.storage.local.get(null);
        const newData = {};
        
        // Only preserve timeLimits, reset everything else
        if (data.timeLimits) {
            newData.timeLimits = data.timeLimits;
        }
        
        await chrome.storage.local.clear();
        if (Object.keys(newData).length > 0) {
            await chrome.storage.local.set(newData);
        }
        
        debugLog('Daily totals reset');
    } catch (error) {
        console.error('Error resetting daily totals:', error);
    }
}

// Set up daily reset
function scheduleDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilReset = tomorrow - now;
    setTimeout(async () => {
        await resetDailyTotals();
        scheduleDailyReset(); // Schedule next reset
    }, timeUntilReset);
}

// Initialize
chrome.runtime.onStartup.addListener(() => {
    scheduleDailyReset();
});

// Call it when the extension loads too
scheduleDailyReset();

// Periodic cleanup every hour
setInterval(async () => {
    try {
        const data = await chrome.storage.local.get(null);
        for (const [key, value] of Object.entries(data)) {
            if (key !== 'timeLimits' && typeof value === 'number' && value > 24 * 60 * 60 * 1000) {
                await chrome.storage.local.remove(key);
                debugLog(`Cleaned up excessive value for ${key}`);
            }
        }
    } catch (error) {
        console.error('Error in cleanup:', error);
    }
}, 60 * 60 * 1000);


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_CURRENT_TIME') {
        sendResponse({
            currentTime: new Date().toISOString(),
            username: 'havishshetty'
        });
    }
});