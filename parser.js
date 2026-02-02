import { addEvent, ensureGroup } from './db.js';
import { TOKEN_ORDER, getTokenDefs, buildAliasMap } from './tokens.js';

export async function parseAndExecute(input, groupName, mode) {
  input = input.trim();

  if (!input) throw new Error('Empty input');
  if (!groupName || !mode) throw new Error('Select item and mode');

  const defs = getTokenDefs();
  const aliasMap = buildAliasMap(defs);

  const parts = input.split(/\s+/);
  const amounts = Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));

  for (const p of parts) {
    const match = p.match(/^(\d+)([a-z]{1,2})$/i);
    if (!match) throw new Error(`Invalid amount: ${p}`);

    const value = Number(match[1]);
    const alias = match[2].toLowerCase();
    const key = aliasMap[alias];

    if (!key) throw new Error(`Invalid amount: ${p}`);
    amounts[key] += value;
  }

  const groupId = await ensureGroup(groupName);

  await addEvent({
    groupId,
    target: mode, // 'geleverd' | 'retour'
    ...amounts
  });

  return { groupName, target: mode, amounts };
}
