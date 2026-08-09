"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  makeStyles,
  tokens,
  AppLink,
} from "../../components/ui";
import { ApiRequestError, authApi } from "../../lib/api-client";
import { saveSession } from "../../lib/session";
import { AuthShell } from "../../components/auth-shell";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  actions: { display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" },
  switcher: { textAlign: "center", fontSize: "14px" },
  hint: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  meter: { display: "flex", gap: "4px", marginTop: "6px" },
  segment: {
    height: "3px",
    flex: 1,
    borderRadius: "2px",
    backgroundColor: tokens.colorNeutralBackground5,
  },
  segmentOn: { backgroundColor: tokens.colorPaletteGreenBackground3 },
});

const MIN_PASSWORD_LENGTH = 12;

export default function RegisterPage(): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Length-based, matching the server rule. Composition requirements push
  // people toward "Password1!", which is both harder to remember and easier to
  // guess than a long passphrase.
  const strength = Math.min(4, Math.floor(password.length / 6));
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const auth = await authApi.register({
        email,
        password,
        displayName,
        householdName: householdName.trim() || undefined,
      });
      saveSession(auth);
      router.push("/mail");
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? caught
          : new ApiRequestError(0, "UNKNOWN", "Something went wrong. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your household"
      subtitle="One account to track your mail, your vendors and what you spend with them."
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {error && !error.fieldErrors && (
          <MessageBar intent={error.code === "NETWORK_ERROR" ? "warning" : "error"}>
            <MessageBarBody>{error.message}</MessageBarBody>
          </MessageBar>
        )}

        <Field
          label="Your name"
          required
          validationMessage={error?.fieldError("displayName")}
          validationState={error?.fieldError("displayName") ? "error" : "none"}
        >
          <Input
            name="displayName"
            value={displayName}
            onChange={(_, data) => setDisplayName(data.value)}
            autoComplete="name"
            autoFocus
            placeholder="Gareth Cheyne"
            disabled={submitting}
          />
        </Field>

        <Field
          label="Email"
          required
          // EMAIL_TAKEN is a 409 without fieldErrors, so surface it on the field
          // it actually concerns rather than as a banner.
          validationState={
            error?.fieldError("email") || error?.code === "EMAIL_TAKEN" ? "error" : "none"
          }
          validationMessage={
            error?.code === "EMAIL_TAKEN"
              ? "That email is already registered. Try signing in instead."
              : error?.fieldError("email")
          }
        >
          <Input
            type="email"
            name="email"
            value={email}
            onChange={(_, data) => setEmail(data.value)}
            autoComplete="email"
            placeholder="you@example.com"
            disabled={submitting}
          />
        </Field>

        <Field
          label="Password"
          required
          validationState={passwordTooShort || error?.fieldError("password") ? "error" : "none"}
          validationMessage={
            error?.fieldError("password") ??
            (passwordTooShort ? `At least ${MIN_PASSWORD_LENGTH} characters` : undefined)
          }
          hint={
            !passwordTooShort && !error?.fieldError("password")
              ? "A memorable phrase works better than a short complicated one."
              : undefined
          }
        >
          <Input
            type="password"
            name="password"
            value={password}
            onChange={(_, data) => setPassword(data.value)}
            autoComplete="new-password"
            disabled={submitting}
          />
        </Field>

        {password.length > 0 && (
          <div className={styles.meter} aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`${styles.segment} ${index < strength ? styles.segmentOn : ""}`}
              />
            ))}
          </div>
        )}

        <Field
          label="Household name"
          hint="Optional — what you'll call this ledger. You can change it later."
        >
          <Input
            name="householdName"
            value={householdName}
            onChange={(_, data) => setHouseholdName(data.value)}
            placeholder={displayName ? `${displayName}'s household` : "Our household"}
            disabled={submitting}
          />
        </Field>

        <div className={styles.actions}>
          <Button
            type="submit"
            appearance="primary"
            size="large"
            disabled={submitting || !email || !displayName || password.length < MIN_PASSWORD_LENGTH}
            icon={submitting ? <Spinner size="tiny" /> : undefined}
          >
            {submitting ? "Creating your household…" : "Create account"}
          </Button>

          <div className={styles.switcher}>
            Already have an account? <AppLink href="/login">Sign in</AppLink>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
