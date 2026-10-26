import{test}from'node:test';
import assert from'node:assert/strict';
import{shouldPlayDeliveredEvent}from'../src/client/event-playback.js';

test('slow live delivery keeps every committed combat event',()=>{
 for(const eventTick of [1,40,87,88,99,100])assert.equal(shouldPlayDeliveredEvent(eventTick,100,false),true);
});
test('recovery limits historical replay while retaining current hit frames',()=>{
 assert.equal(shouldPlayDeliveredEvent(87,100,true),false);
 assert.equal(shouldPlayDeliveredEvent(88,100,true),true);
 assert.equal(shouldPlayDeliveredEvent(100,100,true),true);
});
