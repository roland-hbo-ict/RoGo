import { parseAndExecute } from './parser.js';
import { getGroupsWithTotals, ensureGroup } from './db.js';

const list = document.getElementById('list');
const cmd = document.getElementById('cmd');
const preview = document.getElementById('preview');
const feedback = document.getElementById('feedback');
let selectedGroup = null;
let selectedMode = null; // 'geleverd' | 'retour'


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

        ${isSelected ? `
          <div class="modes">
            <button class="mode ${selectedMode === 'geleverd' ? 'active' : ''}"
                    data-mode="geleverd">Geleverd</button>
            <button class="mode ${selectedMode === 'retour' ? 'active' : ''}"
                    data-mode="retour">Retour</button>
          </div>
        ` : ''}

        <div class="line">
          Geleverd: g${g.geleverd.g} ct${g.geleverd.ct} r${g.geleverd.r} b${g.geleverd.b}
        </div>
        <div class="line">
          Retour: g${g.retour.g} ct${g.retour.ct} r${g.retour.r} b${g.retour.b}
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
  const card = e.target.closest('.group');
  if (!card) return;

  const modeBtn = e.target.closest('.mode');
  if (modeBtn) {
    selectedMode = modeBtn.dataset.mode;
    load();
    return;
  }

  selectedGroup = card.dataset.name;
  selectedMode = null; // reset when switching group
  load();
});

cmd.addEventListener('input', () => {
  preview.textContent = cmd.value;
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
  cmd.focus();
  load();
});

const addBtn = document.getElementById('addGroup');

addBtn.addEventListener('click', async () => {
  const name = prompt('New item name');
  if (!name) return;

  const clean = name.trim();
  await ensureGroup(clean);
  selectedGroup = clean;
  await load();
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