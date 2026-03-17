"use client";

import { JXL_UPLOAD_ENABLED } from "@/lib/upload-rules";
import { ChangeEvent, DragEvent, useRef, useState } from "react";

function formatSelectionText(count: number) {
  if (count === 0) {
    return "No files selected yet";
  }

  if (count === 1) {
    return "1 image selected";
  }

  return `${count} images selected`;
}

type UploadAreaProps = {
  onFilesSelected: (files: File[]) => void;
  errorMessage?: string;
  successMessage?: string;
  onDismissMessage?: () => void;
};

export function UploadArea({
  onFilesSelected,
  errorMessage,
  successMessage,
  onDismissMessage,
}: UploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);

  const handleSelectedFiles = (fileList: FileList) => {
    const files = Array.from(fileList);
    setSelectedCount(files.length);
    onFilesSelected(files);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleSelectedFiles(event.dataTransfer.files);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const onDragEnter = () => {
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      handleSelectedFiles(event.target.files);
    } else {
      setSelectedCount(0);
    }
    event.target.value = "";
  };

  const acceptTypes = JXL_UPLOAD_ENABLED
    ? "image/png,image/jpeg,image/jpg,image/webp,image/jxl,.jxl"
    : "image/png,image/jpeg,image/jpg,image/webp";

  return (
    <section
      className={`upload-area ${isDragging ? "is-dragging" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        className="file-input"
        type="file"
        accept={acceptTypes}
        multiple
        onChange={onFileChange}
      />
      <p className="upload-title">Drop your images here or click to upload</p>
      <p className="upload-subtitle">
        We&apos;ll compress them in their original format and get them ready to download in seconds.
      </p>
      <p className="upload-meta">{formatSelectionText(selectedCount)}</p>
      <div className="upload-helper" aria-label="Upload limits and privacy">
        <p>
          {JXL_UPLOAD_ENABLED
            ? "Supports PNG, JPG, WebP, JXL"
            : "Supports PNG, JPG, WebP"}
        </p>
        <p>Max 10MB each, up to 20 files</p>
        <p>
          {JXL_UPLOAD_ENABLED
            ? "JXL uploads can be downloaded as PNG or JPG"
            : "Output stays in the same format after compression"}
        </p>
        <p>Processed instantly and not stored</p>
      </div>
      {errorMessage ? (
        <div className="upload-message upload-message-error" role="alert">
          <p className="upload-message-text">{errorMessage}</p>
          {onDismissMessage ? (
            <button
              type="button"
              className="upload-message-dismiss"
              onClick={(event) => {
                event.stopPropagation();
                onDismissMessage();
              }}
              aria-label="Dismiss message"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
      {!errorMessage && successMessage ? (
        <div className="upload-message upload-message-success" role="status">
          <p className="upload-message-text">{successMessage}</p>
          {onDismissMessage ? (
            <button
              type="button"
              className="upload-message-dismiss"
              onClick={(event) => {
                event.stopPropagation();
                onDismissMessage();
              }}
              aria-label="Dismiss message"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
