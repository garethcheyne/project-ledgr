"use client";

import NextLink from "next/link";
import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

/**
 * A Next.js link styled as a Fluent link.
 *
 * Do NOT nest `next/link` inside Fluent's `<Link as="a">` — both render an
 * anchor, producing `<a>` inside `<a>`. That is invalid HTML, and React fails
 * hydration over it and re-renders the whole tree on the client.
 *
 * Styling the Next link with Fluent tokens keeps client-side routing (and
 * middle-click, and open-in-new-tab) while matching Fluent's appearance.
 */

const useStyles = makeStyles({
  link: {
    color: tokens.colorBrandForegroundLink,
    textDecorationLine: "none",
    cursor: "pointer",
    borderRadius: tokens.borderRadiusSmall,
    ":hover": {
      color: tokens.colorBrandForegroundLinkHover,
      textDecorationLine: "underline",
    },
    ":active": { color: tokens.colorBrandForegroundLinkPressed },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: tokens.colorStrokeFocus2,
      outlineOffset: "2px",
    },
  },
  subtle: {
    color: tokens.colorNeutralForeground2,
    ":hover": { color: tokens.colorNeutralForeground2Hover },
  },
});

export interface AppLinkProps {
  href: string;
  children: React.ReactNode;
  appearance?: "default" | "subtle";
  className?: string;
}

export function AppLink({
  href,
  children,
  appearance = "default",
  className,
}: AppLinkProps): React.JSX.Element {
  const styles = useStyles();
  return (
    <NextLink
      href={href}
      className={mergeClasses(styles.link, appearance === "subtle" && styles.subtle, className)}
    >
      {children}
    </NextLink>
  );
}
