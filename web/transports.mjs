import {encodeCommand,LineDecoder} from './serial-protocol.mjs';
import {BOARDS} from './core.mjs';
export class WebSocketTransport {
  constructor(url,token,Socket=globalThis.WebSocket){this.url=url;this.token=token;this.Socket=Socket;this.pending=new Map();this.id=0;this.closed=true;this.onclose=()=>{};}
  async open(){
    this.socket=new this.Socket(this.url);this.closed=false;
    this.socket.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{this.close();return;}const pending=this.pending.get(m.id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(m.id);m.ok?pending.resolve(m.value):pending.reject(Error(m.error));};
    this.socket.onclose=()=>{this.closed=true;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('WebSocket desconectado; no se reintentan escrituras.'));}this.pending.clear();this.onclose();};
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.close();reject(Error('Timeout abriendo WebSocket.'));},4000);this.socket.onopen=()=>{clearTimeout(timer);resolve();};this.socket.onerror=()=>{clearTimeout(timer);reject(Error('No se pudo abrir WebSocket.'));};});
    try{await this.request('auth',{token:this.token});}catch(e){this.close();throw e;}
  }
  request(op,args={},timeout=15000){
    if(this.closed||this.socket.readyState!==1)return Promise.reject(Error('WebSocket no conectado.'));
    if(this.pending.size>=8||this.socket.bufferedAmount>262144)return Promise.reject(Error('Transporte saturado; espera a completar solicitudes.'));
    const id=++this.id;
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Timeout de transporte. Reconecta explícitamente.'));this.close();},timeout);this.pending.set(id,{resolve,reject,timer});try{this.socket.send(JSON.stringify({id,op,args}));}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}});
  }
  connect(port,board){return this.request('connect',{port,board});}
  command(command,args={}){return this.request('command',{command,args});}
  async disconnect(){
    if(!this.socket||this.socket.readyState===3)return;
    const closed=new Promise(resolve=>{const timer=setTimeout(resolve,3000);this.socket.addEventListener('close',()=>{clearTimeout(timer);resolve();},{once:true});});
    try{if(!this.closed&&this.socket.readyState===1)await this.request('disconnect');}finally{this.close();await closed;}
  }
  close(){this.socket?.close();}
}
export class WebSerialTransport {
  constructor(serial=globalThis.navigator?.serial){this.serial=serial;this.id=0;this.pending=null;this.closed=true;this.onclose=()=>{};}
  async select(){if(!this.serial)throw Error('WebSerial requiere Chrome/Edge, HTTPS o localhost.');this.port=await this.serial.requestPort();}
  async connect(_port,board){
    if(!this.port)throw Error('Selecciona un puerto desde un clic del usuario.');this.board=board;
    await this.port.open({baudRate:115200,bufferSize:65536});this.closed=false;this.decoder=new LineDecoder();this.reader=this.port.readable.getReader();this.writer=this.port.writable.getWriter();this.readTask=this.readLoop();
    try{await new Promise(r=>setTimeout(r,1800));this.info=await this.command('hello');if(![1,2,3].includes(this.info?.protocol)||this.info.family!==board)throw Error('Firmware o familia incompatible.');return this.status();}catch(e){await this.disconnect();throw e;}
  }
  status(){return {connected:!this.closed,board:this.board,port:'WebSerial',info:this.info};}
  async readLoop(){
    const text=new TextDecoder();try{while(!this.closed){const {value,done}=await this.reader.read();if(done)break;for(const m of this.decoder.push(text.decode(value,{stream:true}))){if(m.id!==this.pending?.id)continue;const p=this.pending;this.pending=null;clearTimeout(p.timer);m.ok?p.resolve(m.value):p.reject(Error(m.error));}}}catch(e){this.fail(e);}finally{this.reader.releaseLock();this.fail(Error('Puerto serie cerrado.'));this.onclose();}
  }
  fail(e){this.closed=true;if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(e);this.pending=null;}}
  command(command,args={}){
    if(this.closed)return Promise.reject(Error('Puerto cerrado.'));
    if(this.pending)return Promise.reject(Error('Hay una operación serie pendiente.'));
    if(['burst','i2cxfer'].includes(command)&&![2,3].includes(this.info?.protocol))return Promise.reject(Error('Carga firmware de protocolo 2 o 3.'));
    if(['dac','touch','pcnt','tone'].includes(command)&&this.info?.protocol!==3)return Promise.reject(Error('Carga FlowLabBridge 0.3 (protocolo 3).'));
    const line=encodeCommand(command,args,BOARDS[this.board]),id=++this.id;
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.fail(Error('Timeout serie; reconecta la placa.'));this.reader.cancel().catch(()=>{});},12000);this.pending={id,resolve,reject,timer};this.writer.write(new TextEncoder().encode(`${id} ${line}\n`)).catch(e=>{this.fail(e);this.reader.cancel().catch(()=>{});});});
  }
  async disconnect(){
    if(!this.closed&&!this.pending)try{await this.command('stop');}catch{}
    this.fail(Error('Desconectado por el usuario.'));try{await this.reader?.cancel();await this.readTask;}catch{}try{this.writer?.releaseLock();await this.port?.close();}catch{}this.onclose();
  }
}
