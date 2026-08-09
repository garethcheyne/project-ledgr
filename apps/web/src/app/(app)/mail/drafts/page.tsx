"use client";

import { DocumentEditRegular } from "@fluentui/react-icons";
import { NotBuiltYet } from "../../../../components/shell";

export default function Page(): React.JSX.Element {
  return (
    <NotBuiltYet
      title="Drafts"
      subtitle="Mail"
      detail="Half-written messages, synced back to your provider's drafts folder."
      phase="Phase 3 — mail client"
      icon={<DocumentEditRegular />}
    />
  );
}
