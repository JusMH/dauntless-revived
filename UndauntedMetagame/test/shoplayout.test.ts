import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ShopLayout} from '../src/controllers/shoplayout';
import {WithEnv} from './appenv';
import catalog from '../src/vendor/store_catalog.json';
import type {StoreOffer} from '../src/controllers/freestore';

test('weekly stock is stable, rotates, preserves prices and corrects category tags',()=>WithEnv({STORE_RAMS_TEST_ACCOUNT:'pilot',STORE_WEEKLY_ROTATION:'1'},()=>{
    const offers=catalog.webstore as StoreOffer[];
    const day=new Date('2026-10-17T00:00:00Z');
    const first=ShopLayout(offers,'pilot',day);
    const featured=(xs:StoreOffer[])=>xs.filter(o=>o.tags.includes('feature')).map(o=>o.id);
    assert.equal(featured(first).length,8);
    assert.deepEqual(first,ShopLayout(offers,'pilot',new Date('2026-10-17T23:59:59Z')));
    assert.notDeepEqual(featured(first),featured(ShopLayout(offers,'pilot',new Date('2026-10-19T00:00:00Z'))));
    assert.ok(first.length < offers.length);
    for(const o of first) assert.equal(o.platinumPrice,offers.find(x=>x.id===o.id)!.platinumPrice);
    assert.equal(ShopLayout(offers,'other',day),offers);
    for(const offer of first){
        if(offer.tags.includes('social_emote')) assert.ok(!offer.tags.includes('personality_character'));
        if(offer.tags.includes('dye_armour')) assert.ok(!offer.tags.includes('personality_stylekit'));
        if(offer.items?.length && offer.items.every(i=>i.catalogId.startsWith('BNC_FABRIC_'))) assert.ok(!offer.tags.includes('personality_standard'));
    }
}));
