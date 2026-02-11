import { parseAndExecute } from './parser.js';
import { getGroupsWithTotals, ensureGroup } from './db.js';
import {
  TOKEN_ORDER,
  getTokenDefs,
  buildAliasMap,
  displayKey,
  searchTokens,
  formatTokenOption
} from './tokens.js';

const list = document.getElementById('list');
const cmd = document.getElementById('cmd');
const preview = document.getElementById('preview');
const feedback = document.getElementById('feedback');
const chipsEl = document.getElementById('chips');

let selectedGroup = null;
let selectedMode = null;

let modeHintTimer = null;
let scrollSelectedToTop = false;

const I18N = {
  nl: {
    delivered: 'Geleverd',
    returned: 'Retour',
    newItem: 'Nieuw item',
    itemName: 'Item naam',
    cancel: 'Annuleren',
    create: 'Aanmaken',
    settings: 'Instellingen',
    theme: 'Thema',
    themeSub: 'Donker / Licht',
    handed: 'Links-handig',
    handedSub: 'Knoppen links',
    close: 'Sluiten',
    selectMode: 'Selecteer geleverd of retour',
    selectItemFirst: 'Selecteer eerst een item',
    placeholderExample: `15k 1c`,
  },
  en: {
    delivered: 'Delivered',
    returned: 'Return',
    newItem: 'New item',
    itemName: 'Item name',
    cancel: 'Cancel',
    create: 'Create',
    settings: 'Settings',
    theme: 'Theme',
    themeSub: 'Dark / Light',
    handed: 'Left-handed',
    handedSub: 'Buttons on left',
    close: 'Close',
    selectMode: 'Select delivered or return',
    selectItemFirst: 'Select an item first',
    placeholderExample: `15k 1c`,
  }
};

let deferredInstallPrompt = null;

const installRow  = document.getElementById('installRow');
const installBtn  = document.getElementById('installBtn');
const installHint = document.getElementById('installHint');

function isStandalone() {
  // iOS uses navigator.standalone, others use display-mode
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
}

function showInstallUI(reasonText) {
  if (!installRow || !installBtn || !installHint) return;

  installRow.style.display = 'flex';
  if (reasonText) installHint.textContent = reasonText;

  // If already installed, disable button
  if (isStandalone()) {
    installBtn.disabled = true;
    installBtn.textContent = 'Installed';
  }
}

function hideInstallUI() {
  if (!installRow) return;
  installRow.style.display = 'none';
}

// Fired on Chrome/Edge/Android when install is possible
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallUI('Install RoGo as an app');
});

// If user installs via browser UI
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  showInstallUI('Installed ✓');
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    // If already installed, do nothing
    if (isStandalone()) return;

    // iOS/Safari: no beforeinstallprompt -> show instructions
    if (!deferredInstallPrompt) {
      showInstallUI('On iPhone: Share → “Add to Home Screen”');
      return;
    }

    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;

    if (choice?.outcome === 'accepted') {
      showInstallUI('Installed ✓');
    } else {
      showInstallUI('Install dismissed');
    }
  });
}

// Initial state when opening app:
// - If already installed: show "Installed"
// - If not installable yet: hide (or show iOS hint if you want)
if (isStandalone()) {
  showInstallUI('Installed ✓');
} else {
  hideInstallUI();
}

function focusCmdSoon() {
  // next frame: after DOM + disabled state settles
  requestAnimationFrame(() => {
    requestAnimationFrame(() => cmd?.focus());
  });
}

function getLang() {
  return localStorage.getItem('rogo_lang') || 'nl';
}
function t(key, ...args) {
  const lang = getLang();
  const v = I18N[lang]?.[key] ?? I18N.nl[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}

function startModeHintPulse() {
  stopModeHintPulse();

  // pulse now + every minute, until a mode is chosen
  const pulse = () => {
    const card = document.querySelector(`.group.selected`);
    if (!card) return;

    const buttons = card.querySelectorAll('.stats .title.mode');
    buttons.forEach(b => {
      b.classList.remove('hint');
      void b.offsetWidth;
      b.classList.add('hint');
    });
  };

  pulse();
  modeHintTimer = setInterval(pulse, 10000);
}

function stopModeHintPulse() {
  if (modeHintTimer) clearInterval(modeHintTimer);
  modeHintTimer = null;
}

function loadVersion() {
  const el = document.getElementById('version');
  if (!el) return;

  // Prefer the version resolved in index.html (manifest.json single source of truth)
  const v = window.__ROGO_VERSION__ || localStorage.getItem('rogo_version') || 'dev';
  el.textContent = `v${v}`;
}

function hapticSuccess() {
  navigator.vibrate?.(20);
}

function hapticError() {
  navigator.vibrate?.([30, 20, 30]);
}

function sumInputTotals(input) {
  const defs = getTokenDefs();
  const aliasMap = buildAliasMap(defs);

  const totals = Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));
  const parts = input.trim().split(/\s+/).filter(Boolean);

  for (const p of parts) {
    const parsed = parsePart(p);
    if (!parsed) continue;

    const val = parsed.value;
    const alias = parsed.alias;
    const key = aliasMap[alias];
    if (!key) continue;

    totals[key] += val;
  }

  return totals;
}

function findNegativeTotals(currentTotals, deltaTotals) {
  const defs = getTokenDefs();
  const problems = [];

  for (const k of TOKEN_ORDER) {
    const cur = Number(currentTotals?.[k] || 0);
    const d = Number(deltaTotals?.[k] || 0);
    const next = cur + d;

    if (next < 0) {
      const name = defs?.[k]?.name_nl || k;
      problems.push({ key: k, name, cur, d, next });
    }
  }

  return problems;
}

function formatTotals(totals) {
  const out = [];
  for (const k of TOKEN_ORDER) {
    const v = totals[k] || 0;
    if (v !== 0) out.push(`${v}${k}`);
  }
  return out.join(' ') || '…';
}

function buildActionLine(groupName, mode, deltaTotals) {
  const modeLabel = mode === 'retour' ? 'retour' : 'geleverd'; // later: t('retour')/t('geleverd')
  return `${groupName} · ${modeLabel} → ${formatTotals(deltaTotals)}`;
}

function tokenNameNL(defs, id) {
  return defs?.[id]?.name_nl || id;
}

function renderMixedRows(current, delta, showDelta) {
  const order = TOKEN_ORDER;

  // If user isn't typing anything valid, just show plain rows
  if (!showDelta) return renderPlainRows(current);

  // When typing: only show computed rows for keys where delta > 0,
  // but keep other existing (cur>0) rows plain (no +0).
  const lines = [];

  for (const k of order) {
    const cur = current[k] || 0;
    const d = delta[k] || 0;
    if (d !== 0) {
      lines.push(`
        <div class="row">
          <span class="k">${displayKey(getTokenDefs(), k)}</span>
          <span class="cur">${cur}</span>
          <span class="arrow">→</span>
          <span class="delta ${d < 0 ? 'neg' : ''}">${d > 0 ? '+' : ''}${d}</span>
          <span class="arrow">→</span>
          <span class="res">${cur + d}</span>
        </div>
      `);
    } else if (cur > 0) {
      lines.push(`
        <div class="row plain">
          <span class="k">${displayKey(getTokenDefs(), k)}</span>
          <span class="res">${cur}</span>
        </div>
      `);
    }
  }

  return lines.join('') || `<div class="row muted">—</div>`;
}

function renderPlainRows(current) {
  const defs = getTokenDefs();
  const order = TOKEN_ORDER;

  return (
    order
      .filter(k => (current[k] || 0) != 0)
      .map(k => {
        const name = tokenNameNL(defs, k);
        const ref = displayKey(defs, k);

        return `
          <div class="statline">
            <span class="statname"><span class="statlabel">${name}</span></span>
            <span class="statend"><span class="statendinner">
              <span class="statqty">${current[k]}</span>
              <span class="statref">${ref}</span>
            </span></span>
          </div>
        `;
      })
      .join('') || `<div class="row plain muted">—</div>`
  );
}

function renderPlainPaired(geleverdTotals, retourTotals) {
  const defs = getTokenDefs();

  const left = [];
  const right = [];

  for (const k of TOKEN_ORDER) {
    const g = Number(geleverdTotals?.[k] || 0);
    const r = Number(retourTotals?.[k] || 0);

    // Only show tokens that appear in either column (union)
    if (g === 0 && r === 0) continue;

    const name = tokenNameNL(defs, k);
    const ref = displayKey(defs, k);

    left.push(`
      <div class="statline ${g === 0 ? 'zero' : ''}">
        <span class="statname"><span class="statlabel">${name}</span></span>
        <span class="statend"><span class="statendinner">
          <span class="statqty">${g}</span>
          <span class="statref">${ref}</span>
        </span></span>
      </div>
    `);

    right.push(`
      <div class="statline ${r === 0 ? 'zero' : ''}">
        <span class="statname"><span class="statlabel">${name}</span></span>
        <span class="statend"><span class="statendinner">
          <span class="statqty">${r}</span>
          <span class="statref">${ref}</span>
        </span></span>
      </div>
    `);
  }

  return {
    geleverd: left.join('') || `<div class="row muted">—</div>`,
    retour: right.join('') || `<div class="row muted">—</div>`
  };
}

function hasAnyDelta(delta) {
  return Object.values(delta).some(v => v !== 0);
}

function emptyTotals() {
  return Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));
}

async function load() {
  const groups = await getGroupsWithTotals();
  const selectedObj = groups.find(g => g.name === selectedGroup);
  window.__selectedTotals = selectedObj?.totals || Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));
  list.innerHTML = '';

  for (const g of groups) {
    const isSelected = g.name === selectedGroup;

    const deltaTotals = selectedGroup && selectedMode ? sumInputTotals(cmd.value) : emptyTotals();
    const showDelta = isSelected && !!selectedMode && hasAnyDelta(deltaTotals);

    const needsMode = isSelected && !selectedMode;

    const geleverdTitle = isSelected
      ? `<div class="title mode ${selectedMode === 'geleverd' ? 'active' : ''} ${needsMode ? 'needs' : ''}" data-mode="geleverd">${t('delivered')}</div>`
      : `<div class="title">${t('delivered')}</div>`;

    const retourTitle = isSelected
      ? `<div class="title mode ${selectedMode === 'retour' ? 'active' : ''} ${needsMode ? 'needs' : ''}" data-mode="retour">${t('returned')}</div>`
      : `<div class="title">${t('returned')}</div>`;

    const pairedPlain = renderPlainPaired(g.geleverd, g.retour);
    const geleverdBlock =
      (isSelected && selectedMode === 'geleverd')
        ? renderMixedRows(g.geleverd, deltaTotals, showDelta)
        : pairedPlain.geleverd;
    const retourBlock =
      (isSelected && selectedMode === 'retour')
        ? renderMixedRows(g.retour, deltaTotals, showDelta)
        : pairedPlain.retour;

    list.innerHTML += `
      <div class="group ${isSelected ? 'selected' : ''}" data-name="${g.name}">
        <h2>${g.name}</h2>

        <div class="totals">
          <div class="section geleverd">
            <div class="bar"></div>
            <div class="stats">
              ${geleverdTitle}
              ${geleverdBlock}
            </div>
          </div>

          <div class="section retour">
            <div class="bar"></div>
            <div class="stats">
              ${retourTitle}
              ${retourBlock}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  cmd.disabled = !(selectedGroup && selectedMode);
  cmd.placeholder = selectedGroup
    ? selectedMode
      ? t('placeholderExample', selectedGroup, selectedMode)
      : t('selectMode')
    : t('selectItemFirst');

  if (scrollSelectedToTop) {
    scrollSelectedToTop = false;
    const el = document.querySelector('.group.selected');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

list.addEventListener('click', e => {
  const modeBtn = e.target.closest('.mode');
  const card = e.target.closest('.group');
  if (!card) return;

  // Clicked a mode button (inside selected card)
  if (modeBtn) {
    selectedGroup = card.dataset.name;
    selectedMode = modeBtn.dataset.mode;
    scrollSelectedToTop = true;
    stopModeHintPulse();
    load().then(focusCmdSoon);
    return;
  }

  selectedGroup = card.dataset.name;
  selectedMode = null;
  scrollSelectedToTop = true;
  cmd.value = '';
  chipsEl.innerHTML = '';
  preview.textContent = '';
  feedback.textContent = '';
  load().then(() => {
    startModeHintPulse();
    focusCmdSoon();
  });
});

cmd.addEventListener('input', () => {
  // chips stay per-token
  const parts = cmd.value.trim().split(/\s+/);
  chipsEl.innerHTML = '';

  const defs = getTokenDefs();
  const aliasMap = buildAliasMap(defs);

  for (const p of parts) {
    if (!p) continue;

    const parsed = parsePart(p);
    const alias = parsed?.alias;   // string or undefined
    const value = parsed?.value;   // number or undefined
    const ok = !!(alias && aliasMap[alias]);

    const chip = document.createElement('div');
    chip.className = 'chip ' + (ok ? 'good' : 'bad');
    chip.textContent = ok ? `${value > 0 ? '+' : ''}${value} ${alias}` : p;
    chipsEl.appendChild(chip);
  }

  // preview shows total of what user typed
  if (selectedGroup && selectedMode) {
    const totals = sumInputTotals(cmd.value);
    // preview.textContent = `${selectedGroup} · ${selectedMode} → ${formatTotals(totals)}`;
    preview.textContent = buildActionLine(selectedGroup, selectedMode, totals);
  } else {
    preview.textContent = '';
  }

  // --- negative-total guard ---
  const sendBtn = document.getElementById('send');

  if (!selectedGroup || !selectedMode) {
    if (sendBtn) sendBtn.disabled = true;
    return;
  }

  // If you already compute this elsewhere, reuse it:
  const deltaTotals = sumInputTotals(cmd.value);

  const currentTotals = (window.__selectedTotals || null); // see 2.4
  const problems = findNegativeTotals(currentTotals, deltaTotals);

  if (problems.length) {
    const p = problems[0]; // show first problem only (keeps it short)
    if (feedback) {
      feedback.textContent = `⚠ Te laag: ${p.name} (${p.cur} → ${p.next})`;
    }
    if (sendBtn) sendBtn.disabled = true;
    if (preview) preview.classList.add('warn');
  } else {
    if (sendBtn) sendBtn.disabled = cmd.value.trim().length === 0;
    if (preview) preview.classList.remove('warn');
    // don’t clear feedback if you use feedback for other things;
    // but if you want warnings to clear automatically:
    // if (feedback && feedback.textContent.startsWith('⚠')) feedback.textContent = '';
  }

  // --- suggestions (non-clickable for now) ---
  if (suggestionsEl) suggestionsEl.innerHTML = '';

  const cleaned = cmd.value.trim();
  const parts2 = cleaned.split(/\s+/).filter(Boolean);
  const last = parts2[parts2.length - 1] || '';

  if (last && suggestionsEl) {
    const parsedLast = parsePart(last);

    if (parsedLast) {
      // Works for both "11bier" and "bier11" (and +/- variants)
      const alias = parsedLast.alias;
      if (!aliasMap[alias]) {
        const hits = searchTokens(defs, alias, 6);
        for (const id of hits) {
          const el = document.createElement('div');
          el.className = 'suggestion';
          el.textContent = formatTokenOption(defs, id);
          suggestionsEl.appendChild(el);
        }
      }
    } else {
      // Plain text query like "bier"
      const q = last.toLowerCase();
      if (!aliasMap[q] && q.length >= 2) {
        const hits = searchTokens(defs, q, 6);
        if (hits.length >= 2) {
          for (const id of hits) {
            const el = document.createElement('div');
            el.className = 'suggestion';
            el.textContent = formatTokenOption(defs, id);
            suggestionsEl.appendChild(el);
          }
        }
      }
    }
  }

  load();
});

async function send() {
  try {
    await parseAndExecute(cmd.value, selectedGroup, selectedMode);
    const deltaTotals = sumInputTotals(cmd.value);
    const savedLine = buildActionLine(selectedGroup, selectedMode, deltaTotals);
    feedback.textContent = `✔ Saved ${savedLine}`;

    preview.classList.remove('pulse');
    void preview.offsetWidth;
    preview.classList.add('pulse');

    hapticSuccess();

    cmd.value = '';
    chipsEl.innerHTML = '';
    preview.textContent = '';

    await load();
  } catch (e) {
    feedback.textContent = '⚠ ' + (e?.message || 'Error');
    preview.classList.remove('pulse');
    void preview.offsetWidth;
    preview.classList.add('pulse');
    hapticError();
  }
}

document.getElementById('send').onclick = send;
cmd.addEventListener('keydown', e => e.key === 'Enter' && send());

window.addEventListener('load', () => {
  loadVersion();
  cmd.focus();
  load();
  startModeHintPulse();
});


/* Modal */
const modal = document.getElementById('modalBackdrop');
const newGroupInput = document.getElementById('newGroupName');

document.addEventListener('keydown', e => {
  if (modal.classList.contains('hidden')) return;

  if (e.key === 'Escape') modal.classList.add('hidden');
  if (e.key === 'Enter') document.getElementById('confirmModal').click();
});

document.getElementById('addGroup').onclick = () => {
  modal.classList.remove('hidden');
  newGroupInput.value = '';
  newGroupInput.focus();
};

document.getElementById('cancelModal').onclick = () => {
  modal.classList.add('hidden');
};

modal.onclick = e => {
  if (e.target === modal) modal.classList.add('hidden');
};

document.getElementById('confirmModal').onclick = async () => {
  const name = newGroupInput.value.trim();
  if (!name) return;

  await ensureGroup(name);

  if (navigator.vibrate) navigator.vibrate(25);

  // Select the new group, but force user to pick mode (safer UX)
  selectedGroup = name;
  selectedMode = null;

  const contCreate = localStorage.getItem('rogo_cont_create') === '1';

  if (contCreate) {
    // keep modal open and allow rapid entry
    newGroupInput.value = '';
    newGroupInput.focus();
  } else {
    modal.classList.add('hidden');
  }

  load();
};

function parsePart(p) {
  // Supports:
  //  12k, -12k, +12k
  //  k12, k-12, k+12
  let m = p.match(/^([+-]?)(\d+)([a-z]{1,12})$/i);
  if (m) {
    const sign = m[1] === '-' ? -1 : 1;
    return { value: sign * Number(m[2]), alias: m[3].toLowerCase(), raw: p };
  }

  m = p.match(/^([a-z]{1,12})([+-]?)(\d+)$/i);
  if (m) {
    const sign = m[2] === '-' ? -1 : 1;
    return { value: sign * Number(m[3]), alias: m[1].toLowerCase(), raw: p };
  }

  return null;
}

function syncVisualViewport() {
  if (!window.visualViewport) return;
  const vv = window.visualViewport;

  // IMPORTANT:
  // When zoomed (scale != 1), the visual viewport moves around while you pan.
  // Using vv offsets then makes fixed bars jitter like crazy.
  // So: disable the vv-bottom hack while zoomed.
  if (vv.scale && Math.abs(vv.scale - 1) > 0.01) {
    document.documentElement.style.setProperty('--vv-bottom', '0px');
    return;
  }

  // Only compensate when it looks like a keyboard / UI inset (not normal scroll)
  const raw = window.innerHeight - (vv.height + vv.offsetTop);
  const bottom = raw > 0 ? raw : 0;

  // Optional: ignore tiny changes (reduces micro-jitter)
  const snapped = bottom < 2 ? 0 : Math.round(bottom);

  document.documentElement.style.setProperty('--vv-bottom', `${snapped}px`);
}

window.visualViewport?.addEventListener('resize', syncVisualViewport);
window.visualViewport?.addEventListener('scroll', syncVisualViewport);
window.addEventListener('resize', syncVisualViewport);
syncVisualViewport();

function syncModalViewportVars() {
  const vv = window.visualViewport;
  if (!vv) {
    document.documentElement.style.setProperty('--vv-top', '0px');
    document.documentElement.style.setProperty('--vv-h', '100vh');
    return;
  }

  // When zoomed, offsets get weird. Keep it simple.
  if (vv.scale && Math.abs(vv.scale - 1) > 0.01) {
    document.documentElement.style.setProperty('--vv-top', '0px');
    document.documentElement.style.setProperty('--vv-h', '100vh');
    return;
  }

  document.documentElement.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
  document.documentElement.style.setProperty('--vv-h', `${Math.round(vv.height)}px`);
}

window.visualViewport?.addEventListener('resize', syncModalViewportVars);
window.visualViewport?.addEventListener('scroll', syncModalViewportVars);
window.addEventListener('resize', syncModalViewportVars);
syncModalViewportVars();

/* Settings Modal */
const settingsBtn = document.getElementById('settingsBtn');
const settingsBackdrop = document.getElementById('settingsBackdrop');
const closeSettings = document.getElementById('closeSettings');
const themeToggle = document.getElementById('themeToggle');
const handToggle = document.getElementById('handToggle');
const langSelect = document.getElementById('langSelect');
const suggestionsEl = document.getElementById('suggestions');
const continuousCreateToggle = document.getElementById('continuousCreateToggle');

function applySettingsFromStorage() {
  const theme = localStorage.getItem('rogo_theme') || 'dark';
  const hand = localStorage.getItem('rogo_hand') || 'right';
  const lang = localStorage.getItem('rogo_lang') || 'nl';
  if (langSelect) langSelect.value = lang;

  const contCreate = localStorage.getItem('rogo_cont_create') === '1';
  if (continuousCreateToggle) continuousCreateToggle.checked = contCreate;

  document.body.classList.toggle('theme-light', theme === 'light');
  document.body.classList.toggle('hand-left', hand === 'left');

  if (themeToggle) themeToggle.checked = theme === 'light';
  if (handToggle) handToggle.checked = hand === 'left';
}

function openSettings() {
  settingsBackdrop.classList.remove('hidden');
}

function closeSettingsModal() {
  settingsBackdrop.classList.add('hidden');
}

settingsBtn?.addEventListener('click', openSettings);
closeSettings?.addEventListener('click', closeSettingsModal);

settingsBackdrop?.addEventListener('click', (e) => {
  if (e.target === settingsBackdrop) closeSettingsModal();
});

document.addEventListener('keydown', (e) => {
  if (!settingsBackdrop || settingsBackdrop.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeSettingsModal();
});

themeToggle?.addEventListener('change', () => {
  const val = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem('rogo_theme', val);
  applySettingsFromStorage();
});

handToggle?.addEventListener('change', () => {
  const val = handToggle.checked ? 'left' : 'right';
  localStorage.setItem('rogo_hand', val);
  applySettingsFromStorage();
});

langSelect?.addEventListener('change', () => {
  localStorage.setItem('rogo_lang', langSelect.value);
  load();
});

continuousCreateToggle?.addEventListener('change', () => {
  localStorage.setItem('rogo_cont_create', continuousCreateToggle.checked ? '1' : '0');
});

// call once on boot
applySettingsFromStorage();