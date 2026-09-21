// SPDX-License-Identifier: MIT
import {checkWaveform,bytes} from './data.mjs';

export function waveformStats(value,mode){
  const {samples}=checkWaveform(value);if(!samples.length)throw Error('Waveform Stats: lote vacío.');
  // Welford variance avoids subtracting two large, nearly equal sums of squares.
  let mean=0,m2=0,min=Infinity,max=-Infinity,count=0;
  for(const x of samples){count++;const delta=x-mean;mean+=delta/count;m2+=delta*(x-mean);min=Math.min(min,x);max=Math.max(max,x);}
  const variance=Math.max(0,m2/count);
  const result={mean,rms:Math.hypot(mean,Math.sqrt(variance)),acRms:Math.sqrt(variance),stddev:Math.sqrt(variance),min,max,peakToPeak:max-min};
  if(!Object.hasOwn(result,mode)||!Number.isFinite(result[mode]))throw Error('Waveform Stats: resultado inválido.');
  return result[mode];
}

export function fft(value,{window='hann',removeMean='yes',scale='amplitude',reference=1}={}){
  const {samples,dt,t0}=checkWaveform(value),n=samples.length;
  if(n<16||n>4096||(n&(n-1)))throw Error('FFT: requiere 16–4096 muestras y longitud potencia de dos; no se recorta el lote.');
  if(!['hann','rectangular'].includes(window)||!['yes','no'].includes(removeMean)||!['amplitude','dB'].includes(scale)||!Number.isFinite(reference)||reference<=0)throw Error('FFT: configuración inválida.');
  const real=new Float64Array(n),imag=new Float64Array(n);
  const mean=removeMean==='yes'?waveformStats(value,'mean'):0;let coherentSum=0;
  for(let i=0;i<n;i++){const weight=window==='hann'?.5-.5*Math.cos(2*Math.PI*i/n):1;coherentSum+=weight;real[i]=(samples[i]-mean)*weight;}
  for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[real[i],real[j]]=[real[j],real[i]];}}
  for(let length=2;length<=n;length*=2){
    const angle=-2*Math.PI/length,stepR=Math.cos(angle),stepI=Math.sin(angle);
    for(let base=0;base<n;base+=length){let wr=1,wi=0;
      for(let j=0;j<length/2;j++){
        const a=base+j,b=a+length/2,tr=real[b]*wr-imag[b]*wi,ti=real[b]*wi+imag[b]*wr;
        real[b]=real[a]-tr;imag[b]=imag[a]-ti;real[a]+=tr;imag[a]+=ti;
        const next=wr*stepR-wi*stepI;wi=wr*stepI+wi*stepR;wr=next;
      }
    }
  }
  const magnitudes=Array.from({length:n/2+1},(_,k)=>{
    const amplitude=Math.hypot(real[k],imag[k])/coherentSum*(k===0||k===n/2?1:2);
    return scale==='dB'?20*Math.log10(Math.max(amplitude/reference,1e-12)):amplitude;
  });
  if(magnitudes.some(x=>!Number.isFinite(x)))throw Error('FFT: amplitud no finita. Reduce la escala de entrada.');
  const df=1/(n*dt);if(!Number.isFinite(df)||df<=0)throw Error('FFT: resolución de frecuencia inválida.');
  return {kind:'spectrum',magnitudes,df,f0:0,sourceDt:dt,sourceT0:t0,n,window,removeMean,scale,reference,unit:scale==='dB'?'dB re '+reference:(value.unit||'amplitud pico'),simulated:Boolean(value.simulated)};
}

export function unpackInt16(value,offset=0,endian='big',signed='yes'){
  const data=bytes(value);
  if(!Number.isInteger(offset)||offset<0||offset+1>=data.length)throw Error('Unpack Int16: faltan dos bytes desde el offset.');
  if(!['big','little'].includes(endian)||!['yes','no'].includes(signed))throw Error('Unpack Int16: formato inválido.');
  const hi=data[offset+(endian==='big'?0:1)],lo=data[offset+(endian==='big'?1:0)];
  const word=hi*256+lo;return signed==='yes'&&word>=32768?word-65536:word;
}

export function bitwise(a,b,op){
  if(![a,b].every(v=>Number.isInteger(v)&&v>=-2147483648&&v<=2147483647))throw Error('Bitwise Ops: entradas I32 requeridas.');
  if(['shl','shr','ushr'].includes(op)&&(b<0||b>31))throw Error('Bitwise Ops: desplazamiento entre 0 y 31.');
  switch(op){case 'and':return a&b;case 'or':return a|b;case 'xor':return a^b;case 'not':return ~a;case 'shl':return a<<b;case 'shr':return a>>b;case 'ushr':return (a>>>b)|0;default:throw Error('Operación binaria inválida.');}
}

export function meterReading(value,{digits=4,unit='V',range=1000,prefix='auto'}={}){
  if(!Number.isFinite(value))return {text:'—',unit,over:false};
  if(Math.abs(value)>range)return {text:'OL',unit,over:true};
  if(value===0)return {text:(0).toFixed(digits),unit,over:false};
  const exponents=[-9,-6,-3,0,3,6,9],labels=['n','µ','m','','k','M','G'];
  const index=prefix==='auto'?Math.max(0,Math.min(6,Math.floor(Math.log10(Math.abs(value))/3)+3)):3;
  const scaled=value/10**exponents[index];return {text:Math.abs(scaled)>=1e6?scaled.toExponential(digits):scaled.toFixed(digits),unit:labels[index]+unit,over:false};
}
