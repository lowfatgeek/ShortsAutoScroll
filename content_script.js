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

// Check if page is ready and is a valid Shorts page
function handleCheckReady(sendResponse) {
  try {
    const isShorts = window.location.pathname.includes('/shorts/');
    const hasVideo = document.querySelector('video') !== null;
    const hasLikeButton = findLikeButton() !== null;

    const ready = isShorts && hasVideo;

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
    likeButton.click();
    console.log('Liked video successfully');
    return { ok: true, liked: true };
  } catch (error) {
    console.error('Error clicking like button:', error);
    return { ok: false, error: 'CLICK_FAILED' };
  }
}

// Find like button in the DOM
function findLikeButton() {
  // Strategy 1: Find by aria-label containing "like"
  const buttons = document.querySelectorAll('button[aria-label]');
  
  for (const button of buttons) {
    const label = button.getAttribute('aria-label');
    if (label && label.toLowerCase().includes('like') && !label.toLowerCase().includes('dislike')) {
      // Make sure it's visible and in the Shorts action panel
      if (isElementVisible(button)) {
        return button;
      }
    }
  }

  // Strategy 2: Look for like button in Shorts-specific containers
  const containers = [
    '#actions',
    '#shorts-action-panel',
    '.ytd-shorts',
    '#actions-inner-container'
  ];

  for (const selector of containers) {
    const container = document.querySelector(selector);
    if (container) {
      const likeBtn = container.querySelector('button[aria-label*="like" i]');
      if (likeBtn && isElementVisible(likeBtn)) {
        return likeBtn;
      }
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
    const currentVideoId = extractVideoId();
    const result = await navigateToNext(method, currentVideoId);
    sendResponse(result);
  } catch (error) {
    console.error('Error navigating:', error);
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
    if (button && isElementVisible(button)) {
      try {
        button.click();
        console.log('Clicked down navigation button');
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
    // Scroll by viewport height
    window.scrollBy({
      top: window.innerHeight,
      behavior: 'smooth'
    });

    console.log('Scrolled by viewport height');
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
  // Look for "Sponsored" text in various locations
  const sponsoredSelectors = [
    // Common sponsored indicators
    '[class*="badge"]',
    '[class*="sponsor"]',
    '[class*="ad-badge"]',
    '.ytd-ad-slot-renderer',
    '#player-overlay',
    '.ytp-ad-module',
    '#shorts-player'
  ];

  // Check text content for "Sponsored"
  const pageText = document.body.innerText;
  if (pageText.includes('Sponsored')) {
    console.log('Found "Sponsored" text on page');
    return true;
  }

  // Check specific elements that might contain sponsored indicator
  for (const selector of sponsoredSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      if (el.textContent && el.textContent.includes('Sponsored')) {
        console.log('Found "Sponsored" in element:', selector);
        return true;
      }
    }
  }

  // Check for ad overlay or ad player elements
  const adIndicators = document.querySelectorAll('.ytp-ad-player-overlay, .ytp-ad-text, .ad-showing');
  if (adIndicators.length > 0) {
    console.log('Found ad indicator elements');
    return true;
  }

  return false;
}

// Notify that content script is ready
console.log('YouTube Shorts Auto Scroller: Ready');
