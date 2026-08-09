"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowSyncRegular,
  AttachRegular,
  MailRegular,
  MailUnreadRegular,
  StarFilled,
  StarRegular,
} from "@fluentui/react-icons";
import type { MailFolderSummary, MessageListItem } from "@ledgr/contracts";
import {
  Body1,
  Button,
  MessageBar,
  MessageBarBody,
  Spinner,
  makeStyles,
  mergeClasses,
  tokens,
  type CommandBarItem,
} from "../../../components/ui";
import { PageHeader } from "../../../components/shell";
import { ApiRequestError, mailApi, type MessageDetail } from "../../../lib/api-client";

const useStyles = makeStyles({
  layout: {
    flex: 1,
    display: "grid",
    minHeight: 0,
    gridTemplateColumns: "1fr",
    backgroundColor: tokens.colorNeutralBackground3,
    // Three panes only when there's room; below that the list stands alone and
    // opening a message replaces it.
    "@media (min-width: 1000px)": { gridTemplateColumns: "200px minmax(320px, 1fr)" },
    "@media (min-width: 1400px)": { gridTemplateColumns: "200px 380px 1fr" },
  },
  folders: {
    display: "none",
    "@media (min-width: 1000px)": {
      display: "flex",
      flexDirection: "column",
      padding: "8px 0",
      backgroundColor: tokens.colorNeutralBackground1,
      borderRightWidth: "1px",
      borderRightStyle: "solid",
      borderRightColor: tokens.colorNeutralStroke2,
      overflowY: "auto",
    },
  },
  folder: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 14px",
    fontSize: tokens.fontSizeBase300,
    cursor: "pointer",
    border: "none",
    background: "none",
    textAlign: "left",
    color: tokens.colorNeutralForeground1,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  folderActive: {
    backgroundColor: tokens.colorNeutralBackground2Selected,
    fontWeight: tokens.fontWeightSemibold,
  },
  folderCount: { marginLeft: "auto", color: tokens.colorNeutralForeground3, fontSize: "12px" },

  list: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    overflowY: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRightWidth: "1px",
    borderRightStyle: "solid",
    borderRightColor: tokens.colorNeutralStroke2,
  },
  row: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "10px 14px",
    cursor: "pointer",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: tokens.colorNeutralStroke3,
    border: "none",
    background: "none",
    textAlign: "left",
    width: "100%",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  rowSelected: { backgroundColor: tokens.colorNeutralBackground2Selected },
  rowTop: { display: "flex", alignItems: "center", gap: "6px" },
  sender: {
    fontSize: tokens.fontSizeBase300,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    minWidth: 0,
  },
  // Unread is the only thing bold, so the eye finds it immediately.
  unread: { fontWeight: tokens.fontWeightBold },
  when: { fontSize: "11px", color: tokens.colorNeutralForeground3, flexShrink: 0 },
  subject: {
    fontSize: tokens.fontSizeBase300,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  snippet: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  reader: {
    display: "none",
    "@media (min-width: 1400px)": {
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      overflowY: "auto",
      backgroundColor: tokens.colorNeutralBackground1,
    },
  },
  readerHead: {
    padding: "16px 20px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: tokens.colorNeutralStroke2,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  readerSubject: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
  readerMeta: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
  readerBody: {
    padding: "16px 20px",
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase400,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  centre: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px",
    textAlign: "center",
  },
  empty: { display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" },
  muted: { color: tokens.colorNeutralForeground3 },
});

export default function MailPage(): React.JSX.Element {
  const styles = useStyles();

  const [folders, setFolders] = useState<MailFolderSummary[] | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageListItem[] | null>(null);
  const [selected, setSelected] = useState<MessageDetail | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFolders = useCallback(async () => {
    try {
      const list = await mailApi.folders();
      setFolders(list);
      // Default to the inbox rather than whichever folder sorts first.
      setFolderId((current) => current ?? list.find((f) => f.role === "INBOX")?.id ?? null);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Couldn't load folders.");
      setFolders([]);
    }
  }, []);

  const loadMessages = useCallback(async (targetFolderId: string | null) => {
    try {
      setMessages(await mailApi.messages({ folderId: targetFolderId ?? undefined, limit: 100 }));
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Couldn't load messages.");
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    if (folders) void loadMessages(folderId);
  }, [folders, folderId, loadMessages]);

  async function openMessage(item: MessageListItem): Promise<void> {
    try {
      setSelected(await mailApi.message(item.id));
      if (!item.isRead) {
        await mailApi.markRead(item.id, true);
        // Update in place rather than refetching the whole list for one flag.
        setMessages(
          (current) =>
            current?.map((m) => (m.id === item.id ? { ...m, isRead: true } : m)) ?? current,
        );
        setFolders(
          (current) =>
            current?.map((f) =>
              f.id === folderId ? { ...f, unreadCount: Math.max(0, f.unreadCount - 1) } : f,
            ) ?? current,
        );
      }
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Couldn't open that message.");
    }
  }

  async function sync(): Promise<void> {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const accounts = await mailApi.listAccounts();
      if (accounts.length === 0) {
        setError("No mailbox connected yet.");
        return;
      }

      let stored = 0;
      let more = false;
      const problems: string[] = [];
      for (const account of accounts) {
        const result = await mailApi.sync(account.id);
        stored += result.messagesStored;
        more ||= result.hasMore;
        problems.push(...result.errors);
      }

      setNotice(
        stored === 0
          ? "Already up to date."
          : `Synced ${stored} message${stored === 1 ? "" : "s"}.${
              // The first pass is capped so an enormous mailbox doesn't stall;
              // say so rather than letting it look like everything arrived.
              more ? " More remain — sync again to continue." : ""
            }`,
      );
      if (problems.length > 0) setError(problems.join("; "));

      await loadFolders();
      await loadMessages(folderId);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  const commands: CommandBarItem[] = useMemo(
    () => [
      {
        key: "sync",
        text: syncing ? "Syncing…" : "Sync",
        icon: <ArrowSyncRegular />,
        title: "Sync mail",
        description: "Fetch new messages from your connected mailboxes.",
        appearance: "primary",
        disabled: syncing,
        onClick: () => void sync(),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [syncing, folderId],
  );

  const activeFolder = folders?.find((f) => f.id === folderId);

  return (
    <>
      <PageHeader
        title={activeFolder?.name ?? "Mail"}
        subtitle="Mail"
        onBack={null}
        commands={commands}
        headerFields={
          activeFolder
            ? [{ label: "Unread", value: <span>{activeFolder.unreadCount}</span> }]
            : undefined
        }
      />

      {(error || notice) && (
        <div style={{ padding: "8px 16px 0" }}>
          {error && (
            <MessageBar intent="error">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}
          {notice && !error && (
            <MessageBar intent="success">
              <MessageBarBody>{notice}</MessageBarBody>
            </MessageBar>
          )}
        </div>
      )}

      <div className={styles.layout}>
        <nav className={styles.folders} aria-label="Mail folders">
          {folders?.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className={mergeClasses(styles.folder, folder.id === folderId && styles.folderActive)}
              onClick={() => {
                setFolderId(folder.id);
                setSelected(null);
              }}
            >
              {folder.unreadCount > 0 ? <MailUnreadRegular /> : <MailRegular />}
              <span>{folder.name}</span>
              {folder.unreadCount > 0 && (
                <span className={styles.folderCount}>{folder.unreadCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className={styles.list}>
          {messages === null && (
            <div className={styles.centre}>
              <Spinner label="Loading…" />
            </div>
          )}

          {messages?.length === 0 && (
            <div className={styles.centre}>
              <div className={styles.empty}>
                <MailRegular style={{ fontSize: "32px" }} className={styles.muted} />
                <Body1 style={{ fontWeight: 600 }}>No messages yet</Body1>
                <Body1 className={styles.muted}>
                  Hit <strong>Sync</strong> to pull mail from your connected mailbox.
                </Body1>
                <Button
                  appearance="primary"
                  icon={<ArrowSyncRegular />}
                  onClick={() => void sync()}
                  disabled={syncing}
                >
                  {syncing ? "Syncing…" : "Sync now"}
                </Button>
              </div>
            </div>
          )}

          {messages?.map((message) => (
            <button
              key={message.id}
              type="button"
              className={mergeClasses(
                styles.row,
                selected?.id === message.id && styles.rowSelected,
              )}
              onClick={() => void openMessage(message)}
            >
              <span className={styles.rowTop}>
                <span
                  className={mergeClasses(styles.sender, !message.isRead && styles.unread)}
                  title={message.fromAddress}
                >
                  {message.fromName || message.fromAddress || "(unknown sender)"}
                </span>
                {message.isStarred && <StarFilled />}
                {message.hasAttachments && <AttachRegular />}
                <span className={styles.when}>{formatWhen(message.sentAt)}</span>
              </span>
              <span className={mergeClasses(styles.subject, !message.isRead && styles.unread)}>
                {message.subject}
              </span>
              <span className={styles.snippet}>{message.snippet}</span>
            </button>
          ))}
        </div>

        <div className={styles.reader}>
          {selected ? (
            <>
              <div className={styles.readerHead}>
                <span className={styles.readerSubject}>{selected.subject}</span>
                <span className={styles.readerMeta}>
                  {selected.fromName ? `${selected.fromName} · ` : ""}
                  {selected.fromAddress}
                </span>
                <span className={styles.readerMeta}>
                  To {selected.to.map((address) => address.address).join(", ") || "—"} ·{" "}
                  {new Date(selected.sentAt).toLocaleString()}
                </span>
              </div>
              {/* Plain text only for now. Rendering remote HTML safely needs
                  sanitising and image proxying, and doing it badly is a
                  tracking-pixel and XSS problem. */}
              <div className={styles.readerBody}>
                {selected.bodyText ?? selected.snippet ?? "(no text content)"}
              </div>
            </>
          ) : (
            <div className={styles.centre}>
              <Body1 className={styles.muted}>Select a message to read it.</Body1>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Today shows a time, this year a date, older includes the year. */
function formatWhen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.getFullYear() === now.getFullYear())
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
