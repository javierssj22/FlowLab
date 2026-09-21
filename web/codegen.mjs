// Deterministic export: only validated, known node types can emit C++.
import {TYPES,describe,flattenModules,validate,hardwareErrors,executionOrder} from './core.mjs';
export function generateArduino(project) {
  const errors=validate(project);
  if(errors.length)throw Error(errors.join('\n'));
  errors.push(...hardwareErrors(project));
  const collect=p=>p.nodes.flatMap(n=>n.type==='subvi'?collect(n.graph):[n]);
  if(collect(project).some(n=>['dac','pcnt','touch','tone'].includes(n.type)))throw Error('DAC, PCNT, Touch y Tone requieren el motor conectado y FlowLabBridge 0.3; todavía no se exportan como sketch autónomo.');
  if(collect(project).some(n=>['vector','waveform'].includes(describe(n).output)))throw Error('Vector, waveform, ADC DMA e I²C multibyte requieren el motor conectado en 0.3; la exportación autónoma admite los bloques escalares y subVIs escalares.');
  if(project.nodes.some(n=>n.type==='subvi'))project=flattenModules(project);
  if(!project.nodes.length)errors.push('El diagrama está vacío.');
  if(errors.length)throw Error(errors.join('\n'));
  const names=new Map(project.nodes.map((n,i)=>[n.id,`v${i}`]));
  const states=[],setup=[],body=[],delays=[],stops=[];
  const number=x=>{if(!Number.isFinite(x))throw Error('Parámetro no finito.');return Number.isInteger(x)?`${x}.0`:String(x);};
  const stringLiteral=value=>'"'+Array.from(new TextEncoder().encode(value),b=>'\\x'+b.toString(16).padStart(2,'0')).join('')+'"';
  const usesI2c=project.nodes.some(n=>n.type.startsWith('i2c'));
  for(const n of executionOrder(project)) {
    const p=n.params,name=names.get(n.id),inputs=Object.fromEntries(project.edges.filter(e=>e.to===n.id).map(e=>{
      const numeric=describe(n).inputs.find(port=>port.name===e.input).type==='number';
      return [e.input,numeric?`(double)${names.get(e.from)}`:names.get(e.from)];
    }));
    const {a,b}=inputs;let expression;
    switch(n.type) {
      case 'multimeter':expression=inputs.in;break;
      case 'xyChart':expression=inputs.y;break;
      case 'bitwise':{if(['shl','shr'].includes(p.op))body.push(`  if (${b}<0 || ${b}>31) fatal("Shift count out of range");`);expression=p.op==='not'?`~(int32_t)${a}`:p.op==='shl'?`(int32_t)((uint32_t)${a} << ${b})`:p.op==='shr'?`((int32_t)${a} >= 0 ? (int32_t)((uint32_t)${a} >> ${b}) : (int32_t)~((uint32_t)~(int32_t)${a} >> ${b}))`:`(int32_t)${a} ${{and:'&',or:'|',xor:'^'}[p.op]} (int32_t)${b}`;break;}
      case 'subOutput':expression=inputs.in;break;
      case 'constant':case 'slider':case 'integer':expression=number(p.value);break;
      case 'text':expression=`String(${stringLiteral(p.value)})`;break;
      case 'toggle':expression=p.value==='1'?'true':'false';break;
      case 'time':expression='t';break;
      case 'signal':expression=`wave(t, ${number(p.frequency)}, ${number(p.phase)}, ${['sine','square','triangle','saw'].indexOf(p.wave)}) * ${number(p.amplitude)} + ${number(p.offset)}`;break;
      case 'add':expression=`${a}+${b}`;break;case 'subtract':expression=`${a}-${b}`;break;case 'multiply':expression=`${a}*${b}`;break;
      case 'divide':body.push(`  if (${b} == 0) fatal("Division by zero");`);expression=`${a}/${b}`;break;
      case 'map':expression=`${number(p.outMin)}+(${inputs.in}-${number(p.inMin)})*(${number(p.outMax)}-${number(p.outMin)})/(${number(p.inMax)}-${number(p.inMin)})`;break;
      case 'clamp':expression=`limit(${inputs.in},${number(p.min)},${number(p.max)})`;break;
      case 'compare':expression=`${a} ${p.op} ${b}`;break;
      case 'and':expression=`${a} && ${b}`;break;case 'not':expression=`!${inputs.in}`;break;
      case 'select':expression=`${inputs.if} ? ${inputs.yes} : ${inputs.no}`;break;
      case 'concat':expression=`${a}+${b}`;break;
      case 'toText':expression=`String(${inputs.in},6)`;break;
      case 'toInteger':expression=`trunc(limit(${inputs.in},-2147483648.0,2147483647.0))`;break;
      case 'abs':expression=`fabs(${inputs.in})`;break;
      case 'power':expression=`pow(${inputs.base},${inputs.exponent})`;break;
      case 'sqrt':expression=`sqrt(${inputs.in})`;break;
      case 'modulo':body.push(`  if (${b}==0) fatal("Modulo divisor zero");`);expression=`fmod(${a},${b})`;break;
      case 'round':expression=p.mode==='nearest'?`floor(${inputs.in}+0.5)`:`${p.mode}(${inputs.in})`;break;
      case 'trig':{const scale=p.unit==='degrees'?'(PI/180.0)':'1.0';expression=p.fn.startsWith('a')?`${p.fn}(${inputs.in})/${scale}`:`${p.fn}(${inputs.in}*${scale})`;break;}
      case 'logarithm':expression=`${p.base==='10'?'log10':p.base==='2'?'log2':'log'}(${inputs.in})`;break;
      case 'exponential':expression=`exp(${inputs.in})`;break;
      case 'minmax':expression=`f${p.mode}(${a},${b})`;break;
      case 'or':expression=`${a}||${b}`;break;case 'xor':expression=`${a}!=${b}`;break;
      case 'boolToNumber':expression=`${inputs.in}?1:0`;break;
      case 'length':expression=`${inputs.in}.length()`;break;
      case 'pulse':expression=`fmod((t+${number(p.phase)})/${number(p.period)},1.0)*100.0<${number(p.duty)}`;break;
      case 'random':
        states.push(`uint32_t s_${name}=${p.seed}u;`);body.push(`  s_${name}^=s_${name}<<13; s_${name}^=s_${name}>>17; s_${name}^=s_${name}<<5;`);
        expression=`${number(p.min)}+(s_${name}/4294967296.0)*(${number(p.max)}-${number(p.min)})`;break;
      case 'movingAverage':case 'rms':
        states.push(`double s_${name}[${p.window}]={}; int count_${name}=0, cursor_${name}=0;`);
        body.push(`  s_${name}[cursor_${name}]=${inputs.in}; cursor_${name}=(cursor_${name}+1)%${p.window}; if(count_${name}<${p.window})count_${name}++;`,
          `  double sum_${name}=0; for(int i=0;i<count_${name};i++)sum_${name}+=s_${name}[i]${n.type==='rms'?`*s_${name}[i]`:''};`);
        expression=n.type==='rms'?`sqrt(sum_${name}/count_${name})`:`sum_${name}/count_${name}`;break;
      case 'derivative':
        states.push(`double s_${name}=0; bool initialized_${name}=false;`);expression=`initialized_${name}?(${inputs.in}-s_${name})/dt:0.0`;break;
      case 'integrator':
        states.push(`double s_${name}=${number(p.initial)};`);expression=`limit(s_${name}+${inputs.in}*dt,${number(p.min)},${number(p.max)})`;break;
      case 'hysteresis':
        states.push(`bool s_${name}=false;`);expression=`${inputs.in}>=${number(p.high)}?true:${inputs.in}<=${number(p.low)}?false:s_${name}`;break;
      case 'edge':
        states.push(`bool s_${name}=false;`);expression=p.mode==='rising'?`${inputs.in}&&!s_${name}`:p.mode==='falling'?`!${inputs.in}&&s_${name}`:`${inputs.in}!=s_${name}`;break;
      case 'counter':
        states.push(`bool previous_${name}=false; int32_t count_${name}=0;`);
        body.push(`  if(${inputs.reset})count_${name}=0; else if(${inputs.in}&&!previous_${name}&&count_${name}<2147483647)count_${name}++;`, `  previous_${name}=${inputs.in};`);expression=`count_${name}`;break;
      case 'onDelay':
        states.push(`double s_${name}=0;`);body.push(`  s_${name}=${inputs.in}?fmin(${number(p.duration)},s_${name}+dt):0.0;`);expression=`${inputs.in}&&s_${name}>=${number(p.duration)}`;break;
      case 'runningStat':
        states.push(`double count_${name}=0, mean_${name}=0, m2_${name}=0, min_${name}=0, max_${name}=0;`);
        body.push(`  if(count_${name}==0)min_${name}=max_${name}=${inputs.in};`, `  count_${name}++; double delta_${name}=${inputs.in}-mean_${name}; mean_${name}+=delta_${name}/count_${name}; m2_${name}+=delta_${name}*(${inputs.in}-mean_${name});`, `  min_${name}=fmin(min_${name},${inputs.in}); max_${name}=fmax(max_${name},${inputs.in});`);
        expression=p.mode==='stddev'?`sqrt(fmax(0.0,m2_${name}/count_${name}))`:`${p.mode}_${name}`;break;
      case 'filter':
        states.push(`double s_${name}=0; bool initialized_${name}=false;`);
        expression=`initialized_${name} ? s_${name}+(1-exp(-dt/${number(p.tau)}))*(${inputs.in}-s_${name}) : ${inputs.in}`;
        break;
      case 'pid':
        states.push(`PIDState s_${name};`);
        expression=`pid(s_${name},${inputs.set},${inputs.pv},dt,${number(p.kp)},${number(p.ki)},${number(p.kd)},${number(p.min)},${number(p.max)})`;
        break;
      case 'delay':states.push(`double s_${name}=${number(p.initial)};`);expression=`s_${name}`;delays.push(`  s_${name}=${inputs.in};`);break;
      case 'adc':setup.push(`  pinMode(${p.pin}, INPUT);`);expression=`${p.mode==='raw'?'analogRead':'analogReadMilliVolts'}(${p.pin})`;break;
      case 'digitalRead':setup.push(`  pinMode(${p.pin}, ${p.pull==='up'?'INPUT_PULLUP':p.pull==='down'?'INPUT_PULLDOWN':'INPUT'});`);expression=`digitalRead(${p.pin}) != 0`;break;
      case 'digitalWrite':setup.push(`  pinMode(${p.pin}, OUTPUT); digitalWrite(${p.pin}, LOW);`);stops.push(`  digitalWrite(${p.pin}, LOW);`);expression=inputs.in;break;
      case 'pwm':setup.push(`  if (!ledcAttach(${p.pin},${p.frequency},8)) fatal("PWM init failed");`);stops.push(`  ledcWrite(${p.pin},0); ledcDetach(${p.pin}); pinMode(${p.pin}, OUTPUT); digitalWrite(${p.pin},LOW);`);expression=`round(limit(${inputs.in},0,255))`;break;
      case 'i2cRead':expression=`readRegister(${p.address},${p.register})`;break;
      case 'i2cWrite':expression=`round(limit(${inputs.in},0,255))`;break;
      case 'chart':case 'gauge':case 'led':case 'log':case 'textIndicator':expression=inputs.in;break;
      default:throw Error(`El exportador no admite el bloque ${n.type}.`);
    }
    body.push(`  ${{number:'double',integer:'int32_t',boolean:'bool',string:'String'}[describe(n).output]} ${name} = ${expression}; // ${n.type}`);
    if(['number','integer'].includes(describe(n).output))body.push(`  if (!isfinite(${name})) fatal("Non-finite value at ${n.id}");`);
    if(describe(n).output==='string')body.push(`  if (${name}.length()>4096) fatal("Text buffer limit");`);
    if(n.type==='filter')body.push(`  s_${name}=${name}; initialized_${name}=true;`);
    if(n.type==='derivative')body.push(`  s_${name}=${inputs.in}; initialized_${name}=true;`);
    if(['integrator','hysteresis'].includes(n.type))body.push(`  s_${name}=${name};`);
    if(n.type==='edge')body.push(`  s_${name}=${inputs.in};`);
    if(n.type==='digitalWrite')body.push(`  digitalWrite(${p.pin}, ${name} ? HIGH : LOW);`);
    if(n.type==='pwm')body.push(`  if (!ledcWrite(${p.pin},(uint32_t)${name})) fatal("PWM write failed");`);
    if(n.type==='i2cWrite')body.push(`  writeRegister(${p.address},${p.register},(uint8_t)${name});`);
    if(['chart','gauge','led','log','multimeter'].includes(n.type))body.push(`  Serial.print(t,6); Serial.print(",${n.id},"); Serial.println((double)${name},6);`);
    if(n.type==='xyChart')body.push(`  Serial.print(t,6); Serial.print(",${n.id}.x,"); Serial.println((double)${inputs.x},6);`, `  Serial.print(t,6); Serial.print(",${n.id}.y,"); Serial.println((double)${inputs.y},6);`);
    if(n.type==='textIndicator')body.push(`  Serial.print(t,6); Serial.print(",${n.id},"); printCsvText(${name}); Serial.println();`);
  }
  if(usesI2c)setup.push(`  if (!Wire.begin(${project.i2c.sda},${project.i2c.scl},100000)) fatal("I2C init failed");\n  Wire.setTimeOut(10);`);
  return `// FlowLab 0.3 — standalone export — MIT\n// Target: ${project.board}. Arduino-ESP32 3.x.\n// Controls are frozen at export time. Instrument output: time_s,node_id,value.\n// Runs continuously after boot; host stop/watchdog is not used in standalone mode.\n// Review the GPIO wiring before upload.\n#include <Arduino.h>\n#include <Wire.h>\n#include <math.h>\n\nvoid printCsvText(const String &value) { Serial.write(34); for(unsigned int i=0;i<value.length();i++){if(value[i]==34)Serial.write(34);Serial.write(value[i]);} Serial.write(34); }\nstruct PIDState { double integral=0, previous=0; bool initialized=false; };\n// Explicit prototypes keep Arduino's preprocessor compatible with the custom struct.\ndouble pid(PIDState &s,double setpoint,double pv,double dt,double kp,double ki,double kd,double low,double high);\nvoid fatal(const char* message);\ndouble limit(double v,double low,double high) { return fmax(low,fmin(high,v)); }\ndouble wave(double t,double hz,double phase,int shape) {\n  double x=t*hz+phase/(2*PI), f=x-floor(x);\n  if(shape==0)return sin(2*PI*x);\n  if(shape==1)return f<0.5?1:-1;\n  if(shape==2)return 1-4*fabs(f-0.5);\n  return 2*f-1;\n}\ndouble pid(PIDState &s,double setpoint,double pv,double dt,double kp,double ki,double kd,double low,double high) {\n  if(!s.initialized){s.previous=pv;s.initialized=true;}\n  double error=setpoint-pv, integral=s.integral+error*dt;\n  double raw=kp*error+ki*integral-kd*(pv-s.previous)/dt, out=limit(raw,low,high);\n  if(raw==out||(raw>high&&ki*error<0)||(raw<low&&ki*error>0))s.integral=integral;\n  s.previous=pv;return out;\n}\nvoid fatal(const char* message) {\n${stops.join('\n')}\n  Serial.print("ERROR: ");Serial.println(message);\n  while(true)delay(1000);\n}\n${usesI2c?`double readRegister(uint8_t address,uint8_t reg) {\n  Wire.beginTransmission(address);Wire.write(reg);\n  if(Wire.endTransmission(false)!=0)fatal("I2C NACK");\n  if(Wire.requestFrom(address,(size_t)1,true)!=1)fatal("I2C read failed");\n  return Wire.read();\n}\nvoid writeRegister(uint8_t address,uint8_t reg,uint8_t value) {\n  Wire.beginTransmission(address);Wire.write(reg);Wire.write(value);\n  if(Wire.endTransmission()!=0)fatal("I2C NACK");\n}\n`:''}\n${states.join('\n')}\nuint32_t lastTick=0;\ndouble t=0;\nvoid setup() {\n  Serial.begin(115200);\n  analogReadResolution(12);\n${setup.join('\n')}\n  Serial.println("time_s,node_id,value");\n  lastTick=millis();\n}\nvoid loop() {\n  uint32_t now=millis(), elapsed=now-lastTick;\n  if(elapsed<${project.interval}){delay(1);return;}\n  lastTick=now;double dt=elapsed/1000.0;\n${body.join('\n')}\n${delays.join('\n')}\n  t+=dt;\n}\n`;
}
