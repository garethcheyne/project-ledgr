"use client";

import { DocumentBulletListRegular } from "@fluentui/react-icons";
import { NotBuiltYet } from "../../../components/shell";

export default function Page(): React.JSX.Element {
  return (
    <NotBuiltYet
      title="Cases"
      subtitle="Relationships"
      detail="Trackable issues with a vendor: a warranty dispute, a billing error, a complaint in progress."
      phase="Phase 4 — relationships"
      icon={<DocumentBulletListRegular />}
    />
  );
}
