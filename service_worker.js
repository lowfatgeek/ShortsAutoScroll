// Service Worker for YouTube Shorts Auto Scroller
console.log('Service Worker: Initialized');

// Global state
let runState = {
  isRunning: false,
  currentCount: 0,
  targetCount: 0,
  countdown: 0,
  lastVideoId: null,
  lastLogs: [],
  settings: null,
  currentStep: null,
  navigationRetries: 0
};

// Initialize state from storage on startup
async function initializeState() {
  const stored = await chrome.storage.local.get(['runState', 'settings']);
  
  if (stored.runState) {
    runState = { ...runState, ...stored.runState };
    
    // If was running, restore the automation
    if (runState.isRunning) {
      console.log('Restoring automation state...');
      await saveState();
    }
  }
  
  if (stored.settings) {
    runState.settings = stored.settings;
  }
}

// Save state to storage
async function saveState() {
  await chrome.storage.local.set({ runState });
}

// Add log entry
function addLog(message) {
  console.log('Log:', message);
  runState.lastLogs.unshift(message);
  
  // Keep only last 10 logs
  if (runState.lastLogs.length > 10) {
    runState.lastLogs = runState.lastLogs.slice(0, 10);
  }
  
  saveState();
}

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service worker received message:', message);

  switch (message.type) {
    case 'START_RUN':
      handleStartRun(message.settings);
      sendResponse({ ok: true });
      break;

    case 'STOP_RUN':
      handleStopRun();
      sendResponse({ ok: true });
      break;

    case 'RESET_EXTENSION':
      handleResetExtension();
      sendResponse({ ok: true });
      break;

    case 'GET_STATUS':
      sendResponse({ runState });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true;
});

// Handle start run command
async function handleStartRun(settings) {
  console.log('Starting run with settings:', settings);

  // Initialize state
  runState.isRunning = true;
  runState.currentCount = 0;
  runState.targetCount = settings.targetCount;
  runState.settings = settings;
  runState.lastVideoId = null;
  runState.navigationRetries = 0;
  runState.lastLogs = [];
  
  addLog(`Starting automation: ${settings.targetCount} videos`);
  await saveState();

  // Start the automation loop
  await startAutomationLoop();
}

// Handle stop run command
async function handleStopRun() {
  console.log('Stopping run');
  
  runState.isRunning = false;
  runState.countdown = 0;
  
  // Clear all alarms
  await chrome.alarms.clearAll();
  
  addLog('⊗ Stopped by user');
  await saveState();
}

// Handle reset extension command
async function handleResetExtension() {
  console.log('Resetting extension');
  
  // Clear all alarms
  await chrome.alarms.clearAll();
  
  // Reset state to defaults
  runState = {
    isRunning: false,
    currentCount: 0,
    targetCount: 0,
    countdown: 0,
    lastVideoId: null,
    lastLogs: [],
    settings: runState.settings, // Preserve user settings
    currentStep: null,
    navigationRetries: 0
  };
  
  await saveState();
  console.log('Extension reset complete');
}

// Start automation loop
async function startAutomationLoop() {
  if (!runState.isRunning) return;

  try {
    // Step A: Verify content script is ready
    const ready = await verifyReady();
    
    if (!ready) {
      addLog('Error: Content script not ready');
      await handleStopRun();
      return;
    }

    // Start processing videos
    await processNextVideo();
  } catch (error) {
    console.error('Error in automation loop:', error);
    addLog(`Error: ${error.message}`);
    await handleStopRun();
  }
}

// Verify content script is ready
async function verifyReady() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      console.error('No active tab found');
      return false;
    }

    // Check if we're on a YouTube Shorts page
    if (!tab.url || !tab.url.includes('youtube.com/shorts/')) {
      console.error('Not on YouTube Shorts page');
      return false;
    }

    // Try to send message to content script
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_READY' });
      return response && response.ready;
    } catch (error) {
      // Content script not loaded - try to inject it
      console.log('Content script not responding, attempting to inject...');
      return await injectContentScript(tab.id);
    }
  } catch (error) {
    console.error('Error verifying ready:', error);
    return false;
  }
}

// Inject content script programmatically
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content_script.js']
    });
    
    console.log('Content script injected successfully');
    
    // Wait a moment for the script to initialize
    await sleep(500);
    
    // Try to verify again
    const response = await chrome.tabs.sendMessage(tabId, { type: 'CHECK_READY' });
    return response && response.ready;
  } catch (error) {
    console.error('Error injecting content script:', error);
    return false;
  }
}

// Process next video in the sequence
async function processNextVideo() {
  if (!runState.isRunning) return;

  // Check if we've reached the target
  if (runState.currentCount >= runState.targetCount) {
    addLog(`✓ Completed ${runState.targetCount} videos`);
    await handleStopRun();
    return;
  }

  // Check if current video is sponsored - skip immediately if so
  const isSponsored = await checkIfSponsored();
  if (isSponsored) {
    addLog('⊘ Sponsored video detected, skipping...');
    await skipToNextVideo();
    return;
  }

  // Step B: Wait countdown (only for non-sponsored videos)
  await startCountdown();
}

// Check if current video is sponsored
async function checkIfSponsored() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      return false;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_SPONSORED' });
    return response && response.isSponsored;
  } catch (error) {
    console.error('Error checking sponsored:', error);
    return false;
  }
}

// Skip to next video (for sponsored content)
async function skipToNextVideo() {
  if (!runState.isRunning) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      addLog('Error: Tab not found');
      await handleStopRun();
      return;
    }

    // Navigate to next video directly without waiting or liking
    const navSuccess = await navigateToNext(tab.id);

    if (!navSuccess) {
      addLog('Navigation failed after retries');
      await handleStopRun();
      return;
    }

    // Don't increment counter for skipped sponsored videos
    runState.navigationRetries = 0;
    await saveState();

    // Continue processing (will check if next video is also sponsored)
    await processNextVideo();
  } catch (error) {
    console.error('Error skipping sponsored video:', error);
    addLog(`Error: ${error.message}`);
    await handleStopRun();
  }
}

// Start countdown timer
async function startCountdown() {
  if (!runState.isRunning) return;

  // Generate random wait time
  const waitMin = runState.settings.waitMin;
  const waitMax = runState.settings.waitMax;
  const randomWait = randomInt(waitMin, waitMax);
  
  runState.countdown = randomWait;
  await saveState();

  console.log(`Starting countdown: ${randomWait} seconds`);

  // Create alarm for countdown
  await chrome.alarms.create('countdown', {
    delayInMinutes: 0,
    periodInMinutes: 1 / 60 // Fire every second
  });
}

// Alarm listener for countdown
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'countdown') {
    await handleCountdownTick();
  }
});

// Handle countdown tick
async function handleCountdownTick() {
  if (!runState.isRunning) {
    await chrome.alarms.clear('countdown');
    return;
  }

  runState.countdown--;
  await saveState();

  console.log(`Countdown: ${runState.countdown}`);

  // When countdown reaches 0, execute actions
  if (runState.countdown <= 0) {
    await chrome.alarms.clear('countdown');
    await executeVideoActions();
  }
}

// Execute actions on current video (like + navigate)
async function executeVideoActions() {
  if (!runState.isRunning) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      addLog('Error: Tab not found');
      await handleStopRun();
      return;
    }

    // Step C: Like current video
    await likeCurrentVideo(tab.id);

    // Small delay between actions
    await sleep(1000);

    // Step D: Navigate to next video
    const navSuccess = await navigateToNext(tab.id);

    if (!navSuccess) {
      addLog('Navigation failed after retries');
      await handleStopRun();
      return;
    }

    // Increment counter
    runState.currentCount++;
    runState.navigationRetries = 0;
    await saveState();

    addLog(`Progress: ${runState.currentCount} / ${runState.targetCount}`);

    // Continue to next video
    await processNextVideo();
  } catch (error) {
    console.error('Error executing video actions:', error);
    addLog(`Error: ${error.message}`);
    await handleStopRun();
  }
}

// Like current video
async function likeCurrentVideo(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'LIKE_CURRENT' });

    if (response.ok && response.liked) {
      addLog(`Video #${runState.currentCount + 1}: Liked`);
    } else if (response.ok && !response.liked && response.reason === 'already-liked') {
      addLog(`Video #${runState.currentCount + 1}: Already liked, skipped`);
    } else {
      addLog(`Video #${runState.currentCount + 1}: Like failed`);
    }
  } catch (error) {
    console.error('Error liking video:', error);
    addLog(`Video #${runState.currentCount + 1}: Like failed (${error.message})`);
  }
}

// Navigate to next video
async function navigateToNext(tabId) {
  let method = runState.settings.navigationMethod;

  // If RANDOM, pick a random method
  if (method === 'RANDOM') {
    const methods = ['CLICK_DOWN', 'KEYBOARD_ARROW', 'WHEEL_SCROLL'];
    method = methods[Math.floor(Math.random() * methods.length)];
    console.log('Random navigation method selected:', method);
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'NEXT_VIDEO',
      method: method
    });

    if (response.ok && response.newVideoId) {
      addLog('→ Next video');
      runState.lastVideoId = response.newVideoId;
      return true;
    } else {
      // Navigation failed
      runState.navigationRetries++;
      
      if (runState.navigationRetries < 2) {
        addLog('Navigation failed, retrying...');
        await sleep(2000);
        return navigateToNext(tabId);
      } else {
        addLog('Navigation failed after retries');
        return false;
      }
    }
  } catch (error) {
    console.error('Error navigating:', error);
    addLog(`Navigation error: ${error.message}`);
    return false;
  }
}

// Random integer generator (inclusive)
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize state on startup
initializeState();
