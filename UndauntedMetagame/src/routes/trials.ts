import { Router } from "express";
import { HasUndauntedMetagameAuth } from "../middleware/HasUndauntedMetagameAuth";
import { logger } from "../logger";
import { TrialsLeaderboards } from "../features";
import { AllLeaderboards, GroupIndividual, GroupLeaderboard, SaveTrialRun, SoloIndividual, SoloLeaderboard, TrialsError } from "../controllers/trials";

export const trialsRouter = Router();

function TrialsOn(_req: any, _res: any, next: any){
    next(TrialsLeaderboards() ? undefined : "route");
}

function Send(res: any, Work: () => unknown){
    try{
        res.status(200);
        res.json(Work());
    }
    catch(error){
        if(error instanceof TrialsError){
            res.status(error.Status);
            res.json({code: String(error.Status), message: error.message});
            return;
        }

        logger.error(error, "Trials leaderboard request failed");
        res.status(500);
        res.json({code: "500", message: "Trials leaderboard request failed"});
    }
}

// 1.4.4 has five endpoint slots. The aggregate endpoint also accepts a game-server result body:
// a body with completion_time is a submission, otherwise it is the aggregate leaderboard query.
// Submissions are never accepted from a player token.
trialsRouter.post("/trials/leaderboards", TrialsOn, HasUndauntedMetagameAuth, (req: any, res) => {
    if(req.body?.completion_time !== undefined){
        if(!req.AuthData.IsGameserver){
            res.status(403);
            res.json({code: "403", message: "Trials results may only be submitted by a game server"});
            return;
        }

        try{
            const Saved = SaveTrialRun(req.body);
            logger.info(`Saved ${Saved.mode} Trials result for ${Saved.accountIds.join(",")} on ${Saved.trialId}`);
            res.status(204);
            res.send();
        }
        catch(error){
            if(error instanceof TrialsError){
                res.status(error.Status);
                res.json({code: String(error.Status), message: error.message});
                return;
            }

            logger.error(error, "Trials result save failed");
            res.status(500);
            res.json({code: "500", message: "Trials result save failed"});
        }

        return;
    }

    Send(res, () => AllLeaderboards(req.body));
});

trialsRouter.post("/trials/leaderboards/solo", TrialsOn, HasUndauntedMetagameAuth, (req: any, res) => Send(res, () => SoloLeaderboard(req.body)));
trialsRouter.post("/trials/leaderboards/solo/individual", TrialsOn, HasUndauntedMetagameAuth, (req: any, res) => Send(res, () => SoloIndividual(req.body)));
trialsRouter.post("/trials/leaderboards/group", TrialsOn, HasUndauntedMetagameAuth, (req: any, res) => Send(res, () => GroupLeaderboard(req.body)));
trialsRouter.post("/trials/leaderboards/group/individual", TrialsOn, HasUndauntedMetagameAuth, (req: any, res) => Send(res, () => GroupIndividual(req.body)));
