import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAdmission, CapacityUnavailable } from '../src/controllers/capacity';

test('memory floor, startup reservations, release and expiry', () => {
    process.env.GAMESERVER_MEMORY_GUARD = '1';
    let free = 4608 * 1048576, now = 0;
    const admission = new MemoryAdmission(() => free, () => now);
    const release = admission.reserve();
    assert.throws(() => admission.reserve(), CapacityUnavailable);
    release();
    admission.reserve();
    now = 60000;
    admission.reserve();
    now = 120000;
    free--;
    assert.throws(() => admission.reserve(), CapacityUnavailable);
    process.env.GAMESERVER_MIN_FREE_MB = 'invalid';
    assert.throws(() => admission.reserve(), /Invalid/);
    delete process.env.GAMESERVER_MIN_FREE_MB;
    process.env.GAMESERVER_MEMORY_GUARD = '0';
    admission.reserve();
});
