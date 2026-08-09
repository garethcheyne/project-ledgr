"use client";

import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

/**
 * Dynamics 365 form body.
 *
 * D365 forms are column-based, with each field a label-left / control-right
 * row. That arrangement is what makes a dense form scannable — the labels form
 * a vertical rule the eye can run down, which a stacked label-above-field
 * layout loses.
 *
 * Columns collapse to a single column below 1100px, because a four-column
 * form on a laptop makes every control too narrow to use.
 */

const useStyles = makeStyles({
  body: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px 32px",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  section: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    // Griffel rejects the four-side border shorthands — per-side longhands
    // only, so the atomic-CSS rules stay independently overridable.
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
    padding: "16px 20px",
    marginBottom: "16px",
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "12px",
  },
  columns: {
    display: "grid",
    gap: "4px 32px",
    gridTemplateColumns: "1fr",
    "@media (min-width: 1100px)": { gridTemplateColumns: "repeat(var(--ledgr-cols, 2), 1fr)" },
  },
  column: { display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 },

  field: {
    display: "grid",
    // Fixed label column so labels align across rows regardless of length.
    gridTemplateColumns: "minmax(110px, 150px) 1fr",
    alignItems: "center",
    gap: "12px",
    minHeight: "32px",
    padding: "3px 0",
    "@media (max-width: 600px)": { gridTemplateColumns: "1fr", alignItems: "stretch" },
  },
  label: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
    display: "flex",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
  },
  labelText: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  required: { color: tokens.colorPaletteRedForeground1, flexShrink: 0 },
  locked: { color: tokens.colorNeutralForeground4, fontSize: "12px", flexShrink: 0 },
  control: { minWidth: 0 },
});

export function FormBody({ children }: { children: React.ReactNode }): React.JSX.Element {
  const styles = useStyles();
  return <div className={styles.body}>{children}</div>;
}

export function FormSection({
  title,
  columns = 2,
  children,
}: {
  title?: string;
  /** Column count at desktop widths. D365 forms commonly use 2–4. */
  columns?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}): React.JSX.Element {
  const styles = useStyles();
  return (
    <section className={styles.section}>
      {title && <div className={styles.sectionTitle}>{title}</div>}
      <div className={styles.columns} style={{ ["--ledgr-cols" as string]: String(columns) }}>
        {children}
      </div>
    </section>
  );
}

export function FormColumn({ children }: { children: React.ReactNode }): React.JSX.Element {
  const styles = useStyles();
  return <div className={styles.column}>{children}</div>;
}

export interface FormFieldProps {
  label: string;
  required?: boolean;
  /** Renders D365's padlock for system-maintained fields. */
  locked?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  required,
  locked,
  htmlFor,
  children,
  className,
}: FormFieldProps): React.JSX.Element {
  const styles = useStyles();
  return (
    <div className={mergeClasses(styles.field, className)}>
      <label className={styles.label} htmlFor={htmlFor}>
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
        <span className={styles.labelText}>{label}</span>
        {locked && (
          <span className={styles.locked} title="Read-only" aria-label="Read-only">
            🔒
          </span>
        )}
      </label>
      <div className={styles.control}>{children}</div>
    </div>
  );
}
