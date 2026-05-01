# AlphaAI — Wolfram Alpha–style Claude Interface

A static single-page app styled after Wolfram Alpha, powered by **Claude** (Anthropic API).

---

## Why a Cloudflare Worker is required

Browsers enforce a security rule called **CORS** that blocks direct calls to `api.anthropic.com`
from a web page. The fix is a tiny free proxy that sits in the middle:

```
Browser → Cloudflare Worker → api.anthropic.com
```

The Worker adds the missing CORS headers and forwards your request. Your API key is passed
through in the header and never stored anywhere — not in the Worker, not on any server.

---

## Setup (one-time, ~5 minutes total)

### Step 1 — Deploy the Cloudflare Worker (free)

1. Go to **[workers.cloudflare.com](https://workers.cloudflare.com)** and sign up / log in (free account, no credit card needed).
2. Click **"Create application"** → **"Create Worker"**.
3. Delete all the default code in the editor.
4. Copy the entire contents of **`worker.js`** (in this repo) and paste it in.
5. Click **"Deploy"**.
6. Copy the Worker URL shown at the top — it looks like:
   ```
   https://alphaai-proxy.YOUR-NAME.workers.dev
   ```

### Step 2 — Get a Claude API key

1. Go to **[console.anthropic.com](https://console.anthropic.com)** → API Keys → **Create Key**.
2. Copy the key — it starts with `sk-ant-…`.

### Step 3 — Configure the site

1. Open the site (locally or on GitHub Pages).
2. Click **⚙ API Key** in the top-right corner.
3. Paste your **Claude API key** in the first box.
4. Paste your **Cloudflare Worker URL** in the second box.
5. Click **Save**.

Both values are stored in your browser's `localStorage` and never leave your device
(except the API key, which goes to your own Worker, which forwards it to Anthropic).

---

## Running locally

```bash
# Option A — Python
python -m http.server 8080
# open http://localhost:8080

# Option B — Node
npx serve .
```

---

## Hosting on GitHub Pages

1. Push this repo to GitHub (public or private).
2. Go to **Settings → Pages → Source: Deploy from branch → `main` / `/ (root)`** → Save.
3. Your site will be live at `https://YOUR_USERNAME.github.io/REPO_NAME/` in ~30 seconds.
4. Open it, click ⚙, and enter your API key + Worker URL once — done.

To push for the first time:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `style.css` | Wolfram Alpha dark theme |
| `app.js` | Search logic, Claude API call via proxy, markdown+KaTeX rendering |
| `worker.js` | Paste this into a Cloudflare Worker to enable CORS |
| `README.md` | This file |

## Dependencies (CDN, no install)

| Library | Purpose |
|---------|---------|
| [KaTeX 0.16](https://katex.org) | LaTeX math rendering |
| [marked 9](https://marked.js.org) | Markdown → HTML |
