/* ===== أدوات مشتركة بين المتجر ولوحة التحكم ===== */

const $ = id => document.getElementById(id);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* قراءة وكتابة قيمة داخل كائن عبر مسار نصي مثل "brand.name" */
const getPath = (obj, path) => path.split('.').reduce((a, k) => a?.[k], obj);

function setPath(obj, path, value){
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((a, k) => (a[k] ??= {}), obj);
  target[last] = value;
}

const money = (n, cur) => `${Number(n || 0).toLocaleString('ar')} ${cur || ''}`.trim();

/* استبدال {placeholders} في القالب */
function fill(tpl, vars){
  let out = String(tpl ?? '');
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v ?? '');
  return out;
}

/* يبني نص رسالة الواتساب من القوالب القابلة للتعديل في لوحة التحكم */
function buildOrder(settings, items){
  const cur = settings.currency;
  const lines = items.map(({p, qty}) => fill(settings.whatsapp.itemFormat, {
    name: p.name,
    qty,
    price: money(p.price, cur),
    subtotal: money(p.price * qty, cur),
    link: p.link ? ` — ${p.link}` : ''
  }));
  const total = items.reduce((s, {p, qty}) => s + p.price * qty, 0);
  return fill(settings.whatsapp.template, {
    items: lines.join('\n'),
    total: money(total, cur),
    orderLink: settings.whatsapp.orderLink || '',
    brand: settings.brand.name
  }).trim();
}

function waLink(number, text){
  return `https://wa.me/${String(number || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

/* تطبيق الألوان من settings.theme على المتغيرات CSS */
function applyTheme(theme = {}){
  for (const [k, v] of Object.entries(theme)) {
    document.documentElement.style.setProperty(`--${k}`, v);
  }
}

async function loadJSON(path){
  const r = await fetch(`${path}?v=${Date.now()}`, {cache: 'no-store'});
  if (!r.ok) throw new Error(`تعذّر تحميل ${path}`);
  return r.json();
}

async function sha256(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
