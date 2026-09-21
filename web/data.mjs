// FlowLab value contracts. Buffers never grow without an explicit upper bound.
export const MAX_SAMPLES=4096;
export function vector(value){
  if(!Array.isArray(value)||value.length>MAX_SAMPLES||value.some(x=>!Number.isFinite(x)))throw Error('Vector inválido: máximo 4096 números finitos.');
  return value.slice();
}
export function waveform(samples,dt,t0=0,metadata={}){
  if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(t0))throw Error('Waveform: dt debe ser positivo y t0 finito.');
  return {...metadata,kind:'waveform',samples:vector(samples),dt,t0};
}
export function checkWaveform(value){if(!value||value.kind!=='waveform')throw Error('Se esperaba Waveform.');return waveform(value.samples,value.dt,value.t0,value);}
export function bytes(value){const data=vector(value);if(data.length>32||data.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('I²C: máximo 32 bytes enteros entre 0 y 255.');return data;}
export function parseVector(text){return vector(JSON.parse(text));}
export function summarize(value){return Array.isArray(value)?`[${value.length}] ${value.slice(0,4).join(', ')}`:value?.kind==='waveform'?`${value.samples.length} muestras · ${(1/value.dt).toFixed(0)} Hz`:null;}
