const statusEl = document.getElementById('backupStatus');
const sectionGrid = document.getElementById('sectionGrid');
const apiKeySectionEl = document.getElementById('apiKeySection');
const backupList = document.getElementById('backupList');
const backupPager = document.getElementById('backupPager');
const backupDirEl = document.getElementById('backupDir');
const openFolderBtn = document.getElementById('openBackupFolderBtn');
const refreshBtn = document.getElementById('refreshBtn');
const createBtn = document.getElementById('createBackupBtn');
const createApiKeyBtn = document.getElementById('createApiKeyBackupBtn');
const importApiKeyBtn = document.getElementById('importApiKeyBackupBtn');
const uploadBtn = document.getElementById('uploadBackupBtn');
const uploadInput = document.getElementById('backupUploadInput');
const apiKeyUploadInput = document.getElementById('apiKeyBackupUploadInput');
const labelInput = document.getElementById('backupLabel');

let sections = [];
let backups = [];
let backupPage = 1;
let backupsPerPage = Number(localStorage.getItem('backup_restore_page_size') || 5) || 5;
const sectionLabels = {};
const ASSET_SCOPE_CANVAS_REFS = 'canvas_refs';
const ASSET_SCOPE_FULL = 'full';
let assetScope = ASSET_SCOPE_FULL;

function normalizeAssetScope(value){
  return value === ASSET_SCOPE_CANVAS_REFS ? ASSET_SCOPE_CANVAS_REFS : ASSET_SCOPE_FULL;
}
function selectedAssetScope(){
  return normalizeAssetScope(sectionGrid?.querySelector('input[name="assetScope"]:checked')?.value || assetScope);
}
function setAssetScope(value){
  assetScope = normalizeAssetScope(value);
  sectionGrid?.querySelectorAll('input[name="assetScope"]').forEach(input => { input.checked = input.value === assetScope; });
}
function assetScopeLabel(scope){
  const value = normalizeAssetScope(scope);
  if(value === ASSET_SCOPE_CANVAS_REFS) return '\u4ec5\u753b\u5e03\u5f15\u7528';
  if(value === ASSET_SCOPE_FULL) return '\u5b8c\u6574\u7d20\u6750\u5e93';
  return '';
}

function isApiKeySection(id){ return id === 'api_keys'; }
const backupSectionOrder = ['software', 'global_config', 'canvas', 'assets', 'history', 'workflows'];
const backupSectionDescriptionOverrides = {
  global_config: '\u5168\u5c40\u8bbe\u7f6e\u3001base_url\u3001\u6a21\u578b\u5217\u8868\u7b49API\u670d\u52a1\u5546\u914d\u7f6e\u3002',
  canvas: '\u9879\u76ee\u5217\u8868\u3001\u6240\u6709\u753b\u5e03 JSON\u3001\u56de\u6536\u7ad9\u72b6\u6001\u4e0e\u5a92\u4f53\u9884\u89c8\u7f13\u5b58\u3002',
  workflows: '\u672c\u5730\u5de5\u4f5c\u6d41\u3001RunningHub \u5de5\u4f5c\u6d41/\u5e94\u7528\u914d\u7f6e\u3001\u5de5\u4f5c\u6d41\u7f29\u7565\u56fe\u4e0e\u6a21\u677f\u8d44\u6e90\u3002'
};
function sectionDescription(section){
  return backupSectionDescriptionOverrides[section?.id] || section?.description || '';
}
function normalSections(){
  const order = new Map(backupSectionOrder.map((id, idx) => [id, idx]));
  return (sections || [])
    .filter(s => !isApiKeySection(s.id))
    .slice()
    .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
}
function apiKeySectionDef(){ return (sections || []).find(s => isApiKeySection(s.id)); }
function backupSectionIds(b){
  const mf = b?.manifest || {};
  return (b?.sections && b.sections.length ? b.sections : (mf.sections || [])).filter(Boolean);
}
function backupHasApiKeys(b){ return backupSectionIds(b).includes('api_keys'); }
function backupHasNormalSections(b){
  const ids = backupSectionIds(b);
  return !ids.length || ids.some(id => !isApiKeySection(id));
}
function promptApiKeyPassword(action){
  const text = action === 'restore'
    ? '\u8bf7\u8f93\u5165 API Key \u5907\u4efd\u5bc6\u7801\uff0c\u5bc6\u7801\u9519\u8bef\u5c06\u65e0\u6cd5\u6062\u590d API/.env\u3002'
    : '\u8bf7\u8f93\u5165 API Key \u5907\u4efd\u5bc6\u7801\uff0cAPI/.env \u5c06\u52a0\u5bc6\u5199\u5165\u5907\u4efd\u5305\uff0c\u8bf7\u7262\u8bb0\u6b64\u5bc6\u7801\u3002';
  const password = prompt(text, '');
  if(password === null) return null;
  if(!String(password).trim()){
    alert('\u5907\u4efd API Key \u5fc5\u987b\u8f93\u5165\u5bc6\u7801');
    return null;
  }
  return password;
}
function setStatus(text, isError=false){
  if(!statusEl) return;
  statusEl.textContent = text || '\u51c6\u5907\u5c31\u7eea';
  statusEl.style.color = isError ? 'var(--br-danger)' : '';
}
function fmtSize(bytes){
  const n = Number(bytes || 0);
  if(n < 1024) return `${n} B`;
  if(n < 1024 * 1024) return `${(n/1024).toFixed(1)} KB`;
  if(n < 1024 * 1024 * 1024) return `${(n/1024/1024).toFixed(1)} MB`;
  return `${(n/1024/1024/1024).toFixed(2)} GB`;
}
function fmtTime(sec){
  const n = Number(sec || 0);
  if(!n) return '--';
  try { return new Date(n * 1000).toLocaleString(); } catch(_) { return String(sec); }
}
function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function selectedSections(scope=document){
  return Array.from(scope.querySelectorAll('input[data-section]:checked')).map(i => i.dataset.section);
}
function setSectionSelection(ids){
  const set = new Set(ids || []);
  sectionGrid.querySelectorAll('input[data-section]').forEach(input => {
    input.checked = set.has(input.dataset.section);
    input.closest('.section-card')?.classList.toggle('checked', input.checked);
  });
}
function assetScopeOptionsHtml(sectionId){
  if(sectionId !== 'assets') return '';
  const current = normalizeAssetScope(assetScope);
  return `<span class="asset-scope-options" title="\u9009\u62e9\u7d20\u6750\u5907\u4efd\u8303\u56f4">
    <span class="asset-scope-title">\u5907\u4efd\u8303\u56f4</span>
    <label class="asset-scope-option"><input type="radio" name="assetScope" value="${ASSET_SCOPE_CANVAS_REFS}" ${current === ASSET_SCOPE_CANVAS_REFS ? 'checked' : ''}><span>\u4ec5\u753b\u5e03\u5f15\u7528</span></label>
    <label class="asset-scope-option"><input type="radio" name="assetScope" value="${ASSET_SCOPE_FULL}" ${current === ASSET_SCOPE_FULL ? 'checked' : ''}><span>\u5b8c\u6574\u7d20\u6750\u5e93</span></label>
  </span>`;
}
function renderSections(preserveSelection=false){
  const previous = preserveSelection ? new Set(selectedSections(sectionGrid)) : null;
  sections.forEach(s => sectionLabels[s.id] = s.label);
  const visibleSections = normalSections();
  sectionGrid.innerHTML = visibleSections.map(s => {
    const checked = previous ? previous.has(s.id) : true;
    return `
    <div class="section-card ${checked ? 'checked' : ''}" data-section-card="${escapeHtml(s.id)}">
      <input class="section-checkbox" type="checkbox" data-section="${escapeHtml(s.id)}" ${checked ? 'checked' : ''} aria-label="${escapeHtml(s.label)}">
      <span class="section-main">
        <span class="section-name">${escapeHtml(s.label)}</span>
        <span class="section-desc">${escapeHtml(sectionDescription(s))}</span>
        ${s.warning ? `<span class="section-warning">${escapeHtml(s.warning)}</span>` : ''}
        ${assetScopeOptionsHtml(s.id)}
      </span>
    </div>`;
  }).join('');
  sectionGrid.querySelectorAll('input[data-section]').forEach(input => {
    input.addEventListener('change', () => input.closest('.section-card')?.classList.toggle('checked', input.checked));
  });
  sectionGrid.querySelectorAll('.section-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if(e.target.closest('.asset-scope-options') || e.target.matches('input[data-section]')) return;
      const input = card.querySelector('input[data-section]');
      if(!input) return;
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change', {bubbles:true}));
    });
  });
  sectionGrid.querySelectorAll('input[name="assetScope"]').forEach(input => {
    input.addEventListener('change', () => setAssetScope(input.value));
  });
}
function renderApiKeyPanel(){
  if(!apiKeySectionEl) return;
  const def = apiKeySectionDef();
  if(!def){
    apiKeySectionEl.innerHTML = '<div class="backup-empty compact">\u5f53\u524d\u540e\u7aef\u672a\u63d0\u4f9b API Key \u5907\u4efd\u5206\u7c7b\u3002</div>';
    return;
  }
  const apiBackups = backups.filter(backupHasApiKeys);
  const warning = def.warning ? `<div class="api-key-warning">${escapeHtml(def.warning)}</div>` : '';
  if(!apiBackups.length){
    apiKeySectionEl.innerHTML = `${warning}<div class="api-key-empty">\u8fd8\u6ca1\u6709\u5355\u72ec\u7684 API Key \u5907\u4efd\u3002\u70b9\u51fb\u4e0b\u65b9\u6309\u94ae\u521b\u5efa\u52a0\u5bc6\u5907\u4efd\u3002</div>`;
    return;
  }
  apiKeySectionEl.innerHTML = `${warning}<div class="api-key-list">${apiBackups.map(b => {
    const idx = backups.indexOf(b);
    const mf = b.manifest || {};
    return `<article class="api-key-backup" data-backup-index="${idx}">
      <div class="api-key-backup-main">
        <div class="api-key-backup-name">${escapeHtml(b.name)}</div>
        <div class="backup-meta">
          <span class="badge">${fmtSize(b.size)}</span>
          <span class="badge">${fmtTime(b.modified_at || mf.created_at)}</span>
        </div>
      </div>
      <div class="api-key-backup-actions">
        <button class="backup-btn primary" type="button" data-action="restore-api"><i data-lucide="shield-check"></i><span>\u6062\u590d</span></button>
        <button class="backup-btn secondary" type="button" data-action="download"><i data-lucide="download"></i><span>\u4e0b\u8f7d</span></button>
        <button class="backup-btn danger" type="button" data-action="delete"><i data-lucide="trash-2"></i><span>\u5220\u9664</span></button>
      </div>
    </article>`;
  }).join('')}</div>`;
  apiKeySectionEl.querySelectorAll('.api-key-backup').forEach(item => {
    const idx = Number(item.dataset.backupIndex);
    item.querySelector('[data-action="restore-api"]')?.addEventListener('click', () => restoreApiKeyBackup(idx));
    item.querySelector('[data-action="download"]')?.addEventListener('click', () => downloadBackup(idx));
    item.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteBackup(idx));
  });
}
function renderBackups(){
  const visibleBackups = backups.filter(backupHasNormalSections);
  const total = visibleBackups.length;
  const pageSize = Math.max(1, Number(backupsPerPage || 5));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  backupPage = Math.min(Math.max(1, Number(backupPage || 1)), totalPages);
  if(!visibleBackups.length){
    if(backupPager) backupPager.innerHTML = '';
    backupList.innerHTML = '<div class="backup-empty">\u8fd8\u6ca1\u6709\u666e\u901a\u5907\u4efd\u3002\u5de6\u4fa7\u9009\u62e9\u7c7b\u522b\u540e\u70b9\u51fb\u201c\u521b\u5efa\u5907\u4efd\u201d\u3002</div>';
    renderApiKeyPanel();
    if(window.lucide) lucide.createIcons();
    return;
  }
  const start = (backupPage - 1) * pageSize;
  const pageBackups = visibleBackups.slice(start, start + pageSize);
  if(backupPager){
    backupPager.innerHTML = `<div class="pager-summary">\u5171 ${total} \u4e2a\u5907\u4efd\uff0c\u7b2c ${backupPage}/${totalPages} \u9875</div>
      <div class="pager-controls">
        <label class="pager-size">\u6bcf\u9875
          <select id="backupPageSizeSelect" class="pager-select">
            ${[5,10,20,50].map(n => `<option value="${n}" ${pageSize === n ? 'selected' : ''}>${n}\u4e2a</option>`).join('')}
          </select>
        </label>
        <button class="tiny-btn pager-btn" type="button" data-page-action="prev" ${backupPage <= 1 ? 'disabled' : ''}>\u4e0a\u4e00\u9875</button>
        <label class="pager-jump">\u8df3\u5230
          <input id="backupPageJumpInput" class="pager-input" type="number" min="1" max="${totalPages}" value="${backupPage}">
          <span>\u9875</span>
        </label>
        <button class="tiny-btn pager-btn" type="button" data-page-action="jump">\u8df3\u8f6c</button>
        <button class="tiny-btn pager-btn" type="button" data-page-action="next" ${backupPage >= totalPages ? 'disabled' : ''}>\u4e0b\u4e00\u9875</button>
      </div>`;
    backupPager.querySelector('#backupPageSizeSelect')?.addEventListener('change', (e) => {
      backupsPerPage = Number(e.target.value || 5) || 5;
      localStorage.setItem('backup_restore_page_size', String(backupsPerPage));
      backupPage = 1;
      renderBackups();
    });
    const jumpToPage = () => {
      const input = backupPager.querySelector('#backupPageJumpInput');
      const nextPage = Math.min(totalPages, Math.max(1, Number(input?.value || backupPage) || backupPage));
      backupPage = nextPage;
      renderBackups();
    };
    backupPager.querySelector('[data-page-action="prev"]')?.addEventListener('click', () => { backupPage = Math.max(1, backupPage - 1); renderBackups(); });
    backupPager.querySelector('[data-page-action="next"]')?.addEventListener('click', () => { backupPage = Math.min(totalPages, backupPage + 1); renderBackups(); });
    backupPager.querySelector('[data-page-action="jump"]')?.addEventListener('click', jumpToPage);
    backupPager.querySelector('#backupPageJumpInput')?.addEventListener('keydown', (e) => { if(e.key === 'Enter') jumpToPage(); });
  }
  backupList.innerHTML = pageBackups.map((b) => {
    const idx = backups.indexOf(b);
    const mf = b.manifest || {};
    const sectionIds = backupSectionIds(b);
    const bSections = sectionIds.filter(id => !isApiKeySection(id));
    const checks = normalSections().map(s => {
      const available = !sectionIds.length || bSections.includes(s.id);
      return `<label class="restore-check backup-section-check ${available ? '' : 'disabled'}" title="${available ? '\u52fe\u9009\u540e\u70b9\u51fb\u6062\u590d\uff0c\u5c06\u53ea\u6062\u590d\u8be5\u7c7b\u522b' : '\u6b64\u5907\u4efd\u4e0d\u5305\u542b\u8be5\u7c7b\u522b'}">
        <input type="checkbox" data-restore-section="${escapeHtml(s.id)}" ${available ? 'checked' : ''} ${available ? '' : 'disabled'}>
        <span>${escapeHtml(s.label)}</span>
      </label>`;
    }).join('');
    return `<article class="backup-item" data-backup-index="${idx}">
      <div class="backup-item-head"><div>
        <div class="backup-name">${escapeHtml(b.name)}</div>
        <div class="backup-meta">
          <span class="badge">${fmtSize(b.size)}</span>
          <span class="badge">${fmtTime(b.modified_at || mf.created_at)}</span>
          <span class="badge">${Number(b.file_count || mf.file_count || 0)} \u4e2a\u6587\u4ef6</span>
          ${b.label ? `<span class="badge backup-label-text">${escapeHtml(b.label)}</span>` : ''}
          ${bSections.includes('assets') && mf.asset_scope ? `<span class="badge">\u7d20\u6750\uff1a${escapeHtml(assetScopeLabel(mf.asset_scope))}</span>` : ''}
        </div>
      </div></div>
      <div class="backup-sections merged"><div class="restore-checks">${checks}</div></div>
      <div class="backup-actions">
        <button class="backup-btn primary" type="button" data-action="restore"><i data-lucide="rotate-ccw"></i><span>\u6062\u590d</span></button>
        <button class="backup-btn secondary" type="button" data-action="download"><i data-lucide="download"></i><span>\u4e0b\u8f7d</span></button>
        <button class="backup-btn danger" type="button" data-action="delete"><i data-lucide="trash-2"></i><span>\u5220\u9664</span></button>
      </div>
    </article>`;
  }).join('');
  backupList.querySelectorAll('.backup-item').forEach(item => {
    const idx = Number(item.dataset.backupIndex);
    item.querySelector('[data-action="restore"]')?.addEventListener('click', () => restoreBackup(idx, item));
    item.querySelector('[data-action="download"]')?.addEventListener('click', () => downloadBackup(idx));
    item.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteBackup(idx));
  });
  renderApiKeyPanel();
  if(window.lucide) lucide.createIcons();
}
async function loadAll(options={}){
  const preserveSelection = !!options.preserveSelection;
  setStatus('\u6b63\u5728\u8bfb\u53d6\u5907\u4efd...');
  try {
    const [secRes, listRes] = await Promise.all([fetch('/api/backup-sections'), fetch('/api/backups')]);
    if(!secRes.ok) throw new Error(await secRes.text());
    if(!listRes.ok) throw new Error(await listRes.text());
    const secData = await secRes.json();
    const listData = await listRes.json();
    sections = secData.sections || [];
    backups = listData.backups || [];
    backupDirEl.textContent = listData.backup_dir ? `\u5907\u4efd\u76ee\u5f55\uff1a${listData.backup_dir}` : '';
    renderSections(preserveSelection);
    renderBackups();
    setStatus(`\u5df2\u52a0\u8f7d ${backups.length} \u4e2a\u5907\u4efd`);
    if(window.lucide) lucide.createIcons();
  } catch(err) {
    console.error(err);
    setStatus('\u8bfb\u53d6\u5931\u8d25\uff1a' + (err.message || err), true);
  }
}
async function createBackup(){
  const ids = selectedSections(sectionGrid);
  if(!ids.length){ alert('\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u5907\u4efd\u7c7b\u522b'); return; }
  createBtn.disabled = true;
  setStatus('\u6b63\u5728\u521b\u5efa\u5907\u4efd...');
  try {
    const res = await fetch('/api/backups', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sections:ids, label:labelInput.value || '', password:'', asset_scope:selectedAssetScope()})});
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.detail || res.statusText);
    setStatus('\u5907\u4efd\u5b8c\u6210\uff1a' + (data.backup?.name || ''));
    labelInput.value = '';
    await loadAll({preserveSelection:true});
  } catch(err) {
    console.error(err);
    setStatus('\u5907\u4efd\u5931\u8d25\uff1a' + (err.message || err), true);
  } finally { createBtn.disabled = false; }
}
async function createApiKeyBackup(){
  const password = promptApiKeyPassword('backup');
  if(password === null) return;
  if(createApiKeyBtn) createApiKeyBtn.disabled = true;
  setStatus('\u6b63\u5728\u521b\u5efa API Key \u52a0\u5bc6\u5907\u4efd...');
  try {
    const res = await fetch('/api/backups', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sections:['api_keys'], label:'API Key \u5907\u4efd', password})});
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.detail || res.statusText);
    setStatus('API Key \u5907\u4efd\u5b8c\u6210\uff1a' + (data.backup?.name || ''));
    await loadAll({preserveSelection:true});
  } catch(err) {
    console.error(err);
    setStatus('API Key \u5907\u4efd\u5931\u8d25\uff1a' + (err.message || err), true);
  } finally { if(createApiKeyBtn) createApiKeyBtn.disabled = false; }
}
async function uploadBackupFile(file, options={}){
  if(!file) return null;
  const statusText = options.statusText || '\u6b63\u5728\u5bfc\u5165\u5907\u4efd\u5305...';
  setStatus(statusText);
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/backups/upload', {method:'POST', body:form});
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.detail || res.statusText);
  return data.backup || file.name;
}
async function uploadBackup(){
  const file = uploadInput.files && uploadInput.files[0];
  if(!file) return;
  try {
    const importedName = await uploadBackupFile(file);
    setStatus('\u5df2\u5bfc\u5165\uff1a' + importedName);
    uploadInput.value = '';
    await loadAll();
  } catch(err) { console.error(err); setStatus('\u5bfc\u5165\u5931\u8d25\uff1a' + (err.message || err), true); }
}
async function importAndRestoreApiKeyBackup(){
  const file = apiKeyUploadInput?.files && apiKeyUploadInput.files[0];
  if(!file) return;
  try {
    if(!confirm(`\u5c06\u5bfc\u5165 API Key \u5907\u4efd\u5305\u5e76\u6062\u590d\u5230 API/.env\u3002\n${file.name}\n\n\u6062\u590d\u524d\u4f1a\u81ea\u52a8\u521b\u5efa\u5b89\u5168\u5907\u4efd\uff0c\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f`)){
      apiKeyUploadInput.value = '';
      return;
    }
    if(importApiKeyBtn) importApiKeyBtn.disabled = true;
    const importedName = await uploadBackupFile(file, {statusText:'\u6b63\u5728\u5bfc\u5165 API Key \u5907\u4efd\u5305...'});
    apiKeyUploadInput.value = '';
    await loadAll();
    const idx = backups.findIndex(b => b.name === importedName);
    if(idx < 0) throw new Error('\u5df2\u5bfc\u5165\uff0c\u4f46\u672a\u5728\u5217\u8868\u4e2d\u627e\u5230\u8be5\u5907\u4efd');
    if(!backupHasApiKeys(backups[idx])) throw new Error('\u8be5\u5907\u4efd\u5305\u4e0d\u5305\u542b API Key \u5185\u5bb9');
    setStatus('\u5df2\u5bfc\u5165\uff1a' + importedName + '\uff0c\u5373\u5c06\u6062\u590d API Key...');
    await restoreApiKeyBackup(idx, {skipConfirm:true});
  } catch(err) {
    console.error(err);
    setStatus('API Key \u5bfc\u5165/\u6062\u590d\u5931\u8d25\uff1a' + (err.message || err), true);
  } finally {
    if(apiKeyUploadInput) apiKeyUploadInput.value = '';
    if(importApiKeyBtn) importApiKeyBtn.disabled = false;
  }
}
function restoreSelectedSections(item){ return Array.from(item.querySelectorAll('input[data-restore-section]:checked')).map(i => i.dataset.restoreSection); }
async function restoreBackup(idx, item){
  const b = backups[idx];
  const ids = restoreSelectedSections(item).filter(id => !isApiKeySection(id));
  if(!b || !ids.length){ alert('\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u6062\u590d\u7c7b\u522b'); return; }
  const names = ids.map(id => sectionLabels[id] || id).join('\u3001');
  if(!confirm(`\u786e\u5b9a\u8981\u6062\u590d\u5907\u4efd\uff1f\n${b.name}\n\n\u6062\u590d\u5185\u5bb9\uff1a${names}`)) return;
  if(ids.includes('software') && !confirm('\u6062\u590d\u8f6f\u4ef6\u4f1a\u8986\u76d6\u7a0b\u5e8f\u6587\u4ef6\uff0c\u6062\u590d\u540e\u5efa\u8bae\u91cd\u542f\u670d\u52a1\u3002\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f')) return;
  setStatus('\u6b63\u5728\u6062\u590d...');
  try {
    const res = await fetch(`/api/backups/${encodeURIComponent(b.name)}/restore`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sections:ids, create_safety_backup:false, password:''})});
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.detail || res.statusText);
    const msg = `\u5df2\u6062\u590d ${data.count || 0} \u4e2a\u6587\u4ef6` + (data.safety_backup ? `\uff0c\u5b89\u5168\u5907\u4efd\uff1a${data.safety_backup}` : '') + (data.restart_required ? '\u3002\u5efa\u8bae\u91cd\u542f\u670d\u52a1\u3002' : '');
    setStatus(msg); alert(msg); await loadAll();
  } catch(err) { console.error(err); setStatus('\u6062\u590d\u5931\u8d25\uff1a' + (err.message || err), true); }
}
async function restoreApiKeyBackup(idx, options={}){
  const b = backups[idx];
  if(!b) return;
  if(!options.skipConfirm && !confirm(`\u786e\u5b9a\u6062\u590d API Key?\n${b.name}\n\n\u5c06\u8986\u76d6 API/.env`)) return;
  const password = promptApiKeyPassword('restore');
  if(password === null) return;
  setStatus('\u6b63\u5728\u6062\u590d API Key...');
  try {
    const res = await fetch(`/api/backups/${encodeURIComponent(b.name)}/restore`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sections:['api_keys'], create_safety_backup:false, password})});
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.detail || res.statusText);
    const msg = `API Key \u5df2\u6062\u590d ${data.count || 0} \u4e2a\u6587\u4ef6` + (data.safety_backup ? `\uff0c\u5b89\u5168\u5907\u4efd\uff1a${data.safety_backup}` : '');
    setStatus(msg); alert(msg); await loadAll();
  } catch(err) { console.error(err); setStatus('API Key \u6062\u590d\u5931\u8d25\uff1a' + (err.message || err), true); }
}
function downloadBackup(idx){ const b = backups[idx]; if(!b) return; window.location.href = `/api/backups/${encodeURIComponent(b.name)}/download`; }
async function openBackupFolder(){
  if(openFolderBtn) openFolderBtn.disabled = true;
  setStatus('\u6b63\u5728\u6253\u5f00\u5907\u4efd\u6587\u4ef6\u5939...');
  try {
    const res = await fetch('/api/backup-folder/open', {method:'POST'});
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.detail || res.statusText);
    setStatus('\u5df2\u6253\u5f00\u5907\u4efd\u6587\u4ef6\u5939' + (data.path ? `\uff1a${data.path}` : ''));
  } catch(err) { console.error(err); setStatus('\u6253\u5f00\u6587\u4ef6\u5939\u5931\u8d25\uff1a' + (err.message || err), true); }
  finally { if(openFolderBtn) openFolderBtn.disabled = false; }
}
async function deleteBackup(idx){
  const b = backups[idx];
  if(!b) return;
  if(!confirm(`\u786e\u5b9a\u5220\u9664\u5907\u4efd\uff1f\n${b.name}`)) return;
  setStatus('\u6b63\u5728\u5220\u9664...');
  try {
    const res = await fetch(`/api/backups/${encodeURIComponent(b.name)}`, {method:'DELETE'});
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.detail || res.statusText);
    setStatus('\u5df2\u5220\u9664\uff1a' + b.name);
    await loadAll();
  } catch(err) { console.error(err); setStatus('\u5220\u9664\u5931\u8d25\uff1a' + (err.message || err), true); }
}
document.querySelectorAll('[data-preset]').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = btn.dataset.preset;
    if(p === 'core') { setSectionSelection(['canvas','assets']); setAssetScope(ASSET_SCOPE_CANVAS_REFS); }
    else if(p === 'user') { setSectionSelection(['global_config','canvas','assets','history','workflows']); setAssetScope(ASSET_SCOPE_FULL); }
    else if(p === 'all') { setSectionSelection(normalSections().map(s => s.id)); setAssetScope(ASSET_SCOPE_FULL); }
    else { setSectionSelection([]); setAssetScope(ASSET_SCOPE_FULL); }
  });
});
openFolderBtn?.addEventListener('click', openBackupFolder);
refreshBtn?.addEventListener('click', loadAll);
createBtn?.addEventListener('click', createBackup);
createApiKeyBtn?.addEventListener('click', createApiKeyBackup);
importApiKeyBtn?.addEventListener('click', () => apiKeyUploadInput?.click());
uploadBtn?.addEventListener('click', () => uploadInput.click());
uploadInput?.addEventListener('change', uploadBackup);
apiKeyUploadInput?.addEventListener('change', importAndRestoreApiKeyBackup);
loadAll();




