"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@ledgr/contracts";
import { AppShell } from "../../components/shell";
import { buildNavGroups } from "../../lib/navigation";
import { getSessionUser } from "../../lib/session";

/**
 * Frame for every signed-in page.
 *
 * A route group `(app)` rather than a path segment, so the shell wraps these
 * routes without adding "/app" to any URL. The auth pages stay outside it and
 * keep their own full-bleed layout.
 */
export default function AppLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  // Session lives in localStorage, which the server can't read, so the guard
  // has to run client-side.
  useEffect(() => {
    const session = getSessionUser();
    if (!session) {
      router.replace("/login");
      return;
    }
    setUser(session);
  }, [router]);

  if (!user) return <div />;

  return (
    <AppShell
      areaName={user.householdName}
      navGroups={buildNavGroups()}
      environmentLabel={process.env.NODE_ENV === "development" ? "DEV" : undefined}
    >
      {children}
    </AppShell>
  );
}
