"use client";

import NextLink from "next/link";
import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

/**
 * Dashboard metric tile, in the Dynamics 365 idiom: a large value, a quiet
 * label, and the whole tile acting as a link to the underlying list.
 */

const useStyles = makeStyles({
  tile: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "16px 18px",
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
    color: tokens.colorNeutralForeground1,
    textDecorationLine: "none",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      borderTopColor: tokens.colorNeutralStroke1,
      borderRightColor: tokens.colorNeutralStroke1,
      borderBottomColor: tokens.colorNeutralStroke1,
      borderLeftColor: tokens.colorNeutralStroke1,
    },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: tokens.colorStrokeFocus2,
      outlineOffset: "2px",
    },
  },
  head: { display: "flex", alignItems: "center", gap: "8px" },
  icon: { fontSize: "16px", color: tokens.colorNeutralForeground3, display: "inline-flex" },
  label: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  value: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightHero700,
  },
  /** Zero is normal, not an alarm — keep it quiet. */
  zero: { color: tokens.colorNeutralForeground4 },
  attention: { color: tokens.colorPaletteDarkOrangeForeground1 },
  caption: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
});

export interface StatTileProps {
  label: string;
  value: number | string;
  caption?: string;
  href?: string;
  icon?: React.ReactElement;
  /** Highlights the value when non-zero — for queues that need clearing. */
  needsAttention?: boolean;
}

export function StatTile({
  label,
  value,
  caption,
  href,
  icon,
  needsAttention,
}: StatTileProps): React.JSX.Element {
  const styles = useStyles();
  const isZero = value === 0 || value === "0";

  const content = (
    <>
      <div className={styles.head}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.label}>{label}</span>
      </div>
      <span
        className={mergeClasses(
          styles.value,
          isZero && styles.zero,
          !isZero && needsAttention && styles.attention,
        )}
      >
        {value}
      </span>
      {caption && <span className={styles.caption}>{caption}</span>}
    </>
  );

  if (href) {
    return (
      <NextLink href={href} className={styles.tile}>
        {content}
      </NextLink>
    );
  }
  return <div className={styles.tile}>{content}</div>;
}

export function StatTileRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  const styles = useStatRowStyles();
  return <div className={styles.row}>{children}</div>;
}

const useStatRowStyles = makeStyles({
  row: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    marginBottom: "16px",
  },
});
