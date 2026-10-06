export async function monitorWorker(url, label, fetcher=fetch) {
  const target=url?new URL(url):null;
  if(target&&(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||target.username||target.password||target.pathname!=='/'||target.search||target.hash))throw new Error('Worker must use a loopback tunnel');
  let state={configured:!!target,online:false,sample:null,error:null},busy=false;
  const history=[];
  async function poll(){
    if(!target||busy)return;busy=true;
    try{
      const response=await fetcher(new URL('/health',target),{signal:AbortSignal.timeout(2500),redirect:'error'});
      if(!response.ok)throw new Error();
      const data=await response.json();
      if(!data.services||!Array.isArray(data.hunts)||!Number.isFinite(Date.parse(data.at)))throw new Error();
      history.push({at:data.at,workerCpuChart:data.cpu,workerRamChart:data.ramUsedMB});
      if(history.length>720)history.shift();
      state={configured:true,online:true,sample:data,history,error:null};
    }catch{state={...state,online:false,error:`${label} or its private monitoring connection is unavailable. Last readings are stale.`};}
    finally{busy=false;}
  }
  await poll();const timer=setInterval(()=>void poll(),5000);timer.unref();
  return {get state(){return state;},close(){clearInterval(timer);}};
}
