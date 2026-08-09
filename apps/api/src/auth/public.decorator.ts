import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "ledgr:isPublic";

/**
 * Marks a route as reachable without authentication.
 *
 * Routes are guarded by default (JwtAuthGuard is global), so this is the
 * explicit, greppable opt-out — `git grep '@Public'` lists the entire
 * unauthenticated surface of the API.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
