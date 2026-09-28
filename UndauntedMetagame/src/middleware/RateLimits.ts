import { rateLimit } from "express-rate-limit";

const Reply = { error: "rate_limited", message: "Too many requests; try again later." };

// Independent from mutations so dashboard polling cannot consume the admin write allowance.
export const HealthReadRateLimit = rateLimit({windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false, message: Reply});

// Failed login exchanges are the useful signal here. Successful game logins do not consume the
// allowance, so reconnecting clients cannot lock one another out behind the same public address.
export const LoginRateLimit = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 30,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: Reply
});

// The 1.4.4 client verifies its token about once every 30 seconds. Keep ample room for reconnects
// and multiple local clients while still bounding unauthenticated polling of the authorization route.
export const TokenVerifyRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: Reply
});

// Direct host/admin mutations get a deliberately generous ceiling. This prevents an accidentally
// looping or brute-force caller without changing normal administration and migration workflows.
export const AdminMutationRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: Reply
});
