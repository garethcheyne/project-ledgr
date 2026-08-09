"use client";

import { PersonRegular } from "@fluentui/react-icons";
import { NotBuiltYet } from "../../../components/shell";

export default function Page(): React.JSX.Element {
  return (
    <NotBuiltYet
      title="Contacts"
      subtitle="Relationships"
      detail="People at the companies you deal with, synced from your provider's address book."
      phase="Phase 7 — calendar and contacts"
      icon={<PersonRegular />}
    />
  );
}
