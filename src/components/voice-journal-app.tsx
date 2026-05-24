"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCopyableNoteText,
  getNoteListTitle,
  shouldShowTranscriptPreview
} from "@/lib/note-display";
import { NOTE_TYPE_LABELS, NOTE_TYPES, type NoteType } from "@/lib/note-types";
import {
  formatRecordingDuration,
  getRecordingPrimaryAction,
  getRecordingStatusLabel,
  type RecordingStatus
} from "@/lib/recording-flow";

type VoiceNote = {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: NoteType;
  transcript: string;
  title?: string;
  tags: string[];
};

export function VoiceJournalApp() {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<VoiceNote | null>(null);
  const [editingNote, setEditingNote] = useState<VoiceNote | null>(null);
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [message, setMessage] = useState("מוכן להקלטה חדשה.");
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [type, setType] = useState<NoteType>("thought");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<NoteType | "all">("all");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const shouldDiscardRecordingRef = useRef(false);

  const loadNotes = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (filterType !== "all") {
      params.set("type", filterType);
    }

    const response = await fetch(`/api/notes?${params.toString()}`, {
      cache: "no-store"
    });
    const data = (await response.json()) as { notes: VoiceNote[] };
    setNotes(data.notes ?? []);
  }, [filterType, search]);

  useEffect(() => {
    // Initial and filtered archive loads synchronize this client component with the local API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (status !== "recording") {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [status]);

  const selectedSummary = useMemo(() => {
    if (!selectedNote) {
      return null;
    }
    return noteHeading(selectedNote);
  }, [selectedNote]);

  const groupedNotes = useMemo(
    () =>
      NOTE_TYPES.map((noteType) => ({
        type: noteType,
        notes: notes.filter((note) => note.type === noteType)
      })).filter((group) => group.notes.length > 0),
    [notes]
  );

  const primaryRecordingAction = getRecordingPrimaryAction(status);
  const hasActiveRecording = status === "recording" || status === "paused";

  async function startRecording() {
    setError("");
    setMessage("מבקש הרשאה למיקרופון...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      shouldDiscardRecordingRef.current = false;
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (shouldDiscardRecordingRef.current) {
          chunksRef.current = [];
          shouldDiscardRecordingRef.current = false;
          stopCurrentStream();
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm"
        });
        stopCurrentStream();
        mediaRecorderRef.current = null;
        void transcribeAudio(blob);
      };

      recorder.start();
      setElapsedSeconds(0);
      setStatus("recording");
      setMessage("מקליט עכשיו. אפשר לעצור כשסיימת.");
    } catch {
      setStatus("idle");
      setError("לא הצלחתי לפתוח את המיקרופון. בדוק הרשאות בדפדפן.");
      setMessage("אפשר עדיין להקליד תמלול ידנית ולשמור.");
    }
  }

  function pauseRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      setStatus("paused");
      setMessage("ההקלטה מושהית. אפשר להמשיך מאותה נקודה, לסיים ולתמלל, או להתחיל מההתחלה.");
    }
  }

  function resumeRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      setStatus("recording");
      setMessage("ממשיך להקליט באותה הקלטה.");
    }
  }

  function finishRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      setStatus("transcribing");
      setMessage("מעבד את ההקלטה ומנסה לתמלל...");
      recorder.stop();
    }
  }

  function startOverRecording() {
    shouldDiscardRecordingRef.current = true;
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      stopCurrentStream();
    }

    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setElapsedSeconds(0);
    resetDraft();
    setStatus("idle");
    setMessage("מוכן להקלטה חדשה.");
  }

  function handlePrimaryRecordingAction() {
    if (primaryRecordingAction.action === "pause") {
      pauseRecording();
      return;
    }

    if (primaryRecordingAction.action === "resume") {
      resumeRecording();
      return;
    }

    void startRecording();
  }

  async function transcribeAudio(blob: Blob) {
    setStatus("transcribing");
    const formData = new FormData();
    formData.set("audio", blob, "recording.webm");

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as {
        mode: "manual" | "transcribed";
        transcript: string;
        message?: string;
      };

      setTranscript(data.transcript ?? "");
      setMessage(
        data.mode === "transcribed"
          ? "התמלול מוכן. אפשר לערוך לפני שמירה."
          : data.message ?? "אפשר להקליד את התמלול ידנית."
      );
      setStatus("ready");
    } catch {
      setStatus("ready");
      setMessage("התמלול לא זמין כרגע. אפשר להקליד את הטקסט ידנית.");
    }
  }

  async function saveNote() {
    if (!transcript.trim()) {
      setError("צריך תמלול לפני שמירה.");
      return;
    }

    setStatus("saving");
    setError("");

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          transcript,
          title,
          tags
        })
      });

      if (!response.ok) {
        throw new Error("save failed");
      }

      resetDraft();
      setMessage("הפתק נשמר בארכיון המקומי.");
      await loadNotes();
    } catch {
      setError("שמירת הפתק נכשלה.");
    } finally {
      setStatus("idle");
    }
  }

  async function updateSelectedNote() {
    if (!editingNote) {
      return;
    }

    const response = await fetch(`/api/notes/${editingNote.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: editingNote.type,
        title: editingNote.title ?? "",
        tags: editingNote.tags,
        transcript: editingNote.transcript
      })
    });

    if (!response.ok) {
      setError("העדכון נכשל.");
      return;
    }

    const data = (await response.json()) as { note: VoiceNote };
    setSelectedNote(data.note);
    setEditingNote(null);
    await loadNotes();
  }

  async function deleteNoteById(noteId: string) {
    const confirmed = window.confirm("למחוק את הפתק הזה?");
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/notes/${noteId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      setError("המחיקה נכשלה.");
      return;
    }

    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
      setEditingNote(null);
    }
    await loadNotes();
  }

  async function deleteSelectedNote() {
    if (!selectedNote) {
      return;
    }

    await deleteNoteById(selectedNote.id);
  }

  async function copyNote(note: VoiceNote) {
    try {
      await navigator.clipboard.writeText(getCopyableNoteText(note));
      setCopyMessage("הפתק הועתק ללוח.");
      window.setTimeout(() => setCopyMessage(""), 2400);
    } catch {
      setError("לא הצלחתי להעתיק ללוח. בדפדפן הזה ייתכן שצריך הרשאת Clipboard.");
    }
  }

  function resetDraft() {
    setTranscript("");
    setTitle("");
    setTags("");
    setType("thought");
  }

  function stopCurrentStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>פנקס קולי</h1>
          <p>פנקס פרטי למחשבות, חלומות, רעיונות ותזכורות בקול.</p>
        </div>
        <span
          className={`status-pill ${
            status === "recording" || status === "paused" ? "recording" : ""
          }`}
        >
          {getRecordingStatusLabel(status)}
        </span>
      </header>
      {copyMessage ? <p className="message success app-message">{copyMessage}</p> : null}

      <div className="main-grid">
        <section className="panel recorder-panel" aria-labelledby="recording-title">
          <h2 id="recording-title">הקלטה חדשה</h2>

          <div className="record-zone">
            <div className={`record-orb ${status === "paused" ? "paused" : ""}`}>
              <span className="record-duration">{formatRecordingDuration(elapsedSeconds)}</span>
              <span className="record-state">{getRecordingStatusLabel(status)}</span>
            </div>

            <div className="record-actions" aria-label="פעולות הקלטה">
              <button
                className={`record-button ${
                  primaryRecordingAction.action === "pause" ? "stop" : ""
                }`}
                type="button"
                onClick={handlePrimaryRecordingAction}
                disabled={status === "transcribing" || status === "saving"}
              >
                {primaryRecordingAction.label}
              </button>
              {hasActiveRecording ? (
                <>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={finishRecording}
                  >
                    סיים ותמלל
                  </button>
                  <button
                    className="danger-button subtle"
                    type="button"
                    onClick={startOverRecording}
                  >
                    התחל מההתחלה
                  </button>
                </>
              ) : null}
            </div>
            <p className="record-help">{message}</p>
          </div>

          {error ? <p className="message error">{error}</p> : null}

          <div className="field-grid">
            <label className="field">
              <span>סוג פתק</span>
              <select value={type} onChange={(event) => setType(event.target.value as NoteType)}>
                {NOTE_TYPES.map((noteType) => (
                  <option key={noteType} value={noteType}>
                    {NOTE_TYPE_LABELS[noteType]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>כותרת</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="לא חובה"
              />
            </label>

            <label className="field">
              <span>תמלול</span>
              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="התמלול יופיע כאן, ואפשר גם להקליד ידנית."
              />
            </label>

            <label className="field">
              <span>תגיות</span>
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="למשל: עבודה, חלום, ערב"
              />
            </label>

            <div className="button-row">
              <button
                className="primary-button"
                type="button"
                onClick={saveNote}
                disabled={status === "saving" || !transcript.trim()}
              >
                שמור
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={resetDraft}
                disabled={hasActiveRecording}
              >
                נקה
              </button>
            </div>
          </div>
        </section>

        <section className="archive-panel" aria-labelledby="archive-title">
          <div className="panel">
            <div className="archive-header">
              <h2 id="archive-title">כל הפתקים</h2>
              <span className="status-pill">{notes.length} פתקים</span>
            </div>
            <div className="search-row">
              <input
                aria-label="חיפוש"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="חיפוש בתמלול"
              />
              <select
                aria-label="סינון לפי סוג"
                value={filterType}
                onChange={(event) => setFilterType(event.target.value as NoteType | "all")}
              >
                <option value="all">כל הסוגים</option>
                {NOTE_TYPES.map((noteType) => (
                  <option key={noteType} value={noteType}>
                    {NOTE_TYPE_LABELS[noteType]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="notes-list">
            {notes.length === 0 ? (
              <p className="panel empty-text">אין פתקים שמורים עדיין.</p>
            ) : (
              groupedNotes.map((group) => (
                <section className="note-group" key={group.type}>
                  <div className="note-group-head">
                    <h3>{NOTE_TYPE_LABELS[group.type]}</h3>
                    <span>{group.notes.length}</span>
                  </div>
                  {group.notes.map((note) => {
                    const listTitle = getNoteListTitle(note);

                    return (
                      <article className="note-card" key={note.id}>
                        <button
                          className="copy-icon-button"
                          type="button"
                          onClick={() => void copyNote(note)}
                          aria-label="העתק פתק"
                          title="העתק"
                        >
                          <CopyIcon />
                        </button>
                        <div className="note-meta">
                          <span className="type-chip">{NOTE_TYPE_LABELS[note.type]}</span>
                          <time dateTime={note.createdAt}>{formatDate(note.createdAt)}</time>
                        </div>
                        {listTitle ? <h4 className="note-title">{listTitle}</h4> : null}
                        {shouldShowTranscriptPreview(note.type) ? (
                          <p className="note-preview">{previewTranscript(note.transcript)}</p>
                        ) : null}
                        <div className="note-actions">
                          <button
                            className="secondary-button compact"
                            type="button"
                            onClick={() => {
                              setSelectedNote(note);
                              setEditingNote(null);
                            }}
                          >
                            פתח פתק
                          </button>
                          <button
                            className="secondary-button compact"
                            type="button"
                            onClick={() => {
                              setSelectedNote(note);
                              setEditingNote(note);
                            }}
                          >
                            ערוך
                          </button>
                          <button
                            className="danger-button subtle compact"
                            type="button"
                            onClick={() => void deleteNoteById(note.id)}
                          >
                            מחק
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </section>
              ))
            )}
          </div>

          {selectedNote ? (
            <aside className="detail-panel" aria-label="פרטי פתק">
              <button
                className="copy-icon-button detail-copy"
                type="button"
                onClick={() => void copyNote(selectedNote)}
                aria-label="העתק פתק"
                title="העתק"
              >
                <CopyIcon />
              </button>
              <div className="detail-head">
                <div>
                  <p className="note-meta">
                    <span className="type-chip">{NOTE_TYPE_LABELS[selectedNote.type]}</span>
                    <time dateTime={selectedNote.createdAt}>
                      {formatDate(selectedNote.createdAt)}
                    </time>
                  </p>
                  <h3 className="detail-title">{selectedSummary}</h3>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setSelectedNote(null);
                    setEditingNote(null);
                  }}
                >
                  סגור
                </button>
              </div>

              {editingNote ? (
                <EditNoteForm
                  note={editingNote}
                  onChange={setEditingNote}
                  onCancel={() => setEditingNote(null)}
                  onSave={updateSelectedNote}
                />
              ) : (
                <>
                  <p className="full-transcript">{selectedNote.transcript}</p>
                  {selectedNote.tags.length > 0 ? (
                    <div className="tag-row">
                      {selectedNote.tags.map((tag) => (
                        <span className="tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="button-row">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setEditingNote(selectedNote)}
                    >
                      ערוך
                    </button>
                    <button className="danger-button" type="button" onClick={deleteSelectedNote}>
                      מחק
                    </button>
                  </div>
                </>
              )}
            </aside>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function EditNoteForm({
  note,
  onChange,
  onCancel,
  onSave
}: {
  note: VoiceNote;
  onChange: (note: VoiceNote) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="field-grid">
      <label className="field">
        <span>סוג פתק</span>
        <select
          value={note.type}
          onChange={(event) =>
            onChange({ ...note, type: event.target.value as NoteType })
          }
        >
          {NOTE_TYPES.map((noteType) => (
            <option key={noteType} value={noteType}>
              {NOTE_TYPE_LABELS[noteType]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>כותרת</span>
        <input
          value={note.title ?? ""}
          onChange={(event) => onChange({ ...note, title: event.target.value })}
        />
      </label>
      <label className="field">
        <span>תמלול</span>
        <textarea
          value={note.transcript}
          onChange={(event) => onChange({ ...note, transcript: event.target.value })}
        />
      </label>
      <label className="field">
        <span>תגיות</span>
        <input
          value={note.tags.join(", ")}
          onChange={(event) =>
            onChange({
              ...note,
              tags: event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            })
          }
        />
      </label>
      <div className="button-row">
        <button className="primary-button" type="button" onClick={onSave}>
          שמור שינויים
        </button>
        <button className="secondary-button" type="button" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function noteHeading(note: VoiceNote) {
  return note.title?.trim() || firstLine(note.transcript) || "פתק ללא כותרת";
}

function firstLine(value: string) {
  return value.split(/\r?\n/).find(Boolean)?.trim() ?? "";
}

function previewTranscript(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 120 ? `${clean.slice(0, 120)}...` : clean;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
