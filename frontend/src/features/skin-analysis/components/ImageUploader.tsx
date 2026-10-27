import { useEffect, useRef, useState } from "react";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { validateImageFile } from "../utils/imageValidation";

interface Props {
  onSelect: (file: File | null) => void;
  disabled?: boolean;
}
export default function ImageUploader({ onSelect, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );
  function selectFile(next: File | null) {
    setError(null);
    if (!next) return;
    const issue = validateImageFile(next);
    if (issue) {
      setError(issue);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
      setFile(null);
      setPreview(null);
      onSelect(null);
      return;
    }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = URL.createObjectURL(next);
    setFile(next);
    setPreview(previewRef.current);
    onSelect(next);
  }
  function remove() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setFile(null);
    setPreview(null);
    setError(null);
    onSelect(null);
    if (inputRef.current) inputRef.current.value = "";
  }
  return (
    <Card className="upload-card">
      <div className="section-heading">
        <p className="eyebrow">STEP 01</p>
        <h2>Start with a photo</h2>
        <p className="muted">
          Choose a clear, well-lit photo with your face visible.
        </p>
      </div>
      <input
        ref={inputRef}
        className="visually-hidden-input"
        type="file"
        accept="image/jpeg,image/png"
        disabled={disabled}
        aria-label="Choose a photo"
        onChange={(e) => {
          selectFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {preview ? (
        <div className="image-preview">
          <img src={preview} alt="Selected photo preview" />
          <div className="file-information">
            <span className="file-name">{file?.name}</span>
            <span className="muted">
              {((file?.size ?? 0) / 1048576).toFixed(2)} MB
            </span>
          </div>
          <div className="upload-actions">
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              Change photo
            </Button>
            <Button variant="secondary" disabled={disabled} onClick={remove}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="upload-dropzone"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <span className="upload-icon">↑</span>
          <strong>Choose a photo</strong>
          <span className="muted">JPEG or PNG · Up to 10 MB</span>
        </button>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="privacy-note">
        The preview stays in this browser until you submit with consent.
        SkinWise sends the photo to YouCam for analysis and does not store the
        photo.
      </p>
    </Card>
  );
}
