import {openSync,closeSync,fstatSync,readSync} from 'node:fs';
import path from 'node:path';

export function ParseNativeOccupancy(text:string):number|undefined {
    const matches=[...text.matchAll(/^net driver=IpNetDriver[^\r\n]* connections=(\d+) owned=(\d+) open=(\d+)\r?$/gm)];
    const last=matches.at(-1);
    return last ? Number(last[1]) : undefined;
}
// Only read the bounded tail of our own process's count-only diagnostic log.
export function NativeOccupancy(pid:number, startedAt:Date):number|undefined {
    if(!process.env.GAMESERVER_READY_DIR || !Number.isSafeInteger(pid) || pid<1)return undefined;
    let fd:number|undefined;
    try {
        fd=openSync(path.join(process.env.GAMESERVER_READY_DIR,`native-fault-${pid}.log`),'r');
        const stat=fstatSync(fd);
        if(stat.mtimeMs<startedAt.getTime() || Date.now()-stat.mtimeMs>90000)return undefined;
        const buffer=Buffer.alloc(Math.min(stat.size,8192));
        const read=readSync(fd,buffer,0,buffer.length,stat.size-buffer.length);
        return ParseNativeOccupancy(buffer.subarray(0,read).toString());
    }catch{return undefined;}finally{if(fd!==undefined)closeSync(fd);}
}
