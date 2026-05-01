# AlphaAI — Wolfram Alpha–style AI Interface

A static single-page app styled after Wolfram Alpha, powered by **GPT-4o** via the OpenAI API.

## Features

- **Wolfram Alpha aesthetic** — dark charcoal theme, star logo, amber/orange wordmark, purple-glowing search box, dark result pods
- **Structured responses** — GPT-4o is prompted to return `## Section` headings; each section renders as its own pod
- **KaTeX math rendering** — LaTeX expressions (`$...$` and `$$...$$`) are rendered beautifully in the browser
- **Markdown support** — tables, code blocks, bold/italic, lists all styled
- **Client-side API key** — stored in `localStorage`; never leaves your browser
- **Example queries** — click to populate and run instantly
- **No build step** — open `index.html` directly or serve with any static host

## Setup

### 1. Get an OpenAI API key

Sign in at [platform.openai.com](https://platform.openai.com) → API keys → Create new key.

### 2. Run locally

**Option A — just open the file:**
```
open index.html
```
(Works in most browsers. Chrome may block `file://` fetch requests; use Option B if so.)

**Option B — serve with Python:**
```bash
python -m http.server 8080
# then open http://localhost:8080
```

**Option C — serve with Node (npx):**
```bash
npx serve .
```

### 3. Enter your API key

Click **⚙ API Key** in the top-right corner, paste your `sk-…` key, and click **Save**.  
The key is stored in `localStorage` and is only used for direct calls to `api.openai.com`.

### 4. Search

Type a query (or click an example) and press **Enter** or the search button.

## Hosting on GitHub Pages

1. Push the three files (`index.html`, `style.css`, `app.js`) to a GitHub repository.
2. Go to **Settings → Pages → Source** and select the branch/root.
3. Your site will be live at `https://<username>.github.io/<repo>/`.

Each visitor enters their own API key — no server needed.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure and CDN script tags |
| `style.css` | All styling (Wolfram Alpha dark theme) |
| `app.js` | Search logic, OpenAI API call, markdown+math rendering |
| `README.md` | This file |

## Dependencies (all via CDN, no install needed)

| Library | Purpose |
|---------|---------|
| [KaTeX 0.16](https://katex.org) | LaTeX math rendering |
| [marked 9](https://marked.js.org) | Markdown → HTML |

## Notes

- The system prompt instructs GPT-4o to respond with `## Heading` sections — this is what creates the individual pods.
- Math must be written in LaTeX (`$x^2$`, `$$\int_0^1 x\,dx$$`) for KaTeX to render it. GPT-4o usually does this automatically.
- The API key is **never sent anywhere except `api.openai.com`** directly from your browser.
