import { parseAndExecute } from './parser.js';
import {
  getGroupsWithTotals,
  ensureGroup,
  addEvent,
  renameGroup,
  deleteGroups,
  getHistoryEvents,
  setCurrentProject,
  getCurrentProject,
  exportProjectSnapshot,
  replaceProjectWithSnapshot
} from './db.js';
import {
  TOKEN_ORDER,
  getTokenDefs,
  buildAliasMap,
  displayKey,
  searchTokens,
  formatTokenOption
} from './tokens.js';

const list = document.getElementById('list');
const cmd = document.getElementById('cmd');
const preview = document.getElementById('preview');
const feedback = document.getElementById('feedback');
const chipsEl = document.getElementById('chips');

let selectedGroup = null;
let selectedMode = null;

let modeHintTimer = null;
let feedbackDismissTimer = null;
let selectionMode = false;
let selectedGroupIds = new Set();
let suppressClickUntil = 0;
let longPressTimer = null;
let longPressData = null;
let dragGroupId = null;
let historyTimeMode = 'relative';
let historyRefreshTimer = null;
const GROUP_ORDER_KEY = 'rogo_group_order';
const TOTALS_COLLAPSED_KEY = 'rogo_totals_collapsed';
const PROJECTS_KEY = 'rogo_projects';
const CURRENT_PROJECT_KEY = 'rogo_project_current';
const TEMPLATES_KEY = 'rogo_templates';
const PANEL_OPEN_ICON_SVG = '<svg class="icon-svg icon-arrow-left" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 12H6"/><path d="M11 7L6 12L11 17"/></svg>';
const PROJECT_MENU_ICON_SVG = '<svg class="icon-svg icon-kebab" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
const PANEL_SETTINGS_ICON_SVG = '<svg class="icon-svg icon-gear" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83a2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2a2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0a2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2a2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83a2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2a2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0a2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2a2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>';
const PANEL_SETTINGS_CLOSE_ICON_SVG = '<svg class="icon-svg icon-close" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6L18 18"/><path d="M18 6L6 18"/></svg>';

const I18N = {
  nl: {
    delivered: 'Geleverd',
    returned: 'Retour',
    deliveredLower: 'geleverd',
    returnedLower: 'retour',
    newItem: 'Nieuwe klant',
    itemName: 'Klant naam',
    newItemPlaceholder: 'Nieuwe klant aanmaken…',
    pressEnter: 'Druk op Enter om aan te maken',
    cancel: 'Annuleren',
    create: 'Aanmaken',
    settings: 'Instellingen',
    projects: 'Routes',
    templates: 'Templates',
    projectsTitle: 'Routes',
    templatesTitle: 'Templates',
    search: 'Zoeken...',
    newProjectPlaceholder: 'Nieuwe routenaam',
    templatePlaceholder: 'Template naam',
    createProject: 'Aanmaken',
    createMode: 'Aanmaken modus',
    createModeNew: 'Nieuwe route',
    createModeTemplate: 'Gebruik template',
    templateSource: 'Kies template',
    noTemplates: 'Geen templates beschikbaar',
    preview: 'Preview',
    templatePreview: 'Template preview',
    previewCards: 'Bekijk kaarten',
    noCardsInTemplate: 'Geen kaarten in deze template',
    saveTemplate: 'Opslaan',
    saveAsTemplate: 'Als template opslaan',
    switchProject: 'Open',
    rename: 'Naam wijzigen',
    remove: 'Verwijderen',
    projectActions: 'Route acties',
    templateActions: 'Template acties',
    apply: 'Gebruik',
    panelOpen: 'Open zijpaneel',
    projectDeleted: 'Route verwijderd',
    projectCreated: 'Route aangemaakt',
    projectRenamed: 'Route hernoemd',
    templateSaved: 'Template opgeslagen',
    templateApplied: 'Template toegepast',
    templateDeleted: 'Template verwijderd',
    templateRenamed: 'Template hernoemd',
    cannotDeleteLastProject: 'Minimaal 1 route vereist',
    confirmDeleteProject: (name) => `Route "${name}" verwijderen?`,
    confirmDeleteTemplate: (name) => `Template "${name}" verwijderen?`,
    projectNamePrompt: 'Routenaam',
    templateNamePrompt: 'Template naam',
    install: 'Installeren',
    import: 'Importeren',
    installRoGoAsApp: 'Installeer RoGo als app',
    installed: 'Geïnstalleerd',
    installDismissed: 'Installatie geannuleerd',
    installOnIphone: 'Op iPhone: Deel → "Zet op beginscherm"',
    resetApp: 'App resetten',
    resetAppSub: 'Wis alle lokale data + ververs',
    importCards: 'Klanten importeren',
    importCardsSub: 'Plak gekopieerde klanttekst',
    importCardsPlaceholder: 'Plak klanten hier...',
    reorderCards: 'Klanten herordenen',
    reorderCardsSub: 'Verplaats namen zonder details',
    reorder: 'Herordenen',
    history: 'Historie',
    globalHistory: 'Globale historie',
    allTotals: 'Alle totalen',
    total: 'Totaal',
    name: 'Naam',
    globalHistorySub: 'Alle klantgebeurtenissen',
    open: 'Openen',
    noHistory: 'Geen historie gevonden',
    created: 'Aangemaakt',
    deleted: 'Verwijderd',
    renamed: 'Hernoemd',
    lastModified: 'Laatst gewijzigd',
    moveUp: 'Omhoog',
    moveDown: 'Omlaag',
    importSuccess: (n) => `✔ ${n} klanten geïmporteerd`,
    reordered: '✔ Volgorde opgeslagen',
    importNoCards: '⚠ Geen geldige kaarten gevonden',
    importFailed: 'Importeren mislukt',
    language: 'Taal',
    languageSub: 'Nederlands / Engels',
    cardLayout: 'Klantweergave',
    cardLayoutSub: 'Klassiek / Compact',
    classic: 'Klassiek',
    compact: 'Compact',
    theme: 'Thema',
    themeSub: 'Donker / Licht',
    handed: 'Links-handig',
    handedSub: 'Knoppen links',
    continuousCreation: 'Doorlopend aanmaken',
    continuousCreationSub: 'Aanmaken-popup open houden',
    close: 'Sluiten',
    send: 'Versturen',
    selectedCount: (n) => `${n} geselecteerd`,
    copy: 'Kopiëren',
    share: 'Delen',
    delete: 'Verwijderen',
    done: 'Klaar',
    copiedCards: (n) => `✔ ${n} klanten gekopieerd`,
    sharedCards: (n) => `✔ ${n} klanten gedeeld`,
    deletedCards: (n) => `✔ ${n} klanten verwijderd`,
    deleteSelectedConfirm: (n) => `${n} geselecteerde klanten verwijderen?`,
    selectMode: 'Selecteer geleverd of retour',
    selectItemFirst: 'Selecteer eerst een klant',
    cmdPlaceholder: '15g 1ct',
    added: (name) => `✔ Toegevoegd ${name}`,
    renamedTo: (name) => `✔ Hernoemd naar ${name}`,
    saved: (line) => `✔ Opgeslagen ${line}`,
    tooLow: (name, cur, next) => `⚠ Te laag: ${name} (${cur} → ${next})`,
    error: 'Fout',
    resetConfirm: 'RoGo resetten?\n\nDit verwijdert ALLE lokale data op dit apparaat en herlaadt de app.',
    placeholderExample: `15k 1c`,
  },
  en: {
    delivered: 'Delivered',
    returned: 'Return',
    deliveredLower: 'delivered',
    returnedLower: 'return',
    newItem: 'New customer',
    itemName: 'Customer name',
    newItemPlaceholder: 'Create new customer…',
    pressEnter: 'Press Enter to create',
    cancel: 'Cancel',
    create: 'Create',
    settings: 'Settings',
    projects: 'Routes',
    templates: 'Templates',
    projectsTitle: 'Routes',
    templatesTitle: 'Templates',
    search: 'Search...',
    newProjectPlaceholder: 'New route name',
    templatePlaceholder: 'Template name',
    createProject: 'Create',
    createMode: 'Create mode',
    createModeNew: 'Create new route',
    createModeTemplate: 'Use template',
    templateSource: 'Choose template',
    noTemplates: 'No templates available',
    preview: 'Preview',
    templatePreview: 'Template preview',
    previewCards: 'Preview cards',
    noCardsInTemplate: 'No cards in this template',
    saveTemplate: 'Save',
    saveAsTemplate: 'Save as template',
    switchProject: 'Open',
    rename: 'Change name',
    remove: 'Delete',
    projectActions: 'Route actions',
    templateActions: 'Template actions',
    apply: 'Apply',
    panelOpen: 'Open panel',
    projectDeleted: 'Route deleted',
    projectCreated: 'Route created',
    projectRenamed: 'Route renamed',
    templateSaved: 'Template saved',
    templateApplied: 'Template applied',
    templateDeleted: 'Template deleted',
    templateRenamed: 'Template renamed',
    cannotDeleteLastProject: 'At least 1 route is required',
    confirmDeleteProject: (name) => `Delete route "${name}"?`,
    confirmDeleteTemplate: (name) => `Delete template "${name}"?`,
    projectNamePrompt: 'Route name',
    templateNamePrompt: 'Template name',
    install: 'Install',
    import: 'Import',
    installRoGoAsApp: 'Install RoGo as an app',
    installed: 'Installed',
    installDismissed: 'Install dismissed',
    installOnIphone: 'On iPhone: Share → "Add to Home Screen"',
    resetApp: 'Reset app',
    resetAppSub: 'Clear all local data + refresh',
    importCards: 'Import customers',
    importCardsSub: 'Paste copied customer text',
    importCardsPlaceholder: 'Paste customers here...',
    reorderCards: 'Re-order customers',
    reorderCardsSub: 'Move names without details',
    reorder: 'Re-order',
    history: 'History',
    globalHistory: 'Global history',
    allTotals: 'All totals',
    total: 'Total',
    name: 'Name',
    globalHistorySub: 'All customer events',
    open: 'Open',
    noHistory: 'No history found',
    created: 'Created',
    deleted: 'Deleted',
    renamed: 'Renamed',
    lastModified: 'Last modified',
    moveUp: 'Up',
    moveDown: 'Down',
    importSuccess: (n) => `✔ Imported ${n} customers`,
    reordered: '✔ Order saved',
    importNoCards: '⚠ No valid cards found',
    importFailed: 'Import failed',
    language: 'Language',
    languageSub: 'Dutch / English',
    cardLayout: 'Customer layout',
    cardLayoutSub: 'Classic / Compact',
    classic: 'Classic',
    compact: 'Compact',
    theme: 'Theme',
    themeSub: 'Dark / Light',
    handed: 'Left-handed',
    handedSub: 'Buttons on left',
    continuousCreation: 'Continuous creation',
    continuousCreationSub: 'Keep creation popup open',
    close: 'Close',
    send: 'Send',
    selectedCount: (n) => `${n} selected`,
    copy: 'Copy',
    share: 'Share',
    delete: 'Delete',
    done: 'Done',
    copiedCards: (n) => `✔ Copied ${n} customers`,
    sharedCards: (n) => `✔ Shared ${n} customers`,
    deletedCards: (n) => `✔ Deleted ${n} customers`,
    deleteSelectedConfirm: (n) => `Delete ${n} selected customers?`,
    selectMode: 'Select delivered or return',
    selectItemFirst: 'Select a customer first',
    cmdPlaceholder: '15g 1ct',
    added: (name) => `✔ Added ${name}`,
    renamedTo: (name) => `✔ Renamed to ${name}`,
    saved: (line) => `✔ Saved ${line}`,
    tooLow: (name, cur, next) => `⚠ Too low: ${name} (${cur} → ${next})`,
    error: 'Error',
    resetConfirm: 'Reset RoGo?\n\nThis deletes ALL local data on this device and reloads the app.',
    placeholderExample: `15k 1c`,
  }
};

let deferredInstallPrompt = null;
let openProjectMenuId = null;
let openTemplateMenuId = null;
let settingsSectionPinned = false;

const installRow  = document.getElementById('installRow');
const installBtn  = document.getElementById('installBtn');
const installHint = document.getElementById('installHint');

function isStandalone() {
  // iOS uses navigator.standalone, others use display-mode
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
}

function showInstallUI(reasonText) {
  if (!installRow || !installBtn || !installHint) return;

  installRow.style.display = 'flex';
  if (reasonText) installHint.textContent = reasonText;

  // If already installed, disable button
  if (isStandalone()) {
    installBtn.disabled = true;
    installBtn.textContent = t('installed');
  }
}

function hideInstallUI() {
  if (!installRow) return;
  installRow.style.display = 'none';
}

// Fired on Chrome/Edge/Android when install is possible
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallUI(t('installRoGoAsApp'));
});

// If user installs via browser UI
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  showInstallUI(`${t('installed')} ✓`);
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    // If already installed, do nothing
    if (isStandalone()) return;

    // iOS/Safari: no beforeinstallprompt -> show instructions
    if (!deferredInstallPrompt) {
      showInstallUI(t('installOnIphone'));
      return;
    }

    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;

    if (choice?.outcome === 'accepted') {
      showInstallUI(`${t('installed')} ✓`);
    } else {
      showInstallUI(t('installDismissed'));
    }
  });
}

// Initial state when opening app:
// - If already installed: show "Installed"
// - If not installable yet: hide (or show iOS hint if you want)
if (isStandalone()) {
  showInstallUI(`${t('installed')} ✓`);
} else {
  hideInstallUI();
}

function focusCmdSoon() {
  // next frame: after DOM + disabled state settles
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!cmd) return;
      try {
        cmd.focus({ preventScroll: true });
      } catch {
        cmd.focus();
      }
    });
  });
}

function scrollSelectedCardToTopSoon() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.querySelector('.group.selected');
      if (!el) return;
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  });
}

function focusNewGroupInputAtBottom() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const input = document.getElementById('newGroupInput');
      if (!input) return;
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
    });
  });
}

function scrollCardByNameToTopSoon(name) {
  if (!name) return;
  const needle = String(name);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const card = [...list.querySelectorAll('.group[data-name]')]
        .find(el => el.dataset.name === needle);
      if (!card) return;
      card.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  });
}

function getLang() {
  return localStorage.getItem('rogo_lang') || 'nl';
}
function t(key, ...args) {
  const lang = getLang();
  const v = I18N[lang]?.[key] ?? I18N.nl[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}

function getCardLayout() {
  const raw = localStorage.getItem('rogo_card_layout');
  return raw === 'classic' ? 'classic' : 'compact';
}

function readProjects() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function ensureProjectsSetup() {
  let projects = readProjects();
  if (!projects.length) {
    projects = [{ id: 'default', name: 'Route 0', createdAt: Date.now() }];
    writeProjects(projects);
  } else {
    const defaultProject = projects.find((p) => p?.id === 'default');
    if (defaultProject && ['default', 'route 0'].includes(String(defaultProject.name || '').trim().toLowerCase())) {
      defaultProject.name = 'Route 0';
      writeProjects(projects);
    }
  }

  let current = localStorage.getItem(CURRENT_PROJECT_KEY) || projects[0].id;
  if (!projects.some(p => p.id === current)) {
    current = projects[0].id;
    localStorage.setItem(CURRENT_PROJECT_KEY, current);
  }
  setCurrentProject(current);
  return { projects, current };
}

function projectOrderKey() {
  return `${GROUP_ORDER_KEY}_${getCurrentProject()}`;
}

function readTemplates() {
  try {
    const raw = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeTemplates(templates) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

function refreshCreateTemplateOptions() {
  if (!createProjectTemplateSelect) return;
  const templates = readTemplates();
  const current = createProjectTemplateSelect.value;
  if (!templates.length) {
    createProjectTemplateSelect.innerHTML = `<option value="">${escapeHtml(t('noTemplates'))}</option>`;
    createProjectTemplateSelect.disabled = true;
    if (createProjectBtn && createProjectMode === 'template') createProjectBtn.disabled = true;
    return;
  }

  createProjectTemplateSelect.innerHTML = templates
    .map((tpl) => `<option value="${escapeHtml(tpl.id)}">${escapeHtml(tpl.name)}</option>`)
    .join('');

  const keep = templates.some((tpl) => tpl.id === current);
  createProjectTemplateSelect.value = keep ? current : templates[0].id;
  createProjectTemplateSelect.disabled = false;
  if (createProjectBtn && createProjectMode === 'template') createProjectBtn.disabled = false;
}

function renderCreateProjectModeControls() {
  if (createProjectBtn) createProjectBtn.textContent = createProjectMode === 'template' ? t('createModeTemplate') : t('createProject');
  if (createProjectModeBtn) {
    createProjectModeBtn.setAttribute('aria-label', t('createMode'));
    createProjectModeBtn.setAttribute('title', t('createMode'));
  }
  if (createModeNewBtn) createModeNewBtn.textContent = t('createModeNew');
  if (createModeTemplateBtn) createModeTemplateBtn.textContent = t('createModeTemplate');
  if (createProjectModeMenu) createProjectModeMenu.classList.toggle('open', createProjectModeMenuOpen);
  if (createProjectTemplateRow) createProjectTemplateRow.classList.toggle('hidden', createProjectMode !== 'template');
  if (createProjectTemplateSelect) createProjectTemplateSelect.setAttribute('aria-label', t('templateSource'));
  refreshCreateTemplateOptions();
}

function getStoredGroupOrder() {
  try {
    const raw = localStorage.getItem(projectOrderKey());
    const ids = JSON.parse(raw || '[]');
    return Array.isArray(ids) ? ids.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

function isAllTotalsCollapsed() {
  return localStorage.getItem(TOTALS_COLLAPSED_KEY) === '1';
}

function setAllTotalsCollapsed(v) {
  localStorage.setItem(TOTALS_COLLAPSED_KEY, v ? '1' : '0');
}

function setStoredGroupOrder(ids) {
  localStorage.setItem(projectOrderKey(), JSON.stringify(ids.map(Number)));
}

function orderGroups(groups) {
  const order = getStoredGroupOrder();
  const map = new Map(groups.map(g => [Number(g.id), g]));
  const used = new Set();
  const sorted = [];

  for (const id of order) {
    const g = map.get(id);
    if (g) {
      sorted.push(g);
      used.add(id);
    }
  }

  for (const g of groups) {
    const id = Number(g.id);
    if (!used.has(id)) sorted.push(g);
  }

  const nextOrder = sorted.map(g => Number(g.id));
  if (JSON.stringify(nextOrder) !== JSON.stringify(order)) {
    setStoredGroupOrder(nextOrder);
  }
  return sorted;
}

function moveGroupBefore(sourceId, targetId) {
  const order = getStoredGroupOrder();
  const src = Number(sourceId);
  const dst = Number(targetId);
  if (!order.includes(src) || !order.includes(dst) || src === dst) return;
  const filtered = order.filter(id => id !== src);
  const targetIdx = filtered.indexOf(dst);
  filtered.splice(targetIdx, 0, src);
  setStoredGroupOrder(filtered);
}

function moveGroupByStep(groupId, direction) {
  const order = getStoredGroupOrder();
  const id = Number(groupId);
  const idx = order.indexOf(id);
  if (idx < 0) return;

  const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (nextIdx < 0 || nextIdx >= order.length) return;

  const swapped = [...order];
  const tmp = swapped[idx];
  swapped[idx] = swapped[nextIdx];
  swapped[nextIdx] = tmp;
  setStoredGroupOrder(swapped);
}

function updateSelectionBarUI() {
  const bar = document.getElementById('selectionBar');
  const countEl = document.getElementById('selCount');
  const copyBtn = document.getElementById('selCopy');
  const shareBtn = document.getElementById('selShare');
  const delBtn = document.getElementById('selDelete');

  if (bar) bar.classList.toggle('hidden', !selectionMode);

  const count = selectedGroupIds.size;
  if (countEl) countEl.textContent = t('selectedCount', count);
  if (copyBtn) copyBtn.disabled = count === 0;
  if (shareBtn) shareBtn.disabled = count === 0;
  if (delBtn) delBtn.disabled = count === 0;
}

function exitSelectionMode() {
  selectionMode = false;
  selectedGroupIds.clear();
  updateSelectionBarUI();
}

async function buildSelectedCardsText() {
  const all = orderGroups(await getGroupsWithTotals());
  const chosen = all.filter(g => selectedGroupIds.has(Number(g.id)));
  const defs = getTokenDefs();
  const cards = [];

  for (const g of chosen) {
    const geleverdLines = [];
    const retourLines = [];

    for (const k of TOKEN_ORDER) {
      const gv = Number(g.geleverd?.[k] || 0);
      const rv = Number(g.retour?.[k] || 0);
      if (gv === 0 && rv === 0) continue;
      const fullName = tokenNameNL(defs, k);
      const ref = displayKey(defs, k);
      geleverdLines.push(`${fullName} ${gv} ${ref}`);
      retourLines.push(`${fullName} ${rv} ${ref}`);
    }

    cards.push(
      `${g.name} - ${t('delivered')}:\n${geleverdLines.join('\n') || '-'}\n\n${t('returned')}:\n${retourLines.join('\n') || '-'}`
    );
  }

  return cards.join('\n\n___\n\n');
}

function normalizeTextKey(s) {
  return String(s || '').trim().toLowerCase();
}

function parseImportSection(sectionText, defs, aliasMap) {
  const out = Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));
  const byName = new Map(
    TOKEN_ORDER.map(id => [normalizeTextKey(defs?.[id]?.name_nl || id), id])
  );

  const lines = String(sectionText || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => l !== '-');

  for (const line of lines) {
    const m = line.match(/^(.*\S)\s+(-?\d+)\s+([a-zA-Z_]+)$/);
    if (!m) continue;

    const fullName = normalizeTextKey(m[1]);
    const qty = Number(m[2]);
    const ref = String(m[3] || '').toLowerCase();

    let id = byName.get(fullName);
    if (!id && aliasMap[ref]) id = aliasMap[ref];
    if (!id) continue;

    out[id] += qty;
  }

  return out;
}

function parseImportCardsText(inputText) {
  const defs = getTokenDefs();
  const aliasMap = buildAliasMap(defs);
  const chunks = String(inputText || '')
    .split(/\n\s*___\s*\n/g)
    .map(c => c.trim())
    .filter(Boolean);

  const cards = [];
  for (const chunk of chunks) {
    const m = chunk.match(/^\s*(.+?)\s*-\s*(?:Geleverd|Delivered)\s*:\s*([\s\S]*?)\n\s*(?:Retour|Return)\s*:\s*([\s\S]*?)\s*$/i);
    if (!m) continue;

    const name = String(m[1] || '').trim();
    if (!name) continue;

    const geleverd = parseImportSection(m[2], defs, aliasMap);
    const retour = parseImportSection(m[3], defs, aliasMap);

    cards.push({ name, geleverd, retour });
  }

  return cards;
}

function buildEventPayload(groupId, groupName, target, totals) {
  const evt = { groupId, groupName, target };
  for (const k of TOKEN_ORDER) {
    const v = Number(totals?.[k] || 0);
    if (v !== 0) evt[k] = v;
  }
  return evt;
}

async function importCardsFromText(inputText) {
  const parsed = parseImportCardsText(inputText);
  if (!parsed.length) return 0;

  const existing = await getGroupsWithTotals();
  const byName = new Map(existing.map(g => [normalizeTextKey(g.name), g]));

  for (const card of parsed) {
    const existingGroup = byName.get(normalizeTextKey(card.name));
    let groupId;
    let curG = Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));
    let curR = Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));

    if (existingGroup) {
      groupId = Number(existingGroup.id);
      curG = existingGroup.geleverd || curG;
      curR = existingGroup.retour || curR;
    } else {
      groupId = Number(await ensureGroup(card.name));
      byName.set(normalizeTextKey(card.name), {
        id: groupId,
        name: card.name,
        geleverd: curG,
        retour: curR
      });
    }

    const deltaG = Object.fromEntries(TOKEN_ORDER.map(k => [k, Number(card.geleverd?.[k] || 0) - Number(curG?.[k] || 0)]));
    const deltaR = Object.fromEntries(TOKEN_ORDER.map(k => [k, Number(card.retour?.[k] || 0) - Number(curR?.[k] || 0)]));

    if (hasAnyDelta(deltaG)) await addEvent(buildEventPayload(groupId, card.name, 'geleverd', deltaG));
    if (hasAnyDelta(deltaR)) await addEvent(buildEventPayload(groupId, card.name, 'retour', deltaR));
  }

  return parsed.length;
}

function startModeHintPulse() {
  stopModeHintPulse();

  // pulse now + every minute, until a mode is chosen
  const pulse = () => {
    const card = document.querySelector(`.group.selected`);
    if (!card) return;

    const buttons = card.querySelectorAll('.stats .title.mode');
    buttons.forEach(b => {
      b.classList.remove('hint');
      void b.offsetWidth;
      b.classList.add('hint');
    });
  };

  pulse();
  modeHintTimer = setInterval(pulse, 10000);
}

function stopModeHintPulse() {
  if (modeHintTimer) clearInterval(modeHintTimer);
  modeHintTimer = null;
}

function loadVersion() {
  const el = document.getElementById('version');
  if (!el) return;

  // Prefer the version resolved in index.html (manifest.json single source of truth)
  const v = window.__ROGO_VERSION__ || localStorage.getItem('rogo_version') || 'dev';
  el.textContent = `v${v}`;
}

function hapticSuccess() {
  navigator.vibrate?.(20);
}

function hapticError() {
  navigator.vibrate?.([30, 20, 30]);
}

function clearFeedbackSoon(ms = 700) {
  if (feedbackDismissTimer) clearTimeout(feedbackDismissTimer);
  feedbackDismissTimer = setTimeout(() => {
    if (!cmd?.value?.trim()) return;
    // Keep active warnings visible.
    if (feedback?.textContent?.trim().startsWith('⚠')) return;
    if (feedback) feedback.textContent = '';
  }, ms);
}

function sumInputTotals(input) {
  const defs = getTokenDefs();
  const aliasMap = buildAliasMap(defs);

  const totals = Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));
  const parts = input.trim().split(/\s+/).filter(Boolean);

  for (const p of parts) {
    const parsed = parsePart(p);
    if (!parsed) continue;

    const val = parsed.value;
    const alias = parsed.alias;
    const key = aliasMap[alias];
    if (!key) continue;

    totals[key] += val;
  }

  return totals;
}

function findNegativeTotals(currentTotals, deltaTotals) {
  const defs = getTokenDefs();
  const problems = [];

  for (const k of TOKEN_ORDER) {
    const cur = Number(currentTotals?.[k] || 0);
    const d = Number(deltaTotals?.[k] || 0);
    const next = cur + d;

    if (next < 0) {
      const name = defs?.[k]?.name_nl || k;
      problems.push({ key: k, name, cur, d, next });
    }
  }

  return problems;
}

function formatTotals(totals) {
  const out = [];
  for (const k of TOKEN_ORDER) {
    const v = totals[k] || 0;
    if (v !== 0) out.push(`${v}${k}`);
  }
  return out.join(' ') || '…';
}

function fmtTs(ts) {
  const d = new Date(Number(ts || 0));
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function fmtTsCompact(ts) {
  const d = new Date(Number(ts || 0));
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatAgo(ts) {
  const lang = getLang();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - Number(ts || 0)) / 1000));

  if (diffSec < 5) return lang === 'nl' ? 'zojuist' : 'just now';
  if (diffSec < 60) return lang === 'nl' ? `${diffSec}s geleden` : `${diffSec}s ago`;

  const min = Math.floor(diffSec / 60);
  if (min < 60) return lang === 'nl' ? `${min}m geleden` : `${min}m ago`;

  const hr = Math.floor(min / 60);
  return lang === 'nl' ? `${hr}u geleden` : `${hr}h ago`;
}

function formatHistoryTimestamp(ts, compact = false) {
  const ageMs = Date.now() - Number(ts || 0);
  const oneDay = 24 * 60 * 60 * 1000;

  if (historyTimeMode === 'relative' && ageMs < oneDay) {
    return formatAgo(ts);
  }
  return compact ? fmtTsCompact(ts) : fmtTs(ts);
}

function refreshHistoryTimestampLabels(root = document) {
  root.querySelectorAll('.history-ts').forEach((el) => {
    const ts = Number(el.dataset.ts || 0);
    const compact = el.dataset.compact === '1';
    el.textContent = formatHistoryTimestamp(ts, compact);
  });
}

function getHistoryRefreshDelayMs() {
  if (historyTimeMode !== 'relative') return 30000;

  const els = [...document.querySelectorAll('.history-ts')];
  if (!els.length) return 30000;

  const now = Date.now();
  const hasYoung = els.some((el) => {
    const ts = Number(el.dataset.ts || 0);
    if (!Number.isFinite(ts) || ts <= 0) return false;
    const age = now - ts;
    return age >= 0 && age < 60000;
  });

  return hasYoung ? 1000 : 30000;
}

function scheduleHistoryRefresh() {
  if (historyRefreshTimer) clearTimeout(historyRefreshTimer);
  historyRefreshTimer = setTimeout(() => {
    refreshHistoryTimestampLabels(document);
    scheduleHistoryRefresh();
  }, getHistoryRefreshDelayMs());
}

function toggleHistoryTimeMode() {
  historyTimeMode = historyTimeMode === 'relative' ? 'absolute' : 'relative';
  refreshHistoryTimestampLabels(document);
  scheduleHistoryRefresh();
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildActionLine(groupName, mode, deltaTotals) {
  const modeLabel = mode === 'retour' ? t('returnedLower') : t('deliveredLower');
  return `${groupName} · ${modeLabel} → ${formatTotals(deltaTotals)}`;
}

function renderCardMiniHistory(events) {
  if (!events?.length) return '';
  const defs = getTokenDefs();

  const rows = events.map((e) => {
    const ts = Number(e.timestamp || 0);

    if (e.kind === 'lifecycle') {
      const action =
        e.action === 'deleted' ? t('deleted')
          : e.action === 'renamed' ? t('renamed')
            : t('created');
      const detail = e.action === 'renamed'
        ? ` ${String(e.oldName || '').trim()} → ${String(e.newName || '').trim()}`
        : '';
      return `<div class="mini-history-row"><span class="mh-ts history-ts" data-ts="${ts}" data-compact="1">${escapeHtml(formatHistoryTimestamp(ts, true))}</span><span class="mh-main">${escapeHtml(action)}</span><span class="mh-delta">${escapeHtml(detail)}</span></div>`;
    }

    const target = e.target === 'retour' ? t('returned') : t('delivered');
    const delta = TOKEN_ORDER
      .map(k => ({ k, v: Number(e?.[k] || 0) }))
      .filter(x => x.v !== 0)
      .map(x => `${x.v > 0 ? '+' : ''}${x.v}${displayKey(defs, x.k)}`)
      .join(' ');

    return `<div class="mini-history-row"><span class="mh-ts history-ts" data-ts="${ts}" data-compact="1">${escapeHtml(formatHistoryTimestamp(ts, true))}</span><span class="mh-main">${escapeHtml(target)}</span><span class="mh-delta">${escapeHtml(delta || '-')}</span></div>`;
  }).join('');

  return `
    <div class="mini-history">
      <div class="mini-history-title">${escapeHtml(t('history'))}</div>
      <div class="mini-history-list">${rows}</div>
    </div>
  `;
}

function hasPositiveTotalsForCard(g) {
  return TOKEN_ORDER.some((k) =>
    Number(g?.geleverd?.[k] || 0) > 0 || Number(g?.retour?.[k] || 0) > 0
  );
}

function sumAllTotals(groups) {
  const geleverd = Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));
  const retour = Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));

  for (const g of groups) {
    for (const k of TOKEN_ORDER) {
      geleverd[k] += Number(g?.geleverd?.[k] || 0);
      retour[k] += Number(g?.retour?.[k] || 0);
    }
  }

  return { geleverd, retour };
}

function renderAllTotalsSummary(groups) {
  const activeCards = groups.filter(hasPositiveTotalsForCard);
  if (activeCards.length < 2) return '';

  const defs = getTokenDefs();
  const { geleverd, retour } = sumAllTotals(groups);
  const collapsed = isAllTotalsCollapsed();
  let sumG = 0;
  let sumR = 0;

  const lines = TOKEN_ORDER
    .filter(k => Number(geleverd[k] || 0) > 0 || Number(retour[k] || 0) > 0)
    .map(k => {
      const g = Number(geleverd[k] || 0);
      const r = Number(retour[k] || 0);
      const d = g - r;
      sumG += g;
      sumR += r;

      return `
        <div class="all-totals-row">
          <span class="all-totals-k">${tokenNameNL(defs, k)}</span>
          <span class="all-totals-g">${g}</span>
          <span class="all-totals-r">${r}</span>
          <span class="all-totals-d ${d < 0 ? 'neg' : ''}">${d > 0 ? '+' : ''}${d}</span>
        </div>
      `;
    })
    .join('');

  if (!lines) return '';
  const sumD = sumG - sumR;

  return `
    <div class="all-totals ${collapsed ? 'collapsed' : ''}">
      <div class="all-totals-top">
        <div class="all-totals-title">${t('allTotals')}</div>
        <div class="all-totals-right">
          <div class="all-totals-toggle">${collapsed ? '▸' : '▾'}</div>
        </div>
      </div>
      <div class="all-totals-head">
        <span class="all-totals-head-k">${t('name')}</span>
        <span>${t('delivered')}</span>
        <span>${t('returned')}</span>
        <span>Δ</span>
      </div>
      <div class="all-totals-list">${lines}</div>
      <div class="all-totals-foot">
        <span class="all-totals-k">${t('total')}</span>
        <span class="all-totals-g">${sumG}</span>
        <span class="all-totals-r">${sumR}</span>
        <span class="all-totals-d ${sumD < 0 ? 'neg' : ''}">${sumD > 0 ? '+' : ''}${sumD}</span>
      </div>
    </div>
  `;
}

function tokenNameNL(defs, id) {
  return defs?.[id]?.name_nl || id;
}

function renderMixedRows(current, delta, showDelta, visibleKeys = TOKEN_ORDER) {
  const order = TOKEN_ORDER;
  const visibleSet = new Set(visibleKeys);

  // If user isn't typing anything valid, just show plain rows
  if (!showDelta) return renderPlainRows(current, visibleKeys);

  // When typing: only show computed rows for keys where delta > 0,
  // but keep other existing (cur>0) rows plain (no +0).
  const lines = [];

  for (const k of order) {
    const cur = current[k] || 0;
    const d = delta[k] || 0;
    if (d !== 0) {
      lines.push(`
        <div class="row delta-row">
          <span class="k">${k}</span>
          <span class="cur">${cur}</span>
          <span class="arrow">→</span>
          <span class="delta ${d < 0 ? 'neg' : ''}">${d > 0 ? '+' : ''}${d}</span>
          <span class="arrow">→</span>
          <span class="res">${cur + d}</span>
        </div>
      `);
    } else if (cur > 0 || visibleSet.has(k)) {
      lines.push(`
        <div class="row plain">
          <span class="k">${k}</span>
          <span class="res">${cur}</span>
        </div>
      `);
    }
  }

  return lines.join('') || `<div class="row muted">—</div>`;
}

function renderPlainRows(current, visibleKeys = null) {
  const defs = getTokenDefs();
  const order = TOKEN_ORDER;
  const visibleSet = visibleKeys ? new Set(visibleKeys) : null;

  return (
    order
      .filter(k => {
        if ((current[k] || 0) !== 0) return true;
        return visibleSet ? visibleSet.has(k) : false;
      })
      .map(k => {
        const name = tokenNameNL(defs, k);
        const ref = displayKey(defs, k);

        return `
          <div class="statline">
            <span class="statname"><span class="statlabel">${name}</span></span>
            <span class="statend"><span class="statendinner">
              <span class="statqty">${current[k]}</span>
              <span class="statref">${ref}</span>
            </span></span>
          </div>
        `;
      })
      .join('') || `<div class="row plain muted">—</div>`
  );
}

function renderPlainPaired(geleverdTotals, retourTotals) {
  const defs = getTokenDefs();

  const left = [];
  const right = [];

  for (const k of TOKEN_ORDER) {
    const g = Number(geleverdTotals?.[k] || 0);
    const r = Number(retourTotals?.[k] || 0);

    // Only show tokens that appear in either column (union)
    if (g === 0 && r === 0) continue;

    const name = tokenNameNL(defs, k);
    const ref = displayKey(defs, k);

    left.push(`
      <div class="statline ${g === 0 ? 'zero' : ''}">
        <span class="statname"><span class="statlabel">${name}</span></span>
        <span class="statend"><span class="statendinner">
          <span class="statqty">${g}</span>
          <span class="statref">${ref}</span>
        </span></span>
      </div>
    `);

    right.push(`
      <div class="statline ${r === 0 ? 'zero' : ''}">
        <span class="statname"><span class="statlabel">${name}</span></span>
        <span class="statend"><span class="statendinner">
          <span class="statqty">${r}</span>
          <span class="statref">${ref}</span>
        </span></span>
      </div>
    `);
  }

  return {
    geleverd: left.join('') || `<div class="row muted">—</div>`,
    retour: right.join('') || `<div class="row muted">—</div>`
  };
}

function renderCompactCell(currentValue, deltaValue, ref, showDelta) {
  if (!showDelta || deltaValue === 0) {
    return `<span class="compact-val">${currentValue}</span><span class="compact-ref">${ref}</span>`;
  }

  const result = currentValue + deltaValue;
  return `
    <span class="compact-flow">
      <span class="compact-cur">${currentValue}</span>
      <span class="compact-arrow">→</span>
      <span class="compact-delta ${deltaValue < 0 ? 'neg' : ''}">${deltaValue > 0 ? '+' : ''}${deltaValue}</span>
      <span class="compact-arrow">→</span>
      <span class="compact-res">${result}</span>
      <span class="compact-ref">${ref}</span>
    </span>
  `;
}

function renderCompactTable(g, isSelected, selectedMode, deltaTotals, showDelta, visibleKeys, geleverdTitle, retourTitle) {
  const defs = getTokenDefs();
  const baseSet = new Set(visibleKeys);
  const deltaKeys = (isSelected && selectedMode && showDelta)
    ? TOKEN_ORDER.filter(k => Number(deltaTotals?.[k] || 0) !== 0)
    : [];
  const rowKeys = TOKEN_ORDER.filter(k => baseSet.has(k) || deltaKeys.includes(k));
  const headMarkup = isSelected
    ? `
      <div class="compact-head">
        <div class="compact-head-label"></div>
        <div class="compact-head-mode geleverd">${geleverdTitle}</div>
        <div class="compact-head-mode retour">${retourTitle}</div>
      </div>
    `
    : '';
  const rows = rowKeys.map((k) => {
    const ref = displayKey(defs, k);
    const gCur = Number(g.geleverd?.[k] || 0);
    const rCur = Number(g.retour?.[k] || 0);
    const gDelta = Number(deltaTotals?.[k] || 0);
    const rDelta = Number(deltaTotals?.[k] || 0);

    const gCell = renderCompactCell(gCur, gDelta, ref, isSelected && selectedMode === 'geleverd' && showDelta);
    const rCell = renderCompactCell(rCur, rDelta, ref, isSelected && selectedMode === 'retour' && showDelta);

    return `
      <div class="compact-row">
        <div class="compact-name">${tokenNameNL(defs, k)}</div>
        <div class="compact-side geleverd ${gCur === 0 ? 'zero' : ''}">${gCell}</div>
        <div class="compact-side retour ${rCur === 0 ? 'zero' : ''}">${rCell}</div>
      </div>
    `;
  });

  return `
    <div class="totals compact">
      ${headMarkup}
      ${rows.join('') || `<div class="row muted">—</div>`}
    </div>
  `;
}

function hasAnyDelta(delta) {
  return Object.values(delta).some(v => v !== 0);
}

function emptyTotals() {
  return Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));
}

async function load() {
  const groups = orderGroups(await getGroupsWithTotals());
  const historyEvents = await getHistoryEvents({ limit: 2000 });
  const historyByGroup = new Map();
  for (const e of historyEvents) {
    const id = Number(e?.groupId);
    if (!Number.isFinite(id)) continue;
    if (!historyByGroup.has(id)) historyByGroup.set(id, []);
    historyByGroup.get(id).push(e);
  }

  const cardLayout = getCardLayout();
  const selectedObj = groups.find(g => g.name === selectedGroup);
  window.__selectedGroupId = selectedObj?.id || null;
  const selectedModeTotals =
    selectedMode === 'retour'
      ? selectedObj?.retour
      : selectedMode === 'geleverd'
        ? selectedObj?.geleverd
        : null;
  window.__selectedTotals = selectedModeTotals || Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));
  list.innerHTML = '';
  list.innerHTML += renderAllTotalsSummary(groups);

  for (const g of groups) {
    const isSelected = g.name === selectedGroup;
    const isMultiSelected = selectedGroupIds.has(Number(g.id));

    const deltaTotals = selectedGroup && selectedMode ? sumInputTotals(cmd.value) : emptyTotals();
    const showDelta = isSelected && !!selectedMode && hasAnyDelta(deltaTotals);

    const needsMode = isSelected && !selectedMode;

    const geleverdTitle = isSelected
      ? `<div class="title mode ${selectedMode === 'geleverd' ? 'active' : ''} ${needsMode ? 'needs' : ''}" data-mode="geleverd">${t('delivered')}</div>`
      : `<div class="title">${t('delivered')}</div>`;

    const retourTitle = isSelected
      ? `<div class="title mode ${selectedMode === 'retour' ? 'active' : ''} ${needsMode ? 'needs' : ''}" data-mode="retour">${t('returned')}</div>`
      : `<div class="title">${t('returned')}</div>`;

    const pairedPlain = renderPlainPaired(g.geleverd, g.retour);
    const visibleKeys = TOKEN_ORDER.filter(k => (Number(g.geleverd?.[k] || 0) !== 0) || (Number(g.retour?.[k] || 0) !== 0));

    const geleverdBlock =
      (isSelected && selectedMode === 'geleverd')
        ? renderMixedRows(g.geleverd, deltaTotals, showDelta, visibleKeys)
        : pairedPlain.geleverd;
    const retourBlock =
      (isSelected && selectedMode === 'retour')
        ? renderMixedRows(g.retour, deltaTotals, showDelta, visibleKeys)
        : pairedPlain.retour;

    const totalsMarkup = cardLayout === 'compact'
      ? renderCompactTable(g, isSelected, selectedMode, deltaTotals, showDelta, visibleKeys, geleverdTitle, retourTitle)
      : `
        <div class="totals">
          <div class="section geleverd">
            <div class="bar"></div>
            <div class="stats">
              ${geleverdTitle}
              ${geleverdBlock}
            </div>
          </div>

          <div class="section retour">
            <div class="bar"></div>
            <div class="stats">
              ${retourTitle}
              ${retourBlock}
            </div>
          </div>
        </div>
      `;

    const rawMiniHistoryEvents = (historyByGroup.get(Number(g.id)) || []).slice(0, 1000);
    const hasOnlyCreated =
      rawMiniHistoryEvents.length === 1 &&
      rawMiniHistoryEvents[0]?.kind === 'lifecycle' &&
      rawMiniHistoryEvents[0]?.action === 'created';
    const miniHistoryEvents = hasOnlyCreated ? [] : rawMiniHistoryEvents.slice(0, 12);
    const latestChange = rawMiniHistoryEvents.find(e => !(e.kind === 'lifecycle' && e.action === 'created'));
    const cardLastModifiedTs = latestChange ? Number(latestChange.timestamp || 0) : 0;
    const cardLastModifiedMarkup = cardLastModifiedTs
      ? `<div class="group-modified"><span class="group-modified-label">${escapeHtml(t('lastModified'))}</span> <span class="history-ts" data-ts="${cardLastModifiedTs}" data-compact="1">${escapeHtml(formatHistoryTimestamp(cardLastModifiedTs, true))}</span></div>`
      : '';

    const miniHistoryMarkup = isSelected ? renderCardMiniHistory(miniHistoryEvents) : '';

    list.innerHTML += `
      <div class="group ${isSelected ? 'selected' : ''} ${isMultiSelected ? 'multi-selected' : ''}" data-id="${g.id}" data-name="${g.name}" draggable="${selectionMode ? 'false' : 'true'}">
        <div class="group-head">
          <input
            class="group-title"
            value="${g.name.replaceAll('"', '&quot;')}"
            data-id="${g.id}"
            data-old="${g.name.replaceAll('"', '&quot;')}"
            spellcheck="false"
          />
          ${cardLastModifiedMarkup}
        </div>

        ${totalsMarkup}
        ${miniHistoryMarkup}
      </div>
    `;
  }

  list.innerHTML += `
    <div class="group new-group" data-name="">
      <input
        id="newGroupInput"
        class="group-title new-group-title"
        placeholder="${t('newItemPlaceholder')}"
        spellcheck="false"
      />
      <div class="new-sub">${t('pressEnter')}</div>
    </div>
  `;

  updateSelectionBarUI();

  cmd.disabled = !(selectedGroup && selectedMode);
  cmd.placeholder = selectedGroup
    ? selectedMode
      ? t('placeholderExample', selectedGroup, selectedMode)
      : t('selectMode')
    : t('selectItemFirst');

  refreshHistoryTimestampLabels(list);
  scheduleHistoryRefresh();
}

list.addEventListener('keydown', async (e) => {
  const el = e.target;

  // Create new item card
  if (el && el.id === 'newGroupInput' && e.key === 'Enter') {
    e.preventDefault();
    const name = el.value.trim();
    if (!name) return;

    try {
      await ensureGroup(name);
      selectedGroup = null;
      selectedMode = null;
      el.value = '';
      await load();
      scrollCardByNameToTopSoon(name);
      focusNewGroupInputAtBottom();

      // small “alive” feedback
      const fb = document.getElementById('feedback');
      if (fb) fb.textContent = t('added', name);
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (err) {
      alert(err?.message || String(err));
    }
    return;
  }

  // Rename existing group titles
  if (el && el.classList?.contains('group-title') && el.dataset?.id && e.key === 'Enter') {
    e.preventDefault();
    el.blur();
  }
});

list.addEventListener('blur', async (e) => {
  const el = e.target;
  if (el?.id === 'newGroupInput') {
    el.value = '';
    return;
  }

  if (!el || !el.classList?.contains('group-title') || !el.dataset?.id) return;

  const id = el.dataset.id;
  const oldName = el.dataset.old || '';
  const next = el.value.trim();

  if (!next || next === oldName) {
    el.value = oldName;
    return;
  }

  try {
    const saved = await renameGroup(id, next);

    // If the renamed one was selected, keep selection consistent
    if (selectedGroup === oldName) selectedGroup = saved;

    el.dataset.old = saved;
    await load();

    const fb = document.getElementById('feedback');
    if (fb) fb.textContent = t('renamedTo', saved);
    if (navigator.vibrate) navigator.vibrate(8);
  } catch (err) {
    el.value = oldName;
    alert(err?.message || String(err));
  }
}, true);


list.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil) {
    e.preventDefault();
    return;
  }

  if (e.target.closest('.all-totals-top')) {
    e.preventDefault();
    setAllTotalsCollapsed(!isAllTotalsCollapsed());
    load();
    return;
  }

  if (e.target.closest('.group-modified')) {
    e.preventDefault();
    e.stopPropagation();
    toggleHistoryTimeMode();
    return;
  }

  const clickedCard = e.target.closest('.group');
  if (selectionMode && clickedCard && !clickedCard.classList.contains('new-group')) {
    const cardId = Number(clickedCard.dataset.id);
    if (!Number.isFinite(cardId)) return;
    if (selectedGroupIds.has(cardId)) selectedGroupIds.delete(cardId);
    else selectedGroupIds.add(cardId);
    if (selectedGroupIds.size === 0) {
      exitSelectionMode();
    } else {
      updateSelectionBarUI();
    }
    load();
    return;
  }

  const titleInput = e.target.closest('input.group-title');
  // Avoid re-render while typing in title inputs (rename/new item).
  if (titleInput) {
    if (titleInput.id === 'newGroupInput') {
      if (selectedGroup || selectedMode) {
        selectedGroup = null;
        selectedMode = null;
        feedback.textContent = '';
        load().then(() => {
          const input = document.getElementById('newGroupInput');
          if (input) input.focus();
          cmd.dispatchEvent(new Event('input'));
        });
      }
      return;
    }
    if (titleInput.dataset?.id) {
      const card = titleInput.closest('.group');
      if (!card) return;

      // Two-click rename UX:
      // 1) first click on another card title selects the card only
      // 2) second click on the selected card title starts editing
      if (card.dataset.name !== selectedGroup) {
        selectedGroup = card.dataset.name;
        selectedMode = null;
        feedback.textContent = '';
        load().then(() => {
          scrollSelectedCardToTopSoon();
          startModeHintPulse();
          cmd.dispatchEvent(new Event('input'));
        });
      }
      return;
    }
  }

  const newGroupCard = e.target.closest('.group.new-group');
  if (newGroupCard) {
    if (selectionMode) return;
    if (selectedGroup || selectedMode) {
      selectedGroup = null;
      selectedMode = null;
      feedback.textContent = '';
      load().then(() => {
        const input = document.getElementById('newGroupInput');
        if (input) input.focus();
        cmd.dispatchEvent(new Event('input'));
      });
    } else {
      newGroupCard.querySelector('#newGroupInput')?.focus();
    }
    return;
  }

  const modeBtn = e.target.closest('.mode');
  const card = e.target.closest('.group');
  if (!card) return;

  // Clicked a mode button (inside selected card)
  if (modeBtn) {
    selectedGroup = card.dataset.name;
    selectedMode = modeBtn.dataset.mode;
    feedback.textContent = '';
    stopModeHintPulse();
    load().then(() => {
      scrollSelectedCardToTopSoon();
      focusCmdSoon();
    });
    return;
  }

  selectedGroup = card.dataset.name;
  selectedMode = null;
  feedback.textContent = '';
  load().then(() => {
    startModeHintPulse();
    cmd.dispatchEvent(new Event('input'));
    focusCmdSoon();
  });
});

function cancelLongPress() {
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = null;
  longPressData = null;
}

list.addEventListener('pointerdown', (e) => {
  if (selectionMode) return;
  if (e.button !== 0) return;
  const card = e.target.closest('.group');
  if (!card || card.classList.contains('new-group')) return;
  if (e.target.closest('.mode')) return;

  const titleInput = e.target.closest('input.group-title');
  if (titleInput?.dataset?.id) return;

  const cardId = Number(card.dataset.id);
  if (!Number.isFinite(cardId)) return;

  longPressData = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    cardId
  };

  longPressTimer = setTimeout(() => {
    selectionMode = true;
    selectedGroup = null;
    selectedMode = null;
    selectedGroupIds.add(cardId);
    stopModeHintPulse();
    cmd.dispatchEvent(new Event('input'));
    suppressClickUntil = Date.now() + 350;
    updateSelectionBarUI();
    load();
    navigator.vibrate?.(18);
    cancelLongPress();
  }, 420);
});

list.addEventListener('pointermove', (e) => {
  if (!longPressData || e.pointerId !== longPressData.pointerId) return;
  const dx = Math.abs(e.clientX - longPressData.startX);
  const dy = Math.abs(e.clientY - longPressData.startY);
  if (dx > 10 || dy > 10) cancelLongPress();
});

list.addEventListener('pointerup', cancelLongPress);
list.addEventListener('pointercancel', cancelLongPress);
list.addEventListener('pointerleave', cancelLongPress);

list.addEventListener('dragstart', (e) => {
  if (selectionMode) {
    e.preventDefault();
    return;
  }
  const card = e.target.closest('.group');
  if (!card || card.classList.contains('new-group')) return;
  dragGroupId = Number(card.dataset.id);
  if (!Number.isFinite(dragGroupId)) return;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
});

list.addEventListener('dragover', (e) => {
  if (selectionMode || !Number.isFinite(dragGroupId)) return;
  const card = e.target.closest('.group');
  if (!card || card.classList.contains('new-group')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
});

list.addEventListener('drop', (e) => {
  if (selectionMode || !Number.isFinite(dragGroupId)) return;
  const target = e.target.closest('.group');
  if (!target || target.classList.contains('new-group')) return;
  e.preventDefault();
  const targetId = Number(target.dataset.id);
  if (!Number.isFinite(targetId)) return;
  moveGroupBefore(dragGroupId, targetId);
  load();
});

list.addEventListener('dragend', () => {
  dragGroupId = null;
  list.querySelectorAll('.group.dragging').forEach(el => el.classList.remove('dragging'));
});

cmd.addEventListener('input', () => {
  // Auto-dismiss success/info feedback once user starts typing again.
  if (cmd.value.trim().length > 0 && feedback?.textContent?.trim()) {
    clearFeedbackSoon(650);
  }

  // chips stay per-token
  const parts = cmd.value.trim().split(/\s+/);
  chipsEl.innerHTML = '';

  const defs = getTokenDefs();
  const aliasMap = buildAliasMap(defs);

  for (const p of parts) {
    if (!p) continue;

    const parsed = parsePart(p);
    const alias = parsed?.alias;   // string or undefined
    const value = parsed?.value;   // number or undefined
    const ok = !!(alias && aliasMap[alias]);

    const chip = document.createElement('div');
    chip.className = 'chip ' + (ok ? 'good' : 'bad');
    chip.textContent = ok ? `${value > 0 ? '+' : ''}${value} ${alias}` : p;
    chipsEl.appendChild(chip);
  }

  // preview shows total of what user typed
  if (selectedGroup && selectedMode) {
    const totals = sumInputTotals(cmd.value);
    // preview.textContent = `${selectedGroup} · ${selectedMode} → ${formatTotals(totals)}`;
    preview.textContent = buildActionLine(selectedGroup, selectedMode, totals);
  } else {
    preview.textContent = '';
  }

  // --- negative-total guard ---
  const sendBtn = document.getElementById('send');

  if (!selectedGroup || !selectedMode) {
    if (sendBtn) sendBtn.disabled = true;
    return;
  }

  // If you already compute this elsewhere, reuse it:
  const deltaTotals = sumInputTotals(cmd.value);

  const currentTotals = (window.__selectedTotals || null); // see 2.4
  const problems = findNegativeTotals(currentTotals, deltaTotals);

  if (problems.length) {
    const p = problems[0]; // show first problem only (keeps it short)
    if (feedback) {
      feedback.textContent = t('tooLow', p.name, p.cur, p.next);
    }
    if (sendBtn) sendBtn.disabled = true;
    if (preview) preview.classList.add('warn');
  } else {
    if (sendBtn) sendBtn.disabled = cmd.value.trim().length === 0;
    if (preview) preview.classList.remove('warn');
    // don’t clear feedback if you use feedback for other things;
    // but if you want warnings to clear automatically:
    // if (feedback && feedback.textContent.startsWith('⚠')) feedback.textContent = '';
  }

  // --- suggestions (non-clickable for now) ---
  if (suggestionsEl) suggestionsEl.innerHTML = '';

  const cleaned = cmd.value.trim();
  const parts2 = cleaned.split(/\s+/).filter(Boolean);
  const last = parts2[parts2.length - 1] || '';

  if (last && suggestionsEl) {
    const parsedLast = parsePart(last);

    if (parsedLast) {
      // Works for both "11bier" and "bier11" (and +/- variants)
      const alias = parsedLast.alias;
      if (!aliasMap[alias]) {
        const hits = searchTokens(defs, alias, 6);
        for (const id of hits) {
          const el = document.createElement('div');
          el.className = 'suggestion';
          el.textContent = formatTokenOption(defs, id);
          suggestionsEl.appendChild(el);
        }
      }
    } else {
      // Plain text query like "bier"
      const q = last.toLowerCase();
      if (!aliasMap[q] && q.length >= 2) {
        const hits = searchTokens(defs, q, 6);
        if (hits.length >= 2) {
          for (const id of hits) {
            const el = document.createElement('div');
            el.className = 'suggestion';
            el.textContent = formatTokenOption(defs, id);
            suggestionsEl.appendChild(el);
          }
        }
      }
    }
  }

  load();
});

async function send() {
  try {
    await parseAndExecute(cmd.value, selectedGroup, selectedMode);
    const deltaTotals = sumInputTotals(cmd.value);
    const savedLine = buildActionLine(selectedGroup, selectedMode, deltaTotals);
    feedback.textContent = t('saved', savedLine);

    preview.classList.remove('pulse');
    void preview.offsetWidth;
    preview.classList.add('pulse');

    hapticSuccess();

    cmd.value = '';
    chipsEl.innerHTML = '';
    preview.textContent = '';

    await load();
  } catch (e) {
    feedback.textContent = '⚠ ' + (e?.message || t('error'));
    preview.classList.remove('pulse');
    void preview.offsetWidth;
    preview.classList.add('pulse');
    hapticError();
  }
}

document.getElementById('send').onclick = send;
cmd.addEventListener('keydown', e => e.key === 'Enter' && send());

window.addEventListener('load', () => {
  loadVersion();
  cmd.focus();
  load();
  startModeHintPulse();
  scheduleHistoryRefresh();
});


/* Modal */
const modal = document.getElementById('modalBackdrop');
const newGroupInput = document.getElementById('newGroupName');

document.addEventListener('keydown', e => {
  if (modal.classList.contains('hidden')) return;

  if (e.key === 'Escape') modal.classList.add('hidden');
  if (e.key === 'Enter') document.getElementById('confirmModal').click();
});

document.getElementById('cancelModal').onclick = () => {
  modal.classList.add('hidden');
};

modal.onclick = e => {
  if (e.target === modal) modal.classList.add('hidden');
};

document.getElementById('confirmModal').onclick = async () => {
  const name = newGroupInput.value.trim();
  if (!name) return;

  await ensureGroup(name);

  if (navigator.vibrate) navigator.vibrate(25);

  // Continuous creation is default: keep creation focus instead of selecting.
  selectedGroup = null;
  selectedMode = null;
  newGroupInput.value = '';
  modal.classList.add('hidden');
  await load();
  scrollCardByNameToTopSoon(name);
  focusNewGroupInputAtBottom();
};

function parsePart(p) {
  // Supports:
  //  12k, -12k, +12k
  //  k12, k-12, k+12
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

function syncVisualViewport() {
  if (!window.visualViewport) return;
  const vv = window.visualViewport;

  // IMPORTANT:
  // When zoomed (scale != 1), the visual viewport moves around while you pan.
  // Using vv offsets then makes fixed bars jitter like crazy.
  // So: disable the vv-bottom hack while zoomed.
  if (vv.scale && Math.abs(vv.scale - 1) > 0.01) {
    document.documentElement.style.setProperty('--vv-bottom', '0px');
    return;
  }

  // Only compensate when it looks like a keyboard / UI inset (not normal scroll)
  const raw = window.innerHeight - (vv.height + vv.offsetTop);
  const bottom = raw > 0 ? raw : 0;

  // Optional: ignore tiny changes (reduces micro-jitter)
  const snapped = bottom < 2 ? 0 : Math.round(bottom);

  document.documentElement.style.setProperty('--vv-bottom', `${snapped}px`);
}

window.visualViewport?.addEventListener('resize', syncVisualViewport);
window.visualViewport?.addEventListener('scroll', syncVisualViewport);
window.addEventListener('resize', syncVisualViewport);
syncVisualViewport();

function syncModalViewportVars() {
  const vv = window.visualViewport;
  if (!vv) {
    document.documentElement.style.setProperty('--vv-top', '0px');
    document.documentElement.style.setProperty('--vv-h', '100vh');
    return;
  }

  // When zoomed, offsets get weird. Keep it simple.
  if (vv.scale && Math.abs(vv.scale - 1) > 0.01) {
    document.documentElement.style.setProperty('--vv-top', '0px');
    document.documentElement.style.setProperty('--vv-h', '100vh');
    return;
  }

  document.documentElement.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
  document.documentElement.style.setProperty('--vv-h', `${Math.round(vv.height)}px`);
}

window.visualViewport?.addEventListener('resize', syncModalViewportVars);
window.visualViewport?.addEventListener('scroll', syncModalViewportVars);
window.addEventListener('resize', syncModalViewportVars);
syncModalViewportVars();

/* Settings */
const panelBtn = document.getElementById('panelBtn');
const themeToggle = document.getElementById('themeToggle');
const handToggle = document.getElementById('handToggle');
const langSelect = document.getElementById('langSelect');
const cardLayoutSelect = document.getElementById('cardLayoutSelect');
const suggestionsEl = document.getElementById('suggestions');
const resetBtn = document.getElementById('resetBtn');
const newItemTitle = document.getElementById('newItemTitle');
const settingsTitle = document.getElementById('settingsTitle');
const installTitle = document.getElementById('installTitle');
const resetTitle = document.getElementById('resetTitle');
const resetSub = document.getElementById('resetSub');
const languageTitle = document.getElementById('languageTitle');
const languageSub = document.getElementById('languageSub');
const cardLayoutTitle = document.getElementById('cardLayoutTitle');
const cardLayoutSub = document.getElementById('cardLayoutSub');
const themeTitle = document.getElementById('themeTitle');
const themeSub = document.getElementById('themeSub');
const handedTitle = document.getElementById('handedTitle');
const handedSub = document.getElementById('handedSub');
const selCancel = document.getElementById('selCancel');
const selCount = document.getElementById('selCount');
const selCopy = document.getElementById('selCopy');
const selShare = document.getElementById('selShare');
const selDelete = document.getElementById('selDelete');
const importTitle = document.getElementById('importTitle');
const importSub = document.getElementById('importSub');
const importCardsBtn = document.getElementById('importCardsBtn');
const importBackdrop = document.getElementById('importBackdrop');
const importModalTitle = document.getElementById('importModalTitle');
const importText = document.getElementById('importText');
const cancelImport = document.getElementById('cancelImport');
const confirmImport = document.getElementById('confirmImport');
const reorderTitle = document.getElementById('reorderTitle');
const reorderSub = document.getElementById('reorderSub');
const reorderCardsBtn = document.getElementById('reorderCardsBtn');
const reorderBackdrop = document.getElementById('reorderBackdrop');
const reorderModalTitle = document.getElementById('reorderModalTitle');
const reorderList = document.getElementById('reorderList');
const cancelReorder = document.getElementById('cancelReorder');
const saveReorder = document.getElementById('saveReorder');
const historyGlobalTitle = document.getElementById('historyGlobalTitle');
const historyGlobalSub = document.getElementById('historyGlobalSub');
const openGlobalHistoryBtn = document.getElementById('openGlobalHistoryBtn');
const historyBackdrop = document.getElementById('historyBackdrop');
const historyModalTitle = document.getElementById('historyModalTitle');
const historyList = document.getElementById('historyList');
const closeHistory = document.getElementById('closeHistory');
const templatePreviewBackdrop = document.getElementById('templatePreviewBackdrop');
const templatePreviewModalTitle = document.getElementById('templatePreviewModalTitle');
const templatePreviewList = document.getElementById('templatePreviewList');
const closeTemplatePreview = document.getElementById('closeTemplatePreview');
const sidePanelBackdrop = document.getElementById('sidePanelBackdrop');
const panelSearch = document.getElementById('panelSearch');
const panelSettingsBtn = document.getElementById('panelSettingsBtn');
const projectList = document.getElementById('projectList');
const newProjectName = document.getElementById('newProjectName');
const createProjectBtn = document.getElementById('createProjectBtn');
const createProjectModeBtn = document.getElementById('createProjectModeBtn');
const createProjectModeMenu = document.getElementById('createProjectModeMenu');
const createModeNewBtn = document.getElementById('createModeNewBtn');
const createModeTemplateBtn = document.getElementById('createModeTemplateBtn');
const createProjectTemplateRow = document.getElementById('createProjectTemplateRow');
const createProjectTemplateSelect = document.getElementById('createProjectTemplateSelect');
const templateName = document.getElementById('templateName');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');
const templateList = document.getElementById('templateList');
if (resetBtn) resetBtn.addEventListener('click', resetAppDataAndReload);

let createProjectMode = 'new';
let createProjectModeMenuOpen = false;

function updatePanelSettingsButton() {
  if (!panelSettingsBtn) return;
  if (settingsSectionPinned) {
    panelSettingsBtn.setAttribute('aria-label', t('close'));
    panelSettingsBtn.setAttribute('title', t('close'));
    panelSettingsBtn.innerHTML = PANEL_SETTINGS_CLOSE_ICON_SVG;
    return;
  }
  panelSettingsBtn.setAttribute('aria-label', t('settings'));
  panelSettingsBtn.setAttribute('title', t('settings'));
  panelSettingsBtn.innerHTML = PANEL_SETTINGS_ICON_SVG;
}

function syncI18nUI() {
  document.documentElement.lang = getLang();

  if (panelBtn) {
    panelBtn.setAttribute('aria-label', t('panelOpen'));
    panelBtn.setAttribute('title', t('panelOpen'));
    panelBtn.innerHTML = PANEL_OPEN_ICON_SVG;
  }
  if (cmd) cmd.placeholder = t('cmdPlaceholder');
  const sendBtn = document.getElementById('send');
  if (sendBtn) sendBtn.setAttribute('aria-label', t('send'));
  if (newItemTitle) newItemTitle.textContent = t('newItem');
  if (newGroupInput) newGroupInput.placeholder = t('itemName');
  if (document.getElementById('cancelModal')) document.getElementById('cancelModal').textContent = t('cancel');
  if (document.getElementById('confirmModal')) document.getElementById('confirmModal').textContent = t('create');

  if (settingsTitle) settingsTitle.textContent = t('settings');
  if (installTitle) installTitle.textContent = t('install');
  if (installHint) {
    const hint = (installHint.textContent || '').trim();
    const isDefaultHint =
      !hint ||
      hint === I18N.nl.installRoGoAsApp ||
      hint === I18N.en.installRoGoAsApp;
    if (isDefaultHint) installHint.textContent = t('installRoGoAsApp');
  }
  if (installBtn) installBtn.textContent = isStandalone() ? t('installed') : t('install');
  if (resetTitle) resetTitle.textContent = t('resetApp');
  if (resetSub) resetSub.textContent = t('resetAppSub');
  if (resetBtn) resetBtn.textContent = t('resetApp');
  if (importTitle) importTitle.textContent = t('importCards');
  if (importSub) importSub.textContent = t('importCardsSub');
  if (importCardsBtn) importCardsBtn.textContent = t('import');
  if (reorderTitle) reorderTitle.textContent = t('reorderCards');
  if (reorderSub) reorderSub.textContent = t('reorderCardsSub');
  if (reorderCardsBtn) reorderCardsBtn.textContent = t('reorder');
  if (historyGlobalTitle) historyGlobalTitle.textContent = t('globalHistory');
  if (historyGlobalSub) historyGlobalSub.textContent = t('globalHistorySub');
  if (openGlobalHistoryBtn) openGlobalHistoryBtn.textContent = t('open');
  if (languageTitle) languageTitle.textContent = t('language');
  if (languageSub) languageSub.textContent = t('languageSub');
  if (cardLayoutTitle) cardLayoutTitle.textContent = t('cardLayout');
  if (cardLayoutSub) cardLayoutSub.textContent = t('cardLayoutSub');
  if (cardLayoutSelect?.options?.[0]) cardLayoutSelect.options[0].text = t('compact');
  if (cardLayoutSelect?.options?.[1]) cardLayoutSelect.options[1].text = t('classic');
  if (themeTitle) themeTitle.textContent = t('theme');
  if (themeSub) themeSub.textContent = t('themeSub');
  if (handedTitle) handedTitle.textContent = t('handed');
  if (handedSub) handedSub.textContent = t('handedSub');
  if (selCancel) selCancel.textContent = t('done');
  if (selCount) selCount.textContent = t('selectedCount', selectedGroupIds.size);
  if (selCopy) selCopy.textContent = t('copy');
  if (selShare) selShare.textContent = t('share');
  if (selDelete) selDelete.textContent = t('delete');
  if (importModalTitle) importModalTitle.textContent = t('importCards');
  if (importText) importText.placeholder = t('importCardsPlaceholder');
  if (cancelImport) cancelImport.textContent = t('cancel');
  if (confirmImport) confirmImport.textContent = t('import');
  if (reorderModalTitle) reorderModalTitle.textContent = t('reorderCards');
  if (cancelReorder) cancelReorder.textContent = t('cancel');
  if (saveReorder) saveReorder.textContent = t('done');
  if (historyModalTitle) historyModalTitle.textContent = t('history');
  if (closeHistory) closeHistory.textContent = t('close');
  if (templatePreviewModalTitle) templatePreviewModalTitle.textContent = t('templatePreview');
  if (closeTemplatePreview) closeTemplatePreview.textContent = t('close');
  if (panelSearch) panelSearch.placeholder = t('search');
  if (newProjectName) newProjectName.placeholder = t('newProjectPlaceholder');
  if (templateName) templateName.placeholder = t('templatePlaceholder');
  renderCreateProjectModeControls();
  if (saveTemplateBtn) saveTemplateBtn.textContent = t('saveTemplate');
  updatePanelSettingsButton();
  const projectTitleEl = document.querySelector('[data-title="projects"] .sidepanel-title');
  const templateTitleEl = document.querySelector('[data-title="templates"] .sidepanel-title');
  if (projectTitleEl) projectTitleEl.textContent = t('projectsTitle');
  if (templateTitleEl) templateTitleEl.textContent = t('templatesTitle');
  if (!sidePanelBackdrop?.classList.contains('hidden')) {
    renderProjectList();
    renderTemplateList();
    applyPanelSearchFilter();
  }
}

function projectDbName(projectId) {
  const id = String(projectId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `logistics-db-${id}`;
}

async function switchProject(projectId) {
  const projects = readProjects();
  if (!projects.some(p => p.id === projectId)) return;
  localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
  setCurrentProject(projectId);
  selectedGroup = null;
  selectedMode = null;
  exitSelectionMode();
  await load();
}

async function renderProjectList() {
  if (!projectList) return;
  const projects = readProjects();
  const current = getCurrentProject();
  const disableProjectDelete = projects.length <= 1;

  if (openProjectMenuId && !projects.some((p) => p.id === openProjectMenuId)) {
    openProjectMenuId = null;
  }

  projectList.innerHTML = projects.map((p) => `
    <div class="panel-item panel-item-project ${p.id === current ? 'active' : ''}" data-name="${escapeHtml(p.name)}" data-keywords="${escapeHtml(`route ${p.name}`)}">
      <button class="btn install-btn panel-open-project" data-id="${p.id}" type="button">${escapeHtml(p.name)}</button>
      <button
        class="btn install-btn panel-project-menu-toggle"
        data-id="${p.id}"
        type="button"
        aria-label="${escapeHtml(t('projectActions'))}"
        title="${escapeHtml(t('projectActions'))}"
        aria-expanded="${openProjectMenuId === p.id ? 'true' : 'false'}"
      >${PROJECT_MENU_ICON_SVG}</button>
      <div class="panel-project-menu ${openProjectMenuId === p.id ? 'open' : ''}" data-id="${p.id}">
        <button class="btn install-btn panel-save-project-template" data-id="${p.id}" type="button">${t('saveAsTemplate')}</button>
        <button class="btn install-btn panel-rename-project" data-id="${p.id}" type="button">${t('rename')}</button>
        <button class="btn danger-btn panel-delete-project" data-id="${p.id}" type="button" ${disableProjectDelete ? 'disabled aria-disabled="true"' : ''}>${t('remove')}</button>
      </div>
    </div>
  `).join('');
}

async function captureProjectSnapshot(projectId) {
  const targetId = String(projectId || 'default');
  const activeId = getCurrentProject();
  if (targetId !== activeId) setCurrentProject(targetId);
  try {
    return await exportProjectSnapshot();
  } finally {
    if (targetId !== activeId) setCurrentProject(activeId);
  }
}

async function saveProjectAsTemplate(projectId, fallbackName = '', presetName = null) {
  const hasPresetName = typeof presetName === 'string';
  const proposedName = String(fallbackName || '').trim();
  const rawName = hasPresetName ? presetName : prompt(t('templateNamePrompt'), proposedName);
  if (rawName == null) return;
  const name = String(rawName).trim();
  if (!name) return;

  const templates = readTemplates();
  const snapshot = await captureProjectSnapshot(projectId);
  const templateSnapshot = {
    groups: (Array.isArray(snapshot?.groups) ? snapshot.groups : []).map((g) => ({
      id: g?.id,
      name: String(g?.name || ''),
      createdAt: Number(g?.createdAt) || Date.now()
    })),
    // Keep template clean: only names/structure, totals start at zero.
    events: []
  };
  const existingIdx = templates.findIndex((tpl) => String(tpl?.name || '').trim().toLowerCase() === name.toLowerCase());
  const nextTemplate = {
    id: existingIdx >= 0 ? templates[existingIdx].id : `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: existingIdx >= 0 ? Number(templates[existingIdx].createdAt) || Date.now() : Date.now(),
    updatedAt: Date.now(),
    projectId: String(projectId || 'default'),
    snapshot: templateSnapshot
  };
  const nextTemplates = templates.filter((tpl, i) => i !== existingIdx);
  nextTemplates.unshift(nextTemplate);
  writeTemplates(nextTemplates);
  renderTemplateList();
  applyPanelSearchFilter();
  feedback.textContent = t('templateSaved');
  clearFeedbackSoon(1000);
}

function renderTemplateList() {
  if (!templateList) return;
  const templates = readTemplates();

  if (openTemplateMenuId && !templates.some((tpl) => tpl.id === openTemplateMenuId)) {
    openTemplateMenuId = null;
  }

  templateList.innerHTML = templates.map((tpl) => `
    <div class="panel-item panel-item-template" data-name="${escapeHtml(tpl.name)}" data-keywords="${escapeHtml(`template ${tpl.name}`)}">
      <button class="btn install-btn panel-apply-template" data-id="${tpl.id}" type="button">${escapeHtml(tpl.name)}</button>
      <button
        class="btn install-btn panel-template-menu-toggle"
        data-id="${tpl.id}"
        type="button"
        aria-label="${escapeHtml(t('templateActions'))}"
        title="${escapeHtml(t('templateActions'))}"
        aria-expanded="${openTemplateMenuId === tpl.id ? 'true' : 'false'}"
      >${PROJECT_MENU_ICON_SVG}</button>
      <div class="panel-project-menu ${openTemplateMenuId === tpl.id ? 'open' : ''}" data-id="${tpl.id}">
        <button class="btn install-btn panel-apply-template" data-id="${tpl.id}" type="button">${t('apply')}</button>
        <button class="btn install-btn panel-preview-template" data-id="${tpl.id}" type="button">${t('previewCards')}</button>
        <button class="btn install-btn panel-rename-template" data-id="${tpl.id}" type="button">${t('rename')}</button>
        <button class="btn danger-btn panel-delete-template" data-id="${tpl.id}" type="button">${t('remove')}</button>
      </div>
    </div>
  `).join('');
  refreshCreateTemplateOptions();
}

function panelSearchMatchesSettings(rawQuery) {
  const q = String(rawQuery || '').trim().toLowerCase();
  if (!q) return false;
  const keywords = ['setting', 'settings', 'instelling', 'instellingen', 'tutorial', 'hint', 'hints', 'help'];
  return keywords.some(k => q.includes(k));
}

function applyPanelSearchFilter() {
  if (!sidePanelBackdrop || sidePanelBackdrop.classList.contains('hidden')) return;
  const query = String(panelSearch?.value || '').trim().toLowerCase();
  const sections = sidePanelBackdrop.querySelectorAll('.panel-section');

  for (const section of sections) {
    const isSettingsSection = section.getAttribute('data-title') === 'settings';
    const titleEl = section.querySelector('.sidepanel-title');
    const title = String(titleEl?.textContent || '').toLowerCase();
    const titleMatch = !query || title.includes(query);
    const items = section.querySelectorAll('.panel-item, .setting-row');
    let visibleItems = 0;

    for (const item of items) {
      const name = String(item.getAttribute('data-name') || item.textContent || '').toLowerCase();
      const keywords = String(item.getAttribute('data-keywords') || '').toLowerCase();
      const hit = !query
        ? (isSettingsSection ? settingsSectionPinned : true)
        : (titleMatch || name.includes(query) || keywords.includes(query));
      item.style.display = hit ? '' : 'none';
      if (hit) visibleItems += 1;
    }

    let showSection = !query || titleMatch || visibleItems > 0;
    if (isSettingsSection) {
      showSection = settingsSectionPinned || (!!query && (visibleItems > 0 || panelSearchMatchesSettings(query)));
    } else if (settingsSectionPinned) {
      showSection = false;
    }
    section.style.display = showSection ? '' : 'none';
  }

  panelSettingsBtn?.classList.toggle(
    'active',
    settingsSectionPinned || panelSearchMatchesSettings(query)
  );
  updatePanelSettingsButton();
}

function openSidePanel() {
  openProjectMenuId = null;
  openTemplateMenuId = null;
  createProjectModeMenuOpen = false;
  settingsSectionPinned = false;
  sidePanelBackdrop?.classList.remove('hidden');
  renderProjectList();
  renderTemplateList();
  renderCreateProjectModeControls();
  applyPanelSearchFilter();
}

function closeSidePanel() {
  sidePanelBackdrop?.classList.add('hidden');
  if (panelSearch) panelSearch.value = '';
  panelSettingsBtn?.classList.remove('active');
  openProjectMenuId = null;
  openTemplateMenuId = null;
  createProjectModeMenuOpen = false;
  settingsSectionPinned = false;
}

function createProjectId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function suggestUniqueProjectName(baseName, existingProjects = []) {
  const fallback = getLang() === 'nl' ? 'Nieuw project' : 'New project';
  const base = String(baseName || '').trim() || fallback;
  const used = new Set(existingProjects.map((p) => String(p?.name || '').trim().toLowerCase()).filter(Boolean));
  if (!used.has(base.toLowerCase())) return base;
  let n = 2;
  let candidate = `${base} (${n})`;
  while (used.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `${base} (${n})`;
  }
  return candidate;
}

function deleteDatabaseByName(name) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function renderHistory({ groupId = null, title = null } = {}) {
  if (!historyList) return;
  const defs = getTokenDefs();
  const events = await getHistoryEvents({ groupId, limit: 1000 });
  const groups = await getGroupsWithTotals();
  const namesById = new Map(groups.map(g => [Number(g.id), g.name]));
  if (historyModalTitle && title) historyModalTitle.textContent = title;

  if (!events.length) {
    historyList.innerHTML = `<div class="history-empty">${escapeHtml(t('noHistory'))}</div>`;
    return;
  }

  const html = events.map((e) => {
    const ts = Number(e.timestamp || 0);
    const name = e.groupName || namesById.get(Number(e.groupId)) || `#${e.groupId}`;

    if (e.kind === 'lifecycle') {
      const action =
        e.action === 'deleted' ? t('deleted')
          : e.action === 'renamed' ? t('renamed')
            : t('created');
      const detail = e.action === 'renamed'
        ? `${String(e.oldName || '').trim()} → ${String(e.newName || '').trim()}`
        : '';
      return `
        <div class="history-item lifecycle">
          <div class="history-meta history-ts" data-ts="${ts}" data-compact="0">${escapeHtml(formatHistoryTimestamp(ts, false))}</div>
          <div class="history-title">${escapeHtml(name)} · ${escapeHtml(action)}</div>
          ${detail ? `<div class="history-line">${escapeHtml(detail)}</div>` : ''}
        </div>
      `;
    }

    const target = e.target === 'retour' ? t('returned') : t('delivered');
    const changes = TOKEN_ORDER
      .map((k) => ({ k, v: Number(e?.[k] || 0) }))
      .filter(x => x.v !== 0)
      .map(x => {
        const label = tokenNameNL(defs, x.k);
        return `<div class="history-line">${escapeHtml(label)}: ${x.v > 0 ? '+' : ''}${x.v}</div>`;
      })
      .join('');

    return `
      <div class="history-item">
        <div class="history-meta history-ts" data-ts="${ts}" data-compact="0">${escapeHtml(formatHistoryTimestamp(ts, false))}</div>
        <div class="history-title">${escapeHtml(name)} · ${escapeHtml(target)}</div>
        <div class="history-body">${changes || `<div class="history-line">-</div>`}</div>
      </div>
    `;
  }).join('');

  historyList.innerHTML = html;
  refreshHistoryTimestampLabels(historyList);
  scheduleHistoryRefresh();
}

function openHistoryModal() {
  historyBackdrop?.classList.remove('hidden');
}

function closeHistoryModal() {
  historyBackdrop?.classList.add('hidden');
}

function openTemplatePreviewModal() {
  templatePreviewBackdrop?.classList.remove('hidden');
}

function closeTemplatePreviewModal() {
  templatePreviewBackdrop?.classList.add('hidden');
}

function renderTemplatePreview(template) {
  if (!templatePreviewList) return;
  const groups = Array.isArray(template?.snapshot?.groups) ? template.snapshot.groups : [];
  if (!groups.length) {
    templatePreviewList.innerHTML = `<div class="history-empty">${escapeHtml(t('noCardsInTemplate'))}</div>`;
    return;
  }
  const rows = groups
    .map((g) => String(g?.name || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, getLang()))
    .map((name) => `<div class="history-item"><div class="history-title">${escapeHtml(name)}</div></div>`)
    .join('');
  templatePreviewList.innerHTML = rows;
}

document.addEventListener('click', (e) => {
  const block = e.target.closest('.mini-history, #historyList');
  if (!block) return;
  toggleHistoryTimeMode();
});

selCancel?.addEventListener('click', () => {
  exitSelectionMode();
  load();
});

selCopy?.addEventListener('click', async () => {
  if (!selectedGroupIds.size) return;
  const text = await buildSelectedCardsText();
  if (!text) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      return;
    }
    feedback.textContent = t('copiedCards', selectedGroupIds.size);
    clearFeedbackSoon(1000);
  } catch (e) {
    feedback.textContent = '⚠ ' + (e?.message || t('error'));
  }
});

selShare?.addEventListener('click', async () => {
  if (!selectedGroupIds.size) return;
  const text = await buildSelectedCardsText();
  if (!text) return;

  try {
    if (navigator.share) {
      await navigator.share({ title: 'RoGo', text });
      feedback.textContent = t('sharedCards', selectedGroupIds.size);
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      feedback.textContent = t('copiedCards', selectedGroupIds.size);
    } else {
      return;
    }
    clearFeedbackSoon(1000);
  } catch (e) {
    feedback.textContent = '⚠ ' + (e?.message || t('error'));
  }
});

selDelete?.addEventListener('click', async () => {
  if (!selectedGroupIds.size) return;
  const count = selectedGroupIds.size;
  if (!confirm(t('deleteSelectedConfirm', count))) return;

  const ids = [...selectedGroupIds];
  await deleteGroups(ids);

  const keep = new Set(ids.map(Number));
  const nextOrder = getStoredGroupOrder().filter(id => !keep.has(Number(id)));
  setStoredGroupOrder(nextOrder);

  if (selectedGroup) {
    const selectedCard = document.querySelector('.group.selected');
    const selectedId = Number(selectedCard?.dataset?.id);
    if (keep.has(selectedId)) {
      selectedGroup = null;
      selectedMode = null;
    }
  }

  exitSelectionMode();
  feedback.textContent = t('deletedCards', count);
  clearFeedbackSoon(1200);
  await load();
});

function openImportModal() {
  if (!importBackdrop) return;
  importBackdrop.classList.remove('hidden');
  if (importText) {
    importText.value = '';
    importText.focus();
  }
}

function closeImportModal() {
  importBackdrop?.classList.add('hidden');
}

importCardsBtn?.addEventListener('click', openImportModal);
cancelImport?.addEventListener('click', closeImportModal);
importBackdrop?.addEventListener('click', (e) => {
  if (e.target === importBackdrop) closeImportModal();
});

document.addEventListener('keydown', (e) => {
  if (!importBackdrop || importBackdrop.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeImportModal();
});

confirmImport?.addEventListener('click', async () => {
  const raw = importText?.value || '';
  try {
    const count = await importCardsFromText(raw);
    if (!count) {
      feedback.textContent = t('importNoCards');
    } else {
      feedback.textContent = t('importSuccess', count);
      closeImportModal();
      await load();
    }
    clearFeedbackSoon(1300);
  } catch (e) {
    feedback.textContent = `⚠ ${t('importFailed')}: ${e?.message || t('error')}`;
  }
});

function renderReorderList() {
  if (!reorderList) return;
  reorderList.innerHTML = '';

  getGroupsWithTotals().then(groups => {
    const ordered = orderGroups(groups);
    for (let i = 0; i < ordered.length; i++) {
      const g = ordered[i];
      const disableUp = i === 0;
      const disableDown = i === ordered.length - 1;
      const row = document.createElement('div');
      row.className = 'reorder-item';
      row.draggable = true;
      row.dataset.id = String(g.id);
      row.innerHTML = `
        <div class="reorder-name">${g.name}</div>
        <div class="reorder-actions">
          <button type="button" class="reorder-move" data-dir="up" data-id="${g.id}" ${disableUp ? 'disabled' : ''} aria-label="${t('moveUp')}">▲</button>
          <button type="button" class="reorder-move" data-dir="down" data-id="${g.id}" ${disableDown ? 'disabled' : ''} aria-label="${t('moveDown')}">▼</button>
        </div>
      `;
      reorderList.appendChild(row);
    }
  });
}

async function openReorderModal() {
  if (!reorderBackdrop) return;
  const groups = await getGroupsWithTotals();
  reorderInitialOrder = orderGroups(groups).map((g) => Number(g.id));
  renderReorderList();
  reorderBackdrop.classList.remove('hidden');
}

function closeReorderModal() {
  reorderBackdrop?.classList.add('hidden');
}

async function confirmReorderModal() {
  reorderInitialOrder = null;
  closeReorderModal();
  feedback.textContent = t('reordered');
  clearFeedbackSoon(1000);
  await load();
}

async function cancelReorderModal() {
  if (Array.isArray(reorderInitialOrder)) {
    setStoredGroupOrder(reorderInitialOrder);
  }
  reorderInitialOrder = null;
  closeReorderModal();
  await load();
}

reorderCardsBtn?.addEventListener('click', openReorderModal);
cancelReorder?.addEventListener('click', async () => {
  await cancelReorderModal();
});
reorderBackdrop?.addEventListener('click', (e) => {
  if (e.target === reorderBackdrop) {
    confirmReorderModal();
  }
});

let reorderDragId = null;
let reorderInitialOrder = null;
reorderList?.addEventListener('dragstart', (e) => {
  const item = e.target.closest('.reorder-item');
  if (!item) return;
  reorderDragId = Number(item.dataset.id);
  item.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
});

reorderList?.addEventListener('dragover', (e) => {
  if (!Number.isFinite(reorderDragId)) return;
  const item = e.target.closest('.reorder-item');
  if (!item) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
});

reorderList?.addEventListener('drop', (e) => {
  if (!Number.isFinite(reorderDragId)) return;
  const target = e.target.closest('.reorder-item');
  if (!target) return;
  e.preventDefault();
  const targetId = Number(target.dataset.id);
  if (!Number.isFinite(targetId)) return;
  moveGroupBefore(reorderDragId, targetId);
  renderReorderList();
});

reorderList?.addEventListener('dragend', () => {
  reorderDragId = null;
  reorderList.querySelectorAll('.reorder-item.dragging').forEach(el => el.classList.remove('dragging'));
});

reorderList?.addEventListener('click', (e) => {
  const btn = e.target.closest('.reorder-move');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const dir = btn.dataset.dir === 'up' ? 'up' : 'down';
  if (!Number.isFinite(id)) return;
  moveGroupByStep(id, dir);
  renderReorderList();
});

saveReorder?.addEventListener('click', async () => {
  await confirmReorderModal();
});

openGlobalHistoryBtn?.addEventListener('click', async () => {
  openHistoryModal();
  await renderHistory({ title: t('globalHistory') });
});

closeHistory?.addEventListener('click', closeHistoryModal);
historyBackdrop?.addEventListener('click', (e) => {
  if (e.target === historyBackdrop) closeHistoryModal();
});
document.addEventListener('keydown', (e) => {
  if (!historyBackdrop || historyBackdrop.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeHistoryModal();
});

closeTemplatePreview?.addEventListener('click', closeTemplatePreviewModal);
templatePreviewBackdrop?.addEventListener('click', (e) => {
  if (e.target === templatePreviewBackdrop) closeTemplatePreviewModal();
});
document.addEventListener('keydown', (e) => {
  if (!templatePreviewBackdrop || templatePreviewBackdrop.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeTemplatePreviewModal();
});

async function resetAppDataAndReload() {
  const ok = confirm(t('resetConfirm'));
  if (!ok) return;

  try {
    /* ---------- STORAGE ---------- */
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}

    /* ---------- INDEXED DB ---------- */
    try { indexedDB.deleteDatabase('logistics-db'); } catch {}

    if (indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        await Promise.all((dbs || []).map(db =>
          new Promise(res => {
            if (!db?.name) return res();
            const req = indexedDB.deleteDatabase(db.name);
            req.onsuccess = req.onerror = req.onblocked = () => res();
          })
        ));
      } catch {}
    }

    /* ---------- CACHE STORAGE ---------- */
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch {}
    }

    /* ---------- SERVICE WORKERS ---------- */
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      } catch {}
    }

    /* ---------- COOKIES (non-HttpOnly only) ---------- */
    try {
      document.cookie.split(';').forEach(c => {
        const eq = c.indexOf('=');
        const name = (eq > -1 ? c.slice(0, eq) : c).trim();
        if (!name) return;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      });
    } catch {}
  } finally {
    /* ---------- HARD RELOAD ---------- */
    setTimeout(() => location.reload(), 400);
  }
}

function applySettingsFromStorage() {
  const theme = localStorage.getItem('rogo_theme') || 'dark';
  const hand = localStorage.getItem('rogo_hand') || 'right';
  const lang = localStorage.getItem('rogo_lang') || 'nl';
  const cardLayout = getCardLayout();
  if (langSelect) langSelect.value = lang;
  if (cardLayoutSelect) cardLayoutSelect.value = cardLayout;

  document.body.classList.toggle('theme-light', theme === 'light');
  document.body.classList.toggle('hand-left', hand === 'left');

  if (themeToggle) themeToggle.checked = theme === 'light';
  if (handToggle) handToggle.checked = hand === 'left';
  syncI18nUI();
}

function openSettings() {
  if (sidePanelBackdrop?.classList.contains('hidden')) {
    openSidePanel();
  }
  if (settingsSectionPinned) {
    settingsSectionPinned = false;
    applyPanelSearchFilter();
    try {
      panelSearch?.focus({ preventScroll: true });
    } catch {
      panelSearch?.focus();
    }
    return;
  }
  if (panelSearch) panelSearch.value = '';
  settingsSectionPinned = true;
  const settingsSection = sidePanelBackdrop?.querySelector('[data-title="settings"]');
  if (!settingsSection) return;
  applyPanelSearchFilter();
  settingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  panelSettingsBtn?.classList.add('active');
  try {
    panelSearch?.focus({ preventScroll: true });
  } catch {
    panelSearch?.focus();
  }
}

panelBtn?.addEventListener('click', openSidePanel);
sidePanelBackdrop?.addEventListener('click', (e) => {
  if (e.target === sidePanelBackdrop) closeSidePanel();
});
document.addEventListener('click', (e) => {
  if (createProjectModeMenuOpen && !e.target.closest('.sidepanel-create-wrap')) {
    createProjectModeMenuOpen = false;
    renderCreateProjectModeControls();
  }
  if (openProjectMenuId && !e.target.closest('.panel-item-project')) {
    openProjectMenuId = null;
    renderProjectList();
    applyPanelSearchFilter();
  }
  if (openTemplateMenuId && !e.target.closest('.panel-item-template')) {
    openTemplateMenuId = null;
    renderTemplateList();
    applyPanelSearchFilter();
  }
});
createProjectModeBtn?.addEventListener('click', () => {
  createProjectModeMenuOpen = !createProjectModeMenuOpen;
  renderCreateProjectModeControls();
});
createModeNewBtn?.addEventListener('click', () => {
  createProjectMode = 'new';
  createProjectModeMenuOpen = false;
  renderCreateProjectModeControls();
});
createModeTemplateBtn?.addEventListener('click', () => {
  createProjectMode = 'template';
  createProjectModeMenuOpen = false;
  renderCreateProjectModeControls();
});
panelSearch?.addEventListener('input', applyPanelSearchFilter);
panelSearch?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (!panelSearchMatchesSettings(panelSearch.value)) return;
  e.preventDefault();
  openSettings();
});
panelSettingsBtn?.addEventListener('click', () => {
  openSettings();
});

createProjectBtn?.addEventListener('click', async () => {
  const name = String(newProjectName?.value || '').trim();
  if (!name) return;
  const selectedTemplateId = String(createProjectTemplateSelect?.value || '');
  const selectedTemplate = createProjectMode === 'template'
    ? readTemplates().find((tpl) => tpl.id === selectedTemplateId)
    : null;
  if (createProjectMode === 'template' && !selectedTemplate) {
    feedback.textContent = `⚠ ${t('noTemplates')}`;
    clearFeedbackSoon(900);
    return;
  }

  const projects = readProjects();
  if (projects.some(p => String(p.name).toLowerCase() === name.toLowerCase())) {
    feedback.textContent = `⚠ ${t('error')}`;
    clearFeedbackSoon(900);
    return;
  }

  const id = createProjectId();
  projects.push({ id, name, createdAt: Date.now() });
  writeProjects(projects);
  if (newProjectName) newProjectName.value = '';
  await switchProject(id);
  if (selectedTemplate) {
    await replaceProjectWithSnapshot(selectedTemplate.snapshot || { groups: [], events: [] });
    selectedGroup = null;
    selectedMode = null;
    exitSelectionMode();
    await load();
  }
  renderProjectList();
  applyPanelSearchFilter();
  feedback.textContent = selectedTemplate ? t('templateApplied') : t('projectCreated');
  clearFeedbackSoon(1000);
});

newProjectName?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    createProjectBtn?.click();
  }
});

projectList?.addEventListener('click', async (e) => {
  const menuToggleBtn = e.target.closest('.panel-project-menu-toggle');
  if (menuToggleBtn) {
    const id = menuToggleBtn.getAttribute('data-id');
    if (!id) return;
    openTemplateMenuId = null;
    openProjectMenuId = openProjectMenuId === id ? null : id;
    renderProjectList();
    renderTemplateList();
    applyPanelSearchFilter();
    return;
  }

  const openBtn = e.target.closest('.panel-open-project');
  if (openBtn) {
    const id = openBtn.getAttribute('data-id');
    if (id) {
      openProjectMenuId = null;
      await switchProject(id);
      renderProjectList();
      applyPanelSearchFilter();
    }
    return;
  }

  const renameBtn = e.target.closest('.panel-rename-project');
  if (renameBtn) {
    const id = renameBtn.getAttribute('data-id');
    if (!id) return;
    openProjectMenuId = null;
    const projects = readProjects();
    const idx = projects.findIndex(p => p.id === id);
    if (idx < 0) return;
    const currentName = String(projects[idx].name || '');
    const next = prompt(t('projectNamePrompt'), currentName);
    if (next == null) return;
    const name = String(next).trim();
    if (!name || name === currentName) return;
    if (projects.some((p, i) => i !== idx && String(p.name).toLowerCase() === name.toLowerCase())) {
      feedback.textContent = `⚠ ${t('error')}`;
      clearFeedbackSoon(900);
      return;
    }
    projects[idx].name = name;
    writeProjects(projects);
    renderProjectList();
    applyPanelSearchFilter();
    feedback.textContent = t('projectRenamed');
    clearFeedbackSoon(1000);
    return;
  }

  const saveTemplateItemBtn = e.target.closest('.panel-save-project-template');
  if (saveTemplateItemBtn) {
    const id = saveTemplateItemBtn.getAttribute('data-id');
    if (!id) return;
    const projects = readProjects();
    const project = projects.find((p) => p.id === id);
    openProjectMenuId = null;
    renderProjectList();
    applyPanelSearchFilter();
    await saveProjectAsTemplate(id, project?.name || '');
    return;
  }

  const deleteBtn = e.target.closest('.panel-delete-project');
  if (!deleteBtn) return;
  const id = deleteBtn.getAttribute('data-id');
  if (!id) return;
  openProjectMenuId = null;

  const projects = readProjects();
  if (projects.length <= 1) {
    feedback.textContent = `⚠ ${t('cannotDeleteLastProject')}`;
    clearFeedbackSoon(1200);
    return;
  }

  const project = projects.find(p => p.id === id);
  if (!project) return;

  const currentId = getCurrentProject();
  const remaining = projects.filter(p => p.id !== id);
  writeProjects(remaining);
  localStorage.removeItem(`${GROUP_ORDER_KEY}_${id}`);
  await deleteDatabaseByName(projectDbName(id));

  if (currentId === id) {
    const fallback = remaining[0]?.id;
    if (fallback) {
      localStorage.setItem(CURRENT_PROJECT_KEY, fallback);
      setCurrentProject(fallback);
      selectedGroup = null;
      selectedMode = null;
      exitSelectionMode();
      await load();
    }
  }

  renderProjectList();
  applyPanelSearchFilter();

  feedback.textContent = t('projectDeleted');
  clearFeedbackSoon(1000);
});

saveTemplateBtn?.addEventListener('click', async () => {
  const name = String(templateName?.value || '').trim();
  if (!name) return;
  await saveProjectAsTemplate(getCurrentProject(), '', name);
  if (templateName) templateName.value = '';
});

templateName?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveTemplateBtn?.click();
  }
});

templateList?.addEventListener('click', async (e) => {
  const menuToggleBtn = e.target.closest('.panel-template-menu-toggle');
  if (menuToggleBtn) {
    const id = menuToggleBtn.getAttribute('data-id');
    if (!id) return;
    openProjectMenuId = null;
    openTemplateMenuId = openTemplateMenuId === id ? null : id;
    renderProjectList();
    renderTemplateList();
    applyPanelSearchFilter();
    return;
  }

  const applyBtn = e.target.closest('.panel-apply-template');
  if (applyBtn) {
    const id = applyBtn.getAttribute('data-id');
    const template = readTemplates().find(tpl => tpl.id === id);
    if (!template) return;
    openTemplateMenuId = null;
    renderTemplateList();
    applyPanelSearchFilter();
    const projects = readProjects();
    const suggested = suggestUniqueProjectName(template.name, projects);
    const raw = prompt(t('projectNamePrompt'), suggested);
    if (raw == null) return;
    const chosen = String(raw).trim();
    if (!chosen) return;
    const uniqueName = suggestUniqueProjectName(chosen, projects);
    const idNew = createProjectId();
    projects.push({ id: idNew, name: uniqueName, createdAt: Date.now() });
    writeProjects(projects);
    await switchProject(idNew);
    await replaceProjectWithSnapshot(template.snapshot || { groups: [], events: [] });
    selectedGroup = null;
    selectedMode = null;
    exitSelectionMode();
    await load();
    renderProjectList();
    renderTemplateList();
    applyPanelSearchFilter();
    feedback.textContent = t('templateApplied');
    clearFeedbackSoon(1000);
    return;
  }

  const previewBtn = e.target.closest('.panel-preview-template');
  if (previewBtn) {
    const id = previewBtn.getAttribute('data-id');
    if (!id) return;
    const template = readTemplates().find((tpl) => tpl.id === id);
    if (!template) return;
    openTemplateMenuId = null;
    renderTemplateList();
    applyPanelSearchFilter();
    if (templatePreviewModalTitle) templatePreviewModalTitle.textContent = `${t('templatePreview')} · ${template.name}`;
    renderTemplatePreview(template);
    openTemplatePreviewModal();
    return;
  }

  const renameBtn = e.target.closest('.panel-rename-template');
  if (renameBtn) {
    const id = renameBtn.getAttribute('data-id');
    if (!id) return;
    openTemplateMenuId = null;
    renderTemplateList();
    applyPanelSearchFilter();
    const templates = readTemplates();
    const idx = templates.findIndex((tpl) => tpl.id === id);
    if (idx < 0) return;
    const currentName = String(templates[idx].name || '');
    const next = prompt(t('templateNamePrompt'), currentName);
    if (next == null) return;
    const name = String(next).trim();
    if (!name || name === currentName) return;
    if (templates.some((tpl, i) => i !== idx && String(tpl.name).toLowerCase() === name.toLowerCase())) {
      feedback.textContent = `⚠ ${t('error')}`;
      clearFeedbackSoon(900);
      return;
    }
    templates[idx].name = name;
    writeTemplates(templates);
    renderTemplateList();
    applyPanelSearchFilter();
    feedback.textContent = t('templateRenamed');
    clearFeedbackSoon(1000);
    return;
  }

  const deleteBtn = e.target.closest('.panel-delete-template');
  if (!deleteBtn) return;
  openTemplateMenuId = null;
  renderTemplateList();
  applyPanelSearchFilter();
  const id = deleteBtn.getAttribute('data-id');
  const templates = readTemplates();
  const target = templates.find(tpl => tpl.id === id);
  if (!target) return;
  if (!confirm(t('confirmDeleteTemplate', target.name))) return;
  writeTemplates(templates.filter(tpl => tpl.id !== id));
  renderTemplateList();
  applyPanelSearchFilter();
  feedback.textContent = t('templateDeleted');
  clearFeedbackSoon(1000);
});

document.addEventListener('keydown', (e) => {
  if (!sidePanelBackdrop?.classList.contains('hidden') && e.key === 'Escape') {
    closeSidePanel();
  }
});

themeToggle?.addEventListener('change', () => {
  const val = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem('rogo_theme', val);
  applySettingsFromStorage();
});

handToggle?.addEventListener('change', () => {
  const val = handToggle.checked ? 'left' : 'right';
  localStorage.setItem('rogo_hand', val);
  applySettingsFromStorage();
});

langSelect?.addEventListener('change', () => {
  localStorage.setItem('rogo_lang', langSelect.value);
  syncI18nUI();
  load();
});

cardLayoutSelect?.addEventListener('change', () => {
  const val = cardLayoutSelect.value === 'classic' ? 'classic' : 'compact';
  localStorage.setItem('rogo_card_layout', val);
  load();
});

// call once on boot
ensureProjectsSetup();
applySettingsFromStorage();
