"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useState } from "react";
import {
  FluentProvider,
  SSRProvider,
  RendererProvider,
  createDOMRenderer,
  renderToStyleElements,
} from "@fluentui/react-components";
import { ThemeProvider, useTheme } from "./theme-provider";

/**
 * Fluent UI + Griffel with App Router SSR.
 *
 * Griffel generates atomic CSS at runtime. Without this wiring the styles are
 * only produced in the browser, so every first paint flashes unstyled content.
 * `useServerInsertedHTML` pushes the collected rules into the streamed HTML
 * before the markup that needs them.
 */
export function Providers({ children }: { children: React.ReactNode }): React.JSX.Element {
  // Created once per request, not per render — a renderer rebuilt on each
  // render would lose the rules collected so far.
  const [renderer] = useState(() => createDOMRenderer());

  useServerInsertedHTML(() => <>{renderToStyleElements(renderer)}</>);

  return (
    <RendererProvider renderer={renderer}>
      <SSRProvider>
        <ThemeProvider>
          <ThemedFluentProvider>{children}</ThemedFluentProvider>
        </ThemeProvider>
      </SSRProvider>
    </RendererProvider>
  );
}

/** Separate component so it can call useTheme, which needs ThemeProvider above it. */
function ThemedFluentProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();

  // Fluent's theme tokens only apply inside this provider, so it has to fill
  // the viewport — otherwise the page background stays the browser default and
  // dark mode shows a white margin.
  return (
    <FluentProvider theme={theme} style={{ minHeight: "100vh" }}>
      {children}
    </FluentProvider>
  );
}
