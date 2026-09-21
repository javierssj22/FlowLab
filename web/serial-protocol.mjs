import {bytes} from './data.mjs';
export function integer(x,min,max,name){if(!Number.isInteger(x)||x<min||x>max)throw Error(`${name}: entero entre ${min} y ${max}.`);return x;}
export function encodeCommand(command,a={},board){
  let args=[];const i=(key,low,high)=>integer(a[key],low,high,key);
  if(['hello','stop','ping','scan'].includes(command)){}
  else if(['adc','read','write','pwm','burst'].includes(command)){
    const pin=i('pin',0,54);if(!board.gpio.includes(pin))throw Error('GPIO fuera del perfil.');args=[pin];
    if(['adc','burst'].includes(command)&&!board.adc.includes(pin))throw Error('GPIO no admite ADC en este perfil.');
    if(['write','pwm'].includes(command)&&board.inputOnly.includes(pin))throw Error('GPIO solamente entrada.');
    if(command==='adc'){if(!['raw','millivolts'].includes(a.mode))throw Error('Modo ADC inválido.');args.push(a.mode==='raw'?0:1);}
    if(command==='read'){if(!['none','up','down'].includes(a.pull)||board.inputOnly.includes(pin)&&a.pull!=='none')throw Error('Pull inválido.');args.push(['none','up','down'].indexOf(a.pull));}
    if(command==='write')args.push(i('value',0,1));
    if(command==='pwm')args.push(i('value',0,255),i('frequency',100,20000));
    if(command==='burst'){
      if(!['immediate','rising','falling'].includes(a.trigger))throw Error('Trigger inválido.');
      args.push(i('rate',20000,80000),i('count',16,4096),['immediate','rising','falling'].indexOf(a.trigger),i('level',0,4095),i('pre',0,a.count-1),i('timeout',100,5000));
      if(a.trigger==='immediate'&&a.pre!==0)throw Error('Pretrigger requiere flanco.');
    }
  }else if(command==='i2c'){
    args=[i('sda',0,54),i('scl',0,54)];if(args[0]===args[1]||args.some(p=>!board.gpio.includes(p)||board.inputOnly.includes(p)))throw Error('Pines I²C inválidos.');
  }else if(command==='i2cread'||command==='i2cwrite'){
    args=[i('address',8,119),i('register',0,255)];if(command==='i2cwrite')args.push(i('value',0,255));
  }else if(command==='i2cxfer'){
    const tx=bytes(a.tx);args=[i('address',8,119),tx.length,i('readCount',0,32),a.stop===true?1:0,...tx];
    if(typeof a.stop!=='boolean'||!tx.length&&!a.readCount)throw Error('Transacción I²C vacía o stop inválido.');
  }else throw Error('Comando desconocido.');
  return [command,...args].join(' ');
}
export class LineDecoder {
  constructor(max=100000){this.buffer='';this.max=max;}
  push(text){this.buffer+=text;if(this.buffer.length>this.max)throw Error('Trama serie demasiado grande.');const lines=this.buffer.split('\n');this.buffer=lines.pop();return lines.map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(x=>x&&typeof x==='object');}
}
