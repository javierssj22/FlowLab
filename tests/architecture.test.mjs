import test from 'node:test';
import assert from 'node:assert/strict';
import {example,createNode,validate,Runtime,BOARDS,hardwareErrors,flattenModules,parseProject} from '../web/core.mjs';
import {vector,waveform,checkWaveform,bytes} from '../web/data.mjs';
import {generateArduino} from '../web/codegen.mjs';
import {encodeCommand,LineDecoder} from '../web/serial-protocol.mjs';
import {ProjectFileStore} from '../web/project-store.mjs';
import {WebSocketTransport,WebSerialTransport} from '../web/transports.mjs';

test('new examples validate and simulate on each board; burst time is independent of UI dt',async()=>{
  for(const board of Object.keys(BOARDS))for(const kind of ['burst','module','i2cframe']){
    const p=example(kind,board);assert.deepEqual(validate(p),[]);assert.deepEqual(hardwareErrors(p),[]);
    assert.deepEqual(parseProject(JSON.stringify(p)),p);
    const r=new Runtime(p),a=await r.tick(0,.05),b=await r.tick(.5,.5);
    if(kind==='burst'){assert.equal(a.get('burst').dt,1/20000);assert.equal(b.get('burst').samples.length,1024);assert.equal(b.get('burst').seq,2);}
    if(kind==='module'){assert.equal(a.get('module'),.1);assert.equal(b.get('module'),1.1);}
  }
});
test('batch contracts reject nonfinite samples, excessive sizes and invalid clocks',()=>{
  for(const bad of [[NaN],[Infinity],new Array(4097).fill(0),'1',null])assert.throws(()=>vector(bad));
  for(const dt of [0,-1,Infinity,NaN])assert.throws(()=>waveform([1],dt));
  assert.throws(()=>checkWaveform({kind:'waveform',samples:[1],dt:.01,t0:Infinity}));
  for(const bad of [[256],[-1],[1.5],new Array(33).fill(0)])assert.throws(()=>bytes(bad));
  const original=[1,2];const w=waveform(original,.001,-.002,{seq:3});original[0]=99;assert.equal(w.samples[0],1);
});
test('waveform pipeline preserves time and metadata and calculates batch statistics',async()=>{
  const p=example('empty');p.nodes=['vector','makeWaveform','waveformScale','waveformSamples','vectorStat','vectorAt'].map((t,i)=>createNode(t,'n'+i));
  p.nodes[0].params.values='[3,4]';p.nodes[1].params.dt=.00005;p.nodes[1].params.t0=-.01;p.nodes[2].params.gain=2;p.nodes[4].params.mode='rms';p.nodes[5].params.index=1;
  p.edges=[0,1,2,3].map(i=>({from:'n'+i,to:'n'+(i+1),input:'in'}));p.edges.push({from:'n3',to:'n5',input:'in'});
  const result=await new Runtime(p).tick(0,1);assert.equal(result.get('n5'),8);assert.equal(result.get('n4'),Math.sqrt(50));assert.equal(result.get('n2').dt,.00005);assert.equal(result.get('n2').t0,-.01);
  p.nodes[5].params.index=2;await assert.rejects(()=>new Runtime(p).tick(0,1),/Índice/);
});
test('subVI instances own independent state and export with distinct variables',async()=>{
  const p=example('module'),second=structuredClone(p.nodes.find(n=>n.type==='subvi'));second.id='other';p.nodes.push(second);
  const c=createNode('constant','constant');c.params.value=5;p.nodes.push(c);p.edges.push({from:c.id,to:second.id,input:'in'});
  const runtime=new Runtime(p);await runtime.tick(0,1);const results=await runtime.tick(1,1);assert.equal(results.get('module'),4);assert.equal(results.get('other'),10);
  const flat=flattenModules(p);assert.deepEqual(validate(flat),[]);assert.equal(new Set(flat.nodes.map(n=>n.id)).size,flat.nodes.length);
  const expanded=await new Runtime(flat).tick(0,1);assert.ok([...expanded.values()].includes(5));assert.match(generateArduino(p),/void loop/);
  runtime.cancelled=true;assert.ok([...runtime.children.values()].every(c=>c.cancelled));
});
test('subVI signatures, recursion depth and hardware conflicts are validated across module boundaries',()=>{
  const p=example('module'),mod=p.nodes.find(n=>n.type==='subvi');mod.params.inputType='vector';assert.ok(validate(p).some(e=>e.includes('tipos coincidentes')));
  mod.params.inputType='number';mod.graph.nodes.find(n=>n.type==='integrator').type='pwm';mod.graph.nodes.find(n=>n.type==='pwm').params={pin:25,value:0,frequency:1000};
  const other=createNode('digitalRead','read');other.params.pin=25;p.nodes.push(other);assert.ok(hardwareErrors(p).some(e=>e.includes('más de un nodo')));
  let graph=example('module');for(let i=0;i<10;i++){const wrapper=example('module');wrapper.nodes.find(n=>n.type==='subvi').graph=graph;graph=wrapper;}assert.ok(validate(graph).length);
});
test('burst forbids output mixing, validates pretrigger and unsupported exports fail explicitly',()=>{
  const p=example('burst');p.nodes.push(createNode('pwm','pwm'));assert.ok(hardwareErrors(p).length);p.nodes.pop();
  p.nodes[0].params.pre=1;assert.ok(validate(p).length);p.nodes[0].params.trigger='rising';assert.deepEqual(validate(p),[]);
  assert.throws(()=>generateArduino(p),/motor conectado/);
});
test('hardware batch calls preserve full I2C transactions and reject short reads',async()=>{
  const p=example('i2cframe'),calls=[];const r=new Runtime(p,async(cmd,args)=>{calls.push([cmd,args]);return [1,2,3,4,5,6];});
  await r.tick(0,.1);assert.equal(calls[0][0],'i2cxfer');assert.deepEqual(calls[0][1].tx,[0]);assert.equal(calls[0][1].stop,false);
  await assert.rejects(()=>new Runtime(p,async()=>[1]).tick(0,.1),/incompleta/);
});
test('serial encoders are bounded and parser handles fragmented burst JSON and boot logs',()=>{
  const board=BOARDS.esp32;
  assert.equal(encodeCommand('i2cxfer',{address:72,tx:[1,255],readCount:6,stop:false},board),'i2cxfer 72 2 6 0 1 255');
  const p=example('burst').nodes[0].params;assert.equal(encodeCommand('burst',p,board),'burst 32 20000 1024 0 2048 0 2000');
  assert.throws(()=>encodeCommand('write',{pin:25,value:true},board));assert.throws(()=>encodeCommand('i2cxfer',{address:72,tx:[256],readCount:1,stop:false},board));
  const decoder=new LineDecoder(),line=JSON.stringify({id:1,ok:true,value:waveform(new Array(4096).fill(4095),.00005)})+'\n';
  let messages=[];for(let i=0;i<line.length;i+=13)messages.push(...decoder.push(line.slice(i,i+13)));assert.equal(messages[0].value.samples.length,4096);
  assert.deepEqual(decoder.push('boot!\n{bad}\n'),[]);assert.throws(()=>new LineDecoder(10).push('x'.repeat(11)));
});
function fileHandle(initial=''){
  const state={text:initial,abort:0,fail:false};return {state,async getFile(){return {text:async()=>state.text};},async createWritable(options){assert.equal(options.mode,'exclusive');let staged;return {async write(t){staged=t;if(state.fail)throw Error('disk full');},async close(){state.text=staged;},async abort(){state.abort++;}};}};
}
test('file persistence commits atomically, serializes saves and detects external edits',async()=>{
  const h=fileHandle(),store=new ProjectFileStore();await store.save('one','test.json',async()=>h);
  await Promise.all([store.save('two'),store.save('three')]);assert.equal(h.state.text,'three');
  h.state.text='external';await assert.rejects(()=>store.save('four'),/Conflicto/);assert.equal(h.state.text,'external');assert.equal(h.state.abort,1);
  store.detach();const opened=await store.open(async()=>[h]);assert.equal(store.handle,null);opened.accept();h.state.fail=true;await assert.rejects(()=>store.save('five'),/disk full/);assert.equal(h.state.text,'external');
});
class FakeSocket {
  constructor(){this.readyState=0;this.bufferedAmount=0;this.listeners=[];this.sent=[];queueMicrotask(()=>{this.readyState=1;this.onopen();});}
  send(raw){const m=JSON.parse(raw);this.sent.push(m);if(m.op==='auth'||m.op==='disconnect')queueMicrotask(()=>this.reply(m.id,{protocol:2}));}
  reply(id,value){this.onmessage({data:JSON.stringify({id,ok:true,value})});}
  addEventListener(type,cb){if(type==='close')this.listeners.push(cb);}
  close(){this.readyState=3;this.onclose();this.listeners.splice(0).forEach(cb=>cb());}
}
test('WebSocket correlates reordered responses and rejects pending commands on disconnect without retries',async()=>{
  const t=new WebSocketTransport('ws://test','token',FakeSocket);await t.open();
  const one=t.command('adc'),two=t.command('ping');t.socket.reply(3,22);t.socket.reply(2,11);assert.deepEqual(await Promise.all([one,two]),[11,22]);
  const pending=t.command('pwm');const rejection=assert.rejects(pending,/desconectado/);const sent=t.socket.sent.length;t.close();await rejection;assert.equal(t.socket.sent.length,sent);
});
test('WebSocket enforces backpressure and fails closed on timeout',async()=>{
  const t=new WebSocketTransport('ws://test','token',FakeSocket);await t.open();t.socket.bufferedAmount=300000;await assert.rejects(()=>t.command('ping'),/saturado/);t.socket.bufferedAmount=0;
  await assert.rejects(()=>t.request('command',{},5),/Timeout/);assert.ok(t.closed);
});
test('WebSerial uses same command framing and one in-flight operation',async()=>{
  const t=new WebSerialTransport({});t.closed=false;t.board='esp32';t.info={protocol:2};const writes=[];t.writer={write:async b=>writes.push(new TextDecoder().decode(b))};
  const response=t.command('i2cxfer',{address:72,tx:[0],readCount:2,stop:false});await assert.rejects(()=>t.command('ping'),/pendiente/);
  assert.equal(writes[0],'1 i2cxfer 72 1 2 0 0\n');const pending=t.pending;clearTimeout(pending.timer);pending.resolve([3,4]);t.pending=null;assert.deepEqual(await response,[3,4]);
  t.info.protocol=1;await assert.rejects(()=>t.command('burst',{}),/protocolo 2/);
});
