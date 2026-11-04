const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const nodes=new Map(),storage=new Map();
const node=()=>({textContent:'',innerHTML:'',hidden:true,style:{},classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){},focus(){},close(){},isConnected:true});
const ctx={console,Intl,URL,Blob,Date,setTimeout,clearTimeout,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)}},window:{scrollTo(){}},matchMedia:()=>({matches:true})};
vm.createContext(ctx);
for(const [file,split] of [['dumbo.js',"$('#headersearch').onsubmit"],['fusion.js',null],['inventory.js',"$('#staff-role').onchange"]]){let source=fs.readFileSync(__dirname+'/dist/'+file,'utf8');if(split)source=source.split(split)[0];vm.runInContext(source,ctx)}
const run=s=>vm.runInContext(s,ctx);
(async()=>{
 assert.equal(run('[...state.users,...state.staff].some(u=>"rut" in u)'),false);
 assert.equal(run("personFields('test').includes('RUT')"),false);
 assert.equal(run("normalizePhone('912345678')"),'+56 9 1234 5678');
 run('render=()=>{};toast=()=>{};pulseCart=()=>{};go=()=>{};closeModal=()=>{};ask=async()=>true;');
 run("state.currentUserId=3;state.cart={1:2};state.role='cliente'");
 await run('pay(false)');assert.equal(run('cartCount()'),2);
 await run('pay(true)');assert.equal(run('cartCount()'),0);assert.equal(run('product(1).stock'),22);
 await run('pay(true)');assert.equal(run('product(1).stock'),22);assert.equal(run('loadState().order.amount'),3780);
 const historical=run('reportSelection().total');run('product(2).price=9000');assert.equal(run('reportSelection().total'),historical);
 run("reportView.category='Bebidas';reportView.product='8'");assert.equal(run('reportSelection().total'),25060);assert.equal(run('reportSelection().units'),14);assert.ok(run("reportCsv().includes('25060')"));
 run("reportView.category='Bebidas';reportView.product='2'");assert.equal(run('reportSelection().total'),0);
 run("reportView.category='all';reportView.product='all';reportView.tab='stock';reportView.stock='empty'");assert.equal(run('reportSelection().products.length'),1);assert.equal(run('reportSelection().products[0].name'),'Huevos');assert.ok(run("reportCsv().includes('Inventario')"));
 run("reportView.tab='sales';reportView.period='month';reportView.stock='all'");assert.ok(run('reportSelection().total')>historical);
 // Un cliente no elimina otra cuenta; el propio cierre conserva la venta.
 await run('confirmAccountDeletion(false,1,true)');assert.equal(run('state.users[0].deleted'),undefined);
 await run('confirmAccountDeletion(false,3,true)');assert.equal(run('currentUser()'),undefined);assert.equal(run('state.users[2].deleted'),true);assert.equal(run('state.order.amount'),3780);
 run("state.role='trabajador'");await run('confirmAccountDeletion(true,4,false)');assert.equal(run('state.staff[0].deleted'),undefined);
 run("state.role='admin'");await run('restoreAccount(false,3)');assert.equal(run('state.users[2].deleted'),false);assert.equal(run('state.users[2].active'),false);
 run('ask=async()=>false');await run('confirmAccountDeletion(false,1,false)');assert.equal(run('state.users[0].deleted'),undefined);
 console.log('PASS: sin RUT; compra, stock e idempotencia; persistencia; históricos estables; filtros y CSV; eliminación, permisos, cancelación, restauración e historia preservada.');
})().catch(e=>{console.error(e);process.exitCode=1});
