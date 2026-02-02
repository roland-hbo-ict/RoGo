// tokens.js
export const TOKEN_ORDER = ['g', 'ct', 'b', 'r'];

// Internal IDs (DB keys) stay stable: g, ct, b, r
export const DEFAULT_TOKENS = {
  g: {
    id: 'g',
    name_nl: 'Emballagekrat',
    name_en: 'Crate deposit',
    value_eur: 7.50,
    short_nl: 'Krat',
    short_en: 'Crate',
    defaultRef: 'k',     // “nobody uses g”, default is k
    userRef: 'g'         // your personal letter
  },
  ct: {
    id: 'ct',
    name_nl: 'Rolcontainer',
    name_en: 'Container',
    value_eur: 100.00,
    short_nl: 'Cont',
    short_en: 'Cont',
    defaultRef: 'c',
    userRef: 'ct'
  },
  b: {
    id: 'b',
    name_nl: 'Diepvriesbox',
    name_en: 'Freezer box',
    value_eur: 80.00,
    short_nl: 'Box',
    short_en: 'Box',
    defaultRef: 'b',
    userRef: 'b'
  },
  r: {
    id: 'r',
    name_nl: 'Rode krat',
    name_en: 'Red crate',
    value_eur: 12.50,
    short_nl: 'Rood',
    short_en: 'Red',
    defaultRef: 'r',
    userRef: 'r'
  }
};

export function getTokenDefs() {
  // Later: move to IndexedDB, per-user profiles, import/export.
  // For now: allow localStorage overrides.
  const raw = localStorage.getItem('rogo_token_overrides');
  if (!raw) return structuredClone(DEFAULT_TOKENS);

  try {
    const overrides = JSON.parse(raw);
    const base = structuredClone(DEFAULT_TOKENS);

    for (const id of Object.keys(base)) {
      if (overrides[id]) base[id] = { ...base[id], ...overrides[id] };
    }
    return base;
  } catch {
    return structuredClone(DEFAULT_TOKENS);
  }
}

export function buildAliasMap(defs) {
  // Maps “what user types” -> internal token id (g/ct/b/r)
  const map = {};
  for (const id of Object.keys(defs)) {
    const d = defs[id];
    const aliases = new Set([
      id,
      d.defaultRef,
      d.userRef
    ].filter(Boolean).map(s => String(s).toLowerCase()));

    for (const a of aliases) map[a] = id;
  }
  return map;
}

export function displayKey(defs, id) {
  const d = defs[id];
  return (d?.userRef || d?.defaultRef || id).toLowerCase();
}