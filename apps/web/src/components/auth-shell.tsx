"use client";

import { makeStyles, tokens, Title2, Body1 } from "./ui";
import { ThemeToggle } from "./theme-toggle";

const useStyles = makeStyles({
  page: {
    minHeight: "100vh",
    display: "grid",
    // Single column on small screens; brand panel appears alongside from
    // 900px, where there's room for it without squeezing the form.
    gridTemplateColumns: "1fr",
    backgroundColor: tokens.colorNeutralBackground1,
    "@media (min-width: 900px)": {
      gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)",
    },
  },
  brand: {
    display: "none",
    "@media (min-width: 900px)": {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "48px",
      backgroundColor: tokens.colorBrandBackground2,
      color: tokens.colorNeutralForeground1,
    },
  },
  brandPoints: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    maxWidth: "380px",
  },
  point: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  wordmark: {
    fontSize: "28px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  formSide: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  topBar: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "12px 16px",
  },
  formArea: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 24px 48px",
  },
  formCard: {
    width: "100%",
    maxWidth: "400px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  footnote: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
});

/**
 * Two-panel shell shared by sign-in and registration, so the two pages can't
 * drift apart visually.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const styles = useStyles();

  return (
    <div className={styles.page}>
      <aside className={styles.brand}>
        <div className={styles.wordmark}>Ledgr</div>

        <div className={styles.brandPoints}>
          <div className={styles.point}>
            <Body1 style={{ fontWeight: 600 }}>Your mail, in context</Body1>
            <Body1>
              Read and reply without leaving — every message filed against the company it&apos;s
              about.
            </Body1>
          </div>
          <div className={styles.point}>
            <Body1 style={{ fontWeight: 600 }}>
              Switching providers doesn&apos;t erase history
            </Body1>
            <Body1>
              Ledgr tracks <em>what</em> you pay for separately from <em>who</em> you pay, so
              changing power company keeps your spending continuous.
            </Body1>
          </div>
          <div className={styles.point}>
            <Body1 style={{ fontWeight: 600 }}>Encrypted, and yours</Body1>
            <Body1>Self-hosted, open source, encrypted at rest.</Body1>
          </div>
        </div>

        <Body1 className={styles.footnote}>AGPL-3.0 · self-hosted</Body1>
      </aside>

      <main className={styles.formSide}>
        <div className={styles.topBar}>
          <ThemeToggle />
        </div>

        <div className={styles.formArea}>
          <div className={styles.formCard}>
            <header className={styles.header}>
              <Title2 as="h1">{title}</Title2>
              <Body1 className={styles.footnote}>{subtitle}</Body1>
            </header>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
