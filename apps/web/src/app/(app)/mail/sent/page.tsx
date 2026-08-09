"use client";

import { SendRegular } from "@fluentui/react-icons";
import { NotBuiltYet } from "../../../../components/shell";

export default function Page(): React.JSX.Element {
  return (
    <NotBuiltYet
      title="Sent"
      subtitle="Mail"
      detail="Messages you've sent, including replies filed against a vendor or case."
      phase="Phase 3 — mail client"
      icon={<SendRegular />}
    />
  );
}
