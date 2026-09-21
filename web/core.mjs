// SPDX-License-Identifier: MIT
import {vector,waveform,checkWaveform,parseVector,bytes} from './data.mjs';
const num = (label, value, min = -1e9, max = 1e9, step = 'any') => ({label, value, min, max, step, type: 'number'});
const opt = (label, value, options) => ({label, value, options, type: 'select'});
const input = (name, type = 'number') => ({name, type});
const def = (label, group, icon, inputs, output, params, description) => ({label, group, icon, inputs: inputs.map(x => typeof x === 'string' ? input(x) : x), output, params, description});
export const TYPES = {
  vector: def('Vector numérico','Lotes','[ ]',[],'vector',{values:{type:'text',label:'Arreglo JSON',value:'[1,2,3,4]',maxLength:20000}},'Arreglo de hasta 4096 números finitos.'),
  makeWaveform: def('Construir waveform','Lotes','Y(dt)',[input('in','vector')],'waveform',{dt:num('dt · segundos',0.001,0.000000001,86400),t0:num('t0 · segundos',0)},'Agrega un intervalo de muestreo uniforme y origen temporal al vector.'),
  waveformSamples: def('Extraer muestras','Lotes','Y[]',[input('in','waveform')],'vector',{},'Extrae las muestras de una waveform.'),
  waveformScale: def('Escalar waveform','Lotes','Y×k',[input('in','waveform')],'waveform',{gain:num('Ganancia',1),offset:num('Offset',0)},'Escala todas las muestras preservando dt, t0 y metadatos.'),
  vectorStat: def('Estadística de vector','Lotes','Σ[]',[input('in','vector')],'number',{mode:opt('Operación','mean',['mean','rms','min','max'])},'Procesa el bloque completo; rechaza vectores vacíos.'),
  vectorAt: def('Índice de vector','Lotes','[i]',[input('in','vector')],'number',{index:num('Índice',0,0,4095,1)},'Lee un elemento; falla si está fuera del vector.'),
  waveformChart: def('Gráfico de waveform','Instrumentos','⌁[]',[input('in','waveform')],'waveform',{},'Representa el lote completo con el eje temporal definido por dt y t0.'),
  adcBurst: def('ESP32 · ADC ráfaga DMA','ESP32','A[]',[],'waveform',{pin:num('GPIO ADC1',34,0,54,1),rate:num('Muestreo nominal · Hz',20000,20000,80000,1),count:num('Muestras',1024,16,4096,1),trigger:opt('Disparo','immediate',['immediate','rising','falling']),level:num('Nivel ADC del disparo',2048,0,4095,1),pre:num('Muestras antes del disparo',0,0,4095,1),timeout:num('Timeout · ms',2000,100,5000,1)},'Captura en DMA y luego transfiere; protocolo 2. Sin salidas activas. Tasa pendiente de caracterizar en hardware.'),
  i2cTransfer: def('ESP32 · I²C multibyte','ESP32','I[]',[input('tx','vector')],'vector',{address:num('Dirección decimal',72,8,119,1),readCount:num('Bytes a leer',2,0,32,1),stop:opt('Entre escritura y lectura','repeated-start',['repeated-start','stop'])},'Escribe hasta 32 bytes y lee hasta 32 en una transacción; vector vacío permite lectura directa.'),
  subvi: def('Subdiagrama','Módulos','VI',['in'],'number',{inputType:opt('Tipo de entrada','number',['number','integer','boolean','string','vector','waveform']),outputType:opt('Tipo de salida','number',['number','integer','boolean','string','vector','waveform'])},'Módulo embebido con una entrada y una salida tipadas. Cada instancia conserva su propio estado.'),
  subInput: def('Entrada del subdiagrama','Módulos','IN',[],'number',{kind:opt('Tipo','number',['number','integer','boolean','string','vector','waveform'])},'Terminal de entrada de un subdiagrama; no es una fuente independiente.'),
  subOutput: def('Salida del subdiagrama','Módulos','OUT',['in'],'number',{kind:opt('Tipo','number',['number','integer','boolean','string','vector','waveform'])},'Terminal único de salida del subdiagrama.'),
  constant: def('Constante', 'Fuentes', '#', [], 'number', {value:num('Valor',1)}, 'Un valor numérico fijo.'),
  slider: def('Control deslizante', 'Fuentes', '↔', [], 'number', {value:num('Valor',1), min:num('Mínimo',0), max:num('Máximo',10)}, 'Valor ajustable en vivo desde el panel frontal.'),
  toggle: def('Interruptor', 'Fuentes', '⏻', [], 'boolean', {value:opt('Estado','0',['0','1'])}, 'Control booleano ajustable en vivo.'),
  signal: def('Generador de señal', 'Fuentes', '∿', [], 'number', {wave:opt('Forma','sine',['sine','square','triangle','saw']), frequency:num('Frecuencia · Hz',0.5,0,1000), amplitude:num('Amplitud',1,0), offset:num('Offset',0), phase:num('Fase · rad',0)}, 'Señal calculada con el tiempo real transcurrido.'),
  time: def('Tiempo', 'Fuentes', '◷', [], 'number', {}, 'Segundos desde el inicio de la ejecución.'),
  integer: def('Constante entera', 'Fuentes', 'I32', [], 'integer', {value:num('Valor entero',1,-2147483648,2147483647,1)}, 'Entero con signo de 32 bits. Puede alimentar entradas decimales.'),
  text: def('Control de texto', 'Fuentes', 'abc', [], 'string', {value:{type:'text',label:'Texto',value:'Hola, ESP32',maxLength:1024}}, 'Cadena de texto editable en vivo desde el panel frontal.'),
  add: def('Suma', 'Matemática', '+', ['a','b'], 'number', {}, 'a + b'),
  subtract: def('Resta', 'Matemática', '−', ['a','b'], 'number', {}, 'a − b'),
  multiply: def('Multiplicación', 'Matemática', '×', ['a','b'], 'number', {}, 'a × b'),
  divide: def('División', 'Matemática', '÷', ['a','b'], 'number', {}, 'a / b. La división por cero detiene el flujo.'),
  map: def('Escalar rango', 'Matemática', '↗', ['in'], 'number', {inMin:num('Entrada mínima',0), inMax:num('Entrada máxima',4095), outMin:num('Salida mínima',0), outMax:num('Salida máxima',3.3)}, 'Transformación lineal entre dos rangos; no limita valores.'),
  clamp: def('Limitar', 'Matemática', '⊣', ['in'], 'number', {min:num('Mínimo',0), max:num('Máximo',1)}, 'Satura la entrada al intervalo indicado.'),
  compare: def('Comparador', 'Lógica', '>', ['a','b'], 'boolean', {op:opt('Operador','>',['>','<','>=','<=','==','!='])}, 'Compara dos números y produce verdadero o falso.'),
  and: def('AND', 'Lógica', '&', [input('a','boolean'),input('b','boolean')], 'boolean', {}, 'Verdadero cuando ambas entradas son verdaderas.'),
  not: def('NOT', 'Lógica', '!', [input('in','boolean')], 'boolean', {}, 'Invierte una señal booleana.'),
  select: def('Selector', 'Lógica', '?', [input('if','boolean'),'yes','no'], 'number', {}, 'Selecciona yes o no según la entrada if.'),
  concat: def('Concatenar texto', 'Texto y conversión', 'ab+', [input('a','string'),input('b','string')], 'string', {}, 'Une dos cadenas; máximo 4096 caracteres de salida.'),
  toText: def('Número a texto', 'Texto y conversión', '→abc', ['in'], 'string', {}, 'Convierte un número a texto con seis decimales.'),
  toInteger: def('Convertir a entero', 'Texto y conversión', '→I32', ['in'], 'integer', {}, 'Trunca hacia cero y limita al rango de entero de 32 bits.'),
  abs: def('Valor absoluto', 'Matemática', '|x|', ['in'], 'number', {}, 'Magnitud absoluta de una entrada numérica.'),
  power: def('Potencia', 'Matemática', 'xʸ', ['base','exponent'], 'number', {}, 'Base elevada al exponente. Los resultados no finitos detienen el flujo.'),
  sqrt: def('Raíz cuadrada', 'Matemática', '√', ['in'], 'number', {}, 'Raíz cuadrada; requiere entrada no negativa.'),
  modulo: def('Resto', 'Matemática', '%', ['a','b'], 'number', {}, 'Resto con signo de a; rechaza divisor cero.'),
  round: def('Redondear', 'Matemática', '≈Z', ['in'], 'number', {mode:opt('Método','nearest',['nearest','floor','ceil','trunc'])}, 'Redondeo al más próximo (empates hacia +∞), piso, techo o truncamiento.'),
  trig: def('Trigonometría', 'Matemática', 'sin', ['in'], 'number', {fn:opt('Función','sin',['sin','cos','tan','asin','acos','atan']),unit:opt('Unidad angular','radians',['radians','degrees'])}, 'Funciones directas e inversas. asin/acos requieren una entrada entre −1 y 1.'),
  logarithm: def('Logaritmo', 'Matemática', 'ln', ['in'], 'number', {base:opt('Base','natural',['natural','10','2'])}, 'Logaritmo natural, decimal o binario. Requiere un valor mayor que cero.'),
  exponential: def('Exponencial', 'Matemática', 'eˣ', ['in'], 'number', {}, 'e elevado a la entrada. Detecta desbordamiento.'),
  minmax: def('Mínimo / máximo', 'Matemática', '↕', ['a','b'], 'number', {mode:opt('Operación','min',['min','max'])}, 'Selecciona el menor o mayor de dos números.'),
  or: def('OR', 'Lógica', '≥1', [input('a','boolean'),input('b','boolean')], 'boolean', {}, 'Verdadero si al menos una entrada es verdadera.'),
  xor: def('XOR', 'Lógica', '⊕', [input('a','boolean'),input('b','boolean')], 'boolean', {}, 'Verdadero cuando las entradas son distintas.'),
  boolToNumber: def('Booleano a número', 'Texto y conversión', '→01', [input('in','boolean')], 'integer', {}, 'Convierte falso a 0 y verdadero a 1.'),
  length: def('Longitud de texto', 'Texto y conversión', '#abc', [input('in','string')], 'integer', {}, 'Cantidad de bytes UTF-8, coherente con String de Arduino.'),
  pulse: def('Reloj de pulsos', 'Fuentes', '▔▁', [], 'boolean', {period:num('Período · s',1,0.02,86400), duty:num('Ciclo activo · %',50,0,100),phase:num('Desfase · s',0,0,86400)}, 'Señal booleana periódica; el período de muestreo debe resolver sus flancos.'),
  random: def('Ruido uniforme', 'Fuentes', '⚄', [], 'number', {min:num('Mínimo',-1),max:num('Máximo',1),seed:num('Semilla',12345,1,4294967295,1)}, 'PRNG xorshift32 reproducible en simulación y Arduino. No criptográfico.'),
  movingAverage: def('Media móvil', 'Procesamiento', 'μ', ['in'], 'number', {window:num('Ventana · muestras',20,1,256,1)}, 'Promedio de las últimas N muestras; durante el inicio usa las disponibles.'),
  rms: def('RMS móvil', 'Procesamiento', 'RMS', ['in'], 'number', {window:num('Ventana · muestras',20,1,256,1)}, 'Raíz de la media de cuadrados de las últimas N muestras.'),
  derivative: def('Derivada', 'Procesamiento', 'd/dt', ['in'], 'number', {}, 'Diferencia entre muestras dividida por dt; primera salida cero. Sensible al ruido.'),
  integrator: def('Integrador', 'Procesamiento', '∫', ['in'], 'number', {initial:num('Estado inicial',0),min:num('Límite inferior',-1000000),max:num('Límite superior',1000000)}, 'Integral rectangular con paso real y límites de saturación.'),
  hysteresis: def('Histéresis', 'Control', '⇄', ['in'], 'boolean', {low:num('Umbral inferior',1),high:num('Umbral superior',2)}, 'Activa al alcanzar high; desactiva al caer hasta low; inicia apagado.'),
  edge: def('Detector de flanco', 'Control', '↑', [input('in','boolean')], 'boolean', {mode:opt('Flanco','rising',['rising','falling','both'])}, 'Pulso de un ciclo ante transición. El estado previo inicial es falso.'),
  counter: def('Contador de eventos', 'Control', 'N↑', [input('in','boolean'),input('reset','boolean')], 'integer', {}, 'Cuenta flancos ascendentes; reset tiene prioridad. Saturación en 2147483647.'),
  onDelay: def('Retardo a la conexión', 'Control', 'TON', [input('in','boolean')], 'boolean', {duration:num('Retardo · s',1,0,86400)}, 'Requiere entrada verdadera continua durante el tiempo configurado. Falso reinicia el temporizador.'),
  runningStat: def('Estadística acumulada', 'Procesamiento', 'Σ', ['in'], 'number', {mode:opt('Estadística','mean',['mean','min','max','stddev'])}, 'Media, mínimo, máximo o desviación estándar poblacional desde el inicio; algoritmo de Welford.'),
  filter: def('Filtro paso bajo', 'Control', '≈', ['in'], 'number', {tau:num('Constante de tiempo · s',0.25,0.001,3600)}, 'Filtro de primer orden con paso de tiempo real.'),
  pid: def('Controlador PID', 'Control', 'Π', ['set','pv'], 'number', {kp:num('Kp',1), ki:num('Ki',0), kd:num('Kd',0), min:num('Salida mínima',0), max:num('Salida máxima',255)}, 'PID discreto con anti-windup condicional y derivada sobre medición.'),
  delay: def('Memoria de un ciclo', 'Control', 'z⁻¹', ['in'], 'number', {initial:num('Valor inicial',0)}, 'Entrega el valor del ciclo anterior; permite realimentación.'),
  chart: def('Osciloscopio', 'Instrumentos', '⌁', ['in'], 'number', {unit:{type:'text',label:'Unidad',value:'V'}}, 'Traza temporal. Conserva las últimas 600 muestras en pantalla.'),
  gauge: def('Indicador numérico', 'Instrumentos', '◴', ['in'], 'number', {unit:{type:'text',label:'Unidad',value:'V'}, min:num('Mínimo',0), max:num('Máximo',5)}, 'Lectura numérica e indicador de rango en el panel frontal.'),
  led: def('LED de estado', 'Instrumentos', '●', [input('in','boolean')], 'boolean', {}, 'Indicador booleano en el panel frontal.'),
  textIndicator: def('Indicador de texto', 'Instrumentos', 'abc', [input('in','string')], 'string', {}, 'Muestra texto en el panel frontal.'),
  log: def('Registro de datos', 'Instrumentos', '≡', ['in'], 'number', {unit:{type:'text',label:'Unidad',value:''}}, 'Registra tiempo y valor. Exportación CSV desde la barra inferior.'),
  adc: def('ESP32 · ADC', 'ESP32', 'A', [], 'integer', {pin:num('GPIO',34,0,54,1), mode:opt('Lectura','raw',['raw','millivolts'])}, 'Lee ADC de 12 bits o milivoltios calibrados por Arduino.'),
  digitalRead: def('ESP32 · Entrada digital', 'ESP32', 'D↓', [], 'boolean', {pin:num('GPIO',27,0,54,1), pull:opt('Resistencia','none',['none','up','down'])}, 'Lee GPIO con resistencia interna opcional.'),
  digitalWrite: def('ESP32 · Salida digital', 'ESP32', 'D↑', [input('in','boolean')], 'boolean', {pin:num('GPIO',25,0,54,1)}, 'Escribe HIGH o LOW. En simulación no toca el hardware.'),
  pwm: def('ESP32 · PWM', 'ESP32', '▥', ['in'], 'integer', {pin:num('GPIO',26,0,54,1), frequency:num('Frecuencia · Hz',1000,100,20000,1)}, 'PWM LEDC de 8 bits; entrada limitada y redondeada a 0–255.'),
  i2cRead: def('ESP32 · I²C leer', 'ESP32', 'I↓', [], 'integer', {address:num('Dirección decimal',72,8,119,1), register:num('Registro',0,0,255,1)}, 'Lee un registro de 8 bits del bus I²C configurado.'),
  i2cWrite: def('ESP32 · I²C escribir', 'ESP32', 'I↑', ['in'], 'integer', {address:num('Dirección decimal',72,8,119,1), register:num('Registro',0,0,255,1)}, 'Escribe un registro de 8 bits; entrada limitada a 0–255.')
};
export const DATA_TYPES={number:{label:'Decimal · DBL',color:'#f3ab69'},integer:{label:'Entero · I32',color:'#79adff'},boolean:{label:'Booleano · BOOL',color:'#65cbaa'},string:{label:'Texto · STRING',color:'#ed93c6'},vector:{label:'Vector · DBL[]',color:'#bb99ff'},waveform:{label:'Waveform · Y/dt',color:'#66d2df'}};
export const compatible=(source,target)=>source===target||(source==='integer'&&target==='number');
export function describe(n){
  const d=Object.hasOwn(TYPES,n?.type)?TYPES[n.type]:null;if(!d)return undefined;
  if(n.type==='subvi')return {...d,inputs:[input('in',n.params?.inputType)],output:n.params?.outputType};
  if(n.type==='subInput')return {...d,output:n.params?.kind};
  if(n.type==='subOutput')return {...d,inputs:[input('in',n.params?.kind)],output:n.params?.kind};
  return d;
}

export const BOARDS = {
  esp32: {name:'ESP32', fqbn:'esp32:esp32:esp32', gpio:[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33,34,35,36,39], adc:[32,33,34,35,36,39], inputOnly:[34,35,36,39], sda:21,scl:22, output:25},
  esp32s2: {name:'ESP32-S2', fqbn:'esp32:esp32:esp32s2', gpio:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,21], adc:[1,2,3,4,5,6,7,8,9,10],inputOnly:[],sda:8,scl:9,output:5},
  esp32s3: {name:'ESP32-S3', fqbn:'esp32:esp32:esp32s3', gpio:[1,2,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,21], adc:[1,2,4,5,6,7,8,9,10],inputOnly:[],sda:8,scl:9,output:5},
  esp32c3: {name:'ESP32-C3', fqbn:'esp32:esp32:esp32c3', gpio:[0,1,3,4,5,6,7,10], adc:[0,1,3,4],inputOnly:[],sda:6,scl:7,output:5},
  esp32c6: {name:'ESP32-C6', fqbn:'esp32:esp32:esp32c6', gpio:[0,1,2,3,4,5,6,7,10,11,18,19,20,21,22,23], adc:[0,1,2,3,4,5,6],inputOnly:[],sda:6,scl:7,output:5}
};
Object.setPrototypeOf(TYPES,null);
Object.setPrototypeOf(BOARDS,null);
export function createNode(type,id,x=100,y=100) {
  if(!TYPES[type]) throw Error('Tipo de nodo desconocido');
  const n={id,type,label:TYPES[type].label,x,y,params:Object.fromEntries(Object.entries(TYPES[type].params).map(([k,v])=>[k,v.value]))};
  if(type==='subvi'){n.graph=example('empty');n.graph.name='Subdiagrama';n.graph.nodes=[createNode('subInput','input',60,80),createNode('subOutput','output',420,80)];n.graph.edges=[{from:'input',to:'output',input:'in'}];}
  return n;
}
export function validate(project,depth=0,budget={count:0}) {
  const errors=[];
  if(depth>8)return ['Subdiagramas: profundidad máxima 8.'];
  if(!project || project.version!==1 || !Array.isArray(project.nodes) || !Array.isArray(project.edges)) return ['Formato de proyecto inválido (se requiere version: 1).'];
  if(project.nodes.length>200 || project.edges.length>1000) return ['Límite: 200 nodos y 1000 conexiones.'];
  budget.count+=project.nodes.length;if(budget.count>2000)return ['Máximo 2000 nodos en la jerarquía.'];
  if(typeof project.board!=='string'||!BOARDS[project.board]) errors.push('Perfil de placa desconocido.');
  if(!Number.isFinite(project.interval) || project.interval<20 || project.interval>1000) errors.push('El período debe estar entre 20 y 1000 ms.');
  if(project.panel!==undefined){
    if(!project.panel||typeof project.panel!=='object'||Array.isArray(project.panel)||Object.keys(project.panel).length>200) errors.push('Disposición del panel frontal inválida.');
    else for(const [id,p] of Object.entries(project.panel)){
      if(!/^[a-zA-Z0-9_-]{1,60}$/.test(id)||!p||typeof p!=='object'||!Number.isFinite(p.x)||p.x<0||p.x>5000||!Number.isFinite(p.y)||p.y<0||p.y>5000||!Number.isFinite(p.w)||p.w<220||p.w>1400||!Number.isFinite(p.h)||p.h<150||p.h>1200)errors.push('Posición o tamaño de instrumento inválidos.');
    }
  }
  const ids=new Set(), map=new Map();
  for(const n of project.nodes) {
    if(!n || typeof n.id!=='string' || !/^[a-zA-Z0-9_-]{1,60}$/.test(n.id) || ids.has(n.id)) {errors.push('ID de nodo inválido o repetido.');continue;}
    ids.add(n.id);map.set(n.id,n);
    const d=describe(n);
    if(typeof n.type!=='string'||!d){errors.push(`Nodo ${n.id}: tipo desconocido.`);continue;}
    if(typeof n.label!=='string' || n.label.length>80 || !Number.isFinite(n.x) || !Number.isFinite(n.y) || n.x<0 || n.x>5500 || n.y<0 || n.y>3500) errors.push(`${n.id}: nombre o posición inválidos.`);
    if(!n.params || typeof n.params!=='object' || Array.isArray(n.params)) errors.push(`${n.id}: parámetros inválidos.`);
    for(const [k,p] of Object.entries(d.params)) {
      const v=n.params?.[k];
      if(p.type==='number' && (!Number.isFinite(v) || v<p.min || v>p.max || (p.step===1 && !Number.isInteger(v)))) errors.push(`${n.label}: ${p.label} fuera de rango.`);
      if(p.type==='select' && !p.options.includes(v)) errors.push(`${n.label}: opción ${p.label} inválida.`);
      if(p.type==='text' && (typeof v!=='string' || v.length>(p.maxLength??40) || v.includes('\0'))) errors.push(`${n.label}: texto inválido.`);
    }
    const p=n.params||{};
    if(n.type==='vector')try{parseVector(p.values);}catch(e){errors.push(`${n.label}: ${e.message}`);}
    if(n.type==='adcBurst'&&(p.pre>=p.count||p.trigger==='immediate'&&p.pre!==0))errors.push(`${n.label}: pretrigger inválido.`);
    if(n.type==='subvi'){
      const childErrors=validate(n.graph,depth+1,budget);errors.push(...childErrors.map(e=>`${n.label}: ${e}`));
      if(!childErrors.length){const ins=n.graph.nodes.filter(x=>x.type==='subInput'),outs=n.graph.nodes.filter(x=>x.type==='subOutput');
        if(ins.length!==1||outs.length!==1||ins[0]?.params.kind!==p.inputType||outs[0]?.params.kind!==p.outputType)errors.push(`${n.label}: debe haber una entrada y una salida con tipos coincidentes.`);}
    }
    if(['slider','clamp','pid','gauge','integrator','random'].includes(n.type) && p.min>=p.max) errors.push(`${n.label}: el mínimo debe ser menor al máximo.`);
    if(n.type==='integrator'&&(p.initial<p.min||p.initial>p.max))errors.push(`${n.label}: estado inicial fuera de los límites.`);
    if(n.type==='hysteresis'&&p.low>=p.high)errors.push(`${n.label}: el umbral inferior debe ser menor al superior.`);
    if(n.type==='slider' && (p.value<p.min || p.value>p.max)) errors.push(`${n.label}: valor fuera de sus límites.`);
    if(n.type==='map' && p.inMin===p.inMax) errors.push(`${n.label}: rango de entrada vacío.`);
  }
  const connected=new Set();
  for(const e of project.edges) {
    if(!e || typeof e.from!=='string' || typeof e.to!=='string') {errors.push('Conexión inválida.');continue;}
    const a=map.get(e.from),b=map.get(e.to),port=describe(b)?.inputs.find(p=>p.name===e.input);
    if(!a||!b||!port||!TYPES[a.type]) {errors.push('Conexión a un nodo o puerto inexistente.');continue;}
    if(!compatible(describe(a).output,port.type)) errors.push(`${b.label}: tipo incompatible en ${port.name}.`);
    const key=`${e.to}:${e.input}`;
    if(connected.has(key)) errors.push(`${b.label}: entrada ${e.input} conectada más de una vez.`);
    connected.add(key);
  }
  for(const n of project.nodes) for(const p of describe(n)?.inputs||[]) if(!connected.has(`${n.id}:${p.name}`)) errors.push(`${n.label}: falta conectar ${p.name}.`);
  if(!errors.length) {try {executionOrder(project);} catch(e){errors.push(e.message);}}
  return errors;
}
export function hardwareErrors(project) {
  const collect=(nodes)=>nodes.flatMap(n=>n.type==='subvi'?collect(n.graph.nodes):[n]);
  project={...project,nodes:collect(project.nodes)};
  const b=BOARDS[project.board], errors=[]; if(!b) return ['Placa desconocida.'];
  const bursts=project.nodes.filter(n=>n.type==='adcBurst');
  if(bursts.length>1||bursts.length&&project.nodes.some(n=>['adc','pwm','digitalWrite','i2cWrite','i2cTransfer'].includes(n.type)))errors.push('La adquisición DMA requiere un grafo sin otras operaciones ADC ni salidas/I²C multibyte.');
  const claims=new Map();
  for(const n of project.nodes) {
    if(!['adc','adcBurst','digitalRead','digitalWrite','pwm'].includes(n.type)) continue;
    const p=n.params.pin;
    if(!b.gpio.includes(p) || (['adc','adcBurst'].includes(n.type)&&!b.adc.includes(p))) errors.push(`${n.label}: GPIO ${p} no permitido para esta función en ${b.name}.`);
    if(['digitalWrite','pwm'].includes(n.type) && b.inputOnly.includes(p)) errors.push(`GPIO ${p} es solamente entrada.`);
    if(n.type==='digitalRead' && b.inputOnly.includes(p) && n.params.pull!=='none') errors.push(`GPIO ${p} no tiene pull-up/down interno.`);
    if(claims.has(p)) errors.push(`GPIO ${p} está asignado a más de un nodo. Use una salida con varias conexiones.`);
    claims.set(p,n.type);
  }
  if(project.nodes.some(n=>n.type.startsWith('i2c'))) {
    const {sda,scl}=project.i2c||{};
    if(!b.gpio.includes(sda)||!b.gpio.includes(scl)||b.inputOnly.includes(sda)||b.inputOnly.includes(scl)||sda===scl) errors.push('Pines I²C inválidos.');
    if(claims.has(sda)||claims.has(scl)) errors.push('I²C comparte pines con otro nodo.');
  }
  return errors;
}
export function executionOrder(project) {
  const byId=new Map(project.nodes.map(n=>[n.id,n])), order=[], active=new Set(), done=new Set();
  function visit(n) {
    if(done.has(n.id)) return;
    if(active.has(n.id)) throw Error('Realimentación sin memoria: inserta un nodo «Memoria de un ciclo».');
    active.add(n.id);
    if(n.type!=='delay') for(const e of project.edges.filter(e=>e.to===n.id)) visit(byId.get(e.from));
    active.delete(n.id);done.add(n.id);order.push(n);
  }
  for(const n of project.nodes) visit(n);
  return order;
}
export class Runtime {
  get cancelled(){return this._cancelled;}
  set cancelled(value){this._cancelled=value;for(const child of this.children?.values()||[])child.cancelled=value;}
  constructor(project, hardware=null) {
    const errors=validate(project); if(errors.length) throw Error(errors.join('\n'));
    this.project=project; this.order=executionOrder(project);this.hardware=hardware;
    this.state=new Map();this.values=new Map();this.cancelled=false;this.samples=0;
    this.children=new Map(project.nodes.filter(n=>n.type==='subvi').map(n=>[n.id,new Runtime(n.graph,hardware)]));
    this.inputs=new Map(project.nodes.map(n=>[n.id,Object.fromEntries(project.edges.filter(e=>e.to===n.id).map(e=>[e.input,e.from]))]));
  }
  async tick(t,dt,externalInput=undefined) {
    if(!Number.isFinite(t)||!Number.isFinite(dt)||dt<=0) throw Error('Tiempo de ejecución inválido.');
    const values=new Map(), nextDelay=new Map();
    for(const n of this.order) {
      if(this.cancelled) throw Error('Ejecución cancelada.');
      const p=n.params, v=Object.fromEntries(Object.entries(this.inputs.get(n.id)).map(([k,id])=>[k,values.get(id)]));
      let out, state=this.state.get(n.id);
      switch(n.type) {
        case 'subInput':if(externalInput===undefined)throw Error('Entrada de subdiagrama sin contexto.');out=externalInput;break;
        case 'subOutput':out=v.in;break;
        case 'subvi':{const child=this.children.get(n.id);const outputs=await child.tick(t,dt,v.in);out=outputs.get(n.graph.nodes.find(x=>x.type==='subOutput').id);break;}
        case 'vector':out=parseVector(p.values);break;
        case 'makeWaveform':out=waveform(v.in,p.dt,p.t0);break;
        case 'waveformSamples':out=vector(v.in.samples);break;
        case 'waveformScale':out=waveform(v.in.samples.map(x=>x*p.gain+p.offset),v.in.dt,v.in.t0,v.in);break;
        case 'waveformChart':out=checkWaveform(v.in);break;
        case 'vectorAt':if(p.index>=v.in.length)throw Error('Índice fuera del vector.');out=v.in[p.index];break;
        case 'vectorStat':if(!v.in.length)throw Error('Vector vacío.');out=p.mode==='min'?Math.min(...v.in):p.mode==='max'?Math.max(...v.in):p.mode==='rms'?Math.sqrt(v.in.reduce((a,x)=>a+x*x,0)/v.in.length):v.in.reduce((a,x)=>a+x,0)/v.in.length;break;
        case 'adcBurst':out=this.hardware?checkWaveform(await this.hardware('burst',p)):waveform(Array.from({length:p.count},(_,i)=>Math.round(2048+1500*Math.sin(2*Math.PI*1000*(i-p.pre)/p.rate))),1/p.rate,-p.pre/p.rate,{simulated:true,seq:this.samples+1,triggerIndex:p.trigger==='immediate'?-1:p.pre,unit:'ADC raw'});break;
        case 'i2cTransfer':{const tx=bytes(v.tx);if(!tx.length&&!p.readCount)throw Error('Transacción I²C vacía.');out=this.hardware?bytes(await this.hardware('i2cxfer',{...p,tx,stop:p.stop==='stop'})):Array.from({length:p.readCount},(_,i)=>i);if(out.length!==p.readCount)throw Error('I²C: respuesta incompleta.');break;}
        case 'constant':case 'slider':case 'integer':case 'text':out=p.value;break;
        case 'toggle':out=p.value==='1';break;
        case 'time':out=t;break;
        case 'signal': {const phase=t*p.frequency+p.phase/(2*Math.PI), f=phase-Math.floor(phase); const wave=p.wave==='sine'?Math.sin(2*Math.PI*phase):p.wave==='square'?(f<.5?1:-1):p.wave==='triangle'?1-4*Math.abs(f-.5):2*f-1;out=p.offset+p.amplitude*wave;break;}
        case 'add':out=v.a+v.b;break;case 'subtract':out=v.a-v.b;break;case 'multiply':out=v.a*v.b;break;
        case 'divide':if(v.b===0) throw Error(`${n.label}: división por cero.`);out=v.a/v.b;break;
        case 'map':out=p.outMin+(v.in-p.inMin)*(p.outMax-p.outMin)/(p.inMax-p.inMin);break;
        case 'clamp':out=Math.max(p.min,Math.min(p.max,v.in));break;
        case 'compare':out=({'>':()=>v.a>v.b,'<':()=>v.a<v.b,'>=':()=>v.a>=v.b,'<=':()=>v.a<=v.b,'==':()=>v.a===v.b,'!=':()=>v.a!==v.b})[p.op]();break;
        case 'and':out=v.a&&v.b;break;case 'not':out=!v.in;break;case 'select':out=v.if?v.yes:v.no;break;
        case 'concat':out=v.a+v.b;break;
        case 'toText':out=v.in.toFixed(6);break;
        case 'toInteger':out=Math.trunc(Math.max(-2147483648,Math.min(2147483647,v.in)));break;
        case 'abs':out=Math.abs(v.in);break;
        case 'power':out=Math.pow(v.base,v.exponent);break;
        case 'sqrt':if(v.in<0)throw Error(`${n.label}: raíz de un número negativo.`);out=Math.sqrt(v.in);break;
        case 'modulo':if(v.b===0)throw Error(`${n.label}: divisor cero.`);out=v.a%v.b;break;
        case 'round':out=Math[{nearest:'round',floor:'floor',ceil:'ceil',trunc:'trunc'}[p.mode]](v.in);break;
        case 'trig':{const inverse=p.fn.startsWith('a');const scale=p.unit==='degrees'?Math.PI/180:1;out=inverse?Math[p.fn](v.in)/scale:Math[p.fn](v.in*scale);break;}
        case 'logarithm':if(v.in<=0)throw Error(`${n.label}: logaritmo requiere entrada positiva.`);out=p.base==='10'?Math.log10(v.in):p.base==='2'?Math.log2(v.in):Math.log(v.in);break;
        case 'exponential':out=Math.exp(v.in);break;
        case 'minmax':out=Math[p.mode](v.a,v.b);break;
        case 'or':out=v.a||v.b;break;case 'xor':out=v.a!==v.b;break;
        case 'boolToNumber':out=v.in?1:0;break;
        case 'length':out=new TextEncoder().encode(v.in).length;break;
        case 'pulse':{const phase=(t+p.phase)/p.period;out=(phase-Math.floor(phase))*100<p.duty;break;}
        case 'random':{let x=state??p.seed;x^=x<<13;x^=x>>>17;x^=x<<5;x>>>=0;this.state.set(n.id,x);out=p.min+(x/4294967296)*(p.max-p.min);break;}
        case 'movingAverage':case 'rms':{state??=[];state.push(v.in);if(state.length>p.window)state.shift();out=n.type==='rms'?Math.sqrt(state.reduce((s,x)=>s+x*x,0)/state.length):state.reduce((s,x)=>s+x,0)/state.length;this.state.set(n.id,state);break;}
        case 'derivative':out=state===undefined?0:(v.in-state)/dt;this.state.set(n.id,v.in);break;
        case 'integrator':out=Math.max(p.min,Math.min(p.max,(state??p.initial)+v.in*dt));this.state.set(n.id,out);break;
        case 'hysteresis':out=v.in>=p.high?true:v.in<=p.low?false:(state??false);this.state.set(n.id,out);break;
        case 'edge':{const previous=state??false;out=p.mode==='rising'?v.in&&!previous:p.mode==='falling'?!v.in&&previous:v.in!==previous;this.state.set(n.id,v.in);break;}
        case 'counter':{state??={previous:false,count:0};if(v.reset)state.count=0;else if(v.in&&!state.previous)state.count=Math.min(2147483647,state.count+1);state.previous=v.in;out=state.count;this.state.set(n.id,state);break;}
        case 'onDelay':state=v.in?Math.min(p.duration,(state??0)+dt):0;out=v.in&&state>=p.duration;this.state.set(n.id,state);break;
        case 'runningStat':{state??={count:0,mean:0,m2:0,min:v.in,max:v.in};state.count++;const delta=v.in-state.mean;state.mean+=delta/state.count;state.m2+=delta*(v.in-state.mean);state.min=Math.min(state.min,v.in);state.max=Math.max(state.max,v.in);out=p.mode==='stddev'?Math.sqrt(Math.max(0,state.m2/state.count)):state[p.mode];this.state.set(n.id,state);break;}
        case 'filter':out=state===undefined?v.in:state+(1-Math.exp(-dt/p.tau))*(v.in-state);this.state.set(n.id,out);break;
        case 'pid': {
          state??={integral:0,previous:v.pv}; const error=v.set-v.pv, integral=state.integral+error*dt;
          const raw=p.kp*error+p.ki*integral-p.kd*(v.pv-state.previous)/dt;
          out=Math.max(p.min,Math.min(p.max,raw));
          if(raw===out || (raw>p.max&&p.ki*error<0) || (raw<p.min&&p.ki*error>0)) state.integral=integral;
          state.previous=v.pv;this.state.set(n.id,state);break;
        }
        case 'delay':out=state??p.initial;break;
        case 'adc':out=this.hardware?await this.hardware('adc',{pin:p.pin,mode:p.mode}):Math.round((.5+.4*Math.sin(t*1.8))*(p.mode==='raw'?4095:3300));break;
        case 'digitalRead':out=this.hardware?Boolean(await this.hardware('read',{pin:p.pin,pull:p.pull})):Math.sin(t*2)>0;break;
        case 'digitalWrite':out=v.in;if(this.hardware) await this.hardware('write',{pin:p.pin,value:out?1:0});break;
        case 'pwm':out=Math.round(Math.max(0,Math.min(255,v.in)));if(this.hardware) await this.hardware('pwm',{pin:p.pin,value:out,frequency:p.frequency});break;
        case 'i2cRead':out=this.hardware?await this.hardware('i2cread',p):Math.round(24+3*Math.sin(t));break;
        case 'i2cWrite':out=Math.round(Math.max(0,Math.min(255,v.in)));if(this.hardware) await this.hardware('i2cwrite',{...p,value:out});break;
        default:out=v.in;
      }
      const type=describe(n).output;
      if(type==='vector')out=vector(out);
      else if(type==='waveform')out=checkWaveform(out);
      else if(type==='string'?(typeof out!=='string'||out.length>4096):type==='boolean'?typeof out!=='boolean':!Number.isFinite(out)||(type==='integer'&&(!Number.isInteger(out)||out<-2147483648||out>2147483647))) throw Error(`${n.label}: resultado numérico o tipo inválido.`);
      values.set(n.id,out);
    }
    for(const n of this.order.filter(n=>n.type==='delay')) nextDelay.set(n.id,values.get(this.inputs.get(n.id).in));
    for(const [id,value] of nextDelay) this.state.set(id,value);
    this.values=values;this.samples++;return values;
  }
}
export function example(kind='signal',board='esp32') {
  const b=BOARDS[board], p={version:1,name:'Banco de señales',board,interval:50,i2c:{sda:b.sda,scl:b.scl},nodes:[],edges:[]};
  const node=(type,id,x,y,params={},label)=>{const n=createNode(type,id,x,y);Object.assign(n.params,params);if(label)n.label=label;p.nodes.push(n);return id;};
  const edge=(from,to,input='in')=>p.edges.push({from,to,input});
  if(kind==='signal') {
    node('signal','source',70,95,{amplitude:1.4,offset:1.65,frequency:.4},'Señal de entrada');
    node('filter','filter',360,95,{tau:.2},'Filtro de señal');
    node('chart','scope',650,65,{},'Señal filtrada');node('gauge','meter',650,235,{max:3.3},'Voltaje de salida');
    node('constant','limit',360,335,{value:2.2},'Umbral · 2,2 V');
    node('compare','compare',650,420,{},'Detección de nivel');node('led','led',940,420,{},'Alarma de nivel');
    node('log','log',940,100,{},'Adquisición de datos');
    edge('source','filter');edge('filter','scope');edge('filter','meter');edge('filter','compare','a');edge('limit','compare','b');edge('compare','led');edge('filter','log');
  } else if(kind==='adc') {
    p.name='ESP32 · Adquisición analógica';node('adc','adc',80,120,{pin:b.adc[0]});node('map','scale',360,120);node('chart','scope',650,70);node('gauge','meter',650,260,{max:3.3});node('log','log',940,120);
    edge('adc','scale');edge('scale','scope');edge('scale','meter');edge('scale','log');
  } else if(kind==='pwm') {
    p.name='ESP32 · Control PWM';node('slider','knob',90,150,{value:0,min:0,max:255},'Potencia PWM');node('pwm','pwm',410,150,{pin:b.output});node('gauge','meter',740,150,{unit:' / 255',max:255},'Duty cycle');edge('knob','pwm');edge('pwm','meter');
  } else if(kind==='feedback') {
    p.name='Contador con realimentación';node('constant','one',60,60,{value:1});node('delay','delay',60,260);node('add','sum',370,140);node('gauge','meter',680,140,{unit:'ciclos',max:100});edge('one','sum','a');edge('delay','sum','b');edge('sum','delay');edge('sum','meter');
  } else if(kind==='types') {
    p.name='Tipos de datos · cables por color';
    node('constant','decimal',70,50,{value:1.5},'Decimal · naranja');node('gauge','decimalDisplay',370,50,{},'Indicador decimal');edge('decimal','decimalDisplay');
    node('integer','integer',70,235,{value:42},'Entero · azul');node('toText','convert',370,235,{},'Conversión explícita');node('textIndicator','integerDisplay',670,235,{},'Entero convertido a texto');edge('integer','convert');edge('convert','integerDisplay');
    node('toggle','boolean',70,420,{value:'1'},'Booleano · verde');node('led','boolDisplay',370,420,{},'Indicador booleano');edge('boolean','boolDisplay');
    node('text','text',70,605,{value:'Hola, ESP32'},'Texto · rosa');node('textIndicator','textDisplay',370,605,{},'Indicador de texto');edge('text','textDisplay');
  } else if(kind==='processing') {
    p.name='Procesamiento · ruido y estadísticas';
    node('random','noise',50,70,{},'Ruido reproducible');node('movingAverage','average',350,70,{window:16},'Media móvil · 16 muestras');node('chart','scope',650,70,{},'Señal suavizada');
    node('rms','rms',350,260,{window:32},'RMS · 32 muestras');node('gauge','rmsDisplay',650,260,{unit:'RMS',min:0,max:1},'Nivel eficaz');
    node('runningStat','stats',350,450,{mode:'stddev'},'Desviación estándar');node('gauge','statsDisplay',650,450,{unit:'σ',min:0,max:1},'Dispersión de la señal');
    edge('noise','average');edge('average','scope');edge('noise','rms');edge('rms','rmsDisplay');edge('noise','stats');edge('stats','statsDisplay');
  } else if(kind==='burst') {
    p.name='ADC DMA · captura por lotes';p.interval=1000;
    node('adcBurst','burst',50,80,{pin:b.adc[0]});node('waveformChart','scope',350,60);node('waveformSamples','samples',350,270);node('vectorStat','rms',650,270,{mode:'rms'});node('gauge','value',950,270,{unit:'ADC RMS',max:4095});
    edge('burst','scope');edge('burst','samples');edge('samples','rms');edge('rms','value');
  } else if(kind==='module') {
    p.name='SubVI · integración encapsulada';node('constant','source',50,80,{value:2});node('subvi','module',350,80);node('chart','scope',650,80);edge('source','module');edge('module','scope');
    const graph=p.nodes.find(n=>n.id==='module').graph;graph.name='Integrador reutilizable';graph.board=board;
    graph.nodes.push(createNode('integrator','integral',260,80));graph.nodes.find(n=>n.type==='subOutput').x=550;graph.edges=[{from:'input',to:'integral',input:'in'},{from:'integral',to:'output',input:'in'}];
  } else if(kind==='i2cframe') {
    p.name='I²C · registro y lectura de seis bytes';node('vector','register',50,80,{values:'[0]'});node('i2cTransfer','sensor',350,80,{readCount:6});node('vectorAt','byte',650,80);node('gauge','value',950,80,{unit:'byte',max:255});edge('register','sensor','tx');edge('sensor','byte');edge('byte','value');
  } else if(kind!=='empty') throw Error('Ejemplo desconocido');
  return p;
}
// Compile scalar subVIs by expanding each instance with disjoint state/node IDs.
export function flattenModules(project){
  let next=0;const nodes=[],edges=[];
  function expand(graph){
    const names=new Map(graph.nodes.map(n=>[n.id,'flat_'+(++next)]));
    for(const n of graph.nodes){
      if(n.type==='subvi'){
        const child=expand(n.graph),entry=n.graph.nodes.find(x=>x.type==='subInput'),exit=n.graph.nodes.find(x=>x.type==='subOutput');
        nodes.push({...n,id:names.get(n.id),type:'subOutput',params:{kind:n.params.outputType}});
        edges.push({from:child.get(exit.id),to:names.get(n.id),input:'in'});
        for(const e of graph.edges.filter(e=>e.to===n.id))edges.push({from:names.get(e.from),to:child.get(entry.id),input:'in'});
      }else nodes.push({...n,id:names.get(n.id),type:n.type==='subInput'?'subOutput':n.type});
    }
    for(const e of graph.edges)if(graph.nodes.find(n=>n.id===e.to).type!=='subvi')edges.push({...e,from:names.get(e.from),to:names.get(e.to)});
    return names;
  }
  expand(project);return {...project,nodes,edges,panel:undefined};
}
export function parseProject(text) {
  if(text.length>1e6) throw Error('El proyecto supera 1 MB.');
  const p=JSON.parse(text);
  // Missing wires are allowed while editing; structural/parameter errors are not.
  const errors=validate(p).filter(e=>!e.includes('falta conectar')&&!e.startsWith('Realimentación sin memoria'));
  if(errors.length) throw Error(errors.join('\n'));
  if(typeof p.name!=='string'||p.name.length>100) throw Error('Nombre de proyecto inválido.');
  return p;
}
export function csv(rows) {
  const cell=v=>{let s=String(v);if(/^[=+@\-\t\r]/.test(s) && typeof v!=='number')s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  return '\uFEFF'+[['tiempo_s','nodo','nombre','valor','unidad'],...rows].map(r=>r.map(cell).join(',')).join('\r\n');
}
