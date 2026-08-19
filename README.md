# AI Translate

A Firefox extension for translating selected text with AI via [OpenRouter](https://openrouter.ai). Right-click any selected text and choose **Translate selection** — the translation streams into a separate popup window, without modifying the page.

## Features

- **Context menu** — select text on any page, right-click → **Translate selection**
- **Streaming output** — translation appears live, token by token (SSE from OpenRouter)
- **Non-invasive** — results show in a popup window; the page is never touched
- **Copy button** — copy the full translation with one click
- **Configurable settings** — target language, API key, and model

## Settings

Open **AI Translate** in `about:addons` → **Preferences** (or right-click → Settings from the popup) to configure:

| Setting | Description |
|---------|-------------|
| **Target language** | The AI auto-detects the source and translates into this language (English, Indonesian, Chinese, Japanese, Korean, Spanish, French, German, and more) |
| **OpenRouter API key** | `sk-or-v1-...` — stored locally in your browser. Get one at [openrouter.ai/keys](https://openrouter.ai/keys) |
| **AI model** | Presets like `openrouter/free` (default, auto-selects a free model) and DeepSeek V4 Flash, or choose **Custom…** to type any OpenRouter model ID |

## Installation (temporary)

1. Open `about:debugging#/runtime/this-firefox` in Firefox
2. Click **Load Temporary Add-on**
3. Select `manifest.json` from this repo
4. Open Settings, paste your API key, pick a language and model

> For permanent installation, sign and submit via [addons.mozilla.org](https://addons.mozilla.org) or use `web-ext`:

```bash
npx web-ext run   # run in a temporary Firefox profile
npx web-ext build # package the extension
```

## Requirements

- Firefox 140+ (desktop)
- An OpenRouter account and API key (free models work with no credits; free accounts are rate-limited to ~50 requests/day)

## Files

```
manifest.json      MV3 manifest
background.js      Context menu + popup window
translate.html/css/js  Streaming translation popup
options.html/css/js    Settings page
icons/icon.svg     Extension icon
```