"use client";

import { MoneyRegular } from "@fluentui/react-icons";
import { NotBuiltYet } from "../../../components/shell";

export default function Page(): React.JSX.Element {
  return (
    <NotBuiltYet
      title="Spend"
      subtitle="Finances"
      detail="Spend by category over time — continuous across vendor switches, which is the whole point."
      phase="Phase 5 — finance core"
      icon={<MoneyRegular />}
    />
  );
}
