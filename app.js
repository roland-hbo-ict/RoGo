import { openDB, getGroupsWithTotals, getAliases } from './db.js';
import { parseAndExecute, parsePreview } from './parser.js';
 
const list = document.getElementById('list');
const cmd = document.getElementById('cmd');
const send = document.getElementById('send');
const preview = document.getElementById('preview');
const feedback = document.getElementById('feedback');
 
function hapticSuccess() {
  navigator.vibrate?.(20);
}
 
function hapticError() {
  navigator.vibrate?.([30, 20, 30]);
}
 
async function load() {
  await openDB();
  const groups = await getGroupsWithTotals();
 
  list.innerHTML = '';
  groups.forEach(g => {
    list.innerHTML += `
      <div class="card">
        <div class="name">${g.name}</div>
        <div class="row">Geleverd g${g.geleverd.g} ct${g.geleverd.ct}</div>
        <div class="row retour">Retour g${g.retour.g} ct${g.retour.ct}</div>
      </div>`;
  });
}
 
cmd.addEventListener('input', async () => {
  const context = { aliases: await getAliases() };
  const r = parsePreview(cmd.value, context);
 
  preview.className = 'preview';
  if (!r) return preview.textContent = '';
 
  preview.textContent = r.text;
  if (r.error) preview.classList.add('error');
  else if (r.mode === 'remove') preview.classList.add('remove');
  else if (r.target === 'retour') preview.classList.add('retour');
  else preview.classList.add('add');
});
 
async function sendCmd() {
  try {
    await parseAndExecute(cmd.value, { aliases: await getAliases() });
    cmd.value = '';
    preview.classList.add('pulse');
    hapticSuccess();
    load();
  } catch (e) {
    feedback.textContent = e.message;
    preview.classList.add('pulse');
    hapticError();
  }
}
 
send.onclick = sendCmd;
cmd.onkeydown = e => e.key === 'Enter' && sendCmd();
 
load();