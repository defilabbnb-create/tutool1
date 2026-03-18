"use client";

import React from "react";

type UpgradeEntryProps = {
  variant: "limit" | "post-success" | "repeat-user";
  onNotifyClick?: () => void;
};

const COPY_BY_VARIANT = {
  limit: {
    title: "Need to compress more than 10 images?",
    description: "Join the waitlist for larger batch mode.",
  },
  "post-success": {
    title: "Compressing many images?",
    description: "We’re building faster batch processing and API access.",
  },
  "repeat-user": {
    title: "Working with lots of images?",
    description: "Get notified when larger batch limits are available.",
  },
} as const;

export function scrollToNotifySection() {
  document.getElementById("notify-section")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export function UpgradeEntry({
  variant,
  onNotifyClick,
}: UpgradeEntryProps) {
  const copy = COPY_BY_VARIANT[variant];

  return (
    <div className="upgrade-entry" data-variant={variant}>
      <p className="upgrade-entry-title">{copy.title}</p>
      <p className="upgrade-entry-description">{copy.description}</p>
      <button
        type="button"
        className="upgrade-entry-button"
        onClick={onNotifyClick ?? scrollToNotifySection}
      >
        Notify me
      </button>
    </div>
  );
}
