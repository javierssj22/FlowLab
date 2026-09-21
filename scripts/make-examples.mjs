import {mkdirSync,writeFileSync} from 'node:fs';
import {example} from '../web/core.mjs';
import {generateArduino} from '../web/codegen.mjs';
const root=new URL('../examples/',import.meta.url);mkdirSync(root,{recursive:true});
for(const kind of ['signal','adc','pwm','feedback','types','processing','burst','module','i2cframe'])writeFileSync(new URL(`${kind}.flowlab.json`,root),JSON.stringify(example(kind),null,2)+'\n');
const sketch=new URL('FlowLabStandalone/',root);mkdirSync(sketch,{recursive:true});
writeFileSync(new URL('FlowLabStandalone.ino',sketch),generateArduino(example('signal')));
