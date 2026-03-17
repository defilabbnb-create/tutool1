"use client";

import { RecentUpload } from "@/lib/recent-uploads";

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

type RecentUploadsProps = {
  items: RecentUpload[];
  isExpanded: boolean;
  onToggle: () => void;
  onRecompress: (item: RecentUpload) => void;
};

export function RecentUploads({
  items,
  isExpanded,
  onToggle,
  onRecompress,
}: RecentUploadsProps) {
  return (
    <>
      <section className="recent-uploads" aria-label="Recently uploaded">
        <div className="recent-uploads-header">
          <h2>Recently uploaded</h2>
          <button
            type="button"
            className="recent-toggle-button"
            onClick={onToggle}
          >
            {isExpanded ? "Hide recent files" : "View recent files"}
          </button>
        </div>

        {items.length === 0 ? (
          <p className="recent-empty">No recent uploads.</p>
        ) : (
          <div className="recent-upload-grid">
            {items.map((item) => (
              <article key={item.id} className="recent-upload-card">
                <img
                  src={`data:${item.mimeType};base64,${item.base64}`}
                  alt={item.originalName}
                  className="recent-upload-thumb"
                />
                <div className="recent-upload-copy">
                  <p className="recent-upload-name">{item.originalName}</p>
                  <p className="recent-upload-meta">
                    {formatBytes(item.compressedSize)} · {item.width}×{item.height}
                  </p>
                </div>
                <button
                  type="button"
                  className="recent-recompress-button"
                  onClick={() => onRecompress(item)}
                >
                  Recompress
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {isExpanded ? (
        <section className="recent-uploads-detail" aria-label="Recent file details">
          <div className="recent-detail-list">
            {items.length === 0 ? (
              <p className="recent-empty">No recent uploads.</p>
            ) : (
              items.map((item) => (
                <article key={`${item.id}-detail`} className="recent-detail-item">
                  <div className="recent-detail-main">
                    <img
                      src={`data:${item.mimeType};base64,${item.base64}`}
                      alt={item.originalName}
                      className="recent-detail-thumb"
                    />
                    <div className="recent-detail-copy">
                      <p className="recent-upload-name">{item.originalName}</p>
                      <p className="recent-upload-meta">
                        Before {formatBytes(item.originalSize)} · After{" "}
                        {formatBytes(item.compressedSize)} · Saved {item.savedPercent}%
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="recent-recompress-button"
                    onClick={() => onRecompress(item)}
                  >
                    Recompress
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}
