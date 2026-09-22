import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchBlocks,insertionPoint,shortcutOpensSearch} from '../web/workspace.mjs';
import {TYPES} from '../web/core.mjs';

test('Search handles Spanish accents, aliases, multiple words and unknown queries',()=>{
  assert.equal(searchBlocks(TYPES,'FFT')[0][0],'fft');
  assert.ok(searchBlocks(TYPES,'osciloscopio').some(([t])=>t==='chart'));
  assert.ok(searchBlocks(TYPES,'analógico entrada').some(([t])=>t==='adc'));
  assert.equal(searchBlocks(TYPES,'no-existe-este-bloque').length,0);
  assert.equal(searchBlocks(TYPES,'').length,Object.keys(TYPES).length);
  assert.deepEqual(searchBlocks(TYPES,'senal'),searchBlocks(TYPES,'señal'));
});
test('Insertion uses original pointer in world coordinates before popup is clamped',()=>{
  assert.deepEqual(insertionPoint({x:900,y:600},{left:10,top:56},{x:100,y:-44,zoom:2}),{x:395,y:294});
  assert.deepEqual(insertionPoint({x:-100,y:-100},{left:0,top:56},{x:0,y:0,zoom:1}),{x:0,y:0});
  assert.deepEqual(insertionPoint({x:99999,y:99999},{left:0,top:0},{x:0,y:0,zoom:.1}),{x:5500,y:3500});
});
test('Search shortcuts preserve input, controls, IME and browser modifiers',()=>{
  assert.equal(shortcutOpensSearch({key:' '}),true);
  assert.equal(shortcutOpensSearch({key:'/',shiftKey:true}),true);
  for(const key of [' ','/']){
    for(const flag of ['ctrlKey','altKey','metaKey','isComposing','repeat'])assert.equal(shortcutOpensSearch({key,[flag]:true}),false);
    for(const flag of ['editing','interactive'])assert.equal(shortcutOpensSearch({key},{[flag]:true}),false);
    assert.equal(shortcutOpensSearch({key},{diagram:false}),false);
  }
});
