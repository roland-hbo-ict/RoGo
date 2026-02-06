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

function formatTotals(totals) {
  const defs = getTokenDefs();
  const out = [];

  for (const k of TOKEN_ORDER) {
    if ((totals[k] || 0) > 0) out.push(`${totals[k]}${displayKey(defs, k)}`);
  }
  return out.join(' ') || '…';
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

    if (d > 0) {
      lines.push(`
        <div class="row">
          <span class="k">${displayKey(getTokenDefs(), k)}</span>
          <span class="cur">${cur}</span>
          <span class="arrow">→</span>
          <span class="delta">+${d}</span>
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
      .filter(k => (current[k] || 0) > 0)
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

function hasAnyDelta(delta) {
  return Object.values(delta).some(v => v > 0);
}

function emptyTotals() {
  return Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));
}

async function load() {
  const groups = await getGroupsWithTotals();
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

    const geleverdBlock =
      (isSelected && selectedMode === 'geleverd')
        ? renderMixedRows(g.geleverd, deltaTotals, showDelta)
        : renderPlainRows(g.geleverd);

    const retourBlock =
      (isSelected && selectedMode === 'retour')
        ? renderMixedRows(g.retour, deltaTotals, showDelta)
        : renderPlainRows(g.retour);

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
    chip.textContent = ok ? `+${value} ${alias}` : p;
    chipsEl.appendChild(chip);
  }

  // preview shows total of what user typed
  if (selectedGroup && selectedMode) {
    const totals = sumInputTotals(cmd.value);
    preview.textContent = `${selectedGroup} · ${selectedMode} → ${formatTotals(totals)}`;
  } else {
    preview.textContent = '';
  }

    // --- suggestions (non-clickable for now) ---
  if (suggestionsEl) suggestionsEl.innerHTML = '';

  const cleaned = cmd.value.trim();
  const parts2 = cleaned.split(/\s+/).filter(Boolean);
  const last = parts2[parts2.length - 1] || '';

  if (last && suggestionsEl) {
    // If "11bier" -> suggest based on "bier"
    const m2 = last.match(/^(\d+)([a-z]{1,12})$/i);
    if (m2) {
      const alias = m2[2].toLowerCase();
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
      // If "bier" -> show matches if ambiguous
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

  // simple: re-render for computed delta rows
  load();
});

async function send() {
  try {
    await parseAndExecute(cmd.value, selectedGroup, selectedMode);
    feedback.textContent = '✔ Saved';

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
  let m = p.match(/^(\d+)([a-z]{1,12})$/i);
  if (m) return { value: Number(m[1]), alias: m[2].toLowerCase(), raw: p };

  m = p.match(/^([a-z]{1,12})(\d+)$/i);
  if (m) return { value: Number(m[2]), alias: m[1].toLowerCase(), raw: p };

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