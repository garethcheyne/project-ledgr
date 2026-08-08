# 0003 — Category / vendor separation, and why `Bill` has no vendor

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

This is the product's reason to exist, so the data model has to make the wrong thing impossible rather than merely discouraged.

The obvious schema for a bill is `Bill { vendorId, categoryId, amount, date }`. It is simple, it denormalises nicely, and every query is one join shorter.

It also destroys the one thing Ledgr is for.

Consider switching power companies in March. With a vendor on each bill, "spend on Power" is answerable, but "when did I switch, and did it save me anything?" requires reconstructing the switch by inspecting which vendor appears on which bills and inferring a boundary from the gap. The switch isn't recorded; it's an artefact you reverse-engineer. Get a bill's date slightly wrong and the boundary moves.

## Decision

Three models instead of two:

- **`Category`** — the persistent thing being tracked. *Power.* Never changes when a vendor does.
- **`Entity`** — a vendor/company.
- **`Subscription`** — `entityId` × `categoryId` over `[startDate, endDate)`. The dated relationship between them.

**`Bill` points at a `Subscription`, and stores no vendor and no category of its own.** Both resolve through the subscription, by date.

A vendor switch is therefore a single transaction: close the open subscription with an `endDate`, open a new one under the same `categoryId` with a different `entityId`.

## Consequences

Everything the product promises falls out of the model for free rather than needing to be computed:

- **Spend-by-category is continuous across switches.** Nothing special-cases the boundary; the join simply resolves through whichever subscription was live on that date.
- **Switch events are first-class.** They're rows, with dates, queryable directly — not inferred from bill patterns.
- **"Was switching worth it?"** is a comparison between two subscriptions under one category, which is a straightforward query rather than a reporting feature.
- **Miscategorised bills are structurally impossible.** A bill cannot claim a vendor that wasn't supplying that category on that date, because it never names a vendor at all.

The costs, accepted:

- Every bill query joins through `Subscription`. Indexed, and cheap at personal-CRM scale.
- Recording a bill requires a subscription to exist covering its date. This is real friction during import of historical data, and it is the correct friction — a bill with no supplier relationship behind it is data we can't answer questions about.
- Overlapping subscriptions for the same category must be prevented in application logic (Postgres exclusion constraints on ranges are the eventual answer; a service-layer check is the current one).

## The rule

**Do not add `vendorId` or `categoryId` to `Bill`.**

It will be tempting — usually to simplify a query or a form. It reintroduces exactly the failure this model exists to prevent, and it does so silently: the denormalised column and the subscription can disagree, and nothing will report the disagreement. The vendor-switch continuity tests are the tripwire; if a change makes them awkward to keep passing, that is the signal, not an inconvenience to route around.
