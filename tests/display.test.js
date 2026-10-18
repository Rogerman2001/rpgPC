import test from 'node:test';
import assert from 'node:assert/strict';
import {DISPLAY_KEY,defaultDisplay,validateDisplay,automaticScale,displayScale} from '../js/display-scale.js';
test('automatic scaling uses viewport dimensions and a bounded desktop range',()=>{
 assert.equal(automaticScale(1366,768),.9);assert.equal(automaticScale(1920,1080),1);assert.equal(automaticScale(2560,1440),1.25);assert.equal(automaticScale(3840,2160),1.5);
 assert.equal(automaticScale(2560,768),.9);assert.equal(automaticScale(390,844),1);assert.equal(automaticScale(1024,768),1);
});
test('manual steps, profiles and reset are independent from game data',()=>{
 assert.equal(DISPLAY_KEY,'cavernaburx.display.v1');
 for(let manual=75;manual<=150;manual+=5){const p=validateDisplay({version:1,mode:'manual',manual});assert.equal(displayScale(p,1920,1080),manual/100);assert.equal(displayScale(p,390,844),1);}
 assert.deepEqual(defaultDisplay(),{version:1,mode:'auto',manual:100});
});
test('invalid or old preferences fall back safely',()=>{
 for(const data of [null,{}, {version:2,mode:'manual',manual:125},{version:1,mode:'bad',manual:125},{version:1,mode:'manual',manual:74},{version:1,mode:'manual',manual:151},{version:1,mode:'manual',manual:126},{version:1,mode:'manual',manual:'125'}])assert.deepEqual(validateDisplay(data),defaultDisplay());
});
