"use client";

import { useState } from "react";
import {
  AddRegular,
  DeleteRegular,
  SaveRegular,
  SaveEditRegular,
  ShareRegular,
} from "@fluentui/react-icons";
import { Badge, Dropdown, Input, Option, Switch, type CommandBarItem } from "../../components/ui";
import {
  AppShell,
  FormBody,
  FormColumn,
  FormField,
  FormSection,
  PageHeader,
} from "../../components/shell";
import { buildNavGroups } from "../../lib/navigation";

/**
 * Reference implementation of the Dynamics 365 record layout.
 *
 * Exists so the shell can be checked against the real thing, and as the pattern
 * every record page should follow: page header with title/status/commands, tab
 * strip, then a column-based form body.
 */
export default function LayoutDemoPage(): React.JSX.Element {
  const [tab, setTab] = useState("general");
  const [dirty, setDirty] = useState(false);
  const [roundSell, setRoundSell] = useState(true);

  const commands: CommandBarItem[] = [
    {
      key: "save",
      text: "Save",
      icon: <SaveRegular />,
      title: "Save",
      description: "Keep your changes and stay on this record.",
      onClick: () => setDirty(false),
    },
    {
      key: "saveClose",
      text: "Save & Close",
      icon: <SaveEditRegular />,
      title: "Save and close",
      onClick: () => setDirty(false),
    },
    { key: "new", text: "New", icon: <AddRegular />, title: "New record" },
    { key: "delete", text: "Delete", icon: <DeleteRegular />, title: "Delete this record" },
  ];

  const farCommands: CommandBarItem[] = [
    { key: "share", icon: <ShareRegular />, title: "Share", text: "Share" },
  ];

  return (
    <AppShell
      areaName="Design reference"
      navGroups={buildNavGroups({ inboxUnread: 12, reviewQueue: 3 })}
      environmentLabel="DEV"
    >
      <PageHeader
        title="Octopus Energy"
        subtitle="Company"
        savedState={dirty ? "unsaved" : "saved"}
        headerFields={[
          {
            label: "Status",
            value: (
              <Badge appearance="filled" color="success">
                Active
              </Badge>
            ),
          },
          { label: "Category", value: <span>Power</span> },
        ]}
        commands={commands}
        farCommands={farCommands}
        tabs={[
          { value: "general", label: "General" },
          { value: "mail", label: "Mail" },
          { value: "subscriptions", label: "Subscriptions" },
          { value: "bills", label: "Bills" },
          { value: "related", label: "Related" },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />

      <FormBody>
        <FormSection title="Account information" columns={2}>
          <FormColumn>
            <FormField label="Name" required htmlFor="name">
              <Input id="name" value="Octopus Energy" onChange={() => setDirty(true)} />
            </FormField>
            <FormField label="Legal name" htmlFor="legalName">
              <Input id="legalName" value="Octopus Energy NZ Ltd" onChange={() => setDirty(true)} />
            </FormField>
            <FormField label="Account number" htmlFor="accountRef">
              <Input id="accountRef" value="NZ-4471-88" onChange={() => setDirty(true)} />
            </FormField>
            <FormField label="Auto-match receipts">
              <Switch
                checked={roundSell}
                onChange={(_, data) => {
                  setRoundSell(data.checked);
                  setDirty(true);
                }}
                label={roundSell ? "Yes" : "No"}
              />
            </FormField>
          </FormColumn>

          <FormColumn>
            <FormField label="Status" required htmlFor="status">
              <Dropdown id="status" defaultValue="Active" defaultSelectedOptions={["active"]}>
                <Option value="active">Active</Option>
                <Option value="inactive">Inactive</Option>
                <Option value="archived">Archived</Option>
              </Dropdown>
            </FormField>
            <FormField label="Website" htmlFor="website">
              <Input id="website" value="octopusenergy.nz" onChange={() => setDirty(true)} />
            </FormField>
            <FormField label="Created on" locked htmlFor="createdOn">
              <Input id="createdOn" value="13/11/2025" disabled />
            </FormField>
            <FormField label="Owner" locked htmlFor="owner">
              <Input id="owner" value="Gareth Cheyne" disabled />
            </FormField>
          </FormColumn>
        </FormSection>

        <FormSection title="Contact" columns={2}>
          <FormColumn>
            <FormField label="Email" htmlFor="email">
              <Input id="email" type="email" value="hello@octopusenergy.nz" />
            </FormField>
          </FormColumn>
          <FormColumn>
            <FormField label="Phone" htmlFor="phone">
              <Input id="phone" value="0800 000 000" />
            </FormField>
          </FormColumn>
        </FormSection>
      </FormBody>
    </AppShell>
  );
}
