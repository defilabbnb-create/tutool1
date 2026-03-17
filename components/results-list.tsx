export type UploadItem = {
  id: string;
  fileName: string;
  originalSize: number;
  status: "loading" | "success" | "error";
  compressedSize?: number;
  savedPercent?: number;
  outputName?: string;
  mimeType?: string;
  base64?: string;
  error?: string;
};

type ResultsListProps = {
  items: UploadItem[];
  onDownload: (item: UploadItem) => void;
  onDownloadAll: () => void;
  canDownloadAll: boolean;
  isDownloadingAll: boolean;
};

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function ResultsList({
  items,
  onDownload,
  onDownloadAll,
  canDownloadAll,
  isDownloadingAll,
}: ResultsListProps) {
  return (
    <section className="results" aria-label="Compression results">
      <div className="results-header">
        <h2>Results</h2>
        <button
          type="button"
          className="download-all-button"
          onClick={onDownloadAll}
          disabled={!canDownloadAll || isDownloadingAll}
        >
          {isDownloadingAll ? "Preparing ZIP..." : "Download All"}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="results-empty">
          <p className="results-empty-title">Your compressed files will show up here.</p>
          <p className="results-empty-copy">
            Drop in a few images to preview savings and download them one by one or as a ZIP.
          </p>
        </div>
      ) : (
        <div className="result-list">
          {items.map((item) => (
            <article key={item.id} className="result-item">
              <div className="result-main">
                <p className="result-name">{item.fileName}</p>
                {item.status === "loading" && (
                  <p className="result-meta">Processing...</p>
                )}
                {item.status === "error" && (
                  <p className="result-error">{item.error ?? "Upload failed."}</p>
                )}
                {item.status === "success" && (
                  <p className="result-meta">
                    {formatBytes(item.originalSize)} →{" "}
                    {formatBytes(item.compressedSize ?? 0)} ({item.savedPercent ?? 0}
                    % saved)
                  </p>
                )}
              </div>

              <div className="result-actions">
                {item.status === "loading" && (
                  <span className="result-status">Processing</span>
                )}
                {item.status === "error" && (
                  <span className="result-status error">Failed</span>
                )}
                {item.status === "success" && (
                  <button
                    type="button"
                    className="download-button"
                    onClick={() => onDownload(item)}
                  >
                    Download
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
