"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Body1, Button, Title2, makeStyles, tokens } from "@fluentui/react-components";
import type { SessionUser } from "@ledgr/contracts";
import { clearSession, getRefreshToken, getSessionUser } from "../../lib/session";
import { authApi } from "../../lib/api-client";

const useStyles = makeStyles({
  page: { padding: "32px", display: "flex", flexDirection: "column", gap: "16px" },
  card: {
    padding: "24px",
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground2,
    maxWidth: "560px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
});

/** Placeholder until the mail client lands — proves the session round-trip works. */
export default function MailPage(): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const session = getSessionUser();
    if (!session) {
      router.replace("/login");
      return;
    }
    setUser(session);
  }, [router]);

  async function signOut(): Promise<void> {
    const refreshToken = getRefreshToken();
    // Revoke server-side before clearing locally, so a stolen refresh token
    // doesn't outlive the sign-out.
    if (refreshToken) await authApi.logout(refreshToken).catch(() => undefined);
    clearSession();
    router.replace("/login");
  }

  if (!user) return <div className={styles.page} />;

  return (
    <div className={styles.page}>
      <Title2 as="h1">Signed in</Title2>
      <div className={styles.card}>
        <Body1>
          <strong>{user.displayName}</strong> — {user.email}
        </Body1>
        <Body1>
          Household: <strong>{user.householdName}</strong> ({user.role})
        </Body1>
        <Body1 style={{ color: tokens.colorNeutralForeground3 }}>
          The mail client lands here next: connect a mailbox, then inbox, threads and compose.
        </Body1>
      </div>
      <div>
        <Button onClick={signOut}>Sign out</Button>
      </div>
    </div>
  );
}
