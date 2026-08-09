"use client";

/**
 * Ledgr's Fluent primitives.
 *
 * Every input-like control defaults to `filled-darker`. Setting that per-usage
 * across a growing app guarantees drift — one form eventually ships with
 * outline inputs and looks subtly wrong. Import from here rather than from
 * @fluentui/react-components directly, and the default can't be forgotten.
 * Each wrapper still forwards `appearance` for a deliberate one-off override.
 *
 * The default and its narrowing helpers come from `fluentui-extended` so there
 * is one source of truth: Input accepts the full FieldAppearance union, but
 * Textarea rejects "underline" and Combobox/Dropdown accept a narrower set
 * still. Passing the wrong arm is a type error, which is what those helpers
 * exist to prevent.
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
import {
  DEFAULT_FIELD_APPEARANCE,
  toListboxAppearance,
  toTextareaAppearance,
} from "fluentui-extended";
import { forwardRef } from "react";

export { DEFAULT_FIELD_APPEARANCE };

export { AppLink } from "./app-link";
export type { AppLinkProps } from "./app-link";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  return <FluentInput appearance={DEFAULT_FIELD_APPEARANCE} {...props} ref={ref} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(props, ref) {
    return (
      <FluentTextarea
        appearance={toTextareaAppearance(DEFAULT_FIELD_APPEARANCE)}
        {...props}
        ref={ref}
      />
    );
  },
);

export const Dropdown = forwardRef<HTMLButtonElement, DropdownProps>(function Dropdown(props, ref) {
  return (
    <FluentDropdown
      appearance={toListboxAppearance(DEFAULT_FIELD_APPEARANCE)}
      {...props}
      ref={ref}
    />
  );
});

export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(props, ref) {
  return (
    <FluentCombobox
      appearance={toListboxAppearance(DEFAULT_FIELD_APPEARANCE)}
      {...props}
      ref={ref}
    />
  );
});

// Select and SpinButton accept the same four-arm union as the listbox controls
// — no shadow variants — so they reuse that narrowing despite the name.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(props, ref) {
  return (
    <FluentSelect appearance={toListboxAppearance(DEFAULT_FIELD_APPEARANCE)} {...props} ref={ref} />
  );
});

export const SpinButton = forwardRef<HTMLInputElement, SpinButtonProps>(
  function SpinButton(props, ref) {
    return (
      <FluentSpinButton
        appearance={toListboxAppearance(DEFAULT_FIELD_APPEARANCE)}
        {...props}
        ref={ref}
      />
    );
  },
);

export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  function SearchBox(props, ref) {
    return <FluentSearchBox appearance={DEFAULT_FIELD_APPEARANCE} {...props} ref={ref} />;
  },
);

/**
 * Extended components.
 *
 * Deliberately a curated list, not `export *`. fluentui-extended also ships
 * Dataverse-backed pieces — SystemUserCard, OwnerLookup, webApiGet and friends
 * — which call the D365 Web API. Ledgr has no Dataverse, so re-exporting them
 * would offer components that compile and then fail at runtime.
 */
export {
  CommandBar,
  DateTimeField,
  DateTimeRangeField,
  EntityGrid,
  Lookup,
  OptionSetField,
  QueryBuilder,
  RecordHoverCard,
} from "fluentui-extended";

export type {
  CommandBarItem,
  CommandBarItemAppearance,
  CommandBarProps,
  DateTimeFieldProps,
  DateTimeRangeFieldProps,
  EntityGridColumn,
  EntityGridProps,
  EntityGridSort,
  FieldAppearance,
  LookupOption,
  LookupProps,
  OptionSetFieldProps,
  RecordHoverCardProps,
} from "fluentui-extended";

// Controls with no `appearance` prop are re-exported unchanged, so callers can
// import everything from one place rather than remembering which is which.
export {
  Avatar,
  Badge,
  Body1,
  Body1Strong,
  Button,
  Caption1,
  Card,
  Checkbox,
  CounterBadge,
  Divider,
  Field,
  Label,
  Link,
  Menu,
  MenuItem,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  OptionGroup,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Persona,
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
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  Tooltip,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
} from "@fluentui/react-components";
