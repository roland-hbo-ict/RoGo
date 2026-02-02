import { parseAndExecute } from './parser.js';
import { getGroupsWithTotals, ensureGroup } from './db.js';

const list = document.getElementById('list');
const cmd = document.getElementById('cmd');
const preview = document.getElementById('preview');
const feedback = document.getElementById('feedback');
let selectedGroup = null;
let selectedMode = null;

const chipsEl = document.getElementById('chips');

async function loadVersion() {
  try {
    const res = await fetch('manifest.json');
    const manifest = await res.json();
    document.getElementById('version').textContent = 'v' + manifest.version;
  } catch {}
}

function hapticSuccess() {
  navigator.vibrate?.(20);
}

function hapticError() {
  navigator.vibrate?.([30, 20, 30]);
}

function sumInputTotals(input) {
  const totals = { g: 0, ct: 0, r: 0, b: 0 };
  const parts = input.trim().split(/\s+/).filter(Boolean);

  for (const p of parts) {
    const m = p.match(/^(\d+)(g|ct|r|b)$/i);
    if (!m) continue; // keep chips showing bad tokens, but preview totals ignore them
    const val = Number(m[1]);
    const key = m[2].toLowerCase();
    totals[key] += val;
  }
  return totals;
}

function formatTotals(totals) {
  const order = ['g', 'ct', 'r', 'b'];
  const out = [];
  for (const k of order) {
    if (totals[k] > 0) out.push(`${totals[k]}${k}`);
  }
  return out.join(' ') || '…';
}

function renderComputedRows(current, delta) {
  const order = ['g', 'ct', 'r', 'b'];
  return order
    .filter(k => (current[k] || 0) > 0 || (delta[k] || 0) > 0)
    .map(k => {
      const cur = current[k] || 0;
      const d = delta[k] || 0;
      const res = cur + d;
      return `
        <div class="row">
          <span class="k">${k}</span>
          <span class="cur">${cur}</span>
          <span class="arrow">→</span>
          <span class="delta">+${d}</span>
          <span class="arrow">→</span>
          <span class="res">${res}</span>
        </div>
      `;
    })
    .join('');
}

function renderPlainRows(current) {
  const order = ['g', 'ct', 'r', 'b'];
  return order
    .filter(k => (current[k] || 0) > 0)
    .map(k => `<div class="row plain"><span class="k">${k}</span><span class="res">${current[k]}</span></div>`)
    .join('') || `<div class="row plain muted">—</div>`;
}

function renderStats(stats) {
  return Object.entries(stats)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `<div>${k} ${v}</div>`)
    .join('');
}

async function load() {
  const groups = await getGroupsWithTotals();
  list.innerHTML = '';

  const deltaTotals = (selectedGroup && selectedMode) ? sumInputTotals(cmd.value) : { g:0, ct:0, r:0, b:0 };

  groups.forEach(g => {
    const isSelected = g.name === selectedGroup;

    const showButtons = isSelected;

    const geleverdBlock =
      (isSelected && selectedMode === 'geleverd')
        ? renderComputedRows(g.geleverd, deltaTotals)
        : renderPlainRows(g.geleverd);

    const retourBlock =
      (isSelected && selectedMode === 'retour')
        ? renderComputedRows(g.retour, deltaTotals)
        : renderPlainRows(g.retour);

    list.innerHTML += `
      <div class="group ${isSelected ? 'selected' : ''}" data-name="${g.name}">
        <strong>${g.name}</strong>

        ${showButtons ? `
          <div class="modes">
            <button class="mode ${selectedMode === 'geleverd' ? 'active' : ''}"
                    data-mode="geleverd">Geleverd</button>
            <button class="mode retour ${selectedMode === 'retour' ? 'active' : ''}"
                    data-mode="retour">Retour</button>
          </div>
        ` : ''}

        <div class="totals ${showButtons ? 'buttons-visible' : ''}">
          <div class="section geleverd">
            <div class="bar"></div>
            <div class="stats">
              ${showButtons ? '' : '<div class="title">Geleverd</div>'}
              ${geleverdBlock}
            </div>
          </div>

          <div class="section retour">
            <div class="bar"></div>
            <div class="stats">
              ${showButtons ? '' : '<div class="title">Retour</div>'}
              ${retourBlock}
            </div>
          </div>
        </div>
      </div>
    `;
  });

  cmd.disabled = !(selectedGroup && selectedMode);
  cmd.placeholder = selectedGroup
    ? selectedMode
      ? `${selectedGroup} · ${selectedMode} → 15g 1ct`
      : 'Select geleverd or retour'
    : 'Select an item first';
}

list.addEventListener('click', e => {
  const modeBtn = e.target.closest('.mode');
  const card = e.target.closest('.group');

  if (modeBtn && card) {
    selectedGroup = card.dataset.name;
    selectedMode = modeBtn.dataset.mode;
    load();
    cmd.focus();
    return;
  }

  if (card) {
    selectedGroup = card.dataset.name;
    load();
  }
});

cmd.addEventListener('input', () => {
  // chips stay per-token (exactly what you already like)
  const parts = cmd.value.trim().split(/\s+/);
  chipsEl.innerHTML = '';

  for (const p of parts) {
    if (!p) continue;
    const m = p.match(/^(\d+)(g|ct|r|b)$/i);
    const chip = document.createElement('div');
    chip.className = 'chip ' + (m ? 'good' : 'bad');
    chip.textContent = m ? `+${m[1]} ${m[2].toLowerCase()}` : p;
    chipsEl.appendChild(chip);
  }

  // preview becomes total of what user typed
  if (selectedGroup && selectedMode) {
    const totals = sumInputTotals(cmd.value);
    preview.textContent = `${selectedGroup} · ${selectedMode} → ${formatTotals(totals)}`;
  } else {
    preview.textContent = '';
  }

  // optional: live update card delta display (simple: reload)
  // If you later want to avoid re-rendering everything, we can optimize.
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
    preview.textContent = '';
    await load();
  } catch (e) {
    feedback.textContent = '⚠ ' + e.message;
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
});

const cli = document.querySelector('.cli-container');

if (window.visualViewport && cli) {
  const reposition = () => {
    const vv = window.visualViewport;
    const offset =
      window.innerHeight - vv.height - vv.offsetTop;

    cli.style.transform =
      offset > 0 ? `translateY(-${offset}px)` : 'translateY(0)';
  };

  visualViewport.addEventListener('resize', reposition);
  visualViewport.addEventListener('scroll', reposition);
}

const modal = document.getElementById('modalBackdrop');
const newGroupInput = document.getElementById('newGroupName');

document.addEventListener('keydown', e => {
  if (modal.classList.contains('hidden')) return;

  if (e.key === 'Escape') {
    modal.classList.add('hidden');
  }

  if (e.key === 'Enter') {
    document.getElementById('confirmModal').click();
  }
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
  selectedGroup = name;
  modal.classList.add('hidden');
  load();
};