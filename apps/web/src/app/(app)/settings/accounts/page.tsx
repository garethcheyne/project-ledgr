"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AddRegular,
  ArrowSyncRegular,
  CheckmarkCircleFilled,
  DeleteRegular,
  MailRegular,
  WarningFilled,
} from "@fluentui/react-icons";
import type { MailAccountSummary } from "@ledgr/contracts";
import {
  Body1,
  Button,
  MessageBar,
  MessageBarBody,
  Spinner,
  makeStyles,
  tokens,
  type CommandBarItem,
} from "../../../../components/ui";
import { PageHeader } from "../../../../components/shell";
import { ApiRequestError, mailApi } from "../../../../lib/api-client";
import { ConnectForm } from "./connect-form";

const useStyles = makeStyles({
  body: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px 32px",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  centre: { display: "flex", justifyContent: "center", padding: "48px" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  account: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "14px 18px",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    borderTopWidth: "1px",
    borderRightWidth: "1px",
    borderBottomWidth: "1px",
    borderLeftWidth: "1px",
    borderTopStyle: "solid",
    borderRightStyle: "solid",
    borderBottomStyle: "solid",
    borderLeftStyle: "solid",
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftColor: tokens.colorNeutralStroke2,
  },
  icon: { fontSize: "24px", color: tokens.colorNeutralForeground3, flexShrink: 0 },
  info: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 },
  name: { fontWeight: tokens.fontWeightSemibold },
  meta: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
  ok: { color: tokens.colorPaletteGreenForeground1 },
  warn: { color: tokens.colorPaletteDarkOrangeForeground1 },
  empty: {
    padding: "40px 24px",
    textAlign: "center",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    alignItems: "center",
  },
});

export default function MailAccountsPage(): React.JSX.Element {
  const styles = useStyles();
  const [accounts, setAccounts] = useState<MailAccountSummary[] | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAccounts(await mailApi.listAccounts());
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Couldn't load accounts.");
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function disconnect(account: MailAccountSummary): Promise<void> {
    // Destructive and not obviously reversible — the credentials are gone and
    // must be re-entered, so confirm rather than acting on a stray click.
    if (
      !window.confirm(`Disconnect ${account.emailAddress}? You'll need to re-enter the password.`)
    )
      return;
    try {
      await mailApi.disconnect(account.id);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Couldn't disconnect.");
    }
  }

  const commands: CommandBarItem[] = [
    {
      key: "add",
      text: "Connect mailbox",
      icon: <AddRegular />,
      title: "Connect a mailbox",
      appearance: "primary",
      onClick: () => setConnecting(true),
      disabled: connecting,
    },
    {
      key: "refresh",
      text: "Refresh",
      icon: <ArrowSyncRegular />,
      title: "Refresh",
      onClick: () => void load(),
    },
  ];

  return (
    <>
      <PageHeader title="Mail accounts" subtitle="Settings" onBack={null} commands={commands} />

      <div className={styles.body}>
        {error && (
          <MessageBar intent="error" style={{ marginBottom: "12px" }}>
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        {connecting && (
          <ConnectForm
            onCancel={() => setConnecting(false)}
            onConnected={() => {
              setConnecting(false);
              void load();
            }}
          />
        )}

        {!connecting && accounts === null && (
          <div className={styles.centre}>
            <Spinner label="Loading accounts…" />
          </div>
        )}

        {!connecting && accounts?.length === 0 && (
          <div className={styles.empty}>
            <MailRegular className={styles.icon} />
            <Body1 style={{ fontWeight: 600 }}>No mailboxes connected</Body1>
            <Body1 className={styles.meta}>
              Connect Gmail, iCloud, Fastmail or any IMAP server to start seeing your mail in Ledgr.
            </Body1>
            <Button appearance="primary" icon={<AddRegular />} onClick={() => setConnecting(true)}>
              Connect a mailbox
            </Button>
          </div>
        )}

        {!connecting && accounts && accounts.length > 0 && (
          <div className={styles.list}>
            {accounts.map((account) => {
              const healthy = account.status === "CONNECTED" && !account.lastSyncError;
              return (
                <div key={account.id} className={styles.account}>
                  <MailRegular className={styles.icon} />
                  <div className={styles.info}>
                    <span className={styles.name}>{account.displayName}</span>
                    <span className={styles.meta}>
                      {account.emailAddress} · {account.provider} ·{" "}
                      {account.supportsIdle ? "push" : "polling"}
                      {account.folderCount > 0 && ` · ${account.folderCount} folders`}
                    </span>
                    {account.lastSyncError && (
                      <span className={`${styles.meta} ${styles.warn}`}>
                        {account.lastSyncError}
                      </span>
                    )}
                  </div>
                  <span className={healthy ? styles.ok : styles.warn}>
                    {healthy ? <CheckmarkCircleFilled /> : <WarningFilled />}
                  </span>
                  <Button
                    appearance="subtle"
                    icon={<DeleteRegular />}
                    aria-label={`Disconnect ${account.emailAddress}`}
                    onClick={() => void disconnect(account)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
