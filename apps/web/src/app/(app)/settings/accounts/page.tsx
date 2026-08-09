"use client";

import { MailRegular } from "@fluentui/react-icons";
import { NotBuiltYet } from "../../../../components/shell";

export default function Page(): React.JSX.Element {
  return (
    <NotBuiltYet
      title="Mail accounts"
      subtitle="Settings"
      detail="Connect Gmail, Outlook or any IMAP mailbox. Credentials are encrypted before they touch the database."
      phase="Phase 3 — mail client"
      icon={<MailRegular />}
    />
  );
}
