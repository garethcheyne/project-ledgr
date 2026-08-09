"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowSyncRegular,
  AttachRegular,
  MailRegular,
  MailReadRegular,
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
import { MessageBody } from "../../../components/mail/message-body";
import { LinkCompany } from "../../../components/mail/link-company";
import { ResizeHandle, useResizableWidth } from "../../../components/mail/resizable";
import { ApiRequestError, mailApi, type MessageDetail } from "../../../lib/api-client";

const FOLDER_BOUNDS = { min: 140, max: 400 };
const LIST_BOUNDS = { min: 260, max: 900 };

const useStyles = makeStyles({
  layout: {
    flex: 1,
    display: "flex",
    minHeight: 0,
    backgroundColor: tokens.colorNeutralBackground3,
  },

  folders: {
    display: "flex",
    flexDirection: "column",
    padding: "8px 0",
    flexShrink: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    overflowY: "auto",
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
  folderName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 },
  folderCount: { color: tokens.colorNeutralForeground3, fontSize: "12px", flexShrink: 0 },

  list: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    flexShrink: 0,
    overflowY: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
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
  // Unread is the only bold thing, so the eye finds it immediately.
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
  star: { color: tokens.colorPaletteMarigoldForeground1 },

  reader: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  readerHead: {
    padding: "16px 20px 12px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: tokens.colorNeutralStroke2,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  readerSubject: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
  readerMeta: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
  readerActions: { display: "flex", gap: "6px", flexWrap: "wrap" },
  readerBody: { padding: "16px 20px 40px" },
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

  const [folderWidth, setFolderWidth] = useResizableWidth("ledgr.mail.folderW", 190, FOLDER_BOUNDS);
  const [listWidth, setListWidth] = useResizableWidth("ledgr.mail.listW", 420, LIST_BOUNDS);

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
      // Only folders being synced are worth showing; the rest are empty by
      // definition and would just be clutter.
      const visible = list.filter((folder) => folder.isSubscribed || folder.totalCount > 0);
      setFolders(visible);
      setFolderId((current) => current ?? visible.find((f) => f.role === "INBOX")?.id ?? null);
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

  const patchRow = useCallback((id: string, patch: Partial<MessageListItem>) => {
    setMessages(
      (current) => current?.map((m) => (m.id === id ? { ...m, ...patch } : m)) ?? current,
    );
  }, []);

  async function openMessage(item: MessageListItem): Promise<void> {
    try {
      const detail = await mailApi.message(item.id);
      setSelected(detail);
      if (!item.isRead) {
        await mailApi.markRead(item.id, true);
        patchRow(item.id, { isRead: true });
        await loadFolders();
      }
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Couldn't open that message.");
    }
  }

  async function toggleStar(item: MessageListItem | MessageDetail): Promise<void> {
    const next = !item.isStarred;
    // Optimistic: the provider round-trip takes a moment and a star should feel
    // instant. Reverted below if the mailbox rejects it.
    patchRow(item.id, { isStarred: next });
    setSelected((current) => (current?.id === item.id ? { ...current, isStarred: next } : current));
    try {
      await mailApi.setStarred(item.id, next);
    } catch {
      patchRow(item.id, { isStarred: !next });
      setSelected((current) =>
        current?.id === item.id ? { ...current, isStarred: !next } : current,
      );
      setError("Couldn't update the star on the mail server.");
    }
  }

  async function toggleRead(item: MessageDetail): Promise<void> {
    const next = !item.isRead;
    await mailApi.markRead(item.id, next);
    patchRow(item.id, { isRead: next });
    setSelected({ ...item, isRead: next });
    await loadFolders();
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
            ? [
                { label: "Unread", value: <span>{activeFolder.unreadCount}</span> },
                { label: "Total", value: <span>{activeFolder.totalCount}</span> },
              ]
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
        <nav className={styles.folders} style={{ width: folderWidth }} aria-label="Mail folders">
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
              <span className={styles.folderName}>{folder.name}</span>
              {folder.unreadCount > 0 && (
                <span className={styles.folderCount}>{folder.unreadCount}</span>
              )}
            </button>
          ))}
        </nav>

        <ResizeHandle
          label="Resize folder list"
          currentWidth={folderWidth}
          min={FOLDER_BOUNDS.min}
          max={FOLDER_BOUNDS.max}
          onResize={setFolderWidth}
        />

        <div className={styles.list} style={{ width: listWidth }}>
          {messages === null && (
            <div className={styles.centre}>
              <Spinner label="Loading…" />
            </div>
          )}

          {messages?.length === 0 && (
            <div className={styles.centre}>
              <div className={styles.empty}>
                <MailRegular style={{ fontSize: "32px" }} className={styles.muted} />
                <Body1 style={{ fontWeight: 600 }}>No messages here</Body1>
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
            <div
              key={message.id}
              className={mergeClasses(
                styles.row,
                selected?.id === message.id && styles.rowSelected,
              )}
              onClick={() => void openMessage(message)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void openMessage(message);
                }
              }}
            >
              <span className={styles.rowTop}>
                <span
                  className={mergeClasses(styles.sender, !message.isRead && styles.unread)}
                  title={message.fromAddress}
                >
                  {message.fromName || message.fromAddress || "(unknown sender)"}
                </span>
                {message.hasAttachments && <AttachRegular className={styles.muted} />}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={message.isStarred ? "Unstar" : "Star"}
                  className={message.isStarred ? styles.star : styles.muted}
                  onClick={(event) => {
                    // Starring must not also open the message.
                    event.stopPropagation();
                    void toggleStar(message);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.stopPropagation();
                      event.preventDefault();
                      void toggleStar(message);
                    }
                  }}
                >
                  {message.isStarred ? <StarFilled /> : <StarRegular />}
                </span>
                <span className={styles.when}>{formatWhen(message.sentAt)}</span>
              </span>
              <span className={mergeClasses(styles.subject, !message.isRead && styles.unread)}>
                {message.subject}
              </span>
              <span className={styles.snippet}>{message.snippet}</span>
            </div>
          ))}
        </div>

        <ResizeHandle
          label="Resize message list"
          currentWidth={listWidth}
          min={LIST_BOUNDS.min}
          max={LIST_BOUNDS.max}
          onResize={setListWidth}
        />

        <div className={styles.reader}>
          {selected ? (
            <>
              <div className={styles.readerHead}>
                <span className={styles.readerSubject}>{selected.subject}</span>
                <span className={styles.readerMeta}>
                  {selected.fromName ? `${selected.fromName} · ` : ""}
                  {selected.fromAddress} · {new Date(selected.sentAt).toLocaleString()}
                </span>
                <span className={styles.readerMeta}>
                  To {selected.to.map((address) => address.address).join(", ") || "—"}
                </span>

                <div className={styles.readerActions}>
                  <Button
                    size="small"
                    icon={selected.isStarred ? <StarFilled /> : <StarRegular />}
                    onClick={() => void toggleStar(selected)}
                  >
                    {selected.isStarred ? "Starred" : "Star"}
                  </Button>
                  <Button
                    size="small"
                    icon={selected.isRead ? <MailUnreadRegular /> : <MailReadRegular />}
                    onClick={() => void toggleRead(selected)}
                  >
                    Mark {selected.isRead ? "unread" : "read"}
                  </Button>
                </div>

                <LinkCompany
                  messageId={selected.id}
                  fromAddress={selected.fromAddress}
                  linkedEntityId={selected.entityId}
                  linkedEntityName={selected.entityName}
                  onChanged={() => void openMessage(selected)}
                />
              </div>

              <div className={styles.readerBody}>
                <MessageBody
                  html={selected.bodyHtml}
                  text={selected.bodyText}
                  snippet={selected.snippet}
                />
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
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.getFullYear() === now.getFullYear())
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
