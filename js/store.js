/* ===== منطق المتجر ===== */

let settings = {};
let products = [];
let cart = JSON.parse(localStorage.getItem('mo_cart') || '[]');

const activeProducts = () => products
  .filter(p => p.active !== false)
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const findProduct = id => products.find(p => p.id === id);

init();

async function init(){
  try {
    [settings, products] = await Promise.all([
      loadJSON('data/settings.json'),
      loadJSON('data/products.json')
    ]);
  } catch (err) {
    $('grid').innerHTML = `<p class="empty">${esc(err.message)}</p>`;
    return;
  }
  applyTheme(settings.theme);
  bindTexts();
  renderSections();
  renderNav();
  renderGrid();
  renderCart();
}

/* نصوص قابلة للتعديل من data-bind */
function bindTexts(){
  document.querySelectorAll('[data-bind]').forEach(el => {
    const v = getPath(settings, el.dataset.bind) ?? '';
    el.textContent = String(v).replace('{year}', new Date().getFullYear());
  });
  document.title = settings.brand?.name || 'المتجر';
}

function renderSections(){
  document.querySelectorAll('[data-section]').forEach(el => {
    el.hidden = settings.sections?.[el.dataset.section] === false;
  });
}

function renderNav(){
  $('nav').innerHTML = (settings.links || [])
    .map(l => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join('');
}

function renderGrid(){
  const list = activeProducts();
  $('grid').innerHTML = list.length ? list.map(p => {
    const out = Number(p.stock) <= 0;
    return `
    <article class="card">
      ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
      <div class="img" style="background-image:url('${esc(p.image)}')"></div>
      <div class="info">
        <small>${esc(p.category)}</small>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.description)}</p>
        <div class="row">
          <span class="price">${money(p.price, settings.currency)}</span>
          ${out ? '<span class="sold">نفد المخزون</span>' : ''}
        </div>
        <div class="actions">
          <button class="btn" data-add="${esc(p.id)}" ${out ? 'disabled' : ''}>أضف للسلة</button>
          <button class="btn solid" data-buy="${esc(p.id)}" ${out ? 'disabled' : ''}>اطلب واتساب</button>
        </div>
      </div>
    </article>`;
  }).join('') : '<p class="empty">لا توجد منتجات حالياً.</p>';
}

/* ===== السلة ===== */
function saveCart(){
  localStorage.setItem('mo_cart', JSON.stringify(cart));
  renderCart();
}

function addToCart(id){
  const item = cart.find(c => c.id === id);
  item ? item.qty++ : cart.push({id, qty: 1});
  saveCart();
  toggleCart(true);
}

function changeQty(id, delta){
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  cart = cart.filter(c => c.qty > 0);
  saveCart();
}

function removeFromCart(id){
  cart = cart.filter(c => c.id !== id);
  saveCart();
}

function cartItems(){
  return cart.map(c => ({p: findProduct(c.id), qty: c.qty})).filter(x => x.p);
}

function renderCart(){
  const items = cartItems();
  const total = items.reduce((s, {p, qty}) => s + p.price * qty, 0);
  const count = items.reduce((s, {qty}) => s + qty, 0);

  $('items').innerHTML = items.length ? items.map(({p, qty}) => `
    <div class="item">
      <span>${esc(p.name)}</span>
      <span class="qty">
        <button data-dec="${esc(p.id)}">−</button>
        ${qty}
        <button data-inc="${esc(p.id)}">+</button>
        <button class="rm" data-remove="${esc(p.id)}">✕</button>
      </span>
    </div>`).join('') : '<p class="empty">السلة فارغة</p>';

  $('total').textContent = money(total, settings.currency);
  $('count').textContent = count;
}

function toggleCart(open){
  $('drawer').classList.toggle('open', open);
  $('overlay').classList.toggle('open', open);
}

/* ===== الطلب عبر واتساب ===== */
function openWhatsApp(items){
  const text = buildOrder(settings, items);
  window.open(waLink(settings.whatsapp.number, text), '_blank');
}

function buyNow(id){
  const p = findProduct(id);
  if (p) openWhatsApp([{p, qty: 1}]);
}

function checkout(){
  const items = cartItems();
  if (!items.length) return alert('السلة فارغة');
  openWhatsApp(items);
}

/* ===== الأحداث ===== */
$('grid').addEventListener('click', e => {
  const add = e.target.closest('[data-add]')?.dataset.add;
  const buy = e.target.closest('[data-buy]')?.dataset.buy;
  if (add) addToCart(add);
  if (buy) buyNow(buy);
});

$('items').addEventListener('click', e => {
  const d = e.target.closest('button')?.dataset;
  if (!d) return;
  if (d.inc) changeQty(d.inc, 1);
  if (d.dec) changeQty(d.dec, -1);
  if (d.remove) removeFromCart(d.remove);
});

$('cartBtn').addEventListener('click', () => toggleCart(true));
$('closeCart').addEventListener('click', () => toggleCart(false));
$('overlay').addEventListener('click', () => toggleCart(false));
$('checkoutBtn').addEventListener('click', checkout);
