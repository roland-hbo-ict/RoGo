import { addEvent, ensureGroup } from './db.js';
import { TOKEN_ORDER, getTokenDefs, buildAliasMap } from './tokens.js';
import { emptyTotals, hasAnyTotals, normalizeStorage, sumTotals } from './storage.js';

const FREEZER_SUFFIX_ALIASES = Object.freeze({
  kf: 'k',
  kv: 'k',
  rf: 'r',
  rv: 'r',
  epsf: 'eps',
  epsv: 'eps'
});

export async function parseAndExecute(input, groupName, mode, storage = 'main', { freezerEnabled = true } = {}) {
  input = input.trim();

  if (!input) throw new Error('Empty input');
  if (!groupName || !mode) throw new Error('Select item and mode');

  const parsedInput = parseCommandInput(input, { mode, storage, freezerEnabled });
  const { totals, amountsByStorage, hasMixedStorage } = parsedInput;

  const groupId = await ensureGroup(groupName);
  const targetStorage = hasMixedStorage ? 'mixed' : normalizeStorage(storage);
  const target = mode === 'retour' ? 'retour' : 'geleverd';

  if (hasMixedStorage) {
    if (hasAnyTotals(amountsByStorage.main)) {
      await addEvent({
        groupId,
        groupName,
        target,
        storage: 'main',
        ...amountsByStorage.main
      });
    }
    if (hasAnyTotals(amountsByStorage.freezer)) {
      await addEvent({
        groupId,
        groupName,
        target,
        storage: 'freezer',
        ...amountsByStorage.freezer
      });
    }
  } else {
    await addEvent({
      groupId,
      groupName,
      target,
      storage: targetStorage,
      ...totals
    });
  }

  return {
    groupName,
    target,
    storage: targetStorage,
    amounts: totals,
    amountsByStorage,
    hasMixedStorage
  };
}

export function parseCommandInput(input, { mode, storage = 'main', freezerEnabled = true } = {}) {
  const defs = getTokenDefs();
  const aliasMap = buildAliasMap(defs);
  const parts = String(input || '').trim().split(/\s+/).filter(Boolean);
  const parsedParts = parts.map((raw) => {
    const parsed = parsePart(raw);
    if (!parsed) throw new Error(`Invalid amount: ${raw}`);
    const resolved = resolveCommandAlias(parsed.alias, { mode, freezerEnabled, raw: parsed.raw });
    return { ...parsed, ...resolved };
  });
  const hasMixedStorage = parsedParts.some((part) => part.storageHint === 'freezer');
  const defaultStorage = normalizeStorage(storage);
  const amountsByStorage = {
    main: emptyTotals(),
    freezer: emptyTotals()
  };

  for (const part of parsedParts) {
    const key = aliasMap[part.alias];
    if (!key) throw new Error(`Invalid amount: ${part.raw}`);

    const targetStorage = part.storageHint === 'freezer'
      ? 'freezer'
      : hasMixedStorage
        ? 'main'
        : defaultStorage;

    amountsByStorage[targetStorage][key] += part.value;
  }

  return {
    parts: parsedParts,
    amountsByStorage,
    totals: sumTotals(amountsByStorage.main, amountsByStorage.freezer),
    hasMixedStorage
  };
}

export function resolveCommandAlias(alias, { mode, freezerEnabled = true, raw = alias } = {}) {
  const safeAlias = String(alias || '').toLowerCase();
  const freezerBaseAlias = FREEZER_SUFFIX_ALIASES[safeAlias];
  if (!freezerBaseAlias) {
    return { alias: safeAlias, storageHint: null };
  }
  if (!freezerEnabled || mode !== 'geleverd') {
    throw new Error(`Invalid amount: ${raw}`);
  }
  return { alias: freezerBaseAlias, storageHint: 'freezer' };
}

export function parsePart(p) {
  let m = p.match(/^([+-]?)(\d+)([a-z]{1,12})$/i);
  if (m) {
    const sign = m[1] === '-' ? -1 : 1;
    return { value: sign * Number(m[2]), alias: m[3].toLowerCase(), raw: p };
  }

  m = p.match(/^([a-z]{1,12})([+-]?)(\d+)$/i);
  if (m) {
    const sign = m[2] === '-' ? -1 : 1;
    return { value: sign * Number(m[3]), alias: m[1].toLowerCase(), raw: p };
  }

  return null;
}
