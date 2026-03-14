import { TOKEN_ORDER } from './tokens.js';
import {
  emptyStorageTotals,
  normalizeStorage,
  sumStorageModeTotals
} from './storage.js';

let db;
let currentProjectId = 'default';
const DB_VERSION = 2;
const TOKEN_INDEX_BY_ID = new Map(TOKEN_ORDER.map((id, index) => [id, index]));
const TARGET_CODE = Object.freeze({
  geleverd: 'g',
  retour: 'r'
});
const STORAGE_CODE = Object.freeze({
  main: 'm',
  freezer: 'f'
});
const LIFECYCLE_CODE = Object.freeze({
  created: 'c',
  renamed: 'r',
  deleted: 'd'
});

function dbNameForProject(projectId = currentProjectId) {
  const id = String(projectId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `logistics-db-${id}`;
}

function dbName() {
  return dbNameForProject(currentProjectId);
}

export function setCurrentProject(projectId) {
  const next = String(projectId || 'default');
  if (next === currentProjectId) return;
  currentProjectId = next;
  if (db) {
    try { db.close(); } catch {}
    db = null;
  }
}

export function getCurrentProject() {
  return currentProjectId;
}

export async function compactProjectDatabases(projectIds = []) {
  const ids = [...new Set((projectIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  for (const projectId of ids) {
    await new Promise((resolve) => {
      const req = indexedDB.open(dbNameForProject(projectId), DB_VERSION);
      req.onsuccess = () => {
        try { req.result?.close(); } catch {}
        resolve();
      };
      req.onupgradeneeded = (event) => {
        const upgradeDb = event.target.result;
        if (!upgradeDb.objectStoreNames.contains('groups')) {
          upgradeDb.createObjectStore('groups', { keyPath: 'id', autoIncrement: true });
        }
        let eventsStore = null;
        if (!upgradeDb.objectStoreNames.contains('events')) {
          eventsStore = upgradeDb.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
        } else {
          eventsStore = event.target.transaction.objectStore('events');
        }
        if (event.oldVersion < 2 && eventsStore) {
          migrateEventsStoreToCompact(eventsStore);
        }
      };
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
}

function decodeTarget(code) {
  return code === TARGET_CODE.retour || code === 'retour' ? 'retour' : 'geleverd';
}

function decodeStorage(code) {
  return code === STORAGE_CODE.freezer || code === 'freezer' ? 'freezer' : 'main';
}

function decodeLifecycleAction(code) {
  if (code === LIFECYCLE_CODE.deleted || code === 'deleted') return 'deleted';
  if (code === LIFECYCLE_CODE.renamed || code === 'renamed') return 'renamed';
  return 'created';
}

function isCompactEventRecord(record) {
  return !!(
    record &&
    (
      Array.isArray(record.d) ||
      record.k === 'l' ||
      record.t === TARGET_CODE.geleverd ||
      record.t === TARGET_CODE.retour
    )
  );
}

function encodeEventRecord(record) {
  if (!record) return record;
  if (isCompactEventRecord(record)) return { ...record };

  const encoded = {
    g: Number(record.groupId || 0),
    ts: Number(record.timestamp || 0) || Date.now()
  };
  if (record.id != null) encoded.id = Number(record.id);

  if (record.kind === 'lifecycle') {
    encoded.k = 'l';
    encoded.a = LIFECYCLE_CODE[record.action] || LIFECYCLE_CODE.created;
    const currentName = String(record.groupName || record.newName || '').trim();
    if (currentName) encoded.n = currentName;
    if (record.action === 'renamed') {
      const oldName = String(record.oldName || '').trim();
      if (oldName) encoded.o = oldName;
    }
    return encoded;
  }

  encoded.t = TARGET_CODE[record.target === 'retour' ? 'retour' : 'geleverd'];
  encoded.s = STORAGE_CODE[normalizeStorage(record.storage)];
  encoded.d = [];
  const input = String(record.input || '').trim();
  if (input) encoded.i = input;

  for (const tokenId of TOKEN_ORDER) {
    const value = Number(record?.[tokenId] || 0);
    if (value === 0) continue;
    encoded.d.push([TOKEN_INDEX_BY_ID.get(tokenId), value]);
  }

  return encoded;
}

function decodeEventRecord(record) {
  if (!record) return record;
  if (!isCompactEventRecord(record)) return { ...record };

  const decoded = {
    id: record.id,
    groupId: Number(record.g || 0),
    timestamp: Number(record.ts || 0)
  };

  if (record.k === 'l') {
    const action = decodeLifecycleAction(record.a);
    decoded.kind = 'lifecycle';
    decoded.action = action;
    if (record.n) decoded.groupName = String(record.n);
    if (action === 'renamed') {
      decoded.oldName = String(record.o || '');
      decoded.newName = String(record.n || '');
    }
    return decoded;
  }

  decoded.target = decodeTarget(record.t);
  decoded.storage = decodeStorage(record.s);
  if (record.i || record.input) decoded.input = String(record.i || record.input || '');
  for (const entry of Array.isArray(record.d) ? record.d : []) {
    const [tokenIndex, rawValue] = entry;
    const tokenId = TOKEN_ORDER[Number(tokenIndex)];
    const value = Number(rawValue || 0);
    if (!tokenId || value === 0) continue;
    decoded[tokenId] = value;
  }
  return decoded;
}

function migrateEventsStoreToCompact(eventsStore) {
  eventsStore.openCursor().onsuccess = (event) => {
    const cursor = event.target.result;
    if (!cursor) return;
    const value = cursor.value;
    if (!isCompactEventRecord(value)) {
      cursor.update(encodeEventRecord({ ...value, id: value?.id ?? cursor.primaryKey }));
    }
    cursor.continue();
  };
}

export async function openDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName(), DB_VERSION);

    req.onupgradeneeded = e => {
      db = e.target.result;
      if (!db.objectStoreNames.contains('groups')) {
        db.createObjectStore('groups', { keyPath: 'id', autoIncrement: true });
      }
      let eventsStore = null;
      if (!db.objectStoreNames.contains('events')) {
        eventsStore = db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
      } else {
        eventsStore = e.target.transaction.objectStore('events');
      }
      if (e.oldVersion < 2 && eventsStore) {
        migrateEventsStoreToCompact(eventsStore);
      }
    };

    req.onsuccess = e => {
      db = e.target.result;
      resolve(db);
    };

    req.onerror = () => reject(req.error);
  });
}

function openProjectDB(projectId = currentProjectId) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbNameForProject(projectId), DB_VERSION);

    req.onupgradeneeded = (e) => {
      const openedDb = e.target.result;
      if (!openedDb.objectStoreNames.contains('groups')) {
        openedDb.createObjectStore('groups', { keyPath: 'id', autoIncrement: true });
      }
      let eventsStore = null;
      if (!openedDb.objectStoreNames.contains('events')) {
        eventsStore = openedDb.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
      } else {
        eventsStore = e.target.transaction.objectStore('events');
      }
      if (e.oldVersion < 2 && eventsStore) {
        migrateEventsStoreToCompact(eventsStore);
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
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
  const encoded = encodeEventRecord({
    ...evt,
    timestamp: Date.now()
  });
  await req(store('events', 'readwrite').add(encoded));
}

export async function getGroupsWithTotals() {
  await openDB();
  const groups = await req(store('groups').getAll());
  const events = (await req(store('events').getAll())).map(decodeEventRecord);

  return groups.map(g => {
    const ev = events.filter(e => e.groupId === g.id);
    const storage = emptyStorageTotals();

    for (const evt of ev) {
      const target = evt?.target === 'retour' ? 'retour' : evt?.target === 'geleverd' ? 'geleverd' : null;
      if (!target) continue;
      const bucket = storage[normalizeStorage(evt?.storage)][target];
      for (const k of TOKEN_ORDER) {
        bucket[k] += Number(evt?.[k] || 0);
      }
    }

    return {
      ...g,
      storage,
      geleverd: sumStorageModeTotals(storage, 'geleverd'),
      retour: sumStorageModeTotals(storage, 'retour')
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
  const events = (await req(store('events').getAll())).map(decodeEventRecord);
  const id = groupId == null ? null : Number(groupId);

  const filtered = events.filter(e => {
    if (id == null) return true;
    return Number(e.groupId) === id;
  });

  filtered.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  return filtered.slice(0, Math.max(1, Number(limit) || 500));
}

async function exportSnapshotFromDb(targetDb) {
  const tx = targetDb.transaction(['groups', 'events'], 'readonly');
  const groups = await req(tx.objectStore('groups').getAll());
  const events = (await req(tx.objectStore('events').getAll())).map(decodeEventRecord);
  return {
    groups: groups.map((group) => ({ ...group })),
    events: events.map((event) => ({ ...event }))
  };
}

export async function exportProjectSnapshot() {
  await openDB();
  return exportSnapshotFromDb(db);
}

export async function exportProjectSnapshotForProject(projectId = currentProjectId) {
  const projectDb = await openProjectDB(projectId);
  try {
    return await exportSnapshotFromDb(projectDb);
  } finally {
    try { projectDb.close(); } catch {}
  }
}

export async function replaceProjectWithSnapshot(snapshot) {
  await openDB();
  const safe = snapshot || {};
  const groups = Array.isArray(safe.groups) ? safe.groups : [];
  const events = Array.isArray(safe.events) ? safe.events : [];

  const tx = db.transaction(['groups', 'events'], 'readwrite');
  const groupsOS = tx.objectStore('groups');
  const eventsOS = tx.objectStore('events');
  groupsOS.clear();
  eventsOS.clear();

  for (const g of groups) groupsOS.put({ ...g });
  for (const e of events) eventsOS.put(encodeEventRecord(e));

  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
