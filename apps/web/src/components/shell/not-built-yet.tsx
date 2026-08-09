"use client";

import { makeStyles, tokens } from "@fluentui/react-components";
import { PageHeader } from "./page-header";

/**
 * Placeholder for a navigable-but-unbuilt area.
 *
 * The alternative was leaving nav links pointing at 404s, which reads as a
 * broken app rather than an unfinished one. This keeps the shell intact and
 * says plainly what's missing and when it lands.
 *
 * Delete each usage as the real page arrives — `git grep NotBuiltYet` is the
 * remaining-work list.
 */

const useStyles = makeStyles({
  body: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  card: {
    maxWidth: "460px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  icon: { fontSize: "40px", color: tokens.colorNeutralForeground4 },
  title: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
  detail: { fontSize: tokens.fontSizeBase300, color: tokens.colorNeutralForeground3 },
  phase: {
    marginTop: "8px",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground4,
  },
});

export function NotBuiltYet({
  title,
  subtitle,
  detail,
  phase,
  icon,
}: {
  title: string;
  subtitle?: string;
  detail: string;
  /** Which roadmap phase delivers this, so the message isn't just "soon". */
  phase: string;
  icon?: React.ReactElement;
}): React.JSX.Element {
  const styles = useStyles();

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} onBack={null} />
      <div className={styles.body}>
        <div className={styles.card}>
          {icon && <span className={styles.icon}>{icon}</span>}
          <span className={styles.title}>Not built yet</span>
          <span className={styles.detail}>{detail}</span>
          <span className={styles.phase}>{phase}</span>
        </div>
      </div>
    </>
  );
}
