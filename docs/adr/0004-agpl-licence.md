# 0004 — Licence: AGPL-3.0-only

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

PROJECT.md frames Ledgr as "open source now, SaaS later" with precedent from n8n and Cal.com, while noting the pivot is unproven and that part of the self-hosted audience actively avoids SaaS.

Licensing has to be decided at the first commit. Changing it later requires the consent of every contributor who holds copyright, which in practice means it can't be changed once anyone else has contributed.

## Decision

**AGPL-3.0-only**, applied from the initial commit.

## Rationale

The AGPL's network clause is the whole reason for the choice: someone running a modified Ledgr as a hosted service must publish their modifications. Self-hosters — the actual target audience — are unrestricted in every way that matters to them. They can run it, modify it, and never share anything back, because they aren't offering it to third parties.

So it protects a future hosted offering without imposing anything on the people the project is actually for. That asymmetry is what makes it the right fit here rather than merely a defensive choice.

It's also the established answer for this shape of project — Cal.com and Grafana among others — which means it needs no explanation to potential contributors and carries no "what even is this licence" friction.

## Rejected

**MIT.** Maximum adoption, zero friction, and the self-hosted crowd's favourite. Rejected as strategically defenceless: anyone could run a commercial hosted Ledgr with no obligation to contribute anything back, including the eventual competitor to our own hosted offering. For a library this would be right; for an application with a possible commercial future it gives away the only leverage the project has.

**Elastic License / BSL / fair-code (the n8n model).** Strongest commercial protection — free to self-host, explicitly forbidden to offer as a competing service. Rejected because it is not OSI-approved open source, and a meaningful part of r/selfhosted treats that distinction as disqualifying. Given that this audience is the entire early adopter base, alienating it to protect revenue that doesn't exist yet is the wrong trade.

**No licence yet.** Legally means all rights reserved: nobody can contribute or fork safely. Fine for a few weeks of solo work, but it silently blocks exactly the community formation the project needs early.

## Consequences

- `LICENSE` contains the verbatim AGPL-3.0 text. Package manifests declare `AGPL-3.0-only`.
- A future hosted Ledgr runs the same codebase under a different deployment profile. No relicensing needed — we hold the copyright on our own work and the AGPL doesn't restrict the copyright holder.
- Contributions are accepted under AGPL-3.0-only (stated in CONTRIBUTING.md). No CLA for now; if dual-licensing ever becomes necessary, that requires a CLA introduced _before_ outside contributions arrive, so revisit this deliberately rather than by drift.
