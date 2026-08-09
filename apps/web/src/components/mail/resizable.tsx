"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { makeStyles, tokens } from "../ui";

/**
 * Drag handle between two panes.
 *
 * Widths persist to localStorage: someone who widens the message list expects
 * it to still be wide tomorrow, and re-dragging it every session is the kind of
 * small friction that makes an app feel unfinished.
 *
 * Keyboard-operable as well as draggable — a splitter that only responds to the
 * mouse locks out anyone who can't use one.
 */

const useStyles = makeStyles({
  handle: {
    width: "5px",
    flexShrink: 0,
    cursor: "col-resize",
    backgroundColor: tokens.colorNeutralStroke2,
    position: "relative",
    ":hover": { backgroundColor: tokens.colorBrandStroke1 },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: tokens.colorStrokeFocus2,
      outlineOffset: "-1px",
    },
    // Widen the grab area without widening the visible line.
    "::after": {
      content: '""',
      position: "absolute",
      top: 0,
      bottom: 0,
      left: "-3px",
      right: "-3px",
    },
  },
  dragging: { backgroundColor: tokens.colorBrandStroke1 },
});

export function useResizableWidth(
  storageKey: string,
  defaultWidth: number,
  bounds: { min: number; max: number },
): [number, (width: number) => void] {
  const [width, setWidth] = useState(defaultWidth);

  // Read after mount, not during render: localStorage isn't available on the
  // server and reading it in render would desync hydration.
  useEffect(() => {
    const stored = Number(window.localStorage.getItem(storageKey));
    if (Number.isFinite(stored) && stored >= bounds.min && stored <= bounds.max) {
      setWidth(stored);
    }
  }, [storageKey, bounds.min, bounds.max]);

  const update = useCallback(
    (next: number) => {
      const clamped = Math.min(bounds.max, Math.max(bounds.min, next));
      setWidth(clamped);
      window.localStorage.setItem(storageKey, String(clamped));
    },
    [storageKey, bounds.min, bounds.max],
  );

  return [width, update];
}

export function ResizeHandle({
  onResize,
  currentWidth,
  label,
  min,
  max,
}: {
  onResize: (width: number) => void;
  currentWidth: number;
  label: string;
  min: number;
  max: number;
}): React.JSX.Element {
  const styles = useStyles();
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, width: 0 });

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent): void => {
      onResize(startRef.current.width + (event.clientX - startRef.current.x));
    };
    const onUp = (): void => setDragging(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // Stops the drag selecting text across the whole page.
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [dragging, onResize]);

  return (
    <div
      className={`${styles.handle} ${dragging ? styles.dragging : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={currentWidth}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(event) => {
        startRef.current = { x: event.clientX, width: currentWidth };
        setDragging(true);
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 50 : 10;
        if (event.key === "ArrowLeft") {
          onResize(currentWidth - step);
          event.preventDefault();
        }
        if (event.key === "ArrowRight") {
          onResize(currentWidth + step);
          event.preventDefault();
        }
      }}
    />
  );
}
