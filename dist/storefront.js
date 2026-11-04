'use strict';

// Storefront only. The other workspaces continue using their existing views.
const storeAssetCache = new Map();
const storeLoadedRoutes = new Set();
let storeRenderVersion = 0;
let storePreviousRoute = '';
let storeCatalogScroll = 0;
let storeReturnProduct = null;

function storeIcon(name) {
  const paths = {
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
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

function storeHero() {
  const products = storeEconomy();
  if (!products.length) return '';
  const first = products[0], second = products[1];
  return `<section class="store-hero" aria-labelledby="store-hero-title"><div class="store-hero-copy"><span class="store-kicker">TU COMPRA EMPIEZA AQUÍ</span><h1 id="store-hero-title">Los más económicos<br>del catálogo<span>.</span></h1><p>Una selección de productos disponibles,<br class="desktop-only"> ordenados por el precio de su presentación.</p><button class="store-yellow-button" onclick="showStoreEconomy()">Ver selección económica ${storeIcon('arrow')}</button><a class="store-hero-secondary" href="#catalog-results" onclick="event.preventDefault();scrollStoreResults()">Explorar todos los productos</a></div><div class="store-hero-display"><a class="store-hero-product primary-spotlight" href="#producto/${first.id}" onclick="event.preventDefault();detail(${first.id})">${storePhoto(first)}<div class="store-spotlight-label"><span>${esc(first.name)}</span><small>${esc(first.unit)}</small><strong>${money(first.price)}</strong></div></a>${second ? `<a class="store-hero-product secondary-spotlight" href="#producto/${second.id}" onclick="event.preventDefault();detail(${second.id})">${storePhoto(second)}<div class="store-spotlight-label"><span>${esc(second.name)}</span><small>${esc(second.unit)}</small><strong>${money(second.price)}</strong></div></a>` : ''}<span class="store-hero-footnote">Precios de ejemplo · CLP</span></div></section>`;
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
  return chips.length ? `<div class="store-active-filters" aria-label="Filtros activos">${chips.map(([key, label]) => `<button onclick="removeStoreFilter('${key}')" aria-label="Quitar filtro ${esc(label)}">${esc(label)} ${storeIcon('close')}</button>`).join('')}<button class="store-clear-all" onclick="resetStoreFilters()">Limpiar todos</button></div>` : '';
}

function storeEmpty(title = 'No encontramos productos', message = 'Prueba con otro nombre o ajusta los filtros.') {
  return `<div class="store-empty">${storeIcon('search')}<h2>${title}</h2><p>${message}</p><button onclick="resetStoreFilters()">Ver todos los productos</button></div>`;
}

function renderCatalogPage() {
  const filters = storeFilters(), list = storeSelection();
  const landing = !state.search && state.category === 'Todas' && filters.min === '' && filters.max === '' && filters.availability === 'all' && !filters.economy;
  const loading = storeNeedsLoading('catalogo', null);
  const title = filters.economy ? 'Selección económica' : state.search ? `Resultados para “${esc(state.search)}”` : state.category === 'Todas' ? 'Todos los productos' : esc(state.category);
  return `<div class="store-catalog-page">${landing ? storeHero() + storeEconomySection() : '<nav class="store-breadcrumb" aria-label="Ruta de navegación"><a href="#catalogo" onclick="event.preventDefault();resetStoreFilters()">Inicio</a><span aria-hidden="true">/</span><span>Catálogo</span></nav>'}<section id="catalog-results" class="store-catalog-section" aria-labelledby="catalog-title"><div class="store-section-heading store-catalog-title"><div><span class="store-kicker">DUMBO SUPERMERCADOS</span><h2 id="catalog-title" tabindex="-1">${title}</h2><p id="store-result-count" role="status" aria-live="polite">${plural(list.length)}${filters.economy ? ' disponibles con los menores precios de tu selección' : ' en esta selección'}</p></div><a class="store-cart-shortcut" href="#carrito">${storeIcon('basket')} Revisar carrito <span>${cartCount()}</span></a></div><div class="store-catalog-layout"><aside class="store-sidebar" aria-label="Filtros del catálogo">${storeFilterForm('desktop')}</aside><div class="store-results"><div class="store-toolbar"><button id="store-filter-button" class="secondary store-filter-button" onclick="openStoreFilters()" aria-haspopup="dialog" aria-controls="modal">${storeIcon('filter')} Filtros</button><span class="store-toolbar-count">${plural(list.length)}</span><label class="store-sort" for="sort">Ordenar por<select id="sort"><option value="default" ${state.sort === 'default' ? 'selected' : ''}>Orden del catálogo</option><option value="low" ${state.sort === 'low' ? 'selected' : ''}>Menor precio</option><option value="high" ${state.sort === 'high' ? 'selected' : ''}>Mayor precio</option><option value="name" ${state.sort === 'name' ? 'selected' : ''}>Nombre</option></select></label></div>${storeChips()}${storeAssetNotice()}${list.length ? storeGrid(list, 'catalog', loading) : storeEmpty()}<p class="store-catalog-note">Precios en pesos chilenos. Las cantidades corresponden a la presentación indicada.</p></div></div></section></div>`;
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
  if (location.hash === '#catalogo' || !location.hash) { render(); scrollStoreResults(); }
  else go('catalogo');
}

function resetStoreFilters() {
  if (!commit(() => { state.search = ''; state.category = 'Todas'; state.sort = 'default'; state.catalogFilters = {min: '', max: '', availability: 'all', economy: false}; })) return;
  if (location.hash === '#catalogo' || !location.hash) { render(); scrollStoreResults(); }
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
  render(); $('#catalog-title')?.focus({preventScroll: true});
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
  render();
  if (scope === 'mobile') $('#store-filter-button')?.focus();
  else $('#catalog-title')?.focus({preventScroll: true});
  toast(plural(storeSelection().length) + ' en tu selección.');
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
  if (sort) sort.onchange = event => { if (commit(() => {state.sort = event.target.value;})) { render(); $('#sort')?.focus(); } };
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
  if (route === 'catalogo' && previous.startsWith('producto/')) {
    window.scrollTo({top: storeCatalogScroll, behavior: 'auto'});
    $(`#product-link-catalog-${storeReturnProduct}`)?.focus({preventScroll: true});
  }
}

// Browser initialization. Kept separate so the pure selectors can be tested.
$('#headersearch').onsubmit = event => {
  event.preventDefault(); const query = $('#shopsearch').value.trim();
  if (!commit(() => {state.search = query; state.role = 'cliente';})) return;
  if (location.hash === '#catalogo' || !location.hash) { render(); scrollStoreResults(); } else go('catalogo');
};
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || $('#modal').open) return;
  const picker = document.querySelector('.store-add-picker:not([hidden])');
  if (picker) { const [scope, id] = picker.id.replace('picker-', '').split('-'); hideQuantity(Number(id), scope); }
});
render();
