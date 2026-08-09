"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useState } from "react";
import {
  FluentProvider,
  SSRProvider,
  RendererProvider,
  createDOMRenderer,
  renderToStyleElements,
  webLightTheme,
} from "@fluentui/react-components";

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
        <FluentProvider theme={webLightTheme}>{children}</FluentProvider>
      </SSRProvider>
    </RendererProvider>
  );
}
