"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner, makeStyles, tokens } from "@fluentui/react-components";
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
 *
 * The shell renders immediately — including server-side — and only the content
 * area waits on the session check. Gating the whole tree instead would blank
 * the entire window on every reload, since the session lives in localStorage
 * and the server cannot read it.
 */

const useStyles = makeStyles({
  loading: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorNeutralBackground3,
  },
});

/** undefined = still checking · null = signed out · SessionUser = signed in */
type SessionState = SessionUser | null | undefined;

export default function AppLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();
  const [session, setSession] = useState<SessionState>(undefined);

  useEffect(() => {
    const current = getSessionUser();
    setSession(current);
    if (!current) router.replace("/login");
  }, [router]);

  return (
    <AppShell
      // Falls back to the product name until the household is known, so the
      // bar doesn't visibly re-label itself a frame later.
      areaName={session?.householdName ?? "Ledgr"}
      navGroups={buildNavGroups()}
      environmentLabel={process.env.NODE_ENV === "development" ? "DEV" : undefined}
    >
      {session ? (
        children
      ) : (
        <div className={styles.loading}>
          {/* Signed-out users are redirecting; no need to announce it. */}
          {session === undefined && <Spinner size="large" label="Loading…" />}
        </div>
      )}
    </AppShell>
  );
}
