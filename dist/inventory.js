'use strict';

// Inventory UI shares the existing session, products and accessible dialogs.
const inventoryView={query:'',category:'all',status:'all',page:1};
const INVENTORY_PAGE_SIZE=6;
function uiIcon(name){
  const paths={
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M5 20h14"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    edit:'<path d="m14 5 5 5M4 20l4-1 12-12a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    user:'<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    exit:'<path d="M10 4H4v16h6m5-12 4 4-4 4m-6-4h12"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    left:'<path d="m14 6-6 6 6 6"/>',
    right:'<path d="m10 6 6 6-6 6"/>'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.plus}</svg>`;
}
function renderWorkspaceChrome(page){
  const staff=state.role!=='cliente';
  document.body.classList.toggle('staff-mode',staff);
  document.body.classList.toggle('inventory-page',staff&&page==='inventario');
  $('#staff-shell').hidden=!staff;
  if(!staff)return;
  $('#staff-role').value=state.role;
  $('#staff-nav').innerHTML=(roleLinks[state.role]||[]).map(([id,label])=>`<a href="#${id}" ${id===page?'aria-current="page"':''}>${label}</a>`).join('');
  $('#staff-user').textContent=state.role==='admin'?'Administración':fullName(state.staff.find(u=>u.active&&!u.deleted)||{names:'Equipo',surname:'Dumbo'});
  $('#staff-role-badge').textContent=state.role==='admin'?'Administrador':'Trabajador';
  $('#staff-avatar').innerHTML=uiIcon('user');
  $('#staff-exit').innerHTML=uiIcon('exit');
}
function inventoryStatus(p){
  const min=Number.isInteger(p.minStock)&&p.minStock>=0?p.minStock:5;
  return p.stock===0?{id:'empty',label:'Sin stock'}:p.stock<=min?{id:'critical',label:'Stock crítico'}:{id:'available',label:'Disponible'};
}
function inventoryNormalize(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim()}
function inventoryData(){
  const query=inventoryNormalize(inventoryView.query);
  const filtered=state.products.filter(p=>(!query||inventoryNormalize(p.name+' '+p.sku).includes(query))&&(inventoryView.category==='all'||p.cat===inventoryView.category)&&(inventoryView.status==='all'||inventoryStatus(p).id===inventoryView.status));
  const pages=Math.max(1,Math.ceil(filtered.length/INVENTORY_PAGE_SIZE));
  inventoryView.page=Math.max(1,Math.min(pages,inventoryView.page));
  const offset=(inventoryView.page-1)*INVENTORY_PAGE_SIZE;
  return {filtered,pages,offset,rows:filtered.slice(offset,offset+INVENTORY_PAGE_SIZE)};
}
function inventoryRows(rows){
  return rows.map(p=>{const status=inventoryStatus(p);return `<tr>
    <td><div class="inventory-thumb">${productPhoto(p)}</div></td>
    <td class="inventory-sku">${esc(p.sku)}</td>
    <td class="inventory-name"><strong>${esc(p.name)}</strong><small>${esc(p.unit)}</small></td>
    <td class="inventory-category">${esc(p.cat)}</td>
    <td class="inventory-price">${money(p.price)}</td>
    <td class="inventory-stock stock-${status.id}">${p.stock} un.</td>
    <td><span class="inventory-status status-${status.id}">${status.label}</span></td>
    <td><div class="inventory-actions"><button class="icon-button" onclick="inventoryDetail(${p.id})" aria-label="Ver producto ${esc(p.name)}" title="Ver producto">${uiIcon('eye')}</button><button class="icon-button" onclick="productForm(${p.id})" aria-label="Editar ${esc(p.name)}" title="Editar producto">${uiIcon('edit')}</button></div></td>
  </tr>`}).join('')||`<tr><td colspan="8"><div class="inventory-empty"><strong>No encontramos productos</strong><p>Prueba con otro nombre, SKU o filtro.</p><button class="secondary" onclick="clearInventoryFilters()">Limpiar filtros</button></div></td></tr>`;
}
function inventoryPagination(data){
  const selected=inventoryView.page;
  const visible=[...new Set([1,selected-1,selected,selected+1,data.pages])].filter(n=>n>=1&&n<=data.pages).sort((a,b)=>a-b);
  let last=0;
  const numbers=visible.map(n=>{const dots=last&&n-last>1?'<span class="pagination-gap" aria-hidden="true">…</span>':'';last=n;return dots+`<button onclick="inventoryGoPage(${n})" aria-label="Página ${n}" ${n===selected?'aria-current="page"':''}>${n}</button>`}).join('');
  return `<button onclick="inventoryGoPage(${selected-1})" aria-label="Página anterior" ${selected===1?'disabled':''}>${uiIcon('left')}</button>${numbers}<button onclick="inventoryGoPage(${selected+1})" aria-label="Página siguiente" ${selected===data.pages?'disabled':''}>${uiIcon('right')}</button>`;
}
function drawInventory(){
  const data=inventoryData();
  $('#inventory-rows').innerHTML=inventoryRows(data.rows);
  $('#inventory-count').innerHTML=data.filtered.length?`Mostrando <strong>${data.offset+1}–${data.offset+data.rows.length}</strong> de <strong>${data.filtered.length}</strong> ${plural(data.filtered.length).split(' ').slice(1).join(' ')}`:'Mostrando 0 productos';
  $('#inventory-pagination').innerHTML=inventoryPagination(data);
  $('#inventory-filter-count').textContent=`${plural(data.filtered.length)} ${data.filtered.length===1?'encontrado':'encontrados'}`;
}
function inventoryGoPage(n){
  inventoryView.page=n;drawInventory();
  $('#inventory-pagination [aria-current="page"]')?.focus();
}
function clearInventoryFilters(){
  Object.assign(inventoryView,{query:'',category:'all',status:'all',page:1});
  $('#inventory-search').value='';$('#inventory-category').value='all';$('#inventory-status').value='all';
  drawInventory();$('#inventory-search').focus();
}
function inventario(){
  const inventoryCategories=[...new Set([...categories,...state.products.map(p=>p.cat)])];
  return `<section class="inventory-workspace" aria-labelledby="inventory-title">
    <div class="inventory-heading"><div><h1 id="inventory-title">Gestión de Inventario</h1><p>Administra las existencias, precios y altas de productos.</p></div>
      <div class="inventory-heading-actions"><button class="inventory-import" onclick="importView()">${uiIcon('download')}Importar Excel / CSV</button><button onclick="productForm()">${uiIcon('plus')}Nuevo Producto</button></div>
    </div>
    <div class="inventory-filters" role="search" aria-label="Buscar y filtrar inventario">
      <div class="inventory-search-field">${uiIcon('search')}<label class="sr-only" for="inventory-search">Buscar por SKU o nombre de producto</label><input id="inventory-search" type="search" placeholder="Buscar por SKU o nombre de producto…" value="${esc(inventoryView.query)}" autocomplete="off"></div>
      <div class="inventory-selects"><label class="sr-only" for="inventory-category">Filtrar por categoría</label><select id="inventory-category"><option value="all">Todas las categorías</option>${inventoryCategories.map(c=>`<option value="${esc(c)}" ${inventoryView.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
      <label class="sr-only" for="inventory-status">Filtrar por estado</label><select id="inventory-status"><option value="all">Todos los estados</option>${[['available','Disponible'],['critical','Stock crítico'],['empty','Sin stock']].map(([id,label])=>`<option value="${id}" ${inventoryView.status===id?'selected':''}>${label}</option>`).join('')}</select></div>
      <span id="inventory-filter-count" class="sr-only" role="status" aria-live="polite"></span>
    </div>
    <p class="inventory-scroll-hint">Desliza la tabla para ver las columnas y acciones →</p>
    <div class="inventory-table-card">
      <div class="inventory-table-scroll" role="region" tabindex="0" aria-label="Inventario de productos; tabla desplazable">
        <table class="inventory-table"><caption class="sr-only">Productos y existencias de la sesión de demostración</caption>
          <colgroup><col class="col-image"><col class="col-sku"><col class="col-name"><col class="col-category"><col class="col-price"><col class="col-stock"><col class="col-status"><col class="col-actions"></colgroup>
          <thead><tr>${['Imagen','SKU','Nombre del producto','Categoría','Precio venta','Stock','Estado','Acciones'].map(label=>`<th scope="col">${label}</th>`).join('')}</tr></thead><tbody id="inventory-rows"></tbody>
        </table>
      </div>
      <div class="inventory-table-footer"><p id="inventory-count"></p><nav id="inventory-pagination" class="inventory-pagination" aria-label="Páginas del inventario"></nav></div>
    </div>
    <p class="inventory-session-note">Prototipo académico · Datos de ejemplo y cambios de esta sesión. Stock crítico: igual o inferior al mínimo configurado (5 unidades por defecto, como propuesta).</p>
  </section>`;
}
function bindInventory(){
  const onFilter=()=>{inventoryView.page=1;drawInventory()};
  $('#inventory-search').oninput=e=>{inventoryView.query=e.target.value;onFilter()};
  $('#inventory-category').onchange=e=>{inventoryView.category=e.target.value;onFilter()};
  $('#inventory-status').onchange=e=>{inventoryView.status=e.target.value;onFilter()};
  drawInventory();
}
function inventoryDetail(id){
  const p=product(id);if(!p)return;const status=inventoryStatus(p);
  openModal(`<div class="inventory-dialog-heading"><div><h2 id="inventory-detail-title">Detalle del producto</h2><p>${esc(p.sku)}</p></div><button class="icon-button" onclick="closeModal()" aria-label="Cerrar detalle">${uiIcon('close')}</button></div><div class="inventory-product-detail"><div class="detail-photo">${productPhoto(p)}</div><div><h3>${esc(p.name)}</h3><p>${esc(p.unit)}</p><span class="inventory-status status-${status.id}">${status.label}</span><dl><dt>Categoría</dt><dd>${esc(p.cat)}</dd><dt>Precio de venta</dt><dd>${money(p.price)}</dd><dt>Stock actual</dt><dd>${p.stock} unidades</dd><dt>Mínimo de alerta</dt><dd>${p.minStock??5} unidades</dd></dl></div></div><div class="dialog-actions"><button class="secondary" onclick="closeModal()">Cerrar</button><button onclick="closeModal();productForm(${p.id})">${uiIcon('edit')} Editar producto</button></div>`,'inventory-detail-title');
}
function productForm(id){
  const p=product(id)||null;let draftImage=p?.image||null;
  openModal(`<div class="inventory-dialog-heading"><div><h2 id="product-title">${p?'Editar producto':'Agregar nuevo producto al inventario'}</h2><p>${p?'Actualiza sus datos y existencias.':'Completa la información del producto.'}</p></div><button class="icon-button" onclick="closeModal()" aria-label="Cerrar formulario">${uiIcon('close')}</button></div><form id="productform" class="inventory-product-form" novalidate>
    <div class="form-columns">${field('product','sku','Código SKU / Barra',{value:p?.sku})}${field('product','name','Nombre del producto',{value:p?.name})}</div>
    <div class="form-columns">${field('product','cat','Categoría',{value:p?.cat||categories[0],options:[...new Set([...categories,...state.products.map(x=>x.cat)])].map(c=>[c,c])})}${field('product','unit','Presentación / unidad',{value:p?.unit,hint:'Ej.: Bolsa 1 kg, Caja 1 litro o Paquete 250 g.'})}</div>
    <div class="inventory-number-fields">${field('product','price','Precio de venta ($ CLP)',{type:'number',value:p?.price})}${field('product','stock','Stock actual',{type:'number',value:p?.stock??0})}${field('product','minStock','Mínimo de alerta',{type:'number',value:p?.minStock??5})}</div>
    <div class="inventory-image-fields"><div>${field('product','photoId','Imagen de ejemplo',{required:false,value:p?.photoId||'',options:[['','Sin imagen'],...state.products.filter(x=>x.id<=8).map(x=>[x.id,x.name])]})}<div class="field"><label for="product-image">O cargar una fotografía local</label><input id="product-image" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="product-image-hint product-image-error"><small id="product-image-hint">PNG, JPG o WebP, hasta 500 KB. Guardada solo en esta sesión.</small><p class="field-error" id="product-image-error" role="alert" hidden></p></div></div><div><div class="image-preview" id="product-image-preview" aria-label="Vista previa de imagen"></div><button type="button" id="clear-image" class="text-button">Quitar imagen local</button></div></div>
    ${formButtons('Guardar producto')}</form>`,'product-title');
  const form=$('#productform'),file=$('#product-image'),choice=form.querySelector('[name="photoId"]');
  const preview=()=>{$('#product-image-preview').innerHTML=productPhoto({name:'Vista previa del producto',image:draftImage,photoId:Number(choice.value)})};
  preview();choice.onchange=()=>{draftImage=null;file.value='';preview()};
  $('#clear-image').onclick=()=>{draftImage=null;file.value='';preview()};
  file.onchange=()=>{const selected=file.files[0],error=$('#product-image-error');error.hidden=true;if(!selected)return;if(!['image/png','image/jpeg','image/webp'].includes(selected.type)||selected.size>500*1024){error.textContent='Selecciona PNG, JPG o WebP de hasta 500 KB.';error.hidden=false;file.value='';return}const reader=new FileReader();reader.onload=()=>{draftImage=reader.result;choice.value='';preview()};reader.onerror=()=>{error.textContent='No se pudo leer la imagen. Selecciona otro archivo.';error.hidden=false};reader.readAsDataURL(selected)};
  form.onsubmit=async e=>{
    e.preventDefault();clearErrors(form);const values=Object.fromEntries(new FormData(form));let ok=true;
    for(const n of ['sku','name','unit']){values[n]=String(values[n]||'').trim();if(!values[n]){fieldError(form,n,'Completa este campo; no puede contener solo espacios.');ok=false}}
    if(state.products.some(x=>x.id!==id&&x.sku.toLowerCase()===values.sku.toLowerCase())){fieldError(form,'sku','Este SKU ya existe.');ok=false}
    const price=Number(values.price),stock=Number(values.stock),minStock=Number(values.minStock);
    for(const [name,value,min] of [['price',price,1],['stock',stock,0],['minStock',minStock,0]]){if(!String(values[name]).trim()||!Number.isInteger(value)||value<min){fieldError(form,name,min?'Ingresa un precio entero mayor que cero.':'Ingresa un número entero, cero o más.');ok=false}}
    if(!ok){form.querySelector('[aria-invalid="true"]')?.focus();return}
    if(!await ask({title:'Revisar datos del producto',text:`SKU: ${values.sku.toUpperCase()}\nProducto: ${values.name}\nCategoría: ${values.cat}\nPresentación: ${values.unit}\nPrecio: ${money(price)}\nStock: ${stock} unidades · Mínimo de alerta: ${minStock}`,action:'Confirmar datos'}))return;
    if(!await ask({title:'Guardar producto',text:`¿Está seguro de ${p?'guardar los cambios de':'registrar'} ${values.name}? Se actualizará el inventario de esta sesión.`,action:'Guardar producto'}))return;
    const data={sku:values.sku.toUpperCase(),name:values.name,unit:values.unit,cat:values.cat,price,stock,minStock,photoId:Number(values.photoId)||null,image:draftImage};
    if(!commit(()=>{if(p)Object.assign(p,data);else state.products.push({...data,id:Math.max(0,...state.products.map(x=>x.id))+1})})){showFormError(form,'No se pudo guardar. Usa una imagen de ejemplo o un archivo más pequeño.');return}
    closeModal();render();toast('Producto guardado. El catálogo refleja sus datos e imagen.');
  };
}
$('#staff-role').onchange=e=>{commit(()=>state.role=e.target.value);go(state.role==='cliente'?'catalogo':'inventario');render();scrollTop()};
render();
