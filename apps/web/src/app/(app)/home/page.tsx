"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import {
  AddRegular,
  ArrowSyncRegular,
  BuildingShopRegular,
  CheckmarkCircleFilled,
  MailRegular,
  MoneyRegular,
  ReceiptRegular,
  DocumentBulletListRegular,
} from "@fluentui/react-icons";
import type { SessionUser } from "@ledgr/contracts";
import { Body1, Button, makeStyles, tokens, type CommandBarItem } from "../../../components/ui";
import { Panel, PanelGrid, PageHeader, StatTile, StatTileRow } from "../../../components/shell";
import { getSessionUser } from "../../../lib/session";

const useStyles = makeStyles({
  body: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px 32px",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  setup: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "20px",
    marginBottom: "16px",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    borderLeftWidth: "3px",
    borderLeftStyle: "solid",
    borderLeftColor: tokens.colorBrandForeground1,
  },
  setupTitle: { fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  steps: { display: "flex", flexDirection: "column", gap: "10px", margin: 0, padding: 0 },
  step: { display: "flex", alignItems: "flex-start", gap: "10px", listStyleType: "none" },
  stepMark: {
    flexShrink: 0,
    marginTop: "2px",
    fontSize: "16px",
    color: tokens.colorNeutralForeground4,
    display: "inline-flex",
  },
  stepDone: { color: tokens.colorPaletteGreenForeground1 },
  stepText: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
  stepLabel: { fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold },
  stepHint: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" },
  emptyLink: { color: tokens.colorBrandForegroundLink, textDecorationLine: "none" },
});

/**
 * Ledgr home dashboard.
 *
 * Everything reads zero until a mailbox is connected, so the page leads with a
 * setup checklist rather than a wall of empty tiles. A dashboard that shows
 * nothing and explains nothing is the worst possible first screen.
 *
 * Counts are hard-zero for now: the endpoints that feed them arrive with the
 * mail sync and finance phases. They are not fabricated — showing invented
 * numbers on a finance tool would be actively harmful.
 */
export default function HomePage(): React.JSX.Element {
  const styles = useStyles();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUser(getSessionUser());
  }, []);

  const commands: CommandBarItem[] = [
    {
      key: "connect",
      text: "Connect mailbox",
      icon: <MailRegular />,
      title: "Connect a mailbox",
      description: "Add a Gmail, Outlook or IMAP account.",
      appearance: "primary",
    },
    { key: "entity", text: "New company", icon: <BuildingShopRegular />, title: "New company" },
    { key: "bill", text: "New bill", icon: <ReceiptRegular />, title: "New bill" },
    { key: "refresh", text: "Refresh", icon: <ArrowSyncRegular />, title: "Refresh" },
  ];

  // Ordered by what unblocks the most: no mailbox means no messages, no
  // receipts, and nothing to file against a vendor.
  const steps = [
    {
      key: "account",
      done: true,
      label: "Create your household",
      hint: user ? `${user.householdName} — you're the owner.` : "Done.",
    },
    {
      key: "mailbox",
      done: false,
      label: "Connect a mailbox",
      hint: "Gmail, Outlook or any IMAP server. Your correspondence starts flowing in.",
    },
    {
      key: "categories",
      done: false,
      label: "Add what you're tracking",
      hint: "Power, broadband, insurance — the things that outlive whoever supplies them.",
    },
    {
      key: "vendors",
      done: false,
      label: "Link a supplier to a category",
      hint: "This is the bit that keeps your spend history intact when you switch providers.",
    },
  ];

  return (
    <>
      <PageHeader
        title="Home"
        subtitle={user?.householdName ?? "Dashboard"}
        onBack={null}
        commands={commands}
      />

      <div className={styles.body}>
        <div className={styles.setup}>
          <span className={styles.setupTitle}>Get set up</span>
          <ul className={styles.steps}>
            {steps.map((step) => (
              <li key={step.key} className={styles.step}>
                <span
                  className={`${styles.stepMark} ${step.done ? styles.stepDone : ""}`}
                  aria-hidden="true"
                >
                  {step.done ? <CheckmarkCircleFilled /> : "○"}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepLabel}>{step.label}</span>
                  <span className={styles.stepHint}>{step.hint}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <Button appearance="primary" icon={<MailRegular />}>
              Connect a mailbox
            </Button>
            <Button icon={<AddRegular />}>Add a category</Button>
          </div>
        </div>

        <StatTileRow>
          <StatTile label="Unread mail" value={0} href="/mail" icon={<MailRegular />} />
          <StatTile
            label="Receipts to review"
            value={0}
            href="/review"
            icon={<ReceiptRegular />}
            needsAttention
          />
          <StatTile
            label="Open cases"
            value={0}
            href="/cases"
            icon={<DocumentBulletListRegular />}
          />
          <StatTile
            label="Spend this month"
            value="—"
            caption="Once bills are recorded"
            href="/spend"
            icon={<MoneyRegular />}
          />
        </StatTileRow>

        <PanelGrid>
          <Panel
            title="Recent mail"
            seeAllHref="/mail"
            empty={
              <>
                No mailbox connected yet.{" "}
                <NextLink href="/settings/accounts" className={styles.emptyLink}>
                  Connect one
                </NextLink>{" "}
                to see your mail here.
              </>
            }
          />

          <Panel
            title="Needs attention"
            empty="Nothing needs you right now — no overdue bills, no waiting replies."
          />

          <Panel
            title="Upcoming bills"
            seeAllHref="/bills"
            empty="No subscriptions yet, so nothing is expected."
          />

          <Panel
            title="Spend by category"
            seeAllHref="/spend"
            empty="Record a few bills and this becomes a chart you can actually use."
          />
        </PanelGrid>

        <Body1
          style={{ display: "block", marginTop: "16px", color: tokens.colorNeutralForeground4 }}
        >
          Ledgr is pre-alpha — mail sync, receipt extraction and the finance core are still landing.
        </Body1>
      </div>
    </>
  );
}
