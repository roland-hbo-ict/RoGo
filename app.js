import { parseAndExecute } from './parser.js';
import { getGroupsWithTotals } from './db.js';

const list = document.getElementById('list');
const cmd = document.getElementById('cmd');
const preview = document.getElementById('preview');
const feedback = document.getElementById('feedback');

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
    list.innerHTML += `
      <div class="group">
        <strong>${g.name}</strong><br>
        Geleverd: g${g.geleverd.g} ct${g.geleverd.ct} r${g.geleverd.r} b${g.geleverd.b}<br>
        Retour: g${g.retour.g} ct${g.retour.ct} r${g.retour.r} b${g.retour.b}
      </div>
    `;
  });
}

cmd.addEventListener('input', () => {
  preview.textContent = cmd.value;
});

async function send() {
  try {
    await parseAndExecute(cmd.value);
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