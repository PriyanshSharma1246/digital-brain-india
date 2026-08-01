export function sanitizeTextInput(value: string, options?: { maxLength?: number; preserveLineBreaks?: boolean }) {
  const maxLength = options?.maxLength ?? 4000;
  const normalized = value
    .replace(/\u0000/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim();

  const collapsed = options?.preserveLineBreaks
    ? normalized.replace(/[\t\r]+/g, " ")
    : normalized.replace(/\s+/g, " ");

  return collapsed.slice(0, maxLength);
}

export function sanitizeTagInput(value: string) {
  return value
    .split(",")
    .map((tag) => sanitizeTextInput(tag, { maxLength: 32 }).replace(/[^a-zA-Z0-9._-]/g, ""))
    .filter(Boolean);
}

export function sanitizeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export function validateUploadFile(file: File, allowedExtensions: string[], maxBytes: number) {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return { ok: false, error: "Unsupported file type" };
  }

  if (file.size > maxBytes) {
    return { ok: false, error: `File exceeds the ${maxBytes / (1024 * 1024)}MB limit` };
  }

  return { ok: true };
}
