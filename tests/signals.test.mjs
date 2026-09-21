import test from 'node:test';
import assert from 'node:assert/strict';
import {fft,waveformStats,unpackInt16,bitwise,meterReading} from '../web/signals.mjs';
import {waveform} from '../web/data.mjs';
import {BOARDS,createNode,example,validate,hardwareErrors,Runtime,parseProject} from '../web/core.mjs';
import {encodeCommand} from '../web/serial-protocol.mjs';
import {WebSerialTransport} from '../web/transports.mjs';
import {generateArduino} from '../web/codegen.mjs';
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);

test('FFT agrees with independent direct DFT, including DC and Nyquist',()=>{
  const x=Array.from({length:32},(_,i)=>Math.sin(i*.719)+i%5-2),s=fft(waveform(x,.001,-.01),{window:'rectangular',removeMean:'no'});
  for(let k=0;k<=16;k++){let re=0,im=0;for(let i=0;i<32;i++){re+=x[i]*Math.cos(2*Math.PI*k*i/32);im-=x[i]*Math.sin(2*Math.PI*k*i/32);}close(s.magnitudes[k],Math.hypot(re,im)/32*(k===0||k===16?1:2));}
  assert.equal(s.df,31.25);assert.equal(s.sourceT0,-.01);assert.equal(s.magnitudes.length,17);
});
test('FFT calibrated sine amplitude, Hann coherent gain, DC removal and dB reference',()=>{
  for(const window of ['rectangular','hann']){
    const w=waveform(Array.from({length:1024},(_,i)=>7+3*Math.sin(2*Math.PI*64*i/1024)),1/8192);
    const s=fft(w,{window});close(s.magnitudes[64],3);close(s.magnitudes[0],0);assert.equal(s.df*64,512);
    close(fft(w,{window,scale:'dB',reference:3}).magnitudes[64],0);
  }
  close(fft(waveform(new Array(16).fill(4),1),{window:'rectangular',removeMean:'no'}).magnitudes[0],4);
  close(fft(waveform(Array.from({length:16},(_,i)=>i%2?-2:2),1),{window:'rectangular'}).magnitudes[8],2);
  assert.equal(fft(waveform(new Array(16).fill(0),1),{scale:'dB'}).magnitudes[0],-240);
});
test('FFT rejects unsuitable lengths and nonfinite frequency resolution',()=>{
  for(const n of [0,8,17,1000])assert.throws(()=>fft(waveform(new Array(n).fill(1),.01)));
  assert.throws(()=>fft(waveform(new Array(16).fill(1),Number.MIN_VALUE)));
  assert.throws(()=>fft(waveform(new Array(16).fill(1),1),{reference:0}));
});
test('Waveform Stats uses population variance and distinguishes AC from total RMS',()=>{
  const w=waveform([1,2,3,4],.0001);
  for(const [mode,value] of Object.entries({mean:2.5,min:1,max:4,peakToPeak:3,rms:Math.sqrt(7.5),acRms:Math.sqrt(1.25),stddev:Math.sqrt(1.25)}))close(waveformStats(w,mode),value);
  close(waveformStats(waveform([1e12-1,1e12,1e12+1],1),'stddev'),Math.sqrt(2/3));
  assert.throws(()=>waveformStats(waveform([],1),'mean'));
});
test('Unpack Int16 checks both byte orders, signed boundaries, offsets and malformed frames',()=>{
  assert.equal(unpackInt16([255,156]),-100);assert.equal(unpackInt16([0,156,255],1,'little'),-100);
  assert.equal(unpackInt16([128,0]),-32768);assert.equal(unpackInt16([127,255]),32767);
  assert.equal(unpackInt16([255,255],0,'big','no'),65535);
  for(const bad of [[1],[256,0],[-1,0],[.5,0]])assert.throws(()=>unpackInt16(bad));
  assert.throws(()=>unpackInt16([0,0],1));
});
test('Bitwise Ops defines signed I32 shifts and masks without silent shift wrapping',()=>{
  assert.equal(bitwise(-100,255,'and'),156);assert.equal(bitwise(1,2,'or'),3);assert.equal(bitwise(3,2,'xor'),1);
  assert.equal(bitwise(0,0,'not'),-1);assert.equal(bitwise(1,31,'shl'),-2147483648);assert.equal(bitwise(-8,2,'shr'),-2);
  for(const b of [-1,32])assert.throws(()=>bitwise(1,b,'shl'));assert.throws(()=>bitwise(2147483648,1,'and'));
});
test('multimeter formatting preserves sign, uses SI prefixes and marks overrange',()=>{
  assert.deepEqual(meterReading(-.0025,{digits:3}),{text:'-2.500',unit:'mV',over:false});
  assert.equal(meterReading(1001).text,'OL');assert.equal(meterReading(-1001).over,true);
  assert.equal(meterReading(1000,{prefix:'fixed',digits:0}).text,'1000');assert.equal(meterReading(0).text,'0.0000');assert.equal(meterReading(undefined).text,'—');
});
test('0.3 examples roundtrip and execute on all profiles with valid pin allocation',async()=>{
  for(const board of Object.keys(BOARDS))for(const kind of ['spectrum','sensor16','xy','peripherals']){
    const p=example(kind,board);assert.deepEqual(validate(p),[],kind+board);assert.deepEqual(hardwareErrors(p),[],kind+board);assert.deepEqual(parseProject(JSON.stringify(p)),p);
    const r=new Runtime(p),values=await r.tick(.5,.05);
    if(kind==='sensor16'){assert.equal(values.get('meter'),-1);assert.equal(values.get('bits'),156);}
    if(kind==='spectrum'){assert.equal(values.get('spectrum').length,513);assert.equal(r.state.get('spectrum').df,20000/1024);}
    if(kind==='xy'){assert.ok(generateArduino(p).includes('// xyChart'));}
    if(kind==='peripherals')assert.throws(()=>generateArduino(p),/motor conectado/);
  }
});
test('XY stores paired coordinates in arrival order, bounded across many ticks',async()=>{
  const p=example('xy');p.nodes.find(n=>n.id==='curve').params.points=16;const r=new Runtime(p);
  for(let i=0;i<100;i++)await r.tick(i/10,.1);
  const points=r.state.get('curve');assert.equal(points.length,16);close(points.at(-1).t,r.values.get('x'));close(points.at(-1).v,r.values.get('y'));
  assert.notEqual(points.at(-1).t,9.9);
});
test('native peripherals enforce board capabilities and protocol 3 in WebSerial',async()=>{
  assert.equal(encodeCommand('dac',{pin:25,value:255},BOARDS.esp32),'dac 25 255');
  assert.equal(encodeCommand('touch',{pin:4},BOARDS.esp32s3),'touch 4');
  assert.equal(encodeCommand('pcnt',{pin:4,gateMs:100,filterNs:1000},BOARDS.esp32c6),'pcnt 4 100 1000');
  assert.equal(encodeCommand('tone',{pin:4,frequency:0},BOARDS.esp32c3),'tone 4 0');
  for(const board of ['esp32c3','esp32c6','esp32s3'])assert.throws(()=>encodeCommand('dac',{pin:4,value:10},BOARDS[board]));
  assert.throws(()=>encodeCommand('pcnt',{pin:4,gateMs:100,filterNs:0},BOARDS.esp32c3));
  assert.throws(()=>encodeCommand('tone',{pin:4,frequency:19},BOARDS.esp32));
  const transport=new WebSerialTransport();transport.closed=false;transport.info={protocol:2};await assert.rejects(()=>transport.command('dac',{pin:25,value:0}),/protocolo 3/);
});
test('hardware runtime sends native requests and converts measured Hz to RPM',async()=>{
  const p=example('peripherals');p.nodes.find(n=>n.id==='tach').params.ppr=2;const commands=[];
  const r=new Runtime(p,async(command,args)=>{commands.push([command,args]);return command==='pcnt'?10:command==='touch'?100:args.value??args.frequency;});
  const values=await r.tick(0,.1);assert.equal(values.get('tach'),300);assert.equal(values.get('touch'),100);assert.deepEqual(commands.map(c=>c[0]).sort(),['dac','pcnt','tone','touch']);
  const tone=p.nodes.find(n=>n.type==='tone');const pwm=createNode('pwm','pwm');p.nodes.push(pwm);assert.ok(hardwareErrors(p).some(e=>e.includes('LEDC')));tone.params.pin=25;assert.ok(hardwareErrors(p).some(e=>e.includes('más de un nodo')));
});
