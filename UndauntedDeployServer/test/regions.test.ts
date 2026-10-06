import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { RegionalRouter, AusUrl } from '../src/controllers/regions';
import { CapacityUnavailable } from '../src/controllers/capacity';
process.env.AUS_DEPLOYSERVER_URL='http://127.0.0.1:61021';
after(()=>delete process.env.AUS_DEPLOYSERVER_URL);
const body={GameMode:'ISLAND',GameArgs:'',HuntId:'hunt',ExpectedPlayers:['one','two']};
const main={host:'main',port:8762}, aus={host:'aus',port:8700};
const load=async()=>({running:10,pending:1,limit:22});
test('AUS keeps the whole party and all hunt arguments; shared worlds remain in the main pool',async()=>{
    let calls=0;
    const router=new RegionalRouter(load,async(_url,request)=>{calls++;assert.deepEqual(request,body);return aus;});
    assert.deepEqual(await router.launch(body,'aus',async()=>main),aus);
    assert.deepEqual(await router.launch({...body,GameMode:'CITY'},'aus',async()=>main),main);
    assert.deepEqual(await router.launch({...body,GameMode:'SHARED'},'aus',async()=>main),main);
    assert.equal(calls,1);
});
test('explicit capacity fallback works in both directions; ambiguous failures do not duplicate hunts',async()=>{
    assert.deepEqual(await new RegionalRouter(load,async()=>undefined).launch(body,'aus',async()=>main),main);
    assert.deepEqual(await new RegionalRouter(load,async()=>aus).launch(body,'main',async()=>{throw new CapacityUnavailable('hunts');}),aus);
    let calls=0;
    await assert.rejects(new RegionalRouter(load,async()=>{throw new Error('timeout');}).launch(body,'aus',async()=>{calls++;return main;}),/timeout/);
    assert.equal(calls,0);
});
test('mixed parties choose available pool by capacity utilization, not raw hunt count',async()=>{
    const router=new RegionalRouter(load,async()=>aus,async()=>({running:12,pending:0,limit:40}));
    assert.deepEqual(await router.launch(body,'mixed',async()=>main),aus);
    const full=new RegionalRouter(load,async()=>aus,async()=>({running:24,pending:0,limit:24}));
    assert.deepEqual(await full.launch(body,'mixed',async()=>main),main);
});
test('regional worker URL must be a private loopback tunnel',()=>{
    process.env.AUS_DEPLOYSERVER_URL='http://example.com';
    assert.throws(AusUrl,/loopback/);
    process.env.AUS_DEPLOYSERVER_URL='http://127.0.0.1:61021';
});
