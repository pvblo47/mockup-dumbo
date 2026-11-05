'use strict';

// Storefront only. The other workspaces continue using their existing views.
const storeAssetCache = new Map();
const storeLoadedRoutes = new Set();
let storeRenderVersion = 0;
let storePreviousRoute = '';
let storeCatalogScroll = 0;
let storeReturnProduct = null;
const STORE_NOTICE_DURATION = 10000;
const STORE_SLIDE_DURATION = 6500;
let storeNoticeTimer, storeNoticeStarted = 0, storeNoticeRemaining = 0;
let storeNoticeReturnFocus = null;
const storeCarousel = {index: 0, timer: null, paused: null, hover: false, focus: false};
let storeCategoryArrival = false;
let storeSuggestionIds = [], storeSuggestionAdded = 0, storeSuggestionReturnFocus = null;

function pauseCartNotice() {
  clearTimeout(storeNoticeTimer);
  if (storeNoticeStarted) storeNoticeRemaining = Math.max(0, storeNoticeRemaining - (Date.now() - storeNoticeStarted));
  storeNoticeStarted = 0;
}

function resumeCartNotice() {
  const notice = $('#cart-notice');
  if (!notice || notice.hidden || document.hidden || notice.matches(':hover') || notice.contains(document.activeElement)) return;
  pauseCartNotice();
  storeNoticeStarted = Date.now();
  storeNoticeTimer = setTimeout(() => dismissCartNotice(), storeNoticeRemaining);
}

function dismissCartNotice(returnFocus = false) {
  pauseCartNotice();
  const notice = $('#cart-notice');
  if (notice) notice.hidden = true;
  if (returnFocus && storeNoticeReturnFocus?.isConnected) storeNoticeReturnFocus.focus({preventScroll: true});
}

function showCartNotice(p, quantity) {
  const notice = $('#cart-notice');
  if (!notice) return;
  clearTimeout(window.toastTimer); clearTimeout(window.toastHideTimer);
  $('#toast').style.display = 'none';
  pauseCartNotice();
  // Only the message is announced; action buttons stay available without stealing focus.
  notice.innerHTML = `<div class="store-notice-top"><span class="store-notice-check">${storeIcon('check')}</span><div><strong id="cart-notice-title">Agregado a tu carrito</strong><p>${plural(quantity, 'unidad', 'unidades')} de ${esc(p.name)}</p></div><button class="store-notice-close" onclick="dismissCartNotice(true)" aria-label="Cerrar aviso de producto agregado">${storeIcon('close')}</button></div><div class="store-notice-summary"><span>${plural(cartCount(), 'unidad', 'unidades')} en tu carrito</span><strong>${money(cartTotal())}</strong></div><div class="store-notice-actions"><a class="button" href="#carrito" onclick="dismissCartNotice()">Revisar y pagar ${storeIcon('arrow')}</a><button class="secondary" onclick="dismissCartNotice(true)">Seguir comprando</button></div>`;
  notice.hidden = false;
  $('#store-live-status').textContent = `${p.name}: ${plural(quantity, 'unidad agregada', 'unidades agregadas')}. Total del carrito ${money(cartTotal())}.`;
  notice.onpointerenter = pauseCartNotice;
  notice.onpointerleave = resumeCartNotice;
  storeNoticeRemaining = STORE_NOTICE_DURATION;
  resumeCartNotice();
}

function storeRecommendedProducts(products = state.products, cart = state.cart, limit = 4) {
  const selectedCategories = new Set(products.filter(p => cart[p.id] > 0).map(p => p.cat));
  return products.filter(p => !cart[p.id] && p.stock > 0 && Number.isFinite(p.price) && p.price > 0)
    .slice().sort((a, b) => Number(selectedCategories.has(a.cat)) - Number(selectedCategories.has(b.cat)) || a.price - b.price || a.id - b.id).slice(0, limit);
}

function storeCartRecommendations() {
  const list = cartCount() ? storeRecommendedProducts() : [];
  if (!list.length) return '';
  return `<section class="store-suggestion-reminder" aria-labelledby="cart-recommendations-title"><div>${storeIcon('basket')}<div><h2 id="cart-recommendations-title">Para completar tu compra</h2><p>¿Te falta algo? Puedes volver a ver las sugerencias.</p></div></div><button id="cart-suggestions-trigger" class="secondary" onclick="openCartSuggestions(true)" aria-haspopup="dialog" aria-controls="cart-suggestions">Ver sugerencias ${storeIcon('arrow')}</button></section>`;
}

function shouldOfferCartSuggestions(seen, role, page, units, available, anotherDialogOpen) {
  return !seen && role === 'cliente' && page === 'carrito' && units > 0 && available > 0 && !anotherDialogOpen;
}

function syncCartSuggestions(page) {
  const dialog = $('#cart-suggestions');
  if (!dialog) return;
  if (state.role !== 'cliente' || page !== 'carrito') { if (dialog.open) dialog.close(); return; }
  if (shouldOfferCartSuggestions(state.cartSuggestionsSeen, state.role, page, cartCount(), storeRecommendedProducts().length, $('#modal').open || dialog.open)) openCartSuggestions();
}

function openCartSuggestions(manual = false) {
  const dialog = $('#cart-suggestions');
  if (state.role !== 'cliente' || location.hash !== '#carrito' || !cartCount() || dialog.open || $('#modal').open) return;
  const products = storeRecommendedProducts(state.products, state.cart, state.products.length);
  if (!products.length || !commit(() => {state.cartSuggestionsSeen = true;})) return;
  dismissCartNotice();
  storeSuggestionIds = products.map(p => p.id); storeSuggestionAdded = 0;
  storeSuggestionReturnFocus = manual ? document.activeElement : $('#cart-title');
  dialog.innerHTML = `<header class="cart-suggestions-header"><div><span class="store-kicker">POR SI TE FALTA ALGO</span><h2 id="cart-suggestions-title" tabindex="-1">Para completar tu compra</h2><p id="cart-suggestions-description">Recorre los productos con las flechas o desliza. Agrega solo lo que necesites.</p></div><button class="secondary cart-suggestions-close" onclick="closeCartSuggestions()" aria-label="Cerrar sugerencias">${storeIcon('close')}</button></header><div class="cart-suggestions-body"><div class="cart-suggestions-carousel" role="region" aria-roledescription="carrusel" aria-label="Productos sugeridos"><button id="suggestions-previous" class="suggestion-arrow previous" onclick="moveCartSuggestions(-1)" aria-label="Productos sugeridos anteriores" aria-controls="cart-suggestions-grid">${storeIcon('arrow')}</button><div id="cart-suggestions-grid" class="store-grid store-suggestion-grid" tabindex="0" aria-label="Deslizar productos sugeridos" aria-describedby="cart-suggestions-range">${products.map(p => storeCard(p, 'suggest')).join('')}</div><button id="suggestions-next" class="suggestion-arrow" onclick="moveCartSuggestions(1)" aria-label="Más productos sugeridos" aria-controls="cart-suggestions-grid">${storeIcon('arrow')}</button></div></div><footer class="cart-suggestions-footer"><div class="cart-suggestions-summary"><p id="cart-suggestions-status" role="status" aria-live="polite">Son opcionales. Tu carrito tiene ${plural(cartCount(), 'unidad', 'unidades')}.</p><p id="cart-suggestions-range" class="suggestion-range" role="status" aria-live="polite"></p></div><div class="cart-suggestions-actions"><button class="text-button" onclick="returnFromSuggestionsToCatalog()">Volver al catálogo</button><button id="cart-suggestions-done" class="secondary" onclick="closeCartSuggestions()">No agregar nada ${storeIcon('arrow')}</button></div></footer>`;
  dialog.showModal();
  bindCartSuggestionCarousel();
  $('#cart-suggestions-title').focus({preventScroll: true});
}

function closeCartSuggestions() { $('#cart-suggestions').close(); }

function returnFromSuggestionsToCatalog() {
  closeCartSuggestions();
  if (!commit(() => {state.search = ''; state.category = 'Todas'; state.catalogFilters = {min: '', max: '', availability: 'all', economy: false};})) return;
  storeCategoryArrival = true;
  go('catalogo');
}

function suggestionWindow(total, scrollLeft, width, cardWidth, gap) {
  if (!total || width <= 0 || cardWidth <= 0) return {first: 0, last: 0, previous: false, next: false};
  const step = cardWidth + gap, visible = Math.max(1, Math.floor((width + gap + 1) / step));
  const maximum = Math.max(0, total * step - gap - width);
  const position = Math.max(0, Math.min(maximum, scrollLeft));
  const first = Math.min(total, Math.round(position / step) + 1);
  return {first, last: Math.min(total, first + visible - 1), previous: position > 2, next: position < maximum - 2};
}

function syncCartSuggestionCarousel() {
  const track = $('#cart-suggestions-grid'), firstCard = track?.querySelector('.store-card');
  if (!firstCard) return;
  const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
  const range = suggestionWindow(storeSuggestionIds.length, track.scrollLeft, track.clientWidth, firstCard.getBoundingClientRect().width, gap);
  $('#suggestions-previous').disabled = !range.previous;
  $('#suggestions-next').disabled = !range.next;
  const label = `${range.first === range.last ? range.first : `${range.first}–${range.last}`} de ${storeSuggestionIds.length} productos sugeridos`;
  if ($('#cart-suggestions-range').textContent !== label) $('#cart-suggestions-range').textContent = label;
}

function moveCartSuggestions(direction, edge = '') {
  const track = $('#cart-suggestions-grid'), firstCard = track?.querySelector('.store-card');
  if (!firstCard) return;
  const step = firstCard.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0);
  const left = edge === 'start' ? 0 : edge === 'end' ? track.scrollWidth : track.scrollLeft + direction * step;
  track.scrollTo({left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
}

function bindCartSuggestionCarousel() {
  const track = $('#cart-suggestions-grid');
  track.onscroll = syncCartSuggestionCarousel;
  track.onkeydown = event => {
    if (event.target !== track || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    moveCartSuggestions(event.key === 'ArrowLeft' ? -1 : 1, event.key === 'Home' ? 'start' : event.key === 'End' ? 'end' : '');
  };
  syncCartSuggestionCarousel();
}

function updateCartSuggestionAfterAdd(p, quantity) {
  storeSuggestionAdded += quantity;
  // Keep the original suggestions in place: adding a product never moves the other cards.
  const track = $('#cart-suggestions-grid'), position = track.scrollLeft;
  track.innerHTML = storeSuggestionIds.map(product).filter(Boolean).map(p => storeCard(p, 'suggest')).join('');
  track.scrollLeft = position;
  syncCartSuggestionCarousel();
  $('#cart-suggestions-status').textContent = `${plural(storeSuggestionAdded, 'unidad añadida', 'unidades añadidas')}. Total del carrito: ${money(cartTotal())}.`;
  $('#cart-suggestions-done').innerHTML = `Continuar al carrito ${storeIcon('arrow')}`;
}

function storeIcon(name) {
  const paths = {
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    filter: '<path d="M4 6h16M7 12h10m-7 6h4"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/>',
    basket: '<path d="m5 9 4-6m10 6-4-6M3 9h18l-2 12H5L3 9Zm6 4v4m6-4v4"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m3 17 6-5 4 3 4-5 4 5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>'
  };
  return `<svg class="store-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
}

function storeNormalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}

function storeFilters() {
  return {min: '', max: '', availability: 'all', economy: false, ...(state.catalogFilters || {})};
}

function storeEconomy(products = state.products, limit = 4) {
  return products.filter(p => p.stock > 0 && Number.isFinite(p.price) && p.price > 0)
    .slice().sort((a, b) => a.price - b.price || a.id - b.id).slice(0, limit);
}

function storeSelection(products = state.products, options = {}) {
  const search = options.search ?? state.search;
  const category = options.category ?? state.category;
  const sort = options.sort ?? state.sort;
  const filters = {...storeFilters(), ...(options.filters || {})};
  const query = storeNormalize(search);
  let list = products.filter(p =>
    (category === 'Todas' || p.cat === category) &&
    (!query || storeNormalize(`${p.name} ${p.cat} ${p.sku || ''}`).includes(query)) &&
    (filters.min === '' || p.price >= Number(filters.min)) &&
    (filters.max === '' || p.price <= Number(filters.max)) &&
    (filters.availability !== 'available' || p.stock > 0) &&
    (filters.availability !== 'empty' || p.stock === 0));
  if (filters.economy) list = storeEconomy(list);
  else list = list.slice();
  if (sort === 'low') list.sort((a, b) => a.price - b.price || a.id - b.id);
  if (sort === 'high') list.sort((a, b) => b.price - a.price || a.id - b.id);
  if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id - b.id);
  return list;
}

// Only infer a unit price from a single, unambiguous sellable presentation.
function unitPrice(p) {
  if (!Number.isFinite(p.price) || p.price <= 0) return '';
  const match = String(p.unit || '').trim().match(/^(?:(?:bolsa|caja|botella|paquete|bandeja|saco|frasco|lata|pack)\s+)?(\d+(?:[.,]\d+)?)\s*(kg|kilogramos?|g|gramos?|l|litros?|unidades?|un\.?|u\.?)$/i);
  if (!match) return '';
  let size = Number(match[1].replace(',', '.'));
  if (!(size > 0)) return '';
  const unit = match[2].toLowerCase();
  const grams = unit === 'g' || unit.startsWith('gramo');
  if (grams) size /= 1000;
  const label = grams || unit === 'kg' || unit.startsWith('kilogramo') ? 'kg' : unit.startsWith('l') ? 'litro' : 'unidad';
  return `${money(Math.round(p.price / size))} / ${label}`;
}

function storePhotoKey(p) {
  return p.image || (p.photoId ? 'assets/catalog-products.png' : '');
}

function storePhoto(p, extra = '') {
  return `<div class="store-photo ${extra}" data-photo-id="${p.id}">${productPhoto(p)}</div>`;
}

function storeRouteAssets(id) {
  const p = id === null ? null : product(id);
  const products = id === null ? state.products : p ? [p, ...state.products.filter(x => x.id !== p.id && x.cat === p.cat)] : [];
  return [...new Set(products.map(storePhotoKey).filter(Boolean))];
}

function storeSlowMode() {
  return new URLSearchParams(location.search).get('carga') === 'lenta';
}

function storeNeedsLoading(route, id) {
  return (storeSlowMode() && !storeLoadedRoutes.has(route)) || storeRouteAssets(id).some(src => !storeAssetCache.has(src) || storeAssetCache.get(src).status === 'loading');
}

function storeSkeletonCard() {
  return '<div class="store-skeleton-card"><span class="sk sk-photo"></span><span class="sk sk-category"></span><span class="sk sk-title"></span><span class="sk sk-unit"></span><span class="sk sk-price"></span><span class="sk sk-stock"></span><span class="sk sk-button"></span></div>';
}

function storeAssetNotice() {
  return '<div class="store-asset-notice" role="status" hidden><span>Algunas imágenes no pudieron cargarse. Puedes seguir revisando los productos.</span><button type="button" class="text-button" onclick="retryStoreImages()">Reintentar imágenes</button></div>';
}

function addControl(p, scope) {
  const id = `picker-${scope}-${p.id}`;
  const remaining = Math.max(0, p.stock - (state.cart[p.id] || 0));
  const label = p.stock === 0 ? 'Agotado' : remaining === 0 ? 'Todo en tu carrito' : 'Agregar';
  return `<div class="store-purchase"><button id="open-${id}" class="full store-add" onclick="revealQuantity(${p.id},'${scope}')" aria-expanded="false" aria-controls="${id}" ${remaining ? '' : 'disabled'}>${remaining ? '<span aria-hidden="true">+</span>' : ''} ${label}<span class="sr-only"> ${esc(p.name)}</span></button><div id="${id}" class="add-picker store-add-picker" role="group" aria-label="Cantidad de ${esc(p.name)}" hidden>${quantityPicker(p, scope)}<button class="full" onclick="addSelected(${p.id},'${scope}')">Agregar al carrito</button><button class="text-button picker-cancel" onclick="hideQuantity(${p.id},'${scope}')">Cancelar<span class="sr-only"> selección de ${esc(p.name)}</span></button></div></div>`;
}

function storeCard(p, scope = 'catalog') {
  const selected = storeEconomy().some(x => x.id === p.id);
  const count = state.cart[p.id] || 0;
  return `<article class="store-card" data-product-id="${p.id}"><div class="store-card-media">${selected ? '<span class="store-price-label">Selección económica</span>' : ''}<a class="store-product-image" href="#producto/${p.id}" onclick="event.preventDefault();detail(${p.id})" aria-label="Ver detalle de ${esc(p.name)}">${storePhoto(p)}</a></div><div class="store-card-copy"><span class="store-category">${esc(p.cat)}</span><h3><a id="product-link-${scope}-${p.id}" href="#producto/${p.id}" onclick="event.preventDefault();detail(${p.id})">${esc(p.name)}</a></h3><p class="store-presentation">${esc(p.unit)}</p><strong class="store-price">${money(p.price)}</strong><span class="store-unit-price">${unitPrice(p) || '&nbsp;'}</span><span class="store-availability ${p.stock ? '' : 'is-empty'}">${p.stock ? storeIcon('check') + ' Disponible' : 'Sin stock'}</span>${addControl(p, scope)}<span class="store-in-cart">${count ? `${count} ${count === 1 ? 'unidad' : 'unidades'} en tu carrito` : '&nbsp;'}</span></div></article>`;
}

function storeGrid(products, scope, loading = false) {
  return `<div class="store-grid-wrap ${loading ? 'is-loading' : ''}" data-load-region aria-busy="${loading}"><div class="store-grid store-real-content" ${loading ? 'inert' : ''}>${products.map(p => storeCard(p, scope)).join('')}</div>${loading ? `<div class="store-grid store-skeleton-grid" aria-hidden="true">${products.map(storeSkeletonCard).join('')}</div>` : ''}</div>`;
}

function storeHeroSlides() {
  const available = state.products.filter(p => p.stock > 0);
  return [
    {key: 'economy', kicker: 'TU COMPRA EMPIEZA AQUÍ', title: 'Buenos precios.<br>Buenas compras.', description: 'Empieza por los productos más económicos del catálogo.', action: 'Ver selección económica', category: null, products: storeEconomy(available, 2)},
    {key: 'fresh', kicker: 'FRUTAS Y VERDURAS', title: 'Dale color<br>a tu lista.', description: 'Frutas para sumar a tu compra, con su presentación y precio a la vista.', action: 'Explorar frutas', category: 'Frutas y verduras', products: storeEconomy(available.filter(p => p.cat === 'Frutas y verduras'), 2)},
    {key: 'pantry', kicker: 'DESPENSA Y PANADERÍA', title: 'Lo de todos<br>los días.', description: 'Arma tu lista con básicos de despensa y panadería.', action: 'Ver despensa', category: 'Despensa', products: storeEconomy(available.filter(p => ['Despensa', 'Panadería'].includes(p.cat)), 2)}
  ].filter(slide => slide.products.length);
}

function storeHero() {
  const slides = storeHeroSlides();
  if (!slides.length) return '';
  storeCarousel.index = Math.min(storeCarousel.index, slides.length - 1);
  return `<section class="store-hero store-carousel" aria-roledescription="carrusel" aria-label="Selecciones del catálogo"><h1 class="sr-only">Compra en Dumbo Supermercados</h1><div class="store-hero-slides">${slides.map((slide, i) => `<div class="store-hero-slide hero-${slide.key} ${i === storeCarousel.index ? 'is-active' : ''}" data-slide="${i}" role="group" aria-roledescription="diapositiva" aria-label="${i + 1} de ${slides.length}" ${i === storeCarousel.index ? '' : 'inert aria-hidden="true"'}><div class="store-hero-copy"><span class="store-kicker">${slide.kicker}</span><h2>${slide.title}</h2><p>${slide.description}</p><button class="store-yellow-button" onclick="${slide.category === null ? 'showStoreEconomy()' : `browseStoreCategory(${esc(JSON.stringify(slide.category))},true)`}">${slide.action} ${storeIcon('arrow')}</button><a class="store-hero-secondary" href="#catalog-results" onclick="event.preventDefault();scrollStoreResults()">Explorar todos los productos</a></div><div class="store-hero-display">${slide.products.map((p, j) => `<a class="store-hero-product ${j ? 'secondary-spotlight' : 'primary-spotlight'}" href="#producto/${p.id}" onclick="event.preventDefault();detail(${p.id})">${storePhoto(p)}<div class="store-spotlight-label"><span>${esc(p.name)}</span><small>${esc(p.unit)}</small><strong>${money(p.price)}</strong></div></a>`).join('')}<span class="store-hero-footnote">Precios de ejemplo · CLP</span></div></div>`).join('')}</div><button class="store-carousel-arrow previous" onclick="moveStoreHero(-1)" aria-label="Imagen anterior">${storeIcon('arrow')}</button><button class="store-carousel-arrow" onclick="moveStoreHero(1)" aria-label="Imagen siguiente">${storeIcon('arrow')}</button><div class="store-carousel-controls"><div class="store-carousel-dots" role="group" aria-label="Elegir imagen del banner">${slides.map((s, i) => `<button onclick="moveStoreHero(${i},true)" aria-label="Mostrar ${s.kicker.toLocaleLowerCase('es')}" aria-pressed="${i === storeCarousel.index}" data-slide-dot="${i}"><span></span></button>`).join('')}</div><span id="store-slide-count" aria-live="off">${storeCarousel.index + 1} / ${slides.length}</span><button id="store-carousel-toggle" onclick="toggleStoreHero()" aria-label="Pausar cambio automático">Pausar</button><span id="store-carousel-status" class="sr-only" role="status"></span></div></section>`;
}

function storeCarouselCanPlay(reduced, hidden, hovered, focused, paused) {
  // A deliberate press of Reproducir can opt in; reduced motion still removes transitions.
  return !hidden && !hovered && !focused && (paused === false || (paused === null && !reduced));
}

function scheduleStoreHero() {
  clearTimeout(storeCarousel.timer);
  const hero = $('.store-carousel');
  if (!hero) return;
  const paused = storeCarousel.paused ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toggle = $('#store-carousel-toggle');
  toggle.textContent = paused ? 'Reproducir' : 'Pausar';
  toggle.setAttribute('aria-label', paused ? 'Reproducir cambio automático de imágenes' : 'Pausar cambio automático de imágenes');
  const playable = storeCarouselCanPlay(matchMedia('(prefers-reduced-motion: reduce)').matches, document.hidden, storeCarousel.hover, storeCarousel.focus, storeCarousel.paused);
  if (playable && storeHeroSlides().length > 1) storeCarousel.timer = setTimeout(() => moveStoreHero(1, false, false), STORE_SLIDE_DURATION);
}

function moveStoreHero(value, absolute = false, manual = true) {
  const count = storeHeroSlides().length;
  if (!count) return;
  storeCarousel.index = ((absolute ? value : storeCarousel.index + value) % count + count) % count;
  document.querySelectorAll('[data-slide]').forEach(slide => {
    const active = Number(slide.dataset.slide) === storeCarousel.index;
    slide.classList.toggle('is-active', active); slide.inert = !active;
    if (active) slide.removeAttribute('aria-hidden'); else slide.setAttribute('aria-hidden', 'true');
  });
  document.querySelectorAll('[data-slide-dot]').forEach(dot => dot.setAttribute('aria-pressed', Number(dot.dataset.slideDot) === storeCarousel.index ? 'true' : 'false'));
  $('#store-slide-count').textContent = `${storeCarousel.index + 1} / ${count}`;
  if (manual) $('#store-carousel-status').textContent = `Imagen ${storeCarousel.index + 1} de ${count}.`;
  scheduleStoreHero();
}

function toggleStoreHero() {
  const paused = storeCarousel.paused ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  storeCarousel.paused = !paused;
  scheduleStoreHero();
}

function bindStoreHero() {
  clearTimeout(storeCarousel.timer);
  const hero = $('.store-carousel');
  if (!hero) return;
  storeCarousel.hover = hero.matches(':hover'); storeCarousel.focus = hero.contains(document.activeElement);
  hero.onpointerenter = () => {storeCarousel.hover = true; scheduleStoreHero();};
  hero.onpointerleave = () => {storeCarousel.hover = false; scheduleStoreHero();};
  hero.addEventListener('focusin', () => {storeCarousel.focus = true; scheduleStoreHero();});
  hero.addEventListener('focusout', () => queueMicrotask(() => {storeCarousel.focus = hero.contains(document.activeElement); scheduleStoreHero();}));
  scheduleStoreHero();
}

function storeEconomySection() {
  const products = storeEconomy();
  if (!products.length) return '';
  return `<section class="store-economy" aria-labelledby="economy-title"><div class="store-section-heading"><div><span class="store-kicker">PARA EMPEZAR TU LISTA</span><h2 id="economy-title">Los más económicos</h2></div><button class="text-button store-section-link" onclick="showStoreEconomy()">Ver selección ${storeIcon('arrow')}</button></div><div class="store-economy-grid">${products.map(p => `<a class="store-economy-tile" href="#producto/${p.id}" onclick="event.preventDefault();detail(${p.id})">${storePhoto(p)}<div><h3>${esc(p.name)}</h3><span>${esc(p.unit)}</span><strong>${money(p.price)}</strong><small>Ver producto ${storeIcon('arrow')}</small></div></a>`).join('')}</div><p class="store-price-context">Selección por precio de la presentación completa, no por kilo o litro.</p></section>`;
}

function storeFilterForm(scope) {
  const filters = storeFilters();
  const cats = [...new Set([...categories, ...state.products.map(p => p.cat)])];
  return `<form class="store-filter-form" data-filter-scope="${scope}" novalidate>${scope === 'desktop' ? '<div class="store-filter-heading"><h3>Filtros</h3><button type="button" class="text-button" onclick="resetStoreFilters()">Limpiar</button></div>' : ''}<fieldset><legend>Categorías</legend>${['Todas', ...cats].map(cat => `<label class="store-radio"><input type="radio" name="category" value="${esc(cat)}" ${state.category === cat ? 'checked' : ''}><span>${cat === 'Todas' ? 'Todos los productos' : esc(cat)}</span><small>${cat === 'Todas' ? state.products.length : state.products.filter(p => p.cat === cat).length}</small></label>`).join('')}</fieldset><fieldset><legend>Precio por presentación</legend><div class="store-price-inputs"><label for="${scope}-min">Desde ($)<input id="${scope}-min" name="min" inputmode="numeric" type="number" min="0" step="1" value="${esc(filters.min)}" placeholder="Sin mínimo" aria-describedby="${scope}-price-error"></label><label for="${scope}-max">Hasta ($)<input id="${scope}-max" name="max" inputmode="numeric" type="number" min="0" step="1" value="${esc(filters.max)}" placeholder="Sin máximo" aria-describedby="${scope}-price-error"></label></div><p id="${scope}-price-error" class="field-error" role="alert" hidden></p></fieldset><fieldset><legend>Disponibilidad</legend>${[['all', 'Todos'], ['available', 'Con stock'], ['empty', 'Sin stock']].map(([value, label]) => `<label class="store-radio"><input type="radio" name="availability" value="${value}" ${filters.availability === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}</fieldset><button type="submit" class="full">${scope === 'mobile' ? 'Ver productos' : 'Aplicar filtros'}</button>${scope === 'mobile' ? '<button type="button" class="text-button full" onclick="clearStoreFilterForm(this.form)">Limpiar selección</button>' : ''}</form>`;
}

function storeChips() {
  const filters = storeFilters(), chips = [];
  if (state.search) chips.push(['search', `Búsqueda: ${state.search}`]);
  if (state.category !== 'Todas') chips.push(['category', state.category]);
  if (filters.min !== '' || filters.max !== '') chips.push(['price', `${filters.min !== '' ? 'Desde ' + money(Number(filters.min)) : 'Sin mínimo'} · ${filters.max !== '' ? 'hasta ' + money(Number(filters.max)) : 'sin máximo'}`]);
  if (filters.availability !== 'all') chips.push(['availability', filters.availability === 'empty' ? 'Sin stock' : 'Con stock']);
  if (filters.economy) chips.push(['economy', 'Selección económica']);
  return chips.length ? `<div class="store-active-filters" aria-label="Filtros activos">${chips.map(([key, label]) => `<button onclick="removeStoreFilter('${key}')" aria-label="Quitar filtro ${esc(label)}">${esc(label)} ${storeIcon('close')}</button>`).join('')}<button class="store-clear-all" onclick="resetStoreFilters()">Limpiar todos</button></div>` : '<div class="store-active-filters" aria-label="Filtros activos"></div>';
}

function storeEmpty(title = 'No encontramos productos', message = 'Prueba con otro nombre o ajusta los filtros.') {
  return `<div class="store-empty">${storeIcon('search')}<h2>${title}</h2><p>${message}</p><button onclick="resetStoreFilters()">Ver todos los productos</button></div>`;
}

function renderCatalogPage() {
  return `<div class="store-catalog-page">${storeHero()}${storeEconomySection()}${renderStoreCatalogResults()}</div>`;
}

function renderStoreCatalogResults() {
  const filters = storeFilters(), list = storeSelection();
  const loading = storeNeedsLoading('catalogo', null);
  const title = filters.economy ? 'Selección económica' : state.search ? `Resultados para “${esc(state.search)}”` : state.category === 'Todas' ? 'Todos los productos' : esc(state.category);
  return `<section id="catalog-results" class="store-catalog-section" aria-labelledby="catalog-title"><div class="store-section-heading store-catalog-title"><div><span class="store-kicker">DUMBO SUPERMERCADOS</span><h2 id="catalog-title" tabindex="-1">${title}</h2><p id="store-result-count" role="status" aria-live="polite">${plural(list.length)}${filters.economy ? ' disponibles con los menores precios de tu selección' : ' en esta selección'}</p></div><a class="store-cart-shortcut" href="#carrito">${storeIcon('basket')} Revisar carrito <span>${cartCount()}</span></a></div><div class="store-catalog-layout"><aside class="store-sidebar" aria-label="Filtros del catálogo">${storeFilterForm('desktop')}</aside><div class="store-results"><div class="store-toolbar"><button id="store-filter-button" class="secondary store-filter-button" onclick="openStoreFilters()" aria-haspopup="dialog" aria-controls="modal">${storeIcon('filter')} Filtros</button><span class="store-toolbar-count">${plural(list.length)}</span><label class="store-sort" for="sort">Ordenar por<select id="sort"><option value="default" ${state.sort === 'default' ? 'selected' : ''}>Orden del catálogo</option><option value="low" ${state.sort === 'low' ? 'selected' : ''}>Menor precio</option><option value="high" ${state.sort === 'high' ? 'selected' : ''}>Mayor precio</option><option value="name" ${state.sort === 'name' ? 'selected' : ''}>Nombre</option></select></label></div>${storeChips()}${storeAssetNotice()}${list.length ? storeGrid(list, 'catalog', loading) : storeEmpty()}<p class="store-catalog-note">Precios en pesos chilenos. Las cantidades corresponden a la presentación indicada.</p></div></div></section>`;
}

// Preserve the banner, its timer and the page geometry while only refreshing results.
function refreshStoreCatalog({focusId = '', focusCategory = false, scroll = false} = {}) {
  const section = $('#catalog-results');
  if (!section || !section.isConnected) { render(); return; }
  const active = document.activeElement;
  const radio = active?.matches('input[type="radio"]') ? {name: active.name, value: active.value} : null;
  const id = focusId || active?.id;
  const beforeTop = section.getBoundingClientRect().top;
  section.outerHTML = renderStoreCatalogResults();
  document.querySelectorAll('#nav [data-category]').forEach(button => {
    const selected = button.dataset.category === state.category;
    button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
  });
  $('#shopsearch').value = state.search;
  bindStorefront('catalogo', null); syncStoreHeader();
  const nextSection = $('#catalog-results');
  if (scroll) scrollStoreResults();
  else {
    window.scrollBy({top: nextSection.getBoundingClientRect().top - beforeTop, behavior: 'instant'});
    let nextFocus = id ? document.getElementById(id) : null;
    if (radio) nextFocus = Array.from(nextSection.querySelectorAll('input[type="radio"]')).find(input => input.name === radio.name && input.value === radio.value);
    if (focusCategory) nextFocus = Array.from(document.querySelectorAll('#nav [data-category]')).find(button => button.dataset.category === state.category);
    nextFocus?.focus({preventScroll: true});
  }
  $('.store-results')?.classList.add('store-results-updated');
  $('#store-live-status').textContent = `${plural(storeSelection().length)} en esta selección.`;
}

function browseStoreCategory(category, scroll = true) {
  if (!commit(() => {state.role = 'cliente'; state.category = category;})) return;
  if (location.hash === '#catalogo' || !location.hash) refreshStoreCatalog({focusCategory: !scroll, scroll});
  else { storeCategoryArrival = scroll; go('catalogo'); }
}

function renderStoreProduct(id) {
  const p = product(id);
  if (!p) return `<section class="store-not-found"><h1 id="store-product-title" tabindex="-1">Este producto no está disponible</h1><p>Vuelve al catálogo para revisar los productos de la sesión.</p><a class="button" href="#catalogo">Volver al catálogo</a></section>`;
  const loading = storeNeedsLoading(`producto/${id}`, id);
  const related = state.products.filter(x => x.id !== p.id && x.cat === p.cat).slice(0, 4);
  const description = p.description ? `<p>${esc(p.description)}</p>` : `<p>El precio corresponde a ${esc(p.unit.toLowerCase())}. Revisa las unidades disponibles antes de agregar a tu compra.</p>`;
  return `<div class="store-product-page"><nav class="store-breadcrumb" aria-label="Ruta de navegación"><a href="#catalogo">Catálogo</a><span aria-hidden="true">/</span><button class="text-button" onclick="setCategory(product(${p.id}).cat)">${esc(p.cat)}</button><span aria-hidden="true">/</span><span aria-current="page">${esc(p.name)}</span></nav><a class="store-back" href="#catalogo">← Volver a los resultados</a>${storeAssetNotice()}<section class="store-detail-wrap ${loading ? 'is-loading' : ''}" data-load-region aria-busy="${loading}"><div class="store-detail-layout store-real-content" ${loading ? 'inert' : ''}><div class="store-detail-image">${storePhoto(p)}</div><div class="store-detail-info"><span class="store-kicker">${esc(p.cat)}</span><h1 id="store-product-title" tabindex="-1">${esc(p.name)}</h1><p class="store-detail-unit">${esc(p.unit)}</p><span class="store-availability ${p.stock ? '' : 'is-empty'}">${p.stock ? storeIcon('check') + ` ${plural(p.stock, 'unidad disponible', 'unidades disponibles')}` : 'Sin stock'}</span><div class="store-detail-price"><strong>${money(p.price)}</strong>${unitPrice(p) ? `<span>${unitPrice(p)}</span>` : ''}<small>Precio por ${esc(p.unit.toLowerCase())}</small></div><div class="store-detail-buy">${addControl(p, 'detail')}<p class="store-detail-cart">${state.cart[p.id] ? `${plural(state.cart[p.id], 'unidad', 'unidades')} en tu carrito.` : 'Elige la cantidad después de pulsar Agregar.'}</p></div><dl class="store-product-spec"><div><dt>Código SKU</dt><dd>${esc(p.sku || 'No especificado')}</dd></div><div><dt>Presentación</dt><dd>${esc(p.unit)}</dd></div><div><dt>Categoría</dt><dd>${esc(p.cat)}</dd></div></dl></div></div>${loading ? '<div class="store-detail-skeleton" aria-hidden="true"><span class="sk sk-detail-image"></span><div><span class="sk sk-category"></span><span class="sk sk-detail-title"></span><span class="sk sk-unit"></span><span class="sk sk-price"></span><span class="sk sk-detail-button"></span></div></div>' : ''}</section><section class="store-description" aria-labelledby="product-description-title"><h2 id="product-description-title">Acerca del producto</h2>${description}</section>${related.length ? `<section class="store-related" aria-labelledby="related-title"><div class="store-section-heading"><div><span class="store-kicker">EN LA MISMA CATEGORÍA</span><h2 id="related-title">También puedes llevar</h2></div></div>${storeGrid(related, 'related', loading)}</section>` : ''}</div>`;
}

function syncStoreHeader() {
  const total = $('#header-cart-total');
  if (total) total.textContent = money(cartTotal());
  const cart = $('.cart-link');
  if (cart) cart.setAttribute('aria-label', `Carrito: ${plural(cartCount(), 'unidad', 'unidades')}, total ${money(cartTotal())}`);
  const hint = $('#navigation-hint'), nav = $('#nav');
  if (hint && nav) hint.hidden = nav.scrollWidth <= nav.clientWidth + 2;
}

function openStoreProduct(id) {
  if (state.role === 'cliente' && (location.hash === '#catalogo' || !location.hash)) {
    storeCatalogScroll = window.scrollY;
    storeReturnProduct = id;
  }
  if (!commit(() => { state.role = 'cliente'; })) return;
  go(`producto/${id}`);
  scrollTop();
}

function scrollStoreResults() {
  $('#catalog-results')?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
  $('#catalog-title')?.focus({preventScroll: true});
}

function showStoreEconomy() {
  if (!commit(() => { state.search = ''; state.category = 'Todas'; state.sort = 'low'; state.catalogFilters = {min: '', max: '', availability: 'available', economy: true}; })) return;
  if (location.hash === '#catalogo' || !location.hash) { refreshStoreCatalog({scroll: true}); }
  else go('catalogo');
}

function resetStoreFilters() {
  if (!commit(() => { state.search = ''; state.category = 'Todas'; state.sort = 'default'; state.catalogFilters = {min: '', max: '', availability: 'all', economy: false}; })) return;
  if (location.hash === '#catalogo' || !location.hash) { refreshStoreCatalog({scroll: true}); }
  else go('catalogo');
}

function removeStoreFilter(key) {
  const filters = storeFilters();
  if (!commit(() => {
    if (key === 'search') state.search = '';
    if (key === 'category') state.category = 'Todas';
    if (key === 'price') { filters.min = ''; filters.max = ''; }
    if (key === 'availability') filters.availability = 'all';
    if (key === 'economy') filters.economy = false;
    state.catalogFilters = filters;
  })) return;
  refreshStoreCatalog({focusId: 'catalog-title'});
}

function storeValidateRange(minValue, maxValue) {
  const min = String(minValue).trim(), max = String(maxValue).trim();
  if ([min, max].some(v => v !== '' && (!/^\d+$/.test(v) || !Number.isSafeInteger(Number(v))))) return {error: 'Ingresa precios enteros, cero o más.'};
  if (min !== '' && max !== '' && Number(min) > Number(max)) return {error: 'El precio mínimo no puede superar al máximo.'};
  return {min, max};
}

function applyStoreFilterForm(form) {
  const scope = form.dataset.filterScope, values = new FormData(form);
  const range = storeValidateRange(values.get('min'), values.get('max'));
  const error = form.querySelector(`#${scope}-price-error`);
  form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  if (range.error) {
    error.textContent = range.error; error.hidden = false;
    form.elements.min.setAttribute('aria-invalid', 'true'); form.elements.max.setAttribute('aria-invalid', 'true');
    form.elements.min.focus(); return false;
  }
  const filters = storeFilters();
  if (!commit(() => { state.category = values.get('category') || 'Todas'; state.catalogFilters = {...filters, min: range.min, max: range.max, availability: values.get('availability') || 'all'}; })) return false;
  if (scope === 'mobile') closeModal();
  refreshStoreCatalog({focusId: scope === 'mobile' ? 'store-filter-button' : ''});
  return true;
}

function clearStoreFilterForm(form) {
  form.elements.min.value = ''; form.elements.max.value = '';
  form.querySelector('[name="category"][value="Todas"]').checked = true;
  form.querySelector('[name="availability"][value="all"]').checked = true;
  form.querySelector('.field-error').hidden = true;
  form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
}

function openStoreFilters() {
  openModal(`<div class="store-mobile-filter-heading"><h2 id="store-filter-dialog-title">Filtrar productos</h2><button class="secondary store-close" onclick="closeModal()" aria-label="Cerrar filtros">${storeIcon('close')}</button></div>${storeFilterForm('mobile')}`, 'store-filter-dialog-title');
  const form = $('#modal').querySelector('.store-filter-form');
  form.onsubmit = event => { event.preventDefault(); applyStoreFilterForm(form); };
}

function loadStoreAsset(src) {
  if (storeAssetCache.has(src)) return storeAssetCache.get(src).promise;
  const entry = {status: 'loading', promise: null};
  storeAssetCache.set(src, entry);
  entry.promise = new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => finish(false), 8000);
    let settled = false;
    const finish = success => {
      if (settled) return; settled = true; clearTimeout(timeout);
      image.onload = image.onerror = null; entry.status = success ? 'ready' : 'error';
      success ? resolve(src) : reject(new Error('No se pudo cargar una imagen del catálogo.'));
    };
    image.onload = () => finish(true); image.onerror = () => finish(false); image.src = src;
    if (image.complete && image.naturalWidth > 0) finish(true);
  });
  return entry.promise;
}

function retryStoreImages() {
  for (const [src, entry] of storeAssetCache) if (entry.status === 'error') storeAssetCache.delete(src);
  render();
}

function bindStorefront(route, id) {
  const version = ++storeRenderVersion;
  const previous = storePreviousRoute; storePreviousRoute = route;
  const form = $('#app').querySelector('.store-filter-form');
  if (form) {
    form.onsubmit = event => { event.preventDefault(); applyStoreFilterForm(form); };
    form.querySelectorAll('input[type="radio"]').forEach(input => input.onchange = () => applyStoreFilterForm(form));
  }
  const sort = $('#sort');
  if (sort) sort.onchange = event => { if (commit(() => {state.sort = event.target.value;})) { refreshStoreCatalog({focusId: 'sort'}); } };
  const sources = storeRouteAssets(id);
  const demonstration = storeSlowMode() && !storeLoadedRoutes.has(route);
  const wait = demonstration ? new Promise(resolve => setTimeout(resolve, 650)) : Promise.resolve();
  Promise.all([Promise.allSettled(sources.map(loadStoreAsset)), wait]).then(() => {
    if (version !== storeRenderVersion || state.role !== 'cliente' || (location.hash.slice(1) || 'catalogo') !== route) return;
    storeLoadedRoutes.add(route);
    $('#app').querySelectorAll('[data-load-region]').forEach(region => {
      region.classList.remove('is-loading'); region.setAttribute('aria-busy', 'false');
      region.querySelector('.store-real-content')?.removeAttribute('inert');
      region.querySelector('.store-skeleton-grid,.store-detail-skeleton')?.remove();
    });
    const failed = sources.some(src => storeAssetCache.get(src)?.status === 'error');
    $('#app').querySelectorAll('.store-asset-notice').forEach(notice => notice.hidden = !failed);
    $('#app').querySelectorAll('[data-photo-id]').forEach(photo => {
      const p = product(Number(photo.dataset.photoId));
      if (p && storeAssetCache.get(storePhotoKey(p))?.status === 'error') photo.innerHTML = `<div class="store-image-fallback">${storeIcon('image')}<span>Imagen no disponible</span></div>`;
    });
    if (route !== previous && id !== null) $('#store-product-title')?.focus({preventScroll: true});
  });
  if (route === 'catalogo' && storeCategoryArrival) {
    storeCategoryArrival = false;
    scrollStoreResults();
  } else if (route === 'catalogo' && previous.startsWith('producto/')) {
    window.scrollTo({top: storeCatalogScroll, behavior: 'auto'});
    $(`#product-link-catalog-${storeReturnProduct}`)?.focus({preventScroll: true});
  }
}

// Browser initialization. Kept separate so the pure selectors can be tested.
$('#cart-suggestions').addEventListener('close', () => {
  if (state.role !== 'cliente' || location.hash !== '#carrito') return;
  const target = storeSuggestionReturnFocus?.isConnected ? storeSuggestionReturnFocus : document.getElementById(storeSuggestionReturnFocus?.id) || $('#cart-title');
  target?.focus({preventScroll: true});
});
$('#cart-suggestions').addEventListener('click', event => {
  if (event.target !== event.currentTarget) return;
  const box = event.currentTarget.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeCartSuggestions();
});
window.addEventListener('resize', () => {if ($('#cart-suggestions').open) syncCartSuggestionCarousel();});
$('#cart-notice').addEventListener('focusin', pauseCartNotice);
$('#cart-notice').addEventListener('focusout', () => queueMicrotask(resumeCartNotice));
document.addEventListener('visibilitychange', () => {scheduleStoreHero(); if (document.hidden) pauseCartNotice(); else resumeCartNotice();});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', scheduleStoreHero);
window.addEventListener('hashchange', () => dismissCartNotice());
$('#headersearch').onsubmit = event => {
  event.preventDefault(); const query = $('#shopsearch').value.trim();
  if (!commit(() => {state.search = query; state.role = 'cliente';})) return;
  if (location.hash === '#catalogo' || !location.hash) { refreshStoreCatalog({scroll: true}); } else go('catalogo');
};
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || $('#modal').open) return;
  const picker = document.querySelector('.store-add-picker:not([hidden])');
  if (picker) { event.preventDefault(); const [scope, id] = picker.id.replace('picker-', '').split('-'); hideQuantity(Number(id), scope); }
});
render();
