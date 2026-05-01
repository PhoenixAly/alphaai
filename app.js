/* ══════════════════════ AlphaAI — app.js ══════════════════════ */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL      = 'gpt-4o';

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
const newQueryBtn   = document.getElementById('newQueryBtn');
const sidebarStep   = document.getElementById('sidebarStepText');
const settingsBtn   = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const apiKeyInput   = document.getElementById('apiKeyInput');
const saveSettings  = document.getElementById('saveSettings');
const cancelSettings= document.getElementById('cancelSettings');
const promoBanner   = document.getElementById('promoBanner');
const promoClose    = document.getElementById('promoClose');

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
function openSettings() {
  apiKeyInput.value = localStorage.getItem('openai_api_key') || '';
  settingsModal.classList.add('open');
  requestAnimationFrame(() => apiKeyInput.focus());
}

function closeSettings() {
  settingsModal.classList.remove('open');
}

settingsBtn.addEventListener('click', openSettings);
cancelSettings.addEventListener('click', closeSettings);

saveSettings.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (key) localStorage.setItem('openai_api_key', key);
  else localStorage.removeItem('openai_api_key');
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

newQueryBtn.addEventListener('click', () => {
  showHero();
  queryInput.value = '';
  requestAnimationFrame(() => queryInput.focus());
});

/* ══════════════════════ VIEW STATE ══════════════════════ */
function showHero() {
  heroSection.hidden  = false;
  resultsArea.hidden  = true;
  loadingArea.hidden  = true;
  errorArea.hidden    = true;
}

function showLoading() {
  heroSection.hidden  = true;
  resultsArea.hidden  = true;
  errorArea.hidden    = true;
  loadingArea.hidden  = false;
}

function showError(msg) {
  heroSection.hidden  = false;
  loadingArea.hidden  = true;
  resultsArea.hidden  = true;
  errorArea.hidden    = false;
  errorMsg.textContent = msg;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showResults() {
  heroSection.hidden  = true;
  loadingArea.hidden  = true;
  errorArea.hidden    = true;
  resultsArea.hidden  = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ══════════════════════ MAIN SEARCH ══════════════════════ */
async function handleSearch() {
  const query = queryInput.value.trim();
  if (!query) return;

  const apiKey = localStorage.getItem('openai_api_key');
  if (!apiKey) {
    openSettings();
    return;
  }

  showLoading();

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: query },
        ],
        temperature:  0.15,
        max_tokens:   2000,
      }),
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        detail = j?.error?.message || detail;
      } catch (_) { /* ignore */ }
      throw new Error(detail);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    renderResults(query, text);

  } catch (err) {
    showError(`Error: ${err.message}`);
  }
}

/* ══════════════════════ RENDER RESULTS ══════════════════════ */
function renderResults(query, markdown) {
  const pods = parsePods(markdown);

  assumingQuery.textContent = query;
  assumingDomain.textContent = inferDomain(query);

  // Populate sidebar with first non-interpretation pod content
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
    el.style.animationDelay = `${i * 0.05}s`;
    el.innerHTML = `
      <div class="pod-header">
        <span class="pod-header-bar"></span>
        ${escHtml(pod.title.toUpperCase())}
      </div>
      <div class="pod-body">${renderMarkdown(pod.content)}</div>`;
    podsContainer.appendChild(el);
  });

  showResults();

  // Render LaTeX after DOM insertion
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
