import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { WaitForReadyFile } from '../src/controllers/readiness';

test('readiness requires this process and port, cleans markers, and detects startup exits', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hunt-ready-'));
    const file = path.join(dir, 'ready');
    const child = { pid: 123, exitCode: null, signalCode: null } as ChildProcess;
    try {
        await writeFile(file, '123:8764');
        await WaitForReadyFile(child, 8764, file, 100);
        await assert.rejects(access(file));
        await writeFile(file, '999:8764');
        await assert.rejects(WaitForReadyFile(child, 8764, file, 50), /did not start listening/);
        await writeFile(file, '123:8764');
        await assert.rejects(WaitForReadyFile({...child, exitCode: 1} as ChildProcess, 8764, file), /exited before listening/);
        await assert.rejects(access(file));
    } finally { await rm(dir, { recursive: true, force: true }); }
});
