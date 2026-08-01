"use client";

import { useRef, useEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";
import Spinner from "@/components/ui/Spinner";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onAttach?: (file: File) => void;
  onVoiceToggle?: () => void;
  isLoading: boolean;
  isUploading?: boolean;
  isRecording?: boolean;
  uploadingFileName?: string;
  uploadStatus?: string;
  voiceStatus?: string;
  imagePreview?: string | null;
  onRemoveImage?: () => void;
  disabled?: boolean;
};

/**
 * Auto-resizing textarea + Send button.
 * Enter sends, Shift+Enter inserts a newline.
 */
export default function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  onAttach,
  onVoiceToggle,
  isLoading,
  isUploading = false,
  isRecording = false,
  uploadingFileName,
  uploadStatus,
  voiceStatus,
  imagePreview,
  onRemoveImage,
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Auto-resize the textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`; // cap at 200px
  }, [value]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file && onAttach) {
      onAttach(file);
    }
    event.target.value = "";
  }

  const canSend =
    (!isLoading && !isUploading && !disabled && (value.trim().length > 0 || Boolean(imagePreview)));

  return (
    <div
      className={`relative flex items-end gap-3 rounded-2xl border bg-slate-800/60 px-4 py-3 transition focus-within:ring-2 focus-within:ring-blue-500/50 ${
        focused ? "border-blue-500/50" : "border-slate-700"
      }`}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Ask anything... Enter to send, Shift+Enter for newline"
        rows={1}
        autoFocus
        aria-multiline="true"
        disabled={isLoading || disabled}
        className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent text-[15px] text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-50"
        aria-label="Chat message"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.csv,image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {onVoiceToggle ? (
        <button
          type="button"
          onClick={onVoiceToggle}
          disabled={isLoading || disabled || isUploading}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
            isRecording
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-slate-700 text-slate-200 hover:bg-slate-600"
          } disabled:cursor-not-allowed disabled:bg-slate-700/50 disabled:text-slate-500`}
          aria-label={isRecording ? "Stop voice recording" : "Start voice recording"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M12 14.25a3.75 3.75 0 0 0 3.75-3.75V5.25A3.75 3.75 0 0 0 8.25 5.25v5.25A3.75 3.75 0 0 0 12 14.25Zm-6.75 0A.75.75 0 0 0 4.5 15v.75a6.75 6.75 0 0 0 13.5 0V15a.75.75 0 0 0-1.5 0v.75a5.25 5.25 0 0 1-10.5 0V15a.75.75 0 0 0-.75-.75Zm6.75-10.5A2.25 2.25 0 0 1 14.25 5.25v5.25a2.25 2.25 0 0 1-4.5 0V5.25A2.25 2.25 0 0 1 12 3.75Z" />
          </svg>
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading || disabled || isUploading}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-slate-200 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-700/50 disabled:text-slate-500"
        aria-label="Attach file or image"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path d="M16.5 6.75a2.25 2.25 0 0 1 4.5 0v9.75a5.25 5.25 0 0 1-10.5 0V8.25a.75.75 0 0 1 1.5 0v8.25a3.75 3.75 0 0 0 7.5 0V6.75a.75.75 0 0 0-1.5 0v8.25a2.25 2.25 0 1 1-4.5 0V6.75Z" />
        </svg>
      </button>

      {isLoading && onStop ? (
        <button
          type="button"
          onClick={onStop}
          className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700"
          aria-label="Stop generating"
        >
          Stop
        </button>
      ) : null}

      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Send message"
      >
        {isLoading ? (
          <Spinner className="h-5 w-5" label="Sending" />
        ) : (
          /* Arrow-up icon */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        )}
      </button>

      {imagePreview ? (
        <div className="absolute inset-x-4 top-[-3.75rem] z-10 flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-xl">
          <div className="flex items-center gap-2">
            <img src={imagePreview} alt="Selected preview" className="h-10 w-10 rounded-lg object-cover" />
            <span className="text-sm text-slate-200">Image ready</span>
          </div>
          <button
            type="button"
            onClick={onRemoveImage}
            className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
            aria-label="Remove image"
          >
            Remove
          </button>
        </div>
      ) : null}

      {(isUploading || uploadingFileName || uploadStatus || voiceStatus) && (
        <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-2xl bg-slate-900/95 px-4 py-3 text-xs text-slate-300 shadow-xl sm:px-5">
          {uploadingFileName ? (
            <div className="font-semibold text-slate-100">{uploadingFileName}</div>
          ) : null}
          {uploadStatus ? <div className="mt-1">{uploadStatus}</div> : null}
          {voiceStatus ? <div className="mt-1">{voiceStatus}</div> : null}
        </div>
      )}
    </div>
  );
}