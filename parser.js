import { addEvent, ensureGroup } from './db.js';

export async function parseAndExecute(input, groupName, mode) {
  input = input.trim();

  if (!input) {
    throw new Error('Empty input');
  }

  if (!groupName || !mode) {
    throw new Error('Select item and mode');
  }

  const parts = input.split(/\s+/);
  const amounts = { g: 0, ct: 0, r: 0, b: 0 };

  for (const p of parts) {
    const match = p.match(/^(\d+)(g|ct|r|b)$/i);
    if (!match) {
      throw new Error(`Invalid amount: ${p}`);
    }

    const value = Number(match[1]);
    const key = match[2].toLowerCase();
    amounts[key] += value;
  }

  const groupId = await ensureGroup(groupName);

  await addEvent({
    groupId,
    target: mode, // 'geleverd' | 'retour'
    ...amounts
  });

  return {
    groupName,
    target: mode,
    amounts
  };
}