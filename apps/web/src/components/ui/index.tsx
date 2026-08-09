"use client";

/**
 * Ledgr's Fluent primitives.
 *
 * Every input-like control defaults to `appearance="filled-darker"`. Setting
 * that per-usage across a growing app guarantees drift — one form eventually
 * ships with outline inputs and looks subtly wrong. Import from here instead of
 * from @fluentui/react-components directly, and the default can't be forgotten.
 *
 * Each wrapper still forwards `appearance`, so a one-off override is possible
 * where genuinely wanted.
 */

import {
  Combobox as FluentCombobox,
  Dropdown as FluentDropdown,
  Input as FluentInput,
  SearchBox as FluentSearchBox,
  Select as FluentSelect,
  SpinButton as FluentSpinButton,
  Textarea as FluentTextarea,
  type ComboboxProps,
  type DropdownProps,
  type InputProps,
  type SearchBoxProps,
  type SelectProps,
  type SpinButtonProps,
  type TextareaProps,
} from "@fluentui/react-components";
import { forwardRef } from "react";

/** The house style for form controls. */
export const DEFAULT_APPEARANCE = "filled-darker" as const;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  return <FluentInput appearance={DEFAULT_APPEARANCE} {...props} ref={ref} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(props, ref) {
    return <FluentTextarea appearance={DEFAULT_APPEARANCE} {...props} ref={ref} />;
  },
);

export const Dropdown = forwardRef<HTMLButtonElement, DropdownProps>(function Dropdown(props, ref) {
  return <FluentDropdown appearance={DEFAULT_APPEARANCE} {...props} ref={ref} />;
});

export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(props, ref) {
  return <FluentCombobox appearance={DEFAULT_APPEARANCE} {...props} ref={ref} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(props, ref) {
  return <FluentSelect appearance={DEFAULT_APPEARANCE} {...props} ref={ref} />;
});

export const SpinButton = forwardRef<HTMLInputElement, SpinButtonProps>(
  function SpinButton(props, ref) {
    return <FluentSpinButton appearance={DEFAULT_APPEARANCE} {...props} ref={ref} />;
  },
);

export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  function SearchBox(props, ref) {
    return <FluentSearchBox appearance={DEFAULT_APPEARANCE} {...props} ref={ref} />;
  },
);

// Controls with no `appearance` prop are re-exported unchanged, so callers can
// import everything from one place rather than remembering which is which.
export {
  Body1,
  Body1Strong,
  Button,
  Caption1,
  Card,
  Checkbox,
  Divider,
  Field,
  Label,
  Link,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Radio,
  RadioGroup,
  Spinner,
  Subtitle1,
  Subtitle2,
  Switch,
  Tab,
  TabList,
  Title1,
  Title2,
  Title3,
  Tooltip,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
} from "@fluentui/react-components";
