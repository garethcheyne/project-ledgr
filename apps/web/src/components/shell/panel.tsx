"use client";

import NextLink from "next/link";
import { makeStyles, tokens } from "@fluentui/react-components";

/**
 * Dashboard panel — the D365 dashboard's boxed sub-grid: a titled container
 * with an optional "see all" link and an empty state for when it has nothing
 * to show.
 */

const useStyles = makeStyles({
  panel: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
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
    overflow: "hidden",
  },
  head: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 16px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  title: { fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold },
  seeAll: {
    marginLeft: "auto",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorBrandForegroundLink,
    textDecorationLine: "none",
    ":hover": { textDecorationLine: "underline" },
  },
  body: { padding: "8px 0", minHeight: "80px" },
  empty: {
    padding: "24px 16px",
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  grid: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "1fr",
    "@media (min-width: 1000px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  },
});

export function PanelGrid({ children }: { children: React.ReactNode }): React.JSX.Element {
  const styles = useStyles();
  return <div className={styles.grid}>{children}</div>;
}

export function Panel({
  title,
  seeAllHref,
  seeAllLabel = "See all",
  empty,
  children,
}: {
  title: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  /** Rendered instead of children when there's nothing yet. */
  empty?: React.ReactNode;
  children?: React.ReactNode;
}): React.JSX.Element {
  const styles = useStyles();
  const isEmpty = !children;

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        {seeAllHref && (
          <NextLink href={seeAllHref} className={styles.seeAll}>
            {seeAllLabel}
          </NextLink>
        )}
      </div>
      <div className={styles.body}>
        {isEmpty ? <div className={styles.empty}>{empty ?? "Nothing here yet."}</div> : children}
      </div>
    </section>
  );
}
