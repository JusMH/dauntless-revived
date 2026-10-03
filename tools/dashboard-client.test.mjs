import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('dashboard unlock renders both hosts and the CPU mean in actual client script',async()=>{
 const elements=new Map();
 const element=()=>({value:'',textContent:'',children:[],options:[],clientWidth:0,replaceChildren(...rows){this.children=rows;},append(...rows){this.children.push(...rows);},getContext(){return {};}});
 const document={hidden:false,getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,querySelectorAll:()=>[],addEventListener(){}};
 const row=(name,cpu)=>({name,cpu,online:true,hunts:2,ramUsedMB:1024,ramTotalMB:8192,huntSampleAt:new Date().toISOString()});
 const data={sample:null,worker:{configured:false},error:null,logNames:[],fleet:{rows:[row('Server #1',50),row('Server #2',5)],totals:{meanCpu:27.5,hunts:4,ramUsedMB:2048,ramTotalMB:16384,ramPercent:12.5,online:2,servers:2}}};
 vm.runInNewContext(await readFile(new URL('./dashboard-client.js',import.meta.url),'utf8'),{document,window:{addEventListener(){}},setInterval(){},AbortSignal,fetch:async()=>({ok:true,json:async()=>data})});
 document.getElementById('key').value='test-owner';document.getElementById('connect').onclick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(elements.get('error').textContent,'');
 assert.equal(elements.get('fleetMeanCpu').textContent,'27.5%');
 assert.equal(elements.get('fleetHunts').textContent,4);
 assert.equal(elements.get('fleetRows').children.length,2);
});
