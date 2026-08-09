"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CheckmarkCircleFilled,
  DismissCircleFilled,
  MailRegular,
  OpenRegular,
} from "@fluentui/react-icons";
import {
  MAIL_PRESETS,
  presetById,
  presetForAddress,
  type ConnectionTestResult,
  type MailAccountSummary,
} from "@ledgr/contracts";
import {
  Body1,
  Button,
  Checkbox,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  makeStyles,
  tokens,
} from "../../../../components/ui";
import { FormColumn, FormField, FormSection } from "../../../../components/shell";
import { ApiRequestError, mailApi } from "../../../../lib/api-client";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: "0" },
  hint: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    display: "block",
    marginTop: "4px",
  },
  link: {
    color: tokens.colorBrandForegroundLink,
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
  },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" },
  result: { display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" },
  resultRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: tokens.fontSizeBase300,
  },
  ok: { color: tokens.colorPaletteGreenForeground1 },
  bad: { color: tokens.colorPaletteRedForeground1 },
  detail: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

export function ConnectForm({
  onConnected,
  onCancel,
}: {
  onConnected: (account: MailAccountSummary) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const styles = useStyles();

  const [presetId, setPresetId] = useState("gmail");
  const [emailAddress, setEmailAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Advanced fields start from the preset and are only overridden if the user
  // opens the section, so a Gmail connection needs no host knowledge at all.
  const [overrides, setOverrides] = useState<Partial<Record<string, string | boolean>>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);

  const preset = presetById(presetId);

  const settings = useMemo(
    () => ({
      imapHost: (overrides.imapHost as string) ?? preset.imapHost,
      imapPort: Number(overrides.imapPort ?? preset.imapPort),
      imapUseTls: (overrides.imapUseTls as boolean) ?? preset.imapUseTls,
      smtpHost: (overrides.smtpHost as string) ?? preset.smtpHost,
      smtpPort: Number(overrides.smtpPort ?? preset.smtpPort),
      smtpUseTls: (overrides.smtpUseTls as boolean) ?? preset.smtpUseTls,
    }),
    [overrides, preset],
  );

  /** Switching provider drops stale host overrides from the previous one. */
  function choosePreset(id: string): void {
    setPresetId(id);
    setOverrides({});
    setTestResult(null);
  }

  /** Typing an address picks the provider, unless one was chosen explicitly. */
  function handleEmailChange(value: string): void {
    setEmailAddress(value);
    if (!username) setUsername(value);
    if (value.includes("@")) {
      const detected = presetForAddress(value);
      if (detected.id !== "custom" && detected.id !== presetId) choosePreset(detected.id);
    }
  }

  function payload() {
    return {
      provider: "IMAP" as const,
      emailAddress,
      username: username || emailAddress,
      password,
      ...settings,
    };
  }

  async function handleTest(): Promise<void> {
    setError(null);
    setTestResult(null);
    setTesting(true);
    try {
      setTestResult(await mailApi.testConnection(payload()));
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      onConnected(
        await mailApi.connect({
          ...payload(),
          displayName: displayName || emailAddress,
        }),
      );
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = Boolean(emailAddress && password && settings.imapHost && settings.smtpHost);

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {error && (
        <MessageBar intent="error" style={{ marginBottom: "12px" }}>
          <MessageBarBody>{error.message}</MessageBarBody>
        </MessageBar>
      )}

      <FormSection title="Mailbox" columns={2}>
        <FormColumn>
          <FormField label="Provider" required>
            <Dropdown
              value={preset.label}
              selectedOptions={[preset.id]}
              onOptionSelect={(_, data) => choosePreset(String(data.optionValue))}
            >
              {MAIL_PRESETS.map((option) => (
                <Option key={option.id} value={option.id} text={option.label}>
                  {option.label}
                </Option>
              ))}
            </Dropdown>
          </FormField>

          <FormField label="Email address" required htmlFor="emailAddress">
            <Input
              id="emailAddress"
              type="email"
              value={emailAddress}
              onChange={(_, data) => handleEmailChange(data.value)}
              placeholder="you@gmail.com"
              autoComplete="email"
            />
          </FormField>

          <FormField label="Display name" htmlFor="displayName">
            <Input
              id="displayName"
              value={displayName}
              onChange={(_, data) => setDisplayName(data.value)}
              placeholder={emailAddress || "Personal"}
            />
          </FormField>
        </FormColumn>

        <FormColumn>
          <FormField label="Username" htmlFor="username">
            <Input
              id="username"
              value={username}
              onChange={(_, data) => setUsername(data.value)}
              placeholder={emailAddress || "Usually your full address"}
              autoComplete="username"
            />
          </FormField>

          <FormField
            label={preset.requiresAppPassword ? "App password" : "Password"}
            required
            htmlFor="password"
          >
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(_, data) => setPassword(data.value)}
              autoComplete="new-password"
            />
          </FormField>
        </FormColumn>
      </FormSection>

      {preset.hint && (
        <MessageBar intent="info" style={{ marginBottom: "16px" }}>
          <MessageBarBody>
            {preset.hint}
            {preset.appPasswordUrl && (
              <>
                {" "}
                <a
                  href={preset.appPasswordUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.link}
                >
                  Create one <OpenRegular />
                </a>
              </>
            )}
          </MessageBarBody>
        </MessageBar>
      )}

      <FormSection title="Server settings" columns={2}>
        <FormColumn>
          <FormField label="IMAP host" required htmlFor="imapHost">
            <Input
              id="imapHost"
              value={settings.imapHost}
              onChange={(_, data) => setOverrides((o) => ({ ...o, imapHost: data.value }))}
              disabled={!showAdvanced && presetId !== "custom"}
            />
          </FormField>
          <FormField label="IMAP port" required htmlFor="imapPort">
            <Input
              id="imapPort"
              type="number"
              value={String(settings.imapPort)}
              onChange={(_, data) => setOverrides((o) => ({ ...o, imapPort: data.value }))}
              disabled={!showAdvanced && presetId !== "custom"}
            />
          </FormField>
        </FormColumn>

        <FormColumn>
          <FormField label="SMTP host" required htmlFor="smtpHost">
            <Input
              id="smtpHost"
              value={settings.smtpHost}
              onChange={(_, data) => setOverrides((o) => ({ ...o, smtpHost: data.value }))}
              disabled={!showAdvanced && presetId !== "custom"}
            />
          </FormField>
          <FormField label="SMTP port" required htmlFor="smtpPort">
            <Input
              id="smtpPort"
              type="number"
              value={String(settings.smtpPort)}
              onChange={(_, data) => setOverrides((o) => ({ ...o, smtpPort: data.value }))}
              disabled={!showAdvanced && presetId !== "custom"}
            />
          </FormField>
        </FormColumn>
      </FormSection>

      {presetId !== "custom" && (
        <Checkbox
          checked={showAdvanced}
          onChange={(_, data) => setShowAdvanced(Boolean(data.checked))}
          label="Edit server settings manually"
        />
      )}

      {testResult && (
        <div className={styles.result}>
          <div className={styles.resultRow}>
            <span className={testResult.imap.ok ? styles.ok : styles.bad}>
              {testResult.imap.ok ? <CheckmarkCircleFilled /> : <DismissCircleFilled />}
            </span>
            <span>
              IMAP {testResult.imap.ok ? "connected" : "failed"}
              {testResult.imap.ok && (
                <span className={styles.detail}>
                  {" "}
                  — {testResult.imap.folderCount} folders
                  {/* Without IDLE we poll instead, so say so up front. */}
                  {testResult.imap.supportsIdle ? ", push supported" : ", polling only"}
                </span>
              )}
            </span>
          </div>
          {!testResult.imap.ok && <Body1 className={styles.detail}>{testResult.imap.error}</Body1>}

          <div className={styles.resultRow}>
            <span className={testResult.smtp.ok ? styles.ok : styles.bad}>
              {testResult.smtp.ok ? <CheckmarkCircleFilled /> : <DismissCircleFilled />}
            </span>
            <span>SMTP {testResult.smtp.ok ? "connected" : "failed"}</span>
          </div>
          {!testResult.smtp.ok && (
            <Body1 className={styles.detail}>
              {testResult.smtp.error} — you can still connect, but sending won&apos;t work until
              this is fixed.
            </Body1>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <Button
          appearance="primary"
          type="submit"
          disabled={!canSubmit || saving}
          icon={saving ? <Spinner size="tiny" /> : <MailRegular />}
        >
          {saving ? "Connecting…" : "Connect"}
        </Button>
        <Button
          type="button"
          onClick={handleTest}
          disabled={!canSubmit || testing}
          icon={testing ? <Spinner size="tiny" /> : undefined}
        >
          {testing ? "Testing…" : "Test connection"}
        </Button>
        <Button type="button" appearance="subtle" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function asApiError(caught: unknown): ApiRequestError {
  return caught instanceof ApiRequestError
    ? caught
    : new ApiRequestError(0, "UNKNOWN", "Something went wrong. Please try again.");
}
