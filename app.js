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
  DEFAULT_TOKENS,
  getTokenDefs,
  buildAliasMap,
  displayKey,
  allAliasesFor,
  searchTokens,
  formatTokenOption,
  setTokenOverride,
  resetTokenOverrides
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
const cliPracticeBanner = document.getElementById('cliPracticeBanner');
const cliPracticeKicker = document.getElementById('cliPracticeKicker');
const cliPracticeSub = document.getElementById('cliPracticeSub');
const cliPracticeToggleBtn = document.getElementById('cliPracticeToggleBtn');

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
let historyInputMode = 'total';
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
let historyModalSearchQuery = '';
let historyModalSearchEnabled = false;
let historyModalEvents = [];
let historyModalNamesById = new Map();
let helpCliPracticeState = {
  active: false,
  snapshot: null
};
const GROUP_ORDER_KEY = 'rogo_group_order';
const TOTALS_COLLAPSED_KEY = 'rogo_totals_collapsed';
const PROJECTS_KEY = 'rogo_projects';
const CURRENT_PROJECT_KEY = 'rogo_project_current';
const TEMPLATES_KEY = 'rogo_templates';
const FREEZER_ENABLED_KEY = 'rogo_freezer_enabled';
const ALL_TOTALS_VISIBLE_KEY = 'rogo_all_totals_visible';
const HELP_SECTION_BOTTOM_KEY = 'rogo_help_section_bottom';
const FONT_SCALE_STEP_KEY = 'rogo_font_scale_step';
const HELP_INTRO_SEEN_KEY = 'rogo_help_intro_seen';
const FONT_SCALE_MIN_STEP = -4;
const FONT_SCALE_MAX_STEP = 4;
const FONT_SCALE_BASE_PERCENT = 62.5;
const FONT_SCALE_STEP_FACTOR = 0.05;
const RESERVED_ALIAS_INPUTS = new Set(['kf', 'kv', 'rf', 'rv', 'epsf', 'epsv']);
const VIEWPORT_KEYBOARD_OPEN_THRESHOLD_PX = 140;
const VIEWPORT_LOCK_HOLD_MS = 420;
const SELECTED_CARD_TOP_ALIGN_HOLD_MS = 520;
const RESET_HOLD_MS = 3000;
const RESET_HOLD_MOVE_TOLERANCE_PX = 10;
const IN_APP_CARD_TOP_GAP_PX = 8;
const IN_APP_CARD_TOP_ALIGN_EPSILON_PX = 1;
const IN_APP_CARD_TOP_ALIGN_PASSES = 6;
const SCREENSHOT_IMPORT_CROP_TOP_RATIO = 0.1;
const SCREENSHOT_IMPORT_CROP_BOTTOM_RATIO = 0.04;
const SCREENSHOT_IMPORT_PREVIEW_LIMIT = 10;
const SCREENSHOT_IMPORT_MIN_STRICT_MATCHES = 3;
const SCREENSHOT_IMPORT_ADDRESS_X_TOLERANCE_RATIO = 0.12;
const SCREENSHOT_IMPORT_TIMEOUT_BASE_MS = 20000;
const SCREENSHOT_IMPORT_TIMEOUT_PER_IMAGE_MS = 5000;
const SCREENSHOT_IMPORT_TIMEOUT_MAX_MS = 60000;
const SCREENSHOT_IMPORT_CANCEL_HOLD_MS = 1500;
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
    exportRoute: 'Klanten exporteren',
    exportRouteSub: 'Kopieer alle klantregels van deze route naar je klembord.',
    exportRouteBtn: 'Exporteren',
    duplicateRoute: 'Route dupliceren',
    duplicateRouteSub: 'Maak een kopie van deze route met klanten en totalen.',
    duplicateRouteBtn: 'Dupliceren',
    clearTotals: 'Route totalen wissen',
    clearTotalsSub: 'Zet geleverd- en retourtotalen terug naar 0.',
    routeActions: 'Route-acties',
    routeActionsSub: 'Alles voor deze route op een plek.',
    expandOptions: 'Opties uitklappen',
    collapseOptions: 'Opties inklappen',
    clearTotalsBtn: 'Wissen',
    viewHistoryBtn: 'Doorzoeken',
    editNameBtn: 'Hernoemen',
    saveAsTemplateBtn: 'Opslaan',
    clear: 'Wissen',
    confirmClearTotals: 'Totalen van deze route wissen?\n\nKlanten blijven bestaan, alleen totalen worden teruggezet naar 0.',
    routeTotalsCleared: 'Route totalen gewist',
    noCustomersInRoute: 'Geen klanten in deze route',
    viewHistoryRouteSub: 'Bekijk en doorzoek alle wijzigingen van deze route.',
    editName: 'Route hernoemen',
    editNameSub: 'Pas de routenaam in de routelijst aan.',
    saveAsTemplateSub: 'Bewaar deze route als startpunt voor nieuwe routes.',
    startMultiSelect: 'Meerdere klanten selecteren',
    startMultiSelectSub: 'Selecteer meerdere klanten om te kopiëren, delen of verwijderen.',
    startMultiSelectBtn: 'Selecteren',
    deleteRoute: 'Route verwijderen',
    deleteRouteSub: 'Verwijder deze route en alle klanten daarin.',
    deleteRouteBtn: 'Verwijderen',
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
    saveAsTemplate: 'Opslaan als template',
    switchProject: 'Open',
    rename: 'Naam wijzigen',
    remove: 'Verwijderen',
    projectActions: 'Route acties',
    viewHistory: 'Historie doorzoeken',
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
    templateOverwriteNote: (fromLabel, toLabel) => `Bestaat al · ${fromLabel} -> ${toLabel}`,
    templateOverwriteConfirm: 'Overschrijven',
    cannotDeleteLastProject: 'Minimaal 1 route vereist',
    confirmDeleteProject: (name) => `Route "${name}" verwijderen?`,
    confirmDeleteTemplate: (name) => `Template "${name}" verwijderen?`,
    projectNamePrompt: 'Routenaam',
    templateNamePrompt: 'Template naam',
    install: 'Installeren',
    import: 'Importeren',
    installRoGoAsApp: 'Open RoGo sneller vanaf je beginscherm, ook offline',
    installed: 'Geïnstalleerd',
    installDismissed: 'Installatie geannuleerd',
    installOnIphone: 'Op iPhone: Deel → "Zet op beginscherm"',
    resetApp: 'App resetten',
    resetAppBtn: 'Reset',
    resetAppSub: 'Wis alle lokale data + ververs',
    resetAppSettingSub: (seconds) => `Wis alle lokale RoGo-data en begin opnieuw. Houd ${seconds}s vast.`,
    resetAppHoldIdle: (seconds) => `${seconds}s vasthouden`,
    resetAppHoldProgress: (seconds) => `Vasthouden… ${seconds}s`,
    importScreenshot: 'Importeer uit screenshot',
    importScreenshotSub: 'Importeer klantregels uit screenshots van de Bezorgbaas-app.',
    screenshotScan: 'Importeer',
    screenshotImportPleaseWait: 'Even geduld terwijl de screenshots worden verwerkt.',
    screenshotImportTimeoutHint: (seconds) => `Stopt automatisch na ${seconds}s als het te lang duurt.`,
    screenshotImportStop: 'Stop import',
    screenshotImportStopHoldIdle: (seconds) => `Houd ${seconds}s vast om te stoppen`,
    screenshotImportCancelled: 'Screenshot-import gestopt.',
    screenshotImportStopHoldProgress: (seconds) => `Vasthouden… ${seconds}s`,
    importCards: 'Importeer uit tekst',
    importCardsSub: 'Plak klantregels uit RoGo, bijvoorbeeld gedeeld via Klanten exporteren.',
    importCardsPlaceholder: 'Plak klanten hier...',
    reorderCards: 'Klanten herordenen',
    reorderCardsSub: 'Pas de volgorde van klantnamen aan.',
    reorder: 'Herorden',
    history: 'Historie',
    globalHistory: 'Globale historie',
    historySearchPlaceholder: 'Zoek in globale historie, bv. 2k of 2krat',
    historySearchNoResults: 'Geen resultaten in de globale historie',
    allTotals: 'Alle totalen',
    total: 'Totaal',
    inputLabel: 'Invoer',
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
    languageSub: 'Kies in welke taal RoGo met je praat',
    fontSizeTitle: 'Tekstgrootte',
    fontSizeSub: 'Maak RoGo overal een tikje kleiner of groter',
    fontSizeValue: (step) => step === 0 ? 'Standaard' : (step > 0 ? `+${step}` : `${step}`),
    cardLayout: 'Klantweergave',
    cardLayoutSub: 'Kies hoeveel rust of compactheid je op klantkaarten wilt',
    allTotalsSettingSub: 'Laat de totaalsamenvatting boven de klantenlijst zien',
    helpPositionTitle: 'Help onderaan',
    helpPositionSub: 'Zet Help bovenaan of onderaan in het zijpaneel',
    classic: 'Klassiek',
    compact: 'Compact',
    freezerFeature: 'Vriezerfunctie',
    freezerFeatureSub: 'Houd Koelcel en Vriezer apart zichtbaar op klantkaarten',
    crateAliasesTitle: 'Invoer-aliases',
    crateAliasesSub: (changedCount, totalCount) => changedCount
      ? `Pas korte vormen voor alle soorten aan. ${changedCount}/${totalCount} aangepast.`
      : `Pas korte vormen voor alle soorten aan. Nog op standaard.`,
    crateAliasesEdit: 'Aanpassen',
    aliasSettingsKicker: 'Invoer',
    aliasSettingsTitle: 'Invoer-aliases',
    aliasSettingsSub: 'Pas voor elke soort zelf de korte vormen aan. De eerste alias gebruikt RoGo ook in compacte preview en historie.',
    aliasSettingsPreviewTitle: 'Tik op een alias om hem als eerste te gebruiken',
    aliasSettingsPreviewBody: 'Zo bepaal je zelf wat RoGo kort toont in preview, historie en exportregels.',
    aliasSettingsTokenMeta: 'Eerste alias = compacte weergave',
    aliasSettingsAddPlaceholder: 'Nieuwe alias',
    aliasSettingsAdd: 'Toevoegen',
    aliasSettingsPrimary: 'Eerste alias',
    aliasSettingsMakePrimary: 'Maak eerste alias',
    aliasSettingsRemove: 'Verwijder alias',
    aliasSettingsRestore: 'Herstel standaard',
    aliasSettingsSaved: '✔ Invoer-aliases opgeslagen',
    aliasSettingsRequired: (name) => `${name} heeft minimaal 1 alias nodig.`,
    aliasSettingsLettersOnly: 'Gebruik alleen letters, zonder spaties of cijfers.',
    aliasSettingsReserved: (alias) => `\`${alias}\` is al gereserveerd voor vriezerinvoer.`,
    aliasSettingsConflict: (alias, name) => `\`${alias}\` wordt al gebruikt voor ${name}.`,
    devTools: 'Developer tools',
    devRouteSnapshot: 'Route snapshot kopieren',
    devRouteSnapshotSub: 'Kopieer de huidige route als volledige JSON-snapshot',
    devRouteText: 'Route tekst kopieren',
    devRouteTextSub: 'Kopieer de huidige route als leesbare deeltekst',
    devAppState: 'App-status kopieren',
    devAppStateSub: 'Kopieer instellingen, selectie en viewportstatus als JSON-overzicht',
    devViewportSync: 'Viewport hersynchroniseren',
    devViewportSyncSub: 'Herstel viewportposities voor invoerveld en modals',
    devSnowfall: 'Sneeuwval',
    devSnowfallSub: 'Start een kleine vriezer-sneeuwbui over de app',
    copiedRouteSnapshot: '✔ Route snapshot gekopieerd',
    copiedRouteText: '✔ Route tekst gekopieerd',
    copiedAppState: '✔ App-status gekopieerd',
    viewportResynced: '✔ Viewport hersynchroniseerd',
    snowfallStarted: '✔ Sneeuwbui gestart',
    theme: 'Thema',
    themeSub: 'Kies de weergave die voor jou rustiger leest',
    handed: 'Links-handig',
    handedSub: 'Zet belangrijke knoppen links voor links-handig gebruik',
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
    cliPracticeActive: 'Zelf testen actief',
    cliPracticeSub: 'Het echte invoerveld hieronder werkt nu veilig. Niets wordt opgeslagen.',
    cliPracticeStop: 'Stop',
    cliPracticeStarted: 'Zelf testen actief · niets wordt opgeslagen',
    cliPracticeStopped: 'Zelf testen gestopt',
    cliPracticeSaved: (line) => `✔ Alleen getest · ${line}`,
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
    exportRouteSub: 'Copy all customer lines from this route to your clipboard.',
    exportRouteBtn: 'Export',
    duplicateRoute: 'Duplicate route',
    duplicateRouteSub: 'Create a copy of this route with customers and totals.',
    duplicateRouteBtn: 'Duplicate',
    clearTotals: 'Clear route totals',
    clearTotalsSub: 'Reset delivered and return totals to 0.',
    routeActions: 'Route actions',
    routeActionsSub: 'Everything for this route in one place.',
    expandOptions: 'Expand options',
    collapseOptions: 'Collapse options',
    clearTotalsBtn: 'Clear',
    viewHistoryBtn: 'Search',
    editNameBtn: 'Rename',
    saveAsTemplateBtn: 'Save',
    clear: 'Clear',
    confirmClearTotals: 'Clear totals for this route?\n\nCustomers remain, only totals are reset to 0.',
    routeTotalsCleared: 'Route totals cleared',
    noCustomersInRoute: 'No customers in this route',
    viewHistoryRouteSub: 'Review and search all changes for this route.',
    editName: 'Rename route',
    editNameSub: 'Change the route name in your routes list.',
    saveAsTemplateSub: 'Save this route as a starting point for new routes.',
    startMultiSelect: 'Select multiple customers',
    startMultiSelectSub: 'Select multiple customers to copy, share, or delete.',
    startMultiSelectBtn: 'Select',
    deleteRoute: 'Delete route',
    deleteRouteSub: 'Delete this route and all customers in it.',
    deleteRouteBtn: 'Delete',
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
    viewHistory: 'Search history',
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
    templateOverwriteNote: (fromLabel, toLabel) => `Already exists · ${fromLabel} -> ${toLabel}`,
    templateOverwriteConfirm: 'Overwrite',
    cannotDeleteLastProject: 'At least 1 route is required',
    confirmDeleteProject: (name) => `Delete route "${name}"?`,
    confirmDeleteTemplate: (name) => `Delete template "${name}"?`,
    projectNamePrompt: 'Route name',
    templateNamePrompt: 'Template name',
    install: 'Install',
    import: 'Import',
    installRoGoAsApp: 'Open RoGo faster from your home screen, also offline',
    installed: 'Installed',
    installDismissed: 'Install dismissed',
    installOnIphone: 'On iPhone: Share → "Add to Home Screen"',
    resetApp: 'Reset app',
    resetAppBtn: 'Reset',
    resetAppSub: 'Clear all local data + refresh',
    resetAppSettingSub: (seconds) => `Clear all local RoGo data and start fresh. Hold for ${seconds}s.`,
    resetAppHoldIdle: (seconds) => `Hold ${seconds}s`,
    resetAppHoldProgress: (seconds) => `Holding… ${seconds}s`,
    importScreenshot: 'Import from screenshot',
    importScreenshotSub: 'Import customer lines from screenshots from the Bezorgbaas app.',
    screenshotScan: 'Import',
    screenshotImportPleaseWait: 'Please wait while the screenshots are being processed.',
    screenshotImportTimeoutHint: (seconds) => `Stops automatically after ${seconds}s if it takes too long.`,
    screenshotImportStop: 'Stop import',
    screenshotImportStopHoldIdle: (seconds) => `Hold ${seconds}s to stop`,
    screenshotImportCancelled: 'Screenshot import stopped.',
    screenshotImportStopHoldProgress: (seconds) => `Holding… ${seconds}s`,
    importCards: 'Import from text',
    importCardsSub: 'Paste customer lines from RoGo, for example shared via Export customers.',
    importCardsPlaceholder: 'Paste customers here...',
    reorderCards: 'Reorder customers',
    reorderCardsSub: 'Adjust the order of customer names.',
    reorder: 'Reorder',
    history: 'History',
    globalHistory: 'Global history',
    historySearchPlaceholder: 'Search global history, e.g. 2k or 2krat',
    historySearchNoResults: 'No matches in global history',
    allTotals: 'All totals',
    total: 'Total',
    inputLabel: 'Input',
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
    languageSub: 'Choose which language RoGo uses',
    fontSizeTitle: 'Text size',
    fontSizeSub: 'Make RoGo a touch smaller or larger everywhere',
    fontSizeValue: (step) => step === 0 ? 'Default' : (step > 0 ? `+${step}` : `${step}`),
    cardLayout: 'Customer layout',
    cardLayoutSub: 'Choose how roomy or compact customer cards should feel',
    allTotalsSettingSub: 'Show the totals summary above the customer list',
    helpPositionTitle: 'Help at bottom',
    helpPositionSub: 'Keep Help at the top or move it to the bottom of the side panel',
    classic: 'Classic',
    compact: 'Compact',
    freezerFeature: 'Freezer feature',
    freezerFeatureSub: 'Keep Cooler and Freezer visibly separate on customer cards',
    crateAliasesTitle: 'Input aliases',
    crateAliasesSub: (changedCount, totalCount) => changedCount
      ? `Customize short forms for all items. ${changedCount}/${totalCount} changed.`
      : 'Customize short forms for all items. Still on the default aliases.',
    crateAliasesEdit: 'Customize',
    aliasSettingsKicker: 'Input',
    aliasSettingsTitle: 'Input aliases',
    aliasSettingsSub: 'Customize the short forms for every item. The first alias is also what RoGo uses in compact preview and history.',
    aliasSettingsPreviewTitle: 'Tap an alias to make it the first one',
    aliasSettingsPreviewBody: 'That lets you control what RoGo shows in compact preview, history, and export lines.',
    aliasSettingsTokenMeta: 'First alias = compact display',
    aliasSettingsAddPlaceholder: 'New alias',
    aliasSettingsAdd: 'Add',
    aliasSettingsPrimary: 'First alias',
    aliasSettingsMakePrimary: 'Make first alias',
    aliasSettingsRemove: 'Remove alias',
    aliasSettingsRestore: 'Restore defaults',
    aliasSettingsSaved: '✔ Input aliases saved',
    aliasSettingsRequired: (name) => `${name} needs at least 1 alias.`,
    aliasSettingsLettersOnly: 'Use letters only, without spaces or numbers.',
    aliasSettingsReserved: (alias) => `\`${alias}\` is already reserved for freezer input.`,
    aliasSettingsConflict: (alias, name) => `\`${alias}\` is already used for ${name}.`,
    devTools: 'Developer tools',
    devRouteSnapshot: 'Copy route snapshot',
    devRouteSnapshotSub: 'Copy the current route as a full JSON snapshot',
    devRouteText: 'Copy route text',
    devRouteTextSub: 'Copy the current route as readable share text',
    devAppState: 'Copy app state',
    devAppStateSub: 'Copy settings, selection, and viewport state as a JSON overview',
    devViewportSync: 'Resync viewport',
    devViewportSyncSub: 'Restore viewport positions for the input bar and modals',
    devSnowfall: 'Snowfall',
    devSnowfallSub: 'Start a small freezer snow flurry across the app',
    copiedRouteSnapshot: '✔ Route snapshot copied',
    copiedRouteText: '✔ Route text copied',
    copiedAppState: '✔ App state copied',
    viewportResynced: '✔ Viewport resynced',
    snowfallStarted: '✔ Snowfall started',
    theme: 'Theme',
    themeSub: 'Choose the look that feels calmer to read',
    handed: 'Left-handed',
    handedSub: 'Move key buttons to the left for left-handed use',
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
    cliPracticeActive: 'Practice mode active',
    cliPracticeSub: 'The real input below is now safe to use. Nothing will be saved.',
    cliPracticeStop: 'Stop',
    cliPracticeStarted: 'Practice mode active · nothing will be saved',
    cliPracticeStopped: 'Practice mode stopped',
    cliPracticeSaved: (line) => `✔ Test only · ${line}`,
    tooLow: (name, cur, next) => `⚠ Too low: ${name} (${cur} → ${next})`,
    error: 'Error',
    resetConfirm: 'Reset RoGo?\n\nThis deletes ALL local data on this device and reloads the app.',
    placeholderExample: `15k 1c`,
  }
};

const HELP_COPY = {
  nl: {
    sectionTitle: 'Help',
    launchTitle: 'RoGo uitgelegd',
    launchSub: 'Open waarom RoGo bestaat, invoervoorbeelden en een korte rondleiding',
    openBtn: 'Open',
    modalKicker: 'Help',
    modalTitle: 'Invoer, Tips & Rondleiding',
    modalSub: 'Leer sneller hoe RoGo typt, telt en werkt.',
    tabs: {
      syntax: 'Invoer',
      tips: 'Tips',
      tutorial: 'Rondleiding',
      rogo: 'RoGo'
    },
    startTutorial: 'Start rondleiding',
    resumeTutorial: 'Ga verder',
    tutorialContinue: 'Verder',
    repeatStep: 'Herhaal stap',
    tutorialShowTarget: 'Laat zien',
    tutorialOpenSidePanel: 'Open zijpaneel',
    tutorialCtaReopenPanel: 'Deze stap zit in het zijpaneel. Open het weer of druk op `Open zijpaneel`.',
    tutorialCtaScrollUp: (area) => `De volgende stap staat hoger${area ? ` in ${area}` : ''}. Scroll omhoog of druk op \`Laat zien\`.`,
    tutorialCtaScrollDown: (area) => `De volgende stap staat lager${area ? ` in ${area}` : ''}. Scroll omlaag of druk op \`Laat zien\`.`,
    tutorialAreaSidePanel: 'het zijpaneel',
    tutorialAreaRoute: 'de route',
    tutorialAreaInput: 'het invoerveld onderaan',
    tutorialAreaOutsidePanel: 'het scherm naast het zijpaneel',
    endTutorial: 'Stop rondleiding',
    finishTutorial: 'Klaar',
    tutorialStatus: (current, total) => `Stap ${current} van ${total}`,
    tutorialHeroTitle: 'Loop eerst een veilige oefenroute door',
    tutorialHeroBody: 'RoGo maakt een tijdelijke oefenroute en laat je stap voor stap zien hoe routes, klantkaarten, Geleverd, Retour, vriezer-invoer, een tweede klant, tijdstempels en opruimen werken. Tussen sommige stappen kijk je eerst even terug naar wat er net is veranderd.',
    tutorialHeroNote: 'Je echte routes blijven ongemoeid. De oefenroute gebruikt herkenbare voorbeeldregels zoals `2cont 15krat 20k 2rood`, `2k 1r`, `1kv 1c 20k` en `2c 44k 2c 33k 1bl 2bk`.',
    tutorialProgress: (current, total) => `Bezig: stap ${current} van ${total}`,
    tutorialIdle: 'Nog niet gestart',
    tutorialOverviewTitle: 'Zo loopt de rondleiding',
    tutorialStartCardBody: 'Je oefent route maken, terugzien in de routelijst, het zijpaneel sluiten en later weer openen, een eerste klant toevoegen, Geleverd gebruiken, `Vriezerfunctie` terugvinden in Instellingen, `2k 1r` naar de vriezer-unit sturen, daarna een tweede klant maken met `1kv 1c 20k`, Retour in 1 sterkere regel oefenen, naam wijzigen, tijdstempels en mini-historie tikken, en de route weer opruimen.',
    tutorialStepSummaries: [
      {
        title: 'Nieuwe route',
        body: 'Maak een tijdelijke oefenroute aan vanuit het zijpaneel.'
      },
      {
        title: 'Route terugzien',
        body: 'Bekijk waar de nieuwe route direct in de routelijst verschijnt.'
      },
      {
        title: 'Zijpaneel sluiten',
        body: 'Sluit het zijpaneel weer zodat je teruggaat naar de klantkaarten.'
      },
      {
        title: 'Nieuwe klant',
        body: 'Voeg 1 klant toe zodat de route iets heeft om op te oefenen.'
      },
      {
        title: 'Klant selecteren',
        body: 'Tik de nieuwe kaart 1 keer aan zodat RoGo weet met welke klant je werkt.'
      },
      {
        title: 'Geleverd kiezen',
        body: 'Activeer de juiste modus op de klantkaart.'
      },
      {
        title: 'Modus bekijken',
        body: 'Kijk even hoe de kaart nu op Geleverd staat voordat je invoer verstuurt.'
      },
      {
        title: 'Eerste regel',
        body: 'Verstuur `5krat 1cont` en zie chips direct groen worden.'
      },
      {
        title: 'Resultaat bekijken',
        body: 'Bekijk wat er na de eerste opgeslagen regel op de kaart is veranderd.'
      },
      {
        title: 'Gestapelde invoer',
        body: 'Verstuur `2cont 15krat 20k 2rood` en zie dat dezelfde soort invoer samen 35 kratten wordt.'
      },
      {
        title: 'Nieuw totaal bekijken',
        body: 'Zie dat de tweede regel boven op de eerste is opgeteld.'
      },
      {
        title: 'Vriezerfunctie',
        body: 'Open het zijpaneel, vind `Vriezerfunctie` in Instellingen, zet hem aan, en stuur daarna `2k 1r` naar `Vriezer`.'
      },
      {
        title: 'Tweede klant',
        body: 'Voeg daarna nog een klant toe en verstuur op `Geleverd` in 1 keer `1kv 1c 20k`.'
      },
      {
        title: 'Retour oefenen',
        body: 'Schakel daarna naar Retour en verstuur in 1 keer `2c 44k 2c 33k 1bl 2bk`.'
      },
      {
        title: 'Klantnaam wijzigen',
        body: 'Pas de klantnaam aan zodat hernoemen duidelijk wordt.'
      },
      {
        title: 'Nieuwe naam terugzien',
        body: 'Controleer hoe de nieuwe klantnaam direct op de kaart terugkomt.'
      },
      {
        title: 'Tijdstip tikken',
        body: 'Wissel `Laatst gewijzigd` van `... geleden` naar de exacte tijd.'
      },
      {
        title: 'Mini-historie tikken',
        body: 'Wissel onder de kaart tussen `Totaal` en `Invoer`.'
      },
      {
        title: 'Zijpaneel openen',
        body: 'Open het zijpaneel later zelf weer met de knop rechtsboven.'
      },
      {
        title: 'Drie puntjes',
        body: 'Open de route-acties direct bij deze routenaam.'
      },
      {
        title: 'Oefenroute opruimen',
        body: 'Verwijder de oefenroute weer via de drie puntjes bij de routenaam.'
      },
      {
        title: 'Laatste vriezerkeuze',
        body: 'Kijk daarna nog 1 keer naar `Vriezerfunctie` en laat hem aan of zet hem uit zoals jij hem na de rondleiding wilt houden.'
      }
    ],
    tutorialDraftRoute: 'Oefenroute',
    tutorialDraftCustomer: 'Klant 1',
    tutorialDraftSecondCustomer: 'Klant 2',
    tutorialDraftRenamedCustomer: 'Klant 3',
    tutorialStepCreateTitle: 'Maak de oefenroute aan',
    tutorialStepCreateBody: (projectName) => `Het zijpaneel staat klaar. Maak de route \`${projectName}\` aan met de knop rechts van het naamveld.`,
    tutorialStepCreateHint: 'Je hoeft nog niets handmatig te bedenken: de routenaam is alvast ingevuld.',
    tutorialStepReviewProjectTitle: 'Bekijk je nieuwe route',
    tutorialStepReviewProjectBody: (projectName) => `De route \`${projectName}\` staat nu in de routelijst van het zijpaneel en is meteen actief. Kijk even waar hij staat.`,
    tutorialStepReviewProjectHint: 'Heb je hem gezien? Tik op `Verder`.',
    tutorialStepClosePanelTitle: 'Sluit het zijpaneel zelf weer',
    tutorialStepClosePanelBody: 'Tik op de donkere ruimte naast het zijpaneel om het te sluiten.',
    tutorialStepClosePanelHint: 'Zo voelt meteen logisch hoe je teruggaat van de routelijst naar je kaarten.',
    tutorialStepCustomerTitle: 'Voeg 1 klant toe',
    tutorialStepCustomerBody: (customerName) => `Onderaan de lijst staat alvast \`${customerName}\`. Druk op Enter of Go om de klant aan te maken.`,
    tutorialStepCustomerHint: 'Nieuwe klanten maak je direct in de lijst aan, zonder extra route-menu.',
    tutorialStepSelectCustomerTitle: 'Selecteer de nieuwe klant',
    tutorialStepSelectCustomerBody: (customerName) => `De kaart van \`${customerName}\` staat nu in de route. Tik 1 keer op die kaart om hem te selecteren.`,
    tutorialStepSelectCustomerHint: 'Na 1 tik schuift de kaart omhoog en vraagt RoGo je om `Geleverd` of `Retour` te kiezen.',
    tutorialStepModeTitle: 'Kies eerst Geleverd',
    tutorialStepModeBody: (customerName) => `De kaart van \`${customerName}\` is geselecteerd. Tik op \`Geleverd\` zodat RoGo weet waar de invoer heen moet.`,
    tutorialStepModeHint: 'Pas na het kiezen van Geleverd of Retour wordt het invoerveld actief.',
    tutorialStepReviewModeTitle: 'Bekijk Geleverd op de kaart',
    tutorialStepReviewModeBody: (customerName) => `De kaart van \`${customerName}\` staat nu op \`Geleverd\`. Kijk even hoe die keuze op de kaart zichtbaar blijft.`,
    tutorialStepReviewModeHint: 'Heb je het gezien? Tik op `Verder`.',
    tutorialStepFirstCommandTitle: 'Verstuur je eerste regel',
    tutorialStepFirstCommandBody: 'Het invoerveld is alvast gevuld met `5krat 1cont`. Tik op Versturen om hem op te slaan.',
    tutorialStepFirstCommandHint: 'Volledige schrijfwijzes zoals `krat` en `cont` werken meteen, dus je ziet snel groene chips.',
    tutorialStepReviewFirstCommandTitle: 'Bekijk wat is opgeslagen',
    tutorialStepReviewFirstCommandBody: (customerName) => `Op de kaart van \`${customerName}\` zie je nu 5 kratten en 1 container terug. Dat is je eerste opgeslagen regel.`,
    tutorialStepReviewFirstCommandHint: 'Tik op `Verder` als je dit hebt gezien.',
    tutorialStepSecondCommandTitle: 'Leer hoe stapelen werkt',
    tutorialStepSecondCommandBody: 'Nu staat `2cont 15krat 20k 2rood` klaar. Verstuur hem en let erop dat `15krat` en `20k` samen 35 kratten worden.',
    tutorialStepSecondCommandHint: 'Kijk ook even naar de preview: nog voor je opslaat zie je al 35 kratten, 2 containers en 2 rode kratten.',
    tutorialStepReviewSecondCommandTitle: 'Bekijk het nieuwe totaal',
    tutorialStepReviewSecondCommandBody: (customerName) => `De tweede regel is nu boven op de eerste geteld. Op de kaart van \`${customerName}\` zie je daardoor samen 40 kratten, 3 containers en 2 rode kratten.`,
    tutorialStepReviewSecondCommandHint: 'Dit is belangrijk: je typt dus steeds alleen wat je erbij telt, niet opnieuw het hele eindtotaal.',
    tutorialStepReturnModeTitle: 'Kies nu Retour',
    tutorialStepReturnModeBody: (customerName) => `De kaart van \`${customerName}\` staat nog op \`Geleverd\`. Tik nu op \`Retour\` zodat je ook de retourkant van dezelfde klant oefent.`,
    tutorialStepReturnModeHint: 'Zo zie je dat Geleverd en Retour apart op dezelfde kaart leven.',
    tutorialStepReturnCommandTitle: 'Verstuur je retourregel in 1 keer',
    tutorialStepReturnCommandBody: 'Nu staat `2c 44k 2c 33k 1bl 2bk` klaar. Verstuur hem en let erop dat `2c` + `2c` samen 4 containers worden, en `44k` + `33k` samen 77 kratten.',
    tutorialStepReturnCommandHint: 'Zo zie je in 1 regel tegelijk containers, kratten, kleinblauw en bierkratten werken.',
    tutorialStepReviewReturnCommandTitle: 'Bekijk het retourtotaal',
    tutorialStepReviewReturnCommandBody: (customerName) => `Op de retourkant van \`${customerName}\` zie je nu samen 4 containers, 77 kratten, 1 kleinblauw en 2 bierkratten.`,
    tutorialStepReviewReturnCommandHint: 'Ook bij Retour typ je steeds alleen wat je er nu bij telt.',
    tutorialStepOpenFreezerPanelTitle: 'Open het zijpaneel voor Vriezerfunctie',
    tutorialStepOpenFreezerPanelBody: 'Gebruik de knop rechtsboven om het zijpaneel te openen. Daar vind je ook Instellingen zoals `Vriezerfunctie` terug.',
    tutorialStepOpenFreezerPanelHint: 'Zo weet je later meteen waar deze instelling zit.',
    tutorialStepOpenFreezerSettingsTitle: 'Open Instellingen',
    tutorialStepOpenFreezerSettingsBody: 'Tik op het tandwiel rechtsboven in het zijpaneel. Daar zit de schakelaar voor `Vriezerfunctie`.',
    tutorialStepOpenFreezerSettingsHint: 'De vriezer-schakelaar zit dus niet op de klantkaart zelf, maar in Instellingen.',
    tutorialStepEnableFreezerTitle: 'Kijk naar `Vriezerfunctie`',
    tutorialStepEnableFreezerBody: (enabled) => enabled
      ? '`Vriezerfunctie` staat hier nu al aan. Kijk even waar deze schakelaar zit, en tik daarna op `Verder`.'
      : 'Zet `Vriezerfunctie` nu aan. Daarna kan dezelfde klantkaart `Koelcel` en `Vriezer` apart bijhouden.',
    tutorialStepEnableFreezerHint: (enabled) => enabled
      ? 'Zo weet je later meteen waar je hem terugvindt.'
      : 'Na het aanzetten verschijnen `Koelcel` en `Vriezer` als losse doelen op de kaart.',
    tutorialStepCloseFreezerPanelTitle: 'Sluit het zijpaneel weer',
    tutorialStepCloseFreezerPanelBody: 'Tik weer op de donkere ruimte naast het zijpaneel om terug te gaan naar je klantkaart.',
    tutorialStepCloseFreezerPanelHint: 'Zo ga je na Instellingen meteen terug naar je telling.',
    tutorialStepBackToDeliveredTitle: 'Ga terug naar Geleverd',
    tutorialStepBackToDeliveredBody: (customerName) => `De kaart van \`${customerName}\` staat nog op \`Retour\`. Tik nu weer op \`Geleverd\`, want de vriezer-unit hoort bij de geleverde kant.`,
    tutorialStepBackToDeliveredHint: 'De vriezer-split werkt op `Geleverd`, niet op `Retour`.',
    tutorialStepFreezerStorageTitle: 'Kies nu `Vriezer` op de kaart',
    tutorialStepFreezerStorageBody: 'Boven aan de geselecteerde kaart zie je nu `Koelcel` en `Vriezer`. Tik op `Vriezer` zodat de volgende regel daarheen gaat.',
    tutorialStepFreezerStorageHint: 'Zo stuur je iets heel bewust naar de vriezer-unit, zonder aparte klantkaart.',
    tutorialStepFreezerCommandTitle: 'Sla iets op voor de vriezer-unit',
    tutorialStepFreezerCommandBody: 'Oh! Niet de diepvries kratten vergeten. Voor deze klant heb je nog `2k 1r` voor de vriezer-unit. Verstuur hem zodat die apart onder `Vriezer` komt te staan.',
    tutorialStepFreezerCommandHint: 'Je typt hier gewoon normale invoer; omdat `Vriezer` actief is, komt het op de juiste plek terecht.',
    tutorialStepReviewFreezerCommandTitle: 'Bekijk de aparte vriezer-telling',
    tutorialStepReviewFreezerCommandBody: (customerName) => `Op de kaart van \`${customerName}\` zie je nu \`Koelcel\` en \`Vriezer\` apart terug. Kijk even hoe \`2k 1r\` los onder \`Vriezer\` staat, terwijl de kleine vriezer-herinnering zichtbaar blijft.`,
    tutorialStepReviewFreezerCommandHint: 'Heb je de aparte vriezer-unit gezien? Tik op `Verder`.',
    tutorialStepSecondCustomerTitle: 'Voeg nog 1 klant toe',
    tutorialStepSecondCustomerBody: (customerName) => `Je merkt nu dat er voor een andere klant ook nog diepvries mee moet. Onderaan de lijst staat alvast \`${customerName}\`. Druk op Enter of Go om deze tweede klant aan te maken.`,
    tutorialStepSecondCustomerHint: 'Zo oefen je meteen dat je tijdens het werk rustig nog een extra klant kunt toevoegen.',
    tutorialStepSelectSecondCustomerTitle: 'Selecteer de tweede klant',
    tutorialStepSelectSecondCustomerBody: (customerName) => `De kaart van \`${customerName}\` staat nu ook in de route. Tik 1 keer op die kaart om hem te selecteren.`,
    tutorialStepSelectSecondCustomerHint: 'Daarna kun je direct weer naar `Geleverd` voor die nieuwe klant.',
    tutorialStepSecondCustomerModeTitle: 'Kies weer Geleverd',
    tutorialStepSecondCustomerModeBody: (customerName) => `De kaart van \`${customerName}\` is geselecteerd. Tik op \`Geleverd\` zodat je de hele telling voor deze klant in 1 regel kunt invoeren.`,
    tutorialStepSecondCustomerModeHint: 'Ook bij een nieuwe klant kies je eerst waar de invoer heen moet.',
    tutorialStepSecondCustomerCommandTitle: 'Stuur koelcel en vriezer in 1 regel',
    tutorialStepSecondCustomerCommandBody: 'Voor deze klant tel je 1 diepvrieskrat, plus de rest van de container als `1c 20k`. Typ daarom in 1 regel `1kv 1c 20k` en verstuur hem op `Geleverd`.',
    tutorialStepSecondCustomerCommandHint: 'Hier laat `1kv` zien dat 1 krat naar `Vriezer` gaat, terwijl `1c 20k` gewoon op `Koelcel` blijft.',
    tutorialStepReviewSecondCustomerCommandTitle: 'Bekijk hoe die 1 regel is gesplitst',
    tutorialStepReviewSecondCustomerCommandBody: (customerName) => `Op de kaart van \`${customerName}\` zie je nu in \`Koelcel\` 1 container en 20 kratten, en apart in \`Vriezer\` nog 1 krat. Zo werkt gemengde invoer in 1 regel.`,
    tutorialStepReviewSecondCustomerCommandHint: 'Zie je dat \`1kv\` apart is uitgekomen en de rest gewoon op \`Koelcel\` staat? Tik op `Verder`.',
    tutorialStepRenameTitle: 'Wijzig de klantnaam',
    tutorialStepRenameBody: (customerName, renamedName) => `De kaart van \`${customerName}\` staat al geselecteerd. Tik 1 keer op de naam om bewerken te openen, en hernoem hem bijvoorbeeld naar \`${renamedName}\`.`,
    tutorialStepRenameHint: 'Sla de nieuwe naam af met Enter.',
    tutorialStepReviewRenameTitle: 'Controleer de nieuwe naam',
    tutorialStepReviewRenameBody: (renamedName) => `De kaart heet nu \`${renamedName}\`. Kijk even hoe die nieuwe naam direct op dezelfde kaart terugkomt.`,
    tutorialStepReviewRenameHint: 'Heb je hem gezien? Tik op `Verder`.',
    tutorialStepTimestampTitle: 'Tik op `Laatst gewijzigd`',
    tutorialStepTimestampBody: 'Onder de kaarttitel staat de hele regel `Laatst gewijzigd`. Tik daar 3 keer zodat je ziet hoe de tijd hier en in de mini-historie samen wisselt tussen `... geleden` en de exacte tijd.',
    tutorialStepTimestampHint: 'Kijk bewust op 2 plekken: boven bij `Laatst gewijzigd` en onder in de mini-historie.',
    tutorialStepReviewTimestampTitle: 'Bekijk de tijdwissel op 2 plekken',
    tutorialStepReviewTimestampBody: 'Je hebt net gezien dat dezelfde tijdweergave tegelijk boven en onder wisselt. Kijk nog 1 keer rustig naar beide plekken.',
    tutorialStepReviewTimestampHint: 'Heb je het verschil gezien? Tik op `Verder`.',
    tutorialStepMiniHistoryTitle: 'Wissel `Totaal` en `Invoer` in mini-historie',
    tutorialStepMiniHistoryBody: 'Onderaan deze geselecteerde kaart zie je mini-historie met je 2 eerdere invoeren. Tik daar 3 keer op de historiewaarde zodat `Totaal` en `Invoer` voor beide regels wisselen.',
    tutorialStepMiniHistoryHint: 'Kijk naar de hele mini-historie, niet alleen naar 1 kleine waarde.',
    tutorialStepReviewMiniHistoryTitle: 'Bekijk mini-historie nog 1 keer',
    tutorialStepReviewMiniHistoryBody: 'Je 2 eerdere invoeren staan hier samen. Kijk nog 1 keer hoe dezelfde regels tussen `Totaal` en `Invoer` kunnen wisselen.',
    tutorialStepReviewMiniHistoryHint: 'Heb je beide standen gezien? Tik op `Verder`.',
    tutorialStepFinalReviewTitle: 'Kijk nog 1 keer naar wat je hebt opgebouwd',
    tutorialStepFinalReviewBody: 'Je hebt nu 2 klanten, Geleverd, Retour, vriezer-invoer, tijdstempels en mini-historie samen op het scherm gezien. Kijk nog 1 keer rustig naar het geheel voordat je de oefenroute weer opruimt.',
    tutorialStepFinalReviewHint: 'Heb je een goed beeld van wat RoGo hier allemaal heeft vastgehouden? Tik op `Verder`.',
    tutorialReviewToggleProgress: (remaining, total) => `Nog ${remaining} van ${total} wissels.`,
    tutorialStepOpenPanelTitle: 'Open het zijpaneel zelf opnieuw',
    tutorialStepOpenPanelBody: 'Gebruik de knop rechtsboven om het zijpaneel weer open te zetten.',
    tutorialStepOpenPanelHint: 'Zo vind je altijd je routes terug.',
    tutorialStepOpenRouteMenuTitle: 'Open de drie puntjes bij deze route',
    tutorialStepOpenRouteMenuBody: (projectName) => `Zo zie je dat route-acties ook direct bij \`${projectName}\` in de routelijst zitten. Tik op de drie puntjes naast de routenaam.`,
    tutorialStepOpenRouteMenuHint: 'In dat menu kun je bijvoorbeeld hernoemen, historie openen, opslaan als template of verwijderen.',
    tutorialStepDeleteTitle: 'Ruim de oefenroute weer op',
    tutorialStepDeleteBody: 'Tik in dit route-menu op `Verwijderen` zodat de controle-popup opent.',
    tutorialStepDeleteHint: 'Je bent nog niet klaar: hierna krijg je nog 1 gewone bevestiging.',
    tutorialStepDeleteConfirmTitle: 'Bevestig in de popup',
    tutorialStepDeleteConfirmBody: 'De verwijder-popup staat nu open. Tik daar op `Verwijderen` om de oefenroute echt weg te halen.',
    tutorialStepDeleteConfirmHint: 'Zo zie je dat verwijderen altijd nog 1 extra controle heeft.',
    tutorialStepReviewDeleteTitle: 'Controleer dat de oefenroute weg is',
    tutorialStepReviewDeleteBody: (routeName) => `Kijk nog 1 keer in het zijpaneel: \`${routeName}\` hoort nu niet meer tussen je routes te staan. Zo weet je zeker dat opruimen echt is gelukt.`,
    tutorialStepReviewDeleteHint: 'Zie je dat de oefenroute weg is? Tik op `Verder`.',
    tutorialStepOpenFinalFreezerSettingsTitle: 'Open Instellingen nog 1 keer',
    tutorialStepOpenFinalFreezerSettingsBody: 'Voordat je afrondt, open nog 1 keer Instellingen. Daar kies je zo meteen hoe `Vriezerfunctie` na de rondleiding blijft staan.',
    tutorialStepOpenFinalFreezerSettingsHint: 'Zo maak je die laatste keuze meteen op de plek waar je hem later ook terugvindt.',
    tutorialStepFinalFreezerChoiceTitle: 'Kies hoe `Vriezerfunctie` blijft staan',
    tutorialStepFinalFreezerChoiceBody: (enabled, initialEnabled) => {
      if (enabled && !initialEnabled) {
        return '`Vriezerfunctie` staat nu aan door de rondleiding. Laat hem zo staan als dit handig is, of zet hem nu weer uit. Deze keuze blijft na de rondleiding gewoon zo.';
      }
      if (enabled && initialEnabled) {
        return '`Vriezerfunctie` stond al aan en staat nu nog steeds aan. Laat hem zo staan als dit bij jouw werk past, of zet hem nu uit. Deze keuze blijft na de rondleiding gewoon zo.';
      }
      if (!enabled && initialEnabled) {
        return '`Vriezerfunctie` stond eerst aan, maar staat nu uit. Laat hem zo als je hem nu niet nodig hebt, of zet hem weer aan. Deze keuze blijft na de rondleiding gewoon zo.';
      }
      return '`Vriezerfunctie` staat nu uit. Laat hem zo als je hem nu niet nodig hebt, of zet hem weer aan. Deze keuze blijft na de rondleiding gewoon zo.';
    },
    tutorialStepFinalFreezerChoiceHint: 'Later terugvinden? Open `Instellingen` of zoek in het zijpaneel op `vriezer`.',
    tutorialCompleteLabel: 'Afgerond',
    tutorialCompleteTitle: 'Rondleiding afgerond',
    tutorialCompleteBody: 'Je hebt nu route maken, terugvinden, het zijpaneel sluiten en openen, 2 klanten toevoegen, Geleverd gebruiken, `Vriezerfunctie` terugvinden en gebruiken, gemengde invoer zoals `1kv 1c 20k` zien werken, Retour in 1 regel oefenen, hernoemen, tijdstempels en mini-historie tikken, en route verwijderen via de drie puntjes gezien.',
    tutorialCompleteHint: 'Open Help opnieuw wanneer je invoer, tips of verborgen flows later nog eens wilt bekijken.',
    tutorialFreezerChoiceKicker: 'Vriezerfunctie',
    tutorialFreezerChoiceTitle: 'Vriezerfunctie aan laten?',
    tutorialFreezerChoiceBody: 'Tijdens de rondleiding is `Vriezerfunctie` aangezet zodat je `Koelcel` en `Vriezer` kon oefenen. Wil je hem voorlopig aan laten, of nu weer uitzetten?',
    tutorialFreezerChoiceDetail: 'Later terugvinden? Open `Instellingen` of zoek in het zijpaneel op `vriezer` om hem weer te wijzigen.',
    tutorialFreezerChoiceKeep: 'Aan laten',
    tutorialFreezerChoiceDisable: 'Nu uitzetten',
    tutorialFreezerChoiceKept: 'Vriezerfunctie blijft aan',
    tutorialFreezerChoiceDisabled: 'Vriezerfunctie weer uitgezet',
    tutorialClosed: 'Rondleiding gesloten',
    tutorialCelebration: '🎉 Rondleiding afgerond',
    syntaxHeroTitle: 'Lees chips en suggesties alsof RoGo met je meekijkt',
    syntaxHeroBody: 'Belangrijkste regel: typ aantal en soort aan elkaar, dus zonder spatie. Daarna kun je kort of lang typen.',
    syntaxImportantLabel: 'Belangrijk',
    syntaxOneWordTitle: 'Typ aantal + soort in 1 woord',
    syntaxOneWordBody: 'Gebruik geen spatie tussen het getal en het soort. Op een container tel je bijvoorbeeld 15 kratten: dus je typt `15krat` en niet `15 krat`.',
    syntaxBracketLabel: 'Haakjes',
    syntaxBracketTitle: 'Kijk vooral naar wat tussen haakjes staat',
    syntaxBracketBody: 'In een suggestie is de lange naam vooral uitleg. Het deel tussen haakjes laat zien wat je echt kunt typen, zoals `krat`, `k` of `g`.',
    syntaxSameItemLabel: 'Zelfde item',
    syntaxSameItemTitle: 'Alles tussen de haakjes hoort bij hetzelfde item',
    syntaxSameItemBody: 'Bij `(krat/k/g)` mag je `15krat`, `15k` of `15g` typen. RoGo ziet dat allemaal als hetzelfde item.',
    syntaxSameItemResult: 'Deze gaan allemaal naar:',
    syntaxSameItemHint: 'Kies gewoon de vorm die jij het snelst vindt. Ze komen allemaal bij hetzelfde item terecht.',
    syntaxPartsLabel: 'Losse delen',
    syntaxPartsTitle: 'Een spatie start een nieuw deel',
    syntaxPartsBody: 'Een spatie gebruik je alleen tussen losse delen, bijvoorbeeld `15k 1cont`. Binnen 1 deel blijft het getal vast aan het soort.',
    syntaxPartsHint: 'Dus: `15k 1cont` mag wel, maar `15 krat` niet.',
    syntaxPreviewLabel: 'Preview',
    syntaxPreviewTitle: 'De preview telt je hele regel eerst op',
    syntaxPreviewBody: 'De previewregel telt alles wat je in die ene regel typt eerst bij elkaar op. Typ je `2cont 15krat 20krat 2rood`, dan laat de preview alvast 35 kratten, 2 containers en 2 rode kratten zien voor de geselecteerde klant.',
    syntaxPreviewHint: 'De preview laat alleen zien wat je met deze ene regel gaat toevoegen. Hier is nog niets opgeslagen. Als de preview niet klopt, pas eerst je invoer aan. Pas na tikken op `Versturen` wordt het echt opgeslagen.',
    syntaxPreviewCustomer: 'Voorbeeld klant',
    syntaxPreviewTypedLabel: 'Je typt',
    syntaxPreviewResultLabel: 'Preview wordt',
    syntaxAddsLabel: 'Doortellen',
    syntaxAddsTitle: 'Typ alleen wat je er nu bij telt',
    syntaxAddsExistingLabel: 'Bij deze bestaande klant staat al',
    syntaxAddsInputLabel: 'Je typt nu',
    syntaxAddsAfterLabel: 'Na Versturen staat er',
    syntaxAddsBody: 'Staan er bij deze bestaande klant al 10 TotaalVERS kratten op de kaart en tel je op de volgende container `15krat`, dan typ je alleen `15krat`.',
    syntaxAddsHint: 'RoGo maakt daar samen 25 TotaalVERS kratten van. Typ dus niet zelf opnieuw het nieuwe eindtotaal, anders tel je dubbel.',
    syntaxReverseLabel: 'Volgorde',
    syntaxReverseTitle: 'Het getal mag ook achter het soort',
    syntaxReverseBody: 'Je mag het getal ook achter een korte schrijfwijze zetten, zoals `k5` of `cont1`. RoGo leest dat hetzelfde als `5k` en `1cont`.',
    syntaxReverseHint: 'Handig als dat sneller tikt op jouw toetsenbord.',
    syntaxCorrectionLabel: 'Min',
    syntaxCorrectionTitle: 'Met een min corrigeer je direct',
    syntaxCorrectionExistingLabel: 'Op de kaart staat nu',
    syntaxCorrectionInputLabel: 'Je corrigeert met',
    syntaxCorrectionAfterLabel: 'Na Versturen wordt dat',
    syntaxCorrectionBody: 'Heb je net te veel geteld, dan hoef je niets te wissen. Typ gewoon een min voor het deel dat eraf moet, zoals `-5k`.',
    syntaxCorrectionHint: 'Zo blijft corrigeren net zo kort als gewoon invoeren.',
    syntaxLongLineLabel: 'Lange regel',
    syntaxLongLineTitle: 'Ook langere regels blijven overzichtelijk',
    syntaxLongLineBody: 'Je mag meerdere soorten en korte schrijfwijzes combineren in 1 regel. RoGo laat eerst per deel een chip zien en rekent daarna alles samen in de preview.',
    syntaxLongLineHint: 'Hier worden `15krat`, `20k` en `10k` samen 45 kratten, en `2cont` met `1c` samen 3 containers.',
    syntaxFreezerLabel: 'Vriezer',
    syntaxFreezerTitle: 'Koelcel en vriezer mogen in 1 regel samen',
    syntaxFreezerBody: 'Staat de vriezerfunctie aan en zit je op `Geleverd`, dan kun je vriezerdelen meteen in dezelfde regel zetten, zoals `10k 2kv`.',
    syntaxFreezerHint: 'Denk aan `kv` van `vriezer` of `kf` van `freezer`. Beide werken altijd, ongeacht welke taal je in de app gebruikt. RoGo zet dat dan bij `Vriezer`, zonder dat je 2 aparte regels hoeft te maken.',
    syntaxFreezerHintDisabled: 'Deze invoer werkt pas als `Vriezerfunctie` aanstaat. Daar zie je ook meteen dat `kv` en `kf` allebei gewoon werken, ongeacht de app-taal. Open `Tips` om te zien waar je hem vindt en hoe het eruitziet.',
    syntaxFreezerJump: 'Open Tips over vriezer',
    syntaxPracticeLabel: 'Zelf testen',
    syntaxPracticeTitle: 'Probeer het zelf uit',
    syntaxPracticeBody: 'Gebruik tijdelijk het echte invoerveld onderaan de app als veilige oefenstand. Chips, suggesties en preview reageren zoals normaal, maar er wordt niets opgeslagen.',
    syntaxPracticeActiveBody: 'Zelf testen staat aan. Het echte invoerveld onderaan de app werkt nu als veilige oefenstand, dus `Versturen` bewaart niets.',
    syntaxPracticePlaceholder: 'Bijv. 2cont 15k 2rood',
    syntaxPracticeStart: 'Begin hieronder met typen om live chips en preview te zien.',
    syntaxPracticeHint: 'RoGo sluit Help en activeert tijdelijk het echte invoerveld onderaan. Stoppen zet daarna je normale selectie terug.',
    syntaxPracticeActiveHint: 'Je kunt nu direct onderaan typen en op `Versturen` tikken. Niets raakt echte route-data.',
    syntaxPracticeSubmitHint: 'Druk op Enter of Go om het veld leeg te maken.',
    syntaxPracticeLastLabel: 'Laatst geprobeerd',
    syntaxPracticeToggleStart: 'Start zelf testen',
    syntaxPracticeToggleStop: 'Stop zelf testen',
    syntaxReadyLabel: 'Volgende stap',
    syntaxReadyTitle: 'Waarschijnlijk ben je klaar om te beginnen',
    syntaxReadyBody: 'Als het meeste van deze tab logisch voelt, ben je klaar om de app gewoon te gebruiken. Kies een klant, tik op `Geleverd` of `Retour`, en typ daarna kort wat je telt.',
    syntaxReadyHint: (tutorialTabLabel) => `Voelt dit nog net te snel of wil je het eerst veilig oefenen? Open dan \`${tutorialTabLabel}\` voor een korte stap-voor-stap route.`,
    syntaxDoLabel: 'Goed',
    syntaxDoBody: 'Getal en soort staan aan elkaar, dus RoGo begrijpt het direct.',
    syntaxDoHint: (itemLabel) => `RoGo leest dit direct als \`15x ${itemLabel}\`.`,
    syntaxDontLabel: 'Niet goed',
    syntaxDontBody: 'Een spatie splitst het op in 2 losse stukken, waardoor de invoer fout gaat.',
    syntaxExamples: [
      {
        command: '15kr',
        title: '`15kr` is nog net te kort',
        body: 'RoGo ziet wel waar je heen wilt en toont daarom suggesties voor mogelijke matches.'
      },
      {
        command: '2cont 15krat 20krat 2rood',
        title: 'Losse stukken mogen stapelen',
        body: 'Meerdere stukken in 1 regel zijn prima. Ook gemixte soorten mogen samen in 1 invoer, en de preview telt alles meteen op.',
        showSuggestions: false
      }
    ],
    syntaxSuggestionsLabel: 'Suggesties',
    syntaxChipsLabel: 'Chips',
    syntaxEmptySuggestions: 'Geen suggesties nodig',
    syntaxRecapTitle: 'Kort onthouden',
    syntaxTips: [
      'Typ aantal en soort altijd aan elkaar, dus zonder spatie.',
      'Alles tussen de haakjes hoort bij hetzelfde item; kies de vorm die jij het snelst typt.',
      'Het getal mag vaak ook achter het soort staan, zoals `k5` of `cont1`.',
      'Een spatie gebruik je alleen om een nieuw deel te starten, zoals `15k 1cont`.',
      'Nieuwe regels tellen erbij op, dus typ alleen wat je er nu bij telt en niet het nieuwe eindtotaal.',
      'Met een min corrigeer je direct, zoals `-5k`.',
      'Met vriezer aan kun je bij `Geleverd` `kv` of `kf` gebruiken; beide werken altijd, ongeacht de app-taal.',
      'Klopt de previewregel niet? Pas eerst je invoer aan en tik daarna pas op `Versturen`.'
    ],
    tipsHeroTitle: 'Slimme kleine dingen die je later vaak pas ontdekt',
    tipsHeroBody: 'Dit zijn de minder opvallende functies die RoGo in de praktijk rustiger en duidelijker maken. Vooral als je visueel leert, helpt het om te letten op kleuren, kleine reminders en vaste plekken in de app.',
    tipsOverviewTitle: 'Dingen die later veel schelen',
    tipsExampleLabel: 'Voorbeeld',
    tipsVisualLabel: 'Zo ziet dat eruit',
    tips: [
      {
        badge: 'Volgorde',
        title: '`5k` en `k5` zijn hetzelfde',
        body: 'Je hoeft niet eerst na te denken of het getal voor of achter het soort moet staan. RoGo begrijpt beide vormen, dus je kunt gewoon de snelste vingerbeweging gebruiken en meteen door tellen.',
        example: '`5k` = `k5` · `1cont` = `cont1`',
        exampleVisual: {
          type: 'sequence',
          parts: [
            { label: '5k', tone: 'accent' },
            { kind: 'sep', label: '=' },
            { label: 'k5', tone: 'accent' },
            { kind: 'sep', label: '·' },
            { label: '1cont', tone: 'accent' },
            { kind: 'sep', label: '=' },
            { label: 'cont1', tone: 'accent' }
          ]
        }
      },
      {
        badge: 'Corrigeren',
        title: 'Met `-5k` haal je er weer af',
        body: 'Zie je dat je net te veel hebt geteld, dan hoef je niets eerst te wissen of opnieuw uit te rekenen. Typ gewoon een min ervoor, en RoGo haalt dat direct van het bestaande totaal af.',
        example: '`20k` + `-5k` = 15 kratten',
        exampleVisual: {
          type: 'sequence',
          parts: [
            { label: '20k', tone: 'accent' },
            { kind: 'sep', label: '+' },
            { label: '-5k', tone: 'danger' },
            { kind: 'sep', label: '=' },
            { label: '15 krat', tone: 'neutral' }
          ]
        }
      },
      {
        badge: 'Chips',
        title: 'Groen is klaar, oranje betekent bijna',
        body: 'Zie de chips als live feedback tijdens het typen. Groen betekent: dit deel snapt RoGo al. Oranje betekent meestal: je zit goed, maar het is nog net te kort. Rood betekent: dit deel klopt nog niet of matcht nergens op.',
        example: 'Oranje `15kr` -> groen `15krat`',
        exampleVisual: {
          type: 'chips',
          items: [
            { label: '15kr', tone: 'warn' },
            { label: '15krat', tone: 'good' },
            { label: '15x', tone: 'bad' }
          ]
        }
      },
      {
        anchor: 'freezer',
        badge: 'Vriezer',
        title: 'Koelcel en vriezer kun je apart houden',
        body: 'Rijd je vaak met een c-vrachtwagen met aparte vriezerunit, zet deze instelling dan aan. Je krijgt dan aparte vakken voor `Koelcel` en `Vriezer`, plus een blijvende vriezer-herinnering op de kaart. Zo zie je in 1 oogopslag bijvoorbeeld `10k` onder Koelcel en `2k` onder Vriezer, terwijl die kleine reminder ook gewoon `2k` blijft tonen zodat je dat deel niet vergeet tijdens het tellen of doorlopen. Voor snelle invoer kun je denken aan `kv` van `vriezer` of `kf` van `freezer`; beide werken altijd, ongeacht de app-taal.',
        example: 'Vriezer-herinnering blijft op `2k` staan',
        exampleVisual: {
          type: 'freezer',
          mainLabel: 'Koelcel',
          mainValue: '10k',
          freezerLabel: 'Vriezer',
          freezerValue: '2k',
          reminder: '2k'
        }
      },
      {
        badge: 'Importeren',
        title: 'Een Bezorgbaas-screenshot kan direct nieuwe kaarten maken',
        body: 'Handig als je een bestaande Bezorgbaas-route niet opnieuw met de hand wilt overtypen. Open eerst het zijpaneel. In `Huidige route` kun je daarna `Importeer uit screenshot` gebruiken. RoGo leest de namen, laat ze eerst zien, en maakt daar daarna direct bruikbare kaarten van.'
      },
      {
        badge: 'Selecteren',
        title: 'Lang indrukken selecteert meteen meer',
        body: 'Lang indrukken is de snelle ingang naar meerdere kaarten tegelijk. Je hoeft dus niet eerst apart een selectiestand te zoeken: houd 1 kaart vast en RoGo springt direct in kiezen, kopiëren, delen of verwijderen.'
      },
      {
        badge: 'Delen',
        title: '`Klanten exporteren` geeft leesbare tekst die je ook weer kunt importeren',
        body: 'Dit is handig als je snel iets wilt delen via WhatsApp of tekst. Wil je de hele route delen, open dan eerst het zijpaneel en gebruik in `Huidige route` `Klanten exporteren`. Wil je maar een paar klanten delen, houd dan 1 kaart vast en selecteer alleen de klanten die je wilt kopiëren of delen. De tekst blijft leesbaar voor mensen, maar kun je later ook weer plakken in `Importeer uit tekst` om die kaarten terug te zetten in RoGo.'
      },
      {
        badge: 'Tijd',
        title: 'Tik op een tijdstip om te wisselen van `... geleden` naar exacte tijd',
        body: 'Tijdstempels staan eerst in snelle vorm zoals `... geleden`, zodat je in 1 oogopslag ziet hoe recent iets is. Tik erop als je het exacte moment wilt zien. Dat werkt op `Laatst gewijzigd`, in de mini-historie op de kaart, en ook in de volledige historie.',
        example: '`12m geleden` -> `12-03 08:42`',
        exampleVisual: {
          type: 'time',
          ageMs: 12 * 60 * 1000
        }
      },
      {
        badge: 'Historie',
        title: 'Tik op een historiewaarde om `Totaal` en `Invoer` te wisselen',
        body: 'Soms wil je zien wat er nu op de kaart staat, en soms juist wat er toen letterlijk is getypt. Tik op zo’n historiewaarde om tussen die twee te wisselen. Dat helpt vooral als je wilt controleren of iets in 1 grote invoer of in meerdere losse stukken is gedaan.',
        example: '`Totaal: 35 krat` <-> `Invoer: 15k 20k`',
        exampleVisual: {
          type: 'sequence',
          parts: [
            { label: 'Totaal: 35 krat', tone: 'history' },
            { kind: 'sep', label: '<->' },
            { label: 'Invoer: 15k 20k', tone: 'history' }
          ]
        }
      },
      {
        badge: 'Zoeken',
        title: 'Via `Historie doorzoeken` vind je oude invoer snel terug',
        body: 'Open eerst het zijpaneel. In `Huidige route` vind je daarna de knop `Historie doorzoeken`. Daar zie je alle wijzigingen van die route bij elkaar. Zoek op klantnaam, korte invoer of correctie als je snel iets wilt controleren zonder alle kaarten handmatig langs te gaan.'
      },
      {
        badge: 'Naam wijzigen',
        title: 'Kaart eerst selecteren, daarna pas bewerken',
        body: 'Dit is bewust zo gemaakt om mis-tikken te voorkomen. De eerste tik zegt alleen: deze kaart is actief. Pas de tweede tik op de naam opent echt het bewerken.'
      },
      {
        badge: 'Volgorde',
        title: 'Via `Herorden` zet je klanten in echte loopvolgorde',
        body: 'Open eerst het zijpaneel. In `Huidige route` kun je daarna `Herorden` gebruiken om klantnamen omhoog of omlaag te zetten. Dat is handig als de looproute verandert of als je de lijst weer wilt laten aansluiten op hoe je echt langs de klanten loopt. Daarna leest de hele route rustiger, omdat de kaartvolgorde weer klopt met buiten.'
      },
      {
        badge: 'Templates',
        title: 'Bestaande naam laat direct overschrijven zien',
        body: 'Open eerst het zijpaneel. In `Huidige route` kun je daarna `Opslaan als template` gebruiken. Als de naam al bestaat, blijft het niet stil. De dialoog laat meteen zien dat je gaat overschrijven, van hoeveel klanten naar hoeveel klanten, en de knop verandert mee. Daardoor zie je duidelijk dat je niet per ongeluk een nieuwe template maakt.'
      },
      {
        badge: 'Dupliceren',
        title: 'Met `Route dupliceren` maak je snel een kopie van alles wat er al staat',
        body: 'Open eerst het zijpaneel. In `Huidige route` kun je `Route dupliceren` gebruiken. Handig als je een route van vandaag als startpunt voor morgen wilt gebruiken, inclusief klantnamen en huidige totalen.'
      },
      {
        badge: 'Wissen',
        title: '`Route totalen wissen` laat je klanten gewoon staan',
        body: 'Open eerst het zijpaneel. In `Huidige route` zet `Route totalen wissen` alleen geleverd en retour terug naar 0. De klantkaarten zelf blijven bestaan. Handig als je opnieuw wilt beginnen zonder de hele route opnieuw op te bouwen.'
      },
      {
        badge: 'Template-route',
        title: 'Via `Gebruik template` start je sneller met een nieuwe route',
        body: 'Bij `Routes` kun je direct een nieuwe route uit een template starten. Je ziet eerst welke klanten erin zitten en kunt de routenaam nog aanpassen voordat RoGo de route aanmaakt.'
      }
    ],
    rogoHeroTitle: 'Gemaakt voor rust in je telling',
    rogoHeroBody: 'RoGo laat je telling direct landen, houdt je hoofd vrij en zet alles meteen in een volgorde die later vanzelf klopt in Bezorgbaas.',
    rogoHeroSlogan: 'Van krat tot totaal, zonder hoofdrekenen.',
    rogoPrivacyLabel: 'Privé & offline',
    rogoPrivacyTitle: 'Privé, lokaal en op jouw manier',
    rogoPrivacyBody: 'RoGo draait op jouw toestel. Geen verplichte cloud en geen online afhankelijkheid. Gebruik korte werknamen, referenties of verzonnen klantlabels die jij in 1 oogopslag herkent; dat hoeft niet 1 op 1 de echte klantnaam of het echte adres te zijn. Is de app eenmaal geladen of geïnstalleerd, dan blijft hij ook volledig offline werken.',
    rogoPrivacyHint: 'Vul alleen in wat voor jou werkt, en tel daarna zonder internet gewoon verder.',
    rogoMentalLoadLabel: 'Minder onthouden',
    rogoMentalLoadTitle: 'Je hoofd blijft vrij voor wat nu voor je staat',
    rogoMentalLoadBody: 'RoGo is gemaakt om denkwerk weg te halen, niet om extra werk toe te voegen. Elk klaar stuk zet je meteen kort vast. Daardoor hoef je geen losse tussenstanden te onthouden terwijl je al naar de volgende container kijkt.',
    rogoLayoutLabel: 'Herkenbare volgorde',
    rogoLayoutTitle: 'De totalen staan meteen in de juiste volgorde',
    rogoLayoutBody: 'RoGo volgt bewust de volgorde waarin je de soorten later terugziet in Bezorgbaas. Daardoor voelt je telling niet als een losse kladversie, maar als iets dat je later bijna 1 op 1 kunt overnemen.',
    rogoLayoutHint: 'Wat je hier opbouwt voelt later meteen herkenbaar en bruikbaar.',
    rogoWhenLabel: 'Wanneer helpt dit het meest',
    rogoWhenTitle: 'Juist vanaf 4 containers wordt het verschil groot',
    rogoWhenBody: 'Bij 1 of 2 containers kom je vaak nog weg met onthouden. Zodra het er meer worden, stapelen tussenstanden, afleiding en tempo zich op. Precies daar haalt RoGo het zware denkwerk uit je telling.',
    rogoScenarioLabel: 'Voorbeeld',
    rogoScenarioTitle: 'Hier verlies je normaal gesproken de tel',
    rogoScenarioCountLabel: 'Je eerste 3 containers samen `58 kratten`',
    rogoScenarioBody: 'Je zit in container 4. Dan roept je manager je naam. Je kijkt op, hoort even hallo, kijkt terug en ineens twijfel je: was dit krat 5, 6 of 7? En nog vervelender: kloppen die `58 kratten` van daarnet eigenlijk nog wel? Dat is precies het soort moment waarop handmatig tellen onnodig veel hoofdruimte vraagt.',
    rogoScenarioHint: 'Met RoGo staat het vorige stuk al veilig vast. Je hoeft alleen verder te gaan waar je bent gebleven.',
    rogoQualityLabel: 'Extra gemak',
    rogoQualityTitle: 'RoGo blijft ook na het tellen sterk',
    rogoQualityBody: 'Niet alleen het tellen voelt rustiger. Terugkijken, corrigeren en uitzonderingen apart houden gaat net zo soepel. Daardoor voelt de hele rit slimmer, niet alleen het telmoment.',
    rogoQualityHint: 'Staat de vriezerfunctie aan, dan blijven `Koelcel` en `Vriezer` ook tijdens het tellen duidelijk apart zichtbaar. Wil je daar voorbeelden van zien? Open `Tips`.',
    rogoQualityHintDisabled: 'De vriezerfunctie is optioneel en staat misschien nog uit. Open `Tips` om te zien waar je hem aanzet en wat je er precies aan hebt.',
    rogoQualityJump: 'Open Tips over vriezer',
    rogoQualityItems: [
      'Historie met tijdstempels laat in 1 oogopslag zien wat je eerder hebt ingevoerd.',
      'Als je de vriezerfunctie aanzet, blijven `Koelcel` en `Vriezer` strak uit elkaar zonder extra hoofdrekenen.',
      'Chips en preview laten twijfel of fouten zien voordat je op `Versturen` tikt.',
      'Correcties zoals `-5k` en snelle varianten zoals `k5` houden invoeren kort en flexibel.'
    ],
    rogoAfterLabel: 'Wat RoGo dan doet',
    rogoAfterTitle: 'Je werkritme wordt sneller en rustiger',
    rogoAfterBody: 'Tellen, kort vastleggen, door. Zo werk je steeds vanuit wat nu voor je staat, niet vanuit een rij tussenstanden die je nog probeert vast te houden.',
    rogoBenefitsLabel: 'Kort samengevat',
    rogoBenefitsTitle: 'Wat je daar concreet aan hebt',
    rogoBenefits: [
      'Je tussenstanden staan vast voordat afleiding ertussen komt.',
      'Je totalen sluiten direct aan op Bezorgbaas.',
      'Historie, tijdstempels en vriezer-info blijven later helder terug te lezen.',
      'Ook correcties blijven kort, snel en zonder extra rekenwerk.'
    ]
  },
  en: {
    sectionTitle: 'Help',
    launchTitle: 'RoGo explained',
    launchSub: 'Open why RoGo exists, syntax examples, and a short walkthrough',
    openBtn: 'Open',
    modalKicker: 'Help',
    modalTitle: 'Syntax, Tips & Tutorial',
    modalSub: 'Learn faster how RoGo types, counts, and works.',
    tabs: {
      syntax: 'Syntax',
      tips: 'Tips',
      tutorial: 'Tutorial',
      rogo: 'RoGo'
    },
    startTutorial: 'Start tutorial',
    resumeTutorial: 'Resume tutorial',
    tutorialContinue: 'Continue',
    repeatStep: 'Repeat step',
    tutorialShowTarget: 'Show me',
    tutorialOpenSidePanel: 'Open side panel',
    tutorialCtaReopenPanel: 'This step happens in the side panel. Open it again or press `Open side panel`.',
    tutorialCtaScrollUp: (area) => `The next step is higher${area ? ` in ${area}` : ''}. Scroll up or press \`Show me\`.`,
    tutorialCtaScrollDown: (area) => `The next step is lower${area ? ` in ${area}` : ''}. Scroll down or press \`Show me\`.`,
    tutorialAreaSidePanel: 'the side panel',
    tutorialAreaRoute: 'the route',
    tutorialAreaInput: 'the input at the bottom',
    tutorialAreaOutsidePanel: 'the area next to the side panel',
    endTutorial: 'End tutorial',
    finishTutorial: 'Done',
    tutorialStatus: (current, total) => `Step ${current} of ${total}`,
    tutorialHeroTitle: 'Walk through a safe practice route first',
    tutorialHeroBody: 'RoGo creates a temporary practice route and shows you step by step how routes, customer cards, Delivered, Return, freezer input, a second customer, timestamps, and cleanup work. Between some steps, you first review what just changed.',
    tutorialHeroNote: 'Your real routes stay untouched. The practice route uses recognizable example commands like `2cont 15krat 20k 2rood`, `2k 1r`, `1kv 1c 20k`, and `2c 44k 2c 33k 1bl 2bk`.',
    tutorialProgress: (current, total) => `In progress: step ${current} of ${total}`,
    tutorialIdle: 'Not started yet',
    tutorialOverviewTitle: 'How the tutorial flows',
    tutorialStartCardBody: 'You practice route creation, seeing it in the route list, closing and later reopening the side panel, adding a first customer, using Delivered, finding the `Freezer feature` in Settings, sending `2k 1r` to the freezer unit, then adding a second customer with `1kv 1c 20k`, practicing Return in 1 stronger line, renaming, tapping timestamps and mini-history, and cleaning up again.',
    tutorialStepSummaries: [
      {
        title: 'New route',
        body: 'Create a temporary practice route from the side panel.'
      },
      {
        title: 'See the route',
        body: 'Notice where the new route appears in the route list right away.'
      },
      {
        title: 'Close the panel',
        body: 'Close the side panel again so you return to the customer cards.'
      },
      {
        title: 'New customer',
        body: 'Add 1 customer so the route has something to work with.'
      },
      {
        title: 'Select customer',
        body: 'Tap the new card once so RoGo knows which customer you want to work on.'
      },
      {
        title: 'Choose Delivered',
        body: 'Activate the correct mode on the customer card.'
      },
      {
        title: 'Review the mode',
        body: 'Take a moment to see that the card now stays on Delivered before sending input.'
      },
      {
        title: 'First line',
        body: 'Send `5krat 1cont` and watch the chips turn green immediately.'
      },
      {
        title: 'Review result',
        body: 'Look at what changed on the card after the first saved line.'
      },
      {
        title: 'Stacked input',
        body: 'Send `2cont 15krat 20k 2rood` and watch the same kind of entry become 35 crates together.'
      },
      {
        title: 'Review new total',
        body: 'See that the second line was added on top of the first one.'
      },
      {
        title: 'Freezer feature',
        body: 'Open the side panel, find `Freezer feature` in Settings, turn it on, and then send `2k 1r` to `Freezer`.'
      },
      {
        title: 'Second customer',
        body: 'Then add another customer and send `1kv 1c 20k` in 1 go on `Delivered`.'
      },
      {
        title: 'Practice Return',
        body: 'Then switch to Return and send `2c 44k 2c 33k 1bl 2bk` in 1 go.'
      },
      {
        title: 'Rename customer',
        body: 'Change the customer name so the edit flow becomes obvious.'
      },
      {
        title: 'Review the new name',
        body: 'Check how the new customer name appears on the same card right away.'
      },
      {
        title: 'Tap the timestamp',
        body: 'Switch `Last modified` from `... ago` to the exact time.'
      },
      {
        title: 'Tap mini-history',
        body: 'Switch the selected card between `Total` and `Input`.'
      },
      {
        title: 'Open the panel',
        body: 'Open the side panel again yourself with the top-right button.'
      },
      {
        title: 'Three dots',
        body: 'Open the route actions directly next to this route name.'
      },
      {
        title: 'Clean up',
        body: 'Delete the practice route again through the three-dot route menu.'
      },
      {
        title: 'Final freezer choice',
        body: 'Then look at `Freezer feature` one last time and leave it on or turn it off, depending on how you want to keep it after the tutorial.'
      }
    ],
    tutorialDraftRoute: 'Practice route',
    tutorialDraftCustomer: 'Customer 1',
    tutorialDraftSecondCustomer: 'Customer 2',
    tutorialDraftRenamedCustomer: 'Customer 3',
    tutorialStepCreateTitle: 'Create the practice route',
    tutorialStepCreateBody: (projectName) => `The side panel is ready. Create the route \`${projectName}\` with the button next to the name field.`,
    tutorialStepCreateHint: 'You do not need to invent anything yet: the route name is already filled in.',
    tutorialStepReviewProjectTitle: 'Look at your new route',
    tutorialStepReviewProjectBody: (projectName) => `The route \`${projectName}\` is now in the side panel route list and is active right away. Take a moment to see where it sits.`,
    tutorialStepReviewProjectHint: 'Seen it? Tap `Continue`.',
    tutorialStepClosePanelTitle: 'Close the side panel yourself',
    tutorialStepClosePanelBody: 'Tap the dark area next to the side panel to close it.',
    tutorialStepClosePanelHint: 'That way it immediately feels natural how you move back from the route list to your cards.',
    tutorialStepCustomerTitle: 'Add 1 customer',
    tutorialStepCustomerBody: (customerName) => `At the bottom of the list you will find \`${customerName}\` already filled in. Press Enter or Go to create it.`,
    tutorialStepCustomerHint: 'New customers are created directly in the list, without an extra route menu.',
    tutorialStepSelectCustomerTitle: 'Select the new customer',
    tutorialStepSelectCustomerBody: (customerName) => `The card for \`${customerName}\` is now in the route. Tap that card once to select it.`,
    tutorialStepSelectCustomerHint: 'After 1 tap, the card moves up and RoGo asks you to choose `Delivered` or `Return`.',
    tutorialStepModeTitle: 'Choose Delivered first',
    tutorialStepModeBody: (customerName) => `The card for \`${customerName}\` is selected. Tap \`Delivered\` so RoGo knows where the input should go.`,
    tutorialStepModeHint: 'The input field only becomes active after you choose Delivered or Return.',
    tutorialStepReviewModeTitle: 'Review Delivered on the card',
    tutorialStepReviewModeBody: (customerName) => `The card for \`${customerName}\` is now on \`Delivered\`. Take a moment to see how that choice stays visible on the card.`,
    tutorialStepReviewModeHint: 'Seen it? Tap `Continue`.',
    tutorialStepFirstCommandTitle: 'Send your first line',
    tutorialStepFirstCommandBody: 'The input field is already filled with `5krat 1cont`. Tap Send to save it.',
    tutorialStepFirstCommandHint: 'Full forms like `krat` and `cont` work immediately, so you will see green chips quickly.',
    tutorialStepReviewFirstCommandTitle: 'Review what was saved',
    tutorialStepReviewFirstCommandBody: (customerName) => `On the card for \`${customerName}\`, you now see 5 crates and 1 container. That is your first saved line.`,
    tutorialStepReviewFirstCommandHint: 'Tap `Continue` once you have seen it.',
    tutorialStepSecondCommandTitle: 'Learn how stacking works',
    tutorialStepSecondCommandBody: 'Now `2cont 15krat 20k 2rood` is ready. Send it and notice that `15krat` and `20k` become 35 crates together.',
    tutorialStepSecondCommandHint: 'Also watch the preview: before you save, it already shows 35 crates, 2 containers, and 2 red crates.',
    tutorialStepReviewSecondCommandTitle: 'Review the new total',
    tutorialStepReviewSecondCommandBody: (customerName) => `The second line has now been added on top of the first one. On the card for \`${customerName}\`, you now see 40 crates, 3 containers, and 2 red crates together.`,
    tutorialStepReviewSecondCommandHint: 'This matters: you only type what you are adding now, not the whole final total again.',
    tutorialStepReturnModeTitle: 'Choose Return now',
    tutorialStepReturnModeBody: (customerName) => `The card for \`${customerName}\` is still on \`Delivered\`. Tap \`Return\` now so you also practice the return side of the same customer.`,
    tutorialStepReturnModeHint: 'That shows that Delivered and Return live separately on the same card.',
    tutorialStepReturnCommandTitle: 'Send the return line in 1 go',
    tutorialStepReturnCommandBody: 'Now `2c 44k 2c 33k 1bl 2bk` is ready. Send it and notice that `2c` + `2c` become 4 containers, while `44k` + `33k` become 77 crates.',
    tutorialStepReturnCommandHint: 'That way you see containers, crates, kleinblauw, and beer crates working together in 1 line.',
    tutorialStepReviewReturnCommandTitle: 'Review the return total',
    tutorialStepReviewReturnCommandBody: (customerName) => `On the return side of \`${customerName}\`, you now see 4 containers, 77 crates, 1 kleinblauw, and 2 beer crates together.`,
    tutorialStepReviewReturnCommandHint: 'In Return too, you only type what you are adding now.',
    tutorialStepOpenFreezerPanelTitle: 'Open the side panel for the freezer feature',
    tutorialStepOpenFreezerPanelBody: 'Use the top-right button to open the side panel. That is also where you can find Settings like `Freezer feature`.',
    tutorialStepOpenFreezerPanelHint: 'This helps you remember where that setting lives later.',
    tutorialStepOpenFreezerSettingsTitle: 'Open Settings',
    tutorialStepOpenFreezerSettingsBody: 'Tap the gear in the top-right of the side panel. The switch for `Freezer feature` lives there.',
    tutorialStepOpenFreezerSettingsHint: 'So the freezer switch is not on the customer card itself, but in Settings.',
    tutorialStepEnableFreezerTitle: 'Look at `Freezer feature`',
    tutorialStepEnableFreezerBody: (enabled) => enabled
      ? '`Freezer feature` is already on here now. Take a moment to see where this switch lives, then tap `Continue`.'
      : 'Turn `Freezer feature` on now. After that, the same customer card can keep `Cooler` and `Freezer` separate.',
    tutorialStepEnableFreezerHint: (enabled) => enabled
      ? 'That way you know where to find it again later.'
      : 'Once it is on, `Cooler` and `Freezer` appear as separate targets on the card.',
    tutorialStepCloseFreezerPanelTitle: 'Close the side panel again',
    tutorialStepCloseFreezerPanelBody: 'Tap the dark area next to the side panel again so you return to the customer card.',
    tutorialStepCloseFreezerPanelHint: 'This takes you straight back from Settings into the counting flow.',
    tutorialStepBackToDeliveredTitle: 'Go back to Delivered',
    tutorialStepBackToDeliveredBody: (customerName) => `The card for \`${customerName}\` is still on \`Return\`. Tap \`Delivered\` again now, because the freezer unit belongs to the delivered side.`,
    tutorialStepBackToDeliveredHint: 'The freezer split works in `Delivered`, not in `Return`.',
    tutorialStepFreezerStorageTitle: 'Choose `Freezer` on the card now',
    tutorialStepFreezerStorageBody: 'At the top of the selected card, you now see `Cooler` and `Freezer`. Tap `Freezer` so the next line goes there.',
    tutorialStepFreezerStorageHint: 'This is how you send something specifically to the freezer unit without needing a separate customer card.',
    tutorialStepFreezerCommandTitle: 'Save something for the freezer unit',
    tutorialStepFreezerCommandBody: 'Oh, do not forget the freezer crates. For this customer you still have `2k 1r` for the freezer unit. Send it so that part is stored separately under `Freezer`.',
    tutorialStepFreezerCommandHint: 'You are still typing normal input here; because `Freezer` is active, it lands in the right place.',
    tutorialStepReviewFreezerCommandTitle: 'Review the separate freezer count',
    tutorialStepReviewFreezerCommandBody: (customerName) => `On the card for \`${customerName}\`, you now see \`Cooler\` and \`Freezer\` separately. Take a moment to see how \`2k 1r\` sits under \`Freezer\`, while the small freezer reminder stays visible too.`,
    tutorialStepReviewFreezerCommandHint: 'Seen the separate freezer unit? Tap `Continue`.',
    tutorialStepSecondCustomerTitle: 'Add 1 more customer',
    tutorialStepSecondCustomerBody: (customerName) => `You now notice another customer also has freezer crates. At the bottom of the list, \`${customerName}\` is already filled in. Press Enter or Go to create this second customer.`,
    tutorialStepSecondCustomerHint: 'This also teaches you that adding another customer mid-route stays simple.',
    tutorialStepSelectSecondCustomerTitle: 'Select the second customer',
    tutorialStepSelectSecondCustomerBody: (customerName) => `The card for \`${customerName}\` is now in the route too. Tap that card once to select it.`,
    tutorialStepSelectSecondCustomerHint: 'After that, you can go straight back into `Delivered` for the new customer.',
    tutorialStepSecondCustomerModeTitle: 'Choose Delivered again',
    tutorialStepSecondCustomerModeBody: (customerName) => `The card for \`${customerName}\` is selected. Tap \`Delivered\` so you can enter the full count for this customer in 1 line.`,
    tutorialStepSecondCustomerModeHint: 'Even for a new customer, you first choose where the input should go.',
    tutorialStepSecondCustomerCommandTitle: 'Send cooler and freezer in 1 line',
    tutorialStepSecondCustomerCommandBody: 'For this customer, you count 1 freezer crate, plus the rest of the container as `1c 20k`. So type `1kv 1c 20k` in 1 line and send it on `Delivered`.',
    tutorialStepSecondCustomerCommandHint: 'Here `1kv` sends 1 crate to `Freezer`, while `1c 20k` stays on `Cooler`.',
    tutorialStepReviewSecondCustomerCommandTitle: 'Review how that 1 line was split',
    tutorialStepReviewSecondCustomerCommandBody: (customerName) => `On the card for \`${customerName}\`, you now see 1 container and 20 crates in \`Cooler\`, plus 1 separate crate in \`Freezer\`. That is how mixed input in 1 line works.`,
    tutorialStepReviewSecondCustomerCommandHint: 'Can you see that \`1kv\` landed separately while the rest stayed on \`Cooler\`? Tap `Continue`.',
    tutorialStepRenameTitle: 'Rename the customer',
    tutorialStepRenameBody: (customerName, renamedName) => `The card for \`${customerName}\` is already selected. Tap the name once to open editing, then rename it to something simple, for example \`${renamedName}\`.`,
    tutorialStepRenameHint: 'Save the new name with Enter.',
    tutorialStepReviewRenameTitle: 'Review the new name',
    tutorialStepReviewRenameBody: (renamedName) => `The card is now called \`${renamedName}\`. Take a moment to notice how the new name appears on the same card right away.`,
    tutorialStepReviewRenameHint: 'Seen it? Tap `Continue`.',
    tutorialStepTimestampTitle: 'Tap `Last modified`',
    tutorialStepTimestampBody: 'Under the card title, you see the full `Last modified` row. Tap there 3 times so you can see the time switch here and in mini-history together between `... ago` and the exact time.',
    tutorialStepTimestampHint: 'Look in 2 places on purpose: above at `Last modified` and below in mini-history.',
    tutorialStepReviewTimestampTitle: 'Review the time switch in 2 places',
    tutorialStepReviewTimestampBody: 'You just saw that the same time display switches above and below at the same time. Take 1 more calm look at both places.',
    tutorialStepReviewTimestampHint: 'Seen the difference? Tap `Continue`.',
    tutorialStepMiniHistoryTitle: 'Switch `Total` and `Input` in mini-history',
    tutorialStepMiniHistoryBody: 'At the bottom of this selected card, you see mini-history with your 2 earlier entries. Tap the history value 3 times so `Total` and `Input` switch for both rows.',
    tutorialStepMiniHistoryHint: 'Look at the whole mini-history block, not only 1 small value.',
    tutorialStepReviewMiniHistoryTitle: 'Review mini-history once more',
    tutorialStepReviewMiniHistoryBody: 'Your 2 earlier entries are shown together here. Take 1 more look at how those same rows can switch between `Total` and `Input`.',
    tutorialStepReviewMiniHistoryHint: 'Seen both states? Tap `Continue`.',
    tutorialStepFinalReviewTitle: 'Take 1 last look at what you built',
    tutorialStepFinalReviewBody: 'You have now seen 2 customers, Delivered, Return, freezer input, timestamps, and mini-history together on the screen. Take 1 calm final look before cleaning up the practice route again.',
    tutorialStepFinalReviewHint: 'Do you have a clear picture of what RoGo kept track of here? Tap `Continue`.',
    tutorialReviewToggleProgress: (remaining, total) => `${remaining} of ${total} switches left.`,
    tutorialStepOpenPanelTitle: 'Open the side panel yourself again',
    tutorialStepOpenPanelBody: 'Use the top-right button to open the side panel again.',
    tutorialStepOpenPanelHint: 'That is how you find your routes again.',
    tutorialStepOpenRouteMenuTitle: 'Open the three dots next to this route',
    tutorialStepOpenRouteMenuBody: (projectName) => `This shows that route actions also live directly next to \`${projectName}\` in the route list. Tap the three dots next to the route name.`,
    tutorialStepOpenRouteMenuHint: 'That menu can rename, open history, save as template, or delete the route.',
    tutorialStepDeleteTitle: 'Clean up the practice route',
    tutorialStepDeleteBody: 'Tap `Delete` in this route menu so the confirmation popup opens.',
    tutorialStepDeleteHint: 'You are not done yet: there is still 1 normal confirmation after this.',
    tutorialStepDeleteConfirmTitle: 'Confirm in the popup',
    tutorialStepDeleteConfirmBody: 'The delete popup is now open. Tap `Delete` there to really remove the practice route.',
    tutorialStepDeleteConfirmHint: 'This shows that deleting still has 1 extra safety check.',
    tutorialStepReviewDeleteTitle: 'Check that the practice route is gone',
    tutorialStepReviewDeleteBody: (routeName) => `Look in the side panel 1 more time: \`${routeName}\` should no longer be in your route list. That confirms the cleanup really worked.`,
    tutorialStepReviewDeleteHint: 'Once you have seen that the practice route is gone, tap `Continue`.',
    tutorialStepOpenFinalFreezerSettingsTitle: 'Open Settings 1 more time',
    tutorialStepOpenFinalFreezerSettingsBody: 'Before you finish, open Settings 1 more time. There you will choose how `Freezer feature` should stay after the tutorial.',
    tutorialStepOpenFinalFreezerSettingsHint: 'That makes the final choice happen in the same place where you will find it later.',
    tutorialStepFinalFreezerChoiceTitle: 'Choose how `Freezer feature` should stay',
    tutorialStepFinalFreezerChoiceBody: (enabled, initialEnabled) => {
      if (enabled && !initialEnabled) {
        return '`Freezer feature` is now on because of the tutorial. Leave it on if that helps your work, or turn it off again now. This choice will simply stay like this after the tutorial.';
      }
      if (enabled && initialEnabled) {
        return '`Freezer feature` was already on and is still on now. Leave it like this if it fits your work, or turn it off now. This choice will simply stay like this after the tutorial.';
      }
      if (!enabled && initialEnabled) {
        return '`Freezer feature` used to be on, but is off now. Leave it off if you do not need it right now, or turn it back on. This choice will simply stay like this after the tutorial.';
      }
      return '`Freezer feature` is off right now. Leave it off if you do not need it, or turn it on. This choice will simply stay like this after the tutorial.';
    },
    tutorialStepFinalFreezerChoiceHint: 'Want it later? Open `Settings` or search the side panel for `freezer`.',
    tutorialCompleteLabel: 'Finished',
    tutorialCompleteTitle: 'Tutorial finished',
    tutorialCompleteBody: 'You have now seen route creation, finding it again, closing and opening the side panel, adding 2 customers, using Delivered, finding and using the `Freezer feature`, seeing mixed input like `1kv 1c 20k` work, practicing Return in 1 line, renaming, tapping timestamps and mini-history, and deleting a route through the three-dot menu.',
    tutorialCompleteHint: 'Open Help again whenever you want to revisit input, tips, or less obvious flows.',
    tutorialFreezerChoiceKicker: 'Freezer feature',
    tutorialFreezerChoiceTitle: 'Keep the freezer feature on?',
    tutorialFreezerChoiceBody: 'During the tutorial, `Freezer feature` was turned on so you could practice `Cooler` and `Freezer`. Do you want to keep it on for now, or turn it off again?',
    tutorialFreezerChoiceDetail: 'Want it later? Open `Settings` or search the side panel for `freezer` to change it again.',
    tutorialFreezerChoiceKeep: 'Keep on',
    tutorialFreezerChoiceDisable: 'Turn off now',
    tutorialFreezerChoiceKept: 'Freezer feature stays on',
    tutorialFreezerChoiceDisabled: 'Freezer feature turned off again',
    tutorialClosed: 'Tutorial closed',
    tutorialCelebration: '🎉 Tutorial finished',
    syntaxHeroTitle: 'Read chips and suggestions like RoGo is thinking with you',
    syntaxHeroBody: 'Most important rule: type the number and item together, without a space. After that, you can type short or long forms.',
    syntaxImportantLabel: 'Important',
    syntaxOneWordTitle: 'Type number + item as 1 word',
    syntaxOneWordBody: 'Do not put a space between the number and the item. For example, if you count 15 crates on a container, type `15krat` instead of `15 krat`.',
    syntaxBracketLabel: 'Brackets',
    syntaxBracketTitle: 'Focus on what is inside the brackets',
    syntaxBracketBody: 'In a suggestion, the long name is mostly explanation. The part inside the brackets shows what you can actually type, like `krat`, `k`, or `g`.',
    syntaxSameItemLabel: 'Same item',
    syntaxSameItemTitle: 'Everything inside the brackets belongs to the same item',
    syntaxSameItemBody: 'With `(krat/k/g)`, you can type `15krat`, `15k`, or `15g`. RoGo treats all of them as the same item.',
    syntaxSameItemResult: 'These all point to:',
    syntaxSameItemHint: 'Just use the form that feels fastest to type. They all end up on the same item.',
    syntaxPartsLabel: 'Separate parts',
    syntaxPartsTitle: 'A space starts a new part',
    syntaxPartsBody: 'Use a space only between separate parts, for example `15k 1cont`. Inside 1 part, the number stays attached to the item.',
    syntaxPartsHint: 'So `15k 1cont` is fine, but `15 krat` is not.',
    syntaxPreviewLabel: 'Preview',
    syntaxPreviewTitle: 'The preview totals your whole line first',
    syntaxPreviewBody: 'The preview line adds up everything you type in that one line first. If you type `2cont 15krat 20krat 2rood`, the preview already shows 35 crates, 2 containers, and 2 red crates for the selected customer.',
    syntaxPreviewHint: 'The preview only shows what this one line is about to add. Nothing is saved yet here. If the preview looks wrong, fix the input first. It is only really saved after you tap `Send`.',
    syntaxPreviewCustomer: 'Sample customer',
    syntaxPreviewTypedLabel: 'You type',
    syntaxPreviewResultLabel: 'Preview becomes',
    syntaxAddsLabel: 'Keep counting',
    syntaxAddsTitle: 'Only type what you are adding now',
    syntaxAddsExistingLabel: 'This existing customer already has',
    syntaxAddsInputLabel: 'You type now',
    syntaxAddsAfterLabel: 'After Send it becomes',
    syntaxAddsBody: 'If this existing customer already shows 10 TotaalVERS crates and the next container has `15krat`, you only type `15krat`.',
    syntaxAddsHint: 'RoGo turns that into 25 TotaalVERS crates together. So do not type the new final total yourself, or you will count it twice.',
    syntaxReverseLabel: 'Order',
    syntaxReverseTitle: 'The number can also go after the item',
    syntaxReverseBody: 'You can also place the number after a short form, like `k5` or `cont1`. RoGo reads that the same as `5k` and `1cont`.',
    syntaxReverseHint: 'Useful if that feels faster on your keyboard.',
    syntaxCorrectionLabel: 'Minus',
    syntaxCorrectionTitle: 'Use a minus to correct right away',
    syntaxCorrectionExistingLabel: 'The card now shows',
    syntaxCorrectionInputLabel: 'You correct with',
    syntaxCorrectionAfterLabel: 'After Send it becomes',
    syntaxCorrectionBody: 'If you just counted too much, you do not need to clear anything. Just type a minus for the part that should come off, like `-5k`.',
    syntaxCorrectionHint: 'That keeps correcting as short as normal input.',
    syntaxLongLineLabel: 'Long line',
    syntaxLongLineTitle: 'Longer lines still stay clear',
    syntaxLongLineBody: 'You can combine multiple items and short forms in 1 line. RoGo first shows a chip for each part and then totals everything in the preview.',
    syntaxLongLineHint: 'Here, `15krat`, `20k`, and `10k` become 45 crates together, and `2cont` with `1c` becomes 3 containers.',
    syntaxFreezerLabel: 'Freezer',
    syntaxFreezerTitle: 'Cooler and freezer can stay in 1 line together',
    syntaxFreezerBody: 'If the freezer feature is on and you are in `Delivered`, you can put freezer parts in the same line right away, like `10k 2kf`.',
    syntaxFreezerHint: 'Think of `kf` from `freezer` or `kv` from `vriezer`. Both always work, no matter which app language you use. RoGo then puts that part under `Freezer` without needing 2 separate lines.',
    syntaxFreezerHintDisabled: 'This input only works once `Freezer feature` is enabled. There you will also see that both `kf` and `kv` work regardless of the app language. Open `Tips` to see where to find it and what it looks like.',
    syntaxFreezerJump: 'Open Tips about freezer',
    syntaxPracticeLabel: 'Try it',
    syntaxPracticeTitle: 'Try it yourself',
    syntaxPracticeBody: 'Temporarily use the real input field at the bottom of the app as a safe practice mode. Chips, suggestions, and preview behave normally, but nothing is saved.',
    syntaxPracticeActiveBody: 'Practice mode is on. The real input field at the bottom now works as a safe practice mode, so tapping `Send` will not save anything.',
    syntaxPracticePlaceholder: 'E.g. 2cont 15k 2rood',
    syntaxPracticeStart: 'Start typing below to see live chips and preview.',
    syntaxPracticeHint: 'RoGo closes Help and temporarily activates the real input field at the bottom. Stopping restores your normal selection afterwards.',
    syntaxPracticeActiveHint: 'You can type at the bottom and tap `Send` normally now. Nothing will touch real route data.',
    syntaxPracticeSubmitHint: 'Press Enter or Go to clear the field.',
    syntaxPracticeLastLabel: 'Last tried',
    syntaxPracticeToggleStart: 'Start practice mode',
    syntaxPracticeToggleStop: 'Stop practice mode',
    syntaxReadyLabel: 'Next step',
    syntaxReadyTitle: 'You are probably ready to start',
    syntaxReadyBody: 'If most of this tab makes sense now, you are ready to use the app normally. Pick a customer, tap `Delivered` or `Return`, and then type your count in the same short style.',
    syntaxReadyHint: (tutorialTabLabel) => `If this still feels a bit fast or you want to rehearse it safely first, open \`${tutorialTabLabel}\` for a short step-by-step route.`,
    syntaxDoLabel: 'Correct',
    syntaxDoBody: 'The number and item stay together, so RoGo understands it immediately.',
    syntaxDoHint: (itemLabel) => `RoGo reads this immediately as \`15x ${itemLabel}\`.`,
    syntaxDontLabel: 'Incorrect',
    syntaxDontBody: 'A space splits it into 2 separate pieces, which makes the entry fail.',
    syntaxExamples: [
      {
        command: '15kr',
        title: '`15kr` is still just short',
        body: 'RoGo can already guess the intent, so it shows suggestions for likely matches.'
      },
      {
        command: '2cont 15krat 20krat 2rood',
        title: 'Separate parts can stack',
        body: 'Multiple parts in one line are fine. Different item types can be mixed too, and the preview totals everything right away.',
        showSuggestions: false
      }
    ],
    syntaxSuggestionsLabel: 'Suggestions',
    syntaxChipsLabel: 'Chips',
    syntaxEmptySuggestions: 'No suggestions needed',
    syntaxRecapTitle: 'Quick recap',
    syntaxTips: [
      'Always keep the number and item together, without a space.',
      'Everything inside the brackets belongs to the same item, so use whichever form feels fastest.',
      'The number can also go after the item, like `k5` or `cont1`.',
      'Use a space only to start a new part, like `15k 1cont`.',
      'New lines add onto the existing total, so only type what you are adding now, not the new final total.',
      'Use a minus to correct right away, like `-5k`.',
      'With freezer on, you can use `kf` or `kv` in `Delivered`; both always work regardless of the app language.',
      'If the preview line looks wrong, fix the input first and only then tap `Send`.'
    ],
    tipsHeroTitle: 'Small smart things people usually discover later',
    tipsHeroBody: 'These are the less obvious features that make RoGo calmer and clearer in daily use. If you learn visually, it helps to pay attention to colors, small reminders, and fixed places in the app.',
    tipsOverviewTitle: 'Things that save effort later',
    tipsExampleLabel: 'Example',
    tipsVisualLabel: 'What it looks like',
    tips: [
      {
        badge: 'Order',
        title: '`5k` and `k5` mean the same thing',
        body: 'You do not have to stop and think whether the number should go before or after the item. RoGo understands both forms, so you can simply use whichever finger movement feels fastest and keep counting.',
        example: '`5k` = `k5` · `1cont` = `cont1`',
        exampleVisual: {
          type: 'sequence',
          parts: [
            { label: '5k', tone: 'accent' },
            { kind: 'sep', label: '=' },
            { label: 'k5', tone: 'accent' },
            { kind: 'sep', label: '·' },
            { label: '1cont', tone: 'accent' },
            { kind: 'sep', label: '=' },
            { label: 'cont1', tone: 'accent' }
          ]
        }
      },
      {
        badge: 'Correcting',
        title: 'Use `-5k` to remove it again',
        body: 'If you notice you counted too much, you do not need to clear anything first or recalculate it yourself. Just type a minus version, and RoGo removes that amount directly from the existing total.',
        example: '`20k` + `-5k` = 15 crates',
        exampleVisual: {
          type: 'sequence',
          parts: [
            { label: '20k', tone: 'accent' },
            { kind: 'sep', label: '+' },
            { label: '-5k', tone: 'danger' },
            { kind: 'sep', label: '=' },
            { label: '15 crates', tone: 'neutral' }
          ]
        }
      },
      {
        badge: 'Chips',
        title: 'Green means ready, amber means almost there',
        body: 'Think of the chips as live feedback while you type. Green means: RoGo already understands that part. Amber usually means: you are close, but it is still just too short. Red means: this part is still wrong or does not match anything yet.',
        example: 'Amber `15kr` -> green `15krat`',
        exampleVisual: {
          type: 'chips',
          items: [
            { label: '15kr', tone: 'warn' },
            { label: '15krat', tone: 'good' },
            { label: '15x', tone: 'bad' }
          ]
        }
      },
      {
        anchor: 'freezer',
        badge: 'Freezer',
        title: 'You can keep cooler and freezer separate',
        body: 'If you often drive a box truck with a separate freezer unit, turn this setting on. You then get separate `Cooler` and `Freezer` blocks, plus a small freezer reminder that stays visible on the card. So at a glance you might see `10k` under Cooler and `2k` under Freezer, while that small reminder also keeps showing `2k` so you do not lose that part while counting or walking the route. For quick input, think of `kf` from `freezer` or `kv` from `vriezer`; both always work regardless of the app language.',
        example: 'Freezer reminder stays at `2k`',
        exampleVisual: {
          type: 'freezer',
          mainLabel: 'Cooler',
          mainValue: '10k',
          freezerLabel: 'Freezer',
          freezerValue: '2k',
          reminder: '2k'
        }
      },
      {
        badge: 'Import',
        title: 'A Bezorgbaas screenshot can directly create new cards',
        body: 'This is useful when you do not want to retype an existing Bezorgbaas route by hand. Open the side panel first. In `Current route`, you can then use `Import from screenshot`. RoGo reads the names, shows them first, and then turns them into usable cards.'
      },
      {
        badge: 'Multi-select',
        title: 'Long-press selects more right away',
        body: 'Long-press is the fast way into working with multiple cards at once. You do not need to find a separate selection mode first: hold 1 card and RoGo jumps straight into selecting, copying, sharing, or deleting.'
      },
      {
        badge: 'Sharing',
        title: '`Export customers` gives readable text you can import again later',
        body: 'This is useful when you want to quickly share something through WhatsApp or text. If you want to share the whole route, open the side panel first and use `Export customers` in `Current route`. If you only want to share a few customers, hold 1 card and select only the customers you want to copy or share. The text stays readable for people, but you can also paste it back into `Import from text` later to restore those cards in RoGo.'
      },
      {
        badge: 'Time',
        title: 'Tap a timestamp to switch from `... ago` to the exact time',
        body: 'Timestamps first appear in a quick form like `... ago`, so you can instantly see how recent something is. Tap one if you want the exact time instead. That works on `Last modified`, in mini-history on the card, and in full history too.',
        example: '`12m ago` -> `03-12 08:42`',
        exampleVisual: {
          type: 'time',
          ageMs: 12 * 60 * 1000
        }
      },
      {
        badge: 'History',
        title: 'Tap a history value to switch between `Total` and `Input`',
        body: 'Sometimes you want to see what is currently on the card, and sometimes you want the exact text that was typed at that moment. Tap that history value to switch between those two views. This is especially useful when you want to check whether something was entered as one large command or as several smaller parts.',
        example: '`Total: 35 crates` <-> `Input: 15k 20k`',
        exampleVisual: {
          type: 'sequence',
          parts: [
            { label: 'Total: 35 crates', tone: 'history' },
            { kind: 'sep', label: '<->' },
            { label: 'Input: 15k 20k', tone: 'history' }
          ]
        }
      },
      {
        badge: 'Search',
        title: 'Use `Search history` to find older input fast',
        body: 'Open the side panel first. In `Current route`, you will then find `Search history`. There you see all changes for that route together in one place. Search by customer name, short input, or correction when you want to verify something without manually opening every card.'
      },
      {
        badge: 'Rename',
        title: 'Select the card first, then edit',
        body: 'This is intentionally designed to reduce mis-taps. The first tap only says: this card is active. Only the second tap on the name actually opens editing.'
      },
      {
        badge: 'Order',
        title: 'Use `Reorder` to match the real delivery order',
        body: 'Open the side panel first. In `Current route`, you can then use `Reorder` to move customer names up or down. This helps when the walking order changes or when you want the list to match the real order you visit customers. After that, the whole route reads more calmly because the card order matches the outside world again.'
      },
      {
        badge: 'Templates',
        title: 'Existing names switch straight to overwrite',
        body: 'Open the side panel first. In `Current route`, you can then use `Save as template`. If that name already exists, the dialog does not stay quiet. It immediately shows that you are about to overwrite, from how many customers to how many customers, and the button changes with it. That makes it much clearer that you are not accidentally creating a brand new template.'
      },
      {
        badge: 'Duplicate',
        title: 'Use `Duplicate route` to quickly copy everything that is already there',
        body: 'Open the side panel first. In `Current route`, you can use `Duplicate route`. This is useful when you want to use today’s route as the starting point for tomorrow, including customer names and current totals.'
      },
      {
        badge: 'Clear',
        title: '`Clear route totals` keeps your customer cards',
        body: 'Open the side panel first. In `Current route`, `Clear route totals` only resets delivered and return totals back to 0. The customer cards themselves stay in place. This is useful when you want to start over without rebuilding the whole route.'
      },
      {
        badge: 'Template route',
        title: 'Use `Use template` to start a new route faster',
        body: 'In `Routes`, you can start a new route directly from a template. You first see which customers are inside it and can still adjust the route name before RoGo creates it.'
      }
    ],
    rogoHeroTitle: 'Built for calmer counting',
    rogoHeroBody: 'RoGo lets your count land instantly, frees up your head, and puts everything in an order that already makes sense later in Bezorgbaas.',
    rogoHeroSlogan: 'From crate to total, without mental math.',
    rogoPrivacyLabel: 'Private & offline',
    rogoPrivacyTitle: 'Private, local, and on your terms',
    rogoPrivacyBody: 'RoGo runs on your own device. No required cloud and no online dependency. Use short work names, references, or made-up customer labels that you recognize at a glance; they do not have to match the real customer name or address 1 to 1. Once the app has been loaded or installed, it keeps working fully offline.',
    rogoPrivacyHint: 'Enter only what works for you, then keep counting even without internet.',
    rogoMentalLoadLabel: 'Less to remember',
    rogoMentalLoadTitle: 'Your head stays free for what is in front of you now',
    rogoMentalLoadBody: 'RoGo is built to remove mental work, not add more typing. You lock in each finished chunk right away, so you do not have to carry loose running totals while already looking at the next container.',
    rogoLayoutLabel: 'Familiar order',
    rogoLayoutTitle: 'The totals are already in the right order',
    rogoLayoutBody: 'RoGo intentionally follows the same item order you later see in Bezorgbaas. That means your count does not feel like a rough draft; it already looks close to something you can copy over.',
    rogoLayoutHint: 'What you build here already feels familiar and usable later.',
    rogoWhenLabel: 'When it helps most',
    rogoWhenTitle: 'The difference gets big once you have 4+ containers',
    rogoWhenBody: 'With 1 or 2 containers, memory often still works. Once there are more, running totals, distractions, and pace start stacking up fast. That is exactly where RoGo takes the heavy mental work out of counting.',
    rogoScenarioLabel: 'Example',
    rogoScenarioTitle: 'This is where you usually lose the count',
    rogoScenarioCountLabel: 'Your first 3 containers together `58 crates`',
    rogoScenarioBody: 'You are in container 4. Then your manager shouts your name. You look up, hear a quick hello, look back, and suddenly doubt whether you were at crate 5, 6, or 7. Worse, you may even start wondering whether those first `58 crates` were right at all. That is exactly the kind of moment where manual counting costs too much brainpower.',
    rogoScenarioHint: 'With RoGo, the earlier part is already safely locked in. You only need to continue from where you left off.',
    rogoQualityLabel: 'Extra ease',
    rogoQualityTitle: 'RoGo stays useful after the counting too',
    rogoQualityBody: 'It is not just the counting that feels calmer. Reviewing, correcting, and separating special cases feels smoother too, so the whole route works better, not only the counting moment itself.',
    rogoQualityHint: 'If the freezer feature is enabled, `Cooler` and `Freezer` also stay clearly separated while counting. Want to see examples? Open `Tips`.',
    rogoQualityHintDisabled: 'The freezer feature is optional and may still be off. Open `Tips` to see where to enable it and what you get from it.',
    rogoQualityJump: 'Open Tips about freezer',
    rogoQualityItems: [
      'History with timestamps shows earlier entries at a glance.',
      'If you enable the freezer feature, `Cooler` and `Freezer` stay clearly separate without extra mental math.',
      'Chips and preview surface doubt or mistakes before you tap `Send`.',
      'Corrections like `-5k` and quick variants like `k5` keep input short and flexible.'
    ],
    rogoAfterLabel: 'What RoGo changes',
    rogoAfterTitle: 'Your work rhythm becomes faster and calmer',
    rogoAfterBody: 'Count, lock it in quickly, move on. That keeps you working from what is in front of you now, not from a chain of earlier running totals you are still trying to remember.',
    rogoBenefitsLabel: 'In short',
    rogoBenefitsTitle: 'What that gives you in practice',
    rogoBenefits: [
      'Running totals are locked in before distractions get in the way.',
      'Your totals already match the Bezorgbaas order.',
      'History, timestamps, and freezer info stay easy to review later.',
      'Corrections stay short, fast, and free of extra recalculation.'
    ]
  }
};

const HELP_TUTORIAL_STEP_COUNT = 40;
const HELP_TUTORIAL_REVIEW_TOGGLE_COUNT = 3;
const HELP_TUTORIAL_GUIDE_MIN_HIDDEN_PX = 18;
const HELP_TUTORIAL_GUIDE_VISIBLE_RATIO_THRESHOLD = 0.96;
const HELP_TUTORIAL_FIRST_COMMAND = '5krat 1cont';
const HELP_TUTORIAL_SECOND_COMMAND = '2cont 15krat 20k 2rood';
const HELP_TUTORIAL_SECOND_CUSTOMER_COMMAND = '1kv 1c 20k';
const HELP_TUTORIAL_RETURN_COMMAND = '2c 44k 2c 33k 1bl 2bk';
const HELP_TUTORIAL_FREEZER_COMMAND = '2k 1r';
const HELP_TABS = ['syntax', 'tips', 'tutorial', 'rogo'];
const HELP_TAB_CTA_SCROLL_THRESHOLD = 0.9;
const TUTORIAL_MANUAL_CONTINUE_STEP_IDS = new Set([
  'review-project',
  'review-mode-selected',
  'review-first-command',
  'review-second-command',
  'review-freezer-command',
  'review-second-customer-command',
  'review-return-command',
  'review-renamed-customer',
  'review-card-timestamp',
  'review-mini-history',
  'review-before-delete',
  'review-route-deleted',
  'final-freezer-choice'
]);

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

function getHelpCopy() {
  const lang = getLang();
  return HELP_COPY[lang] || HELP_COPY.en;
}

function getHelpCliPracticeContext(copy = getHelpCopy()) {
  return {
    groupName: copy.syntaxPreviewCustomer,
    mode: 'geleverd',
    storage: 'main'
  };
}

function buildHelpCliPracticeSnapshot() {
  return {
    projectId: getCurrentProject(),
    selectedGroup,
    selectedMode,
    selectedStorage,
    selectionMode,
    selectedGroupIds: [...selectedGroupIds],
    cmdValue: String(cmd?.value || '')
  };
}

function syncCliPracticeUI() {
  const active = !!helpCliPracticeState.active;
  if (cliPracticeBanner) cliPracticeBanner.classList.toggle('hidden', !active);
  if (cliPracticeKicker) cliPracticeKicker.textContent = t('cliPracticeActive');
  if (cliPracticeSub) cliPracticeSub.textContent = t('cliPracticeSub');
  if (cliPracticeToggleBtn) cliPracticeToggleBtn.textContent = t('cliPracticeStop');
  cliContainer?.classList.toggle('practice-active', active);
}

async function stopHelpCliPractice({
  silent = false,
  reopenHelp = true
} = {}) {
  if (!helpCliPracticeState.active) return;

  const snapshot = helpCliPracticeState.snapshot;
  helpCliPracticeState = {
    active: false,
    snapshot: null
  };

  if (snapshot?.projectId && snapshot.projectId === getCurrentProject()) {
    selectedGroup = snapshot.selectedGroup || null;
    selectedMode = snapshot.selectedMode || null;
    selectedStorage = snapshot.selectedStorage || 'main';
    selectionMode = !!snapshot.selectionMode;
    selectedGroupIds = new Set(Array.isArray(snapshot.selectedGroupIds) ? snapshot.selectedGroupIds : []);
  } else {
    selectedGroup = null;
    selectedMode = null;
    selectedStorage = 'main';
    selectionMode = false;
    selectedGroupIds = new Set();
  }

  if (cmd) cmd.value = snapshot?.projectId === getCurrentProject() ? String(snapshot?.cmdValue || '') : '';
  if (suggestionsEl) suggestionsEl.innerHTML = '';
  chipsEl.innerHTML = '';
  preview.textContent = '';
  updateSelectionBarUI();
  syncCliPracticeUI();
  await load();
  cmd.dispatchEvent(new Event('input'));
  if (!silent) {
    feedback.textContent = t('cliPracticeStopped');
    clearFeedbackSoon(900);
  }
  if (!reopenHelp) {
    if (isHelpModalOpen()) renderHelpModal();
    return;
  }
  if (isHelpModalOpen()) {
    helpActiveTab = 'syntax';
    renderHelpModal();
    if (helpContent) helpContent.scrollTop = 0;
  } else {
    openHelpModal({ tab: 'syntax' });
  }
  requestAnimationFrame(() => {
    scrollHelpSyntaxPracticeCardIntoView();
  });
}

async function startHelpCliPractice() {
  if (helpCliPracticeState.active) return;

  if (tutorialState.active) {
    await stopTutorial({ cleanup: true, silent: true });
  }

  helpCliPracticeState = {
    active: true,
    snapshot: buildHelpCliPracticeSnapshot()
  };

  cancelLongPress();
  selectionMode = false;
  selectedGroupIds = new Set();
  const context = getHelpCliPracticeContext();
  selectedGroup = context.groupName;
  selectedMode = context.mode;
  selectedStorage = context.storage;

  if (cmd) cmd.value = '';
  if (suggestionsEl) suggestionsEl.innerHTML = '';
  chipsEl.innerHTML = '';
  preview.textContent = '';
  syncCliPracticeUI();
  closeHelpModal();
  await load();
  cmd.dispatchEvent(new Event('input'));
  feedback.textContent = t('cliPracticeStarted');
  focusCmdSoon();
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

function refreshCurrentRouteActionButtonsState() {
  if (!currentRouteDeleteBtn) return;
  const disableDelete = readProjects().length <= 1 || !getCurrentRouteRecord();
  currentRouteDeleteBtn.disabled = disableDelete;
  currentRouteDeleteBtn.setAttribute('aria-disabled', disableDelete ? 'true' : 'false');
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

function isAllTotalsVisible() {
  return localStorage.getItem(ALL_TOTALS_VISIBLE_KEY) === '1';
}

function setAllTotalsVisible(v) {
  localStorage.setItem(ALL_TOTALS_VISIBLE_KEY, v ? '1' : '0');
}

function isHelpSectionAtBottom() {
  return localStorage.getItem(HELP_SECTION_BOTTOM_KEY) === '1';
}

function setHelpSectionAtBottom(v) {
  localStorage.setItem(HELP_SECTION_BOTTOM_KEY, v ? '1' : '0');
}

function clampFontScaleStep(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(FONT_SCALE_MIN_STEP, Math.min(FONT_SCALE_MAX_STEP, Math.round(num)));
}

function getFontScaleStep() {
  return clampFontScaleStep(localStorage.getItem(FONT_SCALE_STEP_KEY) || 0);
}

function setFontScaleStep(step) {
  localStorage.setItem(FONT_SCALE_STEP_KEY, String(clampFontScaleStep(step)));
}

function getFontScalePercent(step = getFontScaleStep()) {
  const clamped = clampFontScaleStep(step);
  return FONT_SCALE_BASE_PERCENT * (1 + (clamped * FONT_SCALE_STEP_FACTOR));
}

function applyFontScaleSetting() {
  const step = getFontScaleStep();
  document.documentElement.style.fontSize = `${getFontScalePercent(step).toFixed(3)}%`;
  if (fontSizeRange) fontSizeRange.value = String(step);
  if (fontSizeValue) fontSizeValue.textContent = t('fontSizeValue', step);
}

function normalizeAliasInputValue(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '').trim();
}

const ALIAS_SETTINGS_MAX_LENGTH = 24;

function normalizeAliasList(values = []) {
  const seen = new Set();
  const aliases = [];
  for (const value of Array.isArray(values) ? values : []) {
    const alias = normalizeAliasInputValue(value);
    if (!alias || seen.has(alias)) continue;
    seen.add(alias);
    aliases.push(alias);
  }
  return aliases;
}

function getEditableTokenIds(defs = getTokenDefs()) {
  const source = defs && typeof defs === 'object' ? defs : DEFAULT_TOKENS;
  const ordered = TOKEN_ORDER.filter((id) => source[id] || DEFAULT_TOKENS[id]);
  const extras = Object.keys(source).filter((id) => !ordered.includes(id));
  return [...ordered, ...extras];
}

function getTokenAliasLabel(id, defs = getTokenDefs()) {
  return String(defs?.[id]?.name_nl || DEFAULT_TOKENS?.[id]?.name_nl || id).trim();
}

function buildAliasSettingsDraft(defs = getTokenDefs()) {
  const draft = {};
  for (const id of getEditableTokenIds(defs)) {
    draft[id] = normalizeAliasList(allAliasesFor(defs, id));
  }
  return draft;
}

function cloneAliasSettingsDraft(draft = aliasSettingsDraft) {
  const clone = {};
  for (const id of Object.keys(draft || {})) {
    clone[id] = normalizeAliasList(draft[id]);
  }
  return clone;
}

function aliasListsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function countCustomizedAliasItems(draft = buildAliasSettingsDraft(getTokenDefs())) {
  let changed = 0;
  for (const id of getEditableTokenIds(DEFAULT_TOKENS)) {
    const nextAliases = normalizeAliasList(draft?.[id] || []);
    const defaultAliases = normalizeAliasList(allAliasesFor(DEFAULT_TOKENS, id));
    if (!aliasListsEqual(nextAliases, defaultAliases)) changed += 1;
  }
  return changed;
}

function aliasSettingsDraftsEqual(a = {}, b = {}) {
  for (const id of getEditableTokenIds(DEFAULT_TOKENS)) {
    const left = normalizeAliasList(a?.[id] || []);
    const right = normalizeAliasList(b?.[id] || []);
    if (!aliasListsEqual(left, right)) return false;
  }
  return true;
}

function buildAliasSettingsEffectiveState(baseDraft = cloneAliasSettingsDraft(aliasSettingsDraft), defs = getTokenDefs()) {
  const pendingResult = collectPendingAliasDraft(baseDraft, defs);
  const draft = pendingResult.error
    ? cloneAliasSettingsDraft(baseDraft)
    : cloneAliasSettingsDraft(pendingResult.draft);
  const validation = pendingResult.error || validateAliasDraft(draft, defs);
  const hasChanges = !aliasSettingsDraftsEqual(draft, aliasSettingsBaselineDraft);
  return { draft, validation, hasChanges };
}

function buildAliasSettingsSummaryText(defs = getTokenDefs()) {
  const draft = buildAliasSettingsDraft(defs);
  return t('crateAliasesSub', countCustomizedAliasItems(draft), getEditableTokenIds(DEFAULT_TOKENS).length);
}

function findAliasDraftIssue(draft = aliasSettingsDraft, defs = getTokenDefs()) {
  const used = new Map();
  for (const id of getEditableTokenIds(DEFAULT_TOKENS)) {
    const aliases = normalizeAliasList(draft?.[id] || []);
    const name = getTokenAliasLabel(id, defs);
    if (!aliases.length) {
      return { type: 'required', id, name, alias: '' };
    }
    for (const alias of aliases) {
      if (!new RegExp(`^[a-z]{1,${ALIAS_SETTINGS_MAX_LENGTH}}$`).test(alias)) {
        return { type: 'letters', id, name, alias };
      }
      if (RESERVED_ALIAS_INPUTS.has(alias)) {
        return { type: 'reserved', id, name, alias };
      }
      const existing = used.get(alias);
      if (existing && existing !== id) {
        return {
          type: 'conflict',
          id,
          name,
          alias,
          otherId: existing,
          otherName: getTokenAliasLabel(existing, defs)
        };
      }
      used.set(alias, id);
    }
  }
  return null;
}

function validateAliasDraft(draft = aliasSettingsDraft, defs = getTokenDefs()) {
  const issue = findAliasDraftIssue(draft, defs);
  if (!issue) return '';
  if (issue.type === 'required') return t('aliasSettingsRequired', issue.name);
  if (issue.type === 'letters') return t('aliasSettingsLettersOnly');
  if (issue.type === 'reserved') return t('aliasSettingsReserved', issue.alias);
  if (issue.type === 'conflict') return t('aliasSettingsConflict', issue.alias, issue.otherName);
  return '';
}

function buildAliasSettingsPreviewMarkup() {
  return `
    <strong>${escapeHtml(t('aliasSettingsPreviewTitle'))}</strong>
    <br>
    ${escapeHtml(t('aliasSettingsPreviewBody'))}
  `;
}

function syncCrateAliasSettingSummary() {
  if (crateAliasesTitle) crateAliasesTitle.textContent = t('crateAliasesTitle');
  if (crateAliasesSub) crateAliasesSub.textContent = buildAliasSettingsSummaryText();
  if (openCrateAliasesBtn) openCrateAliasesBtn.textContent = t('crateAliasesEdit');
}

function focusAliasSettingsInput(tokenId, { select = false } = {}) {
  const id = String(tokenId || '').trim();
  if (!id || !aliasSettingsBackdrop) return;
  requestAnimationFrame(() => {
    const input = aliasSettingsBackdrop.querySelector(`.alias-settings-add-input[data-token-id="${id}"]`);
    if (!input) return;
    input.focus({ preventScroll: true });
    if (select) input.select();
  });
}

function syncAliasSettingsSaveButtonState({ includePendingInput = false } = {}) {
  if (!aliasSettingsSave) return;
  const defs = getTokenDefs();
  const { validation, hasChanges } = includePendingInput
    ? buildAliasSettingsEffectiveState(cloneAliasSettingsDraft(aliasSettingsDraft), defs)
    : {
        validation: validateAliasDraft(aliasSettingsDraft, defs),
        hasChanges: !aliasSettingsDraftsEqual(aliasSettingsDraft, aliasSettingsBaselineDraft)
      };
  aliasSettingsSave.disabled = !!validation || !hasChanges;
}

function renderAliasSettingsModal({ focusTokenId = '', selectInput = false } = {}) {
  const defs = getTokenDefs();
  const draft = cloneAliasSettingsDraft(aliasSettingsDraft);
  const validation = validateAliasDraft(draft, defs);
  const hasChanges = !aliasSettingsDraftsEqual(draft, aliasSettingsBaselineDraft);
  const error = aliasSettingsErrorMessage || validation;

  if (aliasSettingsKicker) aliasSettingsKicker.textContent = t('aliasSettingsKicker');
  if (aliasSettingsTitle) aliasSettingsTitle.textContent = t('aliasSettingsTitle');
  if (aliasSettingsSub) aliasSettingsSub.textContent = t('aliasSettingsSub');
  if (aliasSettingsPreview) aliasSettingsPreview.innerHTML = buildAliasSettingsPreviewMarkup();
  if (aliasSettingsList) {
    aliasSettingsList.innerHTML = getEditableTokenIds(DEFAULT_TOKENS).map((id) => {
      const aliases = normalizeAliasList(draft[id] || []);
      const firstAlias = aliases[0] || '';
      const isSelected = aliasSettingsSelectedTokenId === id;
      return `
        <section class="alias-settings-item ${isSelected ? 'is-selected' : ''}" data-token-id="${escapeHtml(id)}" aria-expanded="${isSelected ? 'true' : 'false'}">
          <div class="alias-settings-item-head">
            <div class="alias-settings-item-title">${escapeHtml(getTokenAliasLabel(id))}</div>
            <div class="alias-settings-item-meta">${escapeHtml(t('aliasSettingsTokenMeta'))}: <code>${escapeHtml(firstAlias)}</code></div>
          </div>
          <div class="alias-settings-chip-list">
            ${aliases.map((alias, index) => `
              <button
                class="alias-settings-chip ${index === 0 ? 'primary' : ''} ${isSelected ? 'is-removable' : ''}"
                type="button"
                ${isSelected ? `data-alias-action="remove" data-token-id="${escapeHtml(id)}" data-alias="${escapeHtml(alias)}" title="${escapeHtml(t('aliasSettingsRemove'))}" aria-label="${escapeHtml(`${t('aliasSettingsRemove')}: ${alias}`)}"` : ''}
              >
                <span class="alias-settings-chip-label">${escapeHtml(alias)}</span>
                ${isSelected ? '<span class="alias-settings-chip-remove-mark" aria-hidden="true">&times;</span>' : ''}
              </button>
            `).join('')}
          </div>
          ${isSelected ? `
            <div class="alias-settings-item-add">
              <input
                class="alias-settings-add-input"
                type="text"
                data-token-id="${escapeHtml(id)}"
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                enterkeyhint="done"
                maxlength="${ALIAS_SETTINGS_MAX_LENGTH}"
                placeholder="${escapeHtml(t('aliasSettingsAddPlaceholder'))}"
              />
              <button
                class="btn install-btn alias-settings-add-btn"
                type="button"
                data-alias-action="add"
                data-token-id="${escapeHtml(id)}"
              >${escapeHtml(t('aliasSettingsAdd'))}</button>
            </div>
          ` : ''}
        </section>
      `;
    }).join('');
  }
  if (aliasSettingsError) aliasSettingsError.textContent = error;
  if (aliasSettingsReset) {
    aliasSettingsReset.textContent = t('aliasSettingsRestore');
    aliasSettingsReset.disabled = countCustomizedAliasItems(draft) === 0;
  }
  if (aliasSettingsCancel) aliasSettingsCancel.textContent = t('cancel');
  if (aliasSettingsSave) {
    aliasSettingsSave.textContent = t('save');
    aliasSettingsSave.disabled = !!validation || !hasChanges;
  }
  if (focusTokenId) focusAliasSettingsInput(focusTokenId, { select: selectInput });
}

function openAliasSettingsModal() {
  if (!aliasSettingsBackdrop) return;
  aliasSettingsOpen = true;
  aliasSettingsDraft = buildAliasSettingsDraft();
  aliasSettingsBaselineDraft = cloneAliasSettingsDraft(aliasSettingsDraft);
  aliasSettingsSelectedTokenId = '';
  aliasSettingsErrorMessage = '';
  renderAliasSettingsModal();
  aliasSettingsBackdrop.classList.remove('hidden');
}

function closeAliasSettingsModal() {
  aliasSettingsOpen = false;
  aliasSettingsDraft = {};
  aliasSettingsBaselineDraft = {};
  aliasSettingsSelectedTokenId = '';
  aliasSettingsErrorMessage = '';
  aliasSettingsBackdrop?.classList.remove('keyboard-compact');
  aliasSettingsBackdrop?.classList.add('hidden');
  if (aliasSettingsError) aliasSettingsError.textContent = '';
}

function toggleAliasItemSelection(tokenId) {
  const id = String(tokenId || '').trim();
  if (!id) return;
  aliasSettingsSelectedTokenId = aliasSettingsSelectedTokenId === id ? '' : id;
  aliasSettingsErrorMessage = '';
  renderAliasSettingsModal();
}

function removeAliasFromDraft(tokenId, alias) {
  const id = String(tokenId || '').trim();
  const targetAlias = normalizeAliasInputValue(alias);
  const currentAliases = normalizeAliasList(aliasSettingsDraft?.[id] || []);
  if (!id || !currentAliases.includes(targetAlias)) return;
  if (currentAliases.length <= 1) {
    aliasSettingsErrorMessage = t('aliasSettingsRequired', getTokenAliasLabel(id));
    renderAliasSettingsModal({ focusTokenId: id });
    return;
  }
  aliasSettingsSelectedTokenId = id;
  aliasSettingsDraft = {
    ...aliasSettingsDraft,
    [id]: currentAliases.filter((value) => value !== targetAlias)
  };
  aliasSettingsErrorMessage = '';
  renderAliasSettingsModal({ focusTokenId: id });
}

function addAliasToDraft(tokenId, rawAlias) {
  const id = String(tokenId || '').trim();
  const alias = normalizeAliasInputValue(rawAlias);
  if (!id) return;
  if (!alias) {
    aliasSettingsErrorMessage = '';
    focusAliasSettingsInput(id);
    return;
  }
  if (!new RegExp(`^[a-z]{1,${ALIAS_SETTINGS_MAX_LENGTH}}$`).test(alias)) {
    aliasSettingsErrorMessage = t('aliasSettingsLettersOnly');
    renderAliasSettingsModal({ focusTokenId: id, selectInput: true });
    return;
  }
  if (RESERVED_ALIAS_INPUTS.has(alias)) {
    aliasSettingsErrorMessage = t('aliasSettingsReserved', alias);
    renderAliasSettingsModal({ focusTokenId: id, selectInput: true });
    return;
  }

  const currentAliases = normalizeAliasList(aliasSettingsDraft?.[id] || []);
  if (currentAliases.includes(alias)) {
    aliasSettingsErrorMessage = '';
    renderAliasSettingsModal({ focusTokenId: id, selectInput: true });
    return;
  }

  for (const otherId of getEditableTokenIds(DEFAULT_TOKENS)) {
    if (otherId === id) continue;
    if (normalizeAliasList(aliasSettingsDraft?.[otherId] || []).includes(alias)) {
      aliasSettingsErrorMessage = t('aliasSettingsConflict', alias, getTokenAliasLabel(otherId));
      renderAliasSettingsModal({ focusTokenId: id, selectInput: true });
      return;
    }
  }

  aliasSettingsDraft = {
    ...aliasSettingsDraft,
    [id]: [...currentAliases, alias]
  };
  aliasSettingsSelectedTokenId = id;
  aliasSettingsErrorMessage = '';
  renderAliasSettingsModal({ focusTokenId: id, selectInput: true });
}

function appendAliasToDraftState(draft, tokenId, rawAlias, defs = getTokenDefs()) {
  const id = String(tokenId || '').trim();
  const alias = normalizeAliasInputValue(rawAlias);
  if (!id) return { draft, error: '', focusTokenId: '' };
  if (!alias) return { draft, error: '', focusTokenId: id };
  if (!new RegExp(`^[a-z]{1,${ALIAS_SETTINGS_MAX_LENGTH}}$`).test(alias)) {
    return { draft, error: t('aliasSettingsLettersOnly'), focusTokenId: id };
  }
  if (RESERVED_ALIAS_INPUTS.has(alias)) {
    return { draft, error: t('aliasSettingsReserved', alias), focusTokenId: id };
  }

  const nextDraft = cloneAliasSettingsDraft(draft);
  const currentAliases = normalizeAliasList(nextDraft?.[id] || []);
  if (currentAliases.includes(alias)) {
    return { draft: nextDraft, error: '', focusTokenId: id };
  }

  for (const otherId of getEditableTokenIds(DEFAULT_TOKENS)) {
    if (otherId === id) continue;
    if (normalizeAliasList(nextDraft?.[otherId] || []).includes(alias)) {
      return {
        draft,
        error: t('aliasSettingsConflict', alias, getTokenAliasLabel(otherId, defs)),
        focusTokenId: id
      };
    }
  }

  nextDraft[id] = [...currentAliases, alias];
  return { draft: nextDraft, error: '', focusTokenId: id };
}

function collectPendingAliasDraft(baseDraft = cloneAliasSettingsDraft(aliasSettingsDraft), defs = getTokenDefs()) {
  let draft = cloneAliasSettingsDraft(baseDraft);
  if (!aliasSettingsBackdrop) return { draft, error: '', focusTokenId: '' };
  const inputs = [...aliasSettingsBackdrop.querySelectorAll('.alias-settings-add-input')];
  for (const input of inputs) {
    const rawValue = String(input.value || '');
    if (!normalizeAliasInputValue(rawValue)) continue;
    const result = appendAliasToDraftState(draft, input.dataset.tokenId, rawValue, defs);
    if (result.error) return result;
    draft = result.draft;
  }
  return { draft, error: '', focusTokenId: '' };
}

function isAliasSettingsOpen() {
  return !!(aliasSettingsOpen && aliasSettingsBackdrop && !aliasSettingsBackdrop.classList.contains('hidden'));
}

async function refreshTokenDrivenUI() {
  syncCrateAliasSettingSummary();
  if (isHelpModalOpen()) renderHelpModal();
  if (isAliasSettingsOpen()) renderAliasSettingsModal();
  if (!historyBackdrop?.classList.contains('hidden') && historyModalEvents.length) {
    renderHistoryListFromState();
  }
  await load();
  cmd.dispatchEvent(new Event('input'));
}

async function saveCrateAliasesFromModal() {
  const defs = getTokenDefs();
  const pendingResult = collectPendingAliasDraft(cloneAliasSettingsDraft(aliasSettingsDraft), defs);
  if (pendingResult.error) {
    aliasSettingsErrorMessage = pendingResult.error;
    if (aliasSettingsError) aliasSettingsError.textContent = pendingResult.error;
    focusAliasSettingsInput(pendingResult.focusTokenId, { select: true });
    return;
  }
  const draft = cloneAliasSettingsDraft(pendingResult.draft);
  const validation = validateAliasDraft(draft);
  if (validation) {
    aliasSettingsErrorMessage = validation;
    renderAliasSettingsModal();
    return;
  }
  resetTokenOverrides();
  for (const id of getEditableTokenIds(DEFAULT_TOKENS)) {
    const nextAliases = normalizeAliasList(draft[id] || []);
    const defaultAliases = normalizeAliasList(allAliasesFor(DEFAULT_TOKENS, id));
    if (aliasListsEqual(nextAliases, defaultAliases)) {
      continue;
    }
    setTokenOverride(id, {
      defaultRef: nextAliases[0],
      userRef: nextAliases[1] || nextAliases[0],
      aliases: nextAliases
    });
  }
  const persistedDraft = buildAliasSettingsDraft(getTokenDefs());
  if (!aliasSettingsDraftsEqual(persistedDraft, draft)) {
    aliasSettingsDraft = cloneAliasSettingsDraft(draft);
    aliasSettingsErrorMessage = t('error');
    renderAliasSettingsModal();
    return;
  }
  aliasSettingsDraft = cloneAliasSettingsDraft(persistedDraft);
  closeAliasSettingsModal();
  await refreshTokenDrivenUI();
  feedback.textContent = t('aliasSettingsSaved');
  clearFeedbackSoon(1100);
}

async function requestAliasSettingsSave() {
  if (aliasSettingsSaveInFlight || aliasSettingsSave?.disabled) return;
  aliasSettingsSaveInFlight = true;
  try {
    await saveCrateAliasesFromModal();
  } catch (error) {
    aliasSettingsErrorMessage = error?.message || String(error);
    renderAliasSettingsModal();
  } finally {
    aliasSettingsSaveInFlight = false;
  }
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

function getScreenshotImportTimeoutMs(fileCount = 1) {
  const count = Math.max(1, Math.floor(Number(fileCount) || 0));
  const extraMs = Math.max(0, count - 1) * SCREENSHOT_IMPORT_TIMEOUT_PER_IMAGE_MS;
  return Math.min(SCREENSHOT_IMPORT_TIMEOUT_MAX_MS, SCREENSHOT_IMPORT_TIMEOUT_BASE_MS + extraMs);
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

function setActiveScreenshotImportSession(session) {
  activeScreenshotImportSession = session || null;
  if (!session) clearScreenshotImportCancelHoldState();
  syncScreenshotLoadingCancelButtonUI();
}

function syncScreenshotLoadingCancelButtonUI() {
  if (!screenshotLoadingCancelBtn) return;

  const holding = screenshotCancelHoldStartedAt > 0;
  const hasActiveSession = !!activeScreenshotImportSession;
  screenshotLoadingCancelBtn.classList.toggle('is-holding', holding);

  if (!hasActiveSession) {
    screenshotLoadingCancelBtn.style.setProperty('--hold-progress', '0');
    screenshotLoadingCancelBtn.textContent = t('screenshotImportStop');
    screenshotLoadingCancelBtn.disabled = true;
    screenshotLoadingCancelBtn.setAttribute('aria-label', t('screenshotImportStop'));
    screenshotLoadingCancelBtn.setAttribute('title', t('screenshotImportStop'));
    return;
  }

  screenshotLoadingCancelBtn.disabled = !!activeScreenshotImportSession.cancelled;
  screenshotLoadingCancelBtn.setAttribute('title', t('screenshotImportStop'));

  if (!holding) {
    const idleLabel = t('screenshotImportStopHoldIdle', getResetHoldSecondsLabel(SCREENSHOT_IMPORT_CANCEL_HOLD_MS));
    screenshotLoadingCancelBtn.style.setProperty('--hold-progress', '0');
    screenshotLoadingCancelBtn.textContent = idleLabel;
    screenshotLoadingCancelBtn.setAttribute(
      'aria-label',
      `${t('screenshotImportStop')} · ${idleLabel}`
    );
    return;
  }

  const elapsed = performance.now() - screenshotCancelHoldStartedAt;
  const progress = Math.max(0, Math.min(1, elapsed / SCREENSHOT_IMPORT_CANCEL_HOLD_MS));
  const remainingLabel = getResetHoldSecondsLabel(SCREENSHOT_IMPORT_CANCEL_HOLD_MS - elapsed);
  screenshotLoadingCancelBtn.style.setProperty('--hold-progress', progress.toFixed(4));
  screenshotLoadingCancelBtn.textContent = t('screenshotImportStopHoldProgress', remainingLabel);
  screenshotLoadingCancelBtn.setAttribute(
    'aria-label',
    `${t('screenshotImportStop')} · ${t('screenshotImportStopHoldProgress', remainingLabel)}`
  );
}

function updateScreenshotLoadingModal(statusText, session = null) {
  if (screenshotLoadingStatus) screenshotLoadingStatus.textContent = String(statusText || '');
  if (screenshotLoadingTimeout) {
    const seconds = session
      ? getScreenshotImportRemainingSeconds(session)
      : Math.ceil(getScreenshotImportTimeoutMs(1) / 1000);
    screenshotLoadingTimeout.textContent = t('screenshotImportTimeoutHint', seconds);
  }
  syncScreenshotLoadingCancelButtonUI();
}

function getScreenshotImportTimeoutError() {
  return new Error(t('screenshotImportTimedOut'));
}

function getScreenshotImportCancelledError() {
  return new Error(t('screenshotImportCancelled'));
}

function getScreenshotImportSessionError(session) {
  return session?.cancelReason === 'cancelled'
    ? getScreenshotImportCancelledError()
    : getScreenshotImportTimeoutError();
}

function createScreenshotImportSession(fileCount = 1) {
  const timeoutMs = getScreenshotImportTimeoutMs(fileCount);
  const session = {
    cancelled: false,
    cancelReason: '',
    deadline: Date.now() + timeoutMs,
    timeoutMs,
    countdownId: 0,
    cancelReject: null,
    cancelPromise: null
  };
  session.cancelPromise = new Promise((_, reject) => {
    session.cancelReject = reject;
  });

  openScreenshotLoadingModal();
  setActiveScreenshotImportSession(session);
  updateScreenshotLoadingModal(t('screenshotImportLoadingEngine'), session);
  session.countdownId = window.setInterval(() => {
    if (session.cancelled) return;
    updateScreenshotLoadingModal(screenshotLoadingStatus?.textContent || '', session);
  }, 250);
  return session;
}

function cancelScreenshotImportSession(session, reason = 'cancelled') {
  if (!session || session.cancelled) return;
  session.cancelled = true;
  session.cancelReason = reason;
  clearScreenshotImportCancelHoldState();
  if (session.cancelReject) {
    const reject = session.cancelReject;
    session.cancelReject = null;
    reject(getScreenshotImportSessionError(session));
  }
  if (session.countdownId) {
    clearInterval(session.countdownId);
    session.countdownId = 0;
  }
  if (activeScreenshotImportSession === session) {
    setActiveScreenshotImportSession(null);
  }
  closeScreenshotLoadingModal();
}

function clearScreenshotImportCancelHoldState() {
  if (screenshotCancelHoldTimer) clearTimeout(screenshotCancelHoldTimer);
  if (screenshotCancelHoldFrame) cancelAnimationFrame(screenshotCancelHoldFrame);
  screenshotCancelHoldTimer = null;
  screenshotCancelHoldFrame = 0;
  screenshotCancelHoldStartedAt = 0;
  screenshotCancelHoldPointerId = null;
  screenshotCancelHoldStartX = 0;
  screenshotCancelHoldStartY = 0;
  screenshotCancelHoldKey = '';
  syncScreenshotLoadingCancelButtonUI();
}

function tickScreenshotImportCancelButtonUI() {
  if (!screenshotCancelHoldStartedAt) return;
  syncScreenshotLoadingCancelButtonUI();
  screenshotCancelHoldFrame = requestAnimationFrame(tickScreenshotImportCancelButtonUI);
}

function startScreenshotImportCancelHold({ pointerId = null, clientX = 0, clientY = 0, key = '' } = {}) {
  if (!screenshotLoadingCancelBtn || !activeScreenshotImportSession || screenshotCancelHoldStartedAt || screenshotLoadingCancelBtn.disabled) return;

  screenshotCancelHoldStartedAt = performance.now();
  screenshotCancelHoldPointerId = Number.isFinite(pointerId) ? pointerId : null;
  screenshotCancelHoldStartX = Number(clientX) || 0;
  screenshotCancelHoldStartY = Number(clientY) || 0;
  screenshotCancelHoldKey = key;

  if (screenshotCancelHoldPointerId != null && typeof screenshotLoadingCancelBtn.setPointerCapture === 'function') {
    try {
      screenshotLoadingCancelBtn.setPointerCapture(screenshotCancelHoldPointerId);
    } catch {}
  }

  syncScreenshotLoadingCancelButtonUI();
  screenshotCancelHoldFrame = requestAnimationFrame(tickScreenshotImportCancelButtonUI);
  screenshotCancelHoldTimer = setTimeout(() => {
    const session = activeScreenshotImportSession;
    if (screenshotLoadingCancelBtn && screenshotCancelHoldPointerId != null && typeof screenshotLoadingCancelBtn.hasPointerCapture === 'function' && screenshotLoadingCancelBtn.hasPointerCapture(screenshotCancelHoldPointerId)) {
      try {
        screenshotLoadingCancelBtn.releasePointerCapture(screenshotCancelHoldPointerId);
      } catch {}
    }
    clearScreenshotImportCancelHoldState();
    navigator.vibrate?.(16);
    cancelScreenshotImportSession(session, 'cancelled');
  }, SCREENSHOT_IMPORT_CANCEL_HOLD_MS);
}

function cancelScreenshotImportCancelHold() {
  if (!screenshotCancelHoldStartedAt) return;
  if (screenshotLoadingCancelBtn && screenshotCancelHoldPointerId != null && typeof screenshotLoadingCancelBtn.hasPointerCapture === 'function' && screenshotLoadingCancelBtn.hasPointerCapture(screenshotCancelHoldPointerId)) {
    try {
      screenshotLoadingCancelBtn.releasePointerCapture(screenshotCancelHoldPointerId);
    } catch {}
  }
  clearScreenshotImportCancelHoldState();
}

function handleScreenshotImportCancelPointerDown(e) {
  if (e.button !== 0) return;
  startScreenshotImportCancelHold({
    pointerId: e.pointerId,
    clientX: e.clientX,
    clientY: e.clientY
  });
}

function handleScreenshotImportCancelPointerMove(e) {
  if (!screenshotCancelHoldStartedAt || screenshotCancelHoldPointerId == null || e.pointerId !== screenshotCancelHoldPointerId) return;
  const dx = Math.abs(e.clientX - screenshotCancelHoldStartX);
  const dy = Math.abs(e.clientY - screenshotCancelHoldStartY);
  if (dx > RESET_HOLD_MOVE_TOLERANCE_PX || dy > RESET_HOLD_MOVE_TOLERANCE_PX) cancelScreenshotImportCancelHold();
}

function handleScreenshotImportCancelKeyDown(e) {
  if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return;
  e.preventDefault();
  startScreenshotImportCancelHold({ key: e.key });
}

function handleScreenshotImportCancelKeyUp(e) {
  if (!screenshotCancelHoldStartedAt || !screenshotCancelHoldKey || e.key !== screenshotCancelHoldKey) return;
  e.preventDefault();
  cancelScreenshotImportCancelHold();
}

function finishScreenshotImportSession(session) {
  if (session?.countdownId) {
    clearInterval(session.countdownId);
    session.countdownId = 0;
  }
  if (session) {
    session.cancelReject = null;
  }
  if (activeScreenshotImportSession === session) {
    setActiveScreenshotImportSession(null);
  }
  closeScreenshotLoadingModal();
}

function isScreenshotImportTimeoutError(error) {
  return String(error?.message || '') === t('screenshotImportTimedOut');
}

function isScreenshotImportCancelledError(error) {
  return String(error?.message || '') === t('screenshotImportCancelled');
}

function assertScreenshotImportSession(session) {
  if (!session) return;
  if (session.cancelled || Date.now() >= Number(session.deadline || 0)) {
    if (!session.cancelled) {
      session.cancelled = true;
      session.cancelReason = 'timeout';
    }
    throw getScreenshotImportSessionError(session);
  }
}

async function runWithScreenshotImportTimeout(session, promise) {
  assertScreenshotImportSession(session);
  const remainingMs = Math.max(0, Number(session.deadline || 0) - Date.now());
  if (remainingMs <= 0) {
    session.cancelled = true;
    session.cancelReason = 'timeout';
    throw getScreenshotImportTimeoutError();
  }

  let timerId = 0;
  try {
    return await Promise.race([
      promise,
      session.cancelPromise,
      new Promise((_, reject) => {
        timerId = window.setTimeout(() => {
          session.cancelled = true;
          session.cancelReason = 'timeout';
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
      if (isScreenshotImportTimeoutError(error) || isScreenshotImportCancelledError(error)) throw error;
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

function formatEventTotalsInline(evt, defs = getTokenDefs()) {
  return TOKEN_ORDER
    .map((k) => ({ k, v: Number(evt?.[k] || 0) }))
    .filter((x) => x.v !== 0)
    .map((x) => `${x.v > 0 ? '+' : ''}${x.v}${displayKey(defs, x.k)}`)
    .join(' ');
}

function getEventSavedInput(evt) {
  return String(evt?.input || '').trim();
}

function buildHistoryValueText(value, { labeled = false, showInput = false } = {}) {
  const text = String(value || '').trim() || '-';
  if (!labeled) return text;
  return `${showInput ? t('inputLabel') : t('total')}: ${text}`;
}

function renderHistoryValueMarkup(totalText, inputText, { className = '', labeled = false } = {}) {
  const total = String(totalText || '-').trim() || '-';
  const input = String(inputText || '').trim();
  const toggleable = !!input && input !== total;
  const showInput = toggleable && historyInputMode === 'input';
  const text = buildHistoryValueText(showInput ? input : total, { labeled, showInput });
  const classes = [className, toggleable ? 'history-value-toggle' : 'history-value-static'].filter(Boolean).join(' ');

  if (!toggleable) {
    return `<span class="${classes}">${escapeHtml(text)}</span>`;
  }

  return `
    <button
      type="button"
      class="${classes}"
      data-total="${escapeHtml(total)}"
      data-input="${escapeHtml(input)}"
      data-labeled="${labeled ? '1' : '0'}"
      aria-pressed="${showInput ? 'true' : 'false'}"
    >${escapeHtml(text)}</button>
  `;
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
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
}

function fmtTsCompact(ts) {
  const d = new Date(Number(ts || 0));
  if (!Number.isFinite(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hour}:${minute}`;
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
  root.querySelectorAll('.help-live-ago').forEach((el) => {
    const ts = Number(el.dataset.ts || 0);
    el.textContent = formatAgo(ts);
  });
  if (tutorialState.active && !tutorialOverlay?.classList.contains('hidden')) {
    scheduleTutorialSpotlightSync();
  }
}

function getHistoryRefreshDelayMs() {
  const historyEls = [...document.querySelectorAll('.history-ts')];
  const helpEls = [...document.querySelectorAll('.help-live-ago')];
  const els = historyTimeMode === 'relative'
    ? [...historyEls, ...helpEls]
    : helpEls;
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

function refreshHistoryInputLabels(root = document) {
  root.querySelectorAll('.history-value-toggle').forEach((el) => {
    const total = String(el.dataset.total || '-').trim() || '-';
    const input = String(el.dataset.input || '').trim();
    const labeled = el.dataset.labeled === '1';
    const showInput = historyInputMode === 'input' && !!input;
    el.textContent = buildHistoryValueText(showInput ? input : total, { labeled, showInput });
    el.setAttribute('aria-pressed', showInput ? 'true' : 'false');
  });
}

function toggleHistoryInputMode() {
  historyInputMode = historyInputMode === 'total' ? 'input' : 'total';
  refreshHistoryInputLabels(document);
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
    const delta = formatEventTotalsInline(e, defs) || '-';
    const input = getEventSavedInput(e);

    return `<div class="mini-history-row"><span class="mh-ts history-ts" data-ts="${ts}" data-compact="1">${escapeHtml(formatHistoryTimestamp(ts, true))}</span><span class="mh-main">${escapeHtml(target)}</span>${renderHistoryValueMarkup(delta, input, { className: 'mh-delta' })}</div>`;
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
  if (!isAllTotalsVisible()) return '';
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
  if (helpCliPracticeState.active) {
    const context = getHelpCliPracticeContext();
    selectedGroup = context.groupName;
    selectedMode = context.mode;
    selectedStorage = context.storage;
  }

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

  const newGroupMarkup = `
    <div class="group new-group" data-name="">
      <input
        id="newGroupInput"
        class="group-title new-group-title"
        name="newGroupInput"
        placeholder="${t('newItemPlaceholder')}"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="words"
        inputmode="text"
        enterkeyhint="done"
        spellcheck="false"
      />
      <div class="new-sub">${t('pressEnter')}</div>
    </div>
  `;

  if (shouldPinTutorialNewGroupToTop()) {
    list.innerHTML += newGroupMarkup;
  }

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

  if (!shouldPinTutorialNewGroupToTop()) {
    list.innerHTML += newGroupMarkup;
  }

  updateSelectionBarUI();
  syncCliNameEditVisibility();

  cmd.disabled = !(selectedGroup && selectedMode);
  cmd.placeholder = selectedGroup
    ? selectedMode
      ? t('placeholderExample', selectedGroup, selectedMode)
      : t('selectMode')
    : t('selectItemFirst');

  refreshHistoryTimestampLabels(list);
  refreshHistoryInputLabels(list);
  scheduleHistoryRefresh();
  scheduleTutorialSpotlightSync();
}

let newGroupInputSubmitInFlight = false;

async function submitNewGroupInput(el) {
  if (!el || el.id !== 'newGroupInput' || newGroupInputSubmitInFlight) return false;

  const name = String(el.value || '').trim();
  if (!name) return false;
  const shouldRefocusNewGroupInput = !(
    tutorialState.active &&
    (
      getCurrentTutorialStep()?.id === 'create-customer' ||
      getCurrentTutorialStep()?.id === 'create-second-customer'
    )
  );

  newGroupInputSubmitInFlight = true;
  try {
    await ensureGroup(name);
    selectedGroup = null;
    selectedMode = null;
    selectedStorage = 'main';
    el.value = '';
    await load();
    scrollCardByNameToTopSoon(name);
    if (shouldRefocusNewGroupInput) focusNewGroupInputAtBottom();
    await notifyTutorialProgress('group-created', {
      projectId: getCurrentProject(),
      name
    });

    const fb = document.getElementById('feedback');
    if (fb) fb.textContent = t('added', name);
    if (navigator.vibrate) navigator.vibrate(10);
    return true;
  } catch (err) {
    alert(err?.message || String(err));
    return false;
  } finally {
    newGroupInputSubmitInFlight = false;
  }
}

list.addEventListener('keydown', async (e) => {
  const el = e.target;

  // Create new item card
  if (el && el.id === 'newGroupInput' && e.key === 'Enter') {
    e.preventDefault();
    await submitNewGroupInput(el);
    return;
  }

  // Rename existing group titles
  if (el && el.classList?.contains('group-title-input') && el.dataset?.id && e.key === 'Enter') {
    e.preventDefault();
    el.blur();
  }
});

list.addEventListener('beforeinput', async (e) => {
  const el = e.target;
  if (el?.id !== 'newGroupInput' || e.inputType !== 'insertLineBreak') return;
  e.preventDefault();
  await submitNewGroupInput(el);
});

list.addEventListener('blur', async (e) => {
  const el = e.target;
  if (el?.id === 'newGroupInput') {
    const stepId = getCurrentTutorialStep()?.id;
    const isTutorialCreateCustomerStep = stepId === 'create-customer' || stepId === 'create-second-customer';
    if (isTutorialCreateCustomerStep && String(el.value || '').trim()) {
      await submitNewGroupInput(el);
      return;
    }
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
    await notifyTutorialProgress('group-renamed', {
      projectId: getCurrentProject(),
      oldName,
      newName: saved
    });

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
  if (helpCliPracticeState.active) {
    e.preventDefault();
    return;
  }

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

  if (e.target.closest('.mini-history') || e.target.closest('.group-modified')) {
    e.preventDefault();
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
      void notifyTutorialProgress('group-selected', {
        projectId: getCurrentProject(),
        groupName: selectedGroup
      });
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
    void notifyTutorialProgress('storage-selected', {
      projectId: getCurrentProject(),
      groupName: selectedGroup,
      mode: selectedMode,
      storage: selectedStorage
    });
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
    void notifyTutorialProgress('mode-selected', {
      projectId: getCurrentProject(),
      groupName: selectedGroup,
      mode: selectedMode
    });
    load().then(() => {
      scrollSelectedCardToTopSoon();
      cmd.dispatchEvent(new Event('input'));
      if (tutorialState.active) {
        syncTutorialKeyboardMode();
      } else {
        focusCmdSoon();
      }
    });
    return;
  }

  selectedGroup = card.dataset.name;
  selectedMode = null;
  selectedStorage = 'main';
  feedback.textContent = '';
  void notifyTutorialProgress('group-selected', {
    projectId: getCurrentProject(),
    groupName: selectedGroup
  });
  load().then(() => {
    startModeHintPulse();
    cmd.dispatchEvent(new Event('input'));
  });
});

function cancelLongPress() {
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = null;
  longPressData = null;
}

list.addEventListener('pointerdown', (e) => {
  if (helpCliPracticeState.active) return;
  if (selectionMode) return;
  if (e.button !== 0) return;
  const card = e.target.closest('.group');
  if (!card || card.classList.contains('new-group')) return;
  if (e.target.closest('.mode') || e.target.closest('.storage-chip')) return;
  if (e.target.closest('.mini-history') || e.target.closest('.group-modified')) return;

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
  const cliPracticeActive = helpCliPracticeState.active;
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

  if (cliPracticeActive) {
    if (sendBtn) sendBtn.disabled = cmd.value.trim().length === 0;
    if (preview) preview.classList.remove('warn');
  } else {
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
      const p = problems[0];
      if (feedback) {
        feedback.textContent = t('tooLow', p.name, p.cur, p.next);
      }
      if (sendBtn) sendBtn.disabled = true;
      if (preview) preview.classList.add('warn');
    } else {
      if (sendBtn) sendBtn.disabled = cmd.value.trim().length === 0;
      if (preview) preview.classList.remove('warn');
    }
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
    const rawInput = String(cmd.value || '');
    if (!rawInput.trim()) return;

    if (helpCliPracticeState.active) {
      const context = getHelpCliPracticeContext();
      const parsedCommand = parseCliCommandInput(rawInput, {
        mode: context.mode,
        storage: context.storage
      });
      const practiceLine = buildActionLine(context.groupName, context.mode, context.storage, parsedCommand.totals, {
        storageTotals: parsedCommand.amountsByStorage,
        mixedStorage: parsedCommand.hasMixedStorage
      });
      feedback.textContent = t('cliPracticeSaved', practiceLine);

      preview.classList.remove('pulse');
      void preview.offsetWidth;
      preview.classList.add('pulse');

      hapticSuccess();

      cmd.value = '';
      if (suggestionsEl) suggestionsEl.innerHTML = '';
      chipsEl.innerHTML = '';
      preview.textContent = '';
      cmd.dispatchEvent(new Event('input'));
      focusCmdSoon();
      return;
    }

    const groupName = selectedGroup;
    const mode = selectedMode;
    const storage = activeStorageForMode(selectedMode, selectedStorage);
    const parsedCommand = await parseAndExecute(
      rawInput,
      groupName,
      mode,
      storage,
      { freezerEnabled: isFreezerEnabled() }
    );
    const savedLine = buildActionLine(groupName, mode, selectedStorage, parsedCommand.amounts, {
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
    await notifyTutorialProgress('command-sent', {
      projectId: getCurrentProject(),
      groupName,
      mode,
      storage,
      rawInput,
      parsedCommand
    });
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
  await notifyTutorialProgress('group-created', {
    projectId: getCurrentProject(),
    name
  });
};

function syncVisualViewport() {
  if (!window.visualViewport) {
    document.documentElement.style.setProperty('--vv-bottom', '0px');
    document.documentElement.style.setProperty('--vv-shift-y', '0px');
    syncTemplateCreateKeyboardMode();
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
    syncTemplateCreateKeyboardMode();
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
  syncTemplateCreateKeyboardMode();

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
    syncTemplateCreateKeyboardMode();
    syncHelpKeyboardMode();
    syncAliasSettingsKeyboardMode();
    return;
  }

  // When zoomed, offsets get weird. Keep it simple.
  if (vv.scale && Math.abs(vv.scale - 1) > 0.01) {
    document.documentElement.style.setProperty('--vv-top', '0px');
    document.documentElement.style.setProperty('--vv-h', '100vh');
    syncTemplateCreateKeyboardMode();
    syncHelpKeyboardMode();
    syncAliasSettingsKeyboardMode();
    return;
  }

  document.documentElement.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
  document.documentElement.style.setProperty('--vv-h', `${Math.round(vv.height)}px`);
  syncTemplateCreateKeyboardMode();
  syncHelpKeyboardMode();
  syncAliasSettingsKeyboardMode();
}

function isVisualViewportKeyboardOpen() {
  const vv = window.visualViewport;
  if (!vv) return false;
  if (vv.scale && Math.abs(vv.scale - 1) > 0.01) return false;
  return Math.max(0, window.innerHeight - vv.height) >= VIEWPORT_KEYBOARD_OPEN_THRESHOLD_PX;
}

function syncTemplateCreateKeyboardMode() {
  const backdrop = document.getElementById('templateCreateBackdrop');
  const nameInput = document.getElementById('templateCreateName');
  const compact = !!(
    backdrop &&
    !backdrop.classList.contains('hidden') &&
    nameInput &&
    document.activeElement === nameInput &&
    isVisualViewportKeyboardOpen()
  );
  backdrop?.classList.toggle('keyboard-compact', compact);
}

function syncAliasSettingsKeyboardMode() {
  const backdrop = document.getElementById('aliasSettingsBackdrop');
  const activeInput = document.activeElement instanceof HTMLElement
    ? document.activeElement.closest('.alias-settings-add-input')
    : null;
  const compact = !!(
    backdrop &&
    !backdrop.classList.contains('hidden') &&
    activeInput &&
    backdrop.contains(activeInput) &&
    isVisualViewportKeyboardOpen()
  );
  const wasCompact = backdrop?.classList.contains('keyboard-compact');
  backdrop?.classList.toggle('keyboard-compact', compact);
  if (compact && !wasCompact) {
    requestAnimationFrame(() => {
      activeInput?.closest('.alias-settings-item')?.scrollIntoView({
        block: 'start',
        inline: 'nearest'
      });
    });
  }
}

function scrollHelpSyntaxPracticeCardIntoView() {
  const card = document.getElementById('helpSyntaxPracticeCard');
  if (!card) return;
  card.scrollIntoView({ block: 'start', inline: 'nearest' });
}

function scrollHelpAnchorIntoView(anchor = '', { behavior = 'smooth' } = {}) {
  const safeAnchor = String(anchor || '').trim();
  if (!safeAnchor || !helpContent) return;
  const target = helpContent.querySelector(`[data-help-anchor="${safeAnchor}"]`);
  if (!target) return;
  target.scrollIntoView({ block: 'start', inline: 'nearest', behavior });
}

function syncHelpTabCtaUI() {
  const syntaxTabBtn = helpTabBar?.querySelector('.help-tab[data-tab="syntax"]');
  const tutorialTabBtn = helpTabBar?.querySelector('.help-tab[data-tab="tutorial"]');
  if (syntaxTabBtn) {
    const shouldGlowSyntax = helpActiveTab === 'rogo' && helpRogoSyntaxCtaReady;
    syntaxTabBtn.classList.toggle('help-tab-cta', shouldGlowSyntax);
  }
  if (tutorialTabBtn) {
    const shouldGlowTutorial = helpActiveTab === 'syntax' && helpSyntaxTutorialCtaReady;
    tutorialTabBtn.classList.toggle('help-tab-cta', shouldGlowTutorial);
  }
}

function syncHelpTabCtas() {
  const isHelpOpen = isHelpModalOpen() && !!helpContent;
  if (!isHelpOpen || !helpContent) {
    helpRogoSyntaxCtaReady = false;
    helpSyntaxTutorialCtaReady = false;
    syncHelpTabCtaUI();
    return;
  }
  const maxScroll = Math.max(0, helpContent.scrollHeight - helpContent.clientHeight);
  const progress = maxScroll > 0 ? helpContent.scrollTop / maxScroll : 1;

  if (helpActiveTab === 'rogo') {
    helpRogoSyntaxCtaReady = helpRogoSyntaxCtaReady || progress >= HELP_TAB_CTA_SCROLL_THRESHOLD;
    helpSyntaxTutorialCtaReady = false;
  } else if (helpActiveTab === 'syntax') {
    helpSyntaxTutorialCtaReady = helpSyntaxTutorialCtaReady || progress >= HELP_TAB_CTA_SCROLL_THRESHOLD;
    helpRogoSyntaxCtaReady = false;
  } else {
    helpRogoSyntaxCtaReady = false;
    helpSyntaxTutorialCtaReady = false;
  }

  syncHelpTabCtaUI();
}

function syncHelpKeyboardMode() {
  const backdrop = document.getElementById('helpBackdrop');
  const practiceInput = document.getElementById('helpSyntaxPracticeInput');
  const compact = !!(
    backdrop &&
    !backdrop.classList.contains('hidden') &&
    practiceInput &&
    document.activeElement === practiceInput &&
    isVisualViewportKeyboardOpen()
  );
  const wasCompact = backdrop?.classList.contains('keyboard-compact');
  backdrop?.classList.toggle('keyboard-compact', compact);
  if (compact && !wasCompact) {
    requestAnimationFrame(() => {
      scrollHelpSyntaxPracticeCardIntoView();
    });
  }
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
const fontSizeTitle = document.getElementById('fontSizeTitle');
const fontSizeSub = document.getElementById('fontSizeSub');
const fontSizeRange = document.getElementById('fontSizeRange');
const fontSizeValue = document.getElementById('fontSizeValue');
const cardLayoutTitle = document.getElementById('cardLayoutTitle');
const cardLayoutSub = document.getElementById('cardLayoutSub');
const allTotalsToggle = document.getElementById('allTotalsToggle');
const allTotalsSettingTitle = document.getElementById('allTotalsSettingTitle');
const allTotalsSettingSub = document.getElementById('allTotalsSettingSub');
const helpPositionTitle = document.getElementById('helpPositionTitle');
const helpPositionSub = document.getElementById('helpPositionSub');
const helpPositionToggle = document.getElementById('helpPositionToggle');
const freezerFeatureTitle = document.getElementById('freezerFeatureTitle');
const freezerFeatureSub = document.getElementById('freezerFeatureSub');
const freezerToggle = document.getElementById('freezerToggle');
const crateAliasesTitle = document.getElementById('crateAliasesTitle');
const crateAliasesSub = document.getElementById('crateAliasesSub');
const openCrateAliasesBtn = document.getElementById('openCrateAliasesBtn');
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
const screenshotLoadingCancelBtn = document.getElementById('screenshotLoadingCancelBtn');
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
const historySearchWrap = document.getElementById('historySearchWrap');
const historySearchInput = document.getElementById('historySearchInput');
const historyList = document.getElementById('historyList');
const closeHistory = document.getElementById('closeHistory');
const aliasSettingsBackdrop = document.getElementById('aliasSettingsBackdrop');
const aliasSettingsKicker = document.getElementById('aliasSettingsKicker');
const aliasSettingsTitle = document.getElementById('aliasSettingsTitle');
const aliasSettingsSub = document.getElementById('aliasSettingsSub');
const aliasSettingsPreview = document.getElementById('aliasSettingsPreview');
const aliasSettingsList = document.getElementById('aliasSettingsList');
const aliasSettingsError = document.getElementById('aliasSettingsError');
const aliasSettingsReset = document.getElementById('aliasSettingsReset');
const aliasSettingsCancel = document.getElementById('aliasSettingsCancel');
const aliasSettingsSave = document.getElementById('aliasSettingsSave');
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
const exportRouteTitle = document.getElementById('exportRouteTitle');
const exportRouteSub = document.getElementById('exportRouteSub');
const exportRouteBtn = document.getElementById('exportRouteBtn');
const duplicateRouteTitle = document.getElementById('duplicateRouteTitle');
const duplicateRouteSub = document.getElementById('duplicateRouteSub');
const duplicateRouteBtn = document.getElementById('duplicateRouteBtn');
const clearTotalsTitle = document.getElementById('clearTotalsTitle');
const clearTotalsSub = document.getElementById('clearTotalsSub');
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
const currentRouteDeleteTitle = document.getElementById('currentRouteDeleteTitle');
const currentRouteDeleteSub = document.getElementById('currentRouteDeleteSub');
const currentRouteDeleteBtn = document.getElementById('currentRouteDeleteBtn');
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
const helpSectionTitle = document.getElementById('helpSectionTitle');
const helpLaunchTitle = document.getElementById('helpLaunchTitle');
const helpLaunchSub = document.getElementById('helpLaunchSub');
const openHelpModalBtn = document.getElementById('openHelpModalBtn');
const helpBackdrop = document.getElementById('helpBackdrop');
const helpModalKicker = document.getElementById('helpModalKicker');
const helpModalTitle = document.getElementById('helpModalTitle');
const helpModalSub = document.getElementById('helpModalSub');
const helpTabBar = document.getElementById('helpTabBar');
const helpContent = document.getElementById('helpContent');
const closeHelpModalBtn = document.getElementById('closeHelpModalBtn');
const helpPrimaryActionBtn = document.getElementById('helpPrimaryActionBtn');
const tutorialOverlay = document.getElementById('tutorialOverlay');
const tutorialSpotlight = document.getElementById('tutorialSpotlight');
const tutorialSpotlightSecondary = document.getElementById('tutorialSpotlightSecondary');
const tutorialGuideArrow = document.getElementById('tutorialGuideArrow');
const tutorialPanel = document.getElementById('tutorialPanel');
const tutorialStepLabel = document.getElementById('tutorialStepLabel');
const tutorialStepTitle = document.getElementById('tutorialStepTitle');
const tutorialStepBody = document.getElementById('tutorialStepBody');
const tutorialStepHint = document.getElementById('tutorialStepHint');
const tutorialRepeatBtn = document.getElementById('tutorialRepeatBtn');
const tutorialEndBtn = document.getElementById('tutorialEndBtn');

let createProjectMode = 'new';
let createProjectModeMenuOpen = false;
let routeActionsMenuOpen = false;
let routeActionsSearchHits = 0;
let screenshotImportBusy = false;
let screenshotOcrEnginePromise = null;
let activeScreenshotImportSession = null;
let actionDialogResolver = null;
let panelOverflowMenuFrame = 0;
let templateCreateSelectedId = '';
let templateCreateSuggestedName = '';
let templateCreateNameDirty = false;
let actionDialogCleanup = null;
let resetHoldTimer = null;
let resetHoldFrame = 0;
let resetHoldStartedAt = 0;
let resetHoldPointerId = null;
let resetHoldStartX = 0;
let resetHoldStartY = 0;
let resetHoldKey = '';
let screenshotCancelHoldTimer = null;
let screenshotCancelHoldFrame = 0;
let screenshotCancelHoldStartedAt = 0;
let screenshotCancelHoldPointerId = null;
let screenshotCancelHoldStartX = 0;
let screenshotCancelHoldStartY = 0;
let screenshotCancelHoldKey = '';
let helpActiveTab = 'syntax';
let helpRogoSyntaxCtaReady = false;
let helpSyntaxTutorialCtaReady = false;
let helpPendingScrollAnchor = '';
let helpSyntaxPracticeValue = '';
let helpSyntaxPracticeLastSubmitted = '';
let helpIntroSeenSession = false;
let tutorialTargetEl = null;
let tutorialSecondaryTargetEl = null;
var tutorialSpotlightFrame = 0;
let tutorialStepSyncToken = 0;
let tutorialStepEnteredId = '';
let tutorialCelebrationShown = false;
let aliasSettingsOpen = false;
let aliasSettingsDraft = {};
let aliasSettingsBaselineDraft = {};
let aliasSettingsSelectedTokenId = '';
let aliasSettingsErrorMessage = '';
let aliasSettingsSaveInFlight = false;
let aliasSettingsSaveTouchStamp = 0;
let actionDialogAllowDismiss = true;
const TUTORIAL_SIDE_PANEL_REQUIRED_STEP_IDS = new Set([
  'create-project',
  'review-project',
  'open-settings-for-freezer',
  'enable-freezer-feature',
  'open-route-dots',
  'delete-route',
  'review-route-deleted',
  'open-settings-for-final-freezer',
  'final-freezer-choice'
]);
let tutorialState = {
  active: false,
  stepIndex: 0,
  originalProjectId: '',
  projectId: '',
  projectName: '',
  customerName: '',
  secondCustomerName: '',
  renamedCustomerName: '',
  initialFreezerEnabled: false,
  timestampToggleCount: 0,
  miniHistoryToggleCount: 0
};

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

function getResetHoldSecondsLabel(msRemaining = RESET_HOLD_MS) {
  const safeMs = Math.max(0, Number(msRemaining) || 0);
  const seconds = safeMs / 1000;
  return seconds >= 1 ? seconds.toFixed(1).replace(/\.0$/, '') : seconds.toFixed(1);
}

function syncResetHoldButtonUI() {
  if (!resetBtn) return;

  const idleSeconds = Math.ceil(RESET_HOLD_MS / 1000);
  const holding = resetHoldStartedAt > 0;
  resetBtn.classList.toggle('is-holding', holding);

  if (!holding) {
    resetBtn.style.setProperty('--hold-progress', '0');
    resetBtn.textContent = t('resetAppBtn');
    resetBtn.setAttribute('aria-label', `${t('resetAppBtn')} · ${t('resetAppHoldIdle', idleSeconds)}`);
    resetBtn.setAttribute('title', t('resetApp'));
    return;
  }

  const elapsed = performance.now() - resetHoldStartedAt;
  const progress = Math.max(0, Math.min(1, elapsed / RESET_HOLD_MS));
  const remainingLabel = getResetHoldSecondsLabel(RESET_HOLD_MS - elapsed);
  resetBtn.style.setProperty('--hold-progress', progress.toFixed(4));
  resetBtn.textContent = t('resetAppHoldProgress', remainingLabel);
  resetBtn.setAttribute('aria-label', `${t('resetApp')} · ${t('resetAppHoldProgress', remainingLabel)}`);
  resetBtn.setAttribute('title', t('resetApp'));
}

function clearResetHoldState() {
  if (resetHoldTimer) clearTimeout(resetHoldTimer);
  if (resetHoldFrame) cancelAnimationFrame(resetHoldFrame);
  resetHoldTimer = null;
  resetHoldFrame = 0;
  resetHoldStartedAt = 0;
  resetHoldPointerId = null;
  resetHoldStartX = 0;
  resetHoldStartY = 0;
  resetHoldKey = '';
  syncResetHoldButtonUI();
}

function tickResetHoldButtonUI() {
  if (!resetHoldStartedAt) return;
  syncResetHoldButtonUI();
  resetHoldFrame = requestAnimationFrame(tickResetHoldButtonUI);
}

function startResetHold({ pointerId = null, clientX = 0, clientY = 0, key = '' } = {}) {
  if (!resetBtn || resetHoldStartedAt || resetBtn.disabled) return;

  resetHoldStartedAt = performance.now();
  resetHoldPointerId = Number.isFinite(pointerId) ? pointerId : null;
  resetHoldStartX = Number(clientX) || 0;
  resetHoldStartY = Number(clientY) || 0;
  resetHoldKey = key;

  if (resetHoldPointerId != null && typeof resetBtn.setPointerCapture === 'function') {
    try {
      resetBtn.setPointerCapture(resetHoldPointerId);
    } catch {}
  }

  syncResetHoldButtonUI();
  resetHoldFrame = requestAnimationFrame(tickResetHoldButtonUI);
  resetHoldTimer = setTimeout(async () => {
    if (resetBtn && resetHoldPointerId != null && typeof resetBtn.hasPointerCapture === 'function' && resetBtn.hasPointerCapture(resetHoldPointerId)) {
      try {
        resetBtn.releasePointerCapture(resetHoldPointerId);
      } catch {}
    }
    clearResetHoldState();
    navigator.vibrate?.([16, 26, 16]);
    await resetAppDataAndReload();
  }, RESET_HOLD_MS);
}

function cancelResetHold() {
  if (!resetHoldStartedAt) return;
  if (resetBtn && resetHoldPointerId != null && typeof resetBtn.hasPointerCapture === 'function' && resetBtn.hasPointerCapture(resetHoldPointerId)) {
    try {
      resetBtn.releasePointerCapture(resetHoldPointerId);
    } catch {}
  }
  clearResetHoldState();
}

function handleResetHoldPointerDown(e) {
  if (e.button !== 0) return;
  startResetHold({
    pointerId: e.pointerId,
    clientX: e.clientX,
    clientY: e.clientY
  });
}

function handleResetHoldPointerMove(e) {
  if (!resetHoldStartedAt || resetHoldPointerId == null || e.pointerId !== resetHoldPointerId) return;
  const dx = Math.abs(e.clientX - resetHoldStartX);
  const dy = Math.abs(e.clientY - resetHoldStartY);
  if (dx > RESET_HOLD_MOVE_TOLERANCE_PX || dy > RESET_HOLD_MOVE_TOLERANCE_PX) cancelResetHold();
}

function handleResetHoldKeyDown(e) {
  if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return;
  e.preventDefault();
  startResetHold({ key: e.key });
}

function handleResetHoldKeyUp(e) {
  if (!resetHoldStartedAt || !resetHoldKey || e.key !== resetHoldKey) return;
  e.preventDefault();
  cancelResetHold();
}

function setActionDialogDetailsState(details = [], { compact = false } = {}) {
  if (!actionDialogDetails) return;
  const lines = Array.isArray(details) ? details : [];
  actionDialogDetails.classList.toggle('compact-warning', compact && lines.length > 0);
  actionDialogDetails.innerHTML = lines
    .filter(Boolean)
    .map((line) => {
      const isMore = String(line).startsWith('...');
      return `<div class="action-dialog-detail${isMore ? ' more' : ''}">${escapeHtml(line)}</div>`;
    })
    .join('');
}

function setActionDialogConfirmState({
  label = t('create'),
  tone = 'create',
  disabled = false
} = {}) {
  if (!actionDialogConfirm) return;
  actionDialogConfirm.textContent = label;
  actionDialogConfirm.classList.remove('create-btn', 'danger-btn', 'install-btn', 'cancel-btn', 'warning-btn');
  actionDialogConfirm.classList.add(
    tone === 'danger' ? 'danger-btn'
      : tone === 'install' ? 'install-btn'
        : tone === 'cancel' ? 'cancel-btn'
          : tone === 'warning' ? 'warning-btn'
            : 'create-btn'
  );
  actionDialogConfirm.disabled = !!disabled;
}

function cleanupActionDialogState() {
  if (typeof actionDialogCleanup === 'function') actionDialogCleanup();
  actionDialogCleanup = null;
  actionDialogModal?.classList.remove('state-overwrite');
  actionDialogDetails?.classList.remove('compact-warning');
  if (actionDialogConfirm) {
    actionDialogConfirm.disabled = false;
    actionDialogConfirm.classList.remove('warning-btn');
  }
}

function isHelpModalOpen() {
  return !!helpBackdrop && !helpBackdrop.classList.contains('hidden');
}

function hasSeenHelpIntro() {
  try {
    return localStorage.getItem(HELP_INTRO_SEEN_KEY) === '1';
  } catch {
    return helpIntroSeenSession;
  }
}

function markHelpIntroSeen() {
  helpIntroSeenSession = true;
  try {
    localStorage.setItem(HELP_INTRO_SEEN_KEY, '1');
  } catch {}
}

function getDefaultHelpOpenTab() {
  return hasSeenHelpIntro() ? 'syntax' : 'rogo';
}

function isTutorialComplete() {
  return tutorialState.active && tutorialState.stepIndex >= HELP_TUTORIAL_STEP_COUNT;
}

function formatHelpRichText(value) {
  return escapeHtml(String(value || '')).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function getTutorialProgressText(copy = getHelpCopy()) {
  if (!tutorialState.active) return copy.tutorialIdle;
  if (isTutorialComplete()) return copy.tutorialCompleteLabel;
  return copy.tutorialProgress(tutorialState.stepIndex + 1, HELP_TUTORIAL_STEP_COUNT);
}

function getTutorialReviewToggleRemaining(step = getCurrentTutorialStep()) {
  const stepId = typeof step === 'string' ? step : step?.id;
  if (stepId === 'toggle-card-timestamp') {
    return Math.max(0, HELP_TUTORIAL_REVIEW_TOGGLE_COUNT - Number(tutorialState.timestampToggleCount || 0));
  }
  if (stepId === 'toggle-mini-history') {
    return Math.max(0, HELP_TUTORIAL_REVIEW_TOGGLE_COUNT - Number(tutorialState.miniHistoryToggleCount || 0));
  }
  return 0;
}

function getTutorialHintText(step = getCurrentTutorialStep(), copy = getHelpCopy()) {
  const baseHint = String(step?.hint || '').trim();
  const remaining = getTutorialReviewToggleRemaining(step);
  if (!remaining) return baseHint;
  const progressHint = copy.tutorialReviewToggleProgress?.(remaining, HELP_TUTORIAL_REVIEW_TOGGLE_COUNT) || '';
  return [baseHint, progressHint].filter(Boolean).join(' ');
}

function isTutorialManualContinueStep(step = getCurrentTutorialStep()) {
  const stepId = typeof step === 'string' ? step : step?.id;
  if (stepId === 'enable-freezer-feature' && isFreezerEnabled()) return true;
  return TUTORIAL_MANUAL_CONTINUE_STEP_IDS.has(String(stepId || ''));
}

function tutorialStepRequiresSidePanel(step = getCurrentTutorialStep()) {
  const stepId = typeof step === 'string' ? step : step?.id;
  return TUTORIAL_SIDE_PANEL_REQUIRED_STEP_IDS.has(String(stepId || ''));
}

function getTutorialAreaLabel(step = getCurrentTutorialStep(), copy = getHelpCopy()) {
  const stepId = typeof step === 'string' ? step : step?.id;
  if (tutorialStepRequiresSidePanel(stepId)) return copy.tutorialAreaSidePanel;
  if (stepId === 'close-side-panel') return copy.tutorialAreaOutsidePanel;
  if (
    stepId === 'first-command' ||
    stepId === 'second-command' ||
    stepId === 'second-customer-command' ||
    stepId === 'return-command' ||
    stepId === 'freezer-command'
  ) return copy.tutorialAreaInput;
  return copy.tutorialAreaRoute;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getTutorialGuideEdgePoint(targetX, targetY, viewport, inset = 42) {
  const cx = viewport.left + (viewport.width / 2);
  const cy = viewport.top + (viewport.height / 2);
  let dx = targetX - cx;
  let dy = targetY - cy;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) dy = -1;

  const minX = viewport.left + inset;
  const maxX = viewport.left + viewport.width - inset;
  const minY = viewport.top + inset;
  const maxY = viewport.bottom - inset;
  const ratios = [];

  if (dx > 0) ratios.push((maxX - cx) / dx);
  else if (dx < 0) ratios.push((minX - cx) / dx);

  if (dy > 0) ratios.push((maxY - cy) / dy);
  else if (dy < 0) ratios.push((minY - cy) / dy);

  const t = ratios
    .filter((ratio) => Number.isFinite(ratio) && ratio >= 0)
    .reduce((best, ratio) => Math.min(best, ratio), Infinity);

  if (!Number.isFinite(t)) {
    return {
      x: clampNumber(cx, minX, maxX),
      y: clampNumber(cy, minY, maxY)
    };
  }

  return {
    x: clampNumber(cx + (dx * t), minX, maxX),
    y: clampNumber(cy + (dy * t), minY, maxY)
  };
}

function buildTutorialGuideArrowState({
  targetX,
  targetY,
  rect = null,
  viewport = getTutorialViewportMetrics(),
  action = 'show',
  label = '',
  title = '',
  mode = 'offscreen'
} = {}) {
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return null;

  const inset = viewport.width <= 720 ? 38 : 44;
  let x = targetX;
  let y = targetY;

  if (mode === 'visible-target' && rect) {
    const cx = viewport.left + (viewport.width / 2);
    const cy = viewport.top + (viewport.height / 2);
    let dx = targetX - cx;
    let dy = targetY - cy;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) dy = -1;
    const len = Math.hypot(dx, dy) || 1;
    const offset = clampNumber(Math.max(rect.width, rect.height) + 26, 52, 76);
    x = targetX + ((dx / len) * offset);
    y = targetY + ((dy / len) * offset);
    x = clampNumber(x, viewport.left + inset, viewport.left + viewport.width - inset);
    y = clampNumber(y, viewport.top + inset, viewport.bottom - inset);
  } else {
    const edgePoint = getTutorialGuideEdgePoint(targetX, targetY, viewport, inset);
    x = edgePoint.x;
    y = edgePoint.y;
  }

  const angle = Math.atan2(targetY - y, targetX - x) * (180 / Math.PI);
  return { action, label, title, x, y, angle };
}

function buildTutorialGuideArrowCardinalState({
  direction = 'up',
  rect,
  viewport = getTutorialViewportMetrics(),
  action = 'show',
  label = '',
  title = ''
} = {}) {
  if (!rect?.width || !rect?.height) return null;
  const inset = viewport.width <= 720 ? 38 : 44;
  const centerX = rect.left + (rect.width / 2);
  const centerY = rect.top + (rect.height / 2);

  if (direction === 'up') {
    return {
      action,
      label,
      title,
      x: clampNumber(centerX, viewport.left + inset, viewport.left + viewport.width - inset),
      y: viewport.top + inset,
      angle: -90
    };
  }

  if (direction === 'down') {
    return {
      action,
      label,
      title,
      x: clampNumber(centerX, viewport.left + inset, viewport.left + viewport.width - inset),
      y: viewport.bottom - inset,
      angle: 90
    };
  }

  if (direction === 'left') {
    return {
      action,
      label,
      title,
      x: viewport.left + inset,
      y: clampNumber(centerY, viewport.top + inset, viewport.bottom - inset),
      angle: 180
    };
  }

  return {
    action,
    label,
    title,
    x: viewport.left + viewport.width - inset,
    y: clampNumber(centerY, viewport.top + inset, viewport.bottom - inset),
    angle: 0
  };
}

function setTutorialGuideArrowState(state = null) {
  if (!tutorialGuideArrow) return;
  if (!state) {
    tutorialGuideArrow.classList.add('hidden');
    tutorialGuideArrow.dataset.action = '';
    tutorialGuideArrow.removeAttribute('title');
    tutorialGuideArrow.setAttribute('aria-label', getHelpCopy().tutorialShowTarget);
    tutorialGuideArrow.style.removeProperty('--tutorial-guide-rotation');
    return;
  }

  tutorialGuideArrow.classList.remove('hidden');
  tutorialGuideArrow.dataset.action = state.action === 'open-panel' ? 'open-panel' : 'show';
  tutorialGuideArrow.style.top = `${Math.round(state.y)}px`;
  tutorialGuideArrow.style.left = `${Math.round(state.x)}px`;
  tutorialGuideArrow.style.setProperty('--tutorial-guide-rotation', `${state.angle.toFixed(2)}deg`);
  tutorialGuideArrow.setAttribute('aria-label', state.label || getHelpCopy().tutorialShowTarget);
  tutorialGuideArrow.setAttribute('title', state.title || state.label || getHelpCopy().tutorialShowTarget);
}

function getTutorialGuideArrowState(step = getCurrentTutorialStep(), target = resolveTutorialTarget(), rect = null, viewport = getTutorialViewportMetrics()) {
  if (!tutorialState.active || !step || step.id === 'complete') return null;
  const copy = getHelpCopy();

  if (tutorialStepRequiresSidePanel(step) && sidePanelBackdrop?.classList.contains('hidden')) {
    const panelRect = panelBtn?.getBoundingClientRect?.();
    if (!panelRect?.width || !panelRect?.height) return null;
    return buildTutorialGuideArrowState({
      targetX: panelRect.left + (panelRect.width / 2),
      targetY: panelRect.top + (panelRect.height / 2),
      rect: panelRect,
      viewport,
      action: 'open-panel',
      label: copy.tutorialOpenSidePanel,
      title: copy.tutorialCtaReopenPanel,
      mode: 'visible-target'
    });
  }

  if (!rect || !target?.isConnected || !rect.width || !rect.height) return null;

  const topThreshold = viewport.top + 10;
  const bottomThreshold = viewport.bottom - 10;
  const leftThreshold = viewport.left + 10;
  const rightThreshold = viewport.left + viewport.width - 10;
  const hiddenTop = Math.max(0, topThreshold - rect.top);
  const hiddenBottom = Math.max(0, rect.bottom - bottomThreshold);
  const hiddenLeft = Math.max(0, leftThreshold - rect.left);
  const hiddenRight = Math.max(0, rect.right - rightThreshold);
  const visibleWidth = Math.max(0, Math.min(rect.right, rightThreshold) - Math.max(rect.left, leftThreshold));
  const visibleHeight = Math.max(0, Math.min(rect.bottom, bottomThreshold) - Math.max(rect.top, topThreshold));
  const visibleArea = visibleWidth * visibleHeight;
  const totalArea = Math.max(1, rect.width * rect.height);
  const visibleRatio = visibleArea / totalArea;
  const maxHidden = Math.max(hiddenTop, hiddenBottom, hiddenLeft, hiddenRight);
  const fullyVisible =
    rect.top >= topThreshold &&
    rect.bottom <= bottomThreshold &&
    rect.left >= leftThreshold &&
    rect.right <= rightThreshold;

  if (fullyVisible) return null;
  if (visibleRatio >= HELP_TUTORIAL_GUIDE_VISIBLE_RATIO_THRESHOLD && maxHidden <= HELP_TUTORIAL_GUIDE_MIN_HIDDEN_PX) {
    return null;
  }

  const label = copy.tutorialShowTarget;
  const title = copy.tutorialShowTarget;
  const verticalDominantThreshold = 10;
  const horizontalDominantThreshold = 10;

  if (
    hiddenTop > 0 &&
    hiddenTop >= hiddenBottom &&
    hiddenTop >= hiddenLeft + verticalDominantThreshold &&
    hiddenTop >= hiddenRight + verticalDominantThreshold
  ) {
    return buildTutorialGuideArrowCardinalState({
      direction: 'up',
      rect,
      viewport,
      action: 'show',
      label,
      title
    });
  }

  if (
    hiddenBottom > 0 &&
    hiddenBottom >= hiddenTop &&
    hiddenBottom >= hiddenLeft + verticalDominantThreshold &&
    hiddenBottom >= hiddenRight + verticalDominantThreshold
  ) {
    return buildTutorialGuideArrowCardinalState({
      direction: 'down',
      rect,
      viewport,
      action: 'show',
      label,
      title
    });
  }

  if (
    hiddenLeft > 0 &&
    hiddenLeft >= hiddenRight &&
    hiddenLeft >= hiddenTop + horizontalDominantThreshold &&
    hiddenLeft >= hiddenBottom + horizontalDominantThreshold
  ) {
    return buildTutorialGuideArrowCardinalState({
      direction: 'left',
      rect,
      viewport,
      action: 'show',
      label,
      title
    });
  }

  if (
    hiddenRight > 0 &&
    hiddenRight >= hiddenLeft &&
    hiddenRight >= hiddenTop + horizontalDominantThreshold &&
    hiddenRight >= hiddenBottom + horizontalDominantThreshold
  ) {
    return buildTutorialGuideArrowCardinalState({
      direction: 'right',
      rect,
      viewport,
      action: 'show',
      label,
      title
    });
  }

  const focusX =
    rect.left < leftThreshold ? rect.left
      : rect.right > rightThreshold ? rect.right
        : rect.left + (rect.width / 2);
  const focusY =
    rect.top < topThreshold ? rect.top
      : rect.bottom > bottomThreshold ? rect.bottom
        : rect.top + (rect.height / 2);

  return buildTutorialGuideArrowState({
    targetX: focusX,
    targetY: focusY,
    rect,
    viewport,
    action: 'show',
    label,
    title,
    mode: 'offscreen'
  });
}

function revealTutorialTarget({ behavior = 'smooth' } = {}) {
  const step = getCurrentTutorialStep();
  if (!step || !tutorialState.active || isTutorialComplete()) return;

  if (tutorialStepRequiresSidePanel(step) && sidePanelBackdrop?.classList.contains('hidden')) {
    openSidePanel();
    requestAnimationFrame(() => {
      scrollTutorialTargetIntoView({ behavior });
      scheduleTutorialSpotlightSync();
    });
    return;
  }

  if (step.id === 'close-side-panel') {
    sidePanelBackdrop?.scrollIntoView?.({ block: 'start', inline: 'nearest', behavior });
    scheduleTutorialSpotlightSync();
    return;
  }

  const target = resolveTutorialTarget();
  if (target === cliContainer) {
    cliContainer?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior });
    cmd?.focus?.({ preventScroll: true });
    scheduleTutorialSpotlightSync();
    return;
  }

  scrollTutorialTargetIntoView({ behavior });
  scheduleTutorialSpotlightSync();
}

function findGroupCardByName(name) {
  const needle = String(name || '');
  return [...list.querySelectorAll('.group[data-name]')].find((el) => el.dataset.name === needle) || null;
}

function findProjectPanelItemById(projectId) {
  const needle = String(projectId || '');
  if (!needle || !projectList) return null;
  const openBtn = [...projectList.querySelectorAll('.panel-open-project[data-id]')]
    .find((el) => el.getAttribute('data-id') === needle);
  return openBtn?.closest('.panel-item-project') || null;
}

function findProjectPanelMenuToggleById(projectId) {
  const needle = String(projectId || '');
  if (!needle || !projectList) return null;
  return [...projectList.querySelectorAll('.panel-project-menu-toggle[data-id]')]
    .find((el) => el.getAttribute('data-id') === needle) || null;
}

function findProjectPanelDeleteButtonById(projectId) {
  const needle = String(projectId || '');
  if (!needle || !projectList) return null;
  return [...projectList.querySelectorAll('.panel-delete-project[data-id]')]
    .find((el) => el.getAttribute('data-id') === needle) || null;
}

function getProjectsPanelSection() {
  return projectList?.closest('.panel-section[data-title="projects"]') || projectList || null;
}

function buildHelpCommandState(input, { mode = 'geleverd' } = {}) {
  const value = String(input || '').trim();
  const parts = value.split(/\s+/).filter(Boolean);
  const defs = getTokenDefs();
  const aliasMap = buildAliasMap(defs);
  const freezerEnabled = isFreezerEnabled();
  const chips = [];
  const suggestions = [];

  for (const part of parts) {
    const parsed = parsePart(part);
    const alias = parsed?.alias;
    let ok = false;
    if (alias) {
      try {
        const resolved = resolveCommandAlias(alias, {
          mode,
          freezerEnabled,
          raw: part
        });
        ok = !!aliasMap[resolved.alias];
      } catch {
        ok = false;
      }
    }
    chips.push({
      label: ok ? `${parsed?.value > 0 ? '+' : ''}${parsed?.value} ${alias}` : part,
      tone: ok ? 'good' : 'bad'
    });
  }

  const last = parts[parts.length - 1] || '';
  if (last) {
    const parsedLast = parsePart(last);
    if (parsedLast) {
      let ok = false;
      try {
        const resolved = resolveCommandAlias(parsedLast.alias, {
          mode,
          freezerEnabled,
          raw: last
        });
        ok = !!aliasMap[resolved.alias];
      } catch {
        ok = false;
      }
      if (!ok) {
        const hits = searchTokens(defs, parsedLast.alias, 6);
        for (const id of hits) suggestions.push(formatTokenOption(defs, id));
      }
    } else {
      const query = last.toLowerCase();
      if (!aliasMap[query] && query.length >= 2) {
        const hits = searchTokens(defs, query, 6);
        if (hits.length >= 2) {
          for (const id of hits) suggestions.push(formatTokenOption(defs, id));
        }
      }
    }
  }

  return { chips, suggestions };
}

function buildHelpSyntaxPracticeState(input, copy = getHelpCopy()) {
  const rawValue = String(input || '');
  const value = rawValue.trim();
  const commandState = buildHelpCommandState(value, { mode: 'geleverd' });
  const parsedCommand = parseCliCommandInput(value, { mode: 'geleverd', storage: 'main' });
  const totals = parsedCommand?.totals || sumInputTotals(value);
  const previewText = value
    ? buildActionLine(copy.syntaxPreviewCustomer, 'geleverd', 'main', totals, {
      storageTotals: parsedCommand?.amountsByStorage || null,
      mixedStorage: !!parsedCommand?.hasMixedStorage
    })
    : copy.syntaxPracticeStart;

  return {
    value: rawValue,
    hasValue: !!value,
    chips: commandState.chips,
    suggestions: commandState.suggestions,
    previewText,
    lastSubmitted: helpSyntaxPracticeLastSubmitted
  };
}

function syncHelpSyntaxPracticeCard() {
  const input = document.getElementById('helpSyntaxPracticeInput');
  const chipsWrap = document.getElementById('helpSyntaxPracticeChipsWrap');
  const chips = document.getElementById('helpSyntaxPracticeChips');
  const suggestionsWrap = document.getElementById('helpSyntaxPracticeSuggestionsWrap');
  const suggestions = document.getElementById('helpSyntaxPracticeSuggestions');
  const previewBox = document.getElementById('helpSyntaxPracticePreview');
  const lastWrap = document.getElementById('helpSyntaxPracticeLastWrap');
  const lastValue = document.getElementById('helpSyntaxPracticeLastValue');
  if (!input || !chips || !suggestions || !previewBox) return;

  const copy = getHelpCopy();
  const state = buildHelpSyntaxPracticeState(input.value, copy);
  helpSyntaxPracticeValue = input.value;

  if (chipsWrap) chipsWrap.hidden = !state.hasValue;
  chips.innerHTML = state.hasValue
    ? state.chips.map((chip) => `<div class="chip ${chip.tone}">${escapeHtml(chip.label)}</div>`).join('')
    : '';

  if (suggestionsWrap) suggestionsWrap.hidden = !state.hasValue || state.suggestions.length === 0;
  suggestions.innerHTML = state.hasValue && state.suggestions.length
    ? state.suggestions.map((item) => `<div class="help-suggestion-pill">${escapeHtml(item)}</div>`).join('')
    : '';

  previewBox.textContent = state.previewText;
  previewBox.classList.toggle('is-empty', !state.hasValue);
  if (lastWrap && lastValue) {
    lastWrap.hidden = !state.lastSubmitted;
    lastValue.textContent = state.lastSubmitted || '';
  }
}

function submitHelpSyntaxPractice() {
  const input = document.getElementById('helpSyntaxPracticeInput');
  if (!input) return;
  const value = String(input.value || '').trim();
  if (!value) return;
  helpSyntaxPracticeLastSubmitted = value;
  input.value = '';
  helpSyntaxPracticeValue = '';
  syncHelpSyntaxPracticeCard();
}

function renderHelpTutorialTab(copy = getHelpCopy()) {
  const routeName = tutorialState.projectName || suggestUniqueProjectName(copy.tutorialDraftRoute, readProjects());
  const summaries = copy.tutorialStepSummaries
    .map((step, index) => `
      <div class="help-step-item">
        <div class="help-step-index">${index + 1}</div>
        <div class="help-step-copy">
          <h4>${escapeHtml(step.title)}</h4>
          <p>${formatHelpRichText(step.body)}</p>
        </div>
      </div>
    `)
    .join('');

  return `
    <div class="help-hero-card">
      <div class="help-eyebrow">${escapeHtml(copy.tabs.tutorial)}</div>
      <h4>${escapeHtml(copy.tutorialHeroTitle)}</h4>
      <p>${escapeHtml(copy.tutorialHeroBody)}</p>
      <div class="help-inline-note">${escapeHtml(getTutorialProgressText(copy))}</div>
    </div>
    <div class="help-grid">
      <div class="help-card">
        <div class="help-eyebrow">${escapeHtml(t('projectsTitle'))}</div>
        <h4>${escapeHtml(routeName)}</h4>
        <p>${escapeHtml(copy.tutorialHeroNote)}</p>
      </div>
      <div class="help-card">
        <div class="help-eyebrow">${escapeHtml(copy.tabs.tutorial)}</div>
        <h4>${escapeHtml(tutorialState.active && !isTutorialComplete() ? copy.resumeTutorial : copy.startTutorial)}</h4>
        <p>${escapeHtml(copy.tutorialStartCardBody || copy.tutorialHeroBody)}</p>
      </div>
    </div>
    <div class="help-card">
      <div class="help-eyebrow">${escapeHtml(copy.tabs.tutorial)}</div>
      <h4>${escapeHtml(copy.tutorialOverviewTitle || copy.modalTitle)}</h4>
      <div class="help-step-list">${summaries}</div>
    </div>
  `;
}

function renderHelpRogoTab(copy = getHelpCopy()) {
  const freezerEnabled = isFreezerEnabled();
  const rogoQualityHint = freezerEnabled ? copy.rogoQualityHint : (copy.rogoQualityHintDisabled || copy.rogoQualityHint);
  const qualityItems = (copy.rogoQualityItems || [])
    .map((item) => `<li><p>${formatHelpRichText(item)}</p></li>`)
    .join('');
  const benefits = (copy.rogoBenefits || [])
    .map((item) => `<li><p>${formatHelpRichText(item)}</p></li>`)
    .join('');

  return `
    <div class="help-hero-card">
      <div class="help-eyebrow">${escapeHtml(copy.tabs.rogo)}</div>
      <h4>${escapeHtml(copy.rogoHeroTitle)}</h4>
      <p>${formatHelpRichText(copy.rogoHeroBody)}</p>
      <div class="help-inline-note help-rogo-slogan">${formatHelpRichText(copy.rogoHeroSlogan)}</div>
    </div>
    <div class="help-card">
      <div class="help-eyebrow">${escapeHtml(copy.rogoPrivacyLabel)}</div>
      <h4>${escapeHtml(copy.rogoPrivacyTitle)}</h4>
      <p>${formatHelpRichText(copy.rogoPrivacyBody)}</p>
      <div class="help-inline-note">${formatHelpRichText(copy.rogoPrivacyHint)}</div>
    </div>
    <div class="help-grid">
      <div class="help-card">
        <div class="help-eyebrow">${escapeHtml(copy.rogoMentalLoadLabel)}</div>
        <h4>${escapeHtml(copy.rogoMentalLoadTitle)}</h4>
        <p>${formatHelpRichText(copy.rogoMentalLoadBody)}</p>
      </div>
      <div class="help-card">
        <div class="help-eyebrow">${escapeHtml(copy.rogoLayoutLabel)}</div>
        <h4>${escapeHtml(copy.rogoLayoutTitle)}</h4>
        <p>${formatHelpRichText(copy.rogoLayoutBody)}</p>
        <div class="help-inline-note">${formatHelpRichText(copy.rogoLayoutHint)}</div>
      </div>
    </div>
    <div class="help-command-card">
      <div class="help-eyebrow">${escapeHtml(copy.rogoScenarioLabel)}</div>
      <h4>${escapeHtml(copy.rogoScenarioTitle)}</h4>
      <div class="help-command-note">${formatHelpRichText(copy.rogoScenarioCountLabel)}</div>
      <p>${formatHelpRichText(copy.rogoScenarioBody)}</p>
      <div class="help-inline-note">${formatHelpRichText(copy.rogoScenarioHint)}</div>
    </div>
    <div class="help-grid">
      <div class="help-card">
        <div class="help-eyebrow">${escapeHtml(copy.rogoWhenLabel)}</div>
        <h4>${escapeHtml(copy.rogoWhenTitle)}</h4>
        <p>${formatHelpRichText(copy.rogoWhenBody)}</p>
      </div>
      <div class="help-card">
        <div class="help-eyebrow">${escapeHtml(copy.rogoAfterLabel)}</div>
        <h4>${escapeHtml(copy.rogoAfterTitle)}</h4>
        <p>${formatHelpRichText(copy.rogoAfterBody)}</p>
      </div>
    </div>
    <div class="help-grid">
      <div class="help-card">
        <div class="help-eyebrow">${escapeHtml(copy.rogoQualityLabel)}</div>
        <h4>${escapeHtml(copy.rogoQualityTitle)}</h4>
        <p>${formatHelpRichText(copy.rogoQualityBody)}</p>
        <ul class="help-tip-list">${qualityItems}</ul>
        <div class="help-inline-note">${formatHelpRichText(rogoQualityHint)}</div>
        <button type="button" class="help-jump-link" data-help-jump-tab="tips" data-help-jump-anchor="freezer">${escapeHtml(copy.rogoQualityJump)}</button>
      </div>
      <div class="help-card">
        <div class="help-eyebrow">${escapeHtml(copy.rogoBenefitsLabel)}</div>
        <h4>${escapeHtml(copy.rogoBenefitsTitle)}</h4>
        <ul class="help-tip-list">${benefits}</ul>
      </div>
    </div>
  `;
}

function renderHelpSyntaxTab(copy = getHelpCopy()) {
  const freezerEnabled = isFreezerEnabled();
  const syntaxFreezerHint = freezerEnabled ? copy.syntaxFreezerHint : (copy.syntaxFreezerHintDisabled || copy.syntaxFreezerHint);
  const defs = getTokenDefs();
  const suggestionExample = formatTokenOption(defs, 'krat');
  const suggestionMatch = /^(.*?)(\s*\([^)]+\))$/.exec(suggestionExample);
  const suggestionMain = suggestionMatch?.[1] || suggestionExample;
  const suggestionAliases = suggestionMatch?.[2] || '';
  const syntaxDoItemLabel = defs?.krat?.name_nl || 'TotaalVERS Emballagekrat';
  const aliasList = suggestionAliases
    .replace(/[()]/g, '')
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean);
  const sameItemInputs = (aliasList.length ? aliasList : ['krat']).slice(0, 3).map((alias) => `15${alias}`);
  const partsExampleInput = '15k 1cont';
  const previewInputExample = '2cont 15krat 20krat 2rood';
  const addsExistingExample = '10 TotaalVERS kratten';
  const addsInputExample = '15krat';
  const addsResultExample = '25 TotaalVERS kratten';
  const reverseExamplePrimary = '5k = k5';
  const reverseExampleSecondary = '1cont = cont1';
  const correctionExistingExample = '20 TotaalVERS kratten';
  const correctionInputExample = '-5k';
  const correctionResultExample = '15 TotaalVERS kratten';
  const longLineInputExample = '2cont 15krat 20k 2rood 1c 10k 1hoes';
  const freezerInputExample = '10k 2kf';
  const previewTotals = emptyTotals();
  previewTotals.container = 2;
  previewTotals.krat = 35;
  previewTotals.rood = 2;
  const previewExample = buildActionLine(copy.syntaxPreviewCustomer, 'geleverd', 'main', previewTotals);
  const longLineTotals = emptyTotals();
  longLineTotals.container = 3;
  longLineTotals.krat = 45;
  longLineTotals.rood = 2;
  longLineTotals.hoes = 1;
  const longLinePreviewExample = buildActionLine(copy.syntaxPreviewCustomer, 'geleverd', 'main', longLineTotals);
  const correctionState = buildHelpCommandState(correctionInputExample);
  const correctionChips = correctionState.chips
    .map((chip) => `<div class="chip ${chip.tone}">${escapeHtml(chip.label)}</div>`)
    .join('');
  const freezerStorageTotals = {
    main: emptyTotals(),
    freezer: emptyTotals()
  };
  freezerStorageTotals.main.krat = 10;
  freezerStorageTotals.freezer.krat = 2;
  const freezerPreviewExample = buildActionLine(
    copy.syntaxPreviewCustomer,
    'geleverd',
    'main',
    sumTotals(freezerStorageTotals.main, freezerStorageTotals.freezer),
    {
      storageTotals: freezerStorageTotals,
      mixedStorage: true
    }
  );
  const freezerChips = [
    { label: '+10 k', tone: 'good' },
    { label: '+2 kf', tone: 'good' }
  ]
    .map((chip) => `<div class="chip ${chip.tone}">${escapeHtml(chip.label)}</div>`)
    .join('');
  const cards = copy.syntaxExamples
    .map((example) => {
      const state = buildHelpCommandState(example.command);
      const chips = state.chips
        .map((chip) => `<div class="chip ${chip.tone}">${escapeHtml(chip.label)}</div>`)
        .join('');
      const suggestions = state.suggestions.length
        ? state.suggestions.map((item) => `<div class="help-suggestion-pill">${escapeHtml(item)}</div>`).join('')
        : `<div class="help-suggestion-pill">${escapeHtml(copy.syntaxEmptySuggestions)}</div>`;

      return `
        <div class="help-command-card">
          <div class="help-eyebrow">${escapeHtml(copy.tabs.syntax)}</div>
          <h4>${formatHelpRichText(example.title)}</h4>
          <p>${escapeHtml(example.body)}</p>
          <div class="help-command-input">${escapeHtml(example.command)}</div>
          <div class="help-command-note">${escapeHtml(copy.syntaxChipsLabel)}</div>
          <div class="help-chip-row">${chips}</div>
          ${example.showSuggestions === false ? '' : `
            <div class="help-command-note">${escapeHtml(copy.syntaxSuggestionsLabel)}</div>
            <div class="help-suggestion-row">${suggestions}</div>
          `}
        </div>
      `;
    });
  const firstExampleCard = cards[0] || '';
  const remainingExampleCards = cards.slice(1).join('');

  const tips = copy.syntaxTips
    .map((tip) => `<li><p>${formatHelpRichText(tip)}</p></li>`)
    .join('');
  const sameItemPills = sameItemInputs
    .map((item) => `<div class="help-suggestion-pill"><code>${escapeHtml(item)}</code></div>`)
    .join('');
  const longLineState = buildHelpCommandState(longLineInputExample);
  const longLineChips = longLineState.chips
    .map((chip) => `<div class="chip ${chip.tone}">${escapeHtml(chip.label)}</div>`)
    .join('');
  const practiceActive = helpCliPracticeState.active;

  return `
    <div class="help-hero-card">
      <div class="help-eyebrow">${escapeHtml(copy.tabs.syntax)}</div>
      <h4>${escapeHtml(copy.syntaxHeroTitle)}</h4>
      <p>${formatHelpRichText(copy.syntaxHeroBody)}</p>
    </div>
    <div class="help-card">
      <div class="help-eyebrow">${escapeHtml(copy.syntaxImportantLabel)}</div>
      <h4>${escapeHtml(copy.syntaxOneWordTitle)}</h4>
      <p>${formatHelpRichText(copy.syntaxOneWordBody)}</p>
    </div>
    <div class="help-grid">
      <div class="help-command-card">
        <div class="help-eyebrow">${escapeHtml(copy.syntaxDoLabel)}</div>
        <h4><code>15krat</code></h4>
        <div class="help-command-input">15krat</div>
        <p>${escapeHtml(copy.syntaxDoBody)}</p>
        <div class="help-command-note">${formatHelpRichText(copy.syntaxDoHint(syntaxDoItemLabel))}</div>
      </div>
      <div class="help-command-card help-command-card-bad">
        <div class="help-eyebrow">${escapeHtml(copy.syntaxDontLabel)}</div>
        <h4><code>15 krat</code></h4>
        <div class="help-command-input">15 krat</div>
        <p>${escapeHtml(copy.syntaxDontBody)}</p>
      </div>
    </div>
    <div class="help-command-card">
      <div class="help-eyebrow">${escapeHtml(copy.syntaxAddsLabel)}</div>
      <h4>${escapeHtml(copy.syntaxAddsTitle)}</h4>
      <div class="help-command-note">${escapeHtml(copy.syntaxAddsExistingLabel)}</div>
      <div class="help-command-input">${escapeHtml(addsExistingExample)}</div>
      <div class="help-command-note">${escapeHtml(copy.syntaxAddsInputLabel)}</div>
      <div class="help-command-input">${escapeHtml(addsInputExample)}</div>
      <div class="help-command-note">${escapeHtml(copy.syntaxAddsAfterLabel)}</div>
      <div class="help-command-input">${escapeHtml(addsResultExample)}</div>
      <p>${formatHelpRichText(copy.syntaxAddsBody)}</p>
      <div class="help-inline-note">${formatHelpRichText(copy.syntaxAddsHint)}</div>
    </div>
    <div class="help-grid">
      <div class="help-command-card">
        <div class="help-eyebrow">${escapeHtml(copy.syntaxReverseLabel)}</div>
        <h4>${escapeHtml(copy.syntaxReverseTitle)}</h4>
        <div class="help-command-input">${escapeHtml(reverseExamplePrimary)}</div>
        <div class="help-command-input">${escapeHtml(reverseExampleSecondary)}</div>
        <p>${formatHelpRichText(copy.syntaxReverseBody)}</p>
        <div class="help-command-note">${formatHelpRichText(copy.syntaxReverseHint)}</div>
      </div>
      <div class="help-command-card">
        <div class="help-eyebrow">${escapeHtml(copy.syntaxCorrectionLabel)}</div>
        <h4>${escapeHtml(copy.syntaxCorrectionTitle)}</h4>
        <div class="help-command-note">${escapeHtml(copy.syntaxCorrectionExistingLabel)}</div>
        <div class="help-command-input">${escapeHtml(correctionExistingExample)}</div>
        <div class="help-command-note">${escapeHtml(copy.syntaxCorrectionInputLabel)}</div>
        <div class="help-command-input">${escapeHtml(correctionInputExample)}</div>
        <div class="help-command-note">${escapeHtml(copy.syntaxChipsLabel)}</div>
        <div class="help-chip-row">${correctionChips}</div>
        <div class="help-command-note">${escapeHtml(copy.syntaxCorrectionAfterLabel)}</div>
        <div class="help-command-input">${escapeHtml(correctionResultExample)}</div>
        <p>${formatHelpRichText(copy.syntaxCorrectionBody)}</p>
        <div class="help-command-note">${formatHelpRichText(copy.syntaxCorrectionHint)}</div>
      </div>
    </div>
    ${firstExampleCard ? `<div class="help-grid">${firstExampleCard}</div>` : ''}
    <div class="help-grid">
      <div class="help-command-card">
        <div class="help-eyebrow">${escapeHtml(copy.syntaxBracketLabel)}</div>
        <h4>${escapeHtml(copy.syntaxBracketTitle)}</h4>
        <div class="help-command-input help-token-option">
          <span class="help-token-main">${escapeHtml(suggestionMain)}</span>
          ${suggestionAliases ? `<span class="help-token-aliases">${escapeHtml(suggestionAliases)}</span>` : ''}
        </div>
        <p>${formatHelpRichText(copy.syntaxBracketBody)}</p>
      </div>
      <div class="help-command-card">
        <div class="help-eyebrow">${escapeHtml(copy.syntaxSameItemLabel)}</div>
        <h4>${escapeHtml(copy.syntaxSameItemTitle)}</h4>
        <p>${formatHelpRichText(copy.syntaxSameItemBody)}</p>
        <div class="help-chip-row">${sameItemPills}</div>
        <div class="help-command-note">${escapeHtml(copy.syntaxSameItemResult)}</div>
        <div class="help-command-input">${escapeHtml(suggestionMain)}</div>
        <div class="help-command-note">${formatHelpRichText(copy.syntaxSameItemHint)}</div>
      </div>
    </div>
    <div class="help-command-card">
      <div class="help-eyebrow">${escapeHtml(copy.syntaxPartsLabel)}</div>
      <h4>${escapeHtml(copy.syntaxPartsTitle)}</h4>
      <div class="help-command-input">${escapeHtml(partsExampleInput)}</div>
      <p>${formatHelpRichText(copy.syntaxPartsBody)}</p>
      <div class="help-command-note">${formatHelpRichText(copy.syntaxPartsHint)}</div>
    </div>
    ${remainingExampleCards ? `<div class="help-grid">${remainingExampleCards}</div>` : ''}
    <div class="help-command-card">
      <div class="help-eyebrow">${escapeHtml(copy.syntaxPreviewLabel)}</div>
      <h4>${escapeHtml(copy.syntaxPreviewTitle)}</h4>
      <div class="help-command-note">${escapeHtml(copy.syntaxPreviewTypedLabel)}</div>
      <div class="help-command-input">${escapeHtml(previewInputExample)}</div>
      <div class="help-command-note">${escapeHtml(copy.syntaxPreviewResultLabel)}</div>
      <div class="help-command-input">${escapeHtml(previewExample)}</div>
      <p>${formatHelpRichText(copy.syntaxPreviewBody)}</p>
      <div class="help-inline-note">${formatHelpRichText(copy.syntaxPreviewHint)}</div>
    </div>
    <div class="help-command-card">
      <div class="help-eyebrow">${escapeHtml(copy.syntaxLongLineLabel)}</div>
      <h4>${escapeHtml(copy.syntaxLongLineTitle)}</h4>
      <div class="help-command-note">${escapeHtml(copy.syntaxPreviewTypedLabel)}</div>
      <div class="help-command-input">${escapeHtml(longLineInputExample)}</div>
      <div class="help-command-note">${escapeHtml(copy.syntaxChipsLabel)}</div>
      <div class="help-chip-row">${longLineChips}</div>
      <div class="help-command-note">${escapeHtml(copy.syntaxPreviewResultLabel)}</div>
      <div class="help-command-input">${escapeHtml(longLinePreviewExample)}</div>
      <p>${formatHelpRichText(copy.syntaxLongLineBody)}</p>
      <div class="help-inline-note">${formatHelpRichText(copy.syntaxLongLineHint)}</div>
    </div>
    <div class="help-command-card">
      <div class="help-eyebrow">${escapeHtml(copy.syntaxFreezerLabel)}</div>
      <h4>${escapeHtml(copy.syntaxFreezerTitle)}</h4>
      <div class="help-command-note">${escapeHtml(copy.syntaxPreviewTypedLabel)}</div>
      <div class="help-command-input">${escapeHtml(freezerInputExample)}</div>
      <div class="help-command-note">${escapeHtml(copy.syntaxChipsLabel)}</div>
      <div class="help-chip-row">${freezerChips}</div>
      <div class="help-command-note">${escapeHtml(copy.syntaxPreviewResultLabel)}</div>
      <div class="help-command-input">${escapeHtml(freezerPreviewExample)}</div>
      <p>${formatHelpRichText(copy.syntaxFreezerBody)}</p>
      <div class="help-inline-note">${formatHelpRichText(syntaxFreezerHint)}</div>
      ${freezerEnabled ? '' : `<button type="button" class="help-jump-link" data-help-jump-tab="tips" data-help-jump-anchor="freezer">${escapeHtml(copy.syntaxFreezerJump || copy.rogoQualityJump)}</button>`}
    </div>
    <div id="helpSyntaxPracticeCard" class="help-command-card">
      <div class="help-eyebrow">${escapeHtml(copy.syntaxPracticeLabel)}</div>
      <h4>${escapeHtml(copy.syntaxPracticeTitle)}</h4>
      <p class="help-practice-body">${formatHelpRichText(practiceActive ? copy.syntaxPracticeActiveBody : copy.syntaxPracticeBody)}</p>
      <button
        id="helpSyntaxPracticeToggleBtn"
        class="btn ${practiceActive ? 'cancel-btn' : 'create-btn'} help-practice-toggle"
        type="button"
      >${escapeHtml(practiceActive ? copy.syntaxPracticeToggleStop : copy.syntaxPracticeToggleStart)}</button>
      <div class="help-inline-note help-practice-inline-note">${formatHelpRichText(practiceActive ? copy.syntaxPracticeActiveHint : copy.syntaxPracticeHint)}</div>
    </div>
    <div class="help-card">
      <div class="help-eyebrow">${escapeHtml(copy.tabs.syntax)}</div>
      <h4>${escapeHtml(copy.syntaxRecapTitle)}</h4>
      <ul class="help-tip-list">${tips}</ul>
    </div>
    <div class="help-card">
      <div class="help-eyebrow">${escapeHtml(copy.syntaxReadyLabel)}</div>
      <h4>${escapeHtml(copy.syntaxReadyTitle)}</h4>
      <p>${formatHelpRichText(copy.syntaxReadyBody)}</p>
      <div class="help-inline-note">${formatHelpRichText(copy.syntaxReadyHint(copy.tabs.tutorial))}</div>
    </div>
  `;
}

function renderHelpTipVisual(visual = {}) {
  if (!visual || typeof visual !== 'object') return '';

  if (visual.type === 'time') {
    const ageMs = Number(visual.ageMs || 0);
    const ts = Date.now() - Math.max(0, ageMs);
    return `
      <div class="help-tip-visual help-tip-visual-sequence">
        <span class="help-tip-pill tone-history help-live-ago" data-ts="${ts}">${escapeHtml(formatAgo(ts))}</span>
        <span class="help-tip-sep"><-></span>
        <span class="help-tip-pill tone-history">${escapeHtml(fmtTsCompact(ts))}</span>
      </div>
    `;
  }

  if (visual.type === 'chips') {
    const items = Array.isArray(visual.items) ? visual.items : [];
    return `
      <div class="help-tip-visual help-tip-visual-chips">
        ${items.map((item) => `<div class="chip ${escapeHtml(item.tone || '')}">${escapeHtml(item.label || '')}</div>`).join('')}
      </div>
    `;
  }

  if (visual.type === 'freezer') {
    return `
      <div class="help-tip-visual help-tip-visual-freezer">
        <div class="help-tip-storage-row">
          <button type="button" class="storage-chip main" tabindex="-1" aria-hidden="true">
            <span class="storage-label">${escapeHtml(visual.mainLabel || '')}</span>
            ${visual.mainValue ? `<span class="storage-value">${escapeHtml(visual.mainValue)}</span>` : ''}
          </button>
          <button type="button" class="storage-chip freezer active" tabindex="-1" aria-hidden="true">
            <span class="storage-label">${escapeHtml(visual.freezerLabel || '')}</span>
            ${visual.freezerValue ? `<span class="storage-value">${escapeHtml(visual.freezerValue)}</span>` : ''}
          </button>
        </div>
        <div class="freezer-reminder selected help-tip-freezer-reminder">${FREEZER_REMINDER_ICON_SVG}<span>${escapeHtml(visual.reminder || '')}</span></div>
      </div>
    `;
  }

  if (visual.type === 'sequence') {
    const parts = Array.isArray(visual.parts) ? visual.parts : [];
    return `
      <div class="help-tip-visual help-tip-visual-sequence">
        ${parts.map((part) => {
          if (part?.kind === 'sep') {
            return `<span class="help-tip-sep">${escapeHtml(part.label || '')}</span>`;
          }
          return `<span class="help-tip-pill tone-${escapeHtml(part?.tone || 'neutral')}">${escapeHtml(part?.label || '')}</span>`;
        }).join('')}
      </div>
    `;
  }

  return '';
}

function renderHelpTipExample(tip = {}, copy = getHelpCopy()) {
  if (tip?.exampleVisual) {
    return `
      <div class="help-tip-example help-tip-example-visual">
        <span class="help-tip-example-label">${escapeHtml(copy.tipsVisualLabel || copy.tipsExampleLabel)}</span>
        ${renderHelpTipVisual(tip.exampleVisual)}
      </div>
    `;
  }

  if (tip?.example) {
    return `<div class="help-tip-example"><span class="help-tip-example-label">${escapeHtml(copy.tipsExampleLabel)}</span> ${formatHelpRichText(tip.example)}</div>`;
  }

  return '';
}

function renderHelpTipsTab(copy = getHelpCopy()) {
  const tips = copy.tips
    .map((tip) => `
      <li${tip.anchor ? ` data-help-anchor="${escapeHtml(tip.anchor)}"` : ''}>
        <div class="help-tip-badge">${escapeHtml(tip.badge)} · ${formatHelpRichText(tip.title)}</div>
        <p>${formatHelpRichText(tip.body)}</p>
        ${renderHelpTipExample(tip, copy)}
      </li>
    `)
    .join('');

  return `
    <div class="help-hero-card">
      <div class="help-eyebrow">${escapeHtml(copy.tabs.tips)}</div>
      <h4>${escapeHtml(copy.tipsHeroTitle)}</h4>
      <p>${formatHelpRichText(copy.tipsHeroBody)}</p>
    </div>
    <div class="help-tip-card">
      <div class="help-eyebrow">${escapeHtml(copy.tabs.tips)}</div>
      <h4>${escapeHtml(copy.tipsOverviewTitle || copy.modalTitle)}</h4>
      <ul class="help-tip-list">${tips}</ul>
    </div>
  `;
}

function renderHelpModal() {
  if (!helpContent) return;
  const copy = getHelpCopy();
  const showTutorialAction = helpActiveTab === 'tutorial';

  if (helpModalKicker) helpModalKicker.textContent = copy.modalKicker;
  if (helpModalTitle) helpModalTitle.textContent = copy.modalTitle;
  if (helpModalSub) helpModalSub.textContent = copy.modalSub;
  if (closeHelpModalBtn) closeHelpModalBtn.textContent = t('close');
  if (helpPrimaryActionBtn) {
    helpPrimaryActionBtn.style.display = showTutorialAction ? '' : 'none';
    helpPrimaryActionBtn.textContent = tutorialState.active && !isTutorialComplete() ? copy.resumeTutorial : copy.startTutorial;
  }

  if (helpTabBar) {
    helpTabBar.innerHTML = HELP_TABS
      .map((tab) => `
        <button class="help-tab ${helpActiveTab === tab ? 'active' : ''}" type="button" data-tab="${tab}">
          ${escapeHtml(copy.tabs[tab])}
        </button>
      `)
      .join('');
    syncHelpTabCtaUI();
  }

  if (helpActiveTab === 'syntax') {
    helpContent.innerHTML = renderHelpSyntaxTab(copy);
    syncHelpSyntaxPracticeCard();
  } else if (helpActiveTab === 'tips') {
    helpContent.innerHTML = renderHelpTipsTab(copy);
  } else if (helpActiveTab === 'tutorial') {
    helpContent.innerHTML = renderHelpTutorialTab(copy);
  } else {
    helpContent.innerHTML = renderHelpRogoTab(copy);
  }
  syncHelpKeyboardMode();
  requestAnimationFrame(() => {
    syncHelpTabCtas();
  });
}

function setHelpTab(tab, { anchor = '' } = {}) {
  const nextTab = HELP_TABS.includes(tab) ? tab : HELP_TABS[0];
  const nextAnchor = String(anchor || '').trim();
  if (helpActiveTab === nextTab && isHelpModalOpen()) {
    helpPendingScrollAnchor = nextAnchor;
    if (nextAnchor) {
      requestAnimationFrame(() => {
        scrollHelpAnchorIntoView(nextAnchor);
        helpPendingScrollAnchor = '';
      });
    }
    return;
  }
  helpActiveTab = nextTab;
  helpPendingScrollAnchor = nextAnchor;
  if (nextTab !== 'rogo') helpRogoSyntaxCtaReady = false;
  if (nextTab !== 'syntax') helpSyntaxTutorialCtaReady = false;
  if (isHelpModalOpen()) {
    renderHelpModal();
    requestAnimationFrame(() => {
      if (helpContent && !helpPendingScrollAnchor) helpContent.scrollTop = 0;
      if (helpPendingScrollAnchor) {
        scrollHelpAnchorIntoView(helpPendingScrollAnchor);
        helpPendingScrollAnchor = '';
      }
      syncHelpTabCtas();
    });
  }
}

function openHelpModal(options = {}) {
  const hasExplicitTab = Object.prototype.hasOwnProperty.call(options, 'tab');
  const requestedTab = hasExplicitTab ? options.tab : getDefaultHelpOpenTab();
  helpActiveTab = HELP_TABS.includes(requestedTab) ? requestedTab : HELP_TABS[0];
  helpRogoSyntaxCtaReady = false;
  helpSyntaxTutorialCtaReady = false;
  markHelpIntroSeen();
  closeSidePanel();
  renderHelpModal();
  helpBackdrop?.classList.remove('hidden');
  syncHelpKeyboardMode();
  requestAnimationFrame(() => {
    if (helpContent) helpContent.scrollTop = 0;
    syncHelpTabCtas();
    closeHelpModalBtn?.focus?.({ preventScroll: true });
  });
}

function closeHelpModal() {
  helpBackdrop?.classList.add('hidden');
  helpBackdrop?.classList.remove('keyboard-compact');
  helpRogoSyntaxCtaReady = false;
  helpSyntaxTutorialCtaReady = false;
  if (tutorialState.active) {
    renderTutorialOverlay();
    scheduleTutorialSpotlightSync();
  }
}

function syncHelpUI() {
  const copy = getHelpCopy();
  if (helpSectionTitle) helpSectionTitle.textContent = copy.sectionTitle;
  if (helpLaunchTitle) helpLaunchTitle.textContent = copy.launchTitle;
  if (helpLaunchSub) helpLaunchSub.textContent = copy.launchSub;
  if (openHelpModalBtn) openHelpModalBtn.textContent = copy.openBtn;
  if (isHelpModalOpen()) renderHelpModal();
  if (tutorialState.active) renderTutorialOverlay();
}

function syncHelpSectionPlacement() {
  if (!sidePanel) return;
  const helpSection = sidePanel.querySelector('[data-title="help"]');
  if (!helpSection) return;

  if (isHelpSectionAtBottom()) {
    const devToolsSection = sidePanel.querySelector('[data-title="devtools"]');
    if (devToolsSection) {
      sidePanel.insertBefore(helpSection, devToolsSection);
    } else {
      sidePanel.appendChild(helpSection);
    }
    return;
  }

  const currentRouteSection = sidePanel.querySelector('[data-title="currentRoute"]');
  if (currentRouteSection) {
    sidePanel.insertBefore(helpSection, currentRouteSection);
  }
}

function resetTutorialTargetHighlight() {
  tutorialTargetEl?.classList.remove('tutorial-target-active');
  tutorialSecondaryTargetEl?.classList.remove('tutorial-target-secondary-active');
  tutorialTargetEl = null;
  tutorialSecondaryTargetEl = null;
}

function setTutorialTargetHighlight(target) {
  if (tutorialTargetEl === target) return;
  tutorialTargetEl?.classList.remove('tutorial-target-active');
  tutorialTargetEl = target || null;
  tutorialTargetEl?.classList.add('tutorial-target-active');
}

function setTutorialSecondaryTargetHighlight(target) {
  if (tutorialSecondaryTargetEl === target) return;
  tutorialSecondaryTargetEl?.classList.remove('tutorial-target-secondary-active');
  tutorialSecondaryTargetEl = target || null;
  tutorialSecondaryTargetEl?.classList.add('tutorial-target-secondary-active');
}

function matchesTutorialRequiredTotals(actualTotals, expected = {}) {
  const keys = Object.keys(expected || {});
  if (!keys.length) return false;
  for (const key of keys) {
    if (Number(actualTotals?.[key] || 0) !== Number(expected[key] || 0)) {
      return false;
    }
  }
  return true;
}

function matchesTutorialRequiredStorageTotals(parsedCommand, expectedMain = {}, expectedFreezer = {}) {
  return matchesTutorialRequiredTotals(parsedCommand?.amountsByStorage?.main, expectedMain)
    && matchesTutorialRequiredTotals(parsedCommand?.amountsByStorage?.freezer, expectedFreezer);
}

function tutorialRouteExists(projectId = tutorialState.projectId) {
  const id = String(projectId || '').trim();
  return !!id && readProjects().some((project) => project.id === id);
}

async function ensureTutorialProjectActive() {
  if (!tutorialRouteExists()) return false;
  if (getCurrentProject() !== tutorialState.projectId) {
    await switchProject(tutorialState.projectId);
  }
  return true;
}

function setTutorialCommandDraft(commandText) {
  if (!cmd) return;
  cmd.value = commandText;
  cmd.dispatchEvent(new Event('input'));
  cmd.blur();
}

function populateTutorialCustomerDraft(name = tutorialState.customerName, { block = 'center' } = {}) {
  const input = document.getElementById('newGroupInput');
  if (!input) return;
  input.value = String(name || '').trim();
  if (block === 'start') {
    list?.scrollTo?.({ top: 0, behavior: 'auto' });
  }
  focusElementWithoutScroll(input);
  const target = input.closest('.group.new-group') || input;
  target.scrollIntoView({ block, inline: 'nearest', behavior: 'smooth' });
  const len = input.value.length;
  try {
    input.setSelectionRange(len, len);
  } catch {}
}

function getTutorialCustomerCard(name = tutorialState.customerName) {
  return findGroupCardByName(name);
}

function getFreezerSettingRow() {
  return freezerToggle?.closest('.setting-row') || null;
}

function shouldPinTutorialNewGroupToTop() {
  if (!tutorialState.active) return false;
  const stepId = getCurrentTutorialStep()?.id;
  return stepId === 'create-customer' || stepId === 'create-second-customer';
}

function getTutorialSteps() {
  const copy = getHelpCopy();
  const routeName = tutorialState.projectName || copy.tutorialDraftRoute;
  const customerName = tutorialState.customerName || copy.tutorialDraftCustomer;
  const secondCustomerName = tutorialState.secondCustomerName || copy.tutorialDraftSecondCustomer;
  const renamedName = tutorialState.renamedCustomerName || copy.tutorialDraftRenamedCustomer;
  const freezerEnabled = isFreezerEnabled();
  const initialFreezerEnabled = !!tutorialState.initialFreezerEnabled;

  return [
    {
      id: 'create-project',
      label: copy.tutorialStatus(1, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepCreateTitle,
      body: copy.tutorialStepCreateBody(routeName),
      hint: copy.tutorialStepCreateHint,
      async onEnter() {
        closeHelpModal();
        openSidePanel();
        createProjectMode = 'new';
        createProjectModeMenuOpen = false;
        routeActionsMenuOpen = false;
        renderCreateProjectModeControls();
        renderRouteActionsMenu();
        sidePanel?.scrollTo({ top: 0, behavior: 'auto' });
        if (newProjectName) {
          newProjectName.value = routeName;
          newProjectName.blur();
        }
      }
    },
    {
      id: 'review-project',
      label: copy.tutorialStatus(2, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepReviewProjectTitle,
      body: copy.tutorialStepReviewProjectBody(routeName),
      hint: copy.tutorialStepReviewProjectHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        openSidePanel();
        createProjectMode = 'new';
        createProjectModeMenuOpen = false;
        routeActionsMenuOpen = false;
        renderCreateProjectModeControls();
        renderRouteActionsMenu();
        applyPanelSearchFilter();
        requestAnimationFrame(() => {
          findProjectPanelItemById(tutorialState.projectId)?.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth'
          });
          scheduleTutorialSpotlightSync();
        });
      }
    },
    {
      id: 'close-side-panel',
      label: copy.tutorialStatus(3, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepClosePanelTitle,
      body: copy.tutorialStepClosePanelBody,
      hint: copy.tutorialStepClosePanelHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        openSidePanel();
        createProjectMode = 'new';
        createProjectModeMenuOpen = false;
        routeActionsMenuOpen = false;
        renderCreateProjectModeControls();
        renderRouteActionsMenu();
        applyPanelSearchFilter();
        requestAnimationFrame(() => {
          findProjectPanelItemById(tutorialState.projectId)?.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth'
          });
          scheduleTutorialSpotlightSync();
        });
      }
    },
    {
      id: 'create-customer',
      label: copy.tutorialStatus(4, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepCustomerTitle,
      body: copy.tutorialStepCustomerBody(customerName),
      hint: copy.tutorialStepCustomerHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = null;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        populateTutorialCustomerDraft();
      }
    },
    {
      id: 'select-customer',
      label: copy.tutorialStatus(5, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepSelectCustomerTitle,
      body: copy.tutorialStepSelectCustomerBody(customerName),
      hint: copy.tutorialStepSelectCustomerHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        closeSidePanel();
        selectedGroup = null;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        scrollCardByNameToTopSoon(customerName);
      }
    },
    {
      id: 'select-mode',
      label: copy.tutorialStatus(6, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepModeTitle,
      body: copy.tutorialStepModeBody(customerName),
      hint: copy.tutorialStepModeHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        scrollCardByNameToTopSoon(customerName);
      }
    },
    {
      id: 'review-mode-selected',
      label: copy.tutorialStatus(7, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepReviewModeTitle,
      body: copy.tutorialStepReviewModeBody(customerName),
      hint: copy.tutorialStepReviewModeHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'geleverd';
        selectedStorage = 'main';
        await load();
        scrollSelectedCardToTopSoon();
      }
    },
    {
      id: 'first-command',
      label: copy.tutorialStatus(8, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepFirstCommandTitle,
      body: copy.tutorialStepFirstCommandBody,
      hint: copy.tutorialStepFirstCommandHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'geleverd';
        selectedStorage = 'main';
        await load();
        setTutorialCommandDraft(HELP_TUTORIAL_FIRST_COMMAND);
      }
    },
    {
      id: 'review-first-command',
      label: copy.tutorialStatus(9, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepReviewFirstCommandTitle,
      body: copy.tutorialStepReviewFirstCommandBody(customerName),
      hint: copy.tutorialStepReviewFirstCommandHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'geleverd';
        selectedStorage = 'main';
        await load();
        scrollSelectedCardToTopSoon();
      }
    },
    {
      id: 'second-command',
      label: copy.tutorialStatus(10, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepSecondCommandTitle,
      body: copy.tutorialStepSecondCommandBody,
      hint: copy.tutorialStepSecondCommandHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'geleverd';
        selectedStorage = 'main';
        await load();
        setTutorialCommandDraft(HELP_TUTORIAL_SECOND_COMMAND);
      }
    },
    {
      id: 'review-second-command',
      label: copy.tutorialStatus(11, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepReviewSecondCommandTitle,
      body: copy.tutorialStepReviewSecondCommandBody(customerName),
      hint: copy.tutorialStepReviewSecondCommandHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'geleverd';
        selectedStorage = 'main';
        await load();
        scrollSelectedCardToTopSoon();
      }
    },
    {
      id: 'open-side-panel-for-freezer',
      label: copy.tutorialStatus(12, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepOpenFreezerPanelTitle,
      body: copy.tutorialStepOpenFreezerPanelBody,
      hint: copy.tutorialStepOpenFreezerPanelHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'geleverd';
        selectedStorage = 'main';
        await load();
        scrollSelectedCardToTopSoon();
      }
    },
    {
      id: 'open-settings-for-freezer',
      label: copy.tutorialStatus(13, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepOpenFreezerSettingsTitle,
      body: copy.tutorialStepOpenFreezerSettingsBody,
      hint: copy.tutorialStepOpenFreezerSettingsHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        openSidePanel();
        settingsSectionPinned = false;
        sidePanel?.scrollTo({ top: 0, behavior: 'auto' });
        applyPanelSearchFilter();
        requestAnimationFrame(() => {
          updatePanelSettingsButton();
          scheduleTutorialSpotlightSync();
        });
      }
    },
    {
      id: 'enable-freezer-feature',
      label: copy.tutorialStatus(14, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepEnableFreezerTitle,
      body: copy.tutorialStepEnableFreezerBody(freezerEnabled),
      hint: copy.tutorialStepEnableFreezerHint(freezerEnabled),
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        openSidePanel();
        settingsSectionPinned = true;
        applyPanelSearchFilter();
        requestAnimationFrame(() => {
          updatePanelSettingsButton();
          getFreezerSettingRow()?.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth'
          });
          scheduleTutorialSpotlightSync();
        });
      }
    },
    {
      id: 'close-side-panel-after-freezer',
      label: copy.tutorialStatus(15, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepCloseFreezerPanelTitle,
      body: copy.tutorialStepCloseFreezerPanelBody,
      hint: copy.tutorialStepCloseFreezerPanelHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        openSidePanel();
        settingsSectionPinned = true;
        applyPanelSearchFilter();
        requestAnimationFrame(() => {
          updatePanelSettingsButton();
          getFreezerSettingRow()?.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth'
          });
          scheduleTutorialSpotlightSync();
        });
      }
    },
    {
      id: 'select-freezer-storage',
      label: copy.tutorialStatus(16, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepFreezerStorageTitle,
      body: copy.tutorialStepFreezerStorageBody,
      hint: copy.tutorialStepFreezerStorageHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'geleverd';
        selectedStorage = 'main';
        await load();
        scrollSelectedCardToTopSoon();
      }
    },
    {
      id: 'freezer-command',
      label: copy.tutorialStatus(17, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepFreezerCommandTitle,
      body: copy.tutorialStepFreezerCommandBody,
      hint: copy.tutorialStepFreezerCommandHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'geleverd';
        selectedStorage = 'freezer';
        await load();
        setTutorialCommandDraft(HELP_TUTORIAL_FREEZER_COMMAND);
      }
    },
    {
      id: 'review-freezer-command',
      label: copy.tutorialStatus(18, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepReviewFreezerCommandTitle,
      body: copy.tutorialStepReviewFreezerCommandBody(customerName),
      hint: copy.tutorialStepReviewFreezerCommandHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'geleverd';
        selectedStorage = 'freezer';
        await load();
        scrollSelectedCardToTopSoon();
      }
    },
    {
      id: 'create-second-customer',
      label: copy.tutorialStatus(19, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepSecondCustomerTitle,
      body: copy.tutorialStepSecondCustomerBody(secondCustomerName),
      hint: copy.tutorialStepSecondCustomerHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = null;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        populateTutorialCustomerDraft(secondCustomerName, { block: 'start' });
      }
    },
    {
      id: 'select-second-customer',
      label: copy.tutorialStatus(20, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepSelectSecondCustomerTitle,
      body: copy.tutorialStepSelectSecondCustomerBody(customerName),
      hint: copy.tutorialStepSelectSecondCustomerHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        closeSidePanel();
        selectedGroup = null;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        scrollCardByNameToTopSoon(customerName);
      }
    },
    {
      id: 'select-second-mode',
      label: copy.tutorialStatus(21, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepSecondCustomerModeTitle,
      body: copy.tutorialStepSecondCustomerModeBody(customerName),
      hint: copy.tutorialStepSecondCustomerModeHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        scrollCardByNameToTopSoon(customerName);
      }
    },
    {
      id: 'second-customer-command',
      label: copy.tutorialStatus(22, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepSecondCustomerCommandTitle,
      body: copy.tutorialStepSecondCustomerCommandBody,
      hint: copy.tutorialStepSecondCustomerCommandHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'geleverd';
        selectedStorage = 'main';
        await load();
        setTutorialCommandDraft(HELP_TUTORIAL_SECOND_CUSTOMER_COMMAND);
      }
    },
    {
      id: 'review-second-customer-command',
      label: copy.tutorialStatus(23, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepReviewSecondCustomerCommandTitle,
      body: copy.tutorialStepReviewSecondCustomerCommandBody(customerName),
      hint: copy.tutorialStepReviewSecondCustomerCommandHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'geleverd';
        selectedStorage = 'main';
        await load();
        scrollSelectedCardToTopSoon();
      }
    },
    {
      id: 'select-return-mode',
      label: copy.tutorialStatus(24, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepReturnModeTitle,
      body: copy.tutorialStepReturnModeBody(customerName),
      hint: copy.tutorialStepReturnModeHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'geleverd';
        selectedStorage = 'main';
        await load();
        scrollSelectedCardToTopSoon();
      }
    },
    {
      id: 'return-command',
      label: copy.tutorialStatus(25, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepReturnCommandTitle,
      body: copy.tutorialStepReturnCommandBody,
      hint: copy.tutorialStepReturnCommandHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'retour';
        selectedStorage = 'main';
        await load();
        setTutorialCommandDraft(HELP_TUTORIAL_RETURN_COMMAND);
      }
    },
    {
      id: 'review-return-command',
      label: copy.tutorialStatus(26, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepReviewReturnCommandTitle,
      body: copy.tutorialStepReviewReturnCommandBody(customerName),
      hint: copy.tutorialStepReviewReturnCommandHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = 'retour';
        selectedStorage = 'main';
        await load();
        scrollSelectedCardToTopSoon();
      }
    },
    {
      id: 'rename-customer',
      label: copy.tutorialStatus(27, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepRenameTitle,
      body: copy.tutorialStepRenameBody(customerName, renamedName),
      hint: copy.tutorialStepRenameHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = customerName;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        stopModeHintPulse();
        keepSelectedCardTopAlignedBriefly();
        scrollSelectedCardToTopSoon();
      }
    },
    {
      id: 'review-renamed-customer',
      label: copy.tutorialStatus(28, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepReviewRenameTitle,
      body: copy.tutorialStepReviewRenameBody(renamedName),
      hint: copy.tutorialStepReviewRenameHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        historyTimeMode = 'relative';
        historyInputMode = 'total';
        closeSidePanel();
        selectedGroup = renamedName;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        refreshHistoryTimestampLabels(document);
        refreshHistoryInputLabels(document);
        scheduleHistoryRefresh();
        scrollCardByNameToTopSoon(renamedName);
      }
    },
    {
      id: 'toggle-card-timestamp',
      label: copy.tutorialStatus(29, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepTimestampTitle,
      body: copy.tutorialStepTimestampBody,
      hint: copy.tutorialStepTimestampHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        tutorialState.timestampToggleCount = 0;
        historyTimeMode = 'relative';
        closeSidePanel();
        selectedGroup = renamedName;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        refreshHistoryTimestampLabels(document);
        scheduleHistoryRefresh();
        scrollCardByNameToTopSoon(renamedName);
      }
    },
    {
      id: 'review-card-timestamp',
      label: copy.tutorialStatus(30, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepReviewTimestampTitle,
      body: copy.tutorialStepReviewTimestampBody,
      hint: copy.tutorialStepReviewTimestampHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = renamedName;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        refreshHistoryTimestampLabels(document);
        scheduleHistoryRefresh();
        scrollCardByNameToTopSoon(renamedName);
      }
    },
    {
      id: 'toggle-mini-history',
      label: copy.tutorialStatus(31, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepMiniHistoryTitle,
      body: copy.tutorialStepMiniHistoryBody,
      hint: copy.tutorialStepMiniHistoryHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        tutorialState.miniHistoryToggleCount = 0;
        historyInputMode = 'total';
        closeSidePanel();
        selectedGroup = renamedName;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        refreshHistoryInputLabels(document);
        scrollCardByNameToTopSoon(renamedName);
      }
    },
    {
      id: 'review-mini-history',
      label: copy.tutorialStatus(32, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepReviewMiniHistoryTitle,
      body: copy.tutorialStepReviewMiniHistoryBody,
      hint: copy.tutorialStepReviewMiniHistoryHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = renamedName;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        refreshHistoryInputLabels(document);
        scrollCardByNameToTopSoon(renamedName);
      }
    },
    {
      id: 'review-before-delete',
      label: copy.tutorialStatus(33, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepFinalReviewTitle,
      body: copy.tutorialStepFinalReviewBody,
      hint: copy.tutorialStepFinalReviewHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = null;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        refreshHistoryTimestampLabels(document);
        refreshHistoryInputLabels(document);
        scheduleHistoryRefresh();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            list?.scrollTo?.({ top: 0, behavior: 'auto' });
            scheduleTutorialSpotlightSync();
          });
        });
      }
    },
    {
      id: 'open-side-panel-for-delete',
      label: copy.tutorialStatus(34, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepOpenPanelTitle,
      body: copy.tutorialStepOpenPanelBody,
      hint: copy.tutorialStepOpenPanelHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        closeSidePanel();
        selectedGroup = renamedName;
        selectedMode = null;
        selectedStorage = 'main';
        await load();
        scrollCardByNameToTopSoon(renamedName);
      }
    },
    {
      id: 'open-route-dots',
      label: copy.tutorialStatus(35, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepOpenRouteMenuTitle,
      body: copy.tutorialStepOpenRouteMenuBody(routeName),
      hint: copy.tutorialStepOpenRouteMenuHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        openSidePanel();
        openProjectMenuId = null;
        openTemplateMenuId = null;
        createProjectModeMenuOpen = false;
        routeActionsMenuOpen = false;
        settingsSectionPinned = false;
        renderProjectList();
        renderTemplateList();
        renderCreateProjectModeControls();
        renderRouteActionsMenu();
        applyPanelSearchFilter();
        requestAnimationFrame(() => {
          findProjectPanelItemById(tutorialState.projectId)?.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth'
          });
          scheduleTutorialSpotlightSync();
        });
      }
    },
    {
      id: 'delete-route',
      label: copy.tutorialStatus(36, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepDeleteTitle,
      body: copy.tutorialStepDeleteBody,
      hint: copy.tutorialStepDeleteHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        openSidePanel();
        openProjectMenuId = tutorialState.projectId;
        openTemplateMenuId = null;
        createProjectModeMenuOpen = false;
        routeActionsMenuOpen = false;
        settingsSectionPinned = false;
        renderProjectList();
        renderTemplateList();
        renderCreateProjectModeControls();
        renderRouteActionsMenu();
        applyPanelSearchFilter();
        requestAnimationFrame(() => {
          findProjectPanelDeleteButtonById(tutorialState.projectId)?.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth'
          });
          scheduleTutorialSpotlightSync();
        });
      }
    },
    {
      id: 'confirm-delete-route',
      label: copy.tutorialStatus(37, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepDeleteConfirmTitle,
      body: copy.tutorialStepDeleteConfirmBody,
      hint: copy.tutorialStepDeleteConfirmHint,
      async onEnter() {
        if (!(await ensureTutorialProjectActive())) return;
        openSidePanel();
        requestAnimationFrame(() => {
          scheduleTutorialSpotlightSync();
        });
      }
    },
    {
      id: 'review-route-deleted',
      label: copy.tutorialStatus(38, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepReviewDeleteTitle,
      body: copy.tutorialStepReviewDeleteBody(routeName),
      hint: copy.tutorialStepReviewDeleteHint,
      async onEnter() {
        openSidePanel();
        openProjectMenuId = null;
        openTemplateMenuId = null;
        createProjectModeMenuOpen = false;
        routeActionsMenuOpen = false;
        settingsSectionPinned = false;
        renderProjectList();
        renderTemplateList();
        renderCreateProjectModeControls();
        renderRouteActionsMenu();
        applyPanelSearchFilter();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            projectList?.scrollTo?.({ top: 0, behavior: 'auto' });
            getProjectsPanelSection()?.scrollIntoView?.({
              block: 'center',
              inline: 'nearest',
              behavior: 'smooth'
            });
            scheduleTutorialSpotlightSync();
            requestAnimationFrame(() => {
              scheduleTutorialSpotlightSync();
            });
          });
        });
      }
    },
    {
      id: 'open-settings-for-final-freezer',
      label: copy.tutorialStatus(39, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepOpenFinalFreezerSettingsTitle,
      body: copy.tutorialStepOpenFinalFreezerSettingsBody,
      hint: copy.tutorialStepOpenFinalFreezerSettingsHint,
      async onEnter() {
        openSidePanel();
        settingsSectionPinned = false;
        sidePanel?.scrollTo({ top: 0, behavior: 'auto' });
        applyPanelSearchFilter();
        requestAnimationFrame(() => {
          updatePanelSettingsButton();
          scheduleTutorialSpotlightSync();
        });
      }
    },
    {
      id: 'final-freezer-choice',
      label: copy.tutorialStatus(40, HELP_TUTORIAL_STEP_COUNT),
      title: copy.tutorialStepFinalFreezerChoiceTitle,
      body: copy.tutorialStepFinalFreezerChoiceBody(freezerEnabled, initialFreezerEnabled),
      hint: copy.tutorialStepFinalFreezerChoiceHint,
      async onEnter() {
        openSidePanel();
        settingsSectionPinned = true;
        applyPanelSearchFilter();
        requestAnimationFrame(() => {
          updatePanelSettingsButton();
          getFreezerSettingRow()?.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth'
          });
          scheduleTutorialSpotlightSync();
        });
      }
    }
  ];
}

function getCurrentTutorialStep() {
  if (!tutorialState.active) return null;
  const copy = getHelpCopy();
  const steps = getTutorialSteps();
  if (tutorialState.stepIndex >= steps.length) {
    return {
      id: 'complete',
      label: copy.tutorialCompleteLabel,
      title: copy.tutorialCompleteTitle,
      body: copy.tutorialCompleteBody,
      hint: copy.tutorialCompleteHint
    };
  }
  return steps[tutorialState.stepIndex];
}

function resolveTutorialTarget() {
  const step = getCurrentTutorialStep();
  if (!step || step.id === 'complete') return null;

  switch (step.id) {
    case 'create-project':
      return createProjectBtn || document.querySelector('.sidepanel-row-create');
    case 'review-project':
      return findProjectPanelItemById(tutorialState.projectId);
    case 'close-side-panel':
    case 'close-side-panel-after-freezer':
      return sidePanelBackdrop;
    case 'create-customer':
    case 'create-second-customer':
      return document.getElementById('newGroupInput');
    case 'select-customer':
    case 'select-second-customer':
    case 'review-mode-selected':
    case 'review-first-command':
    case 'review-second-command':
    case 'review-freezer-command':
    case 'review-second-customer-command':
    case 'review-return-command':
    case 'review-renamed-customer':
    case 'review-before-delete':
      return getTutorialCustomerCard();
    case 'select-mode':
    case 'select-second-mode':
      return getTutorialCustomerCard()?.querySelector('.mode[data-mode="geleverd"]') || null;
    case 'select-return-mode':
      return getTutorialCustomerCard()?.querySelector('.mode[data-mode="retour"]') || null;
    case 'select-freezer-storage':
      return getTutorialCustomerCard()?.querySelector('.storage-chip[data-storage="freezer"]') || null;
    case 'first-command':
    case 'second-command':
    case 'second-customer-command':
    case 'return-command':
    case 'freezer-command':
      return document.querySelector('.cli-row') || cmd || cliContainer;
    case 'rename-customer': {
      const card = getTutorialCustomerCard();
      return card?.querySelector('.group-title-wrap.editing .group-title-input')
        || card?.querySelector('.group-title-display')
        || null;
    }
    case 'toggle-card-timestamp':
    case 'review-card-timestamp':
      return getTutorialCustomerCard()?.querySelector('.group-modified') || null;
    case 'toggle-mini-history':
    case 'review-mini-history':
      return getTutorialCustomerCard()?.querySelector('.mini-history') || null;
    case 'open-side-panel-for-freezer':
    case 'open-side-panel-for-delete':
      return panelBtn;
    case 'open-settings-for-freezer':
    case 'open-settings-for-final-freezer':
      return panelSettingsBtn;
    case 'enable-freezer-feature':
    case 'final-freezer-choice':
      return getFreezerSettingRow();
    case 'open-route-dots':
      return findProjectPanelMenuToggleById(tutorialState.projectId);
    case 'delete-route':
      return findProjectPanelDeleteButtonById(tutorialState.projectId);
    case 'confirm-delete-route':
      return actionDialogModal || actionDialogConfirm || actionDialogCancel || null;
    case 'review-route-deleted':
      return getProjectsPanelSection();
    default:
      return null;
  }
}

function getTutorialViewportMetrics() {
  const vv = window.visualViewport;
  if (!vv || (vv.scale && Math.abs(vv.scale - 1) > 0.01)) {
    return {
      top: 0,
      left: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      bottom: window.innerHeight
    };
  }
  return {
    top: Math.round(vv.offsetTop),
    left: Math.round(vv.offsetLeft),
    width: Math.round(vv.width),
    height: Math.round(vv.height),
    bottom: Math.round(vv.offsetTop + vv.height)
  };
}

function getTutorialReviewBeforeDeleteElements() {
  const elements = [];
  const totals = list?.querySelector('.all-totals');
  if (totals) elements.push(totals);
  if (list) {
    elements.push(
      ...[...list.querySelectorAll('.group[data-id]')].filter((el) => !el.classList.contains('new-group'))
    );
  }
  return elements;
}

function resolveTutorialCustomRect(step = getCurrentTutorialStep()) {
  const stepId = typeof step === 'string' ? step : step?.id;
  if (stepId === 'review-before-delete') {
    return getRectUnion(getTutorialReviewBeforeDeleteElements());
  }
  return null;
}

function scrollTutorialTargetIntoView({ behavior = 'smooth' } = {}) {
  const target = resolveTutorialTarget();
  if (!target || !target.isConnected) return;
  target.scrollIntoView({ block: 'center', inline: 'nearest', behavior });
}

function getRectUnion(elements = []) {
  const rects = elements
    .filter((el) => el instanceof Element && el.isConnected)
    .map((el) => el.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (!rects.length) return null;
  const top = Math.min(...rects.map((rect) => rect.top));
  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

function resolveTutorialSecondaryRect(step = getCurrentTutorialStep()) {
  const stepId = typeof step === 'string' ? step : step?.id;
  if (stepId !== 'toggle-card-timestamp' && stepId !== 'review-card-timestamp') return null;
  return resolveTutorialSecondaryTarget(step)?.getBoundingClientRect?.() || null;
}

function resolveTutorialSecondaryTarget(step = getCurrentTutorialStep()) {
  const stepId = typeof step === 'string' ? step : step?.id;
  if (stepId !== 'toggle-card-timestamp' && stepId !== 'review-card-timestamp') return null;
  return findGroupCardByName(tutorialState.customerName)?.querySelector('.mini-history') || null;
}

function hideTutorialSpotlight(spotlightEl) {
  spotlightEl?.classList.remove('active');
}

function applyTutorialSpotlightRect(spotlightEl, rect, viewport, pad = 8) {
  if (!spotlightEl || !rect || !rect.width || !rect.height) {
    hideTutorialSpotlight(spotlightEl);
    return;
  }
  const inset = 6;
  const maxLeftPad = Math.max(0, rect.left - (viewport.left + inset));
  const maxRightPad = Math.max(0, (viewport.left + viewport.width - inset) - rect.right);
  const maxTopPad = Math.max(0, rect.top - (viewport.top + inset));
  const maxBottomPad = Math.max(0, (viewport.bottom - inset) - rect.bottom);
  const padX = Math.min(pad, maxLeftPad, maxRightPad);
  const padY = Math.min(pad, maxTopPad, maxBottomPad);
  const top = rect.top - padY;
  const left = rect.left - padX;
  const width = rect.width + (padX * 2);
  const height = rect.height + (padY * 2);
  spotlightEl.style.top = `${Math.round(top)}px`;
  spotlightEl.style.left = `${Math.round(left)}px`;
  spotlightEl.style.width = `${Math.max(0, Math.round(width))}px`;
  spotlightEl.style.height = `${Math.max(0, Math.round(height))}px`;
  spotlightEl.classList.add('active');
}

function isTutorialKeyboardTarget(activeEl = document.activeElement, target = resolveTutorialTarget()) {
  const el = activeEl instanceof HTMLElement ? activeEl : null;
  if (!el) return false;
  if (el === cmd || el.id === 'newGroupInput' || el.matches('.group-title-input')) return true;
  if (!target) return false;
  return el === target || target.contains(el);
}

function isTutorialCliTarget(target = resolveTutorialTarget()) {
  return !!(
    target &&
    (
      target === cmd ||
      target === cliContainer ||
      target.classList?.contains('cli-row') ||
      target.contains?.(cmd)
    )
  );
}

function syncTutorialKeyboardMode() {
  const overlay = document.getElementById('tutorialOverlay');
  if (!overlay) return;
  const compact = !!(
    tutorialState.active &&
    !isTutorialComplete() &&
    isVisualViewportKeyboardOpen() &&
    isTutorialKeyboardTarget()
  );
  const wasCompact = overlay.classList.contains('keyboard-compact');
  overlay.classList.toggle('keyboard-compact', compact);
  if (compact && !wasCompact) {
    requestAnimationFrame(() => {
      if (!isTutorialCliTarget()) {
        scrollTutorialTargetIntoView({ behavior: 'smooth' });
      }
      scheduleTutorialSpotlightSync();
    });
  } else if (!compact && wasCompact) {
    scheduleTutorialSpotlightSync();
  }
}

function isTutorialGuardAllowedTarget(target) {
  if (!(target instanceof Element)) return false;
  const stepId = getCurrentTutorialStep()?.id;
  if (tutorialPanel?.contains(target)) return true;
  if (tutorialGuideArrow?.contains(target)) return true;
  if (tutorialOverlay?.classList.contains('hidden') === false && tutorialSpotlight?.contains(target)) return true;
  if (actionDialogBackdrop && !actionDialogBackdrop.classList.contains('hidden') && actionDialogBackdrop.contains(target)) return true;
  if (modal && !modal.classList.contains('hidden') && modal.contains(target)) return true;
  if (stepId === 'close-side-panel' || stepId === 'close-side-panel-after-freezer') {
    return target === sidePanelBackdrop;
  }
  if (
    stepId === 'review-before-delete' &&
    (target.closest('.group') || target.closest('.all-totals'))
  ) {
    return false;
  }
  const tutorialTarget = resolveTutorialTarget();
  if (!tutorialTarget) return false;
  return tutorialTarget === target || tutorialTarget.contains(target);
}

function syncTutorialSpotlight() {
  tutorialSpotlightFrame = 0;
  if (!tutorialSpotlight) return;
  const step = getCurrentTutorialStep();

  if (!tutorialState.active || isTutorialComplete()) {
    resetTutorialTargetHighlight();
    hideTutorialSpotlight(tutorialSpotlight);
    hideTutorialSpotlight(tutorialSpotlightSecondary);
    tutorialPanel?.classList.remove('anchor-top');
    setTutorialGuideArrowState(null);
    return;
  }

  const target = resolveTutorialTarget();
  const secondaryTarget = resolveTutorialSecondaryTarget(step);
  setTutorialTargetHighlight(
    step?.id === 'close-side-panel' || step?.id === 'close-side-panel-after-freezer'
      ? sidePanel
      : target
  );
  setTutorialSecondaryTargetHighlight(secondaryTarget);

  if (!target || !target.isConnected) {
    hideTutorialSpotlight(tutorialSpotlight);
    hideTutorialSpotlight(tutorialSpotlightSecondary);
    tutorialPanel?.classList.remove('anchor-top');
    setTutorialGuideArrowState(getTutorialGuideArrowState(step, target, null));
    return;
  }

  const viewport = getTutorialViewportMetrics();
  const keyboardCompact = tutorialOverlay?.classList.contains('keyboard-compact');
  let rect = resolveTutorialCustomRect(step) || target.getBoundingClientRect();

  if (
    (step?.id === 'close-side-panel' || step?.id === 'close-side-panel-after-freezer') &&
    sidePanel &&
    !sidePanelBackdrop?.classList.contains('hidden')
  ) {
    const panelRect = sidePanel.getBoundingClientRect();
    const customRect = {
      top: viewport.top + 10,
      left: Math.max(viewport.left + 10, panelRect.right + 10),
      width: Math.max(0, (viewport.left + viewport.width) - Math.max(viewport.left + 10, panelRect.right + 10) - 10),
      height: Math.max(0, viewport.height - 20)
    };
    if (customRect.width && customRect.height) {
      rect = {
        top: customRect.top,
        left: customRect.left,
        width: customRect.width,
        height: customRect.height,
        right: customRect.left + customRect.width,
        bottom: customRect.top + customRect.height
      };
    }
  }

  if (!rect.width || !rect.height) {
    hideTutorialSpotlight(tutorialSpotlight);
    hideTutorialSpotlight(tutorialSpotlightSecondary);
    tutorialPanel?.classList.remove('anchor-top');
    setTutorialGuideArrowState(getTutorialGuideArrowState(step, target, rect, viewport));
    return;
  }

  if (tutorialPanel) {
    const panelRect = tutorialPanel.getBoundingClientRect();
    const mobile = viewport.width <= 720;
    const edgeInset = mobile ? 10 : 18;
    const targetCenterY = rect.top + (rect.height / 2);
    const roomAbove = Math.max(0, rect.top - viewport.top - edgeInset);
    const roomBelow = Math.max(0, viewport.bottom - rect.bottom - edgeInset);
    const panelClearance = Math.min(panelRect.height + 16, viewport.height * (mobile ? 0.46 : 0.42));
    const shouldAnchorTop =
      target === cliContainer
      || targetCenterY > (viewport.top + (viewport.height * 0.55))
      || (roomBelow < panelClearance && roomAbove > roomBelow)
      || (keyboardCompact && roomBelow < panelClearance * 0.82);
    tutorialPanel.classList.toggle('anchor-top', shouldAnchorTop);
  }

  const isCliTarget = target === cliContainer || target.classList?.contains('cli-row');
  let pad = isCliTarget ? 10 : 8;
  if (step?.id === 'toggle-card-timestamp' || step?.id === 'review-card-timestamp') {
    pad = 10;
  } else if (step?.id === 'toggle-mini-history' || step?.id === 'review-mini-history') {
    pad = 16;
  }
  applyTutorialSpotlightRect(tutorialSpotlight, rect, viewport, pad);
  const secondaryRect = resolveTutorialSecondaryRect(step);
  applyTutorialSpotlightRect(tutorialSpotlightSecondary, secondaryRect, viewport, 6);
  setTutorialGuideArrowState(getTutorialGuideArrowState(step, target, rect, viewport));
}

function scheduleTutorialSpotlightSync() {
  if (tutorialSpotlightFrame) return;
  tutorialSpotlightFrame = requestAnimationFrame(() => {
    syncTutorialSpotlight();
  });
}

function renderTutorialOverlay() {
  if (!tutorialOverlay || !tutorialPanel) return;
  if (!tutorialState.active) {
    tutorialOverlay.classList.add('hidden');
    tutorialOverlay.classList.remove('over-action-dialog');
    hideTutorialSpotlight(tutorialSpotlight);
    hideTutorialSpotlight(tutorialSpotlightSecondary);
    resetTutorialTargetHighlight();
    setTutorialGuideArrowState(null);
    return;
  }

  const copy = getHelpCopy();
  const step = getCurrentTutorialStep();
  if (!step) return;

  tutorialOverlay.classList.remove('hidden');
  tutorialOverlay.classList.toggle(
    'over-action-dialog',
    step.id === 'confirm-delete-route' &&
    !!actionDialogBackdrop &&
    !actionDialogBackdrop.classList.contains('hidden')
  );
  tutorialStepLabel.textContent = step.label;
  tutorialStepTitle.textContent = step.title;
  tutorialStepBody.innerHTML = formatHelpRichText(step.body);
  const tutorialHintText = getTutorialHintText(step, copy);
  tutorialStepHint.innerHTML = formatHelpRichText(tutorialHintText);
  tutorialStepHint.style.display = tutorialHintText ? '' : 'none';
  if (tutorialGuideArrow) {
    tutorialGuideArrow.setAttribute('aria-label', copy.tutorialShowTarget);
    tutorialGuideArrow.setAttribute('title', copy.tutorialShowTarget);
  }
  const tutorialContinueCta = isTutorialManualContinueStep(step) && step.id !== 'complete';
  tutorialRepeatBtn.textContent = tutorialContinueCta ? copy.tutorialContinue : copy.repeatStep;
  tutorialRepeatBtn.style.display = step.id === 'complete' ? 'none' : '';
  tutorialRepeatBtn.classList.toggle('is-continue-cta', tutorialContinueCta);
  tutorialEndBtn.textContent = step.id === 'complete' ? copy.finishTutorial : copy.endTutorial;
  tutorialPanel.classList.toggle('is-complete', step.id === 'complete');
  syncTutorialKeyboardMode();
  scheduleTutorialSpotlightSync();
}

async function activateCurrentTutorialStep({ force = false } = {}) {
  if (!tutorialState.active) {
    renderTutorialOverlay();
    return;
  }

  const step = getCurrentTutorialStep();
  if (!step) return;
  const token = ++tutorialStepSyncToken;
  const shouldEnter = force || tutorialStepEnteredId !== step.id;

  if (shouldEnter) {
    tutorialStepEnteredId = step.id;
    await step.onEnter?.();
    if (token !== tutorialStepSyncToken) return;
  }

  if (isTutorialComplete() && !tutorialCelebrationShown) {
    tutorialCelebrationShown = true;
    triggerDevSnowfall({
      feedbackMessage: copyOrFallbackCelebration(),
      feedbackDuration: 1600,
      flakeCount: 20,
      symbols: ['🎉', '✨', '❄️']
    });
  }

  renderTutorialOverlay();
  if (isHelpModalOpen()) renderHelpModal();
}

function copyOrFallbackCelebration() {
  return getHelpCopy().tutorialCelebration || 'Tutorial finished';
}

async function advanceTutorialStep() {
  tutorialState.stepIndex += 1;
  tutorialStepEnteredId = '';
  await activateCurrentTutorialStep({ force: true });
}

async function startTutorial({ restart = false } = {}) {
  const copy = getHelpCopy();

  if (helpCliPracticeState.active) {
    await stopHelpCliPractice({ silent: true, reopenHelp: false });
  }

  if (tutorialState.active && !restart) {
    closeHelpModal();
    renderTutorialOverlay();
    scheduleTutorialSpotlightSync();
    return;
  }

  if (tutorialState.active) {
    await stopTutorial({ cleanup: true, silent: true });
  }

  tutorialState = {
    active: true,
    stepIndex: 0,
    originalProjectId: getCurrentProject(),
    projectId: '',
    projectName: suggestUniqueProjectName(copy.tutorialDraftRoute, readProjects()),
    customerName: copy.tutorialDraftCustomer,
    secondCustomerName: copy.tutorialDraftSecondCustomer,
    renamedCustomerName: copy.tutorialDraftRenamedCustomer,
    initialFreezerEnabled: isFreezerEnabled(),
    timestampToggleCount: 0,
    miniHistoryToggleCount: 0
  };
  tutorialStepEnteredId = '';
  tutorialCelebrationShown = false;
  closeHelpModal();
  await activateCurrentTutorialStep({ force: true });
}

async function stopTutorial({ cleanup = true, silent = false } = {}) {
  const prevState = { ...tutorialState };
  tutorialState = {
    active: false,
    stepIndex: 0,
    originalProjectId: '',
    projectId: '',
    projectName: '',
    customerName: '',
    secondCustomerName: '',
    renamedCustomerName: '',
    initialFreezerEnabled: false,
    timestampToggleCount: 0,
    miniHistoryToggleCount: 0
  };
  tutorialStepEnteredId = '';
  tutorialCelebrationShown = false;
  tutorialStepSyncToken += 1;
  tutorialOverlay?.classList.add('hidden');
  tutorialOverlay?.classList.remove('keyboard-compact');
  hideTutorialSpotlight(tutorialSpotlight);
  hideTutorialSpotlight(tutorialSpotlightSecondary);
  resetTutorialTargetHighlight();

  if (cleanup && prevState.projectId && readProjects().length > 1 && tutorialRouteExists(prevState.projectId)) {
    await deleteProjectByIdSilently(prevState.projectId, {
      fallbackId: prevState.originalProjectId || null
    });
  } else if (prevState.originalProjectId && prevState.originalProjectId !== getCurrentProject()) {
    const exists = readProjects().some((project) => project.id === prevState.originalProjectId);
    if (exists) await switchProject(prevState.originalProjectId);
  }

  if (!silent) {
    feedback.textContent = getHelpCopy().tutorialClosed;
    clearFeedbackSoon(1200);
  }

  if (isHelpModalOpen()) renderHelpModal();
}

async function notifyTutorialProgress(type, payload = {}) {
  if (!tutorialState.active) return;
  const currentStepId = getCurrentTutorialStep()?.id;

  if (type === 'project-created' && currentStepId === 'create-project') {
    tutorialState.projectId = String(payload.projectId || '');
    tutorialState.projectName = String(payload.name || tutorialState.projectName || '').trim();
    await advanceTutorialStep();
    return;
  }

  if (type === 'project-deleted' && String(payload.projectId || '') === tutorialState.projectId) {
    tutorialState.projectId = '';
    if (currentStepId === 'confirm-delete-route') {
      await advanceTutorialStep();
    } else {
      tutorialState.stepIndex = HELP_TUTORIAL_STEP_COUNT;
      tutorialStepEnteredId = '';
      await activateCurrentTutorialStep({ force: true });
    }
    return;
  }

  if (type === 'settings-opened' && currentStepId === 'open-settings-for-final-freezer') {
    await advanceTutorialStep();
    return;
  }

  if (type === 'freezer-toggled' && currentStepId === 'final-freezer-choice') {
    renderTutorialOverlay();
    scheduleTutorialSpotlightSync();
    return;
  }

  if (!tutorialState.projectId || String(payload.projectId || getCurrentProject()) !== tutorialState.projectId) {
    return;
  }

  if (type === 'side-panel-closed' && (currentStepId === 'close-side-panel' || currentStepId === 'close-side-panel-after-freezer')) {
    await advanceTutorialStep();
    return;
  }

  if (type === 'side-panel-opened' && (currentStepId === 'open-side-panel-for-freezer' || currentStepId === 'open-side-panel-for-delete')) {
    await advanceTutorialStep();
    return;
  }

  if (type === 'settings-opened' && currentStepId === 'open-settings-for-freezer') {
    await advanceTutorialStep();
    return;
  }

  if (type === 'freezer-toggled' && currentStepId === 'enable-freezer-feature') {
    if (payload.enabled) {
      await advanceTutorialStep();
    }
    return;
  }

  if (type === 'project-menu-opened' && currentStepId === 'open-route-dots') {
    if (String(payload.openedProjectId || '') === tutorialState.projectId) {
      await advanceTutorialStep();
    }
    return;
  }

  if (type === 'delete-dialog-opened' && currentStepId === 'delete-route') {
    if (String(payload.projectId || '') === tutorialState.projectId) {
      await advanceTutorialStep();
    }
    return;
  }

  if (type === 'group-created' && currentStepId === 'create-customer') {
    tutorialState.customerName = String(payload.name || tutorialState.customerName || '').trim();
    await advanceTutorialStep();
    return;
  }

  if (type === 'group-created' && currentStepId === 'create-second-customer') {
    const nextName = String(payload.name || tutorialState.secondCustomerName || '').trim();
    tutorialState.secondCustomerName = nextName;
    tutorialState.customerName = nextName;
    await advanceTutorialStep();
    return;
  }

  if (type === 'group-selected' && (currentStepId === 'select-customer' || currentStepId === 'select-second-customer')) {
    if (String(payload.groupName || '') === tutorialState.customerName) {
      await advanceTutorialStep();
    }
    return;
  }

  if (type === 'mode-selected') {
    const sameGroup = String(payload.groupName || '') === tutorialState.customerName;
    if (!sameGroup) return;
    if (currentStepId === 'select-mode' && payload.mode === 'geleverd') {
      await advanceTutorialStep();
      return;
    }
    if (currentStepId === 'select-second-mode' && payload.mode === 'geleverd') {
      await advanceTutorialStep();
      return;
    }
    if (currentStepId === 'select-return-mode' && payload.mode === 'retour') {
      await advanceTutorialStep();
    }
    return;
  }

  if (type === 'command-sent' && String(payload.groupName || '') === tutorialState.customerName) {
    const totals = payload.parsedCommand?.amounts || null;
    if (currentStepId === 'first-command' && payload.mode === 'geleverd' && matchesTutorialRequiredTotals(totals, { krat: 5, container: 1 })) {
      await advanceTutorialStep();
      return;
    }
    if (currentStepId === 'second-command' && payload.mode === 'geleverd' && matchesTutorialRequiredTotals(totals, { krat: 35, container: 2, rood: 2 })) {
      await advanceTutorialStep();
      return;
    }
    if (
      currentStepId === 'second-customer-command' &&
      payload.mode === 'geleverd' &&
      payload.parsedCommand?.hasMixedStorage &&
      matchesTutorialRequiredStorageTotals(payload.parsedCommand, { container: 1, krat: 20 }, { krat: 1 })
    ) {
      await advanceTutorialStep();
      return;
    }
    if (currentStepId === 'return-command' && payload.mode === 'retour' && matchesTutorialRequiredTotals(totals, { container: 4, krat: 77, kleinblauw: 1, bierkrat: 2 })) {
      await advanceTutorialStep();
      return;
    }
    if (
      currentStepId === 'freezer-command' &&
      payload.mode === 'geleverd' &&
      normalizeStorage(payload.storage) === 'freezer' &&
      matchesTutorialRequiredTotals(totals, { krat: 2, rood: 1 })
    ) {
      await advanceTutorialStep();
    }
    return;
  }

  if (type === 'storage-selected' && currentStepId === 'select-freezer-storage') {
    if (
      String(payload.groupName || '') === tutorialState.customerName &&
      payload.mode === 'geleverd' &&
      normalizeStorage(payload.storage) === 'freezer'
    ) {
      await advanceTutorialStep();
    }
    return;
  }

  if (type === 'group-renamed' && currentStepId === 'rename-customer') {
    const oldName = String(payload.oldName || '');
    const newName = String(payload.newName || '').trim();
    if (oldName === tutorialState.customerName && newName && newName !== oldName) {
      tutorialState.customerName = newName;
      tutorialState.renamedCustomerName = newName;
      await advanceTutorialStep();
    }
    return;
  }

  if (type === 'history-time-toggled' && currentStepId === 'toggle-card-timestamp') {
    if (String(payload.groupName || '') === tutorialState.customerName && payload.scope === 'card-modified') {
      tutorialState.timestampToggleCount = Math.min(
        HELP_TUTORIAL_REVIEW_TOGGLE_COUNT,
        Number(tutorialState.timestampToggleCount || 0) + 1
      );
      if (tutorialState.timestampToggleCount >= HELP_TUTORIAL_REVIEW_TOGGLE_COUNT) {
        await advanceTutorialStep();
      } else {
        renderTutorialOverlay();
        feedback.textContent = getHelpCopy().tutorialReviewToggleProgress(
          HELP_TUTORIAL_REVIEW_TOGGLE_COUNT - tutorialState.timestampToggleCount,
          HELP_TUTORIAL_REVIEW_TOGGLE_COUNT
        );
        clearFeedbackSoon(900);
      }
    }
    return;
  }

  if (type === 'history-input-toggled' && currentStepId === 'toggle-mini-history') {
    if (String(payload.groupName || '') === tutorialState.customerName && payload.scope === 'mini-history') {
      tutorialState.miniHistoryToggleCount = Math.min(
        HELP_TUTORIAL_REVIEW_TOGGLE_COUNT,
        Number(tutorialState.miniHistoryToggleCount || 0) + 1
      );
      if (tutorialState.miniHistoryToggleCount >= HELP_TUTORIAL_REVIEW_TOGGLE_COUNT) {
        await advanceTutorialStep();
      } else {
        renderTutorialOverlay();
        feedback.textContent = getHelpCopy().tutorialReviewToggleProgress(
          HELP_TUTORIAL_REVIEW_TOGGLE_COUNT - tutorialState.miniHistoryToggleCount,
          HELP_TUTORIAL_REVIEW_TOGGLE_COUNT
        );
        clearFeedbackSoon(900);
      }
    }
  }
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
  if (resetSub) resetSub.textContent = t('resetAppSettingSub', Math.ceil(RESET_HOLD_MS / 1000));
  syncResetHoldButtonUI();
  renderRouteActionsMenu();
  if (importScreenshotTitle) importScreenshotTitle.textContent = t('importScreenshot');
  if (importScreenshotSub) importScreenshotSub.textContent = t('importScreenshotSub');
  if (importScreenshotBtn) importScreenshotBtn.textContent = t('import');
  if (screenshotLoadingTitle) screenshotLoadingTitle.textContent = t('importScreenshot');
  if (screenshotLoadingSub) screenshotLoadingSub.textContent = t('screenshotImportPleaseWait');
  if (screenshotLoadingTimeout) {
    const seconds = activeScreenshotImportSession
      ? getScreenshotImportRemainingSeconds(activeScreenshotImportSession)
      : Math.ceil(getScreenshotImportTimeoutMs(1) / 1000);
    screenshotLoadingTimeout.textContent = t('screenshotImportTimeoutHint', seconds);
  }
  syncScreenshotLoadingCancelButtonUI();
  if (exportRouteTitle) exportRouteTitle.textContent = t('exportRoute');
  if (exportRouteSub) exportRouteSub.textContent = t('exportRouteSub');
  if (exportRouteBtn) exportRouteBtn.textContent = t('exportRouteBtn');
  if (duplicateRouteTitle) duplicateRouteTitle.textContent = t('duplicateRoute');
  if (duplicateRouteSub) duplicateRouteSub.textContent = t('duplicateRouteSub');
  if (duplicateRouteBtn) duplicateRouteBtn.textContent = t('duplicateRouteBtn');
  if (clearTotalsTitle) clearTotalsTitle.textContent = t('clearTotals');
  if (clearTotalsSub) clearTotalsSub.textContent = t('clearTotalsSub');
  if (clearTotalsBtn) clearTotalsBtn.textContent = t('clearTotalsBtn');
  if (importTitle) importTitle.textContent = t('importCards');
  if (importSub) importSub.textContent = t('importCardsSub');
  if (importCardsBtn) importCardsBtn.textContent = t('import');
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
  if (currentRouteDeleteTitle) currentRouteDeleteTitle.textContent = t('deleteRoute');
  if (currentRouteDeleteSub) currentRouteDeleteSub.textContent = t('deleteRouteSub');
  if (currentRouteDeleteBtn) currentRouteDeleteBtn.textContent = t('deleteRouteBtn');
  if (currentRouteTemplateBtnSearch) currentRouteTemplateBtnSearch.textContent = t('saveAsTemplateBtn');
  if (languageTitle) languageTitle.textContent = t('language');
  if (languageSub) languageSub.textContent = t('languageSub');
  if (fontSizeTitle) fontSizeTitle.textContent = t('fontSizeTitle');
  if (fontSizeSub) fontSizeSub.textContent = t('fontSizeSub');
  applyFontScaleSetting();
  if (cardLayoutTitle) cardLayoutTitle.textContent = t('cardLayout');
  if (cardLayoutSub) cardLayoutSub.textContent = t('cardLayoutSub');
  if (cardLayoutSelect?.options?.[0]) cardLayoutSelect.options[0].text = t('compact');
  if (cardLayoutSelect?.options?.[1]) cardLayoutSelect.options[1].text = t('classic');
  if (allTotalsSettingTitle) allTotalsSettingTitle.textContent = t('allTotals');
  if (allTotalsSettingSub) allTotalsSettingSub.textContent = t('allTotalsSettingSub');
  if (helpPositionTitle) helpPositionTitle.textContent = t('helpPositionTitle');
  if (helpPositionSub) helpPositionSub.textContent = t('helpPositionSub');
  if (freezerFeatureTitle) freezerFeatureTitle.textContent = t('freezerFeature');
  if (freezerFeatureSub) freezerFeatureSub.textContent = t('freezerFeatureSub');
  syncCrateAliasSettingSummary();
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
  syncHistorySearchUI();
  if (!historyBackdrop?.classList.contains('hidden') && historyModalEvents.length) {
    renderHistoryListFromState();
  }
  if (closeHistory) closeHistory.textContent = t('close');
  if (isAliasSettingsOpen()) renderAliasSettingsModal();
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
  syncHelpUI();
  syncCliPracticeUI();
  refreshCurrentRouteActionButtonsState();
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
  refreshCurrentRouteActionButtonsState();
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
  const value = String(text || '');
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {}
  }
  if (copyTextToClipboardFallback(value)) return;
  throw new Error('Clipboard unavailable');
}

function copyTextToClipboardFallback(text) {
  if (typeof document === 'undefined' || !document.body) return false;

  const textarea = document.createElement('textarea');
  textarea.value = String(text || '');
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  const activeEl = document.activeElement;
  document.body.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
  } catch {
    textarea.focus();
  }

  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    copied = false;
  }

  textarea.remove();

  if (activeEl instanceof HTMLElement && activeEl !== document.body) {
    try {
      activeEl.focus({ preventScroll: true });
    } catch {}
  }

  return copied;
}

async function shareText(text, { title = 'RoGo' } = {}) {
  const value = String(text || '');
  if (navigator.share) {
    try {
      await navigator.share({ title, text: value });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }

  await copyTextToClipboard(value);
  return 'copied';
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

function triggerDevSnowfall({
  feedbackMessage = t('snowfallStarted'),
  feedbackDuration = 1000,
  flakeCount = 16,
  symbols = null
} = {}) {
  document.querySelector('.dev-snow-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'dev-snow-overlay';

  for (let i = 0; i < flakeCount; i += 1) {
    const flake = document.createElement('div');
    flake.className = 'dev-snowflake';
    flake.style.setProperty('--start-x', `${Math.round((i / Math.max(1, flakeCount - 1)) * 100)}%`);
    flake.style.setProperty('--delay', `${(Math.random() * 0.8).toFixed(2)}s`);
    flake.style.setProperty('--duration', `${(4 + Math.random() * 2.4).toFixed(2)}s`);
    flake.style.setProperty('--drift-x', `${Math.round((Math.random() - 0.5) * 120)}px`);
    if (Array.isArray(symbols) && symbols.length) {
      flake.classList.add('emoji');
      flake.style.setProperty('--flake-size', `${18 + Math.round(Math.random() * 10)}px`);
      const emoji = document.createElement('span');
      emoji.className = 'dev-snow-emoji';
      emoji.textContent = String(symbols[i % symbols.length] || '✨');
      flake.appendChild(emoji);
    } else {
      flake.innerHTML = FREEZER_REMINDER_ICON_SVG;
    }
    overlay.appendChild(flake);
  }

  document.body.appendChild(overlay);
  feedback.textContent = feedbackMessage;
  clearFeedbackSoon(feedbackDuration);
  window.setTimeout(() => overlay.remove(), 7000);
}

async function saveProjectAsTemplate(projectId, fallbackName = '', presetName = null) {
  const hasPresetName = typeof presetName === 'string';
  const proposedName = String(fallbackName || '').trim();
  let rawName = presetName;
  let templateSnapshot = null;
  if (!hasPresetName) {
    const sourceSnapshot = await captureProjectSnapshot(projectId);
    templateSnapshot = compactTemplateSnapshot(sourceSnapshot);
    const nextCount = getTemplateCustomerCount({ snapshot: templateSnapshot });
    const templatesForDialog = readTemplates();
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
      cancelLabel: t('cancel'),
      onInput: (value, setState) => {
        const name = String(value || '').trim();
        const existingTemplate = findTemplateByExactName(name, templatesForDialog);
        const isOverwrite = !!existingTemplate && !!name;
        setState({
          details: isOverwrite ? [buildTemplateOverwriteDetail(existingTemplate, nextCount)] : [],
          detailsCompact: isOverwrite,
          confirmLabel: isOverwrite ? t('templateOverwriteConfirm') : t('save'),
          confirmTone: isOverwrite ? 'warning' : 'create',
          confirmDisabled: !name,
          overwriteState: isOverwrite
        });
      }
    });
    if (!dialog.confirmed) return;
    rawName = dialog.value;
  }
  if (rawName == null) return;
  const name = String(rawName).trim();
  if (!name) return;

  const templates = readTemplates();
  if (!templateSnapshot) {
    const snapshot = await captureProjectSnapshot(projectId);
    templateSnapshot = compactTemplateSnapshot(snapshot);
  }
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
  const keywords = ['setting', 'settings', 'instelling', 'instellingen'];
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
  syncHelpSectionPlacement();
  renderProjectList();
  renderTemplateList();
  renderCreateProjectModeControls();
  applyPanelSearchFilter();
  if (tutorialState.active) scheduleTutorialSpotlightPanelResync();
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
  if (tutorialState.active) scheduleTutorialSpotlightPanelResync();
}

function scheduleTutorialSpotlightPanelResync() {
  if (!tutorialState.active) return;
  scheduleTutorialSpotlightSync();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scheduleTutorialSpotlightSync();
    });
  });
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

async function deleteProjectByIdWithConfirm(projectId, {
  kicker = t('projectsTitle'),
  body = ''
} = {}) {
  const id = String(projectId || '').trim();
  if (!id) return false;

  const projects = readProjects();
  if (projects.length <= 1) {
    feedback.textContent = `⚠ ${t('cannotDeleteLastProject')}`;
    clearFeedbackSoon(1200);
    refreshCurrentRouteActionButtonsState();
    return false;
  }

  const project = projects.find((entry) => entry.id === id);
  if (!project) {
    refreshCurrentRouteActionButtonsState();
    return false;
  }

  const dialogPromise = showDeleteConfirmDialog({
    kicker,
    title: t('confirmDeleteProject', project.name),
    body
  });
  void notifyTutorialProgress('delete-dialog-opened', {
    projectId: id,
    name: project.name
  });
  const dialog = await dialogPromise;
  if (!dialog.confirmed) return false;

  return deleteProjectByIdSilently(id);
}

async function deleteProjectByIdSilently(projectId, {
  fallbackId = null,
  showFeedback = true
} = {}) {
  const id = String(projectId || '').trim();
  if (!id) return false;

  const projects = readProjects();
  if (projects.length <= 1) {
    refreshCurrentRouteActionButtonsState();
    return false;
  }

  const project = projects.find((entry) => entry.id === id);
  if (!project) {
    refreshCurrentRouteActionButtonsState();
    return false;
  }

  const currentId = getCurrentProject();
  const remaining = projects.filter((entry) => entry.id !== id);
  const nextProjectId = remaining.some((entry) => entry.id === fallbackId)
    ? fallbackId
    : remaining[0]?.id;
  writeProjects(remaining);
  localStorage.removeItem(`${GROUP_ORDER_KEY}_${id}`);
  await deleteDatabaseByName(projectDbName(id));

  if (currentId === id) {
    if (nextProjectId) {
      localStorage.setItem(CURRENT_PROJECT_KEY, nextProjectId);
      setCurrentProject(nextProjectId);
      selectedGroup = null;
      selectedMode = null;
      exitSelectionMode();
      await load();
    }
  }

  renderProjectList();
  applyPanelSearchFilter();
  refreshCurrentRouteActionButtonsState();
  if (showFeedback) {
    feedback.textContent = t('projectDeleted');
    clearFeedbackSoon(1000);
  }
  await notifyTutorialProgress('project-deleted', {
    projectId: id,
    name: project.name
  });
  return true;
}

function syncHistorySearchUI() {
  if (historySearchWrap) historySearchWrap.classList.toggle('hidden', !historyModalSearchEnabled);
  if (!historySearchInput) return;
  historySearchInput.placeholder = t('historySearchPlaceholder');
  historySearchInput.setAttribute('aria-label', t('historySearchPlaceholder'));
  if (historySearchInput.value !== historyModalSearchQuery) {
    historySearchInput.value = historyModalSearchQuery;
  }
}

function resolveHistoryCommandPart(partText, {
  defs = getTokenDefs(),
  aliasMap = buildAliasMap(defs),
  mode = 'geleverd'
} = {}) {
  const raw = String(partText || '').trim().toLowerCase();
  if (!raw) return null;
  const parsed = parsePart(raw);
  if (!parsed) return null;

  let resolved;
  try {
    resolved = resolveCommandAlias(parsed.alias, { mode, freezerEnabled: true, raw });
  } catch {
    return null;
  }

  const key = aliasMap[resolved.alias];
  if (!key) return null;

  return { raw, parsed, resolved, key, token: defs[key] || {} };
}

function buildHistoryCommandSearchVariants(partText, {
  defs = getTokenDefs(),
  aliasMap = buildAliasMap(defs),
  mode = 'geleverd',
  includeUnsuffixedFreezer = false,
  includeBareAliases = true
} = {}) {
  const resolvedPart = resolveHistoryCommandPart(partText, { defs, aliasMap, mode });
  if (!resolvedPart) return [];

  const { raw, parsed, resolved, key } = resolvedPart;
  const variants = new Set([raw]);
  const suffixes = resolved.storageHint === 'freezer'
    ? (includeUnsuffixedFreezer ? ['f', ''] : ['f'])
    : [''];
  const valueText = `${parsed.value}`;

  for (const textVariant of allAliasesFor(defs, key)) {
    const normalized = String(textVariant || '').trim().toLowerCase();
    if (!normalized) continue;
    if (includeBareAliases) variants.add(normalized);
    for (const suffix of suffixes) {
      variants.add(`${valueText}${normalized}${suffix}`);
    }
  }

  return Array.from(variants);
}

function buildHistoryCommandTextTerms(partText, {
  defs = getTokenDefs(),
  aliasMap = buildAliasMap(defs),
  mode = 'geleverd'
} = {}) {
  const resolvedPart = resolveHistoryCommandPart(partText, { defs, aliasMap, mode });
  if (!resolvedPart) return [];

  const { key, token } = resolvedPart;
  return Array.from(new Set([
    token.name_nl,
    ...allAliasesFor(defs, key),
    ...(token.keywords || [])
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)));
}

function buildHistoryEventSearchIndex(evt, namesById = new Map(), defs = getTokenDefs()) {
  const aliasMap = buildAliasMap(defs);
  const name = String(evt?.groupName || namesById.get(Number(evt?.groupId)) || '').trim().toLowerCase();
  const input = String(getEventSavedInput(evt) || '').trim().toLowerCase();
  const total = String(formatEventTotalsInline(evt, defs) || '').trim().toLowerCase();
  const action = String(evt?.action || '').trim().toLowerCase();
  const localizedAction = action === 'deleted'
    ? String(t('deleted') || '').trim().toLowerCase()
    : action === 'renamed'
      ? String(t('renamed') || '').trim().toLowerCase()
      : action === 'created'
        ? String(t('created') || '').trim().toLowerCase()
        : '';
  const generalParts = new Set([
    name,
    action,
    localizedAction,
    total,
    input,
    String(evt?.oldName || '').trim().toLowerCase(),
    String(evt?.newName || '').trim().toLowerCase()
  ].filter(Boolean));
  const commandParts = new Set([total, input].filter(Boolean));
  const eventMode = evt?.target === 'retour' ? 'retour' : 'geleverd';

  if (evt?.kind !== 'lifecycle') {
    const target = String(formatEventTargetLabel(evt) || '').trim().toLowerCase();
    if (target) generalParts.add(target);
  }

  for (const rawPart of input.split(/\s+/).filter(Boolean)) {
    for (const variant of buildHistoryCommandSearchVariants(rawPart, {
      defs,
      aliasMap,
      mode: eventMode,
      includeUnsuffixedFreezer: true,
      includeBareAliases: true
    })) {
      generalParts.add(variant);
      commandParts.add(variant);
    }
    for (const term of buildHistoryCommandTextTerms(rawPart, { defs, aliasMap, mode: eventMode })) {
      generalParts.add(term);
    }
  }

  for (const rawPart of total.split(/\s+/).filter(Boolean)) {
    for (const variant of buildHistoryCommandSearchVariants(rawPart, {
      defs,
      aliasMap,
      mode: eventMode,
      includeUnsuffixedFreezer: true,
      includeBareAliases: true
    })) {
      generalParts.add(variant);
      commandParts.add(variant);
    }
    for (const term of buildHistoryCommandTextTerms(rawPart, { defs, aliasMap, mode: eventMode })) {
      generalParts.add(term);
    }
  }

  return {
    general: ` ${Array.from(generalParts).join(' ')} `,
    command: ` ${Array.from(commandParts).join(' ')} `
  };
}

function buildHistorySearchNeedles(query, defs = getTokenDefs()) {
  const aliasMap = buildAliasMap(defs);
  return String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const parsed = parsePart(part);
      if (!parsed) {
        return { type: 'text', value: part };
      }
      const variants = buildHistoryCommandSearchVariants(part, {
        defs,
        aliasMap,
        mode: 'geleverd',
        includeBareAliases: false
      });
      if (!variants.length) {
        return { type: 'text', value: part };
      }
      return {
        type: 'command',
        variants
      };
    });
}

function buildHistoryItemMarkup(e, namesById = new Map(), defs = getTokenDefs()) {
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
  const delta = formatEventTotalsInline(e, defs) || '-';
  const input = getEventSavedInput(e);
  const summaryLine = (delta !== '-' || input)
    ? renderHistoryValueMarkup(delta, input, { className: 'history-line history-command-line', labeled: true })
    : '';
  const changes = TOKEN_ORDER
    .map((k) => ({ k, v: Number(e?.[k] || 0) }))
    .filter((x) => x.v !== 0)
    .map((x) => {
      const label = tokenNameNL(defs, x.k);
      return `<div class="history-line">${escapeHtml(label)}: ${x.v > 0 ? '+' : ''}${x.v}</div>`;
    })
    .join('');

  return `
    <div class="history-item ${getHistoryItemClass(e)}">
      <div class="history-meta history-ts" data-ts="${ts}" data-compact="0">${escapeHtml(formatHistoryTimestamp(ts, false))}</div>
      <div class="history-title">${escapeHtml(name)} · ${escapeHtml(target)}</div>
      <div class="history-body">${summaryLine}${changes || (!summaryLine ? `<div class="history-line">-</div>` : '')}</div>
    </div>
  `;
}

function renderHistoryListFromState() {
  if (!historyList) return;

  const defs = getTokenDefs();
  const query = String(historyModalSearchQuery || '').trim().toLowerCase();
  const needles = historyModalSearchEnabled && query ? buildHistorySearchNeedles(query, defs) : [];
  const visibleEvents = needles.length
    ? historyModalEvents.filter((evt) => needles.every((needle) => {
      if (needle.type === 'command') {
        return needle.variants.some((variant) => evt.__searchIndex?.command?.includes(` ${variant} `));
      }
      return evt.__searchIndex?.general?.includes(needle.value);
    }))
    : historyModalEvents;

  historyModalEventCount = visibleEvents.length;
  syncHistoryModalHeader();

  if (!visibleEvents.length) {
    historyList.innerHTML = `<div class="history-empty">${escapeHtml(query ? t('historySearchNoResults') : t('noHistory'))}</div>`;
    return;
  }

  historyList.innerHTML = visibleEvents
    .map((evt) => buildHistoryItemMarkup(evt, historyModalNamesById, defs))
    .join('');
  refreshHistoryTimestampLabels(historyList);
  refreshHistoryInputLabels(historyList);
  scheduleHistoryRefresh();
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
  if (historyModalMeta) {
    const hasSearchQuery = !!String(historyModalSearchQuery || '').trim();
    historyModalMeta.textContent = (historyModalEventCount || hasSearchQuery) ? t('historyEvents', historyModalEventCount) : '';
  }
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
  historyModalSearchEnabled = groupId == null;
  historyModalSearchQuery = '';
  historyModalNamesById = namesById;
  historyModalEvents = events.map((evt) => ({
    ...evt,
    __searchIndex: buildHistoryEventSearchIndex(evt, namesById, defs)
  }));
  syncHistorySearchUI();
  syncHistoryModalHeader();
  renderHistoryListFromState();
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
  syncHistorySearchUI();
}

function closeHistoryModal() {
  historyBackdrop?.classList.add('hidden');
  historyModalSearchQuery = '';
  historyModalSearchEnabled = false;
  historyModalEvents = [];
  historyModalNamesById = new Map();
  syncHistorySearchUI();
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
  cleanupActionDialogState();
  actionDialogAllowDismiss = true;
  actionDialogBackdrop?.classList.add('hidden');
  actionDialogModal?.classList.remove('variant-template', 'variant-review', 'variant-danger', 'state-overwrite');
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
  cancelLabel = t('cancel'),
  allowDismiss = true,
  onInput = null
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
  cleanupActionDialogState();
  actionDialogAllowDismiss = !!allowDismiss;

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
  setActionDialogDetailsState(details);
  if (actionDialogActions) {
    actionDialogActions.classList.toggle('single-action', !showCancel);
  }
  if (actionDialogCancel) {
    actionDialogCancel.textContent = cancelLabel;
    actionDialogCancel.style.display = showCancel ? '' : 'none';
  }
  setActionDialogConfirmState({
    label: confirmLabel,
    tone: confirmTone,
    disabled: hasInput && !String(actionDialogInput?.value || '').trim()
  });

  const applyDialogState = ({
    details: nextDetails,
    detailsCompact = false,
    confirmLabel: nextConfirmLabel,
    confirmTone: nextConfirmTone,
    confirmDisabled = false,
    overwriteState = false
  } = {}) => {
    if (nextDetails !== undefined) {
      setActionDialogDetailsState(nextDetails, { compact: detailsCompact });
    } else if (detailsCompact !== undefined) {
      actionDialogDetails?.classList.toggle('compact-warning', !!detailsCompact);
    }
    if (nextConfirmLabel !== undefined || nextConfirmTone !== undefined || nextConfirmDisabled !== undefined) {
      setActionDialogConfirmState({
        label: nextConfirmLabel ?? actionDialogConfirm?.textContent ?? confirmLabel,
        tone: nextConfirmTone ?? confirmTone,
        disabled: !!nextConfirmDisabled
      });
    }
    actionDialogModal.classList.toggle('state-overwrite', !!overwriteState);
  };

  if (typeof onInput === 'function' && actionDialogInput) {
    const handleInput = () => {
      onInput(String(actionDialogInput.value || ''), applyDialogState);
    };
    actionDialogInput.addEventListener('input', handleInput);
    actionDialogCleanup = () => {
      actionDialogInput.removeEventListener('input', handleInput);
    };
    handleInput();
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

function findTemplateByExactName(name, templates = readTemplates()) {
  const needle = normalizeTextKey(name);
  if (!needle) return null;
  return templates.find((template) => normalizeTextKey(template?.name) === needle) || null;
}

function getTemplateCustomerCount(template) {
  return getTemplateSnapshotNames(template).length;
}

function buildTemplateOverwriteDetail(existingTemplate, nextCount) {
  return t(
    'templateOverwriteNote',
    t('templateCustomerCount', getTemplateCustomerCount(existingTemplate)),
    t('templateCustomerCount', nextCount)
  );
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
  syncTemplateCreateKeyboardMode();

  requestAnimationFrame(() => {
    templateCreateName?.focus({ preventScroll: true });
    templateCreateName?.select();
    syncTemplateCreateKeyboardMode();
  });
}

function closeTemplateCreateModal() {
  templateCreateBackdrop?.classList.add('hidden');
  templateCreateBackdrop?.classList.remove('keyboard-compact');
  templateCreateSelectedId = '';
  templateCreateSuggestedName = '';
  templateCreateNameDirty = false;
}

function openGroupTitleEditor(editor) {
  if (!editor) return;
  const wrap = editor.closest('.group-title-wrap');
  const card = editor.closest('.group');
  if (!wrap) return;
  const isTutorialRenameStep =
    tutorialState.active &&
    getCurrentTutorialStep()?.id === 'rename-customer' &&
    String(editor.dataset.old || '').trim() === String(tutorialState.customerName || '').trim();
  const nextValue = isTutorialRenameStep
    ? String(tutorialState.renamedCustomerName || getHelpCopy().tutorialDraftRenamedCustomer || '').trim()
    : String(editor.dataset.old || editor.value || '');
  wrap.classList.add('editing');
  if (isTutorialRenameStep && card) {
    keepSelectedCardTopAlignedBriefly();
    scrollCardToTop(card);
  }
  scheduleTutorialSpotlightSync();
  editor.value = nextValue;
  requestAnimationFrame(() => {
    editor.focus({ preventScroll: true });
    const len = editor.value.length;
    editor.setSelectionRange(len, len);
    if (isTutorialRenameStep && card) {
      requestAnimationFrame(() => {
        keepSelectedCardTopAlignedBriefly();
        scrollCardToTop(card);
      });
    }
    scheduleTutorialSpotlightSync();
  });
}

function closeGroupTitleEditor(editor) {
  editor?.closest('.group-title-wrap')?.classList.remove('editing');
}

document.addEventListener('click', (e) => {
  const inputToggle = e.target.closest('.history-value-toggle');
  if (inputToggle) {
    e.preventDefault();
    toggleHistoryInputMode();
    void notifyTutorialProgress('history-input-toggled', {
      projectId: getCurrentProject(),
      groupName: inputToggle.closest('.group')?.dataset?.name || '',
      scope: inputToggle.closest('.mini-history') ? 'mini-history' : 'history'
    });
    return;
  }

  const timestampToggleTarget = e.target.closest('.history-ts, .group-modified');
  if (!timestampToggleTarget) return;
  const timestampScopeRoot = timestampToggleTarget.closest('.group-modified, .mini-history, #historyList');
  if (!timestampScopeRoot) return;
  e.preventDefault();
  toggleHistoryTimeMode();
  void notifyTutorialProgress('history-time-toggled', {
    projectId: getCurrentProject(),
    groupName: timestampToggleTarget.closest('.group')?.dataset?.name || '',
    scope: timestampScopeRoot.classList.contains('group-modified')
      ? 'card-modified'
      : (timestampScopeRoot.closest('.mini-history') ? 'mini-history' : 'history')
  });
});

document.addEventListener('focusin', () => {
  syncCliNameEditVisibility();
});

document.addEventListener('focusout', () => {
  requestAnimationFrame(() => {
    syncCliNameEditVisibility();
  });
});

sidePanel?.addEventListener('transitionend', (e) => {
  if (e.propertyName !== 'transform') return;
  if (!tutorialState.active) return;
  scheduleTutorialSpotlightSync();
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
    await copyTextToClipboard(text);
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
    const result = await shareText(text);
    if (result === 'cancelled') return;
    feedback.textContent = result === 'shared'
      ? t('sharedCards', selectedGroupIds.size)
      : t('copiedCards', selectedGroupIds.size);
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
    scanSession = createScreenshotImportSession(files.length);
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

    createSession = createScreenshotImportSession(files.length);
    updateScreenshotLoadingModal(t('screenshotImportCreating', newNames.length), createSession);
    const createdCount = await createCustomersFromNames(newNames, createSession);
    finishScreenshotImportSession(createSession);
    createSession = null;

    await load();
    feedback.textContent = t('screenshotImportCreated', createdCount, existingCount, failedCount);
    clearFeedbackSoon(1800);
  } catch (e) {
    feedback.textContent = isScreenshotImportCancelledError(e)
      ? t('screenshotImportCancelled')
      : `⚠ ${e?.message || t('error')}`;
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
  if (e.target === actionDialogBackdrop && actionDialogAllowDismiss) resolveActionDialog(false);
});

document.addEventListener('keydown', (e) => {
  if (!importBackdrop || importBackdrop.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeImportModal();
});

document.addEventListener('keydown', (e) => {
  if (!actionDialogBackdrop || actionDialogBackdrop.classList.contains('hidden')) return;
  if (e.key === 'Escape' && actionDialogAllowDismiss) resolveActionDialog(false);
  if (e.key === 'Enter') {
    if (actionDialogConfirm?.disabled) return;
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
historySearchInput?.addEventListener('input', () => {
  if (!historyModalSearchEnabled) return;
  historyModalSearchQuery = String(historySearchInput.value || '');
  renderHistoryListFromState();
});
historyBackdrop?.addEventListener('click', (e) => {
  if (e.target === historyBackdrop) closeHistoryModal();
});
document.addEventListener('keydown', (e) => {
  if (!historyBackdrop || historyBackdrop.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeHistoryModal();
});

openCrateAliasesBtn?.addEventListener('click', () => {
  openAliasSettingsModal();
});

aliasSettingsBackdrop?.addEventListener('input', (e) => {
  const input = e.target.closest('.alias-settings-add-input');
  if (!input) return;
  const next = normalizeAliasInputValue(input.value);
  if (input.value !== next) input.value = next;
  if (aliasSettingsErrorMessage) {
    aliasSettingsErrorMessage = '';
    if (aliasSettingsError) aliasSettingsError.textContent = '';
  }
  syncAliasSettingsSaveButtonState({ includePendingInput: true });
});

aliasSettingsBackdrop?.addEventListener('beforeinput', (e) => {
  const input = e.target.closest('.alias-settings-add-input');
  if (!input || e.inputType !== 'insertLineBreak') return;
  e.preventDefault();
  addAliasToDraft(input.dataset.tokenId, input.value);
});

aliasSettingsBackdrop?.addEventListener('focusin', () => {
  syncAliasSettingsKeyboardMode();
});

aliasSettingsBackdrop?.addEventListener('focusout', () => {
  requestAnimationFrame(() => {
    syncAliasSettingsKeyboardMode();
  });
});

aliasSettingsBackdrop?.addEventListener('keydown', async (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeAliasSettingsModal();
    return;
  }

  const input = e.target.closest('.alias-settings-add-input');
  if (e.key === 'Enter' && input) {
    e.preventDefault();
    addAliasToDraft(input.dataset.tokenId, input.value);
    return;
  }

  const interactiveTarget = e.target instanceof Element
    ? e.target.closest('[data-alias-action], #aliasSettingsReset, #aliasSettingsCancel, #aliasSettingsSave')
    : null;
  if (e.key === 'Enter' && !interactiveTarget && !aliasSettingsSave?.disabled) {
    e.preventDefault();
    await requestAliasSettingsSave();
  }
});

aliasSettingsReset?.addEventListener('click', () => {
  aliasSettingsDraft = buildAliasSettingsDraft(DEFAULT_TOKENS);
  aliasSettingsSelectedTokenId = '';
  aliasSettingsErrorMessage = '';
  renderAliasSettingsModal();
});

aliasSettingsCancel?.addEventListener('click', () => {
  closeAliasSettingsModal();
});

aliasSettingsSave?.addEventListener('touchend', async (e) => {
  e.preventDefault();
  aliasSettingsSaveTouchStamp = Date.now();
  await requestAliasSettingsSave();
}, { passive: false });

aliasSettingsSave?.addEventListener('click', async () => {
  if (aliasSettingsSaveTouchStamp && Date.now() - aliasSettingsSaveTouchStamp < 900) return;
  await requestAliasSettingsSave();
});

aliasSettingsBackdrop?.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('[data-alias-action]');
  if (actionBtn) {
    const tokenId = actionBtn.dataset.tokenId || '';
    const alias = actionBtn.dataset.alias || '';
    const action = actionBtn.dataset.aliasAction || '';
    if (action === 'add') {
      const input = aliasSettingsBackdrop.querySelector(`.alias-settings-add-input[data-token-id="${tokenId}"]`);
      addAliasToDraft(tokenId, input?.value || '');
      return;
    }
    if (action === 'select-item') {
      toggleAliasItemSelection(tokenId);
      return;
    }
    if (action === 'remove') {
      removeAliasFromDraft(tokenId, alias);
      return;
    }
  }
  if (e.target.closest('.alias-settings-add-input')) return;
  const selectedCard = e.target.closest('.alias-settings-item');
  if (selectedCard) {
    toggleAliasItemSelection(selectedCard.dataset.tokenId || '');
    return;
  }
  if (e.target === aliasSettingsBackdrop) closeAliasSettingsModal();
});

document.addEventListener('keydown', (e) => {
  if (!isAliasSettingsOpen()) return;
  if (e.key === 'Escape') closeAliasSettingsModal();
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

openHelpModalBtn?.addEventListener('click', () => {
  openHelpModal();
});
closeHelpModalBtn?.addEventListener('click', closeHelpModal);
helpBackdrop?.addEventListener('click', (e) => {
  if (e.target === helpBackdrop) closeHelpModal();
});
helpTabBar?.addEventListener('click', (e) => {
  const tab = e.target.closest('.help-tab')?.getAttribute('data-tab');
  if (!tab) return;
  setHelpTab(tab);
});
helpContent?.addEventListener('input', (e) => {
  if (e.target?.id !== 'helpSyntaxPracticeInput') return;
  syncHelpSyntaxPracticeCard();
});
helpContent?.addEventListener('focusin', (e) => {
  if (e.target?.id !== 'helpSyntaxPracticeInput') return;
  syncHelpKeyboardMode();
  requestAnimationFrame(() => {
    scrollHelpSyntaxPracticeCardIntoView();
  });
});
helpContent?.addEventListener('focusout', (e) => {
  if (e.target?.id !== 'helpSyntaxPracticeInput') return;
  requestAnimationFrame(() => {
    syncHelpKeyboardMode();
  });
});
helpContent?.addEventListener('keydown', (e) => {
  if (e.target?.id !== 'helpSyntaxPracticeInput') return;
  const key = String(e.key || '').toLowerCase();
  const isSubmitKey = key === 'enter' || key === 'go' || key === 'done' || e.keyCode === 13;
  if (!isSubmitKey) return;
  e.preventDefault();
  submitHelpSyntaxPractice();
});
helpContent?.addEventListener('scroll', () => {
  syncHelpTabCtas();
}, { passive: true });
helpContent?.addEventListener('click', async (e) => {
  const jumpTarget = e.target?.closest?.('[data-help-jump-tab]');
  const jumpTab = jumpTarget?.getAttribute('data-help-jump-tab');
  if (jumpTab) {
    setHelpTab(jumpTab, {
      anchor: jumpTarget?.getAttribute('data-help-jump-anchor') || ''
    });
    return;
  }
  if (e.target?.id !== 'helpSyntaxPracticeToggleBtn') return;
  if (helpCliPracticeState.active) {
    await stopHelpCliPractice({ silent: true, reopenHelp: true });
    return;
  }
  await startHelpCliPractice();
});
helpPrimaryActionBtn?.addEventListener('click', async () => {
  await startTutorial({ restart: isTutorialComplete() });
});
cliPracticeToggleBtn?.addEventListener('click', async () => {
  await stopHelpCliPractice({ silent: false, reopenHelp: true });
});
document.addEventListener('keydown', (e) => {
  if (!helpBackdrop || helpBackdrop.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeHelpModal();
});
tutorialRepeatBtn?.addEventListener('click', async () => {
  if (isTutorialManualContinueStep()) {
    await advanceTutorialStep();
    return;
  }
  tutorialStepEnteredId = '';
  await activateCurrentTutorialStep({ force: true });
});
tutorialGuideArrow?.addEventListener('click', () => {
  revealTutorialTarget({ behavior: 'smooth' });
});
tutorialEndBtn?.addEventListener('click', async () => {
  if (isTutorialComplete()) {
    await stopTutorial({ cleanup: false, silent: true });
    return;
  }
  await stopTutorial({ cleanup: true, silent: false });
});
document.addEventListener('click', (e) => {
  if (!tutorialState.active || isTutorialComplete()) return;
  if (isTutorialGuardAllowedTarget(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
}, true);
document.addEventListener('keydown', (e) => {
  if (!tutorialState.active || isTutorialComplete()) return;
  if (e.key !== 'Escape') return;
  e.preventDefault();
  e.stopPropagation();
}, true);
document.addEventListener('focusin', () => {
  syncTutorialKeyboardMode();
  scheduleTutorialSpotlightSync();
});
document.addEventListener('focusout', () => {
  requestAnimationFrame(() => {
    syncTutorialKeyboardMode();
    scheduleTutorialSpotlightSync();
  });
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

if (resetBtn) {
  resetBtn.addEventListener('pointerdown', handleResetHoldPointerDown);
  resetBtn.addEventListener('pointermove', handleResetHoldPointerMove);
  resetBtn.addEventListener('pointerup', cancelResetHold);
  resetBtn.addEventListener('pointercancel', cancelResetHold);
  resetBtn.addEventListener('pointerleave', cancelResetHold);
  resetBtn.addEventListener('keydown', handleResetHoldKeyDown);
  resetBtn.addEventListener('keyup', handleResetHoldKeyUp);
  resetBtn.addEventListener('blur', cancelResetHold);
}

if (screenshotLoadingCancelBtn) {
  screenshotLoadingCancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
  });
  screenshotLoadingCancelBtn.addEventListener('pointerdown', handleScreenshotImportCancelPointerDown);
  screenshotLoadingCancelBtn.addEventListener('pointermove', handleScreenshotImportCancelPointerMove);
  screenshotLoadingCancelBtn.addEventListener('pointerup', cancelScreenshotImportCancelHold);
  screenshotLoadingCancelBtn.addEventListener('pointercancel', cancelScreenshotImportCancelHold);
  screenshotLoadingCancelBtn.addEventListener('pointerleave', cancelScreenshotImportCancelHold);
  screenshotLoadingCancelBtn.addEventListener('keydown', handleScreenshotImportCancelKeyDown);
  screenshotLoadingCancelBtn.addEventListener('keyup', handleScreenshotImportCancelKeyUp);
  screenshotLoadingCancelBtn.addEventListener('blur', cancelScreenshotImportCancelHold);
}

function applySettingsFromStorage() {
  const theme = localStorage.getItem('rogo_theme') || 'dark';
  const hand = localStorage.getItem('rogo_hand') || 'right';
  const lang = localStorage.getItem('rogo_lang') || 'nl';
  const cardLayout = getCardLayout();
  const fontScaleStep = getFontScaleStep();
  const freezerEnabled = isFreezerEnabled();
  const allTotalsVisible = isAllTotalsVisible();
  const helpSectionAtBottom = isHelpSectionAtBottom();
  if (langSelect) langSelect.value = lang;
  if (cardLayoutSelect) cardLayoutSelect.value = cardLayout;
  if (fontSizeRange) fontSizeRange.value = String(fontScaleStep);

  document.body.classList.toggle('theme-light', theme === 'light');
  document.body.classList.toggle('hand-left', hand === 'left');

  if (themeToggle) themeToggle.checked = theme === 'light';
  if (handToggle) handToggle.checked = hand === 'left';
  if (allTotalsToggle) allTotalsToggle.checked = allTotalsVisible;
  if (helpPositionToggle) helpPositionToggle.checked = helpSectionAtBottom;
  if (freezerToggle) freezerToggle.checked = freezerEnabled;
  if (!freezerEnabled && selectedStorage === 'freezer') selectedStorage = 'main';
  applyFontScaleSetting();
  syncHelpSectionPlacement();
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
  void notifyTutorialProgress('settings-opened', {
    projectId: getCurrentProject(),
    source: 'panel-settings-btn'
  });
}

async function applyFreezerEnabledSetting(nextEnabled, { notifyTutorial = true, tutorialProjectId = getCurrentProject() } = {}) {
  const safeNextEnabled = !!nextEnabled;
  const wasEnabled = isFreezerEnabled();
  if (safeNextEnabled === wasEnabled) {
    applySettingsFromStorage();
    await load();
    cmd.dispatchEvent(new Event('input'));
    return;
  }

  if (wasEnabled && !safeNextEnabled) {
    await collapseFreezerDeliveredIntoMain();
  }

  localStorage.setItem(FREEZER_ENABLED_KEY, safeNextEnabled ? '1' : '0');
  applySettingsFromStorage();
  await load();
  if (notifyTutorial) {
    await notifyTutorialProgress('freezer-toggled', {
      projectId: tutorialProjectId,
      enabled: safeNextEnabled
    });
  }
  cmd.dispatchEvent(new Event('input'));
}

async function maybePromptTutorialFreezerPreference({ initialFreezerEnabled = false } = {}) {
  if (initialFreezerEnabled || !isFreezerEnabled()) return;
  const copy = getHelpCopy();
  const dialog = await showActionDialog({
    variant: 'review',
    kicker: copy.tutorialFreezerChoiceKicker,
    title: copy.tutorialFreezerChoiceTitle,
    body: copy.tutorialFreezerChoiceBody,
    details: [copy.tutorialFreezerChoiceDetail],
    showCancel: true,
    confirmTone: 'create',
    confirmLabel: copy.tutorialFreezerChoiceKeep,
    cancelLabel: copy.tutorialFreezerChoiceDisable,
    allowDismiss: false
  });

  if (dialog.confirmed) {
    feedback.textContent = copy.tutorialFreezerChoiceKept;
    clearFeedbackSoon(1400);
    return;
  }

  await applyFreezerEnabledSetting(false, { notifyTutorial: false });
  feedback.textContent = copy.tutorialFreezerChoiceDisabled;
  clearFeedbackSoon(1400);
}

panelBtn?.addEventListener('click', () => {
  openSidePanel();
  void notifyTutorialProgress('side-panel-opened', {
    projectId: getCurrentProject(),
    source: 'panel-btn'
  });
});
sidePanelBackdrop?.addEventListener('click', (e) => {
  if (e.target !== sidePanelBackdrop) return;
  closeSidePanel();
  void notifyTutorialProgress('side-panel-closed', {
    projectId: getCurrentProject(),
    source: 'backdrop'
  });
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
sidePanel?.addEventListener('scroll', scheduleTutorialSpotlightSync, { passive: true });
appRoot?.addEventListener('scroll', scheduleTutorialSpotlightSync, { passive: true });
list?.addEventListener('scroll', scheduleTutorialSpotlightSync, { passive: true });
window.addEventListener('scroll', scheduleTutorialSpotlightSync, { passive: true });
document.addEventListener('scroll', scheduleTutorialSpotlightSync, { passive: true, capture: true });
window.addEventListener('resize', () => {
  schedulePanelOverflowMenuDirectionRefresh();
});
window.addEventListener('resize', scheduleTutorialSpotlightSync);
window.addEventListener('orientationchange', scheduleTutorialSpotlightSync);
window.visualViewport?.addEventListener('resize', scheduleTutorialSpotlightSync);
window.visualViewport?.addEventListener('scroll', scheduleTutorialSpotlightSync);
window.addEventListener('resize', syncTutorialKeyboardMode);
window.addEventListener('orientationchange', syncTutorialKeyboardMode);
window.visualViewport?.addEventListener('resize', syncTutorialKeyboardMode);
window.visualViewport?.addEventListener('scroll', syncTutorialKeyboardMode);
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
    await copyTextToClipboard(payload.text);
    feedback.textContent = t('copiedCards', payload.count);
    clearFeedbackSoon(1000);
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
    title: t('clearTotals'),
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

currentRouteDeleteBtn?.addEventListener('click', async () => {
  const keepRouteActionsOpen = tutorialState.active && getCurrentTutorialStep()?.id === 'delete-route';
  routeActionsMenuOpen = keepRouteActionsOpen;
  renderRouteActionsMenu();
  const currentRoute = getCurrentRouteRecord();
  if (!currentRoute) return;
  await deleteProjectByIdWithConfirm(currentRoute.id, {
    kicker: t('currentRoute'),
    body: t('deleteRouteSub')
  });
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
  await notifyTutorialProgress('project-created', {
    projectId: id,
    name: chosen
  });
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

templateCreateName?.addEventListener('focus', () => {
  syncTemplateCreateKeyboardMode();
});

templateCreateName?.addEventListener('blur', () => {
  requestAnimationFrame(() => {
    syncTemplateCreateKeyboardMode();
  });
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
    if (openProjectMenuId === id) {
      await notifyTutorialProgress('project-menu-opened', {
        projectId: getCurrentProject(),
        openedProjectId: id
      });
    }
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
  const keepMenuOpen = tutorialState.active
    && getCurrentTutorialStep()?.id === 'delete-route'
    && id === tutorialState.projectId;
  openProjectMenuId = keepMenuOpen ? id : null;
  renderProjectList();
  applyPanelSearchFilter();
  await deleteProjectByIdWithConfirm(id, { kicker: t('projectsTitle') });
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

fontSizeRange?.addEventListener('input', () => {
  setFontScaleStep(fontSizeRange.value);
  applyFontScaleSetting();
  syncVisualViewport();
  scheduleTutorialSpotlightSync();
});

cardLayoutSelect?.addEventListener('change', () => {
  const val = cardLayoutSelect.value === 'classic' ? 'classic' : 'compact';
  localStorage.setItem('rogo_card_layout', val);
  load();
});

allTotalsToggle?.addEventListener('change', () => {
  setAllTotalsVisible(!!allTotalsToggle.checked);
  load();
});

helpPositionToggle?.addEventListener('change', () => {
  setHelpSectionAtBottom(!!helpPositionToggle.checked);
  syncHelpSectionPlacement();
  applyPanelSearchFilter();
});

freezerToggle?.addEventListener('change', () => {
  const nextEnabled = !!freezerToggle.checked;
  freezerToggle.disabled = true;

  applyFreezerEnabledSetting(nextEnabled, {
    notifyTutorial: true,
    tutorialProjectId: getCurrentProject()
  })
    .catch((err) => {
      freezerToggle.checked = isFreezerEnabled();
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
