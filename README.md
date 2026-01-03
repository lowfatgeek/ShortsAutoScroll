# Auto YouTube Shorts Scroller & Liker

A Chrome extension that automates scrolling and liking YouTube Shorts videos with configurable settings and timing controls.

## ⚠️ Important Disclaimer

**This extension automates interactions with YouTube that may violate YouTube's Terms of Service.**

- Use this extension entirely at your own risk
- You accept full responsibility for any consequences
- Consequences may include account restrictions, suspensions, or permanent bans
- The developers assume no liability for any outcomes resulting from use of this extension
- This tool is provided for educational purposes only

## Features

- ✅ Automatic detection of YouTube Shorts pages
- 🎯 Configurable target number of videos to process
- ⏱️ Customizable wait times (random delays between min/max)
- 🔄 Multiple navigation methods:
  - Click Down Button (default)
  - Keyboard Arrow Down
  - Wheel Scroll
- 👍 Automatic liking of videos (skips already-liked videos)
- 📊 Real-time progress tracking and countdown timer
- 📝 Activity log showing all actions
- 💾 Settings persistence across sessions
- ⏸️ Stop automation at any time

## Installation

### Install from Source (Developer Mode)

1. **Download or Clone this Repository**
   ```bash
   git clone https://github.com/yourusername/shorts-auto-scroller.git
   cd shorts-auto-scroller
   ```

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or click the Extensions icon → "Manage Extensions"

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load Unpacked Extension**
   - Click "Load unpacked" button
   - Select the extension directory (the folder containing `manifest.json`)

5. **Verify Installation**
   - The extension icon should appear in your Chrome toolbar
   - If not visible, click the Extensions icon (puzzle piece) and pin it

## How to Use

### Step 1: Navigate to YouTube Shorts

1. Open YouTube and navigate to any Shorts video
2. URL should look like: `https://www.youtube.com/shorts/<video-id>`

### Step 2: Open Extension

1. Click the extension icon in your Chrome toolbar
2. On first use, read and accept the disclaimer by clicking "I Understand"

### Step 3: Configure Settings

The extension provides the following settings:

| Setting | Description | Default | Validation |
|---------|-------------|---------|------------|
| **Target Videos** | Number of videos to process | 20 | Must be ≥ 1 |
| **Wait Min (seconds)** | Minimum wait time per video | 15 | Must be ≥ 1 |
| **Wait Max (seconds)** | Maximum wait time per video | 30 | Must be ≥ Wait Min |
| **Navigation Method** | How to navigate to next video | Click Down Button | See options below |
| **Skip already liked** | Skip videos that are already liked | Checked | Checkbox |

#### Navigation Methods

- **Click Down Button** (Recommended): Simulates clicking the "Next" button
- **Keyboard Arrow Down**: Sends keyboard arrow down event
- **Wheel Scroll**: Scrolls the page by viewport height

### Step 4: Start Automation

1. Ensure detection status shows "✅ YouTube Shorts detected"
2. Click the **Start** button
3. The extension will:
   - Wait a random time between Wait Min and Wait Max
   - Like the current video (if not already liked)
   - Navigate to the next video
   - Repeat until target count is reached

### Step 5: Monitor Progress

- **Progress**: Shows current/target count (e.g., "5 / 20")
- **Next action in**: Countdown timer showing seconds until next action
- **Activity Log**: Displays recent actions and events

### Step 6: Stop Automation (Optional)

- Click the **Stop** button at any time to halt automation
- Countdown and all timers will be cancelled immediately

## Settings Explanation

### Wait Times

The extension uses random wait times to simulate human-like behavior:
- Each video gets a random wait duration between `Wait Min` and `Wait Max`
- Example: With Min=15 and Max=30, each video might wait 18s, 26s, 22s, etc.
- Longer wait times are more conservative and may reduce detection risk

### Navigation Methods

Different methods work better on different systems or network conditions:

1. **Click Down Button** (Default)
   - Most reliable method
   - Simulates actual user click on navigation control
   - Fallback: If button not found, uses scroll method

2. **Keyboard Arrow Down**
   - Fast and lightweight
   - Works when keyboard shortcuts are enabled
   - May not work if Shorts controls are changed

3. **Wheel Scroll**
   - Universal fallback method
   - Scrolls viewport height to trigger next video
   - Works on most page layouts

**Tip**: If one method consistently fails, try a different navigation method.

### Skip Already Liked Videos

When enabled (default):
- Extension checks if video is already liked before clicking
- Skipped videos still count toward the target
- Log shows "Already liked, skipped"

When disabled:
- Extension will attempt to like all videos
- Already-liked videos won't be un-liked (no action taken)

## Activity Log Messages

| Message | Meaning |
|---------|---------|
| `Starting automation: N videos` | Automation has started |
| `Video #X: Liked` | Video was successfully liked |
| `Video #X: Already liked, skipped` | Video was already liked, no action taken |
| `Video #X: Like failed` | Failed to find or click like button |
| `→ Next video` | Successfully navigated to next video |
| `Navigation failed, retrying...` | Navigation failed, will retry |
| `Progress: X / N` | Current progress update |
| `✓ Completed N videos` | Target reached, automation complete |
| `⊗ Stopped by user` | User clicked Stop button |

## Troubleshooting

### Extension Not Detecting Shorts Page

**Symptoms**: Status shows "❌ Not on Shorts page"

**Solutions**:
1. Ensure URL contains `/shorts/` (e.g., `youtube.com/shorts/abc123`)
2. Refresh the page and reopen the extension popup
3. Try navigating to a different Shorts video
4. Check that content script is allowed to run (no ad blockers interfering)

### Start Button Disabled

**Causes**:
- Not on a valid YouTube Shorts page
- Content script failed to load

**Solutions**:
1. Navigate to a YouTube Shorts video
2. Refresh the page
3. Reopen the extension popup
4. Check browser console for errors (F12 → Console tab)

### Like Button Not Found

**Symptoms**: Log shows "Like failed" repeatedly

**Solutions**:
1. Check if YouTube layout has changed
2. Wait a few seconds for page to fully load before starting
3. Try on a different Shorts video
4. Report the issue with browser console logs

### Navigation Not Working

**Symptoms**: Extension gets stuck on same video

**Solutions**:
1. Try a different navigation method in settings
2. Ensure YouTube Shorts is not in Theater Mode or other special view
3. Check network connection (slow loading may prevent navigation)
4. Try manually navigating to next video, then restart automation

### Extension Stops Unexpectedly

**Possible Causes**:
- Tab was closed or navigated away
- YouTube changed page structure
- Network connectivity issues
- Service worker terminated (rare)

**Solutions**:
1. Check Activity Log for error messages
2. Reopen extension popup and click Start again
3. Try reducing Wait Max time to keep service worker active
4. Check browser console for error messages

## Technical Details

### Architecture

- **Manifest V3**: Modern Chrome extension architecture
- **Service Worker**: Background orchestration and state management
- **Content Script**: DOM interactions on YouTube pages
- **Chrome APIs Used**:
  - `chrome.storage.local`: Settings and state persistence
  - `chrome.tabs`: Tab management and messaging
  - `chrome.alarms`: Reliable countdown timers
  - `chrome.runtime`: Inter-component messaging

### Permissions

- `storage`: Save settings and state
- `activeTab`: Access current tab information
- `tabs`: Send messages to content script
- `alarms`: Persistent timers for countdown
- `host_permissions` (`youtube.com/*`): Run content script on YouTube

### Privacy

- **No data collection**: Extension does not collect, store, or transmit any user data
- **No analytics**: No tracking or usage analytics
- **Local storage only**: All settings stored locally in your browser
- **No external servers**: Extension operates entirely client-side

## Limitations

- Only works on YouTube Shorts pages (not regular YouTube videos)
- Requires active tab to remain on YouTube Shorts
- May fail if YouTube updates page structure or controls
- Cannot bypass YouTube's rate limiting or API restrictions
- No guarantee of continued functionality if YouTube changes policies

## Development

### Project Structure

```
shorts-auto-scroller/
├── manifest.json          # Extension manifest (Manifest V3)
├── popup.html            # Popup interface HTML
├── popup.css             # Popup styling
├── popup.js              # Popup logic and UI control
├── content_script.js     # YouTube page DOM interactions
├── service_worker.js     # Background orchestration
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            # This file
```

### Building from Source

No build process required. The extension runs directly from source files.

### Contributing

This is an educational project. Contributions are welcome for:
- Bug fixes
- Improved YouTube DOM detection
- Better error handling
- UI improvements

**Note**: Do not contribute features that:
- Violate YouTube policies more aggressively
- Add data collection or tracking
- Implement anti-detection or stealth features

## License

This project is provided as-is for educational purposes. Use at your own risk.

## Support

For issues, questions, or feature requests:
1. Check the Troubleshooting section above
2. Review browser console logs (F12 → Console)
3. Open an issue on the project repository

## Changelog

### Version 1.0.0 (Initial Release)
- ✅ YouTube Shorts detection
- ✅ Configurable automation settings
- ✅ Multiple navigation methods
- ✅ Automatic liking with skip logic
- ✅ Real-time progress and countdown
- ✅ Activity logging
- ✅ Settings persistence
- ✅ Stop/start controls

---

**Remember**: Use responsibly and at your own risk. Automated interactions may violate platform policies.
