import { NextFunction, Request, Response } from "express";
import { GetUserInfoForApiKey, UserInfo } from "../controllers/undauntedapi";
import {CheckPlayerAccess} from '../controllers/moderation';

export async function HasUndauntedUserApiKey(req: Request, res: Response, next: NextFunction){
    const ApiKey = req.headers["x-undaunted-user-api-key"] as string | undefined;

    if(ApiKey == undefined){
        res.status(401);
        res.send();
        return;
    };

    const UserInfo: UserInfo | undefined = await GetUserInfoForApiKey(ApiKey);

    if(UserInfo == undefined){
        res.status(401);
        res.send();
        return;
    };

    if(!CheckPlayerAccess(req,res,UserInfo.UserId)) return;
    (req as any).UndauntedUserInfo = UserInfo;

    next();

    return;
}
