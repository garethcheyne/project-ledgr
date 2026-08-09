"use client";

import {
  BuildingShopRegular,
  DocumentBulletListRegular,
  HomeRegular,
  MailRegular,
  MoneyRegular,
  ReceiptRegular,
  SendRegular,
  TagRegular,
  DocumentEditRegular,
  DeleteRegular,
  PersonRegular,
  ArrowSyncRegular,
} from "@fluentui/react-icons";
import type { NavGroup } from "../components/shell";

/**
 * Ledgr's navigation, grouped the way a Dynamics 365 model-driven app is:
 * a pinned Home, then groups by area rather than one flat list.
 *
 * Counts are passed in rather than fetched here, so the nav stays a pure
 * function of state and doesn't trigger requests of its own.
 */
export function buildNavGroups(counts?: {
  inboxUnread?: number;
  reviewQueue?: number;
}): NavGroup[] {
  return [
    {
      items: [{ key: "home", label: "Home", href: "/home", icon: <HomeRegular /> }],
    },
    {
      title: "Mail",
      items: [
        {
          key: "inbox",
          label: "Inbox",
          href: "/mail",
          icon: <MailRegular />,
          badge: counts?.inboxUnread,
        },
        { key: "sent", label: "Sent", href: "/mail/sent", icon: <SendRegular /> },
        { key: "drafts", label: "Drafts", href: "/mail/drafts", icon: <DocumentEditRegular /> },
        { key: "deleted", label: "Deleted", href: "/mail/deleted", icon: <DeleteRegular /> },
      ],
    },
    {
      title: "Relationships",
      items: [
        { key: "entities", label: "Companies", href: "/entities", icon: <BuildingShopRegular /> },
        { key: "cases", label: "Cases", href: "/cases", icon: <DocumentBulletListRegular /> },
        { key: "contacts", label: "Contacts", href: "/contacts", icon: <PersonRegular /> },
      ],
    },
    {
      title: "Finances",
      items: [
        { key: "categories", label: "Categories", href: "/categories", icon: <TagRegular /> },
        {
          key: "subscriptions",
          label: "Subscriptions",
          href: "/subscriptions",
          icon: <ArrowSyncRegular />,
        },
        { key: "bills", label: "Bills", href: "/bills", icon: <ReceiptRegular /> },
        { key: "spend", label: "Spend", href: "/spend", icon: <MoneyRegular /> },
      ],
    },
    {
      title: "Review",
      items: [
        {
          key: "extractions",
          label: "Receipt queue",
          href: "/review",
          icon: <ReceiptRegular />,
          badge: counts?.reviewQueue,
        },
        {
          key: "accounts",
          label: "Mail accounts",
          href: "/settings/accounts",
          icon: <MailRegular />,
        },
      ],
    },
  ];
}
