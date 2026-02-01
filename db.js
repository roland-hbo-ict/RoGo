let db;

export async function openDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open('logistics-db', 1);

    req.onupgradeneeded = e => {
      db = e.target.result;
      db.createObjectStore('groups', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('aliases', { keyPath: 'short' });
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

function req(req) {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
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
        .reduce(
          (a, b) => ({
            g: a.g + b.g,
            ct: a.ct + b.ct,
            r: a.r + b.r,
            b: a.b + b.b
          }),
          { g: 0, ct: 0, r: 0, b: 0 }
        );

    return {
      ...g,
      geleverd: sum('geleverd'),
      retour: sum('retour')
    };
  });
}

export async function getAliases() {
  await openDB();
  const rows = await req(store('aliases').getAll());
  const map = {};
  rows.forEach(r => (map[r.short] = r.full));
  return map;
}

export async function saveAlias(short, full) {
  await openDB();
  await req(
    store('aliases', 'readwrite').put({
      short: short.toLowerCase(),
      full
    })
  );
}