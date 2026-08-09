"use client";

import { makeStyles, tokens, SearchBox } from "@fluentui/react-components";
import { GridDotsRegular, SettingsRegular, QuestionCircleRegular } from "@fluentui/react-icons";
import { ThemeToggle } from "../theme-toggle";

/**
 * The Dynamics 365 top bar.
 *
 * Layout mirrors D365: waffle, product wordmark, area name, centred search,
 * then environment badge and utility icons on the right. Brand-coloured, so it
 * reads as chrome rather than page content.
 */

const useStyles = makeStyles({
  bar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    height: "48px",
    flexShrink: 0,
    paddingLeft: "4px",
    paddingRight: "12px",
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  iconButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    border: "none",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "transparent",
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: "20px",
    cursor: "pointer",
    ":hover": { backgroundColor: tokens.colorBrandBackgroundHover },
  },
  wordmark: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightBold,
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
  },
  divider: {
    width: "1px",
    height: "24px",
    backgroundColor: tokens.colorNeutralForegroundOnBrand,
    opacity: 0.35,
    flexShrink: 0,
  },
  areaName: {
    fontSize: tokens.fontSizeBase300,
    whiteSpace: "nowrap",
    // The area name is secondary to the product name beside it.
    opacity: 0.9,
  },
  searchWrap: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    minWidth: 0,
    // Search collapses on narrow screens rather than crushing the wordmark.
    "@media (max-width: 720px)": { display: "none" },
  },
  search: { width: "100%", maxWidth: "480px" },
  right: { display: "flex", alignItems: "center", gap: "2px", marginLeft: "auto" },
  environment: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: "0.04em",
    marginRight: "8px",
    whiteSpace: "nowrap",
    "@media (max-width: 900px)": { display: "none" },
  },
});

export interface AppBarProps {
  /** The functional area, e.g. "Mail" or "Finances". */
  areaName: string;
  /** Shown top-right, like D365's SANDBOX marker. Omit in production. */
  environmentLabel?: string;
  onSearch?: (query: string) => void;
  onAppLauncher?: () => void;
}

export function AppBar({
  areaName,
  environmentLabel,
  onSearch,
  onAppLauncher,
}: AppBarProps): React.JSX.Element {
  const styles = useStyles();

  return (
    <header className={styles.bar}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label="App launcher"
        onClick={onAppLauncher}
      >
        <GridDotsRegular />
      </button>

      <span className={styles.wordmark}>Ledgr</span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.areaName}>{areaName}</span>

      <div className={styles.searchWrap}>
        <SearchBox
          className={styles.search}
          appearance="filled-darker"
          placeholder="Search"
          onChange={(_, data) => onSearch?.(data.value)}
        />
      </div>

      <div className={styles.right}>
        {environmentLabel && <span className={styles.environment}>{environmentLabel}</span>}
        <ThemeToggle />
        <button type="button" className={styles.iconButton} aria-label="Settings">
          <SettingsRegular />
        </button>
        <button type="button" className={styles.iconButton} aria-label="Help">
          <QuestionCircleRegular />
        </button>
      </div>
    </header>
  );
}
