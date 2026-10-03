import { readFile, unlink } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import type { ChildProcess } from 'node:child_process';

export async function WaitForReadyFile(child: ChildProcess, port: number, file: string, timeoutMs = 90000) {
    const deadline=Date.now()+timeoutMs;
    try {
        while(Date.now()<deadline) {
            if(child.exitCode !== null && child.exitCode !== undefined || child.signalCode) throw new Error(`Game server on port ${port} exited before listening`);
            try {if(await readFile(file,'utf8')===`${child.pid}:${port}`)return;} catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
            await setTimeout(200);
        }
        throw new Error(`Game server on port ${port} did not start listening within ${timeoutMs}ms`);
    } finally {await unlink(file).catch(()=>{});}
}
