import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest } from "./jwt-auth.guard.js";

/** Injects the authenticated request context set by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedRequest["auth"] => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().auth;
  },
);
