"use client";

import { ArrowSyncRegular } from "@fluentui/react-icons";
import { NotBuiltYet } from "../../../components/shell";

export default function Page(): React.JSX.Element {
  return (
    <NotBuiltYet
      title="Subscriptions"
      subtitle="Finances"
      detail="The dated link between a company and a category. Switching provider closes one and opens another, and your history stays continuous."
      phase="Phase 5 — finance core"
      icon={<ArrowSyncRegular />}
    />
  );
}
