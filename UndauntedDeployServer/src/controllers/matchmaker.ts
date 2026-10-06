import { logger } from "../logger";
import { GetRamsgateConnectionDetails, GetTrainingDojoConnectionDetails, StartupGameserverWithArgs, StartupGameserverWithHuntIdAndPlayers } from "./gameservers";
import { Gameservers, KindOfGameserver, huntAdmission, DescribeGameservers } from './gameservers';
import { HuntRouter, RemoteLaunch, OverflowUrl, DescribeOverflow } from './overflow';
import { CityRouter } from './cityrouter';

const Cities = new CityRouter(async () => {
    const key = process.env.CITY_STATUS_KEY;
    if (!key) throw new Error('CITY_STATUS_KEY is required for Ramsgate balancing');
    const [response, worker] = await Promise.all([
        fetch('http://127.0.0.1:61000/undaunted/api/ServerStatus', {
            headers: {'x-undaunted-user-api-key': key}, signal: AbortSignal.timeout(5000)
        }), DescribeOverflow()
    ]);
    const status = await response.json() as any;
    if (!response.ok || status.limited || !Array.isArray(status.instances)) throw new Error('City occupancy unavailable');
    const count = (servers: {id:string,kind:string}[]) => {
        const city = servers.find(s => s.kind === 'city');
        return city ? Number(status.instances.find((i:any) => i.id === city.id)?.players ?? 0) : 0;
    };
    return {local: count(DescribeGameservers()), remote: count(worker)};
});

const Router = new HuntRouter(() => Gameservers.filter(server => ['hunt', 'tutorial'].includes(KindOfGameserver(server))).length, undefined, () => huntAdmission.status());

export async function HandleMatchmakingRequest(GameMode: string, GameArgs: string, HuntId: string, ExpectedPlayers: string[] | undefined){
    if (process.env.HUNT_WORKER === '1' && GameMode !== 'ISLAND' && !(GameMode === 'CITY' && process.env.WORKER_RAMSGATE === '1')) throw new Error('Hunt worker does not accept this world');
    if (GameMode === 'CITY' && process.env.CITY_OVERFLOW === '1') {
        const url = OverflowUrl();
        if (!url) throw new Error('City overflow needs the worker tunnel');
        return Cities.launch(ExpectedPlayers?.length ?? 1,
            () => GetRamsgateConnectionDetails(),
            () => RemoteLaunch(url, {GameMode, GameArgs, HuntId, ExpectedPlayers}),
            Number(process.env.RAMSGATE_PLAYER_LIMIT ?? 28));
    }
    return Router.launch({GameMode, GameArgs, HuntId, ExpectedPlayers}, () => HandleLocalMatchmaking(GameMode, GameArgs, HuntId, ExpectedPlayers));
}

async function HandleLocalMatchmaking(GameMode: string, GameArgs: string, HuntId: string, ExpectedPlayers: string[] | undefined){
    logger.info(`Handling matchmaking with GameMode: ${GameMode} HuntId: ${HuntId} and GameArgs: ${GameArgs} and ExpectedPlayers ${ExpectedPlayers}`);

    if(GameMode === "CITY"){
        return await GetRamsgateConnectionDetails();
    }
    else if(GameMode === "SHARED"){
        if (HuntId != undefined && HuntId.trim().length > 0){
            if(HuntId == "ShatteredIsles_TrainingDojo"){
                return await GetTrainingDojoConnectionDetails();
            }
        }
    }
    else if(GameMode === "ISLAND"){
        if(GameArgs != undefined && GameArgs.trim().length > 0){
            return await StartupGameserverWithArgs(GameArgs);
        }

        if(HuntId != undefined && HuntId.trim().length > 0 && ExpectedPlayers != undefined){
            return await StartupGameserverWithHuntIdAndPlayers(HuntId, ExpectedPlayers!);
        }
    }

    if (process.env.HUNT_WORKER === '1') throw new Error('No hunt could be resolved on worker');
    logger.error("Matchmaking failed, sending you to Ramsgate!");

    return await GetRamsgateConnectionDetails();
}
