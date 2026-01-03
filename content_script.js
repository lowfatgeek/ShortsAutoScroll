// Content Script for YouTube Shorts Auto Scroller
console.log('YouTube Shorts Auto Scroller: Content script loaded');

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);

  switch (message.type) {
    case 'CHECK_READY':
      handleCheckReady(sendResponse);
      return true; // Keep channel open for async response

    case 'GET_VIDEO_ID':
      handleGetVideoId(sendResponse);
      return true;

    case 'LIKE_CURRENT':
      handleLikeCurrent(sendResponse);
      return true;

    case 'NEXT_VIDEO':
      handleNextVideo(message.method, sendResponse);
      return true;

    case 'CHECK_SPONSORED':
      handleCheckSponsored(sendResponse);
      return true;

    default:
      sendResponse({ error: 'Unknown message type' });
      return false;
  }
});

// Debug logger
function debugLog(message, data = null) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  const prefix = `[${timestamp}] [CS]`;
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

// SPOOF VISIBILITY API
// We inject a script into the main page context to overwrite the Visibility API
function injectVisibilitySpoofer() {
  const script = document.createElement('script');
  script.textContent = `
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    
    // Capture and stop visibilitychange events
    window.addEventListener('visibilitychange', (e) => {
      e.stopImmediatePropagation();
    }, true);
    
    // Monkey-patch requestAnimationFrame to work in background
    const originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      return setTimeout(() => callback(performance.now()), 16);
    };
    
    window.cancelAnimationFrame = (id) => {
      clearTimeout(id);
    };
    
    console.log('[Shorts Auto Scroller] Visibility API & RAF spoofer activated');
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// VIDEO KEEP-ALIVE & ANTI-THROTTLE
// Periodically check video and force layout updates to prevent background freezing
let keepAliveInterval = null;

function startVideoKeepAlive() {
  if (keepAliveInterval) clearInterval(keepAliveInterval);

  keepAliveInterval = setInterval(() => {
    // 1. Keep video playing
    const video = document.querySelector('video');
    if (video && video.paused && !video.ended) {
      console.log('Keep-alive: Forcing video play');
      video.play().catch(e => console.log('Keep-alive play failed:', e));
    }

    // 2. FORCE LAYOUT REFLOW (Anti-Throttle)
    // Accessing offsetHeight forces the browser to recalculate styles,
    // preventing it from optimizing away the background tab's rendering loop.
    // This is crucial when the extension is in a background window.
    const forceReflow = document.body.offsetHeight;

    // 3. Small invisible DOM mutation
    // Triggers the mutation observer pipeline, keeping the thread active
    let pixel = document.getElementById('anti-throttle-pixel');
    if (!pixel) {
      pixel = document.createElement('div');
      pixel.id = 'anti-throttle-pixel';
      pixel.style.position = 'absolute';
      pixel.style.top = '0';
      pixel.style.left = '0';
      pixel.style.width = '1px';
      pixel.style.height = '1px';
      pixel.style.opacity = '0.01';
      pixel.style.pointerEvents = 'none';
      document.body.appendChild(pixel);
    }
    // Toggle content to force paint
    pixel.textContent = pixel.textContent === '.' ? '..' : '.';

  }, 1000);
}

// AUDIO KEEP-ALIVE (The "Nuclear Option")
// Plays a silent sound to force the browser to treat this tab as a high-priority media page
// This prevents cross-profile background freezing.
function enableAudioKeepAlive() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const audioCtx = new AudioContext();

    // Create an oscillator (generates sound)
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // 440Hz

    // Create a gain node (volume control)
    const gainNode = audioCtx.createGain();
    // Set volume to almost zero but not exactly zero (some browsers optimize away 0)
    gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);

    // Connect oscillator -> gain -> destination (speakers)
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Start immediately
    oscillator.start();

    // Prevent garbage collection
    window._keepAliveAudio = { ctx: audioCtx, osc: oscillator, gain: gainNode };

    console.log('[Shorts Auto Scroller] Audio Keep-Alive Active (Silent Oscillator)');

    // Resume context if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
      const resume = () => {
        audioCtx.resume();
        document.removeEventListener('click', resume);
        document.removeEventListener('keydown', resume);
        document.removeEventListener('scroll', resume);
      };

      document.addEventListener('click', resume);
      document.addEventListener('keydown', resume);
      document.addEventListener('scroll', resume);
    }
  } catch (e) {
    console.error('Audio Keep-Alive failed:', e);
  }
}

// Inject immediately
injectVisibilitySpoofer();
startVideoKeepAlive();
enableAudioKeepAlive();

// Check if page is ready and is a valid Shorts page
function handleCheckReady(sendResponse) {
  try {
    const isShorts = window.location.pathname.includes('/shorts/');
    const hasVideo = document.querySelector('video') !== null;
    const hasLikeButton = findLikeButton() !== null;

    const ready = isShorts && hasVideo;

    debugLog('Check Ready:', { isShorts, hasVideo, hasLikeButton, ready });

    sendResponse({
      ready: ready,
      isShorts: isShorts,
      hasVideo: hasVideo,
      hasLikeButton: hasLikeButton
    });
  } catch (error) {
    console.error('Error checking ready:', error);
    sendResponse({ ready: false, error: error.message });
  }
}

// Get current video ID from URL
function handleGetVideoId(sendResponse) {
  try {
    const videoId = extractVideoId();
    sendResponse({ videoId: videoId });
  } catch (error) {
    console.error('Error getting video ID:', error);
    sendResponse({ videoId: null, error: error.message });
  }
}

// Extract video ID from URL
function extractVideoId() {
  const match = window.location.pathname.match(/\/shorts\/([^/?]+)/);
  return match ? match[1] : null;
}

// Handle like action
async function handleLikeCurrent(sendResponse) {
  try {
    const result = await likeCurrentVideo();
    sendResponse(result);
  } catch (error) {
    console.error('Error liking video:', error);
    sendResponse({ ok: false, error: error.message });
  }
}

// Like current video with retry logic
async function likeCurrentVideo(retryCount = 0) {
  const maxRetries = 3;

  // Find like button
  const likeButton = findLikeButton();
  debugLog('Like button found:', !!likeButton);

  if (!likeButton) {
    if (retryCount < maxRetries) {
      console.log(`Like button not found, retry ${retryCount + 1}/${maxRetries}`);
      await sleep(500);
      return likeCurrentVideo(retryCount + 1);
    }
    return { ok: false, error: 'LIKE_BUTTON_NOT_FOUND' };
  }

  // Check if already liked
  const ariaPressed = likeButton.getAttribute('aria-pressed');
  const isLiked = ariaPressed === 'true';

  if (isLiked) {
    console.log('Video already liked, skipping');
    return { ok: true, liked: false, reason: 'already-liked' };
  }

  // Click like button
  try {
    superClick(likeButton);
    console.log('Liked video successfully (Super Click)');
    return { ok: true, liked: true };
  } catch (error) {
    console.error('Error clicking like button:', error);
    return { ok: false, error: 'CLICK_FAILED: ' + error.message };
  }
}

// SUPER CLICK: Force-feeds events to elements that browser thinks are non-interactive
function superClick(element) {
  const eventOptions = { bubbles: true, cancelable: true, view: window };
  const mouseDown = new MouseEvent('mousedown', eventOptions);
  const mouseUp = new MouseEvent('mouseup', eventOptions);
  const click = new MouseEvent('click', eventOptions);

  element.dispatchEvent(mouseDown);
  element.dispatchEvent(mouseUp);
  element.dispatchEvent(click);
}

// Find like button in the DOM
function findLikeButton() {
  debugLog('Finding like button (First Button Strategy)...');

  // Strategy: The Like button is structurally the FIRST button in the action sidebar.
  // We target the active video's action panel and grab the first button element.
  const containerSelectors = [
    'ytd-reel-video-renderer[is-active] #actions', // Best: Active video only
    '#shorts-action-panel', // Legacy
    '#actions' // Fallback (might pick up next/prev video's actions if not careful)
  ];

  for (const selector of containerSelectors) {
    const container = document.querySelector(selector);
    if (container) {
      // Find the first button in this container
      const btn = container.querySelector('button');
      if (btn) {
        // Verify it's not a "Share" or "Comment" button by accident?
        // No, trusting the structure is safer for cross-language support right now.
        return btn;
      }
    }
  }

  // Fallback: Try searching for aria-label "like" or "suka" or generic
  // (In case the structural assumption fails totally)
  const buttons = document.querySelectorAll('button[aria-label]');
  for (const button of buttons) {
    const label = button.getAttribute('aria-label') || '';
    if (label.toLowerCase().includes('like') || // English
      label.toLowerCase().includes('suka') || // Indonesian
      label.toLowerCase().includes('thumb')) { // Description
      return button;
    }
  }

  return null;
}

// Check if element is visible
function isElementVisible(element) {
  if (!element) return false;

  const style = window.getComputedStyle(element);
  return style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0;
}

// Handle navigation to next video
async function handleNextVideo(method, sendResponse) {
  try {
    // Start navigation but don't wait for it to finish
    // We return 'true' immediately to acknowledge the command
    // The service worker will verify the URL change
    navigateToNext(method, extractVideoId());
    sendResponse({ ok: true });
  } catch (error) {
    console.error('Error executing navigation:', error);
    sendResponse({ ok: false, error: error.message });
  }
}

// Navigate to next video
async function navigateToNext(method, currentVideoId, retryCount = 0) {
  const maxRetries = 2;

  console.log(`Navigating using method: ${method}, retry: ${retryCount}`);

  // Execute navigation method
  let success = false;

  switch (method) {
    case 'CLICK_DOWN':
      success = await navigateByClickDown();
      break;
    case 'KEYBOARD_ARROW':
      success = await navigateByKeyboard();
      break;
    case 'WHEEL_SCROLL':
      success = await navigateByScroll();
      break;
    default:
      return { ok: false, error: 'INVALID_METHOD' };
  }

  if (!success) {
    console.log('Navigation method failed');
    return { ok: false, error: 'NAVIGATION_METHOD_FAILED' };
  }

  // Wait for navigation to complete
  await sleep(2000);

  // Verify video changed
  const newVideoId = extractVideoId();

  if (newVideoId && newVideoId !== currentVideoId) {
    console.log(`Navigation successful: ${currentVideoId} -> ${newVideoId}`);
    return { ok: true, newVideoId: newVideoId };
  }

  // Navigation failed, retry
  if (retryCount < maxRetries) {
    console.log(`Video ID unchanged, retrying... (${retryCount + 1}/${maxRetries})`);
    await sleep(1000);
    return navigateToNext(method, currentVideoId, retryCount + 1);
  }

  // Try fallback method
  if (retryCount >= maxRetries) {
    console.log('Trying fallback navigation method');
    const fallbackMethod = getFallbackMethod(method);
    if (fallbackMethod) {
      return navigateToNext(fallbackMethod, currentVideoId, 0);
    }
  }

  return { ok: false, error: 'NAVIGATION_FAILED' };
}

// Navigate by clicking down button
async function navigateByClickDown() {
  // Look for navigation buttons
  const selectors = [
    'button[aria-label*="Next" i]',
    'button[aria-label*="next" i]',
    '.navigation-button.down',
    '#navigation-button-down'
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector);
    // BLIND CLICK: We check if button exists, but skip visibility check
    // because background tabs often report size 0 or hidden visibility.
    if (button) {
      try {
        superClick(button);
        console.log('Clicked down navigation button (Super Click)');
        return true;
      } catch (error) {
        console.error('Error clicking navigation button:', error);
      }
    }
  }

  // Alternative: Simulate swipe gesture
  console.log('Navigation button not found, trying scroll fallback');
  return navigateByScroll();
}

// Navigate by keyboard event
async function navigateByKeyboard() {
  try {
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      which: 40,
      bubbles: true,
      cancelable: true
    });

    document.dispatchEvent(event);
    console.log('Dispatched ArrowDown keyboard event');
    return true;
  } catch (error) {
    console.error('Error dispatching keyboard event:', error);
    return false;
  }
}

// Navigate by wheel scroll
async function navigateByScroll() {
  try {
    console.log('Attempting scroll navigation...');

    // BLIND SCROLL fallback
    // If window height is reported as 0 (background tab), default to 800px
    let windowH = window.innerHeight;
    if (windowH < 100) {
      console.log('Window height suspiciously small, using default 800px');
      windowH = 800;
    }

    // Strategy 1: Window scroll (standard)
    window.scrollBy({
      top: windowH,
      behavior: 'auto'
    });

    // Strategy 2: Target specific Shorts containers
    // Sometimes the window scroll doesn't affect the shorts container directly
    const containers = [
      document.getElementById('shorts-container'),
      document.getElementById('shorts-inner-container'),
      document.querySelector('ytd-shorts')
    ];

    for (const container of containers) {
      if (container) {
        container.scrollBy({
          top: windowH,
          behavior: 'auto'
        });
      }
    }

    console.log('Executed scroll commands');
    return true;
  } catch (error) {
    console.error('Error scrolling:', error);
    return false;
  }
}

// Get fallback navigation method
function getFallbackMethod(currentMethod) {
  const fallbackMap = {
    'CLICK_DOWN': 'KEYBOARD_ARROW',
    'KEYBOARD_ARROW': 'WHEEL_SCROLL',
    'WHEEL_SCROLL': 'CLICK_DOWN'
  };

  return fallbackMap[currentMethod] || null;
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle check sponsored
function handleCheckSponsored(sendResponse) {
  try {
    const isSponsored = checkIfSponsored();
    console.log('Sponsored check result:', isSponsored);
    sendResponse({ isSponsored: isSponsored });
  } catch (error) {
    console.error('Error checking sponsored:', error);
    sendResponse({ isSponsored: false, error: error.message });
  }
}

// Check if current video is sponsored/ad
function checkIfSponsored() {
  // Only check within the shorts player overlay area - not the entire page
  const shortsContainers = [
    '#shorts-player',
    'ytd-reel-video-renderer[is-active]',
    '.reel-player-overlay-renderer',
    'ytd-shorts',
    '#player-container'
  ];

  for (const selector of shortsContainers) {
    const container = document.querySelector(selector);
    if (!container) continue;

    // Look for sponsored badge/label elements within the container
    // The sponsored text appears in a badge near channel info
    const badgeSelectors = [
      '[class*="badge"]',
      '[class*="sponsor"]',
      '.ytd-channel-name',
      '.reel-player-header-renderer',
      '.metadata-container',
      '[class*="channel"]',
      '[class*="meta"]'
    ];

    for (const badgeSelector of badgeSelectors) {
      const badges = container.querySelectorAll(badgeSelector);
      for (const badge of badges) {
        const text = badge.textContent || '';
        // Check for exact "Sponsored" word (not just containing it)
        if (/\bSponsored\b/i.test(text)) {
          console.log('Found "Sponsored" badge in:', selector, badgeSelector);
          return true;
        }
      }
    }
  }

  // Check for YouTube ad-specific elements
  const adElements = document.querySelectorAll(
    'ytd-ad-slot-renderer, ' +
    'ytd-promoted-sparkles-web-renderer, ' +
    '.ytp-ad-overlay-container, ' +
    '.ytp-ad-player-overlay-instream-info'
  );

  if (adElements.length > 0) {
    // Verify the ad element is within or near the current shorts player
    for (const adEl of adElements) {
      if (adEl.offsetParent !== null) { // Check if visible
        console.log('Found visible ad element');
        return true;
      }
    }
  }

  return false;
}

// Notify that content script is ready
console.log('YouTube Shorts Auto Scroller: Ready');
