"use client";

import { usePathname } from "next/navigation";
import NextLink from "next/link";
import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { LineHorizontal3Regular } from "@fluentui/react-icons";

/**
 * Dynamics 365 model-driven side navigation.
 *
 * Flat groups with a bold uppercase-ish caption and indented items — not a
 * collapsible tree. D365 uses group captions as labels rather than toggles,
 * which keeps every destination one click away.
 */

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon?: React.ReactElement;
  /** Count badge, e.g. unread mail. */
  badge?: number;
}

export interface NavGroup {
  /** Omitted for the ungrouped items pinned at the top, like Home. */
  title?: string;
  items: NavItem[];
}

const RAIL_WIDTH = "232px";
const RAIL_WIDTH_COLLAPSED = "48px";

const useStyles = makeStyles({
  rail: {
    width: RAIL_WIDTH,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRightWidth: "1px",
    borderRightStyle: "solid",
    borderRightColor: tokens.colorNeutralStroke2,
    overflowY: "auto",
    transitionProperty: "width",
    transitionDuration: tokens.durationNormal,
  },
  railCollapsed: { width: RAIL_WIDTH_COLLAPSED },

  hamburgerRow: {
    display: "flex",
    alignItems: "center",
    height: "44px",
    paddingLeft: "12px",
    flexShrink: 0,
  },
  hamburger: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: tokens.borderRadiusMedium,
    border: "none",
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground2,
    cursor: "pointer",
    ":hover": { backgroundColor: tokens.colorNeutralBackground3Hover },
  },

  group: { paddingBottom: "8px" },
  groupTitle: {
    padding: "10px 16px 4px",
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    whiteSpace: "nowrap",
    overflow: "hidden",
  },

  item: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    height: "36px",
    padding: "0 12px 0 16px",
    color: tokens.colorNeutralForeground1,
    textDecorationLine: "none",
    fontSize: tokens.fontSizeBase300,
    whiteSpace: "nowrap",
    overflow: "hidden",
    position: "relative",
    ":hover": { backgroundColor: tokens.colorNeutralBackground3Hover },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: tokens.colorStrokeFocus2,
      outlineOffset: "-2px",
    },
  },
  itemActive: {
    backgroundColor: tokens.colorNeutralBackground1,
    fontWeight: tokens.fontWeightSemibold,
    // D365 marks the selected row with a brand bar on the leading edge.
    "::before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: "4px",
      bottom: "4px",
      width: "3px",
      borderRadius: "0 2px 2px 0",
      backgroundColor: tokens.colorBrandForeground1,
    },
  },
  itemIcon: {
    flexShrink: 0,
    display: "inline-flex",
    fontSize: "20px",
    color: tokens.colorNeutralForeground2,
  },
  itemLabel: { overflow: "hidden", textOverflow: "ellipsis" },
  badge: {
    marginLeft: "auto",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  hiddenWhenCollapsed: { display: "none" },
});

export function SideNav({
  groups,
  collapsed = false,
  onToggle,
}: {
  groups: NavGroup[];
  collapsed?: boolean;
  onToggle?: () => void;
}): React.JSX.Element {
  const styles = useStyles();
  const pathname = usePathname();

  return (
    <nav
      className={mergeClasses(styles.rail, collapsed && styles.railCollapsed)}
      aria-label="Main navigation"
    >
      <div className={styles.hamburgerRow}>
        <button
          type="button"
          className={styles.hamburger}
          onClick={onToggle}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
        >
          <LineHorizontal3Regular />
        </button>
      </div>

      {groups.map((group, index) => (
        <div key={group.title ?? `group-${index}`} className={styles.group}>
          {group.title && !collapsed && <div className={styles.groupTitle}>{group.title}</div>}

          {group.items.map((item) => {
            // Prefix match so a detail route keeps its parent highlighted,
            // but "/" must match exactly or it would light up everywhere.
            const active =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));

            return (
              <NextLink
                key={item.key}
                href={item.href}
                className={mergeClasses(styles.item, active && styles.itemActive)}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
              >
                {item.icon && <span className={styles.itemIcon}>{item.icon}</span>}
                <span
                  className={mergeClasses(
                    styles.itemLabel,
                    collapsed && styles.hiddenWhenCollapsed,
                  )}
                >
                  {item.label}
                </span>
                {item.badge !== undefined && item.badge > 0 && !collapsed && (
                  <span className={styles.badge}>{item.badge}</span>
                )}
              </NextLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
