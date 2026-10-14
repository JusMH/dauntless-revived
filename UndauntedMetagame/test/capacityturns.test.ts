import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CapacityTurns } from '../src/controllers/capacityturns';

test('capacity retry priority is regional and does not serialize in-flight launches', () => {
    const q = new CapacityTurns(60000);
    const active = new Set(['a','b','c']);
    assert.equal(q.start('a','ger',0,active),true);
    q.finish('a',true,0);
    assert.equal(q.start('b','ger',1,active),false);
    assert.equal(q.start('c','us',1,active),true);
    assert.equal(q.start('a','ger',2,active),true);
    assert.equal(q.start('b','ger',2,active),true);
});

test('cancelled and disconnected waiters cannot block the next hunt', () => {
    for (const cancel of [true,false]) {
        const q = new CapacityTurns(60000);
        const active = new Set(['a','b']);
        q.start('a','ger',0,active);
        q.finish('a',true,0);
        assert.equal(q.start('b','ger',1,active),false);
        if(cancel) active.delete('a');
        assert.equal(q.start('b','ger',cancel ? 2 : 60001,active),true);
    }
});
