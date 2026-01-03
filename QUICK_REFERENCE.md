# Quick Reference Card

## 🚀 Installation
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `D:\PROJECTS\ShortsAutoScroll`

## ⚙️ Default Settings
- Target Videos: **20**
- Wait Min: **15 seconds**
- Wait Max: **30 seconds**
- Navigation: **Click Down Button**
- Skip Liked: **Yes**

## 🎯 How It Works
1. Wait random time (15-30s)
2. Like video (if not already liked)
3. Navigate to next video
4. Repeat until target reached

## 🔧 Navigation Methods
- **Click Down** - Clicks next button (recommended)
- **Keyboard Arrow** - Sends ArrowDown key
- **Wheel Scroll** - Scrolls viewport height

## 📊 Progress Indicators
- **Progress**: Current/Target (e.g., 5/20)
- **Countdown**: Seconds until next action
- **Activity Log**: Last 10 actions

## 🛑 Stop Automation
Click **Stop** button anytime to halt

## ⚠️ Requirements
- Must be on YouTube Shorts page
- URL must contain `/shorts/`
- Page must be fully loaded

## 🐛 Troubleshooting
| Issue | Solution |
|-------|----------|
| Start disabled | Navigate to Shorts page |
| Not detecting | Refresh page, reopen popup |
| Like fails | Wait for page to fully load |
| Nav stuck | Try different navigation method |

## 📝 Activity Log Messages
- `Liked` - Successfully liked video
- `Already liked, skipped` - Video was already liked
- `→ Next video` - Navigated successfully
- `✓ Completed N videos` - Target reached
- `⊗ Stopped by user` - Manually stopped

## ⚠️ Disclaimer
**Use at your own risk. May violate YouTube TOS.**

---

**Files**: 8 JS/HTML/CSS + manifest + icons  
**Size**: ~50 KB total  
**Version**: 1.0.0
