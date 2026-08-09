import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Ledgr",
  description:
    "A personal CRM for your relationships, correspondence and finances with the companies in your life.",
};

/**
 * Runs before first paint, ahead of React.
 *
 * Fluent's theme is chosen after hydration, so without this a dark-mode user
 * gets a white flash on every page load. Setting the attribute and background
 * synchronously here means the page paints the right colour immediately;
 * Fluent then styles its own tree to match.
 *
 * Deliberately dependency-free and tiny — it blocks rendering.
 */
const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('ledgr.theme');
    var mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var dark = mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) {
    // Private browsing can throw on localStorage. Light is a safe default.
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

/**
 * Page background only. Everything else is themed by Fluent tokens — these two
 * values just have to match webLightTheme/webDarkTheme's neutral background so
 * there's no seam before hydration.
 */
const baseStyles = `
  html { background: #ffffff; }
  html[data-theme='dark'] { background: #1f1f1f; color-scheme: dark; }
  html[data-theme='light'] { color-scheme: light; }
  body { margin: 0; }
`;

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    // suppressHydrationWarning: the bootstrap script sets data-theme before
    // React hydrates, so the client's <html> legitimately differs from the
    // server's markup. This is the attribute we intend to differ.
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: baseStyles }} />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
