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

export function generateAliases(groups) {
  const names = groups.map(g => g.name.toLowerCase());
  const aliases = {};

  // 1. group by first letter
  const buckets = {};
  for (const name of names) {
    const key = name[0];
    buckets[key] ||= [];
    buckets[key].push(name);
  }

  // 2. resolve each bucket independently
  for (const bucket of Object.values(buckets)) {
    let unresolved = [...bucket];
    let length = 1;

    while (unresolved.length) {
      const map = {};

      for (const name of unresolved) {
        const prefix = name.slice(0, length);
        map[prefix] ||= [];
        map[prefix].push(name);
      }

      unresolved = [];

      for (const [prefix, list] of Object.entries(map)) {
        if (list.length === 1) {
          aliases[prefix] = list[0];
        } else {
          unresolved.push(...list);
        }
      }

      length++;
    }
  }

  return aliases;
}

export async function getAliases() {
  const groups = await getGroups();
  return generateAliases(groups);
}