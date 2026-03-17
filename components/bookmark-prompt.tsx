"use client";

type BookmarkPromptProps = {
  visible: boolean;
  hasShownHint: boolean;
  onBookmark: () => void;
  onDismiss: () => void;
};

export function BookmarkPrompt({
  visible,
  hasShownHint,
  onBookmark,
  onDismiss,
}: BookmarkPromptProps) {
  const shortcutKey =
    typeof navigator !== "undefined" && navigator.platform.includes("Mac")
      ? "⌘"
      : "Ctrl";

  if (!visible) {
    return null;
  }

  return (
    <section className="bookmark-prompt" aria-label="Save this tool for later">
      <p className="bookmark-prompt-title">
        Want to use this tool again? Bookmark us for quick access!
      </p>
      <p className="bookmark-prompt-copy">
        Save this tool for later use?
      </p>
      {hasShownHint ? (
        <p className="bookmark-prompt-hint">
          Press {shortcutKey} + D to bookmark this page.
        </p>
      ) : null}
      <div className="bookmark-prompt-actions">
        <button
          type="button"
          className="bookmark-primary-button"
          onClick={onBookmark}
        >
          Yes, Bookmark it
        </button>
        <button
          type="button"
          className="bookmark-secondary-button"
          onClick={onDismiss}
        >
          Later
        </button>
      </div>
    </section>
  );
}
