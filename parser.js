import { addEvent, ensureGroup, getAliases } from './db.js';

const COMMANDS = [
  { trigger: '-', target: 'geleverd', mode: 'remove', label: 'Remove' },
  { trigger: '<', target: 'retour', mode: 'add', label: 'Add retour' },
  { trigger: '', target: 'geleverd', mode: 'add', label: 'Add geleverd' }
];

export async function parseAndExecute(input, selectedGroup = null) {
  input = input.trim();
  if (!input) throw new Error('Empty command');

  const cmd = COMMANDS
    .sort((a, b) => b.trigger.length - a.trigger.length)
    .find(c => input.startsWith(c.trigger));

  const rest = input.slice(cmd.trigger.length).trim();
  const parts = rest.split(/\s+/);

  let groupName = selectedGroup;

  if (!groupName) {
    const aliases = await getAliases();
    const alias = parts.shift()?.toLowerCase();
    groupName = aliases[alias];
  }

  if (!groupName) {
    throw new Error('Select an item or use alias');
  }

  const amounts = { g: 0, ct: 0, r: 0, b: 0 };

  for (const p of parts) {
    const m = p.match(/^(\d+)(g|ct|r|b)$/i);
    if (!m) throw new Error('Invalid amount: ' + p);

    const val = parseInt(m[1], 10);
    const key = m[2].toLowerCase();
    amounts[key] += cmd.mode === 'remove' ? -val : val;
  }

  const groupId = await ensureGroup(groupName);

  await addEvent({
    groupId,
    target: cmd.target,
    ...amounts
  });

  return { label: cmd.label, groupName, target: cmd.target, amounts };
}