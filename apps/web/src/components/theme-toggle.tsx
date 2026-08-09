"use client";

import {
  Menu,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  ToolbarButton,
  Tooltip,
} from "@fluentui/react-components";
import { DarkThemeRegular, WeatherMoonRegular, WeatherSunnyRegular } from "@fluentui/react-icons";
import { useTheme, type ThemeMode } from "../app/theme-provider";

const LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "Match system",
};

// Keyed by mode rather than an array, so looking one up can't be undefined and
// adding a mode to ThemeMode becomes a compile error here.
const ICONS: Record<ThemeMode, React.JSX.Element> = {
  light: <WeatherSunnyRegular />,
  dark: <WeatherMoonRegular />,
  system: <DarkThemeRegular />,
};

const MODES: ThemeMode[] = ["light", "dark", "system"];

/**
 * Three-way theme picker.
 *
 * "System" is a distinct choice rather than just the initial state — someone
 * who wants their OS schedule respected should be able to say so explicitly
 * and see it reflected.
 */
export function ThemeToggle(): React.JSX.Element {
  const { mode, resolved, setMode } = useTheme();
  const currentLabel = LABELS[mode].toLowerCase();

  return (
    <Menu
      checkedValues={{ theme: [mode] }}
      onCheckedValueChange={(_, data) => {
        const next = data.checkedItems[0];
        if (next === "light" || next === "dark" || next === "system") setMode(next);
      }}
    >
      <MenuTrigger disableButtonEnhancement>
        <Tooltip content={`Theme: ${currentLabel}`} relationship="label">
          <ToolbarButton
            aria-label={`Change theme. Currently ${currentLabel}, showing ${resolved}.`}
            icon={resolved === "dark" ? <WeatherMoonRegular /> : <WeatherSunnyRegular />}
          />
        </Tooltip>
      </MenuTrigger>

      <MenuPopover>
        <MenuList>
          {MODES.map((value) => (
            <MenuItemRadio key={value} name="theme" value={value} icon={ICONS[value]}>
              {LABELS[value]}
            </MenuItemRadio>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
