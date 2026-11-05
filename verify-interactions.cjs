const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const nodes = new Map(), timers = new Map(), storage = new Map();
let now = 1000, timerId = 0, selectedText = 0;
function node(selector) {
  if (!nodes.has(selector)) nodes.set(selector, {
    hidden: true, innerHTML: '', textContent: '', value: '', hovered: false, isConnected: true, style: {},
    classList: {add(){}, remove(){}, toggle(){}}, attributes: {},
    setAttribute(k,v){this.attributes[k]=v;}, removeAttribute(k){delete this.attributes[k];},
    matches(){return this.hovered;}, contains(el){return el === this;},
    focus(){context.document.activeElement=this;}, select(){selectedText++;}
  });
  return nodes.get(selector);
}
class ClockDate extends Date { static now(){return now;} }
const context = {
  console, Intl, URL, URLSearchParams, Blob, Date: ClockDate, queueMicrotask,
  setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,at:now+ms});return id;},
  clearTimeout(id){timers.delete(id);},
  location:{hash:'#catalogo',search:''}, window:{scrollY:0,scrollTo(){}},
  sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  document:{hidden:false,activeElement:null,querySelector:node,querySelectorAll:()=>[]},
  matchMedia:()=>({matches:false})
};
vm.createContext(context);
for (const [file, marker] of [['dumbo.js',"$('#headersearch').onsubmit"],['fusion.js',null],['inventory.js',"$('#staff-role').onchange"],['storefront.js','// Browser initialization.']]) {
  const source=fs.readFileSync(__dirname+'/dist/'+file,'utf8');
  vm.runInContext(marker ? source.split(marker)[0] : source, context, {filename:file});
}
const run=code=>vm.runInContext(code,context);
const plain=code=>JSON.parse(JSON.stringify(run(code)));
function advance(ms) {
  const end=now+ms;
  while (true) {
    const due=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
    if (!due) break;
    now=due[1].at;timers.delete(due[0]);due[1].fn();
  }
  now=end;
}

// Quantities keep stock validation and focus, without selecting the numeral.
run("state=seedState();revealQuantity(2,'catalog')");
assert.equal(selectedText,0);
assert.equal(node('#picker-catalog-2').hidden,false);
assert.equal(context.document.activeElement,node('#choose-catalog-2'));
node('#choose-catalog-2').value='1.5';
assert.equal(run("checkSelection(2,'catalog')"),null);
node('#choose-catalog-2').value='36';
assert.equal(run("checkSelection(2,'catalog')"),36);
node('#choose-catalog-2').value='37';
assert.equal(run("checkSelection(2,'catalog')"),null);

// The notice lasts ten active seconds, pauses for interaction, and is replaced on a new add.
run('state.cart={2:2};showCartNotice(product(2),2)');
assert.equal(node('#cart-notice').hidden,false);
advance(9500);assert.equal(node('#cart-notice').hidden,false);
run('pauseCartNotice()');advance(20000);assert.equal(node('#cart-notice').hidden,false);
run('resumeCartNotice()');advance(499);assert.equal(node('#cart-notice').hidden,false);
advance(1);assert.equal(node('#cart-notice').hidden,true);
run('showCartNotice(product(2),1)');advance(7000);
run('state.cart={2:3,4:1};showCartNotice(product(4),1)');advance(9500);
assert.equal(node('#cart-notice').hidden,false);advance(500);assert.equal(node('#cart-notice').hidden,true);
node('#cart-notice').hovered=true;run('showCartNotice(product(4),1)');advance(20000);
assert.equal(node('#cart-notice').hidden,false);
node('#cart-notice').hovered=false;run('resumeCartNotice()');advance(10000);
assert.equal(node('#cart-notice').hidden,true);
run('showCartNotice(product(4),1);storeNoticeReturnFocus=$("#open-picker-catalog-4");dismissCartNotice(true)');
assert.equal(context.document.activeElement,node('#open-picker-catalog-4'));

// Recommendations are deterministic and never include selected or unavailable products.
run('state.cart={2:1}');
assert.deepEqual(plain('storeRecommendedProducts().map(p=>p.id)'),[4,5,8,1]);
run('product(4).stock=0');
assert.deepEqual(plain('storeRecommendedProducts().map(p=>p.id)'),[5,8,1,3]);
run('state.products.forEach(p=>state.cart[p.id]=1)');
assert.equal(run('storeRecommendedProducts().length'),0);
run('state=seedState();state.cart={2:1}');
assert.ok(run("carrito().includes('Para completar tu compra')"));
run('state.cart={}');assert.ok(!run("carrito().includes('Para completar tu compra')"));

// Horizontal carousel range and edges on desktop, mobile, and short selections.
assert.deepEqual(plain('suggestionWindow(6,0,780,250,15)'),{first:1,last:3,previous:false,next:true});
assert.deepEqual(plain('suggestionWindow(6,265,780,250,15)'),{first:2,last:4,previous:true,next:true});
assert.deepEqual(plain('suggestionWindow(6,9999,780,250,15)'),{first:4,last:6,previous:true,next:false});
assert.deepEqual(plain('suggestionWindow(6,9999,300,278,12)'),{first:6,last:6,previous:true,next:false});
assert.deepEqual(plain('suggestionWindow(1,0,780,250,15)'),{first:1,last:1,previous:false,next:false});
assert.deepEqual(plain('suggestionWindow(0,0,780,250,15)'),{first:0,last:0,previous:false,next:false});
run('state.cart={2:1}');assert.equal(run('storeRecommendedProducts(state.products,state.cart,state.products.length).length'),6);

// Offer once on the first non-empty cart visit; empty carts and other roles do not consume it.
assert.equal(run("shouldOfferCartSuggestions(false,'cliente','carrito',1,3,false)"),true);
for (const args of [[true,'cliente','carrito',1,3,false],[false,'cliente','carrito',0,3,false],[false,'cliente','carrito',1,0,false],[false,'trabajador','carrito',1,3,false],[false,'cliente','catalogo',1,3,false],[false,'cliente','carrito',1,3,true]]) {
  assert.equal(run(`shouldOfferCartSuggestions(${args.map(a=>JSON.stringify(a)).join(',')})`),false);
}
run("state.cartSuggestionsSeen=true;commit(()=>{});state=loadState()");
assert.equal(run('state.cartSuggestionsSeen'),true);
run("let categoryRefresh=null;refreshStoreCatalog=options=>categoryRefresh=options;location.hash='#catalogo';browseStoreCategory('Lácteos')");
assert.equal(run('state.category'),'Lácteos');assert.equal(run('categoryRefresh.scroll'),true);
run("location.hash='#carrito';browseStoreCategory('Todas')");
assert.equal(run('storeCategoryArrival'),true);assert.equal(run("location.hash.replace(/^#/, '')"),'catalogo');
run("closeCartSuggestions=()=>{};state.cart={2:2};state.search='leche';state.category='Lácteos';state.catalogFilters={min:'1000',max:'2000',availability:'available',economy:true};returnFromSuggestionsToCatalog()");
assert.equal(run('cartCount()'),2);assert.equal(run('state.search'),'');assert.equal(run('state.category'),'Todas');
assert.deepEqual(plain('storeFilters()'),{min:'',max:'',availability:'all',economy:false});

// The timer advances and wraps, stops while paused/hovered/hidden, and honors reduced motion.
for (const args of [[false,false,false,false,null],[true,false,false,false,false]]) assert.equal(run(`storeCarouselCanPlay(${args.map(a=>JSON.stringify(a)).join(',')})`),true);
for (const args of [[true,false,false,false,null],[false,true,false,false,false],[false,false,true,false,false],[false,false,false,true,false],[false,false,false,false,true]]) assert.equal(run(`storeCarouselCanPlay(${args.map(a=>JSON.stringify(a)).join(',')})`),false);
run('storeCarousel.index=0;storeCarousel.paused=false;storeCarousel.focus=false;storeCarousel.hover=false;scheduleStoreHero()');
advance(6499);assert.equal(run('storeCarousel.index'),0);
advance(1);assert.equal(run('storeCarousel.index'),1);
advance(13000);assert.equal(run('storeCarousel.index'),0);
run('storeCarousel.paused=true;scheduleStoreHero()');advance(20000);assert.equal(run('storeCarousel.index'),0);
run('storeCarousel.paused=false;storeCarousel.hover=true;scheduleStoreHero()');advance(20000);assert.equal(run('storeCarousel.index'),0);
run('storeCarousel.hover=false;document.hidden=true;scheduleStoreHero()');advance(20000);assert.equal(run('storeCarousel.index'),0);
run('document.hidden=false;storeCarousel.paused=null;matchMedia=()=>({matches:true});scheduleStoreHero()');advance(20000);assert.equal(run('storeCarousel.index'),0);
run('storeCarousel.paused=false;scheduleStoreHero()');advance(6500);assert.equal(run('storeCarousel.index'),1);
run('storeCarousel.paused=true;scheduleStoreHero()');
console.log('PASS: cantidades; aviso 10s y pausas; sugerencias, rangos y extremos; primera visita persistente; regreso al catálogo conservando carrito; categorías y carrusel con movimiento reducido.');
