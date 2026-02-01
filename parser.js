const DEFAULT_COMMANDS = [
  { trigger: '', target: 'geleverd', mode: 'add' },
  { trigger: '-', target: 'geleverd', mode: 'remove' },
  { trigger: '<', target: 'retour', mode: 'add' }
];
 
const LABELS = {
  g: 'groene-kratten',
  ct: 'containers',
  r: 'rode-kratten',
  b: 'diepvries-box'
};
 
import { addEvent, ensureGroup } from './db.js';
 
export async function parseAndExecute(input, context) {
  const res = parsePreview(input, context);
  if (res.error) throw new Error(res.text);
 
  const groupId = await ensureGroup(res.name);
 
  await addEvent({
    groupId,
    target: res.target,
    ...res.amounts
  });
}
 
export function parsePreview(input, context) {
  input = input.trim();
  if (!input) return null;
 
  const cmd = DEFAULT_COMMANDS
    .sort((a, b) => b.trigger.length - a.trigger.length)
    .find(c => input.startsWith(c.trigger));
 
  if (!cmd) return { text: '⚠ Unknown command', error: true };
 
  const action = cmd.mode === 'remove' ? 'Remove' : 'Add';
  const rest = input.slice(cmd.trigger.length).trim().split(/\s+/);
 
  const alias = rest.shift()?.toLowerCase();
  const name = context.aliases[alias];
  if (!name) return { text: '⚠ Unknown alias', error: true };
 
  const amounts = { g: 0, ct: 0, r: 0, b: 0 };
  const parts = [];
 
  for (const p of rest) {
    const m = p.match(/(\d+)(g|ct|r|b)/i);
    if (!m) return { text: `⚠ Invalid amount: ${p}`, error: true };
    amounts[m[2]] += cmd.mode === 'remove' ? -+m[1] : +m[1];
    parts.push(`${m[1]}x-${LABELS[m[2]]}`);
  }
 
  return {
    text: `${action} ${cmd.target} ${name} ${parts.join(' ')}`,
    mode: cmd.mode,
    target: cmd.target,
    name,
    amounts
  };
}