"use client";

import { FeaturePoints } from "@/components/feature-points";
import { Header } from "@/components/header";
import {
  MAX_FILES_PER_UPLOAD,
  MAX_FILE_SIZE_BYTES,
  formatAllowedTypesLabel,
  isAllowedUpload,
} from "@/lib/upload-rules";
import { ResultsList, UploadItem } from "@/components/results-list";
import { UploadArea } from "@/components/upload-area";
import JSZip from "jszip";
import { useCallback, useState } from "react";

type CompressionSuccessResponse = {
  originalName: string;
  outputName: string;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  mimeType: string;
  base64: string;
};

type CompressionErrorResponse = {
  error?: string;
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

export function HomeClient() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [selectionError, setSelectionError] = useState("");

  const updateItem = useCallback((id: string, updater: (item: UploadItem) => UploadItem) => {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === id ? updater(item) : item))
    );
  }, []);

  const uploadFile = useCallback(
    async (file: File, id: string) => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/compress", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorJson = (await response.json().catch(() => ({}))) as CompressionErrorResponse;
          throw new Error(errorJson.error ?? "Compression failed.");
        }

        const data = (await response.json()) as CompressionSuccessResponse;

        updateItem(id, (item) => ({
          ...item,
          status: "success",
          compressedSize: data.compressedSize,
          savedPercent: data.savedPercent,
          outputName: data.outputName,
          mimeType: data.mimeType,
          base64: data.base64,
          error: undefined,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Compression failed.";

        updateItem(id, (item) => ({
          ...item,
          status: "error",
          error: message,
        }));
      }
    },
    [updateItem]
  );

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      if (files.length > MAX_FILES_PER_UPLOAD) {
        setSelectionError(
          `You can upload up to ${MAX_FILES_PER_UPLOAD} files at once.`
        );
        return;
      }

      setSelectionError("");

      const validFiles: File[] = [];
      const invalidItems: UploadItem[] = [];

      files.forEach((file) => {
        if (!isAllowedUpload(file.name, file.type)) {
          invalidItems.push({
            id: createItemId(),
            fileName: file.name,
            originalSize: file.size,
            status: "error",
            error: `Unsupported format. Please upload ${formatAllowedTypesLabel()}.`,
          });
          return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          invalidItems.push({
            id: createItemId(),
            fileName: file.name,
            originalSize: file.size,
            status: "error",
            error: "File is too large. Maximum allowed size is 10MB.",
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
      }));

      setItems((currentItems) => [...newItems, ...invalidItems, ...currentItems]);
      newItems.forEach((item, index) => {
        uploadFile(validFiles[index], item.id);
      });
    },
    [uploadFile]
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

    triggerDownload(item.outputName, item.mimeType, item.base64);
  }, []);

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
    } catch {
      setSelectionError("Unable to prepare the ZIP download right now.");
    } finally {
      setIsDownloadingAll(false);
    }
  }, [items]);

  const canDownloadAll = items.some((item) => item.status === "success");

  return (
    <main className="page">
      <Header
        title="Compress Images in Seconds"
        subtitle="Upload PNG, JPG, or WebP. Reduce size and download instantly."
      />
      <UploadArea
        onFilesSelected={handleFilesSelected}
        errorMessage={selectionError}
      />
      <FeaturePoints
        points={["Fast compression", "Batch download", "WebP output"]}
      />
      <ResultsList
        items={items}
        onDownload={handleDownload}
        onDownloadAll={handleDownloadAll}
        canDownloadAll={canDownloadAll}
        isDownloadingAll={isDownloadingAll}
      />
    </main>
  );
}
