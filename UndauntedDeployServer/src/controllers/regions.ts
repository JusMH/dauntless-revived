import { CapacityUnavailable } from './capacity';
import { RemoteLaunch } from './overflow';

export type RegionChoice = 'main' | 'aus' | 'mixed';
type Request = Parameters<typeof RemoteLaunch>[1];
type Load = {running:number,pending:number,limit:number|null};
export function AusUrl() {
    if (!process.env.AUS_DEPLOYSERVER_URL) return undefined;
    const url = new URL(process.env.AUS_DEPLOYSERVER_URL);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
        throw new Error('AUS_DEPLOYSERVER_URL must be an HTTP loopback tunnel');
    return url;
}
export function Utilization(load: Load) {
    return load.limit && load.limit > 0 ? (load.running + load.pending) / load.limit : Infinity;
}
export async function DescribeAus(): Promise<any[]> {
    const url = AusUrl();
    if (!url) return [];
    try {
        const response = await fetch(new URL('/gameservers',url),{signal:AbortSignal.timeout(1500),redirect:'error'});
        if (!response.ok) return [];
        const body = await response.json() as any;
        return Array.isArray(body.servers) ? body.servers.map((server:any)=>({...server,host:'aus',region:'aus'})) : [];
    } catch { return []; }
}
export class RegionalRouter {
    constructor(private mainLoad: () => Promise<Load>, private remote = RemoteLaunch,
        private ausLoad = async (url: URL): Promise<Load> => {
            const response = await fetch(new URL('/gameservers', url), {signal:AbortSignal.timeout(2000),redirect:'error'});
            if (!response.ok) throw new Error('AUS capacity unavailable');
            const body = await response.json() as {capacity:Load};
            if (!body.capacity || !Number.isFinite(body.capacity.running) || !Number.isFinite(body.capacity.pending)) throw new Error('Invalid AUS capacity');
            return body.capacity;
        }) {}
    async launch<T>(body: Request, choice: RegionChoice, main: () => Promise<T>): Promise<T | NonNullable<Awaited<ReturnType<typeof RemoteLaunch>>>> {
        const url = AusUrl();
        if (!['ISLAND','CITY'].includes(body.GameMode)) return main();
        if (!url) { if (choice === 'aus') throw new CapacityUnavailable('hunts'); return main(); }
        let ausFirst = choice === 'aus';
        if (choice === 'mixed') {
            try {
                const [primary, aus] = await Promise.all([this.mainLoad(), this.ausLoad(url)]);
                ausFirst = Utilization(aus) < Utilization(primary);
            } catch { ausFirst = false; }
        }
        if (ausFirst) {
            const connection = await this.remote(url, body);
            if (connection) return connection;
            if (choice === 'aus') throw new CapacityUnavailable('hunts');
            return main();
        }
        try { return await main(); }
        catch (error) {
            if (!(error instanceof CapacityUnavailable)) throw error;
            const connection = await this.remote(url, body);
            if (connection) return connection;
            throw error;
        }
    }
}
