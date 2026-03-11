import { parseAndExecute } from './parser.js';
import { parseCommandInput, parsePart, resolveCommandAlias } from './parser.js';
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
  replaceProjectWithSnapshot,
  compactProjectDatabases
} from './db.js';
import {
  TOKEN_ORDER,
  getTokenDefs,
  buildAliasMap,
  displayKey,
  searchTokens,
  formatTokenOption
} from './tokens.js';
import {
  STORAGE_ORDER,
  cloneStorageTotals,
  emptyStorageTotals,
  normalizeStorage,
  sumStorageModeTotals,
  sumTotals
} from './storage.js';

const list = document.getElementById('list');
const appRoot = document.getElementById('app');
const cmd = document.getElementById('cmd');
const preview = document.getElementById('preview');
const feedback = document.getElementById('feedback');
const chipsEl = document.getElementById('chips');
const cliContainer = document.querySelector('.cli-container');

let selectedGroup = null;
let selectedMode = null;
let selectedStorage = 'main';

let modeHintTimer = null;
let feedbackDismissTimer = null;
let selectionMode = false;
let selectedGroupIds = new Set();
let suppressClickUntil = 0;
let longPressTimer = null;
let longPressData = null;
let historyTimeMode = 'relative';
let historyRefreshTimer = null;
let cmdScrollLockY = 0;
let cmdScrollLockActive = false;
let cmdBlurUnlockTimer = null;
let preserveCmdScrollLockUntil = 0;
let preserveSelectedCardTopUntil = 0;
let selectedCardTopSyncRaf = 0;
let templatePreviewTemplateId = '';
let historyModalContextTitle = '';
let historyModalEventCount = 0;
const GROUP_ORDER_KEY = 'rogo_group_order';
const TOTALS_COLLAPSED_KEY = 'rogo_totals_collapsed';
const PROJECTS_KEY = 'rogo_projects';
const CURRENT_PROJECT_KEY = 'rogo_project_current';
const TEMPLATES_KEY = 'rogo_templates';
const FREEZER_ENABLED_KEY = 'rogo_freezer_enabled';
const VIEWPORT_KEYBOARD_OPEN_THRESHOLD_PX = 140;
const VIEWPORT_LOCK_HOLD_MS = 420;
const SELECTED_CARD_TOP_ALIGN_HOLD_MS = 520;
const IN_APP_CARD_TOP_GAP_PX = 8;
const IN_APP_CARD_TOP_ALIGN_EPSILON_PX = 1;
const IN_APP_CARD_TOP_ALIGN_PASSES = 6;
const SCREENSHOT_IMPORT_CROP_TOP_RATIO = 0.1;
const SCREENSHOT_IMPORT_CROP_BOTTOM_RATIO = 0.04;
const SCREENSHOT_IMPORT_PREVIEW_LIMIT = 10;
const SCREENSHOT_IMPORT_MIN_STRICT_MATCHES = 3;
const SCREENSHOT_IMPORT_ADDRESS_X_TOLERANCE_RATIO = 0.12;
const SCREENSHOT_IMPORT_TIMEOUT_MS = 20000;
const SCREENSHOT_IMPORT_IGNORED_NAME_KEYS = new Set(['totaalvers', 'totaal vers']);
const SCREENSHOT_IMPORT_TESSERACT_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const SCREENSHOT_IMPORT_TESSERACT_LANG = 'eng';
const PANEL_OPEN_ICON_SVG = '<svg class="icon-svg icon-arrow-left" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 12H6"/><path d="M11 7L6 12L11 17"/></svg>';
const PROJECT_MENU_ICON_SVG = '<svg class="icon-svg icon-kebab" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
const PANEL_SETTINGS_ICON_SVG = '<svg class="icon-svg icon-gear" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83a2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2a2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0a2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2a2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83a2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2a2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0a2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2a2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>';
const PANEL_SETTINGS_CLOSE_ICON_SVG = '<svg class="icon-svg icon-close" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6L18 18"/><path d="M18 6L6 18"/></svg>';
const FREEZER_REMINDER_ICON_SVG = '<svg class="freezer-reminder-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2V22"/><path d="M3.34 7L20.66 17"/><path d="M20.66 7L3.34 17"/><path d="M12 2L10.2 4.2"/><path d="M12 2L13.8 4.2"/><path d="M12 22L10.2 19.8"/><path d="M12 22L13.8 19.8"/><path d="M3.34 7L6.06 7.34"/><path d="M3.34 7L4.7 9.38"/><path d="M20.66 17L17.94 16.66"/><path d="M20.66 17L19.3 14.62"/><path d="M20.66 7L17.94 7.34"/><path d="M20.66 7L19.3 9.38"/><path d="M3.34 17L6.06 16.66"/><path d="M3.34 17L4.7 14.62"/></svg>';

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
    currentRoute: 'Huidige route',
    exportRoute: 'Exporteer klanten',
    exportRouteSub: 'Kopieer alle klanten van deze route naar je klembord om ze snel te delen of op te slaan.',
    duplicateRoute: 'Dupliceer route',
    duplicateRouteSub: 'Maak een complete kopie van deze route inclusief klanten en totalen.',
    clearTotals: 'Totalen wissen',
    clearTotalsSub: 'Behoud alle klanten, maar zet geleverd/retour totalen terug naar 0.',
    routeActions: 'Acties',
    routeActionsSub: 'Klap uit voor alle opties met uitleg.',
    expandOptions: 'Opties uitklappen',
    collapseOptions: 'Opties inklappen',
    clearTotalsBtn: 'Route totalen wissen',
    viewHistoryBtn: 'Historie bekijken',
    editNameBtn: 'Route hernoemen',
    saveAsTemplateBtn: 'Opslaan als template',
    clear: 'Wissen',
    confirmClearTotals: 'Totalen van deze route wissen?\n\nKlanten blijven bestaan, alleen totalen worden teruggezet naar 0.',
    routeTotalsCleared: 'Route totalen gewist',
    noCustomersInRoute: 'Geen klanten in deze route',
    viewHistoryRouteSub: 'Bekijk alle wijzigingen en activiteiten van deze route.',
    editName: 'Naam wijzigen',
    editNameSub: 'Pas de routenaam aan zoals die in de routelijst staat.',
    saveAsTemplateSub: 'Sla deze route op als herbruikbaar startpunt voor nieuwe routes.',
    startMultiSelect: 'Multi-selectie starten',
    startMultiSelectSub: 'Selecteer alle klanten tegelijk om te kopiëren, delen of verwijderen.',
    startMultiSelectBtn: 'Start',
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
    templateCreateSub: 'Kies een template, bekijk klantnamen, en pas de routenaam aan.',
    templateCustomerCount: (count) => `${count} klant${count === 1 ? '' : 'en'}`,
    templatePreviewMore: (count) => `+${count} meer`,
    noTemplates: 'Geen templates beschikbaar',
    templatePreview: 'Template preview',
    previewCards: 'Bekijk kaarten',
    noCardsInTemplate: 'Geen kaarten in deze template',
    saveTemplate: 'Opslaan',
    saveAsTemplate: 'Als template opslaan',
    switchProject: 'Open',
    rename: 'Naam wijzigen',
    remove: 'Verwijderen',
    projectActions: 'Route acties',
    viewHistory: 'Bekijk historie',
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
    importScreenshot: 'Importeer uit screenshot',
    importScreenshotSub: 'Kies route-screenshots en maak klantkaarten automatisch aan.',
    screenshotScan: 'Kies screenshot',
    screenshotImportPleaseWait: 'Even geduld terwijl de screenshots worden verwerkt.',
    screenshotImportTimeoutHint: (seconds) => `Stopt automatisch na ${seconds}s als het te lang duurt.`,
    importCards: 'Klanten importeren',
    importCardsSub: 'Plak gekopieerde klantregels om ze direct aan deze route toe te voegen.',
    importCardsPlaceholder: 'Plak klanten hier...',
    reorderCards: 'Klanten herordenen',
    reorderCardsSub: 'Verplaats namen zonder details',
    reorder: 'Herordenen',
    history: 'Historie',
    globalHistory: 'Globale historie',
    allTotals: 'Alle totalen',
    total: 'Totaal',
    name: 'Naam',
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
    screenshotImportUnsupported: 'Screenshot scannen wordt niet ondersteund in deze browser.',
    screenshotImportLoadingEngine: 'OCR-engine laden...',
    screenshotImportEngineFailed: 'OCR-engine kon niet worden geladen.',
    screenshotImportScanning: (index, total) => `Screenshot ${index}/${total} scannen...`,
    screenshotImportCreating: (count) => `${count} klanten aanmaken...`,
    screenshotImportNoNames: '⚠ Geen klantnamen gevonden in de geselecteerde screenshots',
    screenshotImportConfirm: (found, createCount, existingCount) => `Gevonden klantnamen: ${found}\nNieuw aan te maken: ${createCount}${existingCount ? `\nBestaan al: ${existingCount}` : ''}\n\nDoorgaan?`,
    screenshotImportPreviewMore: (count) => `... en ${count} meer`,
    screenshotImportCreated: (created, existingCount, failedCount = 0) => `✔ ${created} klanten aangemaakt${existingCount ? `, ${existingCount} bestonden al` : ''}${failedCount ? `, ${failedCount} screenshot${failedCount === 1 ? '' : 's'} overgeslagen` : ''}`,
    screenshotImportAllExisting: (count, failedCount = 0) => `✔ ${count} klanten bestaan al${failedCount ? `, ${failedCount} screenshot${failedCount === 1 ? '' : 's'} overgeslagen` : ''}`,
    screenshotImportPartialFailure: (count) => `⚠ ${count} screenshot${count === 1 ? '' : 's'} kon niet worden gelezen`,
    screenshotImportTimedOut: 'Screenshot scannen duurde te lang en is gestopt.',
    screenshotReviewTitle: 'Klantnamen controleren',
    screenshotReviewSub: (createCount, existingCount) => `Nieuw aan te maken: ${createCount}${existingCount ? ` · Bestaan al: ${existingCount}` : ''}`,
    screenshotReviewExistingTitle: 'Klantnamen bestaan al',
    screenshotReviewExistingSub: (existingCount) => `${existingCount} klant${existingCount === 1 ? '' : 'en'} bestaan al in deze route`,
    screenshotReviewExistingBody: 'Er zijn geen nieuwe klanten om aan te maken.',
    templateRouteConfirmTitle: 'Route aanmaken uit template',
    templateRouteConfirmSub: (routeName) => `Nieuwe route: ${routeName}`,
    templateRouteConfirmBody: (templateName, count) => `Template: ${templateName}${count ? ` · ${count} klanten` : ''}`,
    language: 'Taal',
    languageSub: 'Nederlands / Engels',
    cardLayout: 'Klantweergave',
    cardLayoutSub: 'Klassiek / Compact',
    classic: 'Klassiek',
    compact: 'Compact',
    freezerFeature: 'Vriezerfunctie',
    freezerFeatureSub: 'Toon koelcel / vriezer-splitsing op kaarten',
    devTools: 'Developer tools',
    devRouteSnapshot: 'Route snapshot kopieren',
    devRouteSnapshotSub: 'Kopieer de database-snapshot van de huidige route als JSON',
    devRouteText: 'Route tekst kopieren',
    devRouteTextSub: 'Kopieer de huidige route in het normale deelbare tekstformaat',
    devAppState: 'App-status kopieren',
    devAppStateSub: 'Kopieer instellingen, selectie en viewport-info als JSON',
    devViewportSync: 'Viewport hersynchroniseren',
    devViewportSyncSub: 'Voer de viewport-logica voor CLI en modals opnieuw uit',
    devSnowfall: 'Sneeuwval',
    devSnowfallSub: 'Laat een kleine vriezer-vlokkenbui over de app vallen',
    copiedRouteSnapshot: '✔ Route snapshot gekopieerd',
    copiedRouteText: '✔ Route tekst gekopieerd',
    copiedAppState: '✔ App-status gekopieerd',
    viewportResynced: '✔ Viewport hersynchroniseerd',
    snowfallStarted: '✔ Sneeuwbui gestart',
    theme: 'Thema',
    themeSub: 'Donker / Licht',
    handed: 'Links-handig',
    handedSub: 'Knoppen links',
    continuousCreation: 'Doorlopend aanmaken',
    continuousCreationSub: 'Aanmaken-popup open houden',
    close: 'Sluiten',
    save: 'Opslaan',
    send: 'Versturen',
    run: 'Uitvoeren',
    historyEvents: (n) => `${n} gebeurtenis${n === 1 ? '' : 'sen'}`,
    multiSelectActive: 'Multi-selectie actief',
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
    mainUnit: 'Koelcel',
    mainUnitLower: 'koelcel',
    freezer: 'Vriezer',
    freezerLower: 'vriezer',
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
    currentRoute: 'Current route',
    exportRoute: 'Export customers',
    exportRouteSub: 'Copy all customers from this route to your clipboard for quick sharing or backup.',
    duplicateRoute: 'Duplicate route',
    duplicateRouteSub: 'Create a full copy of this route including customers and totals.',
    clearTotals: 'Clear totals',
    clearTotalsSub: 'Keep all customers but reset delivered/return totals back to 0.',
    routeActions: 'Actions',
    routeActionsSub: 'Expand to view all route options with descriptions.',
    expandOptions: 'Expand options',
    collapseOptions: 'Collapse options',
    clearTotalsBtn: 'Clear route totals',
    viewHistoryBtn: 'View history',
    editNameBtn: 'Rename route',
    saveAsTemplateBtn: 'Save as template',
    clear: 'Clear',
    confirmClearTotals: 'Clear totals for this route?\n\nCustomers remain, only totals are reset to 0.',
    routeTotalsCleared: 'Route totals cleared',
    noCustomersInRoute: 'No customers in this route',
    viewHistoryRouteSub: 'Review all changes and activity for this route.',
    editName: 'Edit name',
    editNameSub: 'Change the route name shown in your routes list.',
    saveAsTemplateSub: 'Save this route as a reusable starting point for new routes.',
    startMultiSelect: 'Start multi-selection',
    startMultiSelectSub: 'Select all customers at once for copy, share, or delete actions.',
    startMultiSelectBtn: 'Start',
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
    templateCreateSub: 'Choose a template, preview customers, and edit the route name.',
    templateCustomerCount: (count) => `${count} customer${count === 1 ? '' : 's'}`,
    templatePreviewMore: (count) => `+${count} more`,
    noTemplates: 'No templates available',
    templatePreview: 'Template preview',
    previewCards: 'Preview cards',
    noCardsInTemplate: 'No cards in this template',
    saveTemplate: 'Save',
    saveAsTemplate: 'Save as template',
    switchProject: 'Open',
    rename: 'Change name',
    remove: 'Delete',
    projectActions: 'Route actions',
    viewHistory: 'View history',
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
    importScreenshot: 'Import from screenshot',
    importScreenshotSub: 'Choose route screenshots and auto-create customer cards.',
    screenshotScan: 'Choose screenshot',
    screenshotImportPleaseWait: 'Please wait while the screenshots are being processed.',
    screenshotImportTimeoutHint: (seconds) => `Stops automatically after ${seconds}s if it takes too long.`,
    importCards: 'Import customers',
    importCardsSub: 'Paste copied customer lines to add them directly to this route.',
    importCardsPlaceholder: 'Paste customers here...',
    reorderCards: 'Re-order customers',
    reorderCardsSub: 'Move names without details',
    reorder: 'Re-order',
    history: 'History',
    globalHistory: 'Global history',
    allTotals: 'All totals',
    total: 'Total',
    name: 'Name',
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
    screenshotImportUnsupported: 'Screenshot scanning is not supported in this browser.',
    screenshotImportLoadingEngine: 'Loading OCR engine...',
    screenshotImportEngineFailed: 'Could not load the OCR engine.',
    screenshotImportScanning: (index, total) => `Scanning screenshot ${index}/${total}...`,
    screenshotImportCreating: (count) => `Creating ${count} customers...`,
    screenshotImportNoNames: '⚠ No customer names found in the selected screenshots',
    screenshotImportConfirm: (found, createCount, existingCount) => `Found customer names: ${found}\nNew to create: ${createCount}${existingCount ? `\nAlready exists: ${existingCount}` : ''}\n\nContinue?`,
    screenshotImportPreviewMore: (count) => `... and ${count} more`,
    screenshotImportCreated: (created, existingCount, failedCount = 0) => `✔ Created ${created} customers${existingCount ? `, ${existingCount} already existed` : ''}${failedCount ? `, skipped ${failedCount} screenshot${failedCount === 1 ? '' : 's'}` : ''}`,
    screenshotImportAllExisting: (count, failedCount = 0) => `✔ ${count} customers already exist${failedCount ? `, skipped ${failedCount} screenshot${failedCount === 1 ? '' : 's'}` : ''}`,
    screenshotImportPartialFailure: (count) => `⚠ Could not read ${count} screenshot${count === 1 ? '' : 's'}`,
    screenshotImportTimedOut: 'Screenshot scanning took too long and was stopped.',
    screenshotReviewTitle: 'Review customer names',
    screenshotReviewSub: (createCount, existingCount) => `New to create: ${createCount}${existingCount ? ` · Already exists: ${existingCount}` : ''}`,
    screenshotReviewExistingTitle: 'Customer names already exist',
    screenshotReviewExistingSub: (existingCount) => `${existingCount} customer${existingCount === 1 ? '' : 's'} already exist in this route`,
    screenshotReviewExistingBody: 'There are no new customers to create.',
    templateRouteConfirmTitle: 'Create route from template',
    templateRouteConfirmSub: (routeName) => `New route: ${routeName}`,
    templateRouteConfirmBody: (templateName, count) => `Template: ${templateName}${count ? ` · ${count} customers` : ''}`,
    language: 'Language',
    languageSub: 'Dutch / English',
    cardLayout: 'Customer layout',
    cardLayoutSub: 'Classic / Compact',
    classic: 'Classic',
    compact: 'Compact',
    freezerFeature: 'Freezer feature',
    freezerFeatureSub: 'Show cooler / freezer split on cards',
    devTools: 'Developer tools',
    devRouteSnapshot: 'Copy route snapshot',
    devRouteSnapshotSub: 'Copy the current route database snapshot as JSON',
    devRouteText: 'Copy route text',
    devRouteTextSub: 'Copy the current route in the normal shared text format',
    devAppState: 'Copy app state',
    devAppStateSub: 'Copy settings, selection, and viewport info as JSON',
    devViewportSync: 'Resync viewport',
    devViewportSyncSub: 'Re-run viewport logic for the CLI and modals',
    devSnowfall: 'Snowfall',
    devSnowfallSub: 'Drop a small freezer-flake storm across the app',
    copiedRouteSnapshot: '✔ Route snapshot copied',
    copiedRouteText: '✔ Route text copied',
    copiedAppState: '✔ App state copied',
    viewportResynced: '✔ Viewport resynced',
    snowfallStarted: '✔ Snowfall started',
    theme: 'Theme',
    themeSub: 'Dark / Light',
    handed: 'Left-handed',
    handedSub: 'Buttons on left',
    continuousCreation: 'Continuous creation',
    continuousCreationSub: 'Keep creation popup open',
    close: 'Close',
    save: 'Save',
    send: 'Send',
    run: 'Run',
    historyEvents: (n) => `${n} event${n === 1 ? '' : 's'}`,
    multiSelectActive: 'Multi-selection active',
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
    mainUnit: 'Cooler',
    mainUnitLower: 'cooler',
    freezer: 'Freezer',
    freezerLower: 'freezer',
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

function focusElementWithoutScroll(el) {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

function focusCmdSoon() {
  // next frame: after DOM + disabled state settles
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      focusElementWithoutScroll(cmd);
      requestAnimationFrame(() => syncVisualViewport());
    });
  });
}

function scrollCardToTop(el) {
  if (!el) return;

  if (cmdScrollLockActive && appRoot) {
    const alignInApp = (remainingPasses = IN_APP_CARD_TOP_ALIGN_PASSES) => {
      if (!cmdScrollLockActive || !appRoot || !el?.isConnected) return;

      const appRect = appRoot.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const delta = Math.round((elRect.top - appRect.top) - IN_APP_CARD_TOP_GAP_PX);

      if (Math.abs(delta) > IN_APP_CARD_TOP_ALIGN_EPSILON_PX) {
        appRoot.scrollTop = Math.max(0, appRoot.scrollTop + delta);
      }

      if (remainingPasses > 0) {
        requestAnimationFrame(() => alignInApp(remainingPasses - 1));
      }
    };

    alignInApp();
    return;
  }

  el.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function scrollSelectedCardToTopSoon() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.querySelector('.group.selected');
      if (!el) return;
      scrollCardToTop(el);
    });
  });
}

function focusNewGroupInputAtBottom() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const input = document.getElementById('newGroupInput');
      focusElementWithoutScroll(input);
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
      scrollCardToTop(card);
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

function isFreezerEnabled() {
  return localStorage.getItem(FREEZER_ENABLED_KEY) === '1';
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

function compactTemplateSnapshot(snapshot) {
  const groups = Array.isArray(snapshot?.groups)
    ? snapshot.groups
      .map((group) => ({ name: String(group?.name || '').trim() }))
      .filter((group) => group.name)
    : [];
  return {
    groups,
    events: []
  };
}

function normalizeTemplateRecord(template) {
  return {
    ...template,
    snapshot: compactTemplateSnapshot(template?.snapshot)
  };
}

function readTemplates() {
  try {
    const raw = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const normalized = raw.map(normalizeTemplateRecord);
    if (JSON.stringify(normalized) !== JSON.stringify(raw)) {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return [];
  }
}

function writeTemplates(templates) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify((templates || []).map(normalizeTemplateRecord)));
  renderCreateProjectModeControls();
  if (!templateCreateBackdrop?.classList.contains('hidden')) {
    renderTemplateCreateModal();
  }
}

function refreshCreateTemplateOptions() {
  if (openCreateTemplateModalBtn) {
    openCreateTemplateModalBtn.disabled = readTemplates().length === 0;
  }
}

function renderCreateProjectModeControls() {
  if (createProjectBtn) createProjectBtn.textContent = t('createProject');
  if (openCreateTemplateModalBtn) openCreateTemplateModalBtn.textContent = t('createModeTemplate');
  refreshCreateTemplateOptions();
}

function renderRouteActionsMenu() {
  if (routeActionsTitle) routeActionsTitle.textContent = t('routeActions');
  if (routeActionsSub) routeActionsSub.textContent = t('routeActionsSub');
  if (routeActionsMenuBtn) {
    const hasQuery = String(panelSearch?.value || '').trim().length > 0;
    const suffix = hasQuery && routeActionsSearchHits > 0 ? ` (${routeActionsSearchHits})` : '';
    routeActionsMenuBtn.textContent = `${routeActionsMenuOpen ? t('collapseOptions') : t('expandOptions')}${suffix}`;
    routeActionsMenuBtn.setAttribute('aria-label', routeActionsMenuOpen ? t('collapseOptions') : t('expandOptions'));
    routeActionsMenuBtn.setAttribute('title', routeActionsMenuOpen ? t('collapseOptions') : t('expandOptions'));
    routeActionsMenuBtn.setAttribute('aria-expanded', routeActionsMenuOpen ? 'true' : 'false');
  }
  if (routeActionsMenu) routeActionsMenu.classList.toggle('open', routeActionsMenuOpen);
}

function getCurrentRouteRecord() {
  const currentId = getCurrentProject();
  return readProjects().find((p) => p.id === currentId) || null;
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
  const cards = [];

  for (const g of chosen) {
    cards.push(buildCardExportText(g));
  }

  return cards.join('\n\n___\n\n');
}

async function buildCurrentRouteCardsText() {
  const all = orderGroups(await getGroupsWithTotals());

  return {
    text: all.map(buildCardExportText).join('\n\n___\n\n'),
    count: all.length
  };
}

function normalizeTextKey(s) {
  return String(s || '').trim().toLowerCase();
}

function buildTotalsTextLines(totals, defs = getTokenDefs()) {
  return TOKEN_ORDER
    .map((k) => ({ name: tokenNameNL(defs, k), v: Number(totals?.[k] || 0), ref: displayKey(defs, k) }))
    .filter((x) => x.v !== 0)
    .map((x) => `${x.name} ${x.v} ${x.ref}`);
}

function buildModeExportText(storageTotals, defs = getTokenDefs()) {
  const mainLines = buildTotalsTextLines(storageTotals?.main, defs);
  const freezerLines = buildTotalsTextLines(storageTotals?.freezer, defs);
  return `${t('mainUnit')}:\n${mainLines.join('\n') || '-'}\n\n${t('freezer')}:\n${freezerLines.join('\n') || '-'}`;
}

function buildCardExportText(group) {
  const defs = getTokenDefs();
  return `${group.name} - ${t('delivered')}:\n${buildModeExportText({
    main: group?.storage?.main?.geleverd,
    freezer: group?.storage?.freezer?.geleverd
  }, defs)}\n\n${t('returned')}:\n${buildTotalsTextLines(group?.retour, defs).join('\n') || '-'}`;
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
    let fullName = '';
    let qty = 0;
    let ref = '';

    const full = line.match(/^(.*\S)\s+(-?\d+)\s+([a-zA-Z_]+)$/);
    if (full) {
      fullName = normalizeTextKey(full[1]);
      qty = Number(full[2]);
      ref = String(full[3] || '').toLowerCase();
    } else {
      // Backward/alternate format: "<qty> <ref>"
      const compact = line.match(/^(-?\d+)\s+([a-zA-Z_]+)$/);
      if (!compact) continue;
      qty = Number(compact[1]);
      ref = String(compact[2] || '').toLowerCase();
    }

    let id = fullName ? byName.get(fullName) : undefined;
    if (!id && aliasMap[ref]) id = aliasMap[ref];
    if (!id) continue;

    out[id] += qty;
  }

  return out;
}

function parseImportModeSection(sectionText, defs, aliasMap) {
  const storageLines = {
    main: [],
    freezer: []
  };

  let activeStorage = 'main';
  for (const rawLine of String(sectionText || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^(?:Hoofdunit|Koelcel|Main unit|Cooler)\s*:\s*$/i.test(line)) {
      activeStorage = 'main';
      continue;
    }
    if (/^(?:Freezer)\s*:\s*$/i.test(line)) {
      activeStorage = 'freezer';
      continue;
    }

    storageLines[activeStorage].push(line);
  }

  return {
    main: parseImportSection(storageLines.main.join('\n'), defs, aliasMap),
    freezer: parseImportSection(storageLines.freezer.join('\n'), defs, aliasMap)
  };
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

    const geleverd = parseImportModeSection(m[2], defs, aliasMap);
    const retour = parseImportSection(m[3], defs, aliasMap);

    cards.push({
      name,
      storage: {
        main: {
          geleverd: geleverd.main,
          retour
        },
        freezer: {
          geleverd: geleverd.freezer,
          retour: emptyTotals()
        }
      }
    });
  }

  return cards;
}

function buildEventPayload(groupId, groupName, target, totals, storage = 'main') {
  const evt = { groupId, groupName, target, storage: normalizeStorage(storage) };
  for (const k of TOKEN_ORDER) {
    const v = Number(totals?.[k] || 0);
    if (v !== 0) evt[k] = v;
  }
  return evt;
}

async function collapseFreezerDeliveredIntoMain() {
  const groups = await getGroupsWithTotals();

  for (const group of groups) {
    const freezerDelivered = Object.fromEntries(TOKEN_ORDER.map((k) => [
      k,
      Number(group?.storage?.freezer?.geleverd?.[k] || 0)
    ]));

    if (!hasAnyDelta(freezerDelivered)) continue;

    const clearFreezer = Object.fromEntries(TOKEN_ORDER.map((k) => [
      k,
      -Number(freezerDelivered[k] || 0)
    ]));

    await addEvent(buildEventPayload(group.id, group.name, 'geleverd', freezerDelivered, 'main'));
    await addEvent(buildEventPayload(group.id, group.name, 'geleverd', clearFreezer, 'freezer'));
  }
}

async function importCardsFromText(inputText) {
  const parsed = parseImportCardsText(inputText);
  if (!parsed.length) return 0;

  const existing = await getGroupsWithTotals();
  const byName = new Map(existing.map(g => [normalizeTextKey(g.name), g]));

  for (const card of parsed) {
    const existingGroup = byName.get(normalizeTextKey(card.name));
    let groupId;
    let currentStorage = emptyStorageTotals();

    if (existingGroup) {
      groupId = Number(existingGroup.id);
      currentStorage = cloneStorageTotals(existingGroup.storage);
    } else {
      groupId = Number(await ensureGroup(card.name));
      byName.set(normalizeTextKey(card.name), {
        id: groupId,
        name: card.name,
        storage: currentStorage,
        geleverd: sumStorageModeTotals(currentStorage, 'geleverd'),
        retour: sumStorageModeTotals(currentStorage, 'retour')
      });
    }

    for (const storage of STORAGE_ORDER) {
      const deltaG = Object.fromEntries(TOKEN_ORDER.map((k) => [
        k,
        Number(card?.storage?.[storage]?.geleverd?.[k] || 0) - Number(currentStorage?.[storage]?.geleverd?.[k] || 0)
      ]));
      const deltaR = Object.fromEntries(TOKEN_ORDER.map((k) => [
        k,
        Number(card?.storage?.[storage]?.retour?.[k] || 0) - Number(currentStorage?.[storage]?.retour?.[k] || 0)
      ]));

      if (hasAnyDelta(deltaG)) await addEvent(buildEventPayload(groupId, card.name, 'geleverd', deltaG, storage));
      if (hasAnyDelta(deltaR)) await addEvent(buildEventPayload(groupId, card.name, 'retour', deltaR, storage));
    }

    const nextStorage = cloneStorageTotals(card.storage);
    byName.set(normalizeTextKey(card.name), {
      id: groupId,
      name: card.name,
      storage: nextStorage,
      geleverd: sumStorageModeTotals(nextStorage, 'geleverd'),
      retour: sumStorageModeTotals(nextStorage, 'retour')
    });
  }

  return parsed.length;
}

function supportsScreenshotImport() {
  return (
    typeof globalThis.TextDetector === 'function' ||
    (
      typeof document !== 'undefined' &&
      typeof globalThis.URL?.createObjectURL === 'function' &&
      typeof Image === 'function'
    )
  );
}

function setScreenshotImportBusy(busy) {
  screenshotImportBusy = !!busy;
  if (importScreenshotBtn) importScreenshotBtn.disabled = screenshotImportBusy;
  if (importScreenshotInput) importScreenshotInput.disabled = screenshotImportBusy;
}

function openScreenshotLoadingModal() {
  if (screenshotLoadingTitle) screenshotLoadingTitle.textContent = t('importScreenshot');
  if (screenshotLoadingSub) screenshotLoadingSub.textContent = t('screenshotImportPleaseWait');
  screenshotLoadingBackdrop?.classList.remove('hidden');
}

function closeScreenshotLoadingModal() {
  screenshotLoadingBackdrop?.classList.add('hidden');
}

function getScreenshotImportRemainingSeconds(session) {
  const remainingMs = Math.max(0, Number(session?.deadline || 0) - Date.now());
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

function updateScreenshotLoadingModal(statusText, session = null) {
  if (screenshotLoadingStatus) screenshotLoadingStatus.textContent = String(statusText || '');
  if (screenshotLoadingTimeout) {
    const seconds = session ? getScreenshotImportRemainingSeconds(session) : Math.ceil(SCREENSHOT_IMPORT_TIMEOUT_MS / 1000);
    screenshotLoadingTimeout.textContent = t('screenshotImportTimeoutHint', seconds);
  }
}

function createScreenshotImportSession() {
  const session = {
    cancelled: false,
    deadline: Date.now() + SCREENSHOT_IMPORT_TIMEOUT_MS,
    countdownId: 0
  };

  openScreenshotLoadingModal();
  updateScreenshotLoadingModal(t('screenshotImportLoadingEngine'), session);
  session.countdownId = window.setInterval(() => {
    if (session.cancelled) return;
    updateScreenshotLoadingModal(screenshotLoadingStatus?.textContent || '', session);
  }, 250);
  return session;
}

function finishScreenshotImportSession(session) {
  if (session?.countdownId) {
    clearInterval(session.countdownId);
    session.countdownId = 0;
  }
  closeScreenshotLoadingModal();
}

function getScreenshotImportTimeoutError() {
  return new Error(t('screenshotImportTimedOut'));
}

function isScreenshotImportTimeoutError(error) {
  return String(error?.message || '') === t('screenshotImportTimedOut');
}

function assertScreenshotImportSession(session) {
  if (!session) return;
  if (session.cancelled || Date.now() >= Number(session.deadline || 0)) {
    session.cancelled = true;
    throw getScreenshotImportTimeoutError();
  }
}

async function runWithScreenshotImportTimeout(session, promise) {
  assertScreenshotImportSession(session);
  const remainingMs = Math.max(0, Number(session.deadline || 0) - Date.now());
  if (remainingMs <= 0) {
    session.cancelled = true;
    throw getScreenshotImportTimeoutError();
  }

  let timerId = 0;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timerId = window.setTimeout(() => {
          session.cancelled = true;
          reject(getScreenshotImportTimeoutError());
        }, remainingMs);
      })
    ]);
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}

function waitForNextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function normalizeOcrTextValue(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function getDetectedTextRect(entry) {
  const box = entry?.boundingBox;
  if (
    box &&
    Number.isFinite(Number(box.x)) &&
    Number.isFinite(Number(box.y)) &&
    Number.isFinite(Number(box.width)) &&
    Number.isFinite(Number(box.height))
  ) {
    return {
      x: Number(box.x),
      y: Number(box.y),
      width: Number(box.width),
      height: Number(box.height)
    };
  }

  const points = Array.isArray(entry?.cornerPoints) ? entry.cornerPoints : [];
  if (!points.length) return null;
  const xs = points.map((point) => Number(point?.x)).filter(Number.isFinite);
  const ys = points.map((point) => Number(point?.y)).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  };
}

function splitDetectedTextBlocksIntoLines(blocks) {
  const lines = [];
  let fallbackY = 0;

  for (const block of Array.isArray(blocks) ? blocks : []) {
    const parts = String(block?.rawValue || block?.text || '')
      .split(/\r?\n/)
      .map(normalizeOcrTextValue)
      .filter(Boolean);
    if (!parts.length) continue;

    const rect = getDetectedTextRect(block);
    const x = Number(rect?.x || 0);
    const width = Number(rect?.width || 0);
    const lineHeight = Math.max(12, Number(rect?.height || 20) / parts.length);
    const baseY = Number(rect?.y ?? fallbackY);

    for (let index = 0; index < parts.length; index += 1) {
      lines.push({
        text: parts[index],
        x,
        y: baseY + (lineHeight * index),
        width,
        height: lineHeight
      });
    }

    fallbackY = baseY + (lineHeight * parts.length);
  }

  return lines.sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

function normalizeCanvasForOcr(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  let luminanceTotal = 0;
  let sampleCount = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (!alpha) continue;
    const luminance = (pixels[index] * 0.2126) + (pixels[index + 1] * 0.7152) + (pixels[index + 2] * 0.0722);
    luminanceTotal += luminance;
    sampleCount += 1;
  }

  const averageLuminance = sampleCount ? (luminanceTotal / sampleCount) : 255;
  const invert = averageLuminance < 128;

  for (let index = 0; index < pixels.length; index += 4) {
    let luminance = (pixels[index] * 0.2126) + (pixels[index + 1] * 0.7152) + (pixels[index + 2] * 0.0722);
    if (invert) luminance = 255 - luminance;
    luminance = ((luminance - 128) * 2.2) + 128;
    luminance = Math.max(0, Math.min(255, luminance));
    if (luminance > 205) luminance = 255;
    if (luminance < 50) luminance = 0;
    pixels[index] = luminance;
    pixels[index + 1] = luminance;
    pixels[index + 2] = luminance;
  }

  ctx.putImageData(imageData, 0, 0);
}

function buildScreenshotOcrCanvas(image, preprocess = false) {
  const cropTop = Math.max(0, Math.round(image.height * SCREENSHOT_IMPORT_CROP_TOP_RATIO));
  const cropBottom = Math.max(0, Math.round(image.height * SCREENSHOT_IMPORT_CROP_BOTTOM_RATIO));
  const cropHeight = Math.max(1, image.height - cropTop - cropBottom);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = cropHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: preprocess });
  if (!ctx) return canvas;

  ctx.drawImage(image, 0, cropTop, image.width, cropHeight, 0, 0, image.width, cropHeight);
  if (preprocess) normalizeCanvasForOcr(ctx, canvas.width, canvas.height);
  return canvas;
}

function isScreenshotUiLine(text) {
  const value = normalizeTextKey(text);
  if (!value) return true;
  if (/^\d+(?:[.,]\d+)?\s*(?:km|min|m)$/.test(value)) return true;

  return [
    'rit',
    'route',
    'bezorging',
    'actief',
    'lijst',
    'kaart',
    'home',
    'profiel',
    'instellingen',
    'menu',
    'zoeken',
    'scan',
    'filters',
    'overzicht'
  ].some((word) => value === word || value.startsWith(`${word} `));
}

function isScreenshotAddressLine(text) {
  const value = normalizeOcrTextValue(text);
  if (!value) return false;
  if (/\b\d{4}\s?[A-Za-z]{2}\b/.test(value)) return true;
  return /\d/.test(value) && /[A-Za-zÀ-ÿ]/.test(value);
}

function cleanScreenshotNameCandidate(text) {
  let value = normalizeOcrTextValue(text)
    .replace(/^[^A-Za-zÀ-ÿ0-9]+/, '')
    .replace(/[.,:;]+$/g, '')
    .trim();

  if (/^[A-Za-z]\s+(?=[A-Za-zÀ-ÿ]{2,})/.test(value)) {
    value = value.replace(/^[A-Za-z]\s+/, '').trim();
  }

  return value;
}

function isScreenshotNameCandidate(text) {
  const value = normalizeOcrTextValue(text);
  if (!value) return false;
  if (isScreenshotUiLine(value)) return false;
  if (/\d/.test(value)) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(value)) return false;
  if (value.length < 2 || value.length > 64) return false;
  if (/^[A-Za-z]$/.test(value)) return false;
  return true;
}

function dedupeCustomerNameList(names) {
  const seen = new Set();
  const out = [];

  for (const rawName of names) {
    const name = normalizeOcrTextValue(rawName);
    const key = normalizeTextKey(name);
    if (!key || SCREENSHOT_IMPORT_IGNORED_NAME_KEYS.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }

  return out;
}

function hasNearbyScreenshotAddressLine(lines, index, imageWidth) {
  const line = lines[index];
  const baseY = Number(line?.y || 0);
  const baseX = Number(line?.x || 0);
  const maxDeltaY = Math.max(34, Number(line?.height || 0) * 3.8);
  const maxDeltaX = imageWidth * SCREENSHOT_IMPORT_ADDRESS_X_TOLERANCE_RATIO;

  for (let nextIndex = index + 1; nextIndex < Math.min(lines.length, index + 4); nextIndex += 1) {
    const next = lines[nextIndex];
    const deltaY = Number(next?.y || 0) - baseY;
    if (deltaY < 0) continue;
    if (deltaY > maxDeltaY) break;
    if (Math.abs(Number(next?.x || 0) - baseX) > maxDeltaX) continue;
    if (isScreenshotAddressLine(next?.text)) return true;
  }

  return false;
}

function extractCustomerNamesFromDetectedLines(lines, imageWidth) {
  const strictMatches = [];
  const looseMatches = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const name = cleanScreenshotNameCandidate(line?.text);
    if (!isScreenshotNameCandidate(name)) continue;

    const x = Number(line?.x || 0);
    const width = Number(line?.width || 0);
    if (x > imageWidth * 0.72) continue;

    if (hasNearbyScreenshotAddressLine(lines, index, imageWidth)) {
      strictMatches.push(name);
      continue;
    }

    if (!width || width < imageWidth * 0.92) {
      looseMatches.push(name);
    }
  }

  const strictNames = dedupeCustomerNameList(strictMatches);
  const names = strictNames.length >= SCREENSHOT_IMPORT_MIN_STRICT_MATCHES
    ? strictNames
    : dedupeCustomerNameList(strictMatches.concat(looseMatches));

  return {
    names,
    strictCount: strictNames.length
  };
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Image load failed: ${file?.name || 'unknown'}`));
    };
    image.src = objectUrl;
  });
}

function splitFallbackTextIntoLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(normalizeOcrTextValue)
    .filter(Boolean)
    .map((line, index) => ({
      text: line,
      x: 0,
      y: index * 24,
      width: 0,
      height: 18
    }));
}

function normalizeTesseractLines(data) {
  const lines = Array.isArray(data?.lines) ? data.lines : [];
  if (!lines.length) return splitFallbackTextIntoLines(data?.text || '');

  return lines
    .map((line, index) => {
      const text = normalizeOcrTextValue(line?.text);
      if (!text) return null;
      const bbox = line?.bbox || {};
      const x0 = Number.isFinite(Number(bbox.x0)) ? Number(bbox.x0) : 0;
      const y0 = Number.isFinite(Number(bbox.y0)) ? Number(bbox.y0) : index * 24;
      const x1 = Number.isFinite(Number(bbox.x1)) ? Number(bbox.x1) : x0;
      const y1 = Number.isFinite(Number(bbox.y1)) ? Number(bbox.y1) : y0 + 18;
      return {
        text,
        x: x0,
        y: y0,
        width: Math.max(0, x1 - x0),
        height: Math.max(12, y1 - y0)
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

async function loadFallbackScreenshotOcrEngine() {
  if (globalThis.Tesseract?.recognize) return globalThis.Tesseract;
  if (screenshotOcrEnginePromise) return screenshotOcrEnginePromise;

  screenshotOcrEnginePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-rogo-tesseract="1"]');
    if (existing) {
      const finalize = () => {
        if (globalThis.Tesseract?.recognize) {
          resolve(globalThis.Tesseract);
          return;
        }
        screenshotOcrEnginePromise = null;
        reject(new Error(t('screenshotImportEngineFailed')));
      };
      existing.addEventListener('load', finalize, { once: true });
      existing.addEventListener('error', () => {
        screenshotOcrEnginePromise = null;
        reject(new Error(t('screenshotImportEngineFailed')));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = SCREENSHOT_IMPORT_TESSERACT_SCRIPT_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.rogoTesseract = '1';
    script.onload = () => {
      if (globalThis.Tesseract?.recognize) {
        resolve(globalThis.Tesseract);
        return;
      }
      screenshotOcrEnginePromise = null;
      reject(new Error(t('screenshotImportEngineFailed')));
    };
    script.onerror = () => {
      screenshotOcrEnginePromise = null;
      reject(new Error(t('screenshotImportEngineFailed')));
    };
    document.head.appendChild(script);
  });

  return screenshotOcrEnginePromise;
}

async function detectScreenshotCustomerNamesWithNative(file) {
  const image = await loadImageFromFile(file);
  const detector = new globalThis.TextDetector();
  const variants = [
    buildScreenshotOcrCanvas(image, false),
    buildScreenshotOcrCanvas(image, true)
  ];

  let bestResult = { names: [], strictCount: 0 };
  for (const variant of variants) {
    const blocks = await detector.detect(variant);
    const lines = splitDetectedTextBlocksIntoLines(blocks);
    const result = extractCustomerNamesFromDetectedLines(lines, variant.width);
    const currentScore = (bestResult.strictCount * 100) + bestResult.names.length;
    const nextScore = (result.strictCount * 100) + result.names.length;
    if (nextScore > currentScore) bestResult = result;
  }

  return bestResult.names;
}

async function detectScreenshotCustomerNamesWithFallback(file) {
  const image = await loadImageFromFile(file);
  const tesseract = await loadFallbackScreenshotOcrEngine();
  const variants = [
    buildScreenshotOcrCanvas(image, false),
    buildScreenshotOcrCanvas(image, true)
  ];

  let bestResult = { names: [], strictCount: 0 };
  for (const variant of variants) {
    const result = await tesseract.recognize(variant, SCREENSHOT_IMPORT_TESSERACT_LANG);
    const lines = normalizeTesseractLines(result?.data);
    const extracted = extractCustomerNamesFromDetectedLines(lines, variant.width);
    const currentScore = (bestResult.strictCount * 100) + bestResult.names.length;
    const nextScore = (extracted.strictCount * 100) + extracted.names.length;
    if (nextScore > currentScore) bestResult = extracted;
  }

  return bestResult.names;
}

async function detectScreenshotCustomerNames(file) {
  if (!supportsScreenshotImport()) {
    throw new Error(t('screenshotImportUnsupported'));
  }

  if (typeof globalThis.TextDetector === 'function') {
    return detectScreenshotCustomerNamesWithNative(file);
  }

  return detectScreenshotCustomerNamesWithFallback(file);
}

async function collectScreenshotImportNames(files, session) {
  const allNames = [];
  let failedCount = 0;

  if (typeof globalThis.TextDetector !== 'function') {
    updateScreenshotLoadingModal(t('screenshotImportLoadingEngine'), session);
    await waitForNextFrame();
    await runWithScreenshotImportTimeout(session, loadFallbackScreenshotOcrEngine());
  }

  for (let index = 0; index < files.length; index += 1) {
    assertScreenshotImportSession(session);
    updateScreenshotLoadingModal(t('screenshotImportScanning', index + 1, files.length), session);
    await waitForNextFrame();

    try {
      const names = await runWithScreenshotImportTimeout(session, detectScreenshotCustomerNames(files[index]));
      allNames.push(...names);
    } catch (error) {
      if (isScreenshotImportTimeoutError(error)) throw error;
      failedCount += 1;
    }
  }

  return {
    names: dedupeCustomerNameList(allNames),
    failedCount
  };
}

function buildScreenshotImportPreviewItems(names) {
  const preview = names
    .slice(0, SCREENSHOT_IMPORT_PREVIEW_LIMIT)
    .map((name) => name);

  if (names.length > SCREENSHOT_IMPORT_PREVIEW_LIMIT) {
    preview.push(t('screenshotImportPreviewMore', names.length - SCREENSHOT_IMPORT_PREVIEW_LIMIT));
  }

  return preview;
}

async function createCustomersFromNames(names, session = null) {
  let createdCount = 0;
  for (const name of names) {
    if (session) {
      assertScreenshotImportSession(session);
      updateScreenshotLoadingModal(t('screenshotImportCreating', names.length), session);
      await runWithScreenshotImportTimeout(session, ensureGroup(name));
    } else {
      await ensureGroup(name);
    }
    createdCount += 1;
  }
  return createdCount;
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

function setCmdScrollLock(locked) {
  if (locked) {
    if (cmdScrollLockActive) return;
    cmdScrollLockY = window.scrollY || window.pageYOffset || 0;
    // Freeze window scrolling and hand vertical movement over to #app
    // so fixed UI can stay stable while the keyboard is open.
    document.body.classList.add('cmd-scroll-lock');
    window.scrollTo(0, 0);
    if (appRoot) appRoot.scrollTop = cmdScrollLockY;
    cmdScrollLockActive = true;
    return;
  }

  if (!cmdScrollLockActive) return;
  const nextScrollY = appRoot ? appRoot.scrollTop : cmdScrollLockY;
  document.body.classList.remove('cmd-scroll-lock');
  if (appRoot) appRoot.scrollTop = 0;
  requestAnimationFrame(() => {
    window.scrollTo(0, nextScrollY);
  });
  cmdScrollLockActive = false;
}

function keepCmdScrollLockBriefly(ms = VIEWPORT_LOCK_HOLD_MS) {
  preserveCmdScrollLockUntil = Date.now() + ms;
  if (cmdBlurUnlockTimer) {
    clearTimeout(cmdBlurUnlockTimer);
    cmdBlurUnlockTimer = null;
  }
}

function keepSelectedCardTopAlignedBriefly(ms = SELECTED_CARD_TOP_ALIGN_HOLD_MS) {
  preserveSelectedCardTopUntil = Date.now() + ms;
}

function isNameEditor(el = document.activeElement) {
  return !!(
    el &&
    el.matches?.('textarea.group-title-input, #newGroupInput, #newGroupName')
  );
}

function syncCliNameEditVisibility() {
  document.body.classList.toggle('hide-cli-for-name-edit', isNameEditor());
}

function isViewportLockEditor(el = document.activeElement) {
  return !!(
    el &&
    (
      el === cmd ||
      isNameEditor(el)
    )
  );
}

function sumInputTotals(input) {
  const defs = getTokenDefs();
  const aliasMap = buildAliasMap(defs);
  const totals = Object.fromEntries(TOKEN_ORDER.map(k => [k, 0]));
  const parts = input.trim().split(/\s+/).filter(Boolean);
  const freezerEnabled = isFreezerEnabled();

  for (const p of parts) {
    const parsed = parsePart(p);
    if (!parsed) continue;

    const val = parsed.value;
    let resolved;
    try {
      resolved = resolveCommandAlias(parsed.alias, {
        mode: selectedMode,
        freezerEnabled,
        raw: p
      });
    } catch {
      continue;
    }
    const key = aliasMap[resolved.alias];
    if (!key) continue;

    totals[key] += val;
  }

  return totals;
}

function parseCliCommandInput(input, { mode = selectedMode, storage = selectedStorage } = {}) {
  if (!String(input || '').trim() || !mode) return null;
  try {
    return parseCommandInput(input, {
      mode,
      storage,
      freezerEnabled: isFreezerEnabled()
    });
  } catch {
    return null;
  }
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

function findCommandNegativeTotals(currentStorageTotals, mode, storage, parsedCommand) {
  if (!parsedCommand || !currentStorageTotals || !mode) return [];

  if (mode === 'retour') {
    return findNegativeTotals(currentStorageTotals?.main?.retour, parsedCommand.totals);
  }

  if (parsedCommand.hasMixedStorage) {
    return [
      ...findNegativeTotals(currentStorageTotals?.main?.geleverd, parsedCommand.amountsByStorage?.main),
      ...findNegativeTotals(currentStorageTotals?.freezer?.geleverd, parsedCommand.amountsByStorage?.freezer)
    ];
  }

  const targetStorage = activeStorageForMode(mode, storage);
  return findNegativeTotals(
    currentStorageTotals?.[targetStorage]?.geleverd,
    parsedCommand.totals
  );
}

function storageLabel(storage, lower = false) {
  const safeStorage = normalizeStorage(storage);
  if (safeStorage === 'freezer') return t(lower ? 'freezerLower' : 'freezer');
  return t(lower ? 'mainUnitLower' : 'mainUnit');
}

function activeStorageForMode(mode, storage) {
  if (mode === 'retour' || !isFreezerEnabled()) return 'main';
  return normalizeStorage(storage);
}

function formatTotalsInline(totals, { limit = Number.POSITIVE_INFINITY, zero = '…', signed = false } = {}) {
  const defs = getTokenDefs();
  const parts = [];

  for (const k of TOKEN_ORDER) {
    const value = Number(totals?.[k] || 0);
    if (value === 0) continue;
    const qty = signed && value > 0 ? `+${value}` : `${value}`;
    parts.push(`${qty}${displayKey(defs, k)}`);
  }

  if (!parts.length) return zero;
  const shown = parts.slice(0, limit);
  const hidden = parts.length - shown.length;
  return hidden > 0 ? `${shown.join(' ')} +${hidden}` : shown.join(' ');
}

function getStorageModeTotals(group, storage, mode) {
  const safeStorage = activeStorageForMode(mode, storage);
  const safeMode = mode === 'retour' ? 'retour' : 'geleverd';
  return group?.storage?.[safeStorage]?.[safeMode] || emptyTotals();
}

function formatStorageChipValue(group, storage, mode) {
  const current = getStorageModeTotals(group, storage, mode);
  return formatTotalsInline(current, { zero: '—' });
}

function formatFreezerReminder(storageTotals, limit = 3) {
  return formatTotalsInline(storageTotals?.geleverd, { limit, zero: '' });
}

function formatEventTargetLabel(evt) {
  const target = evt?.target === 'retour' ? t('returned') : t('delivered');
  if (evt?.target === 'retour') return target;
  return normalizeStorage(evt?.storage) === 'freezer' ? storageLabel('freezer') : target;
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

function buildActionLine(groupName, mode, storage, deltaTotals, { storageTotals = null, mixedStorage = false } = {}) {
  if (mode === 'geleverd' && mixedStorage && storageTotals) {
    const segments = [];
    const mainText = formatTotalsInline(storageTotals.main, { zero: '' });
    const freezerText = formatTotalsInline(storageTotals.freezer, { zero: '' });
    if (mainText) segments.push(`${storageLabel('main', true)} → ${mainText}`);
    if (freezerText) segments.push(`${storageLabel('freezer', true)} → ${freezerText}`);
    if (segments.length) return `${groupName} · ${segments.join(' · ')}`;
  }

  const safeStorage = activeStorageForMode(mode, storage);
  const targetLabel = mode === 'retour'
    ? t('returnedLower')
    : safeStorage === 'freezer'
      ? storageLabel('freezer', true)
      : t('deliveredLower');
  return `${groupName} · ${targetLabel} → ${formatTotalsInline(deltaTotals, { zero: '…' })}`;
}

function renderFreezerReminder(group, { selected = false, inline = false, limit = 3 } = {}) {
  if (!isFreezerEnabled()) return '';
  const text = formatFreezerReminder(group?.storage?.freezer, limit);
  if (!text) return '';
  return `<div class="freezer-reminder ${selected ? 'selected' : ''} ${inline ? 'inline' : ''}">${FREEZER_REMINDER_ICON_SVG}<span>${escapeHtml(text)}</span></div>`;
}

function shouldInlineUnselectedFreezerReminder(group, limit = 3) {
  if (!isFreezerEnabled()) return false;
  const text = formatFreezerReminder(group?.storage?.freezer, limit);
  if (!text) return false;
  const nameText = String(group?.name || '').trim();
  return text.length <= 16 && nameText.length <= 24;
}

function renderSelectedFreezerReminder(group, cardLayout) {
  const reminder = renderFreezerReminder(group, {
    selected: true,
    inline: true,
    limit: cardLayout === 'classic' ? 2 : 3
  });
  if (!reminder || cardLayout !== 'classic') return '';
  return reminder;
}

function renderStorageSelector(group, mode, activeStorage) {
  if (mode !== 'geleverd' || !isFreezerEnabled()) return '';

  const items = STORAGE_ORDER.map((storage) => {
    const safeStorage = normalizeStorage(storage);
    const active = safeStorage === activeStorageForMode(mode, activeStorage);
    const value = formatStorageChipValue(group, safeStorage, mode);

    return `
      <button
        type="button"
        class="storage-chip ${safeStorage === 'freezer' ? 'freezer' : 'main'} ${active ? 'active' : ''}"
        data-storage="${safeStorage}"
      >
        <span class="storage-label">${escapeHtml(storageLabel(safeStorage))}</span>
        <span class="storage-value">${escapeHtml(value)}</span>
      </button>
    `;
  }).join('');

  return `<div class="storage-split">${items}</div>`;
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

    const target = formatEventTargetLabel(e);
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
  const headLead = (isSelected && selectedMode !== 'geleverd')
    ? renderFreezerReminder(g, { selected: true, inline: true, limit: 3 })
    : '';
  const headMarkup = isSelected
    ? `
      <div class="compact-head">
        <div class="compact-head-label">${headLead}</div>
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
  const typedTotals = selectedGroup && selectedMode ? sumInputTotals(cmd.value) : emptyTotals();
  window.__selectedGroupId = selectedObj?.id || null;
  const selectedModeTotals = selectedObj && selectedMode
    ? getStorageModeTotals(selectedObj, selectedStorage, selectedMode)
    : null;
  window.__selectedStorageTotals = selectedObj?.storage || emptyStorageTotals();
  window.__selectedTotals = selectedModeTotals || emptyTotals();
  list.innerHTML = '';
  list.innerHTML += renderAllTotalsSummary(groups);

  for (const g of groups) {
    const isSelected = g.name === selectedGroup;
    const isMultiSelected = selectedGroupIds.has(Number(g.id));
    const selectedCardToneClass = isSelected
      ? selectedMode === 'retour'
        ? 'selection-retour'
        : selectedMode === 'geleverd'
          ? (activeStorageForMode(selectedMode, selectedStorage) === 'freezer' ? 'selection-freezer' : 'selection-geleverd')
          : 'selection-idle'
      : '';

    const deltaTotals = typedTotals;
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
    const storageMarkup = isSelected
      ? renderStorageSelector(g, selectedMode, selectedStorage)
      : '';
    const freezerReminderLimit = cardLayout === 'classic' ? 2 : 3;
    const inlineUnselectedFreezerReminder = !isSelected && shouldInlineUnselectedFreezerReminder(g, freezerReminderLimit);
    const freezerReminderMarkup = !isSelected
      ? renderFreezerReminder(g, { inline: inlineUnselectedFreezerReminder, limit: freezerReminderLimit })
      : '';
    const selectedHeadFreezerReminderMarkup = (isSelected && selectedMode !== 'geleverd')
      ? renderSelectedFreezerReminder(g, cardLayout)
      : '';

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
      <div class="group ${isSelected ? 'selected' : ''} ${selectedCardToneClass} ${isMultiSelected ? 'multi-selected' : ''}" data-id="${g.id}" data-name="${g.name}" draggable="false">
        <div class="group-head ${selectedHeadFreezerReminderMarkup ? 'has-selected-reminder' : ''}">
          <div class="group-head-main ${inlineUnselectedFreezerReminder ? 'inline-reminder' : ''}">
            <div class="group-title-wrap">
              <div
                class="group-title-display"
                data-id="${g.id}"
                data-old="${escapeHtml(g.name)}"
                title="${escapeHtml(g.name)}"
              >${escapeHtml(g.name)}</div>
              <textarea
                class="group-title-input"
                data-id="${g.id}"
                data-old="${escapeHtml(g.name)}"
                name="group-title-${g.id}"
                spellcheck="false"
                rows="2"
              >${escapeHtml(g.name)}</textarea>
            </div>
            ${freezerReminderMarkup}
          </div>
          ${selectedHeadFreezerReminderMarkup}
          ${cardLastModifiedMarkup}
        </div>

        ${totalsMarkup}
        ${storageMarkup}
        ${miniHistoryMarkup}
      </div>
    `;
  }

  list.innerHTML += `
    <div class="group new-group" data-name="">
      <input
        id="newGroupInput"
        class="group-title new-group-title"
        name="newGroupInput"
        placeholder="${t('newItemPlaceholder')}"
        spellcheck="false"
      />
      <div class="new-sub">${t('pressEnter')}</div>
    </div>
  `;

  updateSelectionBarUI();
  syncCliNameEditVisibility();

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
      selectedStorage = 'main';
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
  if (el && el.classList?.contains('group-title-input') && el.dataset?.id && e.key === 'Enter') {
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

  if (!el || !el.classList?.contains('group-title-input') || !el.dataset?.id) return;

  const id = el.dataset.id;
  const oldName = el.dataset.old || '';
  const next = el.value.trim();

  if (!next || next === oldName) {
    el.value = oldName;
    closeGroupTitleEditor(el);
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
    closeGroupTitleEditor(el);
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

  const titleEditor = e.target.closest('textarea.group-title-input');
  if (titleEditor?.dataset?.id) return;

  const titleInput = e.target.closest('#newGroupInput');
  // Avoid re-render while typing in title inputs (rename/new item).
  if (titleInput) {
    if (titleInput.id === 'newGroupInput') {
      if (selectedGroup || selectedMode) {
        selectedGroup = null;
        selectedMode = null;
        selectedStorage = 'main';
        feedback.textContent = '';
        load().then(() => {
          const input = document.getElementById('newGroupInput');
          if (input) input.focus();
          cmd.dispatchEvent(new Event('input'));
        });
      }
      return;
    }
  }

  const titleDisplay = e.target.closest('.group-title-display');
  if (titleDisplay?.dataset?.id) {
    const card = titleDisplay.closest('.group');
    if (!card) return;

    // Two-click rename UX:
    // 1) first click on another card title selects the card only
    // 2) second click on the selected card title starts editing
    if (card.dataset.name !== selectedGroup) {
      selectedGroup = card.dataset.name;
      selectedMode = null;
      selectedStorage = 'main';
      feedback.textContent = '';
      load().then(() => {
        scrollSelectedCardToTopSoon();
        startModeHintPulse();
        cmd.dispatchEvent(new Event('input'));
      });
      return;
    }

    openGroupTitleEditor(card.querySelector('.group-title-input'));
    return;
  }

  const newGroupCard = e.target.closest('.group.new-group');
  if (newGroupCard) {
    if (selectionMode) return;
    if (selectedGroup || selectedMode) {
      selectedGroup = null;
      selectedMode = null;
      selectedStorage = 'main';
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
  const storageBtn = e.target.closest('.storage-chip');
  const card = e.target.closest('.group');
  if (!card) return;

  if (storageBtn) {
    keepCmdScrollLockBriefly();
    keepSelectedCardTopAlignedBriefly();
    selectedGroup = card.dataset.name;
    selectedStorage = normalizeStorage(storageBtn.dataset.storage);
    feedback.textContent = '';
    load().then(() => {
      scrollSelectedCardToTopSoon();
      cmd.dispatchEvent(new Event('input'));
      if (selectedMode) focusCmdSoon();
      else startModeHintPulse();
    });
    return;
  }

  // Clicked a mode button (inside selected card)
  if (modeBtn) {
    keepCmdScrollLockBriefly();
    keepSelectedCardTopAlignedBriefly();
    selectedGroup = card.dataset.name;
    selectedMode = modeBtn.dataset.mode;
    selectedStorage = 'main';
    feedback.textContent = '';
    stopModeHintPulse();
    load().then(() => {
      scrollSelectedCardToTopSoon();
      cmd.dispatchEvent(new Event('input'));
      focusCmdSoon();
    });
    return;
  }

  selectedGroup = card.dataset.name;
  selectedMode = null;
  selectedStorage = 'main';
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
  if (e.target.closest('.mode') || e.target.closest('.storage-chip')) return;

  if (e.target.closest('.group-title-display, .group-title-input')) return;

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
    selectedStorage = 'main';
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
  const freezerEnabled = isFreezerEnabled();
  const parsedCommand = selectedGroup && selectedMode
    ? parseCliCommandInput(cmd.value)
    : null;

  for (const p of parts) {
    if (!p) continue;

    const parsed = parsePart(p);
    const alias = parsed?.alias;   // string or undefined
    const value = parsed?.value;   // number or undefined
    let ok = false;
    if (alias) {
      try {
        const resolved = resolveCommandAlias(alias, {
          mode: selectedMode,
          freezerEnabled,
          raw: p
        });
        ok = !!aliasMap[resolved.alias];
      } catch {
        ok = false;
      }
    }

    const chip = document.createElement('div');
    chip.className = 'chip ' + (ok ? 'good' : 'bad');
    chip.textContent = ok ? `${value > 0 ? '+' : ''}${value} ${alias}` : p;
    chipsEl.appendChild(chip);
  }

  // preview shows total of what user typed
  if (selectedGroup && selectedMode) {
    const totals = parsedCommand?.totals || sumInputTotals(cmd.value);
    preview.textContent = buildActionLine(selectedGroup, selectedMode, selectedStorage, totals, {
      storageTotals: parsedCommand?.amountsByStorage || null,
      mixedStorage: !!parsedCommand?.hasMixedStorage
    });
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
  const deltaTotals = parsedCommand?.totals || sumInputTotals(cmd.value);
  const fallbackStorage = activeStorageForMode(selectedMode, selectedStorage);
  const currentStorageTotals = (window.__selectedStorageTotals || null);
  const problems = findCommandNegativeTotals(currentStorageTotals, selectedMode, selectedStorage, parsedCommand || {
    totals: deltaTotals,
    amountsByStorage: {
      main: fallbackStorage === 'freezer' ? emptyTotals() : deltaTotals,
      freezer: fallbackStorage === 'freezer' ? deltaTotals : emptyTotals()
    },
    hasMixedStorage: false
  });

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
      let ok = false;
      try {
        const resolved = resolveCommandAlias(alias, {
          mode: selectedMode,
          freezerEnabled,
          raw: last
        });
        ok = !!aliasMap[resolved.alias];
      } catch {
        ok = false;
      }
      if (!ok) {
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
    const parsedCommand = await parseAndExecute(
      cmd.value,
      selectedGroup,
      selectedMode,
      activeStorageForMode(selectedMode, selectedStorage),
      { freezerEnabled: isFreezerEnabled() }
    );
    const savedLine = buildActionLine(selectedGroup, selectedMode, selectedStorage, parsedCommand.amounts, {
      storageTotals: parsedCommand.amountsByStorage,
      mixedStorage: parsedCommand.hasMixedStorage
    });
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
cmd.addEventListener('focus', () => {
  if (cmdBlurUnlockTimer) clearTimeout(cmdBlurUnlockTimer);
  preserveCmdScrollLockUntil = 0;
});
cmd.addEventListener('blur', () => {
  if (cmdBlurUnlockTimer) clearTimeout(cmdBlurUnlockTimer);
  const unlockDelay = Math.max(120, preserveCmdScrollLockUntil - Date.now());
  cmdBlurUnlockTimer = setTimeout(() => {
    cmdBlurUnlockTimer = null;
    if (isViewportLockEditor()) return;
    preserveCmdScrollLockUntil = 0;
    setCmdScrollLock(false);
  }, unlockDelay);
});

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

function syncVisualViewport() {
  if (!window.visualViewport) {
    document.documentElement.style.setProperty('--vv-bottom', '0px');
    document.documentElement.style.setProperty('--vv-shift-y', '0px');
    return;
  }
  const vv = window.visualViewport;

  // IMPORTANT:
  // When zoomed (scale != 1), the visual viewport moves around while you pan.
  // Using vv offsets then makes fixed bars jitter like crazy.
  // So: disable the vv-bottom hack while zoomed.
  if (vv.scale && Math.abs(vv.scale - 1) > 0.01) {
    document.documentElement.style.setProperty('--vv-bottom', '0px');
    document.documentElement.style.setProperty('--vv-shift-y', '0px');
    return;
  }

  // Keep the keyboard gap stable, then correct only the CLI's measured visual drift.
  const keyboardGap = Math.max(0, window.innerHeight - vv.height);
  const keyboardOpen = keyboardGap >= VIEWPORT_KEYBOARD_OPEN_THRESHOLD_PX;
  const snapped = keyboardOpen ? Math.round(keyboardGap) : 0;
  const currentShift = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--vv-shift-y')
  ) || 0;
  const rectBottom = cliContainer ? cliContainer.getBoundingClientRect().bottom : 0;
  const desiredBottom = keyboardOpen ? vv.height : window.innerHeight;
  const delta = cliContainer ? (desiredBottom - rectBottom) : 0;
  const shift = keyboardOpen && cliContainer
    ? Math.round(currentShift + delta)
    : 0;

  const shouldKeepCmdScrollLock =
    keyboardOpen &&
    (
      isViewportLockEditor() ||
      Date.now() < preserveCmdScrollLockUntil
    );

  setCmdScrollLock(shouldKeepCmdScrollLock);

  document.documentElement.style.setProperty('--vv-bottom', `${snapped}px`);
  document.documentElement.style.setProperty('--vv-shift-y', `${shift}px`);

  if (Date.now() < preserveSelectedCardTopUntil) {
    if (selectedCardTopSyncRaf) cancelAnimationFrame(selectedCardTopSyncRaf);
    selectedCardTopSyncRaf = requestAnimationFrame(() => {
      selectedCardTopSyncRaf = 0;
      const el = document.querySelector('.group.selected');
      if (!el) return;
      scrollCardToTop(el);
    });
  } else if (selectedCardTopSyncRaf) {
    cancelAnimationFrame(selectedCardTopSyncRaf);
    selectedCardTopSyncRaf = 0;
  }
}

window.visualViewport?.addEventListener('resize', syncVisualViewport);
window.visualViewport?.addEventListener('scroll', syncVisualViewport);
window.addEventListener('resize', syncVisualViewport);
window.addEventListener('orientationchange', syncVisualViewport);
syncVisualViewport();
if (window.ResizeObserver && cliContainer) {
  new ResizeObserver(() => syncVisualViewport()).observe(cliContainer);
}

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
const sidePanel = document.getElementById('sidePanel');
const newItemTitle = document.getElementById('newItemTitle');
const settingsTitle = document.getElementById('settingsTitle');
const installTitle = document.getElementById('installTitle');
const resetTitle = document.getElementById('resetTitle');
const resetSub = document.getElementById('resetSub');
const languageTitle = document.getElementById('languageTitle');
const languageSub = document.getElementById('languageSub');
const cardLayoutTitle = document.getElementById('cardLayoutTitle');
const cardLayoutSub = document.getElementById('cardLayoutSub');
const freezerFeatureTitle = document.getElementById('freezerFeatureTitle');
const freezerFeatureSub = document.getElementById('freezerFeatureSub');
const freezerToggle = document.getElementById('freezerToggle');
const devToolsTitle = document.getElementById('devToolsTitle');
const devRouteSnapshotTitle = document.getElementById('devRouteSnapshotTitle');
const devRouteSnapshotSub = document.getElementById('devRouteSnapshotSub');
const devRouteSnapshotBtn = document.getElementById('devRouteSnapshotBtn');
const devRouteTextTitle = document.getElementById('devRouteTextTitle');
const devRouteTextSub = document.getElementById('devRouteTextSub');
const devRouteTextBtn = document.getElementById('devRouteTextBtn');
const devAppStateTitle = document.getElementById('devAppStateTitle');
const devAppStateSub = document.getElementById('devAppStateSub');
const devAppStateBtn = document.getElementById('devAppStateBtn');
const devViewportSyncTitle = document.getElementById('devViewportSyncTitle');
const devViewportSyncSub = document.getElementById('devViewportSyncSub');
const devViewportSyncBtn = document.getElementById('devViewportSyncBtn');
const devSnowfallTitle = document.getElementById('devSnowfallTitle');
const devSnowfallSub = document.getElementById('devSnowfallSub');
const devSnowfallBtn = document.getElementById('devSnowfallBtn');
const themeTitle = document.getElementById('themeTitle');
const themeSub = document.getElementById('themeSub');
const handedTitle = document.getElementById('handedTitle');
const handedSub = document.getElementById('handedSub');
const selCancel = document.getElementById('selCancel');
const selKicker = document.getElementById('selKicker');
const selCount = document.getElementById('selCount');
const selCopy = document.getElementById('selCopy');
const selShare = document.getElementById('selShare');
const selDelete = document.getElementById('selDelete');
const importScreenshotTitle = document.getElementById('importScreenshotTitle');
const importScreenshotSub = document.getElementById('importScreenshotSub');
const importScreenshotBtn = document.getElementById('importScreenshotBtn');
const importScreenshotInput = document.getElementById('importScreenshotInput');
const importTitle = document.getElementById('importTitle');
const importSub = document.getElementById('importSub');
const importCardsBtn = document.getElementById('importCardsBtn');
const importBackdrop = document.getElementById('importBackdrop');
const importModalTitle = document.getElementById('importModalTitle');
const importText = document.getElementById('importText');
const cancelImport = document.getElementById('cancelImport');
const confirmImport = document.getElementById('confirmImport');
const screenshotLoadingBackdrop = document.getElementById('screenshotLoadingBackdrop');
const screenshotLoadingTitle = document.getElementById('screenshotLoadingTitle');
const screenshotLoadingSub = document.getElementById('screenshotLoadingSub');
const screenshotLoadingStatus = document.getElementById('screenshotLoadingStatus');
const screenshotLoadingTimeout = document.getElementById('screenshotLoadingTimeout');
const actionDialogBackdrop = document.getElementById('actionDialogBackdrop');
const actionDialogModal = document.getElementById('actionDialogModal');
const actionDialogKicker = document.getElementById('actionDialogKicker');
const actionDialogTitle = document.getElementById('actionDialogTitle');
const actionDialogSub = document.getElementById('actionDialogSub');
const actionDialogBody = document.getElementById('actionDialogBody');
const actionDialogInputWrap = document.getElementById('actionDialogInputWrap');
const actionDialogInput = document.getElementById('actionDialogInput');
const actionDialogDetails = document.getElementById('actionDialogDetails');
const actionDialogActions = document.querySelector('.action-dialog-actions');
const actionDialogCancel = document.getElementById('actionDialogCancel');
const actionDialogConfirm = document.getElementById('actionDialogConfirm');
const reorderTitle = document.getElementById('reorderTitle');
const reorderSub = document.getElementById('reorderSub');
const reorderCardsBtn = document.getElementById('reorderCardsBtn');
const reorderBackdrop = document.getElementById('reorderBackdrop');
const reorderModalTitle = document.getElementById('reorderModalTitle');
const reorderModalSub = document.getElementById('reorderModalSub');
const reorderModalMeta = document.getElementById('reorderModalMeta');
const reorderList = document.getElementById('reorderList');
const cancelReorder = document.getElementById('cancelReorder');
const saveReorder = document.getElementById('saveReorder');
const historyBackdrop = document.getElementById('historyBackdrop');
const historyModalKicker = document.getElementById('historyModalKicker');
const historyModalTitle = document.getElementById('historyModalTitle');
const historyModalSub = document.getElementById('historyModalSub');
const historyModalMeta = document.getElementById('historyModalMeta');
const historyList = document.getElementById('historyList');
const closeHistory = document.getElementById('closeHistory');
const templatePreviewBackdrop = document.getElementById('templatePreviewBackdrop');
const templatePreviewModalTitle = document.getElementById('templatePreviewModalTitle');
const templatePreviewSub = document.getElementById('templatePreviewSub');
const templatePreviewSummary = document.getElementById('templatePreviewSummary');
const templatePreviewList = document.getElementById('templatePreviewList');
const closeTemplatePreview = document.getElementById('closeTemplatePreview');
const templateCreateBackdrop = document.getElementById('templateCreateBackdrop');
const templateCreateKicker = document.getElementById('templateCreateKicker');
const templateCreateModalTitle = document.getElementById('templateCreateModalTitle');
const templateCreateModalSub = document.getElementById('templateCreateModalSub');
const templateCreateName = document.getElementById('templateCreateName');
const templateCreateList = document.getElementById('templateCreateList');
const templateCreatePreviewTitle = document.getElementById('templateCreatePreviewTitle');
const templateCreatePreviewMeta = document.getElementById('templateCreatePreviewMeta');
const templateCreatePreviewList = document.getElementById('templateCreatePreviewList');
const cancelTemplateCreate = document.getElementById('cancelTemplateCreate');
const confirmTemplateCreate = document.getElementById('confirmTemplateCreate');
const sidePanelBackdrop = document.getElementById('sidePanelBackdrop');
const panelSearch = document.getElementById('panelSearch');
const panelSettingsBtn = document.getElementById('panelSettingsBtn');
const projectList = document.getElementById('projectList');
const newProjectName = document.getElementById('newProjectName');
const createProjectBtn = document.getElementById('createProjectBtn');
const openCreateTemplateModalBtn = document.getElementById('openCreateTemplateModalBtn');
const routeActionsTitle = document.getElementById('routeActionsTitle');
const routeActionsSub = document.getElementById('routeActionsSub');
const routeActionsMenuBtn = document.getElementById('routeActionsMenuBtn');
const routeActionsModeBtn = document.getElementById('routeActionsModeBtn');
const routeActionsMenu = document.getElementById('routeActionsMenu');
const exportRouteBtn = document.getElementById('exportRouteBtn');
const duplicateRouteBtn = document.getElementById('duplicateRouteBtn');
const clearTotalsBtn = document.getElementById('clearTotalsBtn');
const currentRouteHistoryTitle = document.getElementById('currentRouteHistoryTitle');
const currentRouteHistorySub = document.getElementById('currentRouteHistorySub');
const currentRouteHistoryBtn = document.getElementById('currentRouteHistoryBtn');
const currentRouteRenameTitle = document.getElementById('currentRouteRenameTitle');
const currentRouteRenameSub = document.getElementById('currentRouteRenameSub');
const currentRouteRenameBtn = document.getElementById('currentRouteRenameBtn');
const currentRouteRenameBtnSearch = document.getElementById('currentRouteRenameBtnSearch');
const currentRouteTemplateTitle = document.getElementById('currentRouteTemplateTitle');
const currentRouteTemplateSub = document.getElementById('currentRouteTemplateSub');
const currentRouteTemplateBtn = document.getElementById('currentRouteTemplateBtn');
const startMultiSelectTitle = document.getElementById('startMultiSelectTitle');
const startMultiSelectSub = document.getElementById('startMultiSelectSub');
const startMultiSelectBtn = document.getElementById('startMultiSelectBtn');
const currentRouteTemplateBtnSearch = document.getElementById('currentRouteTemplateBtnSearch');
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
let routeActionsMenuOpen = false;
let routeActionsSearchHits = 0;
let screenshotImportBusy = false;
let screenshotOcrEnginePromise = null;
let actionDialogResolver = null;
let panelOverflowMenuFrame = 0;
let templateCreateSelectedId = '';
let templateCreateSuggestedName = '';
let templateCreateNameDirty = false;

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
  renderRouteActionsMenu();
  if (importScreenshotTitle) importScreenshotTitle.textContent = t('importScreenshot');
  if (importScreenshotSub) importScreenshotSub.textContent = t('importScreenshotSub');
  if (importScreenshotBtn) importScreenshotBtn.textContent = t('screenshotScan');
  if (screenshotLoadingTitle) screenshotLoadingTitle.textContent = t('importScreenshot');
  if (screenshotLoadingSub) screenshotLoadingSub.textContent = t('screenshotImportPleaseWait');
  if (screenshotLoadingTimeout) {
    screenshotLoadingTimeout.textContent = t('screenshotImportTimeoutHint', Math.ceil(SCREENSHOT_IMPORT_TIMEOUT_MS / 1000));
  }
  if (exportRouteBtn) exportRouteBtn.textContent = t('exportRoute');
  if (duplicateRouteBtn) duplicateRouteBtn.textContent = t('duplicateRoute');
  if (clearTotalsBtn) clearTotalsBtn.textContent = t('clearTotalsBtn');
  if (importTitle) importTitle.textContent = t('importCards');
  if (importSub) importSub.textContent = t('importCardsSub');
  if (importCardsBtn) importCardsBtn.textContent = t('importCards');
  if (reorderTitle) reorderTitle.textContent = t('reorderCards');
  if (reorderSub) reorderSub.textContent = t('reorderCardsSub');
  if (reorderCardsBtn) reorderCardsBtn.textContent = t('reorder');
  if (currentRouteHistoryTitle) currentRouteHistoryTitle.textContent = t('viewHistory');
  if (currentRouteHistorySub) currentRouteHistorySub.textContent = t('viewHistoryRouteSub');
  if (currentRouteHistoryBtn) currentRouteHistoryBtn.textContent = t('viewHistoryBtn');
  if (currentRouteRenameTitle) currentRouteRenameTitle.textContent = t('editName');
  if (currentRouteRenameSub) currentRouteRenameSub.textContent = t('editNameSub');
  if (currentRouteRenameBtn) currentRouteRenameBtn.textContent = t('editNameBtn');
  if (currentRouteRenameBtnSearch) currentRouteRenameBtnSearch.textContent = t('editNameBtn');
  if (currentRouteTemplateTitle) currentRouteTemplateTitle.textContent = t('saveAsTemplate');
  if (currentRouteTemplateSub) currentRouteTemplateSub.textContent = t('saveAsTemplateSub');
  if (currentRouteTemplateBtn) currentRouteTemplateBtn.textContent = t('saveAsTemplateBtn');
  if (startMultiSelectTitle) startMultiSelectTitle.textContent = t('startMultiSelect');
  if (startMultiSelectSub) startMultiSelectSub.textContent = t('startMultiSelectSub');
  if (startMultiSelectBtn) startMultiSelectBtn.textContent = t('startMultiSelectBtn');
  if (currentRouteTemplateBtnSearch) currentRouteTemplateBtnSearch.textContent = t('saveAsTemplateBtn');
  if (languageTitle) languageTitle.textContent = t('language');
  if (languageSub) languageSub.textContent = t('languageSub');
  if (cardLayoutTitle) cardLayoutTitle.textContent = t('cardLayout');
  if (cardLayoutSub) cardLayoutSub.textContent = t('cardLayoutSub');
  if (cardLayoutSelect?.options?.[0]) cardLayoutSelect.options[0].text = t('compact');
  if (cardLayoutSelect?.options?.[1]) cardLayoutSelect.options[1].text = t('classic');
  if (freezerFeatureTitle) freezerFeatureTitle.textContent = t('freezerFeature');
  if (freezerFeatureSub) freezerFeatureSub.textContent = t('freezerFeatureSub');
  if (devToolsTitle) devToolsTitle.textContent = t('devTools');
  if (devRouteSnapshotTitle) devRouteSnapshotTitle.textContent = t('devRouteSnapshot');
  if (devRouteSnapshotSub) devRouteSnapshotSub.textContent = t('devRouteSnapshotSub');
  if (devRouteSnapshotBtn) devRouteSnapshotBtn.textContent = t('copy');
  if (devRouteTextTitle) devRouteTextTitle.textContent = t('devRouteText');
  if (devRouteTextSub) devRouteTextSub.textContent = t('devRouteTextSub');
  if (devRouteTextBtn) devRouteTextBtn.textContent = t('copy');
  if (devAppStateTitle) devAppStateTitle.textContent = t('devAppState');
  if (devAppStateSub) devAppStateSub.textContent = t('devAppStateSub');
  if (devAppStateBtn) devAppStateBtn.textContent = t('copy');
  if (devViewportSyncTitle) devViewportSyncTitle.textContent = t('devViewportSync');
  if (devViewportSyncSub) devViewportSyncSub.textContent = t('devViewportSyncSub');
  if (devViewportSyncBtn) devViewportSyncBtn.textContent = t('run');
  if (devSnowfallTitle) devSnowfallTitle.textContent = t('devSnowfall');
  if (devSnowfallSub) devSnowfallSub.textContent = t('devSnowfallSub');
  if (devSnowfallBtn) devSnowfallBtn.textContent = t('run');
  if (themeTitle) themeTitle.textContent = t('theme');
  if (themeSub) themeSub.textContent = t('themeSub');
  if (handedTitle) handedTitle.textContent = t('handed');
  if (handedSub) handedSub.textContent = t('handedSub');
  if (selCancel) selCancel.textContent = t('done');
  if (selKicker) selKicker.textContent = t('multiSelectActive');
  if (selCount) selCount.textContent = t('selectedCount', selectedGroupIds.size);
  if (selCopy) selCopy.textContent = t('copy');
  if (selShare) selShare.textContent = t('share');
  if (selDelete) selDelete.textContent = t('delete');
  if (importModalTitle) importModalTitle.textContent = t('importCards');
  if (importText) importText.placeholder = t('importCardsPlaceholder');
  if (cancelImport) cancelImport.textContent = t('cancel');
  if (confirmImport) confirmImport.textContent = t('import');
  if (reorderModalTitle) reorderModalTitle.textContent = t('reorderCards');
  if (reorderModalSub) reorderModalSub.textContent = t('reorderCardsSub');
  if (cancelReorder) cancelReorder.textContent = t('cancel');
  if (saveReorder) saveReorder.textContent = t('done');
  syncHistoryModalHeader();
  if (closeHistory) closeHistory.textContent = t('close');
  if (templatePreviewModalTitle) templatePreviewModalTitle.textContent = t('templatePreview');
  if (closeTemplatePreview) closeTemplatePreview.textContent = t('close');
  if (templateCreateKicker) templateCreateKicker.textContent = t('createModeTemplate');
  if (templateCreateModalTitle) templateCreateModalTitle.textContent = t('templateRouteConfirmTitle');
  if (templateCreateModalSub) templateCreateModalSub.textContent = t('templateCreateSub');
  if (templateCreateName) {
    templateCreateName.placeholder = t('newProjectPlaceholder');
    templateCreateName.setAttribute('aria-label', t('projectNamePrompt'));
  }
  if (cancelTemplateCreate) cancelTemplateCreate.textContent = t('cancel');
  if (confirmTemplateCreate) confirmTemplateCreate.textContent = t('create');
  if (panelSearch) panelSearch.placeholder = t('search');
  if (newProjectName) newProjectName.placeholder = t('newProjectPlaceholder');
  if (templateName) templateName.placeholder = t('templatePlaceholder');
  renderCreateProjectModeControls();
  if (saveTemplateBtn) saveTemplateBtn.textContent = t('saveTemplate');
  updatePanelSettingsButton();
  const currentRouteTitleEl = document.querySelector('[data-title="currentRoute"] .sidepanel-title');
  const projectTitleEl = document.querySelector('[data-title="projects"] .sidepanel-title');
  const templateTitleEl = document.querySelector('[data-title="templates"] .sidepanel-title');
  if (currentRouteTitleEl) currentRouteTitleEl.textContent = t('currentRoute');
  if (projectTitleEl) projectTitleEl.textContent = t('projectsTitle');
  if (templateTitleEl) templateTitleEl.textContent = t('templatesTitle');
  if (!sidePanelBackdrop?.classList.contains('hidden')) {
    renderProjectList();
    renderTemplateList();
    applyPanelSearchFilter();
  }
  if (!templatePreviewBackdrop?.classList.contains('hidden') && templatePreviewTemplateId) {
    const template = readTemplates().find((entry) => entry.id === templatePreviewTemplateId);
    if (template) renderTemplatePreview(template);
  }
  if (!templateCreateBackdrop?.classList.contains('hidden')) {
    renderTemplateCreateModal();
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
        <button class="btn install-btn panel-view-project-history" data-id="${p.id}" type="button">${t('viewHistory')}</button>
        <button class="btn install-btn panel-rename-project" data-id="${p.id}" type="button">${t('rename')}</button>
        <button class="btn danger-btn panel-delete-project" data-id="${p.id}" type="button" ${disableProjectDelete ? 'disabled aria-disabled="true"' : ''}>${t('remove')}</button>
      </div>
    </div>
  `).join('');
  schedulePanelOverflowMenuDirectionRefresh();
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

async function copyTextToClipboard(text) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard unavailable');
  }
  await navigator.clipboard.writeText(String(text || ''));
}

async function copyDevRouteSnapshot() {
  const currentRoute = getCurrentRouteRecord();
  const snapshot = await captureProjectSnapshot(getCurrentProject());
  const payload = {
    exportedAt: new Date().toISOString(),
    route: currentRoute
      ? { id: currentRoute.id, name: currentRoute.name }
      : null,
    snapshot
  };
  await copyTextToClipboard(JSON.stringify(payload, null, 2));
  feedback.textContent = t('copiedRouteSnapshot');
  clearFeedbackSoon(1200);
}

async function copyDevRouteText() {
  const payload = await buildCurrentRouteCardsText();
  if (!payload.text) {
    throw new Error(t('noCustomersInRoute'));
  }
  await copyTextToClipboard(payload.text);
  feedback.textContent = t('copiedRouteText');
  clearFeedbackSoon(1200);
}

async function copyDevAppState() {
  const vv = window.visualViewport;
  const payload = {
    exportedAt: new Date().toISOString(),
    route: getCurrentRouteRecord(),
    selection: {
      group: selectedGroup,
      mode: selectedMode,
      storage: selectedStorage,
      selectionMode,
      selectedGroupIds: [...selectedGroupIds]
    },
    settings: {
      theme: localStorage.getItem('rogo_theme') || 'dark',
      hand: localStorage.getItem('rogo_hand') || 'right',
      lang: localStorage.getItem('rogo_lang') || 'nl',
      cardLayout: getCardLayout(),
      freezerEnabled: isFreezerEnabled()
    },
    viewport: {
      innerHeight: Math.round(window.innerHeight),
      innerWidth: Math.round(window.innerWidth),
      vv: vv ? {
        height: Math.round(vv.height),
        width: Math.round(vv.width),
        top: Math.round(vv.offsetTop),
        left: Math.round(vv.offsetLeft),
        scale: Number(vv.scale || 1)
      } : null,
      cliBottom: cliContainer ? Math.round(cliContainer.getBoundingClientRect().bottom) : null,
      cssBottom: getComputedStyle(document.documentElement).getPropertyValue('--vv-bottom').trim(),
      cssShift: getComputedStyle(document.documentElement).getPropertyValue('--vv-shift-y').trim()
    }
  };
  await copyTextToClipboard(JSON.stringify(payload, null, 2));
  feedback.textContent = t('copiedAppState');
  clearFeedbackSoon(1200);
}

function runDevViewportResync() {
  syncVisualViewport();
  syncModalViewportVars();
  feedback.textContent = t('viewportResynced');
  clearFeedbackSoon(1000);
}

function triggerDevSnowfall() {
  document.querySelector('.dev-snow-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'dev-snow-overlay';

  for (let i = 0; i < 16; i += 1) {
    const flake = document.createElement('div');
    flake.className = 'dev-snowflake';
    flake.style.setProperty('--start-x', `${Math.round((i / 15) * 100)}%`);
    flake.style.setProperty('--delay', `${(Math.random() * 0.8).toFixed(2)}s`);
    flake.style.setProperty('--duration', `${(4 + Math.random() * 2.4).toFixed(2)}s`);
    flake.style.setProperty('--drift-x', `${Math.round((Math.random() - 0.5) * 120)}px`);
    flake.innerHTML = FREEZER_REMINDER_ICON_SVG;
    overlay.appendChild(flake);
  }

  document.body.appendChild(overlay);
  feedback.textContent = t('snowfallStarted');
  clearFeedbackSoon(1000);
  window.setTimeout(() => overlay.remove(), 7000);
}

async function saveProjectAsTemplate(projectId, fallbackName = '', presetName = null) {
  const hasPresetName = typeof presetName === 'string';
  const proposedName = String(fallbackName || '').trim();
  let rawName = presetName;
  if (!hasPresetName) {
    const dialog = await showActionDialog({
      variant: 'template',
      kicker: t('saveAsTemplate'),
      title: t('saveAsTemplate'),
      subtitle: t('templateNamePrompt'),
      input: {
        value: proposedName,
        placeholder: t('templateNamePrompt'),
        label: t('templateNamePrompt')
      },
      confirmLabel: t('save'),
      cancelLabel: t('cancel')
    });
    if (!dialog.confirmed) return;
    rawName = dialog.value;
  }
  if (rawName == null) return;
  const name = String(rawName).trim();
  if (!name) return;

  const templates = readTemplates();
  const snapshot = await captureProjectSnapshot(projectId);
  const templateSnapshot = compactTemplateSnapshot(snapshot);
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
  schedulePanelOverflowMenuDirectionRefresh();
}

function panelSearchMatchesSettings(rawQuery) {
  const q = String(rawQuery || '').trim().toLowerCase();
  if (!q) return false;
  const keywords = ['setting', 'settings', 'instelling', 'instellingen', 'tutorial', 'hint', 'hints', 'help'];
  return keywords.some(k => q.includes(k));
}

function refreshPanelOverflowMenuDirections() {
  if (!sidePanel) return;
  const panelRect = sidePanel.getBoundingClientRect();
  const menus = sidePanel.querySelectorAll('.panel-project-menu.open');

  for (const menu of menus) {
    menu.classList.remove('open-up');
    menu.style.removeProperty('--panel-menu-max-height');

    const item = menu.closest('.panel-item');
    if (!item) continue;

    const itemRect = item.getBoundingClientRect();
    const menuHeight = Math.ceil(menu.scrollHeight || menu.getBoundingClientRect().height || 0);
    const spaceBelow = Math.max(0, panelRect.bottom - itemRect.bottom - 8);
    const spaceAbove = Math.max(0, itemRect.top - panelRect.top - 8);
    const minUsefulOpenSpace = 96;
    const shouldOpenUp = spaceBelow < menuHeight && spaceAbove >= minUsefulOpenSpace;
    const availableHeight = Math.max(96, shouldOpenUp ? spaceAbove : spaceBelow);

    if (shouldOpenUp) menu.classList.add('open-up');
    menu.style.setProperty('--panel-menu-max-height', `${Math.floor(availableHeight)}px`);
  }
}

function schedulePanelOverflowMenuDirectionRefresh() {
  if (panelOverflowMenuFrame) return;
  panelOverflowMenuFrame = requestAnimationFrame(() => {
    panelOverflowMenuFrame = 0;
    refreshPanelOverflowMenuDirections();
  });
}

function isDevToolsQuery(rawQuery) {
  return String(rawQuery || '').trim().toLowerCase() === 'dev';
}

function applyPanelSearchFilter() {
  if (!sidePanelBackdrop || sidePanelBackdrop.classList.contains('hidden')) return;
  const query = String(panelSearch?.value || '').trim().toLowerCase();
  const showDevTools = isDevToolsQuery(query);
  const sections = sidePanelBackdrop.querySelectorAll('.panel-section');
  routeActionsSearchHits = 0;

  for (const section of sections) {
    const isSettingsSection = section.getAttribute('data-title') === 'settings';
    const isCurrentRouteSection = section.getAttribute('data-title') === 'currentRoute';
    const isDevToolsSection = section.getAttribute('data-title') === 'devtools';
    const titleEl = section.querySelector('.sidepanel-title');
    const title = String(titleEl?.textContent || '').toLowerCase();
    const titleMatch = !query || title.includes(query);
    const items = section.querySelectorAll('.panel-item, .setting-row');
    let visibleItems = 0;

    for (const item of items) {
      if (isDevToolsSection) {
        item.style.display = showDevTools ? '' : 'none';
        if (showDevTools) visibleItems += 1;
        continue;
      }

      const name = String(item.getAttribute('data-name') || item.textContent || '').toLowerCase();
      const keywords = String(item.getAttribute('data-keywords') || '').toLowerCase();
      const isSearchOnlyAction = item.classList.contains('search-only-action');
      const isRouteActionOption = item.classList.contains('route-action-row');
      const hit = !query
        ? (isSettingsSection ? settingsSectionPinned : !isSearchOnlyAction)
        : (
          isSearchOnlyAction
            ? (name.includes(query) || keywords.includes(query))
            : (titleMatch || name.includes(query) || keywords.includes(query))
        );
      item.style.display = hit ? '' : 'none';
      if (hit) visibleItems += 1;
      if (isCurrentRouteSection && isRouteActionOption && query && hit) routeActionsSearchHits += 1;
    }

    let showSection = !query || titleMatch || visibleItems > 0;
    if (isDevToolsSection) {
      showSection = showDevTools;
    } else if (isSettingsSection) {
      showSection = settingsSectionPinned || (!!query && (visibleItems > 0 || panelSearchMatchesSettings(query)));
    } else if (settingsSectionPinned) {
      showSection = false;
    }
    section.style.display = showSection ? '' : 'none';
  }

  if (query && routeActionsSearchHits > 0) {
    routeActionsMenuOpen = true;
  }

  panelSettingsBtn?.classList.toggle(
    'active',
    settingsSectionPinned || panelSearchMatchesSettings(query)
  );
  updatePanelSettingsButton();
  renderRouteActionsMenu();
}

function openSidePanel() {
  openProjectMenuId = null;
  openTemplateMenuId = null;
  createProjectModeMenuOpen = false;
  routeActionsMenuOpen = false;
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
  routeActionsMenuOpen = false;
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

function syncHistoryModalHeader() {
  const raw = String(historyModalContextTitle || '').trim() || t('history');
  const parts = raw.split(' · ').map((part) => String(part || '').trim()).filter(Boolean);
  const kicker = parts.length > 1 ? parts[0] : '';
  const title = parts.length > 1 ? parts.slice(1).join(' · ') : raw;
  if (historyModalKicker) {
    historyModalKicker.textContent = kicker;
    historyModalKicker.style.display = kicker ? '' : 'none';
  }
  if (historyModalTitle) historyModalTitle.textContent = title;
  if (historyModalSub) historyModalSub.textContent = kicker || '';
  if (historyModalMeta) historyModalMeta.textContent = historyModalEventCount ? t('historyEvents', historyModalEventCount) : '';
}

function getHistoryItemClass(evt) {
  if (evt?.kind === 'lifecycle') {
    const action = String(evt?.action || '').toLowerCase();
    if (action === 'created') return 'lifecycle kind-created';
    if (action === 'deleted') return 'lifecycle kind-deleted';
    if (action === 'renamed') return 'lifecycle kind-renamed';
    return 'lifecycle';
  }

  const target = String(evt?.target || '').toLowerCase();
  const storage = normalizeStorage(evt?.storage);
  if (storage === 'freezer') return 'kind-freezer';
  if (target === 'retour') return 'kind-retour';
  if (target === 'geleverd') return 'kind-delivered';
  return '';
}

async function renderHistory({ groupId = null, title = null } = {}) {
  if (!historyList) return;
  const defs = getTokenDefs();
  const events = await getHistoryEvents({ groupId, limit: 1000 });
  const groups = await getGroupsWithTotals();
  const namesById = new Map(groups.map(g => [Number(g.id), g.name]));
  for (const evt of events) {
    const evtGroupId = Number(evt?.groupId);
    if (!Number.isFinite(evtGroupId) || namesById.has(evtGroupId)) continue;
    if (evt?.kind === 'lifecycle' && evt?.groupName) {
      namesById.set(evtGroupId, String(evt.groupName));
    }
  }
  historyModalContextTitle = String(title || '').trim() || t('history');
  historyModalEventCount = events.length;
  syncHistoryModalHeader();

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
        <div class="history-item ${getHistoryItemClass(e)}">
          <div class="history-meta history-ts" data-ts="${ts}" data-compact="0">${escapeHtml(formatHistoryTimestamp(ts, false))}</div>
          <div class="history-title">${escapeHtml(name)} · ${escapeHtml(action)}</div>
          ${detail ? `<div class="history-line">${escapeHtml(detail)}</div>` : ''}
        </div>
      `;
    }

    const target = formatEventTargetLabel(e);
    const changes = TOKEN_ORDER
      .map((k) => ({ k, v: Number(e?.[k] || 0) }))
      .filter(x => x.v !== 0)
      .map(x => {
        const label = tokenNameNL(defs, x.k);
        return `<div class="history-line">${escapeHtml(label)}: ${x.v > 0 ? '+' : ''}${x.v}</div>`;
      })
      .join('');

    return `
      <div class="history-item ${getHistoryItemClass(e)}">
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

async function renderHistoryForProject(projectId, title = null) {
  const targetId = String(projectId || '');
  if (!targetId) return;
  const activeId = getCurrentProject();
  if (targetId !== activeId) setCurrentProject(targetId);
  try {
    await renderHistory({ title });
  } finally {
    if (targetId !== activeId) setCurrentProject(activeId);
  }
}

function openHistoryModal() {
  historyBackdrop?.classList.remove('hidden');
}

function closeHistoryModal() {
  historyBackdrop?.classList.add('hidden');
}

function openTemplatePreviewModal(template = null) {
  templatePreviewTemplateId = String(template?.id || '');
  if (template) renderTemplatePreview(template);
  templatePreviewBackdrop?.classList.remove('hidden');
}

function closeTemplatePreviewModal() {
  templatePreviewTemplateId = '';
  templatePreviewBackdrop?.classList.add('hidden');
}

function resolveActionDialog(confirmed) {
  const resolve = actionDialogResolver;
  actionDialogResolver = null;
  const value = String(actionDialogInput?.value || '');
  actionDialogBackdrop?.classList.add('hidden');
  actionDialogModal?.classList.remove('variant-template', 'variant-review', 'variant-danger');
  if (resolve) resolve({ confirmed: !!confirmed, value });
}

function showActionDialog({
  variant = '',
  kicker = '',
  title = '',
  subtitle = '',
  body = '',
  details = [],
  input = null,
  showCancel = true,
  confirmTone = 'create',
  confirmLabel = t('create'),
  cancelLabel = t('cancel')
} = {}) {
  if (!actionDialogBackdrop || !actionDialogModal) {
    if (!showCancel) {
      alert([title, subtitle, body, ...details].filter(Boolean).join('\n\n'));
      return Promise.resolve({ confirmed: true, value: '' });
    }
    return Promise.resolve({
      confirmed: confirm([title, subtitle, body, ...details].filter(Boolean).join('\n\n')),
      value: ''
    });
  }

  if (actionDialogResolver) resolveActionDialog(false);

  actionDialogModal.classList.remove('variant-template', 'variant-review', 'variant-danger');
  if (variant) actionDialogModal.classList.add(`variant-${variant}`);

  if (actionDialogKicker) {
    actionDialogKicker.textContent = String(kicker || '');
    actionDialogKicker.style.display = kicker ? '' : 'none';
  }
  if (actionDialogTitle) actionDialogTitle.textContent = String(title || '');
  if (actionDialogSub) {
    actionDialogSub.textContent = String(subtitle || '');
    actionDialogSub.style.display = subtitle ? '' : 'none';
  }
  if (actionDialogBody) {
    actionDialogBody.textContent = String(body || '');
    actionDialogBody.style.display = body ? '' : 'none';
  }
  const hasInput = !!input;
  if (actionDialogInputWrap) {
    actionDialogInputWrap.classList.toggle('hidden', !hasInput);
  }
  if (actionDialogInput) {
    actionDialogInput.value = hasInput ? String(input?.value || '') : '';
    actionDialogInput.placeholder = hasInput ? String(input?.placeholder || '') : '';
    actionDialogInput.setAttribute('aria-label', hasInput ? String(input?.label || title || '') : '');
  }
  if (actionDialogDetails) {
    actionDialogDetails.innerHTML = (Array.isArray(details) ? details : [])
      .filter(Boolean)
      .map((line) => {
        const isMore = String(line).startsWith('...');
        return `<div class="action-dialog-detail${isMore ? ' more' : ''}">${escapeHtml(line)}</div>`;
      })
      .join('');
  }
  if (actionDialogActions) {
    actionDialogActions.classList.toggle('single-action', !showCancel);
  }
  if (actionDialogCancel) {
    actionDialogCancel.textContent = cancelLabel;
    actionDialogCancel.style.display = showCancel ? '' : 'none';
  }
  if (actionDialogConfirm) {
    actionDialogConfirm.textContent = confirmLabel;
    actionDialogConfirm.classList.remove('create-btn', 'danger-btn', 'install-btn', 'cancel-btn');
    actionDialogConfirm.classList.add(
      confirmTone === 'danger' ? 'danger-btn'
        : confirmTone === 'install' ? 'install-btn'
          : confirmTone === 'cancel' ? 'cancel-btn'
            : 'create-btn'
    );
  }

  actionDialogBackdrop.classList.remove('hidden');
  requestAnimationFrame(() => {
    if (hasInput && actionDialogInput) {
      actionDialogInput.focus({ preventScroll: true });
      actionDialogInput.select();
    } else {
      actionDialogConfirm?.focus({ preventScroll: true });
    }
  });

  return new Promise((resolve) => {
    actionDialogResolver = resolve;
  });
}

function showDeleteConfirmDialog({
  kicker = '',
  title = '',
  subtitle = '',
  body = '',
  details = [],
  confirmLabel = t('delete')
} = {}) {
  return showActionDialog({
    variant: 'danger',
    kicker,
    title,
    subtitle,
    body,
    details,
    confirmTone: 'danger',
    confirmLabel,
    cancelLabel: t('cancel')
  });
}

function renderTemplatePreview(template) {
  if (!templatePreviewList) return;
  const names = getTemplateSnapshotNames(template);
  const title = template?.name ? `${t('templatePreview')} · ${template.name}` : t('templatePreview');
  if (templatePreviewModalTitle) templatePreviewModalTitle.textContent = title;
  if (templatePreviewSub) {
    templatePreviewSub.textContent = names.length ? t('templateCustomerCount', names.length) : '';
  }
  if (templatePreviewSummary) {
    const examples = buildTemplateExampleText(names, 4);
    templatePreviewSummary.innerHTML = names.length
      ? `<div class="template-preview-pill">${escapeHtml(t('templateCustomerCount', names.length))}</div><div class="template-preview-examples">${escapeHtml(examples)}</div>`
      : '';
  }
  if (!names.length) {
    templatePreviewList.innerHTML = `<div class="history-empty">${escapeHtml(t('noCardsInTemplate'))}</div>`;
    return;
  }
  const rows = names
    .map((name, index) => `
      <div class="template-preview-item">
        <div class="template-preview-item-index">${index + 1}</div>
        <div class="template-preview-item-name">${escapeHtml(name)}</div>
      </div>
    `)
    .join('');
  templatePreviewList.innerHTML = rows;
}

function getTemplateSnapshotNames(template) {
  return (Array.isArray(template?.snapshot?.groups) ? template.snapshot.groups : [])
    .map((group) => String(group?.name || '').trim())
    .filter(Boolean);
}

function buildTemplateExampleText(names, limit = 3) {
  const safeNames = Array.isArray(names) ? names.filter(Boolean) : [];
  if (!safeNames.length) return '';
  const shown = safeNames.slice(0, limit);
  const hidden = safeNames.length - shown.length;
  return hidden > 0
    ? `${shown.join(' · ')} · ${t('templatePreviewMore', hidden)}`
    : shown.join(' · ');
}

function getSelectedTemplateCreateTemplate() {
  return readTemplates().find((template) => template.id === templateCreateSelectedId) || null;
}

function syncTemplateCreateSuggestedName(force = false) {
  const selectedTemplate = getSelectedTemplateCreateTemplate();
  if (!selectedTemplate || !templateCreateName) return;
  const nextSuggested = suggestUniqueProjectName(selectedTemplate.name, readProjects());
  const current = String(templateCreateName.value || '').trim();
  const shouldReplace = force || !templateCreateNameDirty || !current || current === templateCreateSuggestedName;
  templateCreateSuggestedName = nextSuggested;
  if (shouldReplace) {
    templateCreateName.value = nextSuggested;
    templateCreateNameDirty = false;
  }
}

function renderTemplateCreateModal() {
  if (!templateCreateList || !templateCreatePreviewList) return;
  const templates = readTemplates();
  if (!templates.length) {
    templateCreateList.innerHTML = `<div class="template-create-empty">${escapeHtml(t('noTemplates'))}</div>`;
    templateCreatePreviewList.innerHTML = `<div class="template-create-empty">${escapeHtml(t('noTemplates'))}</div>`;
    if (templateCreatePreviewTitle) templateCreatePreviewTitle.textContent = '';
    if (templateCreatePreviewMeta) templateCreatePreviewMeta.textContent = '';
    if (confirmTemplateCreate) confirmTemplateCreate.disabled = true;
    return;
  }

  if (!templates.some((template) => template.id === templateCreateSelectedId)) {
    templateCreateSelectedId = templates[0].id;
  }
  syncTemplateCreateSuggestedName();

  templateCreateList.innerHTML = templates.map((template) => {
    const names = getTemplateSnapshotNames(template);
    const countText = t('templateCustomerCount', names.length);
    const examples = buildTemplateExampleText(names);
    return `
      <button
        class="template-create-option ${template.id === templateCreateSelectedId ? 'active' : ''}"
        data-id="${escapeHtml(template.id)}"
        type="button"
      >
        <div class="template-create-option-name">${escapeHtml(template.name)}</div>
        <div class="template-create-option-meta">${escapeHtml(countText)}</div>
        ${examples ? `<div class="template-create-option-examples">${escapeHtml(examples)}</div>` : ''}
      </button>
    `;
  }).join('');

  const selectedTemplate = getSelectedTemplateCreateTemplate() || templates[0];
  const selectedNames = getTemplateSnapshotNames(selectedTemplate);
  if (templateCreatePreviewTitle) templateCreatePreviewTitle.textContent = selectedTemplate?.name || '';
  if (templateCreatePreviewMeta) templateCreatePreviewMeta.textContent = t('templateCustomerCount', selectedNames.length);
  templateCreatePreviewList.innerHTML = selectedNames.length
    ? selectedNames.map((name) => `<div class="template-create-preview-item">${escapeHtml(name)}</div>`).join('')
    : `<div class="template-create-empty">${escapeHtml(t('noCardsInTemplate'))}</div>`;

  if (confirmTemplateCreate) {
    confirmTemplateCreate.disabled = !String(templateCreateName?.value || '').trim();
  }
}

function openTemplateCreateModal({ templateId = '', routeName = '' } = {}) {
  const templates = readTemplates();
  if (!templates.length) {
    feedback.textContent = `⚠ ${t('noTemplates')}`;
    clearFeedbackSoon(900);
    return;
  }

  const selectedTemplate = templates.find((template) => template.id === templateId) || templates[0];
  templateCreateSelectedId = selectedTemplate.id;
  templateCreateSuggestedName = suggestUniqueProjectName(selectedTemplate.name, readProjects());
  const seededName = String(routeName || '').trim();
  templateCreateNameDirty = !!seededName;

  if (templateCreateKicker) templateCreateKicker.textContent = t('createModeTemplate');
  if (templateCreateModalTitle) templateCreateModalTitle.textContent = t('templateRouteConfirmTitle');
  if (templateCreateModalSub) templateCreateModalSub.textContent = t('templateCreateSub');
  if (templateCreateName) {
    templateCreateName.placeholder = t('newProjectPlaceholder');
    templateCreateName.setAttribute('aria-label', t('projectNamePrompt'));
    templateCreateName.value = seededName || templateCreateSuggestedName;
  }
  if (cancelTemplateCreate) cancelTemplateCreate.textContent = t('cancel');
  if (confirmTemplateCreate) confirmTemplateCreate.textContent = t('create');

  renderTemplateCreateModal();
  templateCreateBackdrop?.classList.remove('hidden');

  requestAnimationFrame(() => {
    templateCreateName?.focus({ preventScroll: true });
    templateCreateName?.select();
  });
}

function closeTemplateCreateModal() {
  templateCreateBackdrop?.classList.add('hidden');
  templateCreateSelectedId = '';
  templateCreateSuggestedName = '';
  templateCreateNameDirty = false;
}

function openGroupTitleEditor(editor) {
  if (!editor) return;
  const wrap = editor.closest('.group-title-wrap');
  if (!wrap) return;
  wrap.classList.add('editing');
  editor.value = editor.dataset.old || editor.value || '';
  requestAnimationFrame(() => {
    editor.focus({ preventScroll: true });
    const len = editor.value.length;
    editor.setSelectionRange(len, len);
  });
}

function closeGroupTitleEditor(editor) {
  editor?.closest('.group-title-wrap')?.classList.remove('editing');
}

document.addEventListener('click', (e) => {
  const block = e.target.closest('.mini-history, #historyList');
  if (!block) return;
  toggleHistoryTimeMode();
});

document.addEventListener('focusin', () => {
  syncCliNameEditVisibility();
});

document.addEventListener('focusout', () => {
  requestAnimationFrame(() => {
    syncCliNameEditVisibility();
  });
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
  const dialog = await showDeleteConfirmDialog({
    kicker: t('multiSelectActive'),
    title: t('deleteSelectedConfirm', count),
    subtitle: t('selectedCount', count)
  });
  if (!dialog.confirmed) return;

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

importScreenshotBtn?.addEventListener('click', () => {
  routeActionsMenuOpen = false;
  renderRouteActionsMenu();
  if (screenshotImportBusy) return;
  if (!supportsScreenshotImport()) {
    feedback.textContent = `⚠ ${t('screenshotImportUnsupported')}`;
    clearFeedbackSoon(1600);
    return;
  }
  importScreenshotInput?.click();
});

importScreenshotInput?.addEventListener('change', async () => {
  const files = Array.from(importScreenshotInput.files || [])
    .filter((file) => file && (!file.type || file.type.startsWith('image/')));
  importScreenshotInput.value = '';
  if (!files.length) return;

  setScreenshotImportBusy(true);
  let scanSession = null;
  let createSession = null;

  try {
    scanSession = createScreenshotImportSession();
    const { names, failedCount } = await collectScreenshotImportNames(files, scanSession);
    finishScreenshotImportSession(scanSession);
    scanSession = null;

    if (!names.length) {
      feedback.textContent = failedCount
        ? `${t('screenshotImportNoNames')} · ${t('screenshotImportPartialFailure', failedCount)}`
        : t('screenshotImportNoNames');
      clearFeedbackSoon(1800);
      return;
    }

    const existingGroups = await getGroupsWithTotals();
    const knownNames = new Set(existingGroups.map((group) => normalizeTextKey(group.name)));
    const newNames = [];
    let existingCount = 0;

    for (const name of names) {
      const key = normalizeTextKey(name);
      if (knownNames.has(key)) {
        existingCount += 1;
        continue;
      }
      knownNames.add(key);
      newNames.push(name);
    }

    if (!newNames.length) {
      await showActionDialog({
        variant: 'review',
        kicker: t('importScreenshot'),
        title: t('screenshotReviewExistingTitle'),
        subtitle: t('screenshotReviewExistingSub', existingCount),
        body: [
          t('screenshotReviewExistingBody'),
          failedCount ? t('screenshotImportPartialFailure', failedCount) : ''
        ].filter(Boolean).join(' '),
        details: buildScreenshotImportPreviewItems(names),
        showCancel: false,
        confirmLabel: t('close')
      });
      return;
    }

    const dialog = await showActionDialog({
      variant: 'review',
      kicker: t('importScreenshot'),
      title: t('screenshotReviewTitle'),
      subtitle: t('screenshotReviewSub', newNames.length, existingCount),
      body: failedCount ? t('screenshotImportPartialFailure', failedCount) : '',
      details: buildScreenshotImportPreviewItems(names),
      confirmLabel: t('create'),
      cancelLabel: t('cancel')
    });
    if (!dialog.confirmed) {
      feedback.textContent = '';
      return;
    }

    createSession = createScreenshotImportSession();
    updateScreenshotLoadingModal(t('screenshotImportCreating', newNames.length), createSession);
    const createdCount = await createCustomersFromNames(newNames, createSession);
    finishScreenshotImportSession(createSession);
    createSession = null;

    await load();
    feedback.textContent = t('screenshotImportCreated', createdCount, existingCount, failedCount);
    clearFeedbackSoon(1800);
  } catch (e) {
    feedback.textContent = `⚠ ${e?.message || t('error')}`;
    clearFeedbackSoon(1800);
  } finally {
    finishScreenshotImportSession(scanSession);
    finishScreenshotImportSession(createSession);
    setScreenshotImportBusy(false);
  }
});

importCardsBtn?.addEventListener('click', openImportModal);
cancelImport?.addEventListener('click', closeImportModal);
importBackdrop?.addEventListener('click', (e) => {
  if (e.target === importBackdrop) closeImportModal();
});
actionDialogCancel?.addEventListener('click', () => {
  resolveActionDialog(false);
});
actionDialogConfirm?.addEventListener('click', () => {
  resolveActionDialog(true);
});
actionDialogBackdrop?.addEventListener('click', (e) => {
  if (e.target === actionDialogBackdrop) resolveActionDialog(false);
});

document.addEventListener('keydown', (e) => {
  if (!importBackdrop || importBackdrop.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeImportModal();
});

document.addEventListener('keydown', (e) => {
  if (!actionDialogBackdrop || actionDialogBackdrop.classList.contains('hidden')) return;
  if (e.key === 'Escape') resolveActionDialog(false);
  if (e.key === 'Enter') {
    e.preventDefault();
    resolveActionDialog(true);
  }
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
    if (reorderModalMeta) {
      reorderModalMeta.textContent = ordered.length ? t('templateCustomerCount', ordered.length) : '';
    }
    for (let i = 0; i < ordered.length; i++) {
      const g = ordered[i];
      const disableUp = i === 0;
      const disableDown = i === ordered.length - 1;
      const row = document.createElement('div');
      row.className = 'reorder-item';
      row.draggable = false;
      row.dataset.id = String(g.id);
      row.innerHTML = `
        <div class="reorder-rank">${i + 1}</div>
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

let reorderInitialOrder = null;

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

cancelTemplateCreate?.addEventListener('click', closeTemplateCreateModal);
confirmTemplateCreate?.addEventListener('click', async () => {
  const template = getSelectedTemplateCreateTemplate();
  const name = String(templateCreateName?.value || '').trim();
  if (!template || !name) return;
  closeTemplateCreateModal();
  await createProjectFromTemplate(template, name);
});
templateCreateBackdrop?.addEventListener('click', (e) => {
  if (e.target === templateCreateBackdrop) closeTemplateCreateModal();
});
document.addEventListener('keydown', (e) => {
  if (!templateCreateBackdrop || templateCreateBackdrop.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeTemplateCreateModal();
});

async function resetAppDataAndReload() {
  const dialog = await showDeleteConfirmDialog({
    kicker: t('settings'),
    title: t('resetApp'),
    body: t('resetAppSub'),
    confirmLabel: t('resetApp')
  });
  if (!dialog.confirmed) return;

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
  const freezerEnabled = isFreezerEnabled();
  if (langSelect) langSelect.value = lang;
  if (cardLayoutSelect) cardLayoutSelect.value = cardLayout;

  document.body.classList.toggle('theme-light', theme === 'light');
  document.body.classList.toggle('hand-left', hand === 'left');

  if (themeToggle) themeToggle.checked = theme === 'light';
  if (handToggle) handToggle.checked = hand === 'left';
  if (freezerToggle) freezerToggle.checked = freezerEnabled;
  if (!freezerEnabled && selectedStorage === 'freezer') selectedStorage = 'main';
  syncI18nUI();
  syncVisualViewport();
}

function openSettings() {
  panelSearch?.blur();
  if (sidePanelBackdrop?.classList.contains('hidden')) {
    openSidePanel();
  }
  if (settingsSectionPinned) {
    settingsSectionPinned = false;
    applyPanelSearchFilter();
    return;
  }
  if (panelSearch) panelSearch.value = '';
  settingsSectionPinned = true;
  const settingsSection = sidePanelBackdrop?.querySelector('[data-title="settings"]');
  if (!settingsSection) return;
  applyPanelSearchFilter();
  settingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  panelSettingsBtn?.classList.add('active');
}

panelBtn?.addEventListener('click', openSidePanel);
sidePanelBackdrop?.addEventListener('click', (e) => {
  if (e.target === sidePanelBackdrop) closeSidePanel();
});
document.addEventListener('click', (e) => {
  if (routeActionsMenuOpen && !e.target.closest('.sidepanel-route-actions-wrap')) {
    routeActionsMenuOpen = false;
    renderRouteActionsMenu();
  }
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
routeActionsMenuBtn?.addEventListener('click', () => {
  routeActionsMenuOpen = !routeActionsMenuOpen;
  renderRouteActionsMenu();
});
routeActionsModeBtn?.addEventListener('click', () => {
  routeActionsMenuOpen = !routeActionsMenuOpen;
  renderRouteActionsMenu();
});
openCreateTemplateModalBtn?.addEventListener('click', () => {
  openTemplateCreateModal({
    routeName: String(newProjectName?.value || '').trim()
  });
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
sidePanel?.addEventListener('scroll', () => {
  schedulePanelOverflowMenuDirectionRefresh();
}, { passive: true });
window.addEventListener('resize', () => {
  schedulePanelOverflowMenuDirectionRefresh();
});
panelSearch?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (!panelSearchMatchesSettings(panelSearch.value)) return;
  e.preventDefault();
  openSettings();
});
panelSettingsBtn?.addEventListener('click', () => {
  openSettings();
});

devRouteSnapshotBtn?.addEventListener('click', async () => {
  try {
    await copyDevRouteSnapshot();
  } catch (e) {
    feedback.textContent = '⚠ ' + (e?.message || t('error'));
  }
});

devRouteTextBtn?.addEventListener('click', async () => {
  try {
    await copyDevRouteText();
  } catch (e) {
    feedback.textContent = '⚠ ' + (e?.message || t('error'));
  }
});

devAppStateBtn?.addEventListener('click', async () => {
  try {
    await copyDevAppState();
  } catch (e) {
    feedback.textContent = '⚠ ' + (e?.message || t('error'));
  }
});

devViewportSyncBtn?.addEventListener('click', () => {
  runDevViewportResync();
});

devSnowfallBtn?.addEventListener('click', () => {
  triggerDevSnowfall();
});

exportRouteBtn?.addEventListener('click', async () => {
  routeActionsMenuOpen = false;
  renderRouteActionsMenu();
  const payload = await buildCurrentRouteCardsText();
  if (!payload.text) {
    feedback.textContent = `⚠ ${t('noCustomersInRoute')}`;
    clearFeedbackSoon(1000);
    return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload.text);
      feedback.textContent = t('copiedCards', payload.count);
      clearFeedbackSoon(1000);
    }
  } catch (e) {
    feedback.textContent = '⚠ ' + (e?.message || t('error'));
  }
});

duplicateRouteBtn?.addEventListener('click', async () => {
  routeActionsMenuOpen = false;
  renderRouteActionsMenu();
  const projects = readProjects();
  const currentRoute = getCurrentRouteRecord();
  if (!currentRoute) return;
  const suggested = suggestUniqueProjectName(currentRoute.name, projects);
  const dialog = await showActionDialog({
    variant: 'template',
    kicker: t('duplicateRoute'),
    title: t('duplicateRoute'),
    subtitle: t('projectNamePrompt'),
    input: {
      value: suggested,
      placeholder: t('projectNamePrompt'),
      label: t('projectNamePrompt')
    },
    confirmLabel: t('create'),
    cancelLabel: t('cancel')
  });
  if (!dialog.confirmed) return;
  const chosen = String(dialog.value || '').trim();
  if (!chosen) return;
  const name = suggestUniqueProjectName(chosen, projects);
  const snapshot = await captureProjectSnapshot(currentRoute.id);
  const id = createProjectId();
  projects.push({ id, name, createdAt: Date.now() });
  writeProjects(projects);
  await switchProject(id);
  await replaceProjectWithSnapshot(snapshot || { groups: [], events: [] });
  selectedGroup = null;
  selectedMode = null;
  exitSelectionMode();
  await load();
  renderProjectList();
  applyPanelSearchFilter();
  feedback.textContent = t('projectCreated');
  clearFeedbackSoon(1000);
});

clearTotalsBtn?.addEventListener('click', async () => {
  routeActionsMenuOpen = false;
  renderRouteActionsMenu();
  const dialog = await showDeleteConfirmDialog({
    kicker: t('currentRoute'),
    title: t('clearTotalsBtn'),
    body: t('clearTotalsSub'),
    confirmLabel: t('clear')
  });
  if (!dialog.confirmed) return;
  const groups = await getGroupsWithTotals();
  const cleanSnapshot = {
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      createdAt: Number(g.createdAt) || Date.now()
    })),
    events: []
  };
  await replaceProjectWithSnapshot(cleanSnapshot);
  selectedGroup = null;
  selectedMode = null;
  exitSelectionMode();
  await load();
  feedback.textContent = t('routeTotalsCleared');
  clearFeedbackSoon(1000);
});

currentRouteHistoryBtn?.addEventListener('click', async () => {
  routeActionsMenuOpen = false;
  renderRouteActionsMenu();
  const currentRoute = getCurrentRouteRecord();
  if (!currentRoute) return;
  openHistoryModal();
  await renderHistoryForProject(currentRoute.id, `${t('globalHistory')} · ${currentRoute.name}`);
});

currentRouteRenameBtn?.addEventListener('click', async () => {
  routeActionsMenuOpen = false;
  renderRouteActionsMenu();
  const currentRoute = getCurrentRouteRecord();
  if (!currentRoute) return;
  await renameProjectWithDialog(currentRoute.id);
});

currentRouteTemplateBtn?.addEventListener('click', async () => {
  routeActionsMenuOpen = false;
  renderRouteActionsMenu();
  const currentRoute = getCurrentRouteRecord();
  if (!currentRoute) return;
  await saveProjectAsTemplate(currentRoute.id, currentRoute.name || '');
});

startMultiSelectBtn?.addEventListener('click', async () => {
  routeActionsMenuOpen = false;
  renderRouteActionsMenu();
  const groups = orderGroups(await getGroupsWithTotals());
  if (!groups.length) return;
  selectionMode = true;
  selectedGroup = null;
  selectedMode = null;
  stopModeHintPulse();
  selectedGroupIds = new Set(groups.map((g) => Number(g.id)).filter(Number.isFinite));
  updateSelectionBarUI();
  await load();
});

currentRouteRenameBtnSearch?.addEventListener('click', () => {
  currentRouteRenameBtn?.click();
});

currentRouteTemplateBtnSearch?.addEventListener('click', () => {
  currentRouteTemplateBtn?.click();
});

async function createEmptyProject(name) {
  const chosen = String(name || '').trim();
  if (!chosen) return false;
  const projects = readProjects();
  if (projects.some((project) => String(project.name).toLowerCase() === chosen.toLowerCase())) {
    feedback.textContent = `⚠ ${t('error')}`;
    clearFeedbackSoon(900);
    return false;
  }

  const id = createProjectId();
  projects.push({ id, name: chosen, createdAt: Date.now() });
  writeProjects(projects);
  if (newProjectName) newProjectName.value = '';
  await switchProject(id);
  renderProjectList();
  renderTemplateList();
  applyPanelSearchFilter();
  feedback.textContent = t('projectCreated');
  clearFeedbackSoon(1000);
  return true;
}

async function renameProjectWithDialog(projectId) {
  const id = String(projectId || '').trim();
  if (!id) return false;
  const projects = readProjects();
  const idx = projects.findIndex((project) => project.id === id);
  if (idx < 0) return false;

  const currentName = String(projects[idx].name || '');
  const dialog = await showActionDialog({
    variant: 'template',
    kicker: t('editName'),
    title: t('editName'),
    subtitle: t('projectNamePrompt'),
    input: {
      value: currentName,
      placeholder: t('projectNamePrompt'),
      label: t('projectNamePrompt')
    },
    confirmLabel: t('save'),
    cancelLabel: t('cancel')
  });
  if (!dialog.confirmed) return false;

  const name = String(dialog.value || '').trim();
  if (!name || name === currentName) return false;
  if (projects.some((project, index) => index !== idx && String(project.name).toLowerCase() === name.toLowerCase())) {
    feedback.textContent = `⚠ ${t('error')}`;
    clearFeedbackSoon(900);
    return false;
  }

  projects[idx].name = name;
  writeProjects(projects);
  renderProjectList();
  applyPanelSearchFilter();
  feedback.textContent = t('projectRenamed');
  clearFeedbackSoon(1000);
  return true;
}

async function renameTemplateWithDialog(templateId) {
  const id = String(templateId || '').trim();
  if (!id) return false;
  const templates = readTemplates();
  const idx = templates.findIndex((template) => template.id === id);
  if (idx < 0) return false;

  const currentName = String(templates[idx].name || '');
  const dialog = await showActionDialog({
    variant: 'template',
    kicker: t('editName'),
    title: t('editName'),
    subtitle: t('templateNamePrompt'),
    input: {
      value: currentName,
      placeholder: t('templateNamePrompt'),
      label: t('templateNamePrompt')
    },
    confirmLabel: t('save'),
    cancelLabel: t('cancel')
  });
  if (!dialog.confirmed) return false;

  const name = String(dialog.value || '').trim();
  if (!name || name === currentName) return false;
  if (templates.some((template, index) => index !== idx && String(template.name).toLowerCase() === name.toLowerCase())) {
    feedback.textContent = `⚠ ${t('error')}`;
    clearFeedbackSoon(900);
    return false;
  }

  templates[idx].name = name;
  writeTemplates(templates);
  renderTemplateList();
  applyPanelSearchFilter();
  feedback.textContent = t('templateRenamed');
  clearFeedbackSoon(1000);
  return true;
}

async function createProjectFromTemplate(template, routeName) {
  if (!template) return false;
  const chosen = String(routeName || '').trim();
  if (!chosen) return false;

  const projects = readProjects();
  const uniqueName = suggestUniqueProjectName(chosen, projects);
  const id = createProjectId();
  projects.push({ id, name: uniqueName, createdAt: Date.now() });
  writeProjects(projects);
  if (newProjectName) newProjectName.value = '';
  await switchProject(id);
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
  return true;
}

createProjectBtn?.addEventListener('click', async () => {
  const name = String(newProjectName?.value || '').trim();
  if (!name) return;
  await createEmptyProject(name);
});

newProjectName?.addEventListener('keydown', (e) => {
  const k = String(e.key || '').toLowerCase();
  const isSubmitKey = k === 'enter' || k === 'go' || k === 'done' || k === 'next' || e.keyCode === 13;
  if (isSubmitKey) {
    e.preventDefault();
    createProjectBtn?.click();
  }
});

templateCreateList?.addEventListener('click', (e) => {
  const option = e.target.closest('.template-create-option');
  const nextId = String(option?.getAttribute('data-id') || '');
  if (!nextId || nextId === templateCreateSelectedId) return;
  templateCreateSelectedId = nextId;
  syncTemplateCreateSuggestedName();
  renderTemplateCreateModal();
});

templateCreateName?.addEventListener('input', () => {
  const current = String(templateCreateName.value || '').trim();
  templateCreateNameDirty = !!current && current !== templateCreateSuggestedName;
  if (confirmTemplateCreate) confirmTemplateCreate.disabled = !current;
});

templateCreateName?.addEventListener('keydown', (e) => {
  const k = String(e.key || '').toLowerCase();
  const isSubmitKey = k === 'enter' || k === 'go' || k === 'done' || k === 'next' || e.keyCode === 13;
  if (isSubmitKey) {
    e.preventDefault();
    confirmTemplateCreate?.click();
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
    renderProjectList();
    applyPanelSearchFilter();
    await renameProjectWithDialog(id);
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

  const historyBtn = e.target.closest('.panel-view-project-history');
  if (historyBtn) {
    const id = historyBtn.getAttribute('data-id');
    if (!id) return;
    const project = readProjects().find((p) => p.id === id);
    openProjectMenuId = null;
    renderProjectList();
    applyPanelSearchFilter();
    openHistoryModal();
    const title = project?.name ? `${t('globalHistory')} · ${project.name}` : t('globalHistory');
    await renderHistoryForProject(id, title);
    return;
  }

  const deleteBtn = e.target.closest('.panel-delete-project');
  if (!deleteBtn) return;
  const id = deleteBtn.getAttribute('data-id');
  if (!id) return;
  openProjectMenuId = null;
  renderProjectList();
  applyPanelSearchFilter();

  const projects = readProjects();
  if (projects.length <= 1) {
    feedback.textContent = `⚠ ${t('cannotDeleteLastProject')}`;
    clearFeedbackSoon(1200);
    return;
  }

  const project = projects.find(p => p.id === id);
  if (!project) return;
  const dialog = await showDeleteConfirmDialog({
    kicker: t('projectsTitle'),
    title: t('confirmDeleteProject', project.name)
  });
  if (!dialog.confirmed) return;

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
    openTemplateCreateModal({ templateId: id });
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
    openTemplatePreviewModal(template);
    return;
  }

  const renameBtn = e.target.closest('.panel-rename-template');
  if (renameBtn) {
    const id = renameBtn.getAttribute('data-id');
    if (!id) return;
    openTemplateMenuId = null;
    renderTemplateList();
    applyPanelSearchFilter();
    await renameTemplateWithDialog(id);
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
  const dialog = await showDeleteConfirmDialog({
    kicker: t('templatesTitle'),
    title: t('confirmDeleteTemplate', target.name)
  });
  if (!dialog.confirmed) return;
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

freezerToggle?.addEventListener('change', () => {
  const nextEnabled = !!freezerToggle.checked;
  const wasEnabled = isFreezerEnabled();

  freezerToggle.disabled = true;

  (async () => {
    if (wasEnabled && !nextEnabled) {
      await collapseFreezerDeliveredIntoMain();
    }

    localStorage.setItem(FREEZER_ENABLED_KEY, nextEnabled ? '1' : '0');
    applySettingsFromStorage();
    await load();
    cmd.dispatchEvent(new Event('input'));
  })()
    .catch((err) => {
      freezerToggle.checked = wasEnabled;
      feedback.textContent = `⚠ ${err?.message || t('error')}`;
    })
    .finally(() => {
      freezerToggle.disabled = false;
    });
});

// call once on boot
ensureProjectsSetup();
applySettingsFromStorage();
compactProjectDatabases(readProjects().map((project) => project.id)).catch(() => {});
