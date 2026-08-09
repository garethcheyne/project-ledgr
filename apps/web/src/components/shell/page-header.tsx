"use client";

import { useRouter } from "next/navigation";
import { makeStyles, mergeClasses, tokens, Tab, TabList } from "@fluentui/react-components";
import { ArrowLeftRegular } from "@fluentui/react-icons";
import { CommandBar, type CommandBarItem } from "fluentui-extended";

/**
 * Dynamics 365 record header: title block on the left, record-level fields and
 * commands on the right, tabs underneath.
 *
 * The layout is deliberately faithful to D365 — the title carries a dirty/saved
 * marker beside it, the entity name sits below as a subtitle, and the command
 * bar is right-aligned on the same row as the title rather than above it.
 */

const useStyles = makeStyles({
  header: {
    flexShrink: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  topRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    padding: "12px 20px 0",
    flexWrap: "wrap",
  },
  back: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    marginTop: "2px",
    border: "none",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground2,
    fontSize: "20px",
    cursor: "pointer",
    flexShrink: 0,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  titleBlock: { minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" },
  titleRow: { display: "flex", alignItems: "baseline", gap: "8px", minWidth: 0 },
  title: {
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase600,
    color: tokens.colorNeutralForeground1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  savedState: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
  },
  unsaved: { color: tokens.colorPaletteDarkOrangeForeground1 },
  subtitle: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },

  headerRight: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
  },
  /** Record-level fields shown in the header, e.g. D365's Status column. */
  headerFields: { display: "flex", alignItems: "center", gap: "20px" },
  headerField: { display: "flex", flexDirection: "column", gap: "0px", minWidth: "90px" },
  headerFieldLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    order: 2,
  },
  headerFieldValue: { order: 1 },

  tabRow: { padding: "4px 20px 0" },
});

export interface HeaderField {
  label: string;
  /** Rendered above the label, matching D365's value-over-label arrangement. */
  value: React.ReactNode;
}

export interface PageTab {
  value: string;
  label: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** D365 shows "- Saved" / "- Unsaved changes" beside the record title. */
  savedState?: "saved" | "unsaved" | "new";
  headerFields?: HeaderField[];
  commands?: CommandBarItem[];
  farCommands?: CommandBarItem[];
  tabs?: PageTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  /** Defaults to router.back(). Pass null to hide the arrow entirely. */
  onBack?: (() => void) | null;
}

const SAVED_LABEL: Record<NonNullable<PageHeaderProps["savedState"]>, string> = {
  saved: "- Saved",
  unsaved: "- Unsaved changes",
  new: "- New",
};

export function PageHeader({
  title,
  subtitle,
  savedState,
  headerFields,
  commands,
  farCommands,
  tabs,
  activeTab,
  onTabChange,
  onBack,
}: PageHeaderProps): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();

  return (
    <div className={styles.header}>
      <div className={styles.topRow}>
        {onBack !== null && (
          <button
            type="button"
            className={styles.back}
            aria-label="Back"
            onClick={onBack ?? (() => router.back())}
          >
            <ArrowLeftRegular />
          </button>
        )}

        <div className={styles.titleBlock}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {savedState && (
              <span
                className={mergeClasses(
                  styles.savedState,
                  savedState === "unsaved" && styles.unsaved,
                )}
              >
                {SAVED_LABEL[savedState]}
              </span>
            )}
          </div>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>

        <div className={styles.headerRight}>
          {headerFields && headerFields.length > 0 && (
            <div className={styles.headerFields}>
              {headerFields.map((field) => (
                <div key={field.label} className={styles.headerField}>
                  <div className={styles.headerFieldValue}>{field.value}</div>
                  <span className={styles.headerFieldLabel}>{field.label}</span>
                </div>
              ))}
            </div>
          )}

          {commands && commands.length > 0 && (
            <CommandBar items={commands} farItems={farCommands} />
          )}
        </div>
      </div>

      {tabs && tabs.length > 0 && (
        <div className={styles.tabRow}>
          <TabList
            selectedValue={activeTab}
            onTabSelect={(_, data) => onTabChange?.(String(data.value))}
          >
            {tabs.map((tab) => (
              <Tab key={tab.value} value={tab.value}>
                {tab.label}
              </Tab>
            ))}
          </TabList>
        </div>
      )}
    </div>
  );
}
