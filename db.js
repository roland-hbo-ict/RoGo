import { TOKEN_ORDER } from './tokens.js';

let db;

export async function openDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open('logistics-db', 1);

    req.onupgradeneeded = e => {
      db = e.target.result;
      db.createObjectStore('groups', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
    };

    req.onsuccess = e => {
      db = e.target.result;
      resolve(db);
    };

    req.onerror = () => reject(req.error);
  });
}

function store(name, mode = 'readonly') {
  return db.transaction(name, mode).objectStore(name);
}

function req(r) {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function ensureGroup(name) {
  await openDB();
  const groups = await req(store('groups').getAll());
  const found = groups.find(g => g.name === name);
  if (found) return found.id;

  return req(
    store('groups', 'readwrite').add({
      name,
      createdAt: Date.now()
    })
  );
}

export async function addEvent(evt) {
  await openDB();
  evt.timestamp = Date.now();
  await req(store('events', 'readwrite').add(evt));
}

export async function getGroupsWithTotals() {
  await openDB();
  const groups = await req(store('groups').getAll());
  const events = await req(store('events').getAll());

  return groups.map(g => {
    const ev = events.filter(e => e.groupId === g.id);

    const sum = target =>
      ev
        .filter(e => e.target === target)
        .reduce((acc, evt) => {
          for (const k of TOKEN_ORDER) {
            acc[k] = (acc[k] || 0) + (Number(evt[k]) || 0);
          }
          return acc;
        }, Object.fromEntries(TOKEN_ORDER.map(k => [k, 0])));

    return {
      ...g,
      geleverd: sum('geleverd'),
      retour: sum('retour')
    };
  });
}