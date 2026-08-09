"use client";

import { BuildingShopRegular } from "@fluentui/react-icons";
import { NotBuiltYet } from "../../../components/shell";

export default function Page(): React.JSX.Element {
  return (
    <NotBuiltYet
      title="Companies"
      subtitle="Relationships"
      detail="The vendors and companies you deal with — with every message, case and bill attached to them."
      phase="Phase 4 — relationships"
      icon={<BuildingShopRegular />}
    />
  );
}
