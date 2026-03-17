"use client";

import { BookmarkPrompt } from "@/components/bookmark-prompt";
import { FeaturePoints } from "@/components/feature-points";
import { Header } from "@/components/header";
import { RecentUploads } from "@/components/recent-uploads";
import {
  ExportVariant,
  FormatExport,
  ResultsList,
  UploadItem,
} from "@/components/results-list";
import { UploadArea } from "@/components/upload-area";
import { analyticsEvents, trackEvent } from "@/lib/analytics";
import Link from "next/link";
import {
  EMPTY_FILE_MESSAGE,
  FILE_TOO_LARGE_MESSAGE,
  getUploadValidationError,
  TOO_MANY_FILES_MESSAGE,
  MAX_FILES_PER_UPLOAD,
} from "@/lib/upload-rules";
import { SITE_NAME } from "@/lib/site";
import {
  loadRecentUploads,
  RecentUpload,
  saveRecentUpload,
} from "@/lib/recent-uploads";
import JSZip from "jszip";
import { useCallback, useEffect, useRef, useState } from "react";

type CompressionSuccessResponse = {
  originalName: string;
  outputName: string;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  mimeType: string;
  base64: string;
  width: number;
  height: number;
  variants: ExportVariant[];
  formatExports: FormatExport[];
  formatMessage?: string;
};

type CompressionErrorResponse = {
  error?: string;
};

const UPLOAD_CONCURRENCY = 3;
const RATE_LIMIT_MESSAGE =
  "Too many requests. Please wait a moment and try again.";
const GENERIC_UPLOAD_ERROR =
  "Oops, something went wrong. Please try again later.";
const SUCCESS_MESSAGE =
  "Your image has been successfully compressed. Download it below.";

type LandingClientProps = {
  title: string;
  subtitle: string;
  intro: string;
  featurePoints?: string[];
  benefitTitle: string;
  benefits: string[];
  faqTitle?: string;
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
  relatedLinks?: Array<{
    href: string;
    label: string;
  }>;
  trackHomepageVisit?: boolean;
  enableRetention?: boolean;
};

function createItemId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function base64ToBlob(base64: string, mimeType: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function triggerDownload(fileName: string, mimeType: string, base64: string) {
  const blob = base64ToBlob(base64, mimeType);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

function getUniqueFileName(fileName: string, usedNames: Set<string>) {
  if (!usedNames.has(fileName)) {
    usedNames.add(fileName);
    return fileName;
  }

  const dotIndex = fileName.lastIndexOf(".");
  const hasExtension = dotIndex > 0;
  const baseName = hasExtension ? fileName.slice(0, dotIndex) : fileName;
  const extension = hasExtension ? fileName.slice(dotIndex) : "";

  let attempt = 2;
  let nextName = `${baseName}-${attempt}${extension}`;

  while (usedNames.has(nextName)) {
    attempt += 1;
    nextName = `${baseName}-${attempt}${extension}`;
  }

  usedNames.add(nextName);
  return nextName;
}

export function LandingClient({
  title,
  subtitle,
  intro,
  featurePoints = [
    "Smaller image files without the usual back-and-forth",
    "Batch optimize multiple images in one go",
    "Ready-to-use WebP downloads for faster websites",
  ],
  benefitTitle,
  benefits,
  faqTitle = "Quick answers",
  faqs = [],
  relatedLinks = [],
  trackHomepageVisit = false,
  enableRetention = false,
}: LandingClientProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [isRecentExpanded, setIsRecentExpanded] = useState(false);
  const [showBookmarkPrompt, setShowBookmarkPrompt] = useState(false);
  const [hasShownBookmarkHint, setHasShownBookmarkHint] = useState(false);
  const hasTrackedVisit = useRef(false);

  useEffect(() => {
    if (!trackHomepageVisit || hasTrackedVisit.current) {
      return;
    }

    hasTrackedVisit.current = true;
    trackEvent(analyticsEvents.homepageVisit);
  }, [trackHomepageVisit]);

  useEffect(() => {
    if (!enableRetention) {
      return;
    }

    setRecentUploads(loadRecentUploads());
  }, [enableRetention]);

  const updateItem = useCallback((id: string, updater: (item: UploadItem) => UploadItem) => {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === id ? updater(item) : item))
    );
  }, []);

  const setItemProgress = useCallback(
    (id: string, progress: number, stage: UploadItem["stage"]) => {
      updateItem(id, (item) => ({
        ...item,
        stage,
        progress,
      }));
    },
    [updateItem]
  );

  const uploadFile = useCallback(
    async (file: File, id: string) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        setItemProgress(id, 6, "uploading");

        const data = await new Promise<CompressionSuccessResponse>((resolve, reject) => {
          const request = new XMLHttpRequest();
          let hasStartedProcessing = false;
          let progressTimer: number | undefined;

          const clearProgressTimer = () => {
            if (progressTimer) {
              window.clearInterval(progressTimer);
            }
          };

          const startProcessingState = () => {
            if (hasStartedProcessing) {
              return;
            }

            hasStartedProcessing = true;
            setItemProgress(id, 92, "processing");
            progressTimer = window.setInterval(() => {
              updateItem(id, (item) => {
                const nextProgress = Math.min((item.progress ?? 92) + 1, 98);
                return {
                  ...item,
                  stage: "processing",
                  progress: nextProgress,
                };
              });
            }, 220);
          };

          request.open("POST", "/api/compress");

          request.upload.addEventListener("progress", (event) => {
            if (!event.lengthComputable) {
              return;
            }

            const nextProgress = Math.min(
              90,
              Math.max(6, Math.round((event.loaded / event.total) * 90))
            );
            setItemProgress(id, nextProgress, "uploading");
          });

          request.addEventListener("readystatechange", () => {
            if (request.readyState >= XMLHttpRequest.HEADERS_RECEIVED) {
              startProcessingState();
            }
          });

          request.addEventListener("load", () => {
            clearProgressTimer();

            const responseJson = JSON.parse(
              request.responseText || "{}"
            ) as CompressionSuccessResponse & CompressionErrorResponse;

            if (request.status >= 200 && request.status < 300) {
              resolve(responseJson);
              return;
            }

            reject(
              new Error(
                responseJson.error ?? GENERIC_UPLOAD_ERROR
              )
            );
          });

          request.addEventListener("error", () => {
            clearProgressTimer();
            reject(new Error(GENERIC_UPLOAD_ERROR));
          });

          request.addEventListener("abort", () => {
            clearProgressTimer();
            reject(new Error(GENERIC_UPLOAD_ERROR));
          });

          request.send(formData);
        });
        setItemProgress(id, 100, "processing");

        trackEvent(analyticsEvents.uploadSuccess, {
          sourceType: file.type || "unknown",
        });

        if (enableRetention) {
          const nextRecentUpload: RecentUpload = {
            id: createItemId(),
            originalName: data.originalName,
            outputName: data.outputName,
            originalSize: data.originalSize,
            compressedSize: data.compressedSize,
            savedPercent: data.savedPercent,
            mimeType: data.mimeType,
            base64: data.base64,
            width: data.width,
            height: data.height,
            createdAt: Date.now(),
          };

          saveRecentUpload(nextRecentUpload);
          setRecentUploads(loadRecentUploads());
          setShowBookmarkPrompt(true);
          setHasShownBookmarkHint(false);
        }

        setSuccessMessage(SUCCESS_MESSAGE);
        setSelectionError("");

        updateItem(id, (item) => ({
          ...item,
          status: "success",
          progress: 100,
          stage: undefined,
          compressedSize: data.compressedSize,
          savedPercent: data.savedPercent,
          outputName: data.outputName,
          mimeType: data.mimeType,
          base64: data.base64,
          width: data.width,
          height: data.height,
          variants: data.variants,
          formatExports: data.formatExports,
          formatMessage: data.formatMessage,
          error: undefined,
        }));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : GENERIC_UPLOAD_ERROR;

        if (message === RATE_LIMIT_MESSAGE) {
          setSelectionError(RATE_LIMIT_MESSAGE);
        } else if (message === EMPTY_FILE_MESSAGE || message === FILE_TOO_LARGE_MESSAGE) {
          setSelectionError(message);
        } else if (message.includes("supported")) {
          setSelectionError(message);
        }

        trackEvent(analyticsEvents.uploadFailed, {
          reason: message,
        });

        updateItem(id, (item) => ({
          ...item,
          status: "error",
          progress: undefined,
          stage: undefined,
          error: message,
        }));
      }
    },
    [enableRetention, setItemProgress, updateItem]
  );

  const processUploadQueue = useCallback(
    async (entries: Array<{ file: File; id: string }>) => {
      let nextIndex = 0;

      async function worker() {
        while (nextIndex < entries.length) {
          const entry = entries[nextIndex];
          nextIndex += 1;

          if (!entry) {
            return;
          }

          await uploadFile(entry.file, entry.id);
        }
      }

      const workers = Array.from(
        { length: Math.min(UPLOAD_CONCURRENCY, entries.length) },
        () => worker()
      );

      await Promise.all(workers);
    },
    [uploadFile]
  );

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      if (files.length > MAX_FILES_PER_UPLOAD) {
        setSelectionError(TOO_MANY_FILES_MESSAGE);
        setSuccessMessage("");
        trackEvent(analyticsEvents.uploadFailed, {
          reason: "too_many_files",
        });
        return;
      }

      setSelectionError("");
      setSuccessMessage("");

      const validFiles: File[] = [];
      const invalidItems: UploadItem[] = [];

      files.forEach((file) => {
        const validationError = getUploadValidationError({
          name: file.name,
          type: file.type,
          size: file.size,
        });

        if (validationError) {
          const reason =
            validationError === FILE_TOO_LARGE_MESSAGE
              ? "file_too_large"
              : validationError === EMPTY_FILE_MESSAGE
                ? "empty_file"
                : "invalid_upload";

          trackEvent(analyticsEvents.uploadFailed, {
            reason,
          });
          invalidItems.push({
            id: createItemId(),
            fileName: file.name,
            originalSize: file.size,
            status: "error",
            error: validationError,
          });
          return;
        }

        validFiles.push(file);
      });

      const newItems: UploadItem[] = validFiles.map((file) => ({
        id: createItemId(),
        fileName: file.name,
        originalSize: file.size,
        status: "loading",
        progress: 0,
        stage: "uploading",
      }));

      if (validFiles.length > 0) {
        trackEvent(analyticsEvents.uploadStarted, {
          count: validFiles.length,
        });
      }

      setItems((currentItems) => [...newItems, ...invalidItems, ...currentItems]);
      void processUploadQueue(
        newItems.map((item, index) => ({
          file: validFiles[index],
          id: item.id,
        }))
      );
    },
    [processUploadQueue]
  );

  const handleDownload = useCallback((item: UploadItem) => {
    if (
      item.status !== "success" ||
      !item.outputName ||
      !item.mimeType ||
      !item.base64
    ) {
      return;
    }

    trackEvent(analyticsEvents.downloadSingle, {
      fileName: item.outputName,
    });
    triggerDownload(item.outputName, item.mimeType, item.base64);
    if (enableRetention) {
      setShowBookmarkPrompt(true);
      setHasShownBookmarkHint(false);
    }
  }, []);

  const handleDownloadVariant = useCallback((variant: ExportVariant) => {
    trackEvent(analyticsEvents.downloadSingle, {
      fileName: variant.outputName,
    });
    triggerDownload(variant.outputName, variant.mimeType, variant.base64);
    if (enableRetention) {
      setShowBookmarkPrompt(true);
      setHasShownBookmarkHint(false);
    }
  }, []);

  const handleDownloadFormatExport = useCallback((formatExport: FormatExport) => {
    trackEvent(analyticsEvents.downloadSingle, {
      fileName: formatExport.outputName,
    });
    triggerDownload(
      formatExport.outputName,
      formatExport.mimeType,
      formatExport.base64
    );
    if (enableRetention) {
      setShowBookmarkPrompt(true);
      setHasShownBookmarkHint(false);
    }
  }, [enableRetention]);

  const handleDownloadAll = useCallback(async () => {
    const successfulItems = items.filter(
      (item) =>
        item.status === "success" &&
        Boolean(item.outputName) &&
        Boolean(item.base64)
    );

    if (successfulItems.length === 0) {
      return;
    }

    setIsDownloadingAll(true);
    setSelectionError("");
    trackEvent(analyticsEvents.downloadAllZip, {
      count: successfulItems.length,
    });

    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();

      successfulItems.forEach((item) => {
        if (!item.outputName || !item.base64) {
          return;
        }

        zip.file(getUniqueFileName(item.outputName, usedNames), item.base64, {
          base64: true,
        });

        item.variants?.forEach((variant) => {
          zip.file(
            getUniqueFileName(variant.outputName, usedNames),
            variant.base64,
            { base64: true }
          );
        });

        item.formatExports?.forEach((formatExport) => {
          zip.file(
            getUniqueFileName(formatExport.outputName, usedNames),
            formatExport.base64,
            { base64: true }
          );
        });
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "images.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (enableRetention) {
        setShowBookmarkPrompt(true);
        setHasShownBookmarkHint(false);
      }
    } catch {
      setSelectionError("Unable to prepare the ZIP download right now.");
    } finally {
      setIsDownloadingAll(false);
    }
  }, [enableRetention, items]);

  const handleRecentRecompress = useCallback(
    (item: RecentUpload) => {
      const recentBlob = base64ToBlob(item.base64, item.mimeType);
      const recentFile = new File([recentBlob], item.outputName, {
        type: item.mimeType,
      });
      const recentItemId = createItemId();

      setItems((currentItems) => [
        {
          id: recentItemId,
          fileName: item.originalName,
          originalSize: item.compressedSize,
          status: "loading",
        },
        ...currentItems,
      ]);
      void processUploadQueue([{ file: recentFile, id: recentItemId }]);
    },
    [processUploadQueue]
  );

  const canDownloadAll = items.some((item) => item.status === "success");

  return (
    <main className="page">
      <Header eyebrow={SITE_NAME} title={title} subtitle={subtitle} />
      <section className="landing-copy">
        <p className="landing-intro">{intro}</p>
      </section>
      {enableRetention ? (
        <RecentUploads
          items={recentUploads}
          isExpanded={isRecentExpanded}
          onToggle={() => setIsRecentExpanded((current) => !current)}
          onRecompress={handleRecentRecompress}
        />
      ) : null}
      <UploadArea
        onFilesSelected={handleFilesSelected}
        errorMessage={selectionError}
        successMessage={successMessage}
        onDismissMessage={() => {
          setSelectionError("");
          setSuccessMessage("");
        }}
      />
      {enableRetention ? (
        <div className="recent-uploads-cta">
          <button
            type="button"
            className="recent-toggle-button"
            onClick={() => setIsRecentExpanded((current) => !current)}
          >
            {isRecentExpanded ? "Hide recent files" : "View recent files"}
          </button>
        </div>
      ) : null}
      {enableRetention ? (
        <BookmarkPrompt
          visible={showBookmarkPrompt}
          hasShownHint={hasShownBookmarkHint}
          onBookmark={() => setHasShownBookmarkHint(true)}
          onDismiss={() => setShowBookmarkPrompt(false)}
        />
      ) : null}
      <FeaturePoints points={featurePoints} />
      <section className="benefits" aria-label="Benefits">
        <h2>{benefitTitle}</h2>
        <div className="benefit-list">
          {benefits.map((benefit) => (
            <p key={benefit} className="benefit-item">
              {benefit}
            </p>
          ))}
        </div>
      </section>
      {faqs.length > 0 ? (
        <section className="faq" aria-label="Frequently asked questions">
          <h2>{faqTitle}</h2>
          <div className="faq-list">
            {faqs.map((faq) => (
              <div key={faq.question} className="faq-item">
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {relatedLinks.length > 0 ? (
        <section className="related-links" aria-label="Related tools">
          <h2>Explore more tools</h2>
          <div className="related-link-list">
            {relatedLinks.map((link) => (
              <Link key={link.href} href={link.href} className="related-link">
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <ResultsList
        items={items}
        onDownload={handleDownload}
        onDownloadVariant={handleDownloadVariant}
        onDownloadFormatExport={handleDownloadFormatExport}
        onDownloadAll={handleDownloadAll}
        canDownloadAll={canDownloadAll}
        isDownloadingAll={isDownloadingAll}
      />
    </main>
  );
}
