"use client";

import { useCallback, useEffect, useState } from "react";
import { AddRegular, BuildingShopRegular, DismissRegular } from "@fluentui/react-icons";
import { Body1, Button, Input, Spinner, makeStyles, tokens } from "../ui";
import { entitiesApi, type EntitySummary } from "../../lib/api-client";

/**
 * Links a message to a company.
 *
 * This is the point of the product: correspondence, cases and bills all hanging
 * off the same vendor. The flow is built so the common case — mail from a
 * company you haven't recorded yet — takes one click, because a linking step
 * that costs effort simply won't get used.
 */

const useStyles = makeStyles({
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px 14px",
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  row: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  linked: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  muted: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  suggestion: { display: "flex", gap: "6px", flexWrap: "wrap" },
});

export function LinkCompany({
  messageId,
  fromAddress,
  linkedEntityId,
  linkedEntityName,
  onChanged,
}: {
  messageId: string;
  fromAddress: string;
  linkedEntityId: string | null;
  linkedEntityName: string | null;
  onChanged: () => void;
}): React.JSX.Element {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<EntitySummary[]>([]);
  const [suggestedName, setSuggestedName] = useState("");
  const [domain, setDomain] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntitySummary[]>([]);

  const loadSuggestions = useCallback(async () => {
    if (!fromAddress) return;
    try {
      const suggestion = await entitiesApi.suggest(fromAddress);
      setMatches(suggestion.matches);
      setSuggestedName(suggestion.suggestedName);
      setDomain(suggestion.domain);
    } catch {
      // Suggestions are a convenience; failing to load them must not block the
      // manual search below.
    }
  }, [fromAddress]);

  useEffect(() => {
    if (open) void loadSuggestions();
  }, [open, loadSuggestions]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const found = await entitiesApi.list(query.trim());
        if (!cancelled) setResults(found);
      } catch {
        /* search is best-effort */
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  async function link(entityId: string | null): Promise<void> {
    setBusy(true);
    try {
      await entitiesApi.linkMessage(messageId, entityId);
      setOpen(false);
      setQuery("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function createAndLink(): Promise<void> {
    setBusy(true);
    try {
      const entity = await entitiesApi.create({
        name: (query.trim() || suggestedName).trim(),
        emailDomains: domain ? [domain] : [],
      });
      await entitiesApi.linkMessage(messageId, entity.id);
      // Attribute earlier mail from the same domain, so linking once tidies up
      // the back catalogue rather than only this message.
      await entitiesApi.backfill(entity.id).catch(() => undefined);
      setOpen(false);
      setQuery("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (linkedEntityId && !open) {
    return (
      <div className={styles.panel}>
        <div className={styles.row}>
          <span className={styles.linked}>
            <BuildingShopRegular /> {linkedEntityName ?? "Linked company"}
          </span>
          <Button size="small" appearance="subtle" onClick={() => setOpen(true)}>
            Change
          </Button>
          <Button
            size="small"
            appearance="subtle"
            icon={<DismissRegular />}
            disabled={busy}
            onClick={() => void link(null)}
          >
            Unlink
          </Button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className={styles.panel}>
        <div className={styles.row}>
          <Body1 className={styles.muted}>Not linked to a company.</Body1>
          <Button
            size="small"
            icon={<BuildingShopRegular />}
            onClick={() => setOpen(true)}
            style={{ marginLeft: "auto" }}
          >
            Link to company
          </Button>
        </div>
      </div>
    );
  }

  const newName = query.trim() || suggestedName;

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <Body1 style={{ fontWeight: 600 }}>Link to company</Body1>
        <Button
          size="small"
          appearance="subtle"
          icon={<DismissRegular />}
          onClick={() => setOpen(false)}
          style={{ marginLeft: "auto" }}
        />
      </div>

      {matches.length > 0 && (
        <>
          <Body1 className={styles.muted}>Already known for {domain}:</Body1>
          <div className={styles.suggestion}>
            {matches.map((entity) => (
              <Button
                key={entity.id}
                size="small"
                appearance="primary"
                disabled={busy}
                onClick={() => void link(entity.id)}
              >
                {entity.name}
              </Button>
            ))}
          </div>
        </>
      )}

      <Input
        value={query}
        onChange={(_, data) => setQuery(data.value)}
        placeholder={suggestedName ? `Search, or create “${suggestedName}”` : "Search companies"}
        disabled={busy}
      />

      {results.length > 0 && (
        <div className={styles.suggestion}>
          {results.map((entity) => (
            <Button
              key={entity.id}
              size="small"
              disabled={busy}
              onClick={() => void link(entity.id)}
            >
              {entity.name}
            </Button>
          ))}
        </div>
      )}

      {newName &&
        !results.some((entity) => entity.name.toLowerCase() === newName.toLowerCase()) && (
          <Button
            size="small"
            appearance="primary"
            icon={busy ? <Spinner size="tiny" /> : <AddRegular />}
            disabled={busy}
            onClick={() => void createAndLink()}
          >
            Create “{newName}”{domain ? ` and match ${domain}` : ""}
          </Button>
        )}
    </div>
  );
}
