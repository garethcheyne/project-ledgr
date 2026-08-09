"use client";

import { ReceiptRegular } from "@fluentui/react-icons";
import { NotBuiltYet } from "../../../components/shell";

export default function Page(): React.JSX.Element {
  return (
    <NotBuiltYet
      title="Bills"
      subtitle="Finances"
      detail="Every bill and receipt, resolving its vendor and category through the subscription that was live on its date."
      phase="Phase 5 — finance core"
      icon={<ReceiptRegular />}
    />
  );
}
