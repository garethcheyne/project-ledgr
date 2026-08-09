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
  AppLink,
} from "../../components/ui";
import { ApiRequestError, authApi } from "../../lib/api-client";
import { saveSession } from "../../lib/session";
import { AuthShell } from "../../components/auth-shell";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  actions: { display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" },
  switcher: { textAlign: "center", fontSize: "14px" },
});

export default function LoginPage(): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const auth = await authApi.login({ email, password });
      saveSession(auth);
      router.push("/home");
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
    <AuthShell title="Welcome back" subtitle="Sign in to your Ledgr household.">
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {/* Credential failures are shown at form level, never against a
            specific field — telling someone "no account with that email"
            turns the login form into an account-enumeration oracle. */}
        {error && !error.fieldErrors && (
          <MessageBar intent={error.code === "NETWORK_ERROR" ? "warning" : "error"}>
            <MessageBarBody>{error.message}</MessageBarBody>
          </MessageBar>
        )}

        <Field
          label="Email"
          required
          validationState={error?.fieldError("email") ? "error" : "none"}
          validationMessage={error?.fieldError("email")}
        >
          <Input
            type="email"
            name="email"
            value={email}
            onChange={(_, data) => setEmail(data.value)}
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            disabled={submitting}
          />
        </Field>

        <Field
          label="Password"
          required
          validationState={error?.fieldError("password") ? "error" : "none"}
          validationMessage={error?.fieldError("password")}
        >
          <Input
            type="password"
            name="password"
            value={password}
            onChange={(_, data) => setPassword(data.value)}
            autoComplete="current-password"
            disabled={submitting}
          />
        </Field>

        <div className={styles.actions}>
          <Button
            type="submit"
            appearance="primary"
            size="large"
            disabled={submitting || !email || !password}
            icon={submitting ? <Spinner size="tiny" /> : undefined}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>

          <div className={styles.switcher}>
            New here? <AppLink href="/register">Create an account</AppLink>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
