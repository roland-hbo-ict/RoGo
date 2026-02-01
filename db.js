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
 
export async function ensureGroup(name) {
  const all = await store('groups').getAll();
  let g = all.find(x => x.name === name);
  if (!g) {
    store('groups', 'readwrite').add({ name, createdAt: Date.now() });
    g = (await store('groups').getAll()).find(x => x.name === name);
  }
  return g.id;
}
 
export async function addEvent(evt) {
  evt.timestamp = Date.now();
  store('events', 'readwrite').add(evt);
}
 
export async function getGroupsWithTotals() {
  const groups = await store('groups').getAll();
  const events = await store('events').getAll();
 
  return groups.map(g => {
    const e = events.filter(x => x.groupId === g.id);
 
    const sum = t =>
      e.filter(x => x.target === t)
       .reduce((a, b) => ({
         g: a.g + b.g,
         ct: a.ct + b.ct,
         r: a.r + b.r,
         b: a.b + b.b
       }), { g: 0, ct: 0, r: 0, b: 0 });
 
    return { ...g, geleverd: sum('geleverd'), retour: sum('retour') };
  });
}
 
export async function getAliases() {
  const a = await store('aliases').getAll();
  const map = {};
  a.forEach(x => map[x.short.toLowerCase()] = x.full);
  return map;
}