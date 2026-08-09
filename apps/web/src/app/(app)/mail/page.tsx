"use client";

import { MailRegular } from "@fluentui/react-icons";
import { NotBuiltYet } from "../../../components/shell";

export default function Page(): React.JSX.Element {
  return (
    <NotBuiltYet
      title="Inbox"
      subtitle="Mail"
      detail="Connect a mailbox and your messages appear here — read, reply, and filed against the company they're about."
      phase="Phase 3 — mail client"
      icon={<MailRegular />}
    />
  );
}
