export type ExportVariant = {
  label: string;
  outputName: string;
  compressedSize: number;
  width: number;
  height: number;
  mimeType: string;
  base64: string;
};

export type FormatExport = {
  label: string;
  outputName: string;
  compressedSize: number;
  width: number;
  height: number;
  mimeType: string;
  base64: string;
};

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
  width?: number;
  height?: number;
  variants?: ExportVariant[];
  formatExports?: FormatExport[];
  formatMessage?: string;
  error?: string;
};

type ResultsListProps = {
  items: UploadItem[];
  onDownload: (item: UploadItem) => void;
  onDownloadVariant: (variant: ExportVariant) => void;
  onDownloadFormatExport: (formatExport: FormatExport) => void;
  onDownloadAll: () => void;
  canDownloadAll: boolean;
  isDownloadingAll: boolean;
};

function getFormatLabel(mimeType?: string) {
  if (mimeType === "image/png") {
    return "PNG";
  }

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return "JPG";
  }

  if (mimeType === "image/webp") {
    return "WebP";
  }

  if (mimeType === "image/jxl") {
    return "JPEG-XL";
  }

  return "Image";
}

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getStatusLabel(status: UploadItem["status"]) {
  if (status === "loading") {
    return "Processing";
  }

  if (status === "error") {
    return "Failed";
  }

  return "Done";
}

export function ResultsList({
  items,
  onDownload,
  onDownloadVariant,
  onDownloadFormatExport,
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
          <p className="results-empty-title">Your optimized files will appear here.</p>
          <p className="results-empty-copy">
            Upload images to preview savings, compare export sizes, and download them individually or as a ZIP.
          </p>
        </div>
      ) : (
        <div className="result-list">
          {items.map((item) => (
            <article
              key={item.id}
              className={`result-item result-item-${item.status}`}
            >
              <div className="result-main">
                <div className="result-topline">
                  <p className="result-name">{item.fileName}</p>
                  <span
                    className={`result-status ${
                      item.status === "error"
                        ? "error"
                        : item.status === "success"
                          ? "success"
                          : ""
                    }`}
                  >
                    {getStatusLabel(item.status)}
                  </span>
                </div>
                {item.status === "loading" && (
                  <>
                    <p className="result-meta">
                      Uploading and compressing your image...
                    </p>
                    <div className="result-facts">
                      <div className="result-fact">
                        <span className="result-fact-label">Original</span>
                        <span className="result-fact-value">
                          {formatBytes(item.originalSize)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
                {item.status === "error" && (
                  <>
                    <p className="result-error">
                      {item.error ?? "We couldn't process this file."}
                    </p>
                    <div className="result-facts">
                      <div className="result-fact">
                        <span className="result-fact-label">Original</span>
                        <span className="result-fact-value">
                          {formatBytes(item.originalSize)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
                {item.status === "success" && (
                  <>
                    <div className="result-facts">
                      <div className="result-fact">
                        <span className="result-fact-label">Original</span>
                        <span className="result-fact-value">
                          {formatBytes(item.originalSize)}
                        </span>
                      </div>
                      <div className="result-fact">
                        <span className="result-fact-label">Compressed</span>
                        <span className="result-fact-value">
                          {formatBytes(item.compressedSize ?? 0)}
                        </span>
                      </div>
                      <div className="result-fact result-fact-highlight">
                        <span className="result-fact-label">Saved</span>
                        <span className="result-fact-value">
                          {item.savedPercent ?? 0}%
                        </span>
                      </div>
                      <div className="result-fact">
                        <span className="result-fact-label">Format</span>
                        <span className="result-fact-value">
                          {getFormatLabel(item.mimeType)}
                        </span>
                      </div>
                    </div>
                    <p className="result-meta">
                      {item.width && item.height
                        ? `${item.width}×${item.height} output ready to download.`
                        : "Compressed output ready to download."}
                    </p>
                    {item.formatMessage ? (
                      <p className="result-format-note">{item.formatMessage}</p>
                    ) : null}
                    {item.formatExports && item.formatExports.length > 0 ? (
                      <div className="variant-list">
                        {item.formatExports.map((formatExport) => (
                          <div
                            key={formatExport.outputName}
                            className="variant-item"
                          >
                            <span className="variant-label">
                              {formatExport.label}
                            </span>
                            <span className="variant-meta">
                              {formatExport.width}×{formatExport.height}
                            </span>
                            <span className="variant-meta">
                              {formatBytes(formatExport.compressedSize)}
                            </span>
                            <button
                              type="button"
                              className="variant-download-button"
                              onClick={() =>
                                onDownloadFormatExport(formatExport)
                              }
                            >
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {item.variants && item.variants.length > 0 ? (
                      <div className="variant-list">
                        {item.variants.map((variant) => (
                          <div key={variant.outputName} className="variant-item">
                            <span className="variant-label">{variant.label}</span>
                            <span className="variant-meta">
                              {variant.width}×{variant.height}
                            </span>
                            <span className="variant-meta">
                              {formatBytes(variant.compressedSize)}
                            </span>
                            <button
                              type="button"
                              className="variant-download-button"
                              onClick={() => onDownloadVariant(variant)}
                            >
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
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
