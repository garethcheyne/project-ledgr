"use client";

import { useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { Button, makeStyles, tokens } from "../ui";
import { ImageOffRegular } from "@fluentui/react-icons";

/**
 * Renders a message body.
 *
 * Two separate hazards, handled separately:
 *
 *  1. **Script injection.** Email HTML is attacker-controlled, so it goes
 *     through DOMPurify before it reaches the DOM. Without that, any message
 *     could run script in the app's origin and read the session token.
 *
 *  2. **Tracking pixels.** Remote images are blocked by default. A 1×1 image
 *     tells the sender the exact moment you opened their mail, from which IP.
 *     Every serious mail client blocks these; loading them is a per-message
 *     decision the reader makes, not a default.
 */

const useStyles = makeStyles({
  wrapper: { display: "flex", flexDirection: "column", minWidth: 0 },
  notice: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    margin: "0 0 12px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  text: {
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase400,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  html: {
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase400,
    wordBreak: "break-word",
    // Wide tables are common in marketing mail; contain them rather than
    // letting them stretch the pane.
    "& img": { maxWidth: "100%", height: "auto" },
    "& table": { maxWidth: "100%" },
    "& a": { color: tokens.colorBrandForegroundLink },
    "& blockquote": {
      marginLeft: 0,
      paddingLeft: "12px",
      borderLeftWidth: "2px",
      borderLeftStyle: "solid",
      borderLeftColor: tokens.colorNeutralStroke2,
      color: tokens.colorNeutralForeground3,
    },
  },
});

/** Placeholder that keeps layout stable while an image is blocked. */
const BLOCKED_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export function MessageBody({
  html,
  text,
  snippet,
}: {
  html: string | null;
  text: string | null;
  snippet: string;
}): React.JSX.Element {
  const styles = useStyles();
  const [showImages, setShowImages] = useState(false);

  const sanitised = useMemo(() => {
    if (!html) return null;

    // Rewrite remote image sources before sanitising, so a blocked image never
    // reaches the network even for an instant.
    let blockedCount = 0;
    DOMPurify.addHook("uponSanitizeElement", (node, data) => {
      if (data.tagName !== "img" || showImages) return;
      const element = node as Element;
      const src = element.getAttribute?.("src");
      if (src && !src.startsWith("data:")) {
        blockedCount += 1;
        element.setAttribute("src", BLOCKED_PIXEL);
        element.setAttribute("data-blocked-src", src);
      }
    });

    // Links open in a new tab, and noopener stops the opened page reaching
    // back into this one via window.opener.
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noreferrer noopener");
      }
    });

    const clean = DOMPurify.sanitize(html, {
      // Explicitly forbidden rather than merely absent from an allowlist:
      // <style> can leak via CSS, <form> can phish, iframes can embed anything.
      FORBID_TAGS: [
        "script",
        "style",
        "iframe",
        "object",
        "embed",
        "form",
        "input",
        "link",
        "base",
      ],
      FORBID_ATTR: ["srcset", "formaction", "ping"],
      ALLOW_DATA_ATTR: true,
    });

    DOMPurify.removeAllHooks();
    return { clean, blockedCount };
  }, [html, showImages]);

  if (sanitised) {
    return (
      <div className={styles.wrapper}>
        {sanitised.blockedCount > 0 && !showImages && (
          <div className={styles.notice}>
            <ImageOffRegular />
            <span>
              {sanitised.blockedCount} remote image
              {sanitised.blockedCount === 1 ? "" : "s"} blocked — loading them tells the sender you
              opened this.
            </span>
            <Button size="small" onClick={() => setShowImages(true)} style={{ marginLeft: "auto" }}>
              Show images
            </Button>
          </div>
        )}
        <div
          className={styles.html}
          // Safe: `clean` is DOMPurify output, and remote images have already
          // been neutralised above.
          dangerouslySetInnerHTML={{ __html: sanitised.clean }}
        />
      </div>
    );
  }

  return <div className={styles.text}>{text ?? snippet ?? "(no content)"}</div>;
}
