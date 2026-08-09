"use client";

import { TagRegular } from "@fluentui/react-icons";
import { NotBuiltYet } from "../../../components/shell";

export default function Page(): React.JSX.Element {
  return (
    <NotBuiltYet
      title="Categories"
      subtitle="Finances"
      detail="What you're tracking — Power, Broadband, Insurance — independent of whoever currently supplies it."
      phase="Phase 5 — finance core"
      icon={<TagRegular />}
    />
  );
}
