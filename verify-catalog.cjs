const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const nodes = new Map(), storage = new Map();
const stub = () => ({textContent:'',innerHTML:'',value:'',hidden:true,style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},focus(){},close(){},isConnected:true});
let imagesCreated = 0;
class TestImage {
  constructor() {imagesCreated++; this.complete = false; this.naturalWidth = 0;}
  set src(value) {queueMicrotask(() => {this.complete = true; if(value === 'bad.png') this.onerror?.(); else {this.naturalWidth=100; this.onload?.();}});}
}
const context = {console,Intl,URL,URLSearchParams,Blob,Date,setTimeout,clearTimeout,Image:TestImage,
  location:{hash:'#catalogo',search:''},
  sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  document:{querySelector:s=>{if(!nodes.has(s))nodes.set(s,stub());return nodes.get(s);}},
  window:{scrollTo(){},scrollY:0},matchMedia:()=>({matches:true})};
vm.createContext(context);
for (const [file, split] of [['dumbo.js',"$('#headersearch').onsubmit"],['fusion.js',null],['inventory.js',"$('#staff-role').onchange"],['storefront.js','// Browser initialization.']]) {
  let source = fs.readFileSync(__dirname+'/dist/'+file,'utf8');
  if (split) source=source.split(split)[0];
  vm.runInContext(source, context, {filename:file});
}
const run = code=>vm.runInContext(code,context);
const plain = code=>JSON.parse(JSON.stringify(run(code)));
const reset = ()=>run("state=seedState(); state.catalogFilters={min:'',max:'',availability:'all',economy:false};");
(async()=>{
  reset();
  assert.deepEqual(plain('storeEconomy().map(p=>p.id)'),[2,4,5,8]);
  assert.deepEqual(plain('state.products.map(p=>p.id)'),[1,2,3,4,5,6,7,8]);
  assert.deepEqual(plain("storeSelection(state.products,{search:'PLATANO'}).map(p=>p.id)"),[5]);
  assert.deepEqual(plain("storeSelection(state.products,{search:'LAC-001'}).map(p=>p.id)"),[2]);
  assert.deepEqual(plain("storeSelection(state.products,{category:'Lácteos',filters:{min:'1000',max:'2000',availability:'available'}}).map(p=>p.id)"),[2]);
  assert.equal(run("storeSelection(state.products,{search:'zz-no-existe'}).length"),0);
  assert.deepEqual(plain("storeSelection(state.products,{filters:{availability:'empty'}}).map(p=>p.id)"),[7]);
  assert.deepEqual(plain("storeSelection(state.products,{sort:'low'}).map(p=>p.id)"),[2,4,5,8,1,3,6,7]);
  assert.deepEqual(plain("storeSelection(state.products,{sort:'name'}).map(p=>p.id)"),[4,8,7,2,1,3,5,6]);
  assert.deepEqual(plain("storeSelection(state.products,{category:'Lácteos',filters:{economy:true}}).map(p=>p.id)"),[2,6]);
  assert.ok(run("Boolean(storeValidateRange('2000','1000').error)"));
  assert.ok(run("Boolean(storeValidateRange('1.5','').error)"));
  assert.ok(run("Boolean(storeValidateRange('-1','').error)"));
  assert.deepEqual(plain("storeValidateRange(' 1000 ','2000')"),{min:'1000',max:'2000'});
  assert.equal(run('unitPrice(product(3))'),'$4.380 / kg');
  assert.equal(run('unitPrice(product(8))'),'$1.193 / litro');
  assert.equal(run("unitPrice({price:1000,unit:'Pack 2 x 500 g'})"),'');
  assert.equal(run("unitPrice({price:1000,unit:'Presentación desconocida'})"),'');
  assert.ok(run("addControl(product(1),'catalog').includes('hidden')"));
  assert.ok(run("addControl(product(7),'catalog').includes('disabled')"));
  assert.ok(run("renderStoreProduct(999).includes('Este producto no está disponible')"));
  run("state.search='<img src=x onerror=alert(1)>'");
  assert.ok(run("renderCatalogPage().includes('&lt;img')"));
  assert.ok(!run("renderCatalogPage().includes('<img src=x')"));
  reset();
  run('render=()=>{};toast=()=>{};pulseCart=()=>{}');
  assert.equal(run('add(1,0)'),false); assert.equal(run('add(1,1.5)'),false);
  assert.equal(run('add(1,2)'),true); assert.equal(run('cartCount()'),2);
  assert.equal(run('add(1,23)'),false); assert.equal(run('cartCount()'),2);
  assert.equal(run('add(1,22)'),true); assert.equal(run('add(1,1)'),false);
  assert.ok(run("addControl(product(1),'catalog').includes('Todo en tu carrito')"));
  const before=run('cartCount()');run("storeSelection(state.products,{sort:'high',filters:{availability:'empty'}})");assert.equal(run('cartCount()'),before);
  reset();run("state.search='leche';state.category='Lácteos';state.catalogFilters={min:'1000',max:'2000',availability:'available',economy:false};state.cart={1:2}");
  run("removeStoreFilter('price')");assert.deepEqual(plain('storeFilters()'),{min:'',max:'',availability:'available',economy:false});
  assert.equal(run('state.search'),'leche');assert.equal(run('state.category'),'Lácteos');assert.equal(run('cartCount()'),2);
  run("removeStoreFilter('search')");assert.equal(run('state.search'),'');assert.equal(run('state.category'),'Lácteos');
  run("removeStoreFilter('availability')");assert.equal(run('storeFilters().availability'),'all');
  run("removeStoreFilter('category')");assert.equal(run('state.category'),'Todas');
  reset();run('product(1).photoId=null');assert.ok(run("renderStoreProduct(1).includes('Sin imagen')"));
  reset();run('product(2).price=9000;product(2).stock=0');
  assert.deepEqual(plain('storeEconomy().map(p=>p.id)'),[4,5,8,1]);
  assert.ok(run('renderCatalogPage().includes("$9.000")'));
  reset();
  await assert.rejects(run("loadStoreAsset('bad.png')"));
  assert.equal(run("storeAssetCache.get('bad.png').status"),'error');
  await run("loadStoreAsset('assets/catalog-products.png')");
  const count=imagesCreated;
  await run("loadStoreAsset('assets/catalog-products.png')");assert.equal(imagesCreated,count);
  assert.equal(run("storeNeedsLoading('catalogo',null)"),false);
  run("location.search='?carga=lenta'");assert.equal(run("storeNeedsLoading('catalogo',null)"),true);
  run("storeLoadedRoutes.add('catalogo')");assert.equal(run("storeNeedsLoading('catalogo',null)"),false);
  console.log('PASS: catálogo combinado, economía dinámica, precios por unidad, entradas inválidas, stock acumulado, seguridad de texto, detalle inexistente y carga de imágenes con éxito/error/caché.');
})().catch(error=>{console.error(error);process.exitCode=1;});
