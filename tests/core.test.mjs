import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TYPES,DATA_TYPES,compatible,BOARDS,createNode,validate,hardwareErrors,Runtime,example,parseProject,csv} from '../web/core.mjs';
import {generateArduino} from '../web/codegen.mjs';

function fixture(type,inputs={},params={}) {
  const p=example('empty'),n=createNode(type,'target');Object.assign(n.params,params);p.nodes.push(n);
  for(const [key,value] of Object.entries(inputs)) {
    const source=createNode(typeof value==='string'?'text':typeof value==='boolean'?'toggle':'constant','src_'+key);
    source.params.value=typeof value==='boolean'?(value?'1':'0'):value;p.nodes.push(source);p.edges.push({from:source.id,to:n.id,input:key});
  }
  return p;
}
async function result(type,inputs={},params={}){return (await new Runtime(fixture(type,inputs,params)).tick(0,.1)).get('target');}

test('all bundled projects execute for every board, with valid hardware pin profiles',async()=>{
  for(const board of Object.keys(BOARDS))for(const kind of ['signal','adc','pwm','feedback','types','processing']) {
    const p=example(kind,board);assert.deepEqual(validate(p),[]);assert.deepEqual(hardwareErrors(p),[]);
    const runtime=new Runtime(p);for(let i=0;i<15;i++)await runtime.tick(i*.05,.05);
    assert.equal(runtime.samples,15);assert.ok(generateArduino(p).includes('void loop()'));
  }
});
test('every original scalar node evaluates and has an explicit export implementation',async()=>{
  for(const [type,def] of Object.entries(TYPES).filter(([type])=>!['fft','waveformStats','unpackInt16','bitwise','dac','pcnt','touch','tone','xyChart','multimeter','vector','makeWaveform','waveformSamples','waveformScale','vectorStat','vectorAt','waveformChart','adcBurst','i2cTransfer','subvi','subInput','subOutput'].includes(type))) {
    const inputs=Object.fromEntries(def.inputs.map(p=>[p.name,p.type==='string'?'texto':p.type==='boolean'?true:2]));
    const p=fixture(type,inputs),out=await new Runtime(p).tick(.25,.05);
    assert.equal(typeof out.get('target'),def.output==='integer'?'number':def.output,type);assert.ok(generateArduino(p).includes('// '+type),type);
  }
});
test('arithmetic, scaling, clamp and logic are numerically correct',async()=>{
  assert.equal(await result('add',{a:2,b:3}),5);assert.equal(await result('subtract',{a:2,b:3}),-1);
  assert.equal(await result('multiply',{a:2,b:3}),6);assert.equal(await result('divide',{a:9,b:3}),3);
  assert.equal(await result('map',{in:4095}),3.3);assert.equal(await result('clamp',{in:300}),1);
  assert.equal(await result('compare',{a:3,b:2}),true);assert.equal(await result('and',{a:true,b:false}),false);
  assert.equal(await result('not',{in:true}),false);assert.equal(await result('select',{if:false,yes:10,no:20}),20);
});
test('division by zero and overflowing arithmetic stop with errors',async()=>{
  await assert.rejects(()=>result('divide',{a:1,b:0}),/cero/);
  const p=fixture('map',{in:2},{inMin:0,inMax:Number.MIN_VALUE,outMin:0,outMax:1e9});
  await assert.rejects(()=>new Runtime(p).tick(0,.1),/inválido/);
});
test('low pass uses elapsed time and starts from the first sample',async()=>{
  const p=fixture('filter',{in:0},{tau:1}),r=new Runtime(p);assert.equal((await r.tick(0,.1)).get('target'),0);
  p.nodes.find(n=>n.id==='src_in').params.value=10;
  assert.ok(Math.abs((await r.tick(1,1)).get('target')-10*(1-Math.exp(-1)))<1e-12);
});
test('PID anti-windup avoids accumulating integral during saturation',async()=>{
  const p=fixture('pid',{set:100,pv:0},{kp:0,ki:1,kd:0,min:0,max:10}),r=new Runtime(p);
  for(let i=0;i<100;i++)assert.equal((await r.tick(i,1)).get('target'),10);
  assert.equal(r.state.get('target').integral,0);
  p.nodes.find(n=>n.id==='src_set').params.value=1;assert.equal((await r.tick(100,1)).get('target'),1);
});
test('feedback advances one cycle independent of node order',async()=>{
  const p=example('feedback');p.nodes.reverse();const r=new Runtime(p);
  for(let i=1;i<=20;i++)assert.equal((await r.tick(i*.1,.1)).get('sum'),i);
});
test('delay nodes update simultaneously',async()=>{
  const p=example('empty');p.nodes=[createNode('delay','a'),createNode('delay','b')];p.nodes[0].params.initial=1;p.nodes[1].params.initial=2;
  p.edges=[{from:'a',to:'b',input:'in'},{from:'b',to:'a',input:'in'}];const r=new Runtime(p);
  assert.deepEqual(Object.fromEntries(await r.tick(0,.1)),{a:1,b:2});assert.deepEqual(Object.fromEntries(await r.tick(.1,.1)),{a:2,b:1});
});
test('missing wires, repeated wires, type mismatch, cycles and unknown nodes are rejected',()=>{
  assert.ok(validate(fixture('add',{a:1})).some(e=>e.includes('falta conectar b')));
  const p=fixture('add',{a:1,b:2});p.edges.push({...p.edges[0]});assert.ok(validate(p).some(e=>e.includes('más de una')));
  assert.ok(validate(fixture('add',{a:true,b:2})).some(e=>e.includes('incompatible')));
  const cycle=fixture('add',{a:1,b:2});cycle.edges[0].from='target';assert.ok(validate(cycle).some(e=>e.includes('Realimentación')));
  for(const type of ['unknown','constructor','__proto__']){const bad=example();bad.nodes[0].type=type;assert.ok(validate(bad).length);}
});
test('parameters and schema enforce finite numbers, intervals and legal ranges',()=>{
  const p=example();p.interval=0;assert.ok(validate(p).length);p.interval=50;p.nodes[0].params.frequency=NaN;assert.ok(validate(p).length);
  for(const value of [null,{},[],{version:2,nodes:[],edges:[]}])assert.ok(validate(value).length);
  assert.ok(validate(fixture('map',{in:0},{inMin:1,inMax:1})).some(e=>e.includes('vacío')));
  assert.ok(validate(fixture('slider',{}, {min:0,max:1,value:5})).some(e=>e.includes('límites')));
  const missing=example();missing.nodes[0].params=null;assert.ok(validate(missing).length);
});
test('invalid time and cancelled runtime never perform hardware writes',async()=>{
  let calls=0;const p=example('pwm'),r=new Runtime(p,async()=>calls++);r.cancelled=true;
  await assert.rejects(()=>r.tick(0,.1),/cancelada/);assert.equal(calls,0);
  await assert.rejects(()=>new Runtime(p).tick(0,0),/Tiempo/);
});
test('hardware dispatch preserves typed arguments and constrains output duty',async()=>{
  const calls=[];const p=fixture('pwm',{in:300}),r=new Runtime(p,async(command,args)=>calls.push({command,args}));
  assert.equal((await r.tick(0,.1)).get('target'),255);assert.deepEqual(calls,[{command:'pwm',args:{pin:26,value:255,frequency:1000}}]);
  await assert.rejects(()=>new Runtime(fixture('adc'),async()=>{throw Error('Disconnected');}).tick(0,.1),/Disconnected/);
  await assert.rejects(()=>new Runtime(fixture('adc'),async()=>true).tick(0,.1),/tipo inválido/);
});
test('hardware rejects input-only output, reserved pins, conflicts and I2C overlap',()=>{
  assert.ok(hardwareErrors(fixture('pwm',{in:0},{pin:34})).length);
  assert.ok(hardwareErrors(fixture('adc',{}, {pin:6})).length);
  const p=example('pwm');const n=createNode('digitalRead','duplicate');n.params.pin=25;p.nodes.push(n);assert.ok(hardwareErrors(p).some(e=>e.includes('más de un')));
  const q=fixture('i2cRead');q.nodes.push(createNode('pwm','pwm'));q.nodes.at(-1).params.pin=21;assert.ok(hardwareErrors(q).some(e=>e.includes('comparte')));
});
test('JSON roundtrip preserves projects; malformed imports are rejected',()=>{
  const p=example();assert.deepEqual(parseProject(JSON.stringify(p)),p);
  assert.throws(()=>parseProject('{'));assert.throws(()=>parseProject('x'.repeat(1000001)),/1 MB/);
  const p2=example();p2.nodes[0].id='x"><script>';assert.throws(()=>parseProject(JSON.stringify(p2)));
  assert.doesNotThrow(()=>parseProject(JSON.stringify(fixture('add'))));
});
test('CSV preserves multiline/quotes and neutralizes spreadsheet formula text',()=>{
  const text=csv([[1,'n1','=HYPERLINK("url")',-2,'V\nAC']]);
  assert.ok(text.startsWith('\uFEFF'));assert.ok(text.includes('"\'=HYPERLINK(""url"")"'));assert.ok(text.includes('"-2"'));assert.ok(text.includes('"V\nAC"'));
});
test('export is deterministic, avoids label injection and rejects invalid projects',()=>{
  const p=example();p.nodes[0].label='"; system("bad"); //';
  const a=generateArduino(p);assert.equal(a,generateArduino(p));assert.ok(!a.includes('system('));
  assert.ok(a.includes('isfinite'));assert.ok(a.includes('while(true)delay(1000)'));
  assert.throws(()=>generateArduino(fixture('add')),/falta conectar/);
  assert.throws(()=>generateArduino(fixture('pwm',{in:0},{pin:34})),/entrada/);
});
test('board profiles are synchronized between frontend, backend and firmware',()=>{
  const boards=JSON.parse(readFileSync(new URL('../boards.json',import.meta.url),'utf8'));
  assert.deepEqual(boards,JSON.parse(JSON.stringify(BOARDS)));
  const header=readFileSync(new URL('../firmware/FlowLabBridge/profiles.h',import.meta.url),'utf8');
  for(const [key,b] of Object.entries(BOARDS)){assert.ok(header.includes(`FL_FAMILY="${key}"`));assert.ok(header.includes(`FL_GPIO[]={${b.gpio.join(',')}}`));}
});
test('six data types have distinct colors and only integer-to-decimal implicit conversion',()=>{
  assert.equal(new Set(Object.values(DATA_TYPES).map(t=>t.color)).size,6);
  assert.equal(compatible('integer','number'),true);assert.equal(compatible('number','integer'),false);
  assert.equal(compatible('string','number'),false);assert.equal(compatible('number','boolean'),false);
  const p=fixture('gauge',{in:42});p.nodes[1].type='integer';assert.deepEqual(validate(p),[]);
});
test('text control, concatenation, indicators and explicit conversion execute',async()=>{
  assert.equal(await result('concat',{a:'ESP',b:'32'}),'ESP32');assert.equal(await result('textIndicator',{in:'<b>literal</b>'}),'<b>literal</b>');
  assert.equal(await result('toText',{in:1.25}),'1.250000');assert.equal(await result('toInteger',{in:-2.9}),-2);
  assert.equal(await result('integer',{}, {value:-2147483648}),-2147483648);
  assert.ok(validate(fixture('integer',{}, {value:1.5})).length);
  const p=fixture('text',{}, {value:'"\\\nñ'});const source=generateArduino(p);assert.ok(source.includes('\\x22\\x5c\\x0a\\xc3\\xb1'));
  assert.ok(validate(fixture('text',{}, {value:'a\0b'})).length);
});
test('panel position and size roundtrip and invalid layouts are rejected',()=>{
  const p=example();p.panel={scope:{x:20,y:30,w:500,h:260}};
  assert.deepEqual(parseProject(JSON.stringify(p)).panel,p.panel);
  p.panel.scope.w=-1;assert.ok(validate(p).some(e=>e.includes('instrumento')));
  p.panel=null;assert.ok(validate(p).some(e=>e.includes('panel frontal')));
});
test('extended math implements correct numeric values and rejects domain errors',async()=>{
  assert.equal(await result('abs',{in:-4}),4);assert.equal(await result('power',{base:2,exponent:5}),32);
  assert.equal(await result('sqrt',{in:81}),9);assert.equal(await result('modulo',{a:-7,b:3}),-1);
  assert.equal(await result('round',{in:-1.5}),-1);assert.equal(await result('minmax',{a:2,b:8},{mode:'max'}),8);
  assert.ok(Math.abs(await result('trig',{in:90},{fn:'sin',unit:'degrees'})-1)<1e-10);
  assert.ok(Math.abs(await result('trig',{in:1},{fn:'asin',unit:'degrees'})-90)<1e-10);
  assert.equal(await result('logarithm',{in:100},{base:'10'}),2);assert.equal(await result('exponential',{in:0}),1);
  await assert.rejects(()=>result('sqrt',{in:-1}),/negativo/);await assert.rejects(()=>result('logarithm',{in:0}),/positiva/);
  await assert.rejects(()=>result('modulo',{a:1,b:0}),/cero/);await assert.rejects(()=>result('trig',{in:2},{fn:'acos'}),/inválido/);
});
test('moving average and RMS windows discard oldest values',async()=>{
  for(const type of ['movingAverage','rms']) {
    const p=fixture(type,{in:3},{window:2}),r=new Runtime(p),input=p.nodes.find(n=>n.id==='src_in');
    assert.equal((await r.tick(0,.1)).get('target'),3);input.params.value=4;
    assert.equal((await r.tick(.1,.1)).get('target'),type==='rms'?Math.sqrt(12.5):3.5);
    input.params.value=0;assert.equal((await r.tick(.2,.1)).get('target'),type==='rms'?Math.sqrt(8):2);
  }
});
test('integration saturation and derivative use dt',async()=>{
  const p=fixture('integrator',{in:2},{initial:1,min:0,max:2}),r=new Runtime(p);
  assert.equal((await r.tick(0,.25)).get('target'),1.5);assert.equal((await r.tick(.25,1)).get('target'),2);
  const q=fixture('derivative',{in:2}),d=new Runtime(q);assert.equal((await d.tick(0,.1)).get('target'),0);
  q.nodes[1].params.value=3;assert.equal((await d.tick(.5,.5)).get('target'),2);
});
test('hysteresis, edge counting and timers have stable state transitions',async()=>{
  const p=fixture('hysteresis',{in:1.5}),r=new Runtime(p),s=p.nodes[1];
  assert.equal((await r.tick(0,.1)).get('target'),false);s.params.value=2;
  assert.equal((await r.tick(.1,.1)).get('target'),true);s.params.value=1.5;
  assert.equal((await r.tick(.2,.1)).get('target'),true);s.params.value=1;
  assert.equal((await r.tick(.3,.1)).get('target'),false);
  const c=fixture('counter',{in:true,reset:false}),cr=new Runtime(c);
  assert.equal((await cr.tick(0,.1)).get('target'),1);assert.equal((await cr.tick(.1,.1)).get('target'),1);
  c.nodes.find(n=>n.id==='src_in').params.value='0';await cr.tick(.2,.1);c.nodes.find(n=>n.id==='src_in').params.value='1';
  assert.equal((await cr.tick(.3,.1)).get('target'),2);c.nodes.find(n=>n.id==='src_reset').params.value='1';assert.equal((await cr.tick(.4,.1)).get('target'),0);
  const t=fixture('onDelay',{in:true},{duration:.5}),tr=new Runtime(t);
  assert.equal((await tr.tick(0,.25)).get('target'),false);assert.equal((await tr.tick(.25,.25)).get('target'),true);
  t.nodes[1].params.value='0';assert.equal((await tr.tick(.5,.25)).get('target'),false);
});
test('population statistics and seeded noise match expected behavior',async()=>{
  for(const [mode,expected] of [['mean',2.5],['min',1],['max',4],['stddev',Math.sqrt(1.25)]]) {
    const p=fixture('runningStat',{in:1},{mode}),r=new Runtime(p);let out;
    for(const v of [1,2,3,4]){p.nodes[1].params.value=v;out=(await r.tick(v,.1)).get('target');}assert.equal(out,expected);
  }
  const a=new Runtime(fixture('random')),b=new Runtime(fixture('random'));
  for(let i=0;i<20;i++){const av=(await a.tick(i,.1)).get('target'),bv=(await b.tick(i,.1)).get('target');assert.equal(av,bv);assert.ok(av>=-1&&av<1);}
});
test('logic conversion, UTF8 length and text export handle actual types',async()=>{
  assert.equal(await result('or',{a:false,b:true}),true);assert.equal(await result('xor',{a:true,b:true}),false);
  assert.equal(await result('boolToNumber',{in:true}),1);assert.equal(await result('length',{in:'ñ🙂'}),6);
  const p=example('types'),source=generateArduino(p);assert.match(source,/String\(\(double\)v\d+,6\)/);
  assert.equal(Object.keys(TYPES).length,80);
});
test('Arduino export promotes integer inputs before arithmetic to avoid truncation and overflow',async()=>{
  const p=fixture('divide',{a:7,b:2});p.nodes[1].type='integer';p.nodes[2].type='integer';
  assert.equal((await new Runtime(p).tick(0,.1)).get('target'),3.5);
  assert.match(generateArduino(p),/double v0 = \(double\)v1\/\(double\)v2/);
});
