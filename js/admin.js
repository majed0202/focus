/* ===== لوحة التحكم ===== */

const DRAFT_S = 'mo_draft_settings';
const DRAFT_P = 'mo_draft_products';
const GH_KEY = 'mo_gh';

let settings, products;          // المسودة التي تُعدَّل
let pubSettings, pubProducts;    // النسخة المنشورة حالياً
let editingId = '';

/* ===== الدخول ===== */
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (ADMIN_HASH.startsWith('PUT_')) {
    $('loginErr').textContent = 'لم يتم ضبط كلمة المرور بعد (راجع js/config.js)';
    return;
  }
  if (await sha256($('pw').value) === ADMIN_HASH) {
    sessionStorage.setItem('mo_admin', '1');
    start();
  } else {
    $('loginErr').textContent = 'كلمة المرور غير صحيحة';
  }
});

$('logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('mo_admin');
  sessionStorage.removeItem('mo_token');
  location.reload();
});

if (sessionStorage.getItem('mo_admin')) start();

async function start(){
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');

  try {
    [pubSettings, pubProducts] = await Promise.all([
      loadJSON('data/settings.json'),
      loadJSON('data/products.json')
    ]);
  } catch (err) {
    alert(err.message);
    pubSettings = {}; pubProducts = [];
  }

  settings = JSON.parse(localStorage.getItem(DRAFT_S) || 'null') || structuredClone(pubSettings);
  products = JSON.parse(localStorage.getItem(DRAFT_P) || 'null') || structuredClone(pubProducts);
  products.forEach((p, i) => p.order ??= i);

  fillSettingsForm();
  renderProducts();
  renderPreview();
  renderState();
  loadGhConfig();
}

/* ===== الحفظ كمسودة والحالة ===== */
function persist(){
  localStorage.setItem(DRAFT_S, JSON.stringify(settings));
  localStorage.setItem(DRAFT_P, JSON.stringify(products));
  renderState();
}

function isDirty(){
  return JSON.stringify(settings) !== JSON.stringify(pubSettings) ||
         JSON.stringify(products) !== JSON.stringify(pubProducts);
}

function renderState(){
  const d = isDirty();
  $('stateBar').textContent = d
    ? '● توجد تغييرات غير منشورة — انتقل إلى تبويب "النشر"'
    : '✓ كل التغييرات منشورة';
  $('stateBar').className = 'statebar ' + (d ? 'dirty' : 'clean');
}

/* ===== التبويبات ===== */
document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  document.querySelectorAll('.tabs [data-tab]').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('hidden', t.id !== 'tab-' + b.dataset.tab));
});

/* ===== المنتجات ===== */
const sorted = () => [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

function renderProducts(){
  const list = sorted();
  $('rows').innerHTML = list.map((p, i) => `
    <tr>
      <td>${esc(p.name)}</td>
      <td>${esc(p.category)}</td>
      <td>${money(p.price, settings.currency)}</td>
      <td>${p.stock}</td>
      <td>${p.active === false ? '<span class="off">مخفي</span>' : 'ظاهر'}</td>
      <td class="acts">
        <button class="btn sm" data-up="${esc(p.id)}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn sm" data-down="${esc(p.id)}" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn sm" data-edit="${esc(p.id)}">تعديل</button>
        <button class="btn sm" data-toggle="${esc(p.id)}">${p.active === false ? 'إظهار' : 'إخفاء'}</button>
        <button class="btn sm danger" data-del="${esc(p.id)}">حذف</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="6">لا توجد منتجات</td></tr>';

  $('sTotal').textContent = products.length;
  $('sActive').textContent = products.filter(p => p.active !== false).length;
  $('sValue').textContent = money(products.reduce((s, p) => s + p.price * p.stock, 0), settings.currency);
}

function move(id, dir){
  const list = sorted();
  list.forEach((p, i) => p.order = i);
  const i = list.findIndex(p => p.id === id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i].order, list[j].order] = [list[j].order, list[i].order];
  persist();
  renderProducts();
}

function toggleProduct(id){
  const p = products.find(x => x.id === id);
  if (!p) return;
  p.active = p.active === false;
  persist();
  renderProducts();
}

function deleteProduct(id){
  if (!confirm('حذف هذا المنتج نهائياً من المسودة؟')) return;
  products = products.filter(x => x.id !== id);
  if (editingId === id) resetProductForm();
  persist();
  renderProducts();
}

$('rows').addEventListener('click', e => {
  const d = e.target.closest('button')?.dataset;
  if (!d) return;
  if (d.up) move(d.up, -1);
  if (d.down) move(d.down, 1);
  if (d.edit) editProduct(d.edit);
  if (d.toggle) toggleProduct(d.toggle);
  if (d.del) deleteProduct(d.del);
});

const productForm = $('pForm');
const pf = name => productForm.querySelector(`[data-field="${name}"]`);

function readProductForm(){
  return {
    name: pf('name').value.trim(),
    category: pf('category').value.trim(),
    price: parseFloat(pf('price').value) || 0,
    stock: parseInt(pf('stock').value, 10) || 0,
    image: pf('image').value.trim(),
    link: pf('link').value.trim(),
    badge: pf('badge').value.trim(),
    description: pf('description').value.trim(),
    active: pf('active').checked
  };
}

function editProduct(id){
  const p = products.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  pf('name').value = p.name ?? '';
  pf('category').value = p.category ?? '';
  pf('price').value = p.price ?? 0;
  pf('stock').value = p.stock ?? 0;
  pf('image').value = p.image ?? '';
  pf('link').value = p.link ?? '';
  pf('badge').value = p.badge ?? '';
  pf('description').value = p.description ?? '';
  pf('active').checked = p.active !== false;
  $('formTitle').textContent = 'تعديل المنتج';
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function resetProductForm(){
  productForm.reset();
  editingId = '';
  pf('stock').value = 0;
  pf('active').checked = true;
  $('formTitle').textContent = 'إضافة منتج';
}

productForm.addEventListener('submit', e => {
  e.preventDefault();
  const data = readProductForm();
  if (editingId) {
    Object.assign(products.find(p => p.id === editingId), data);
  } else {
    products.push({id: 'p_' + Date.now().toString(36), order: products.length, ...data});
  }
  persist();
  resetProductForm();
  renderProducts();
  renderPreview();
});

$('resetBtn').addEventListener('click', resetProductForm);

/* ===== الإعدادات (نماذج مرتبطة بالمسارات) ===== */
const settingsForm = $('settingsForm');
const sectionsForm = $('sectionsForm');
const settingFields = () => document.querySelectorAll('#tab-settings [data-path]');

function fillSettingsForm(){
  settingFields().forEach(el => {
    const v = getPath(settings, el.dataset.path);
    if (el.type === 'checkbox') el.checked = v !== false;
    else if (el.dataset.type === 'lines') el.value = (v || []).map(l => `${l.label}|${l.url}`).join('\n');
    else el.value = v ?? '';
  });
}

function readSettingsForm(){
  settingFields().forEach(el => {
    let v;
    if (el.type === 'checkbox') {
      v = el.checked;
    } else if (el.dataset.type === 'lines') {
      v = el.value.split('\n').map(s => s.trim()).filter(Boolean).map(s => {
        const [label, ...rest] = s.split('|');
        return {label: label.trim(), url: rest.join('|').trim()};
      });
    } else {
      v = el.value;
    }
    setPath(settings, el.dataset.path, v);
  });
  persist();
  renderPreview();
  renderProducts();
}

['input', 'change'].forEach(evt => {
  document.getElementById('tab-settings').addEventListener(evt, readSettingsForm);
});

function renderPreview(){
  const sample = sorted()[0] || {name: 'منتج تجريبي', price: 100, stock: 1, link: 'https://example.com/p/1'};
  $('preview').textContent = buildOrder(settings, [{p: sample, qty: 2}]);
}

/* ===== النشر: تصدير واستيراد ===== */
function download(name, text){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('exportBtn').addEventListener('click', () => {
  download('settings.json', JSON.stringify(settings, null, 2));
  download('products.json', JSON.stringify(products, null, 2));
});

$('importBtn').addEventListener('click', () => $('imp').click());

$('imp').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const data = JSON.parse(await file.text());
  if (Array.isArray(data)) products = data;
  else settings = data;
  products.forEach((p, i) => p.order ??= i);
  fillSettingsForm();
  persist();
  renderProducts();
  renderPreview();
  e.target.value = '';
});

$('discardBtn').addEventListener('click', () => {
  if (!confirm('تجاهل كل التغييرات غير المنشورة؟')) return;
  localStorage.removeItem(DRAFT_S);
  localStorage.removeItem(DRAFT_P);
  location.reload();
});

/* ===== النشر المباشر إلى GitHub ===== */
function loadGhConfig(){
  const saved = JSON.parse(localStorage.getItem(GH_KEY) || '{}');
  $('ghOwner').value = saved.owner || '';
  $('ghRepo').value = saved.repo || '';
  $('ghBranch').value = saved.branch || 'main';
  $('ghToken').value = sessionStorage.getItem('mo_token') || '';
}

function ghStatus(msg, cls = ''){
  $('ghStatus').textContent = msg;
  $('ghStatus').className = 'status ' + cls;
}

function toBase64(str){
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}

async function ghPut(path, text, message, cfg){
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };

  let sha;
  const cur = await fetch(`${url}?ref=${encodeURIComponent(cfg.branch)}`, {headers});
  if (cur.ok) sha = (await cur.json()).sha;
  else if (cur.status !== 404) throw new Error(`قراءة ${path} فشلت (${cur.status})`);

  const body = {message, content: toBase64(text), branch: cfg.branch};
  if (sha) body.sha = sha;

  const res = await fetch(url, {method: 'PUT', headers, body: JSON.stringify(body)});
  if (!res.ok) throw new Error(`كتابة ${path} فشلت (${res.status})`);
}

async function publish(){
  const cfg = {
    owner: $('ghOwner').value.trim(),
    repo: $('ghRepo').value.trim(),
    branch: $('ghBranch').value.trim() || 'main',
    token: $('ghToken').value.trim()
  };
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    return ghStatus('أكمل اسم المستخدم والمستودع والتوكن.', 'err');
  }

  localStorage.setItem(GH_KEY, JSON.stringify({owner: cfg.owner, repo: cfg.repo, branch: cfg.branch}));
  sessionStorage.setItem('mo_token', cfg.token);
  ghStatus('جارٍ النشر...');

  try {
    await ghPut('data/settings.json', JSON.stringify(settings, null, 2), 'Update settings', cfg);
    await ghPut('data/products.json', JSON.stringify(products, null, 2), 'Update products', cfg);
    pubSettings = structuredClone(settings);
    pubProducts = structuredClone(products);
    renderState();
    ghStatus('تم النشر ✓ — قد يحتاج الموقع دقيقة أو دقيقتين للتحديث.', 'ok');
  } catch (err) {
    ghStatus('فشل النشر: ' + err.message, 'err');
  }
}

$('publishBtn').addEventListener('click', publish);
