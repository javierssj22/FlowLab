import {searchBlocks, insertionPoint, shortcutOpensSearch} from './workspace.mjs';
import {TYPES, DATA_TYPES, describe, compatible, BOARDS, createNode, validate, hardwareErrors, Runtime, example, parseProject, csv} from './core.mjs';
import {generateArduino} from './codegen.mjs';
import {meterReading} from './signals.mjs';
import {summarize} from './data.mjs';
import {WebSocketTransport,WebSerialTransport} from './transports.mjs';
import {ProjectFileStore} from './project-store.mjs';

const $=id=>document.getElementById(id);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Array.isArray(v)||v?.kind==='waveform'?summarize(v):typeof v==='string'?v:typeof v==='boolean'?(v?'TRUE':'FALSE'):Number.isFinite(v)?Math.abs(v)>=1e6?v.toExponential(2):v.toLocaleString('es-AR',{maximumFractionDigits:3}):'—';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const token=document.querySelector('meta[name="flowlab-token"]').content;
let project=example(), selected=null, selectedEdge=-1, pending=null, undo=[], redo=[], tab='diagram';
let view={x:20,y:100,zoom:.8}, running=false, busy=false, runtime=null, timer=null, tickTask=null;
let timeValue=0,lastTick=0,values=new Map(),histories=new Map(),spectra=new Map(),rows=[],recording=true,logs=[],connected=false;
let backend=null,jobTimer=null,gesture=null,toastTimer=null,dirty=false,operation=false;
let lastMode=null;
let panelEditing=false,panelPositions=Object.create(null), inspectorClosedFor=null, stopping=false;
let pointer=null, insertAt=null, searchIndex=0, searchResults=[];
const fileStore=new ProjectFileStore();let transport=null,moduleStack=[];
function rootProject(){let current=project;for(let i=moduleStack.length-1;i>=0;i--){moduleStack[i].node.graph=current;current=moduleStack[i].parent;}return current;}
const allNodes=p=>p.nodes.flatMap(n=>n.type==='subvi'?[n,...allNodes(n.graph)]:[n]);
function enterModule(n){if(!editable())return;runtime=null;moduleStack.push({parent:project,node:n});project=n.graph;project.board=rootProject().board;selected=null;selectedEdge=-1;undo=[];redo=[];resetData();render();fit();}
function leaveModule(){if(!editable()||!moduleStack.length)return;const frame=moduleStack.pop();frame.node.graph=project;project=frame.parent;selected=frame.node.id;selectedEdge=-1;undo=[];redo=[];changed();fit();}
function loadProject(incoming){$('project-dialog').close();const previous=JSON.stringify(rootProject());moduleStack=[];fileStore.detach();project=incoming;undo=[previous];redo=[];selected=null;selectedEdge=-1;resetData();setTab('diagram');changed();fit();}
async function saveProject(copy=false){
  if(copy)fileStore.detach();const content=JSON.stringify(rootProject(),null,2);
  try{await fileStore.save(content,safeName()+'.flowlab.json');if(JSON.stringify(rootProject(),null,2)===content)dirty=false;projectStatus();$('saved').textContent=dirty?'Cambios sin guardar':'Archivo guardado';toast('Proyecto guardado en el archivo seleccionado.');}
  catch(e){if(e.name==='AbortError')return;if(e.message!=='FILE_PICKER_UNAVAILABLE')throw e;download(safeName()+'.flowlab.json',content);$('saved').textContent='Copia descargada';dirty=false;projectStatus();toast('Copia descargada. Abre el archivo para continuar en otra sesión.');}
}

function toast(message) {$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
function log(message,kind='info') {logs.push({time:new Date().toLocaleTimeString('es-AR'),message,kind});if(logs.length>150)logs.shift();$('log-count').textContent=logs.length;$('console').innerHTML=logs.map(x=>`<div class="${x.kind}"><time>${esc(x.time)}</time>${esc(x.message)}</div>`).join('');$('console').scrollTop=$('console').scrollHeight;}
function error(e) {const message=e.message||String(e);$('error-message').textContent=message;$('error-banner').hidden=false;$('error-connect').hidden=$('mode').value!=='hardware'||connected;log(message,'error');}
function action(id,fn) {$(id).addEventListener('click',()=>Promise.resolve().then(fn).catch(error));}
async function api(path,data) {
  const response=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json','X-FlowLab-Token':token}:{},body:data?JSON.stringify(data):undefined});
  const value=await response.json();if(!response.ok)throw Error(value.error||`HTTP ${response.status}`);return value;
}
async function hardware(command,args={}) {if(!transport||!connected)throw Error('Conecta el transporte de la placa.');return transport.command(command,args);}
function snapshot(){return JSON.stringify(project);}
function checkpoint(previous=snapshot()){undo.push(previous);if(undo.length>80)undo.shift();redo=[];}
function projectStatus(){document.title=(dirty?'* ':'')+rootProject().name+' · FlowLab 0.4.1';$('project-menu').textContent=dirty?'Proyecto * ▾':'Proyecto ▾';$('project-menu').setAttribute('aria-label',dirty?'Proyecto, cambios sin guardar':'Proyecto');}
function persist(){dirty=true;$('saved').textContent='En memoria · sin guardar';projectStatus();}
function editable(){if(running||busy||operation||stopping||jobTimer){toast('Detén la ejecución o espera la operación antes de editar.');return false;}return true;}
function changed(){runtime=null;pending=null;persist();render();}
function edit(fn){if(!editable())return;checkpoint();fn();changed();}
function height(n){return Math.max(112,76+describe(n).inputs.length*24);}
function nodeValue(n){return values.has(n.id)?fmt(values.get(n.id)):['constant','slider','integer','text'].includes(n.type)?fmt(n.params.value):'—';}
function caption(n){
  const p=n.params;
  if(n.type==='signal')return `${p.wave.toUpperCase()} · ${p.frequency} Hz`;
  if(n.type==='filter')return `τ = ${p.tau} s`;
  if(n.type==='adcBurst')return `${p.rate} Hz · ${p.count} muestras`;
  if(n.type==='subvi')return 'MÓDULO · abrir en inspector';
  if(n.type==='i2cTransfer')return `0x${p.address.toString(16)} · ${p.readCount} bytes RX`;
  if(n.type==='adc')return `GPIO ${p.pin} · ${p.mode==='raw'?'12 BIT':'mV'}`;
  if(n.type==='pwm')return `GPIO ${p.pin} · ${p.frequency} Hz`;
  if(n.type.startsWith('digital'))return `GPIO ${p.pin}`;
  if(n.type.startsWith('i2c'))return `0x${p.address.toString(16).toUpperCase()} · REG ${p.register}`;
  if(n.type==='compare')return `a ${p.op} b`;
  if(n.type==='pid')return `P ${p.kp} · I ${p.ki} · D ${p.kd}`;
  if(n.type==='delay')return 'MEMORIA · 1 CICLO';
  if(p.unit)return p.unit;
  return describe(n).group.toUpperCase();
}
function transform(){$('world').style.transform=`translate(${view.x}px,${view.y}px) scale(${view.zoom})`;$('zoom-label').textContent=Math.round(view.zoom*100)+'%';}
function renderPalette(){
  searchResults=searchBlocks(TYPES,$('search').value);searchIndex=Math.min(searchIndex,Math.max(0,searchResults.length-1));
  $('palette').innerHTML=searchResults.map(([type,d],i)=>`<button role="option" id="result-${i}" aria-selected="${i===searchIndex}" data-add="${type}" tabindex="-1"><span class="palette-icon">${esc(d.icon)}</span><span><strong>${esc(d.label)}</strong><small>${esc(d.group)} · ${esc(d.description)}</small></span><span class="result-type" style="color:${DATA_TYPES[d.output].color}">${esc(DATA_TYPES[d.output].label.split(' · ')[0])}</span></button>`).join('')||'<p class="no-results">Sin coincidencias. Prueba ADC, FFT, suma o señal.</p>';
  $('search-summary').textContent=searchResults.length+' resultados';
  if(searchResults.length)$('search').setAttribute('aria-activedescendant','result-'+searchIndex);else $('search').removeAttribute('aria-activedescendant');
  $('palette').querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>chooseBlock(b.dataset.add));
  $('palette').querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});
}
function closeSearch(restore=true){$('spotlight').hidden=true;$('search').setAttribute('aria-expanded','false');if(restore)$('viewport').focus({preventScroll:true});}
function openSearch(position=pointer){
  if(tab!=='diagram'||!editable())return;
  const rect=$('viewport').getBoundingClientRect();
  const point=position&&position.x>=rect.left&&position.x<=rect.right&&position.y>=rect.top&&position.y<=rect.bottom?position:{x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  insertAt=insertionPoint(point,rect,view);searchIndex=0;$('search').value='';$('spotlight').hidden=false;
  const width=Math.min(480,innerWidth-24);$('spotlight').style.width=width+'px';
  $('spotlight').style.left=Math.max(12,Math.min(point.x,innerWidth-width-12))+'px';
  $('spotlight').style.top=Math.max(64,Math.min(point.y,innerHeight-380))+'px';
  $('search').setAttribute('aria-expanded','true');renderPalette();$('search').focus();
}
function chooseBlock(type){const point=insertAt;closeSearch();addNode(type,point);}
function openDialog(id){closeSearch(false);document.querySelectorAll('dialog[open]').forEach(d=>d.close());$(id).showModal();if(id==='hardware-dialog')refreshHardware().catch(error);if(id==='diagnostics-dialog')requestAnimationFrame(updateLive);}
function renderNodes(){
  $('nodes').innerHTML=project.nodes.map(n=>{
    const d=describe(n);return `<div class="node ${selected===n.id?'selected':''}" data-node="${n.id}" data-group="${d.group}" data-output-type="${d.output}" style="left:${n.x}px;top:${n.y}px;height:${height(n)}px"><div class="node-header"><span class="node-icon">${d.icon}</span><span class="node-title">${esc(n.label)}</span><span class="node-menu" title="${DATA_TYPES[d.output].label}" style="color:${DATA_TYPES[d.output].color}">${({number:"DBL",integer:"I32",boolean:"BOOL",string:"ABC",vector:"VEC",waveform:"WAVE"})[d.output]}</span></div><div class="node-body"></div>${d.inputs.map((p,i)=>`<button class="port input ${p.type}" data-input="${p.name}" data-node="${n.id}" aria-label="${esc(n.label)} entrada ${p.name}" title="Entrada ${p.name} · ${p.type}" style="top:${61+i*24}px"></button><span class="port-label" style="top:${61+i*24}px">${p.name}</span>`).join('')}<button class="port output ${d.output} ${pending===n.id?'pending':''}" data-output="${n.id}" aria-label="${esc(n.label)} salida" title="Salida · ${d.output}" style="top:61px"></button><span class="node-value" data-value="${n.id}">${esc(nodeValue(n))}</span><span class="node-caption">${esc(caption(n))}</span></div>`;
  }).join('');
  $('empty-state').hidden=project.nodes.length>0;
  $('nodes').querySelectorAll('[data-output]').forEach(b=>b.onclick=e=>{e.stopPropagation();if(!editable())return;pending=pending===b.dataset.output?null:b.dataset.output;renderNodes();$('connection-hint').textContent=pending?'Selecciona una entrada compatible · Esc para cancelar':'Selecciona una salida para conectar';});
  $('nodes').querySelectorAll('[data-input]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();if(!editable())return;
    if(!pending){toast('Primero haz clic en la salida de un bloque.');return;}
    const to=project.nodes.find(n=>n.id===b.dataset.node),from=project.nodes.find(n=>n.id===pending),port=describe(to).inputs.find(p=>p.name===b.dataset.input);
    if(!compatible(describe(from).output,port.type)){toast(`Tipos incompatibles: ${DATA_TYPES[describe(from).output].label} → ${DATA_TYPES[port.type].label}. Usa un bloque de conversión.`);return;}
    const edge={from:pending,to:to.id,input:port.name};
    edit(()=>{project.edges=project.edges.filter(e=>!(e.to===to.id&&e.input===port.name));project.edges.push(edge);});
  });
  $('nodes').querySelectorAll('.node').forEach(el=>el.addEventListener('pointerdown',event=>{
    if(event.target.closest('button')||event.button!==0)return;
    event.stopPropagation();const id=el.dataset.node,n=project.nodes.find(n=>n.id===id);selected=id;selectedEdge=-1;inspectorClosedFor=null;
    $('nodes').querySelectorAll('.node').forEach(x=>x.classList.toggle('selected',x.dataset.node===id));renderInspector();
    if(innerWidth<=850)document.querySelector('.inspector').classList.add('mobile-open');
    if(!running&&!busy&&!operation&&!stopping)gesture={kind:'node',id,startX:event.clientX,startY:event.clientY,x:n.x,y:n.y,previous:snapshot(),moved:false};
  }));
}
function renderWires(){
  const ns=new Map(project.nodes.map(n=>[n.id,n]));
  $('wires').innerHTML=project.edges.map((e,i)=>{
    const a=ns.get(e.from),b=ns.get(e.to);if(!a||!b)return '';
    const index=describe(b).inputs.findIndex(p=>p.name===e.input),x1=a.x+204,y1=a.y+67,x2=b.x,y2=b.y+67+index*24;
    const dx=Math.max(55,Math.abs(x2-x1)*.48);
    return `<path class="wire ${describe(a).output} ${i===selectedEdge?'selected':''} ${running?'running':''}" data-edge="${i}" d="M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}"/>`;
  }).join('');
  $('wires').querySelectorAll('[data-edge]').forEach(path=>path.onclick=e=>{e.stopPropagation();selectedEdge=Number(path.dataset.edge);selected=null;renderNodes();renderWires();renderInspector();});
}
function renderInspector(){
  const root=$('inspector-content');const n=project.nodes.find(n=>n.id===selected);
  $('inspector').hidden=(!n&&selectedEdge<0)||(tab==='panel'&&!panelEditing)||inspectorClosedFor===(selected??'edge:'+selectedEdge);
  if($('inspector').hidden)return;
  if(selectedEdge>=0){root.innerHTML='<div class="inspector-title"><span>↗</span><div>Conexión seleccionada</div></div><p>Una entrada acepta una conexión. Una salida puede alimentar varios bloques.</p><button id="delete-edge" class="delete">Eliminar conexión · Supr</button>';action('delete-edge',deleteSelection);return;}
  if(!n){const errors=validate(project);root.innerHTML=`<div class="empty-icon">⌘</div><h2>Todo empieza con una conexión.</h2><p>Selecciona un bloque para configurar sus parámetros y observar su valor.</p><div class="info-row"><span>Bloques</span><b>${project.nodes.length}</b></div><div class="info-row"><span>Conexiones</span><b>${project.edges.length}</b></div><div class="info-row"><span>Placa objetivo</span><b>${BOARDS[project.board].name}</b></div><div class="inspector-validation ${errors.length?'invalid':''}">${errors.length?'○ '+esc(errors[0]):'✓ Diagrama listo para ejecutar'}${errors.length>1?`<br>+ ${errors.length-1} observaciones`:''}</div>`;return;}
  const d=describe(n);root.innerHTML=`<div class="inspector-title"><span>${d.icon}</span><div>${esc(d.label.replace('ESP32 · ',''))}<small>${esc(d.group)} · ${esc(n.id)}</small></div></div><p>${esc(d.description)}</p><label>Nombre<input id="node-label" value="${esc(n.label)}" maxlength="80" ${running?'disabled':''}></label>${Object.entries(d.params).map(([key,p])=>`<label>${esc(p.label)}${p.type==='select'?`<select data-param="${key}" ${running?'disabled':''}>${p.options.map(o=>`<option ${n.params[key]===o?'selected':''} value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`:`<input data-param="${key}" type="${p.type}" value="${esc(n.params[key])}" ${p.type==='number'?`min="${p.min}" max="${p.max}" step="${p.step}"`:`maxlength="${p.maxLength??40}"`} ${running?'disabled':''}>`}</label>`).join('')}<div class="info-row"><span>Tipo de salida</span><b style="color:${DATA_TYPES[d.output].color}">${DATA_TYPES[d.output].label}</b></div><div class="info-row"><span>Valor actual</span><b id="inspector-value">${esc(nodeValue(n))}</b></div>${n.type==='subvi'?'<button id="enter-module">Abrir subdiagrama →</button>':''}<button id="duplicate-node">Duplicar bloque</button><button id="delete-node" class="delete">Eliminar bloque · Supr</button>`;
  $('node-label').onchange=e=>edit(()=>n.label=e.target.value.trim()||d.label);
  root.querySelectorAll('[data-param]').forEach(el=>el.onchange=()=>{
    const key=el.dataset.param,p=d.params[key],value=p.type==='number'?Number(el.value):el.value;
    if(!el.checkValidity()||p.type==='number'&&!Number.isFinite(value)){toast('Introduce un valor válido.');el.value=n.params[key];return;}
    edit(()=>{n.params[key]=value;if(n.type==='subvi'&&['inputType','outputType'].includes(key)){const term=n.graph.nodes.find(x=>x.type===(key==='inputType'?'subInput':'subOutput'));if(term)term.params.kind=value;}});
  });
  if(n.type==='subvi')action('enter-module',()=>enterModule(n));
  action('delete-node',deleteSelection);action('duplicate-node',()=>edit(()=>{if(project.nodes.length>=200)throw Error('Límite de 200 nodos por proyecto.');const copy=structuredClone(n);copy.id=newId();copy.x=Math.min(5500,copy.x+40);copy.y=Math.min(3500,copy.y+60);project.nodes.push(copy);selected=copy.id;}));
}
function render(){
  projectStatus();
  $('module-back').hidden=!moduleStack.length;$('module-back').textContent=moduleStack.length?'← '+moduleStack.at(-1).parent.name:'← Principal';$('project-name').value=project.name;$('canvas-title').textContent=project.name;$('node-count').textContent=`${project.nodes.length} bloques · ${project.edges.length} conexiones`;
  $('interval').value=project.interval;$('board').value=project.board;$('sda').value=project.i2c?.sda??BOARDS[project.board].sda;$('scl').value=project.i2c?.scl??BOARDS[project.board].scl;
  const b=BOARDS[project.board];$('board-details').textContent=`${b.adc.length} pines ADC en perfil · GPIO ${b.output} como salida de ejemplo`;
  $('undo').disabled=!undo.length||running;$('redo').disabled=!redo.length||running;
  const errors=validate(project);$('validation-state').textContent=errors.length?`${errors.length} conexiones / parámetros por revisar`:'Diagrama válido';$('validation-state').style.color=errors.length?'var(--accent)':'';
  $('board-footer').textContent=`${b.name} · ${$('mode').value==='simulation'?'SIMULADO':connected?'CONECTADO':'DESCONECTADO'}`;
  renderNodes();renderWires();renderInspector();renderPanel();transform();updateControls();
  if(!pending)$('connection-hint').innerHTML=Object.entries(DATA_TYPES).map(([key,d])=>`<span class="type-legend-dot ${key}" style="background:${d.color}"></span>${d.label.split(' · ')[0]}`).join(' ');
}
function newId(){return 'n_'+crypto.randomUUID().replaceAll('-','').slice(0,12);}
function addNode(type,point=null){edit(()=>{
  if(project.nodes.length>=200)throw Error('Límite de 200 nodos por proyecto.');
  const rect=$('viewport').getBoundingClientRect();let x=Math.max(20,(rect.width/2-view.x)/view.zoom-102),y=Math.max(20,(rect.height/2-view.y)/view.zoom-56);
  if(point){x=point.x;y=point.y;}inspectorClosedFor=null;
  while(project.nodes.some(n=>Math.abs(n.x-x)<25&&Math.abs(n.y-y)<25)){x+=28;y+=28;}
  const n=createNode(type,newId(),Math.min(5500,x),Math.min(3500,y)),b=BOARDS[project.board];if(['adc','adcBurst'].includes(type))n.params.pin=b.adc[0];if(['digitalRead','digitalWrite','pwm','tone','pcnt'].includes(type))n.params.pin=b.output;if(type==='dac'&&b.dac.length)n.params.pin=b.dac[0];if(type==='touch'&&b.touch.length)n.params.pin=b.touch[0];
  project.nodes.push(n);selected=n.id;selectedEdge=-1;if(tab!=='panel'||!['chart','waveformChart','fft','xyChart','multimeter','gauge','led','slider','toggle','log','text','textIndicator'].includes(type))setTab('diagram');
});}
function deleteSelection(){edit(()=>{if(selected){project.nodes=project.nodes.filter(n=>n.id!==selected);project.edges=project.edges.filter(e=>e.from!==selected&&e.to!==selected);if(project.panel)delete project.panel[selected];}else if(selectedEdge>=0)project.edges.splice(selectedEdge,1);selected=null;selectedEdge=-1;});}
function fit(){
  if(!project.nodes.length){view={x:20,y:100,zoom:1};transform();return;}
  const rect=$('viewport').getBoundingClientRect();if(!rect.width||!rect.height)return;
  const minX=Math.min(...project.nodes.map(n=>n.x)),maxX=Math.max(...project.nodes.map(n=>n.x+204)),minY=Math.min(...project.nodes.map(n=>n.y)),maxY=Math.max(...project.nodes.map(n=>n.y+height(n)));
  const availableH=Math.max(100,rect.height-64),availableW=Math.max(100,rect.width-64);
  view.zoom=Math.max(.45,Math.min(1.1,availableW/(maxX-minX),availableH/(maxY-minY)));
  view.x=(rect.width-(maxX-minX)*view.zoom)/2-minX*view.zoom;view.y=32+(availableH-(maxY-minY)*view.zoom)/2-minY*view.zoom;transform();
}
function zoom(factor,cx=$('viewport').clientWidth/2,cy=$('viewport').clientHeight/2){const old=view.zoom;view.zoom=Math.max(.15,Math.min(2,old*factor));view.x=cx-(cx-view.x)*view.zoom/old;view.y=cy-(cy-view.y)*view.zoom/old;transform();}
function setTab(next){tab=next;closeSearch(false);for(const t of ['diagram','panel'])$(`${t}-view`).hidden=t!==next;document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===next);b.setAttribute('aria-pressed',String(b.dataset.tab===next));});renderInspector();if(next==='panel'){renderPanel();requestAnimationFrame(updateLive);}}
function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
const safeName=()=>project.name.replace(/[^a-z0-9áéíóúñ_-]/gi,'_').slice(0,80)||'FlowLab';
function resetData(){histories=new Map();spectra=new Map();rows=[];values=new Map();timeValue=0;lastMode=null;updateLive();}
function updateControls(){
  $('execute').disabled=stopping||(!running&&(busy||operation||Boolean(jobTimer)||Boolean(moduleStack.length)));
  $('execute').textContent=stopping?'Deteniendo…':running?'■ Detener':operation?'Preparando…':'▶ Ejecutar';$('execute').classList.toggle('is-running',running);
  $('step').disabled=running||busy||operation||stopping||Boolean(jobTimer)||Boolean(moduleStack.length);
  $('hardware-label').textContent=connected?'Conectado':'Conectar';$('hardware-status').hidden=$('mode').value==='simulation';$('mode-dot').style.background=connected?'var(--green)':'var(--accent)';
  $('hardware-status').setAttribute('aria-label',connected?'ESP32 conectado. Configurar conexión':'ESP32 sin conexión. Conectar');
  $('edit-panel').disabled=running||busy||operation||stopping;$('reset-panel').disabled=running||busy||operation||stopping;
  $('transport').disabled=connected||operation;$('mode').disabled=running||busy||operation||stopping;$('interval').disabled=running||busy;$('board').disabled=running||busy||connected||operation;
  for(const id of ['connect','disconnect','refresh-ports','compile','upload','scan','sda','scl'])$(id).disabled=running||busy||operation||stopping||Boolean(jobTimer);
  $('undo').disabled=!undo.length||running||busy;$('redo').disabled=!redo.length||running||busy;
  $('run-state').textContent=running?'Flujo en ejecución':busy?'Ejecutando ciclo':runtime?'Paso completado':'Listo para ejecutar';$('run-dot').classList.toggle('running-indicator',running);$('run-dot').style.background=running?'var(--green)':'#647180';
  $('panel-mode').textContent=lastMode&&values.size?lastMode+(running?' · EN VIVO':' · ÚLTIMA EJECUCIÓN'):($('mode').value==='simulation'?'SIMULACIÓN':'ESP32 · HARDWARE');
}
async function prepare(){
  if(moduleStack.length)throw Error('Vuelve al diagrama principal para ejecutar el proyecto.');
  const errors=validate(project);if(!project.nodes.length)errors.push('Agrega al menos un bloque.');
  if(project.nodes.some(n=>n.type==='subInput'||n.type==='subOutput'))errors.push('Los terminales de módulo se usan dentro de un subdiagrama.');
  const real=$('mode').value==='hardware';
  if(real){errors.push(...hardwareErrors(project));if(!connected)errors.push('Conecta una placa con el indicador ESP32 de la barra superior.');}
  if(errors.length)throw Error(errors.slice(0,8).join('\n'));
  if(real){const status=transport instanceof WebSerialTransport?transport.status():await transport.request('status');if(!status.connected||status.board!==project.board)throw Error('La conexión o el perfil de la placa cambió. Conecta de nuevo.');await hardware('stop');if(allNodes(project).some(n=>n.type.startsWith('i2c')))await hardware('i2c',project.i2c);}
  panelEditing=false;renderPanel();resetData();lastMode=real?'ESP32 · HARDWARE':'SIMULACIÓN';runtime=new Runtime(project,real?hardware:null);lastTick=performance.now();
  log(`${real?'Hardware':'Simulación'} · ${project.nodes.length} bloques · período objetivo ${project.interval} ms.`,'ok');
}
async function performTick(single=false){
  if(!runtime)return;busy=true;updateControls();const current=runtime;
  tickTask=(async()=>{
    const now=performance.now(),dt=single?project.interval/1000:Math.max(.001,current.samples?(now-lastTick)/1000:project.interval/1000);lastTick=now;
    if(current.hardware)await hardware('ping');
    const result=await current.tick(timeValue,dt);if(current.cancelled)return;
    values=result;
    for(const n of project.nodes){
      const value=values.get(n.id);if(n.type==='fft'){const spectrum=runtime.state.get(n.id);spectra.set(n.id,spectrum);histories.set(n.id,spectrum.magnitudes.map((v,i)=>({t:spectrum.f0+i*spectrum.df,v})));}else if(n.type==='xyChart'){histories.set(n.id,[...runtime.state.get(n.id)]);}else if(value?.kind==='waveform')histories.set(n.id,value.samples.map((v,i)=>({t:value.t0+i*value.dt,v})));else if(typeof value==='number') {let h=histories.get(n.id)||[];h.push({t:timeValue,v:value});if(h.length>600)h.shift();histories.set(n.id,h);}
      if(recording&&n.type==='log'){rows.push([Number(timeValue.toFixed(6)),n.id,n.label,value,n.params.unit]);if(rows.length>20000)rows.shift();}
    }
    timeValue+=dt;
    const elapsed=performance.now()-now;$('timing').textContent=`Ciclo: ${elapsed.toFixed(1)} ms / ${project.interval} ms${elapsed>project.interval?' · SOBRECARGA':''}`;
    updateLive();
  })();
  try {await tickTask;}finally{busy=false;tickTask=null;updateControls();}
}
async function run(){
  if(running||busy||operation||stopping)return;$('error-banner').hidden=true;operation=true;updateControls();
  try{await prepare();running=true;}finally{operation=false;updateControls();renderInspector();}
  const loop=async()=>{
    if(!running)return;const start=performance.now();
    try{await performTick();}catch(e){if(running)error(e);await stop();return;}
    if(running)timer=setTimeout(loop,Math.max(0,project.interval-(performance.now()-start)));
  };loop();
}
async function step(){
  if(running||busy||operation||stopping)return;
  operation=true;updateControls();
  try{if(!runtime)await prepare();await performTick(true);if(runtime.hardware){await hardware('stop');runtime=null;log('Paso de hardware terminado; salidas en LOW.');}}catch(e){await stop();throw e;}finally{operation=false;updateControls();}
}
async function stop(){
  if(stopping)return;stopping=true;updateControls();
  running=false;clearTimeout(timer);if(runtime)runtime.cancelled=true;
  if(tickTask)try{await tickTask;}catch{}
  if(runtime?.hardware||connected)try{await hardware('stop');}catch(e){connected=false;log(e.message,'error');}
  runtime=null;busy=false;stopping=false;updateControls();renderInspector();renderWires();log('Ejecución detenida.');
}
function renderPanel(){
  const nodes=project.nodes.filter(n=>['chart','waveformChart','fft','xyChart','multimeter','gauge','led','slider','toggle','log','text','textIndicator'].includes(n.type));
  const manual=Boolean(project.panel)||panelEditing;
  const stageWidth=Math.min(1400,Math.max(480,$('panel-view').clientWidth-56)),tileWidth=Math.floor((stageWidth-16)/2);let rowY=0,column=0;
  panelPositions=Object.create(null);
  for(const n of nodes){
    if(['chart','waveformChart','fft','xyChart'].includes(n.type)&&column){rowY+=196;column=0;}
    const defaultPos={x:column*(tileWidth+16),y:rowY,w:['chart','waveformChart','fft','xyChart'].includes(n.type)?stageWidth:tileWidth,h:['chart','waveformChart','fft','xyChart'].includes(n.type)?260:180};
    panelPositions[n.id]=project.panel&&Object.hasOwn(project.panel,n.id)?project.panel[n.id]:defaultPos;
    if(['chart','waveformChart','fft','xyChart'].includes(n.type)){rowY+=276;}else if(column===1){rowY+=196;column=0;}else column=1;
  }
  $('edit-panel').textContent=panelEditing?'✓ Terminar edición':'✎ Editar panel';$('finish-panel').hidden=!panelEditing;$('panel-edit-hint').hidden=!panelEditing;
  $('panel-edit-hint').textContent=panelEditing?'Arrastra el título para mover; usa la esquina inferior para dimensionar.':'Cada control e indicador tiene su bloque en el diagrama.';
  $('instruments').classList.toggle('manual-panel',manual);$('instruments').classList.toggle('editing-panel',panelEditing);
  if(manual){$('instruments').style.height=Math.max(220,...Object.values(panelPositions).map(p=>p.y+p.h+24))+'px';$('instruments').style.minWidth=Math.max(0,...Object.values(panelPositions).map(p=>p.x+p.w))+'px';}
  else{$('instruments').style.height='';$('instruments').style.minWidth='';}
  $('instruments').innerHTML=nodes.map(n=>{
    const d=describe(n),p=n.params;let body='';
    if(['chart','waveformChart','fft','xyChart'].includes(n.type))body=`<canvas data-scope="${n.id}" aria-label="${esc(n.label)}"></canvas>`;
    if(n.type==='gauge'||n.type==='log')body=`<span class="reading" data-reading="${n.id}">—</span><span class="unit">${esc(p.unit)}</span>${n.type==='gauge'?`<div class="gauge-track"><div class="gauge-fill" data-gauge="${n.id}"></div></div><div class="range-labels"><span>${p.min}</span><span>${p.max}</span></div>`:'<p class="small muted">Registro CSV · últimas 20.000 filas de la sesión</p>'}`;
    if(n.type==='multimeter')body=`<div class="multimeter-face" data-meter="${n.id}">—</div><p class="small muted">Rango ±${esc(p.range)} ${esc(p.unit)} · indicador del valor conectado</p>`;
    if(n.type==='fft')body+=`<p class="small muted" data-spectrum="${n.id}">FFT · eje X en Hz</p>`;
    if(n.type==='xyChart')body+=`<p class="small muted">X: ${esc(p.xUnit)} · Y: ${esc(p.yUnit)} · ${p.points} puntos máx.</p>`;
    if(n.type==='led')body=`<span class="lamp" data-lamp="${n.id}"></span><span data-reading="${n.id}">—</span>`;
    if(n.type==='slider')body=`<span class="reading" data-control-reading="${n.id}">${fmt(p.value)}</span><input type="range" data-slider="${n.id}" min="${p.min}" max="${p.max}" step="${(p.max-p.min)/1000}" value="${p.value}" aria-label="${esc(n.label)}"><div class="range-labels"><span>${p.min}</span><span>${p.max}</span></div>`;
    if(n.type==='toggle')body=`<button data-toggle="${n.id}" class="toggle-control ${p.value==='1'?'on':''}" aria-label="${esc(n.label)}" aria-pressed="${p.value==='1'}">${p.value==='1'?'ON':'OFF'}</button>`;
    if(n.type==='text')body=`<input class="text-control" data-text-control="${n.id}" value="${esc(p.value)}" maxlength="1024" aria-label="${esc(n.label)}"><p class="small muted">STRING · control vinculado al diagrama</p>`;
    if(n.type==='textIndicator')body=`<div class="text-reading" data-reading="${n.id}">—</div>`;
    const pos=panelPositions[n.id],style=manual?`left:${pos.x}px;top:${pos.y}px;width:${pos.w}px;height:${pos.h}px;`:'';
    return `<article class="instrument ${n.type}" data-panel-id="${n.id}" style="${style}"><h3 data-panel-drag="${n.id}" title="${panelEditing?'Arrastrar para mover':'Instrumento vinculado al diagrama'}">${esc(n.label)}<span>${d.icon}</span></h3>${body}${panelEditing?`<button class="panel-resize" data-panel-resize="${n.id}" aria-label="Dimensionar ${esc(n.label)}" title="Arrastrar para dimensionar">◢</button>`:''}</article>`;
  }).join('')||'<div class="instrument-empty">Agrega un osciloscopio, indicador, LED o control al diagrama para construir tu panel.</div>';
  document.querySelectorAll('[data-slider]').forEach(el=>{
    el.onpointerdown=()=>{if(!running)checkpoint();};
    el.oninput=()=>{const n=project.nodes.find(n=>n.id===el.dataset.slider);n.params.value=Number(el.value);document.querySelector(`[data-control-reading="${n.id}"]`).textContent=fmt(n.params.value);persist();};
  });
  document.querySelectorAll('[data-toggle]').forEach(el=>el.onclick=()=>{const n=project.nodes.find(n=>n.id===el.dataset.toggle);if(!running)checkpoint();n.params.value=n.params.value==='1'?'0':'1';el.classList.toggle('on',n.params.value==='1');el.textContent=n.params.value==='1'?'ON':'OFF';el.setAttribute('aria-pressed',String(n.params.value==='1'));persist();});
  document.querySelectorAll('[data-text-control]').forEach(el=>{el.onfocus=()=>{if(!running)checkpoint();};el.oninput=()=>{const n=project.nodes.find(n=>n.id===el.dataset.textControl);n.params.value=el.value;persist();};});
  document.querySelectorAll('[data-panel-drag],[data-panel-resize]').forEach(el=>el.onpointerdown=e=>{
    if(e.button!==0||!panelEditing)return;
    const id=el.dataset.panelDrag||el.dataset.panelResize;selected=id;selectedEdge=-1;inspectorClosedFor=null;renderInspector();
    if(innerWidth<=850)document.querySelector('.inspector').classList.add('mobile-open');
    if(!panelEditing||running||busy)return;
    e.preventDefault();const previous=snapshot();project.panel=Object.fromEntries(Object.entries(panelPositions).map(([key,pos])=>[key,{...(project.panel?.[key]||pos)}]));
    gesture={kind:el.dataset.panelResize?'panel-size':'panel-move',id,startX:e.clientX,startY:e.clientY,pos:{...project.panel[id]},previous,moved:false};
  });
  requestAnimationFrame(updateLive);
}
function drawChart(canvas,series,color='#f3ab69',xUnit='s',xy=false){
  const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const ratio=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(rect.width*ratio)||canvas.height!==Math.round(rect.height*ratio)){canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);}
  const ctx=canvas.getContext('2d'),w=rect.width,h=rect.height;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const left=45,right=w-20,top=15,bottom=h-23;
  let min=series.length?Math.min(...series.map(p=>p.v)):0,max=series.length?Math.max(...series.map(p=>p.v)):5;
  const spread=max-min;if(spread<1e-8){min-=1;max+=1;}else{min-=spread*.12;max+=spread*.12;}
  ctx.font='9px Consolas, monospace';ctx.textAlign='right';
  for(let i=0;i<=4;i++){const y=top+(bottom-top)*i/4;ctx.strokeStyle='#2b333e';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillStyle='#69788b';ctx.fillText(fmt(max-(max-min)*i/4),left-9,y+3);}
  for(let i=0;i<=8;i++){const x=left+(right-left)*i/8;ctx.strokeStyle='#242c36';ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();}
  if(!series.length){ctx.textAlign='center';ctx.fillStyle='#607084';ctx.fillText('EJECUTA EL DIAGRAMA PARA VER LA SEÑAL',w/2,h/2);return;}
  let start=xy?Math.min(...series.map(p=>p.t)):series[0].t,end=xy?Math.max(...series.map(p=>p.t)):series.at(-1).t;if(end-start<1e-9){start-=.5;end+=.5;}
  ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.lineJoin='round';ctx.beginPath();series.forEach((p,i)=>{const x=left+(p.t-start)/(end-start)*(right-left),y=bottom-(p.v-min)/(max-min)*(bottom-top);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();
  ctx.fillStyle='#69788b';ctx.textAlign='left';ctx.fillText(`${start.toPrecision(4)} ${xUnit}`,left,h-7);ctx.textAlign='right';ctx.fillText(`${end.toPrecision(4)} ${xUnit}`,right,h-7);
}
function drawNodeChart(canvas,n){drawChart(canvas,histories.get(n?.id)||[],n?.type==='fft'?'#b594f6':n?.type==='xyChart'?'#76d8b2':'#66d2df',n?.type==='fft'?'Hz':n?.type==='xyChart'?n.params.xUnit:'s',n?.type==='xyChart');}
function updateLive(){
  document.querySelectorAll('[data-meter]').forEach(el=>{const n=project.nodes.find(n=>n.id===el.dataset.meter);if(!n)return;const reading=meterReading(values.get(n.id),n.params);el.textContent=reading.text+' '+reading.unit;el.classList.toggle('over-range',reading.over);});
  document.querySelectorAll('[data-spectrum]').forEach(el=>{const s=spectra.get(el.dataset.spectrum);if(s)el.textContent=`Δf ${fmt(s.df)} Hz · ${s.n} muestras · ${s.window} · ${s.unit}`;});
  document.querySelectorAll('[data-value]').forEach(el=>{const n=project.nodes.find(n=>n.id===el.dataset.value);if(n)el.textContent=nodeValue(n);});
  if($('inspector-value'))$('inspector-value').textContent=fmt(values.get(selected));
  document.querySelectorAll('[data-reading]').forEach(el=>el.textContent=fmt(values.get(el.dataset.reading)));
  document.querySelectorAll('[data-lamp]').forEach(el=>el.classList.toggle('on',Boolean(values.get(el.dataset.lamp))));
  document.querySelectorAll('[data-gauge]').forEach(el=>{const n=project.nodes.find(n=>n.id===el.dataset.gauge);if(!n){el.style.width='0';return;}const v=values.get(n.id);el.style.width=Number.isFinite(v)?Math.max(0,Math.min(100,100*(v-n.params.min)/(n.params.max-n.params.min)))+'%':'0';});
  if(tab==='panel')document.querySelectorAll('[data-scope]').forEach(el=>drawNodeChart(el,project.nodes.find(n=>n.id===el.dataset.scope)));
  const source=project.nodes.find(n=>n.id===selected&&(['number','integer','waveform'].includes(describe(n).output)||n.type==='fft'))||project.nodes.find(n=>['chart','waveformChart','fft','xyChart'].includes(n.type))||project.nodes.find(n=>['number','integer','waveform'].includes(describe(n).output));
  const series=histories.get(source?.id)||[];drawNodeChart($('monitor-chart'),source);$('monitor-source').textContent=source?.label||'Sin muestras';
  const shown=values.get(source?.id);$('last-value').textContent=source?.type==='fft'&&series.length?fmt(Math.max(...series.map(p=>p.v))):fmt(shown?.kind==='waveform'?shown.samples.at(-1):shown);$('min-value').textContent=series.length?fmt(Math.min(...series.map(p=>p.v))):'—';$('max-value').textContent=series.length?fmt(Math.max(...series.map(p=>p.v))):'—';
  $('sample-count').textContent=`${series.length} muestras · ${runtime?.samples??0} ciclos · ${rows.length} registros`;
}
async function refreshHardware(){
  try{
    if(token==='__SESSION_TOKEN__')throw Error('static');
    const [status,list]=await Promise.all([api('/api/status'),api('/api/ports')]);backend=status;
    const current=$('ports').value;$('ports').innerHTML=list.ports.length?list.ports.map(p=>`<option value="${esc(p.port)}">${esc(p.port)} · ${esc(p.description)}</option>`).join(''):'<option value="">Sin puertos detectados</option>';
    if(list.ports.some(p=>p.port===current))$('ports').value=current;
    $('dependency-status').textContent=`WebSocket ${status.wsUrl?'disponible':'no disponible'} · Arduino CLI ${status.arduinoCli?'disponible':'no detectado'}`;
  }catch{backend=null;$('transport').value='serial';$('dependency-status').textContent='Sin backend Python. Usa WebSerial en Chrome/Edge sobre localhost o HTTPS.';}
  $('device-status').textContent=connected?'Conectado · '+($('transport').value==='serial'?'WebSerial directo':'WebSocket persistente'):'Sin conexión. La simulación está disponible.';
  updateControls();
}
async function disconnectDevice(){const old=transport;transport=null;connected=false;runtime=null;if(old)await old.disconnect();await refreshHardware();}
async function connectDevice(){
  if(running||busy||operation||stopping||connected)throw Error('Detén y desconecta la sesión anterior.');
  const direct=$('transport').value==='serial',candidate=direct?new WebSerialTransport():null;
  // requestPort starts synchronously from the click to retain browser user activation.
  const selection=direct?candidate.select():Promise.resolve();
  await deviceOperation(async()=>{
    await selection;
    if(!direct){if(!backend?.wsUrl)throw Error('Instala websockets y reinicia FlowLab, o selecciona WebSerial.');if(!$('ports').value)throw Error('Selecciona un puerto USB.');}
    if(transport){await transport.disconnect();transport=null;}
    transport=candidate||new WebSocketTransport(backend.wsUrl,token);
    const current=transport;
    current.onclose=()=>{if(transport!==current)return;connected=false;running=false;clearTimeout(timer);if(runtime)runtime.cancelled=true;updateControls();error(Error('Transporte cerrado. Reconecta explícitamente. Las lecturas mostradas son las últimas recibidas.'));$('device-status').textContent='Transporte cerrado. Reconecta explícitamente.';};
    try{if(!direct)await current.open();await current.connect($('ports').value,rootProject().board);connected=true;runtime=null;await refreshHardware();log('Placa conectada mediante '+(direct?'WebSerial':'WebSocket')+'.','ok');}
    catch(e){await current.disconnect().catch(()=>{});transport=null;connected=false;throw e;}
  });
}
async function deviceOperation(fn){if(running||busy||operation||stopping)throw Error('Detén la ejecución antes de operar la placa.');operation=true;updateControls();try{return await fn();}finally{operation=false;updateControls();}}
async function build(actionName){await deviceOperation(async()=>{
  if(!backend?.arduinoCli)throw Error('Instala Arduino CLI y el núcleo esp32. Consulta README.md.');
  if(transport)await disconnectDevice();
  await api('/api/toolchain',{action:actionName,board:project.board,port:$('ports').value});connected=false;runtime=null;$('build-log').textContent='Trabajando…';document.querySelector('.build-details').open=true;
  log(actionName==='compile'?'Compilando firmware puente…':'Compilando y cargando firmware puente…');
  const poll=async()=>{try{const job=await api('/api/job');$('build-log').textContent=job.log||'Trabajando…';if(job.running){jobTimer=setTimeout(poll,1200);}else{jobTimer=null;log(job.ok?'Arduino CLI completado. Puedes conectar la placa.':job.log,job.ok?'ok':'error');toast(job.ok?'Firmware listo.':'La operación falló. Revisa la salida del compilador.');await refreshHardware();}}catch(e){jobTimer=null;error(e);}updateControls();};jobTimer=setTimeout(poll,500);
});}

// Editor gestures use global listeners so dragging remains stable outside a node.
$('viewport').addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==1)return;if(e.target.closest('.node')||e.target.closest('.wire'))return;gesture={kind:'pan',startX:e.clientX,startY:e.clientY,x:view.x,y:view.y,moved:false};selected=null;selectedEdge=-1;document.querySelector('.inspector').classList.remove('mobile-open');renderNodes();renderWires();renderInspector();});
window.addEventListener('pointermove',e=>{
  if(!gesture)return;const dx=e.clientX-gesture.startX,dy=e.clientY-gesture.startY;if(Math.abs(dx)+Math.abs(dy)>3)gesture.moved=true;
  if(gesture.kind==='pan'){view.x=gesture.x+dx;view.y=gesture.y+dy;transform();}
  else if(gesture.kind.startsWith('panel-')){
    const p=project.panel[gesture.id],initial=gesture.pos,el=document.querySelector(`[data-panel-id="${gesture.id}"]`);
    if(gesture.kind==='panel-move'){p.x=Math.max(0,Math.min(5000,initial.x+dx));p.y=Math.max(0,Math.min(5000,initial.y+dy));el.style.left=p.x+'px';el.style.top=p.y+'px';}
    else{p.w=Math.max(220,Math.min(1400,initial.w+dx));p.h=Math.max(150,Math.min(1200,initial.h+dy));el.style.width=p.w+'px';el.style.height=p.h+'px';}
    $('instruments').style.height=Math.max(220,...Object.values(project.panel).map(p=>p.y+p.h+24))+'px';
    $('instruments').style.minWidth=Math.max(0,...Object.values(project.panel).map(p=>p.x+p.w))+'px';updateLive();
  }
  else{const n=project.nodes.find(n=>n.id===gesture.id);n.x=Math.max(0,Math.min(5500,gesture.x+dx/view.zoom));n.y=Math.max(0,Math.min(3500,gesture.y+dy/view.zoom));const el=document.querySelector(`.node[data-node="${n.id}"]`);el.style.left=n.x+'px';el.style.top=n.y+'px';renderWires();}
});
window.addEventListener('pointerup',()=>{if((gesture?.kind==='node'||gesture?.kind.startsWith('panel-'))&&gesture.moved){checkpoint(gesture.previous);persist();$('undo').disabled=false;}gesture=null;});
$('viewport').addEventListener('wheel',e=>{e.preventDefault();const r=$('viewport').getBoundingClientRect();zoom(e.deltaY>0?.92:1.08,e.clientX-r.left,e.clientY-r.top);},{passive:false});
$('search').oninput=()=>{searchIndex=0;renderPalette();};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{if(editable()){loadProject(example(b.dataset.example,rootProject().board));$('project-dialog').close();}});
$('project-name').onchange=e=>edit(()=>project.name=e.target.value.trim()||'Proyecto sin título');
$('interval').onchange=e=>edit(()=>project.interval=Number(e.target.value));
$('mode').onchange=()=>{runtime=null;render();};
$('board').innerHTML=Object.entries(BOARDS).map(([key,b])=>`<option value="${key}">${b.name}</option>`).join('');
$('board').onchange=e=>edit(()=>{project.board=e.target.value;project.i2c={sda:BOARDS[project.board].sda,scl:BOARDS[project.board].scl};toast('Perfil cambiado. Revisa los GPIO de cada bloque.');});
for(const key of ['sda','scl'])$(key).onchange=e=>edit(()=>{project.i2c??={};project.i2c[key]=Number(e.target.value);});
action('execute',()=>running?stop():run());action('step',step);
action('edit-panel',()=>{if(!editable())return;panelEditing=!panelEditing;$('project-dialog').close();setTab('panel');});
action('finish-panel',()=>{panelEditing=false;renderPanel();renderInspector();});
action('reset-panel',()=>edit(()=>{delete project.panel;panelEditing=false;}));
action('module-back',leaveModule);
action('new',()=>{if(editable())loadProject(example('empty',rootProject().board));});
action('save',()=>saveProject());action('save-as',()=>saveProject(true));
action('open',async()=>{
  if(!editable())return;
  if(!globalThis.showOpenFilePicker){$('file-input').click();return;}
  try{const chosen=await fileStore.open();const incoming=parseProject(chosen.text);loadProject(incoming);chosen.accept();dirty=false;projectStatus();$('saved').textContent='Archivo abierto';}catch(e){if(e.name!=='AbortError')throw e;}
});
$('file-input').onchange=async()=>{try{const file=$('file-input').files[0];if(!file)return;if(file.size>1e6)throw Error('El archivo supera 1 MB.');loadProject(parseProject(await file.text()));dirty=false;projectStatus();$('saved').textContent='Archivo importado';}catch(e){error(e);}finally{$('file-input').value='';}};
action('recover-local',()=>{if(!editable())return;const old=localStorage.getItem('flowlab.project.v1');if(!old)throw Error('No hay un proyecto de la versión 0.1 en este navegador.');loadProject(parseProject(old));toast('Proyecto anterior recuperado. Guárdalo en un archivo propio.');});
action('spectrum-json',()=>{const s=spectra.get(selected)||spectra.values().next().value;if(!s)throw Error('Ejecuta un bloque FFT primero.');download(safeName()+'.spectrum.json',JSON.stringify(s,null,2));});
action('waveform-json',()=>{const v=values.get(selected)?.kind==='waveform'?values.get(selected):[...values.values()].find(v=>v?.kind==='waveform');if(!v)throw Error('Ejecuta una captura o construye una waveform.');download(safeName()+'.waveform.json',JSON.stringify(v,null,2));});
action('undo',()=>{if(!editable()||!undo.length)return;redo.push(snapshot());project=JSON.parse(undo.pop());selected=null;selectedEdge=-1;changed();});
action('redo',()=>{if(!editable()||!redo.length)return;undo.push(snapshot());project=JSON.parse(redo.pop());selected=null;selectedEdge=-1;changed();});
action('zoom-in',()=>zoom(1.15));action('zoom-out',()=>zoom(1/1.15));action('fit',fit);
action('layout',()=>{edit(()=>{
  const levels=new Map(project.nodes.map(n=>[n.id,0]));
  for(let i=0;i<project.nodes.length;i++){let updated=false;for(const e of project.edges){const target=project.nodes.find(n=>n.id===e.to);if(target.type==='delay')continue;const next=levels.get(e.from)+1;if(next>levels.get(e.to)){levels.set(e.to,Math.min(next,12));updated=true;}}if(!updated)break;}
  const counts=new Map();for(const n of project.nodes){const level=levels.get(n.id),row=counts.get(level)||0;n.x=50+level*290;n.y=40+row*190;counts.set(level,row+1);}
  if(project.nodes.some(n=>n.y>3500))project.nodes.forEach((n,i)=>{n.x=50+(i%10)*290;n.y=40+Math.floor(i/10)*170;});
});fit();});
action('record',()=>{recording=!recording;$('record').classList.toggle('recording',recording);$('record').textContent=recording?'● REC':'○ REC';log(recording?'Registro CSV activado.':'Registro CSV pausado.');});
action('csv',()=>{if(!rows.length)throw Error('Todavía no hay registros. Conecta un bloque Registro de datos y ejecuta con REC activo.');download(safeName()+'.csv',csv(rows),'text/csv;charset=utf-8');toast(`${rows.length} registros exportados.`);});
action('clear-data',()=>{rows=[];histories=new Map();updateLive();log('Historial y registro vaciados.');});
action('console-toggle',()=>$('console').hidden=!$('console').hidden);
action('refresh-ports',refreshHardware);
$('connect').onclick=()=>connectDevice().catch(error);
action('disconnect',()=>deviceOperation(disconnectDevice));
action('scan',()=>deviceOperation(async()=>{if(!connected)throw Error('Conecta una placa primero.');await hardware('stop');await hardware('i2c',project.i2c);try{const devices=await hardware('scan');$('i2c-result').textContent=devices.length?'Encontrados: '+devices.map(a=>'0x'+a.toString(16).toUpperCase()).join(', '):'No se detectaron dispositivos. Revisa pines y resistencias pull-up.';}finally{await hardware('stop');runtime=null;}}));
action('compile',()=>build('compile'));action('upload',()=>build('upload'));
action('export-code',()=>{const source=generateArduino(rootProject());download('FlowLabStandalone.ino',source,'text/plain');toast('Sketch exportado. Abre el archivo en Arduino IDE y selecciona tu placa.');});
action('help-button',()=>openDialog('help-dialog'));action('close-help',()=>$('help-dialog').close());
action('project-menu',()=>openDialog('project-dialog'));
action('open-hardware',()=>openDialog('hardware-dialog'));action('hardware-status',()=>openDialog('hardware-dialog'));action('error-connect',()=>openDialog('hardware-dialog'));
action('open-diagnostics',()=>openDialog('diagnostics-dialog'));action('dismiss-error',()=>$('error-banner').hidden=true);
action('add-block',()=>openSearch(null));action('close-inspector',()=>{inspectorClosedFor=selected??'edge:'+selectedEdge;$('inspector').hidden=true;$('viewport').focus({preventScroll:true});});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}));
$('viewport').addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY};});
$('viewport').addEventListener('dblclick',e=>{if(!e.target.closest('.node,.wire'))openSearch({x:e.clientX,y:e.clientY});});
$('viewport').addEventListener('contextmenu',e=>{if(!e.target.closest('.node,.wire')){e.preventDefault();openSearch({x:e.clientX,y:e.clientY});}});
document.addEventListener('pointerdown',e=>{if(!$('spotlight').hidden&&!e.target.closest('#spotlight'))closeSearch(false);});
$('search').addEventListener('keydown',e=>{
  if(e.isComposing)return;
  if(['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)){e.preventDefault();e.stopPropagation();}
  if(e.key==='Escape')closeSearch();
  else if(e.key==='Enter'&&searchResults[searchIndex])chooseBlock(searchResults[searchIndex][0]);
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){searchIndex=(searchIndex+(e.key==='ArrowDown'?1:-1)+searchResults.length)%Math.max(1,searchResults.length);renderPalette();}
});
window.addEventListener('keydown',e=>{
  if(e.isComposing)return;
  const editing=Boolean(e.target.closest('input,textarea,select,[contenteditable="true"]'));
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save').click();return;}
  if(editing||document.querySelector('dialog[open]'))return;
  if(shortcutOpensSearch(e,{editing,interactive:Boolean(e.target.closest('button,a')),diagram:tab==='diagram'})){e.preventDefault();openSearch();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();$('redo').click();}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelection();}
  else if(e.key==='Escape'){closeSearch(false);pending=null;selected=null;selectedEdge=-1;render();}
});
window.addEventListener('beforeunload',e=>{if(running||dirty){e.preventDefault();e.returnValue='';}});
new ResizeObserver(()=>{updateLive();}).observe($('monitor-chart'));
renderPalette();render();requestAnimationFrame(fit);$('saved').textContent='En memoria · guarda tu archivo';log('FlowLab listo. El modo simulación funciona sin una placa.','ok');
refreshHardware().catch(e=>{log('Servidor local no disponible: '+e.message,'error');});
