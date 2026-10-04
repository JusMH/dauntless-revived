import { readFile, unlink } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { createSocket } from 'node:dgram';
import type { ChildProcess } from 'node:child_process';

function ChildStopped(child: ChildProcess) {
    return child.exitCode !== null && child.exitCode !== undefined || child.signalCode !== null && child.signalCode !== undefined;
}

export async function IsUdpPortBound(port: number) {
    return new Promise<boolean>((resolve, reject) => {
        const socket = createSocket({ type: 'udp4', reuseAddr: false });
        let settled = false;

        const finish = (value: boolean, error?: Error) => {
            if (settled) return;
            settled = true;
            socket.removeAllListeners();
            try { socket.close(); } catch {}
            if (error) reject(error);
            else resolve(value);
        };

        socket.once('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE' || error.code === 'EACCES') finish(true);
            else finish(false, error);
        });
        socket.bind({ port, address: '0.0.0.0', exclusive: true }, () => finish(false));
    });
}

export async function WaitForReadyFile(child: ChildProcess, port: number, file: string, timeoutMs = 90000) {
    const deadline = Date.now() + timeoutMs;
    let boundSamples = 0;
    let onExit!: () => void;
    let onError!: (error: Error) => void;
    const stopped = new Promise<never>((_resolve, reject) => {
        onExit = () => reject(new Error(`Game server on port ${port} exited before listening`));
        onError = error => reject(new Error(`Game server on port ${port} failed before listening: ${error.message}`));
        child.once('exit', onExit);
        child.once('error', onError);
    });

    try {
        while (Date.now() < deadline) {
            if (ChildStopped(child)) throw new Error(`Game server on port ${port} exited before listening`);

            try {
                const marker = (await readFile(file, 'utf8')).trim();
                const parts = marker.split(':');
                if (parts.length === 2 && /^\d+$/.test(parts[0]) && Number(parts[1]) === port) return;
            }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            }

            if (await IsUdpPortBound(port)) {
                boundSamples++;
                if (boundSamples >= 2) return;
            }
            else {
                boundSamples = 0;
            }

            await Promise.race([setTimeout(Math.min(200, Math.max(1, deadline - Date.now()))), stopped]);
        }

        throw new Error(`Game server on port ${port} did not start listening within ${timeoutMs}ms`);
    }
    finally {
        child.off('exit', onExit);
        child.off('error', onError);
        await unlink(file).catch(() => {});
    }
}
