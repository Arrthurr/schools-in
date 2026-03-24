"use client";

import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const MAX_NOTE_LENGTH = 500;

interface SessionNoteEditorProps {
  initialValue?: string;
  onSave: (noteText: string) => Promise<boolean>;
  onCancel?: () => void;
  placeholder?: string;
  compact?: boolean;
}

export const SessionNoteEditor: React.FC<SessionNoteEditorProps> = ({
  initialValue = "",
  onSave,
  onCancel,
  placeholder = "Add a note (e.g., reason for early checkout, session cancellation)...",
  compact = false,
}) => {
  const [noteText, setNoteText] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const charCount = noteText.length;
  const isOverLimit = charCount > MAX_NOTE_LENGTH;
  const hasChanged = noteText !== initialValue;

  const handleSave = async () => {
    if (isOverLimit || saving) return;

    setSaving(true);
    setSaved(false);
    try {
      const success = await onSave(noteText.trim());
      if (success) {
        setSaved(true);
        timerRef.current = setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder={placeholder}
        className={compact ? "min-h-[60px]" : "min-h-[100px]"}
        maxLength={MAX_NOTE_LENGTH + 50} // Allow slight overtype for UX, enforce on save
        aria-label="Session note"
      />
      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${
            isOverLimit
              ? "text-destructive font-medium"
              : charCount > MAX_NOTE_LENGTH * 0.9
                ? "text-amber-600"
                : "text-muted-foreground"
          }`}
        >
          {charCount}/{MAX_NOTE_LENGTH}
        </span>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-green-600">Saved</span>
          )}
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || isOverLimit || !hasChanged}
          >
            {saving ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Note"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
