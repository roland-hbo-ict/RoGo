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

  const id = await req(
    store('groups', 'readwrite').add({
      name,
      createdAt: Date.now()
    })
  );
  await addEvent({
    kind: 'lifecycle',
    action: 'created',
    groupId: id,
    groupName: name
  });
  return id;
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

export async function renameGroup(groupId, newName) {
  await openDB();

  const id = Number(groupId);
  const name = String(newName || '').trim();
  if (!name) throw new Error('Name is empty');

  const groups = await req(store('groups').getAll());
  const existing = groups.find(g => g.name.toLowerCase() === name.toLowerCase() && g.id !== id);
  if (existing) throw new Error('Name already exists');

  const os = store('groups', 'readwrite');
  const g = await req(os.get(id));
  if (!g) throw new Error('Group not found');
  const oldName = g.name;

  g.name = name;
  await req(os.put(g));
  await addEvent({
    kind: 'lifecycle',
    action: 'renamed',
    groupId: id,
    groupName: name,
    oldName,
    newName: name
  });
  return g.name;
}

export async function deleteGroups(groupIds) {
  await openDB();

  const ids = [...new Set((groupIds || []).map(Number).filter(Number.isFinite))];
  if (!ids.length) return 0;

  const groups = await req(store('groups').getAll());
  const byId = new Map(groups.map(g => [Number(g.id), g]));

  const tx = db.transaction(['groups', 'events'], 'readwrite');
  const groupsOS = tx.objectStore('groups');
  const eventsOS = tx.objectStore('events');

  for (const id of ids) {
    const g = byId.get(id);
    eventsOS.add({
      timestamp: Date.now(),
      kind: 'lifecycle',
      action: 'deleted',
      groupId: id,
      groupName: g?.name || String(id)
    });
    groupsOS.delete(id);
  }

  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  return ids.length;
}

export async function getHistoryEvents({ groupId = null, limit = 500 } = {}) {
  await openDB();
  const events = await req(store('events').getAll());
  const id = groupId == null ? null : Number(groupId);

  const filtered = events.filter(e => {
    if (id == null) return true;
    return Number(e.groupId) === id;
  });

  filtered.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  return filtered.slice(0, Math.max(1, Number(limit) || 500));
}
