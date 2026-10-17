import {createHash} from 'node:crypto';
import type {StoreOffer} from './freestore';
import {RamsEnabled} from './ramspricing';

// Test-account only until the matching native empty-tab fix is verified.
export function ShopLayout(offers: StoreOffer[], accountId: string, now = new Date()): StoreOffer[] {
    if(!RamsEnabled(accountId) || process.env.STORE_WEEKLY_ROTATION !== '1') return offers;
    // Monday 00:00 UTC; the same selection survives restarts and is shared by hosts.
    const week=Math.floor((now.getTime()-Date.UTC(1970,0,5))/(7*86400000));
    const ranked=offers.map(o=>({id:o.id,rank:createHash('sha256').update(`${week}:${o.id}`).digest('hex')}))
        .sort((a,b)=>a.rank.localeCompare(b.rank)||a.id.localeCompare(b.id));
    const cleaned=offers.map(offer=>{
        const tags=offer.tags.filter(tag=>tag!=='feature'
            && !(tag==='personality_character' && offer.tags.includes('social_emote'))
            && !(tag==='personality_stylekit' && offer.tags.includes('dye_armour'))
            && !(tag==='personality_standard' && offer.items?.every(item=>item.catalogId.startsWith('BNC_FABRIC_'))));
        return {...offer,tags};
    });
    const counts=new Map<string,number>();
    const byId=new Map(cleaned.map(o=>[o.id,o]));
    const selected:StoreOffer[]=[];
    for(const row of ranked){
        const offer=byId.get(row.id)!;
        const category=offer.tags.find(t=>/^(skin_|social_|dye_|personality_|supplies_)/.test(t)) ?? 'other';
        if((counts.get(category)??0)>=3) continue;
        counts.set(category,(counts.get(category)??0)+1);
        selected.push(offer);
    }
    const featured=new Set(selected.slice(0,8).map(o=>o.id));
    return selected.map(o=>featured.has(o.id)?{...o,tags:[...o.tags,'feature']}:o);
}
