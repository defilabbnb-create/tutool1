"use client";

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
};

export function UploadArea({ onFilesSelected, errorMessage }: UploadAreaProps) {
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
        accept="image/png,image/jpeg,image/jpg,image/webp"
        multiple
        onChange={onFileChange}
      />
      <p className="upload-title">Drag & drop images here</p>
      <p className="upload-subtitle">or click to select PNG, JPG, WebP</p>
      <p className="upload-meta">{formatSelectionText(selectedCount)}</p>
      {errorMessage ? <p className="upload-error">{errorMessage}</p> : null}
    </section>
  );
}
