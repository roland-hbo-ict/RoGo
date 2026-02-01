export let db;

export async function openDB() {
  if (db) return;

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
      resolve();
    };

    req.onerror = () => reject(req.error);
  });
}

function store(name, mode = 'readonly') {
  return db.transaction(name, mode).objectStore(name);
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function ensureGroup(name) {
  const groups = await reqToPromise(store('groups').getAll());

  let g = groups.find(x => x.name === name);
  if (!g) {
    await reqToPromise(
      store('groups', 'readwrite').add({
        name,
        createdAt: Date.now()
      })
    );
    return ensureGroup(name);
  }
  return g.id;
}

export async function addEvent(evt) {
  evt.timestamp = Date.now();
  await reqToPromise(store('events', 'readwrite').add(evt));
}

export async function getGroupsWithTotals() {
  const groups = await reqToPromise(store('groups').getAll());
  const events = await reqToPromise(store('events').getAll());

  return groups.map(g => {
    const e = events.filter(x => x.groupId === g.id);

    const sum = target =>
      e
        .filter(x => x.target === target)
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
  const rows = await reqToPromise(store('aliases').getAll());
  const map = {};
  rows.forEach(x => (map[x.short.toLowerCase()] = x.full));
  return map;
}