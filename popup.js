// DOM Elements
const disclaimerEl = document.getElementById('disclaimer');
const mainContentEl = document.getElementById('mainContent');
const acceptDisclaimerBtn = document.getElementById('acceptDisclaimer');
const detectionStatusEl = document.getElementById('detectionStatus');
const statusIconEl = document.getElementById('statusIcon');
const statusTextEl = document.getElementById('statusText');
const targetCountInput = document.getElementById('targetCount');
const waitMinInput = document.getElementById('waitMin');
const waitMaxInput = document.getElementById('waitMax');
const navigationMethodSelect = document.getElementById('navigationMethod');
const skipAlreadyLikedCheckbox = document.getElementById('skipAlreadyLiked');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const progressText = document.getElementById('progressText');
const countdownText = document.getElementById('countdownText');
const logContainer = document.getElementById('logContainer');

// State
let currentTab = null;
let isDetected = false;
let statusUpdateInterval = null;

// Initialize popup
async function init() {
  // Check if disclaimer was accepted
  const { disclaimerAccepted } = await chrome.storage.local.get('disclaimerAccepted');
  
  if (disclaimerAccepted) {
    showMainContent();
  } else {
    disclaimerEl.style.display = 'block';
  }

  // Load saved settings
  await loadSettings();

  // Check detection status
  await checkDetection();

  // Setup event listeners
  setupEventListeners();

  // Start status update loop
  startStatusUpdateLoop();
}

// Show main content after disclaimer acceptance
function showMainContent() {
  disclaimerEl.style.display = 'none';
  mainContentEl.style.display = 'block';
}

// Accept disclaimer
acceptDisclaimerBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ disclaimerAccepted: true });
  showMainContent();
  await checkDetection();
});

// Load settings from storage
async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  
  if (settings) {
    targetCountInput.value = settings.targetCount || 20;
    waitMinInput.value = settings.waitMin || 15;
    waitMaxInput.value = settings.waitMax || 30;
    navigationMethodSelect.value = settings.navigationMethod || 'RANDOM';
    skipAlreadyLikedCheckbox.checked = settings.skipAlreadyLiked !== false;
  }
}

// Save settings to storage
async function saveSettings() {
  const settings = {
    targetCount: parseInt(targetCountInput.value),
    waitMin: parseInt(waitMinInput.value),
    waitMax: parseInt(waitMaxInput.value),
    navigationMethod: navigationMethodSelect.value,
    skipAlreadyLiked: skipAlreadyLikedCheckbox.checked
  };

  await chrome.storage.local.set({ settings });
}

// Setup event listeners
function setupEventListeners() {
  // Save settings on change
  targetCountInput.addEventListener('change', saveSettings);
  waitMinInput.addEventListener('change', saveSettings);
  waitMaxInput.addEventListener('change', saveSettings);
  navigationMethodSelect.addEventListener('change', saveSettings);
  skipAlreadyLikedCheckbox.addEventListener('change', saveSettings);

  // Control buttons
  startBtn.addEventListener('click', handleStart);
  stopBtn.addEventListener('click', handleStop);
  resetBtn.addEventListener('click', handleReset);
}

// Check if current tab is YouTube Shorts
async function checkDetection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    if (!tab || !tab.url) {
      updateDetectionStatus(false, 'Unable to detect tab');
      return;
    }

    // Check URL pattern
    const isShortsUrl = tab.url.includes('youtube.com/shorts/');

    if (!isShortsUrl) {
      updateDetectionStatus(false, 'Not on Shorts page');
      return;
    }

    // Try to verify with content script
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_READY' });
      
      if (response && response.ready) {
        updateDetectionStatus(true, 'YouTube Shorts detected');
      } else {
        updateDetectionStatus(false, 'Shorts page not ready');
      }
    } catch (error) {
      // Content script might not be loaded - try to inject it
      console.log('Content script not responding, attempting to inject...');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content_script.js']
        });
        
        // Wait a moment then verify
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_READY' });
        if (response && response.ready) {
          updateDetectionStatus(true, 'YouTube Shorts detected');
        } else {
          updateDetectionStatus(false, 'Shorts page not ready');
        }
      } catch (injectError) {
        console.error('Failed to inject content script:', injectError);
        updateDetectionStatus(false, 'Failed to load extension on page');
      }
    }
  } catch (error) {
    console.error('Detection error:', error);
    updateDetectionStatus(false, 'Detection failed');
  }
}

// Update detection status UI
function updateDetectionStatus(detected, message) {
  isDetected = detected;

  if (detected) {
    detectionStatusEl.classList.remove('not-detected');
    detectionStatusEl.classList.add('detected');
    statusIconEl.textContent = '✅';
    statusTextEl.textContent = message || 'YouTube Shorts detected';
    startBtn.disabled = false;
  } else {
    detectionStatusEl.classList.remove('detected');
    detectionStatusEl.classList.add('not-detected');
    statusIconEl.textContent = '❌';
    statusTextEl.textContent = message || 'Not on Shorts page';
    startBtn.disabled = true;
  }
}

// Validate settings
function validateSettings() {
  const targetCount = parseInt(targetCountInput.value);
  const waitMin = parseInt(waitMinInput.value);
  const waitMax = parseInt(waitMaxInput.value);

  if (targetCount < 1) {
    alert('Target count must be at least 1');
    return false;
  }

  if (waitMin < 1) {
    alert('Wait Min must be at least 1 second');
    return false;
  }

  if (waitMax < waitMin) {
    alert('Wait Max must be greater than or equal to Wait Min');
    return false;
  }

  return true;
}

// Handle start button click
async function handleStart() {
  if (!isDetected) {
    addLog('Cannot start: Not on Shorts page', 'error');
    return;
  }

  if (!validateSettings()) {
    return;
  }

  // Save settings
  await saveSettings();

  // Get current settings
  const { settings } = await chrome.storage.local.get('settings');

  // Send START_RUN message to service worker
  try {
    await chrome.runtime.sendMessage({
      type: 'START_RUN',
      settings: settings
    });

    addLog('Starting automation...', 'info');
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    console.error('Error starting:', error);
    addLog('Failed to start: ' + error.message, 'error');
  }
}

// Handle stop button click
async function handleStop() {
  try {
    await chrome.runtime.sendMessage({ type: 'STOP_RUN' });
    addLog('Stopped by user', 'info');
    startBtn.disabled = false;
    stopBtn.disabled = true;
  } catch (error) {
    console.error('Error stopping:', error);
    addLog('Failed to stop: ' + error.message, 'error');
  }
}

// Handle reset button click
async function handleReset() {
  try {
    // Stop any running automation
    await chrome.runtime.sendMessage({ type: 'RESET_EXTENSION' });
    
    // Clear logs in UI
    logContainer.innerHTML = '<div class="log-entry">Extension reset. Ready to start...</div>';
    
    // Reset progress display
    progressText.textContent = '0 / 20';
    countdownText.textContent = '--';
    
    // Re-inject content script and re-detect
    if (currentTab && currentTab.id) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['content_script.js']
        });
        
        // Wait a moment for script to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (injectError) {
        console.log('Could not inject content script:', injectError);
      }
    }
    
    // Re-run detection
    await checkDetection();
    
    addLog('Extension reset complete', 'info');
  } catch (error) {
    console.error('Error resetting:', error);
    addLog('Failed to reset: ' + error.message, 'error');
  }
}

// Start status update loop
function startStatusUpdateLoop() {
  // Initial update
  updateStatus();

  // Update every second
  statusUpdateInterval = setInterval(updateStatus, 1000);
}

// Update status from storage
async function updateStatus() {
  try {
    const { runState } = await chrome.storage.local.get('runState');

    if (runState) {
      // Update progress
      progressText.textContent = `${runState.currentCount || 0} / ${runState.targetCount || 0}`;

      // Update countdown
      if (runState.isRunning && runState.countdown > 0) {
        countdownText.textContent = `${runState.countdown}s`;
      } else if (runState.isRunning) {
        countdownText.textContent = 'Processing...';
      } else {
        countdownText.textContent = '--';
      }

      // Update button states
      if (runState.isRunning) {
        startBtn.disabled = true;
        stopBtn.disabled = false;
      } else {
        startBtn.disabled = !isDetected;
        stopBtn.disabled = true;
      }

      // Update logs
      if (runState.lastLogs && runState.lastLogs.length > 0) {
        updateLogs(runState.lastLogs);
      }
    }
  } catch (error) {
    console.error('Error updating status:', error);
  }
}

// Update log display
function updateLogs(logs) {
  logContainer.innerHTML = '';
  
  logs.forEach(log => {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    // Determine log type based on content
    if (log.includes('Liked') || log.includes('Completed')) {
      logEntry.classList.add('success');
    } else if (log.includes('failed') || log.includes('error') || log.includes('Error')) {
      logEntry.classList.add('error');
    } else if (log.includes('→') || log.includes('Starting') || log.includes('Stopped')) {
      logEntry.classList.add('info');
    }
    
    logEntry.textContent = log;
    logContainer.appendChild(logEntry);
  });

  // Scroll to bottom
  logContainer.scrollTop = logContainer.scrollHeight;
}

// Add log entry
function addLog(message, type = 'info') {
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  logEntry.textContent = message;
  
  // Prepend to container
  if (logContainer.firstChild) {
    logContainer.insertBefore(logEntry, logContainer.firstChild);
  } else {
    logContainer.appendChild(logEntry);
  }

  // Keep only last 10 entries
  while (logContainer.children.length > 10) {
    logContainer.removeChild(logContainer.lastChild);
  }
}

// Cleanup on popup close
window.addEventListener('unload', () => {
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
  }
});

// Initialize
init();
