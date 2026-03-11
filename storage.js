import { TOKEN_ORDER } from './tokens.js';

export const STORAGE_ORDER = ['main', 'freezer'];

export function normalizeStorage(storage) {
  return storage === 'freezer' ? 'freezer' : 'main';
}

export function emptyTotals() {
  return Object.fromEntries(TOKEN_ORDER.map((k) => [k, 0]));
}

export function cloneTotals(source = null) {
  const out = emptyTotals();
  for (const k of TOKEN_ORDER) out[k] = Number(source?.[k] || 0);
  return out;
}

export function sumTotals(...sources) {
  const out = emptyTotals();
  for (const src of sources) {
    for (const k of TOKEN_ORDER) {
      out[k] += Number(src?.[k] || 0);
    }
  }
  return out;
}

export function hasAnyTotals(totals) {
  return TOKEN_ORDER.some((k) => Number(totals?.[k] || 0) !== 0);
}

export function emptyStorageTotals() {
  return {
    main: {
      geleverd: emptyTotals(),
      retour: emptyTotals()
    },
    freezer: {
      geleverd: emptyTotals(),
      retour: emptyTotals()
    }
  };
}

export function cloneStorageTotals(source = null) {
  const out = emptyStorageTotals();
  for (const storage of STORAGE_ORDER) {
    out[storage].geleverd = cloneTotals(source?.[storage]?.geleverd);
    out[storage].retour = cloneTotals(source?.[storage]?.retour);
  }
  return out;
}

export function sumStorageModeTotals(storageTotals, mode) {
  const target = mode === 'retour' ? 'retour' : 'geleverd';
  return sumTotals(
    storageTotals?.main?.[target],
    storageTotals?.freezer?.[target]
  );
}
