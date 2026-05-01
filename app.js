/* ══════════════════════ AlphaAI — app.js ══════════════════════ */

// Direct Anthropic URL — only works server-side.
// Browser requests go through the Cloudflare Worker proxy URL stored in localStorage.
const ANTHROPIC_DIRECT = 'https://api.anthropic.com/v1/messages';
const MODEL            = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `\
You are a precise computational knowledge engine, similar to Wolfram Alpha.
When a user submits a query, respond in structured Markdown using ## headings for every distinct result section.
Never use conversational filler ("Sure!", "Great question!", "Of course!").
Format like a reference tool: concise, exact, and informative.

Always include "## Input interpretation" as the first section to clarify what was asked.

For MATH queries use sections like:
## Input interpretation
## Exact result
## Decimal approximation
## Step-by-step solution
## Alternate forms
## Properties

For SCIENCE / PHYSICS queries use sections like:
## Input interpretation
## Result
## In SI units
## Additional details

For CONVERSION queries use sections like:
## Input interpretation
## Result
## Other common units

For FACTUAL / GENERAL queries use sections like:
## Input interpretation
## Result
## Details
## Related facts

Formatting rules:
- Use LaTeX with $...$ for inline math and $$...$$ for display/block math.
- Use exact symbolic forms when possible (e.g. $$\\frac{5}{2}$$ not just 2.5).
- Use Markdown tables when comparing multiple values.
- Keep each section to 1–6 lines. No padding prose.
- Never use level-1 headings (#). Only ## for sections.`;

/* ── DOM refs ── */
const queryInput    = document.getElementById('queryInput');
const searchBtn     = document.getElementById('searchBtn');
const clearBtn      = document.getElementById('clearBtn');
const heroSection   = document.getElementById('heroSection');
const resultsArea   = document.getElementById('resultsArea');
const loadingArea   = document.getElementById('loadingArea');
const errorArea     = document.getElementById('errorArea');
const errorMsg      = document.getElementById('errorMsg');
const podsContainer = document.getElementById('podsContainer');
const assumingQuery = document.getElementById('assumingQuery');
const assumingDomain= document.getElementById('assumingDomain');
// newQueryBtn removed — navigation handled by exchangeNav prev/next
const sidebarStep   = document.getElementById('sidebarStepText');
const settingsBtn   = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const apiKeyInput   = document.getElementById('apiKeyInput');
const saveSettings  = document.getElementById('saveSettings');
const cancelSettings= document.getElementById('cancelSettings');
const promoBanner   = document.getElementById('promoBanner');
const promoClose    = document.getElementById('promoClose');
const newChatBtn      = document.getElementById('newChatBtn');
const sessionBar      = document.getElementById('sessionBar');
const sessionCount    = document.getElementById('sessionCount');
const sessionClearBtn = document.getElementById('sessionClearBtn');
const exchangeNav     = document.getElementById('exchangeNav');
const navPrev         = document.getElementById('navPrev');
const navNext         = document.getElementById('navNext');
const navCount        = document.getElementById('navCount');

/* ══════════════════════ CHAT STATE ══════════════════════ */
// Full conversation sent to Claude on every request
let chatHistory = [];

// Each exchange: { query, markdown } — one entry per user turn
let exchanges   = [];
let currentPage = 0; // index into exchanges[]

/* ── Navigation ── */
function updateNav() {
  const total = exchanges.length;
  if (total <= 1) {
    exchangeNav.hidden = true;
    return;
  }
  exchangeNav.hidden   = false;
  navCount.textContent = `${currentPage + 1} / ${total}`;
  navPrev.disabled     = currentPage === 0;
  navNext.disabled     = currentPage === total - 1;
}

function displayPage(index) {
  currentPage = index;
  const { query, markdown } = exchanges[index];

  assumingQuery.textContent  = query;
  assumingDomain.textContent = inferDomain(query);

  const pods = parsePods(markdown);

  // Update sidebar
  const stepPod = pods.find(p =>
    !p.title.toLowerCase().includes('input') &&
    !p.title.toLowerCase().includes('interpretation')
  );
  sidebarStep.textContent = stepPod
    ? plainText(stepPod.content).slice(0, 160) + (stepPod.content.length > 160 ? '…' : '')
    : 'See the result pods on the left.';
  podsContainer.innerHTML = '';
  pods.forEach((pod, i) => {
    const el = document.createElement('div');
    el.className = 'pod';
    el.style.animationDelay = `${i * 0.04}s`;
    el.innerHTML = `
      <div class="pod-header">
        <span class="pod-header-bar"></span>
        ${escHtml(pod.title.toUpperCase())}
      </div>
      <div class="pod-body">${renderMarkdown(pod.content)}</div>`;
    podsContainer.appendChild(el);
  });

  updateNav();

  if (window.renderMathInElement) {
    requestAnimationFrame(() => {
      renderMathInElement(podsContainer, {
        delimiters: [
          { left: '$$', right: '$$', display: true  },
          { left: '$',  right: '$',  display: false },
          { left: '\\[', right: '\\]', display: true  },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    });
  }
}

navPrev.addEventListener('click', () => {
  if (currentPage > 0) displayPage(currentPage - 1);
});

navNext.addEventListener('click', () => {
  if (currentPage < exchanges.length - 1) displayPage(currentPage + 1);
});

/* ── Session bar ── */
function updateSessionBar() {
  const count = exchanges.length;
  if (count === 0) { sessionBar.hidden = true; return; }
  sessionBar.hidden = false;
  sessionCount.textContent = `${count} exchange${count !== 1 ? 's' : ''}`;
}

/* ── New chat ── */
function startNewChat() {
  chatHistory  = [];
  exchanges    = [];
  currentPage  = 0;
  podsContainer.innerHTML = '';
  exchangeNav.hidden = true;
  updateSessionBar();
  heroSection.classList.remove('hero--compact');
  resultsArea.hidden = true;
  loadingArea.hidden = true;
  errorArea.hidden   = true;
  queryInput.value   = '';
  queryInput.focus();
}

newChatBtn.addEventListener('click', () => {
  if (exchanges.length === 0) return;
  if (confirm('Start a new chat? This will clear the current conversation.')) {
    startNewChat();
  }
});

sessionClearBtn.addEventListener('click', () => {
  if (confirm('Start a new chat? This will clear the current conversation.')) {
    startNewChat();
  }
});

/* ══════════════════════ CAMERA ══════════════════════ */
const cameraBtn      = document.getElementById('cameraBtn');
const cameraModal    = document.getElementById('cameraModal');
const cameraTitle    = document.getElementById('cameraTitle');
const cameraVideo    = document.getElementById('cameraVideo');
const cameraCanvas   = document.getElementById('cameraCanvas');
const cameraViewport = document.getElementById('cameraViewport');
const cameraPreview  = document.getElementById('cameraPreview');
const capturedImg    = document.getElementById('capturedImg');
const cropContainer  = document.getElementById('cropContainer');
const cropOverlay    = document.getElementById('cropOverlay');
const cropSelection  = document.getElementById('cropSelection');
const captureBtn     = document.getElementById('captureBtn');
const retakeBtn      = document.getElementById('retakeBtn');
const usePhotoBtn    = document.getElementById('usePhotoBtn');
const attachedBar    = document.getElementById('attachedBar');
const attachedThumb  = document.getElementById('attachedThumb');
const removeImageBtn = document.getElementById('removeImageBtn');

let cameraStream = null;
let pendingImage = null;

/* ── Crop state ── */
let cropRect = null;   // { x, y, w, h } in container pixels, set after drag
let cropStart = null;  // { x, y } where the drag began
let isCropDragging = false;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function contRect() { return cropContainer.getBoundingClientRect(); }

function updateCropSelection() {
  if (!cropRect) return;
  const { width: cw, height: ch } = contRect();
  cropSelection.style.left   = (cropRect.x / cw * 100) + '%';
  cropSelection.style.top    = (cropRect.y / ch * 100) + '%';
  cropSelection.style.width  = (cropRect.w / cw * 100) + '%';
  cropSelection.style.height = (cropRect.h / ch * 100) + '%';
}

cropOverlay.addEventListener('pointerdown', e => {
  e.preventDefault();
  const { left, top } = contRect();
  cropStart = { x: e.clientX - left, y: e.clientY - top };
  isCropDragging = true;
  cropSelection.hidden = true;
  cropRect = null;
  usePhotoBtn.disabled = true;
  cropOverlay.setPointerCapture(e.pointerId);
});

cropOverlay.addEventListener('pointermove', e => {
  if (!isCropDragging) return;
  const { left, top, width, height } = contRect();
  const mx = clamp(e.clientX - left, 0, width);
  const my = clamp(e.clientY - top,  0, height);

  cropRect = {
    x: Math.min(mx, cropStart.x),
    y: Math.min(my, cropStart.y),
    w: Math.abs(mx - cropStart.x),
    h: Math.abs(my - cropStart.y),
  };

  if (cropRect.w > 4 && cropRect.h > 4) {
    cropSelection.hidden = false;
    updateCropSelection();
  }
});

cropOverlay.addEventListener('pointerup', () => {
  isCropDragging = false;
  // Enable Crop & Use only if a real box was drawn
  usePhotoBtn.disabled = !cropRect || cropRect.w < 10 || cropRect.h < 10;
});

/* Apply the crop selection and return a base64 JPEG */
function cropAndExport() {
  const img  = capturedImg;
  const dispW = img.clientWidth;
  const dispH = img.clientHeight;

  // Scale from displayed container pixels → natural image pixels
  const scaleX = img.naturalWidth  / dispW;
  const scaleY = img.naturalHeight / dispH;

  const srcX = Math.round(cropRect.x * scaleX);
  const srcY = Math.round(cropRect.y * scaleY);
  const srcW = Math.max(1, Math.round(cropRect.w * scaleX));
  const srcH = Math.max(1, Math.round(cropRect.h * scaleY));

  const out = document.createElement('canvas');
  out.width  = srcW;
  out.height = srcH;
  out.getContext('2d').drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
  return out.toDataURL('image/jpeg', 0.88);
}

/* ── Event wiring ── */
cameraBtn.addEventListener('click', openCamera);
document.getElementById('cameraCloseBtn').addEventListener('click', closeCamera);
document.getElementById('cameraCloseBtn2').addEventListener('click', closeCamera);
cameraModal.addEventListener('click', e => { if (e.target === cameraModal) closeCamera(); });

captureBtn.addEventListener('click', () => {
  cameraCanvas.width  = cameraVideo.videoWidth  || 640;
  cameraCanvas.height = cameraVideo.videoHeight || 480;
  cameraCanvas.getContext('2d').drawImage(cameraVideo, 0, 0);
  capturedImg.src = cameraCanvas.toDataURL('image/jpeg', 0.92);

  cameraViewport.hidden    = true;
  cameraPreview.hidden     = false;
  captureBtn.hidden        = true;
  retakeBtn.hidden         = false;
  usePhotoBtn.hidden       = false;
  usePhotoBtn.disabled     = true;   // enabled once user draws a box
  cropSelection.hidden     = true;
  cropRect                 = null;
  cameraTitle.textContent  = 'Crop Photo';
});

retakeBtn.addEventListener('click', () => {
  cameraViewport.hidden = false;
  cameraPreview.hidden  = true;
  captureBtn.hidden     = false;
  retakeBtn.hidden      = true;
  usePhotoBtn.hidden    = true;
  cameraTitle.textContent = 'Take a Photo';
});

usePhotoBtn.addEventListener('click', () => {
  const dataUrl = cropAndExport();
  pendingImage  = dataUrl.split(',')[1];
  attachedThumb.src  = dataUrl;
  attachedBar.hidden = false;
  closeCamera();
});

removeImageBtn.addEventListener('click', () => {
  pendingImage = null;
  attachedBar.hidden = true;
  attachedThumb.src  = '';
});

async function openCamera() {
  cameraViewport.hidden   = false;
  cameraPreview.hidden    = true;
  captureBtn.hidden       = false;
  retakeBtn.hidden        = true;
  usePhotoBtn.hidden      = true;
  cameraTitle.textContent = 'Take a Photo';
  cameraModal.classList.add('open');

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
    cameraVideo.srcObject = cameraStream;
  } catch (err) {
    cameraModal.classList.remove('open');
    alert(`Camera error: ${err.message}\n\nPlease allow camera access when prompted.`);
  }
}

function closeCamera() {
  cameraModal.classList.remove('open');
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  cameraVideo.srcObject = null;
}

/* ══════════════════════ PROMO BANNER ══════════════════════ */
if (localStorage.getItem('promo_dismissed')) {
  promoBanner.classList.add('hidden');
}

promoClose.addEventListener('click', () => {
  promoBanner.classList.add('hidden');
  localStorage.setItem('promo_dismissed', '1');
});

/* ══════════════════════ MODE TABS ══════════════════════ */
let activeMode = 'nl';

document.querySelectorAll('.itab[data-mode]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.itab[data-mode]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeMode = tab.dataset.mode;
    queryInput.placeholder = activeMode === 'math'
      ? 'Enter a mathematical expression…'
      : 'Enter a query or expression…';
    queryInput.focus();
  });
});

/* ══════════════════════ MATH TOOLBAR ══════════════════════ */
document.querySelectorAll('.mt-btn[data-insert]').forEach(btn => {
  btn.addEventListener('click', () => {
    const insert = btn.dataset.insert;
    if (!insert) return;
    const start = queryInput.selectionStart;
    const end   = queryInput.selectionEnd;
    const val   = queryInput.value;
    queryInput.value = val.slice(0, start) + insert + val.slice(end);
    queryInput.selectionStart = queryInput.selectionEnd = start + insert.length;
    queryInput.focus();
  });
});

/* ══════════════════════ SETTINGS MODAL ══════════════════════ */
const proxyInput = document.getElementById('proxyUrlInput');

function openSettings() {
  apiKeyInput.value = localStorage.getItem('claude_api_key')   || '';
  proxyInput.value  = localStorage.getItem('claude_proxy_url') || '';
  settingsModal.classList.add('open');
  requestAnimationFrame(() => apiKeyInput.focus());
}

function closeSettings() {
  settingsModal.classList.remove('open');
}

settingsBtn.addEventListener('click', openSettings);
cancelSettings.addEventListener('click', closeSettings);

saveSettings.addEventListener('click', () => {
  const key   = apiKeyInput.value.trim();
  const proxy = proxyInput.value.trim();

  if (key)   localStorage.setItem('claude_api_key',   key);
  else       localStorage.removeItem('claude_api_key');

  if (proxy) localStorage.setItem('claude_proxy_url', proxy);
  else       localStorage.removeItem('claude_proxy_url');

  closeSettings();
});

settingsModal.addEventListener('click', e => {
  if (e.target === settingsModal) closeSettings();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSettings();
});

/* ══════════════════════ EXAMPLES ══════════════════════ */
document.querySelectorAll('.example-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    queryInput.value = btn.dataset.query;
    handleSearch();
  });
});

/* ══════════════════════ CLEAR ══════════════════════ */
clearBtn.addEventListener('click', () => {
  queryInput.value = '';
  queryInput.focus();
  showHero();
});

/* ══════════════════════ SEARCH TRIGGERS ══════════════════════ */
searchBtn.addEventListener('click', handleSearch);
queryInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSearch();
});


/* ══════════════════════ VIEW STATE ══════════════════════ */
function showHero() {
  heroSection.classList.remove('hero--compact');
  resultsArea.hidden  = true;
  loadingArea.hidden  = true;
  errorArea.hidden    = true;
}

function showLoading() {
  // Keep hero visible (compact if in chat mode) while loading
  heroSection.classList.add('hero--compact');
  resultsArea.hidden  = true;
  errorArea.hidden    = true;
  loadingArea.hidden  = false;
}

function showError(msg) {
  loadingArea.hidden   = true;
  errorArea.hidden     = false;
  errorMsg.textContent = msg;
  // Keep results visible if there's existing chat history
  if (chatHistory.length > 0) {
    resultsArea.hidden = false;
  }
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

function showResults() {
  heroSection.classList.add('hero--compact');
  loadingArea.hidden  = true;
  errorArea.hidden    = true;
  resultsArea.hidden  = false;
}

/* ══════════════════════ MAIN SEARCH ══════════════════════ */
async function handleSearch() {
  const query = queryInput.value.trim();
  if (!query) return;

  const apiKey  = localStorage.getItem('claude_api_key');
  const proxyUrl = localStorage.getItem('claude_proxy_url');

  if (!apiKey) {
    openSettings();
    return;
  }

  if (!proxyUrl) {
    showError(
      'No proxy URL set. ' +
      'Browsers block direct Anthropic API calls (CORS). ' +
      'Click ⚙ API Key and paste your Cloudflare Worker URL — see README for setup steps.'
    );
    return;
  }

  // Build message content — plain text, or array with image if one is attached
  const messageContent = pendingImage
    ? [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: pendingImage } },
        { type: 'text',  text: query || 'Describe this image.' },
      ]
    : query;

  // Clear the attached image after using it
  if (pendingImage) {
    pendingImage       = null;
    attachedBar.hidden = true;
    attachedThumb.src  = '';
  }

  // Add user message to history
  chatHistory.push({ role: 'user', content: messageContent });

  showLoading();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        system:     SYSTEM_PROMPT,
        messages:   chatHistory,
        temperature:  0.15,
        max_tokens:   2000,
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        detail = j?.error?.message || detail;
      } catch (_) { /* ignore */ }
      // Remove the user message we just added since it failed
      chatHistory.pop();
      throw new Error(detail);
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text ?? '';

    // Store assistant reply
    chatHistory.push({ role: 'assistant', content: text });

    // Store and display this exchange
    exchanges.push({ query, markdown: text });
    displayPage(exchanges.length - 1);
    updateSessionBar();
    showResults();

  } catch (err) {
    clearTimeout(timeout);
    // Remove the user message if it wasn't already removed
    if (chatHistory[chatHistory.length - 1]?.role === 'user') chatHistory.pop();
    if (err.name === 'AbortError') {
      showError('Request timed out after 30 seconds. Check your proxy URL and API key.');
    } else {
      showError(`Error: ${err.message}`);
    }
  }
}


/* ══════════════════════ POD PARSING ══════════════════════ */
function parsePods(markdown) {
  const pods = [];
  let title = null;
  let lines = [];

  const flush = () => {
    const content = lines.join('\n').trim();
    if (content) pods.push({ title: title ?? 'Result', content });
  };

  for (const line of markdown.split('\n')) {
    const m = line.match(/^##\s+(.+)/);
    if (m) {
      flush();
      title = m[1].trim();
      lines = [];
    } else {
      lines.push(line);
    }
  }

  flush();

  // Fallback
  if (pods.length === 0) {
    pods.push({ title: 'Result', content: markdown.trim() });
  }

  return pods;
}

/* ══════════════════════ MARKDOWN → HTML ══════════════════════ */
function renderMarkdown(md) {
  // Protect math before marked processes it
  const store = [];
  let s = md;

  s = s.replace(/\$\$[\s\S]+?\$\$/g, m => { store.push(m); return `%%M${store.length - 1}%%`; });
  s = s.replace(/\$[^$\n]{1,300}?\$/g, m => { store.push(m); return `%%M${store.length - 1}%%`; });
  s = s.replace(/\\\[[\s\S]+?\\\]/g,   m => { store.push(m); return `%%M${store.length - 1}%%`; });
  s = s.replace(/\\\([\s\S]+?\\\)/g,   m => { store.push(m); return `%%M${store.length - 1}%%`; });

  let html = marked.parse(s, { gfm: true, breaks: false });

  // Restore math
  html = html.replace(/%%M(\d+)%%/g, (_, i) => store[+i] ?? '');

  return html;
}

/* ══════════════════════ HELPERS ══════════════════════ */
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function plainText(md) {
  return md
    .replace(/\$\$[\s\S]+?\$\$/g, '[math]')
    .replace(/\$[^$\n]+?\$/g, '[math]')
    .replace(/[#*`_~[\]]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

function inferDomain(query) {
  const q = query.toLowerCase();
  if (/\b(integral|integrate|derivative|differentiate|limit|series|matrix|solve|factor|expand|simplify|equation|polynomial|calculus|algebra|sqrt|sin|cos|tan|log|ln)\b/.test(q)) {
    return 'a mathematical expression';
  }
  if (/\b(celsius|fahrenheit|convert|meter|mile|km|kg|lb|gallon|liter|joule|watt|volt|amp|ohm|newton|pascal)\b/.test(q)) {
    return 'a unit conversion';
  }
  if (/\b(speed|mass|energy|force|gravity|photon|electron|proton|atom|molecule|element|wavelength|frequency)\b/.test(q)) {
    return 'a physics quantity';
  }
  if (/\b(population|capital|president|country|who|when|born|died|history)\b/.test(q)) {
    return 'a factual query';
  }
  return 'a general knowledge query';
}
