// Pure workspace operations shared by the UI and regression tests.
const normalize = value => String(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const aliases = {adc:'analogico analog input entrada ai',dac:'analogico salida ao',digitalRead:'di entrada digital',digitalWrite:'do salida digital',chart:'osciloscopio grafica scope',waveformChart:'osciloscopio onda scope',signal:'generador seno onda senal',add:'suma sumar',subtract:'resta restar',multiply:'multiplicar producto',divide:'division dividir',fft:'espectro fourier frecuencia',subvi:'modulo subdiagrama encapsular',log:'registro csv datos',multimeter:'multimetro voltimetro display',xyChart:'curva grafica xy'};
export function searchBlocks(types,query){
  const words=normalize(query).trim().split(/\s+/).filter(Boolean);
  return Object.entries(types).map(([type,d],order)=>{
    const name=normalize(`${type} ${d.label}`),haystack=normalize(`${name} ${d.group} ${d.description} ${aliases[type]||''}`);
    return {type,d,order,score:words.every(w=>haystack.includes(w))?words.reduce((sum,w)=>sum+(name.startsWith(w)?8:name.includes(w)?4:1),0):-1};
  }).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score||a.order-b.order).map(x=>[x.type,x.d]);
}
export function insertionPoint(point,rect,view){
  return {x:Math.max(0,Math.min(5500,(point.x-rect.left-view.x)/view.zoom)),y:Math.max(0,Math.min(3500,(point.y-rect.top-view.y)/view.zoom))};
}
export function shortcutOpensSearch(event,{editing=false,interactive=false,diagram=true}={}){
  return diagram&&!editing&&!interactive&&!event.isComposing&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&(event.key==='/'||event.key===' '&&!event.shiftKey);
}
