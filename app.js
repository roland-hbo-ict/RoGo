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

async function load() {
  const groups = await getGroupsWithTotals();
  list.innerHTML = '';

  groups.forEach(g => {
    const isSelected = g.name === selectedGroup;

    list.innerHTML += `
      <div class="group ${isSelected ? 'selected' : ''}"
          data-name="${g.name}">
          
        <strong>${g.name}</strong>

        <div class="modes">
          <button class="mode ${selectedMode === 'geleverd' ? 'active' : ''}"
                  data-mode="geleverd">Geleverd</button>
          <button class="mode ${selectedMode === 'retour' ? 'active' : ''}"
                  data-mode="retour">Retour</button>
        </div>

        <div class="totals">
          <div class="bar"></div>
          <div class="stats">
            <div class="section">
              <strong>Geleverd</strong>
              <div>g ${g.geleverd.g}</div>
              <div>ct ${g.geleverd.ct}</div>
              <div>r ${g.geleverd.r}</div>
              <div>b ${g.geleverd.b}</div>
            </div>

            <div class="section">
              <strong>Retour</strong>
              <div>g ${g.retour.g}</div>
              <div>ct ${g.retour.ct}</div>
              <div>r ${g.retour.r}</div>
              <div>b ${g.retour.b}</div>
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
  const parts = cmd.value.trim().split(/\s+/);
  chipsEl.innerHTML = '';

  for (const p of parts) {
    const m = p.match(/^(\d+)(g|ct|r|b)$/i);
    const chip = document.createElement('div');
    chip.className = 'chip ' + (m ? 'good' : 'bad');
    chip.textContent = m ? `+${m[1]} ${m[2]}` : p;
    chipsEl.appendChild(chip);
  }
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