"use client";

import { DeleteRegular } from "@fluentui/react-icons";
import { NotBuiltYet } from "../../../../components/shell";

export default function Page(): React.JSX.Element {
  return (
    <NotBuiltYet
      title="Deleted"
      subtitle="Mail"
      detail="Deleted messages, recoverable until your provider purges them."
      phase="Phase 3 — mail client"
      icon={<DeleteRegular />}
    />
  );
}
