"use client";

import { useState } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { AppBar } from "./app-bar";
import { SideNav, type NavGroup } from "./side-nav";

/**
 * The Dynamics 365 application frame: app bar across the top, navigation rail
 * on the left, page content filling the rest.
 *
 * Only the page region scrolls. The bar and rail stay fixed, so the command bar
 * in a page header remains reachable no matter how long the form is — which is
 * the behaviour D365 users expect.
 */

const useStyles = makeStyles({
  root: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  body: { flex: 1, display: "flex", minHeight: 0 },
  page: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 },
});

export interface AppShellProps {
  areaName: string;
  navGroups: NavGroup[];
  environmentLabel?: string;
  onSearch?: (query: string) => void;
  children: React.ReactNode;
}

export function AppShell({
  areaName,
  navGroups,
  environmentLabel,
  onSearch,
  children,
}: AppShellProps): React.JSX.Element {
  const styles = useStyles();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={styles.root}>
      <AppBar areaName={areaName} environmentLabel={environmentLabel} onSearch={onSearch} />
      <div className={styles.body}>
        <SideNav
          groups={navGroups}
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
        />
        <div className={styles.page}>{children}</div>
      </div>
    </div>
  );
}
