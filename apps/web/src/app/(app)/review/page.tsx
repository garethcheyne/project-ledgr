"use client";

import { ReceiptRegular } from "@fluentui/react-icons";
import { NotBuiltYet } from "../../../components/shell";

export default function Page(): React.JSX.Element {
  return (
    <NotBuiltYet
      title="Receipt queue"
      subtitle="Review"
      detail="OCR and AI extract vendor, amount and billing period from a receipt. Nothing is written until you confirm it."
      phase="Phase 6 — OCR and extraction"
      icon={<ReceiptRegular />}
    />
  );
}
