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

export type PreviewOption = {
  label: string;
  quality: number;
  outputName: string;
  compressedSize: number;
  savedPercent: number;
  width: number;
  height: number;
  mimeType: string;
  base64: string;
  methodUsed: string;
  isRecommended: boolean;
};

export type UploadItem = {
  id: string;
  fileName: string;
  originalSize: number;
  status: "loading" | "success" | "error";
  progress?: number;
  stage?: "uploading" | "processing";
  compressedSize?: number;
  savedPercent?: number;
  outputName?: string;
  mimeType?: string;
  base64?: string;
  width?: number;
  height?: number;
  methodUsed?: string;
  variants?: ExportVariant[];
  formatExports?: FormatExport[];
  previewOptions?: PreviewOption[];
  formatMessage?: string;
  error?: string;
};

type ResultsListProps = {
  items: UploadItem[];
  onDownload: (item: UploadItem) => void;
  onDownloadVariant: (variant: ExportVariant) => void;
  onDownloadFormatExport: (formatExport: FormatExport) => void;
  onDownloadPreviewOption: (previewOption: PreviewOption) => void;
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

  if (mimeType === "image/avif") {
    return "AVIF";
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

function getProgressLabel(item: UploadItem) {
  if (item.status !== "loading") {
    return "";
  }

  if (item.stage === "processing") {
    return "Processing your image...";
  }

  return "Uploading your image...";
}

function getPreviewDisplay(quality: number) {
  if (quality === 80) {
    return {
      title: "High quality",
      hint: "Best visual quality",
    };
  }

  if (quality === 60) {
    return {
      title: "Balanced",
      hint: "Best size vs quality",
    };
  }

  return {
    title: "Smallest size",
    hint: "Maximum compression",
  };
}

export function ResultsList({
  items,
  onDownload,
  onDownloadVariant,
  onDownloadFormatExport,
  onDownloadPreviewOption,
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
                      {getProgressLabel(item)}
                    </p>
                    <div
                      className="result-progress"
                      aria-label={`${item.fileName} upload progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(item.progress ?? 0)}
                      role="progressbar"
                    >
                      <div
                        className="result-progress-bar"
                        style={{ width: `${Math.max(6, item.progress ?? 6)}%` }}
                      />
                    </div>
                    <p className="result-progress-text">
                      {Math.round(item.progress ?? 0)}%
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
                      <div className="result-fact">
                        <span className="result-fact-label">Method</span>
                        <span className="result-fact-value">
                          {item.methodUsed ?? "auto"}
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
                    {item.previewOptions && item.previewOptions.length > 0 ? (
                      <>
                        <p className="result-format-note">
                          Lossy preview options are shown below so you can compare size and visual quality before downloading.
                        </p>
                        <div className="preview-option-list">
                        {item.previewOptions.map((previewOption) => (
                          <div
                            key={previewOption.outputName}
                            className={`preview-option-item ${
                              previewOption.isRecommended ? "is-recommended" : ""
                            }`}
                          >
                            {(() => {
                              const previewDisplay = getPreviewDisplay(
                                previewOption.quality
                              );

                              return (
                                <>
                            <div className="preview-option-header">
                              <div className="preview-option-copy">
                                <span className="variant-label">
                                  {previewDisplay.title}
                                </span>
                                <span className="preview-option-hint">
                                  {previewDisplay.hint}
                                </span>
                              </div>
                              {previewOption.isRecommended ? (
                                <span className="preview-option-badge">Recommended lossy</span>
                              ) : null}
                            </div>
                            <img
                              className="preview-option-image"
                              src={`data:${previewOption.mimeType};base64,${previewOption.base64}`}
                              alt={`${previewOption.label} preview`}
                            />
                            <div className="preview-option-meta">
                              <span className="variant-meta">
                                {previewOption.width}×{previewOption.height}
                              </span>
                              <span className="variant-meta">
                                {formatBytes(previewOption.compressedSize)}
                              </span>
                              <span className="variant-meta">
                                Saved {previewOption.savedPercent}%
                              </span>
                            </div>
                            <button
                              type="button"
                              className="variant-download-button"
                              onClick={() => onDownloadPreviewOption(previewOption)}
                            >
                              Download
                            </button>
                                </>
                              );
                            })()}
                          </div>
                        ))}
                        </div>
                      </>
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
