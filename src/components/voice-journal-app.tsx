"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCopyableNoteText,
  getNoteListTitle
} from "@/lib/note-display";
import {
  getAllNoteIdsSelected,
  removeNoteIdsFromSelection,
  toggleNoteIdSelection,
  toggleVisibleNoteSelection
} from "@/lib/note-selection";
import { NOTE_TYPE_LABELS, NOTE_TYPES, type NoteType } from "@/lib/note-types";
import {
  formatRecordingDuration,
  getRecordingPrimaryAction,
  getResetRecordingDraftState,
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

const WAVE_LEVELS = [
  16, 24, 12, 34, 46, 26, 58, 44, 28, 52, 72, 38, 50, 30, 64, 42, 26, 56, 36,
  68, 82, 48, 34, 24, 40, 30, 18, 28, 22, 16, 24, 20, 14, 18, 12, 22, 16, 10,
  14, 12, 18, 10, 12, 16
];

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
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

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

  const visibleNoteIds = useMemo(() => notes.map((note) => note.id), [notes]);

  const todayNoteCount = useMemo(() => {
    const today = new Date().toDateString();
    return notes.filter((note) => new Date(note.createdAt).toDateString() === today).length;
  }, [notes]);

  const primaryRecordingAction = getRecordingPrimaryAction(status);
  const hasActiveRecording = status === "recording" || status === "paused";
  const isRecording = status === "recording";
  const allVisibleNotesSelected = getAllNoteIdsSelected(selectedNoteIds, visibleNoteIds);

  async function startRecording() {
    setElapsedSeconds(0);
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
    setSelectedNoteIds((ids) => removeNoteIdsFromSelection(ids, [noteId]));
    await loadNotes();
  }

  async function deleteSelectedNotes() {
    if (selectedNoteIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `למחוק ${selectedNoteIds.length} פתקים מסומנים?`
    );
    if (!confirmed) {
      return;
    }

    setError("");
    const idsToDelete = selectedNoteIds;

    try {
      const results = await Promise.all(
        idsToDelete.map((noteId) =>
          fetch(`/api/notes/${noteId}`, {
            method: "DELETE"
          })
        )
      );

      if (results.some((response) => !response.ok)) {
        throw new Error("bulk delete failed");
      }

      if (selectedNote && idsToDelete.includes(selectedNote.id)) {
        setSelectedNote(null);
        setEditingNote(null);
      }

      setSelectedNoteIds([]);
      setIsSelectionMode(false);
      await loadNotes();
    } catch {
      setError("מחיקת הפתקים המסומנים נכשלה.");
    }
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
    const draft = getResetRecordingDraftState();
    setTranscript(draft.transcript);
    setTitle(draft.title);
    setTags(draft.tags);
    setType(draft.type);
    setElapsedSeconds(draft.elapsedSeconds);
  }

  function toggleSelectionMode() {
    setIsSelectionMode((enabled) => {
      if (enabled) {
        setSelectedNoteIds([]);
      }

      return !enabled;
    });
  }

  function toggleNoteSelection(noteId: string) {
    setSelectedNoteIds((ids) => toggleNoteIdSelection(ids, noteId));
  }

  function toggleAllVisibleNotes() {
    setSelectedNoteIds((ids) => toggleVisibleNoteSelection(ids, visibleNoteIds));
  }

  function stopCurrentStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <WaveMarkIcon />
          </span>
          <div>
            <h1>פנקס אישי</h1>
            <p>פתקים פרטיים למחשבות, חלומות, רעיונות ותזכורות בקול.</p>
          </div>
        </div>
        <div className="header-meta" aria-label="מצב האפליקציה">
          <span className="status-pill">
            <span className="live-dot" aria-hidden="true" />
            מסונכרן מקומית
          </span>
          <span
            className={`status-pill ${
              status === "recording" || status === "paused" ? "recording" : ""
            }`}
          >
            {getRecordingStatusLabel(status)}
          </span>
        </div>
      </header>

      {copyMessage ? <p className="message success app-message">{copyMessage}</p> : null}

      <div className="workspace-grid">
        <section className="recorder-panel" aria-labelledby="recording-title">
          <div className="record-stage">
            <div className="record-heading">
              <p className="eyebrow">התחלה מהירה</p>
              <h2 id="recording-title">דבר עכשיו, ערוך רגע לפני השמירה</h2>
            </div>

            <div className={`record-core ${isRecording ? "is-live" : ""}`}>
              <div className="timer-stack">
                <span className="record-duration">{formatRecordingDuration(elapsedSeconds)}</span>
                <span className="record-state">
                  {isRecording ? <span className="record-dot" aria-hidden="true" /> : null}
                  {getRecordingStatusLabel(status)}
                </span>
              </div>

              <button
                className={`mic-button ${
                  primaryRecordingAction.action === "pause" ? "stop" : ""
                }`}
                type="button"
                onClick={handlePrimaryRecordingAction}
                disabled={status === "transcribing" || status === "saving"}
                aria-label={primaryRecordingAction.label}
              >
                <MicIcon />
                <span>{primaryRecordingAction.label}</span>
              </button>

              <div className="waveform" aria-hidden="true">
                {WAVE_LEVELS.map((level, index) => (
                  <span
                    className={index < 23 ? "wave active" : "wave"}
                    key={`${level}-${index}`}
                    style={{ "--level": `${level}%` } as React.CSSProperties}
                  />
                ))}
              </div>
            </div>

            <div className="record-actions" aria-label="פעולות הקלטה">
              {hasActiveRecording ? (
                <>
                  <button className="secondary-button icon-button" type="button" onClick={finishRecording}>
                    <CheckIcon />
                    סיים ותמלל
                  </button>
                  <button
                    className="danger-button subtle icon-button"
                    type="button"
                    onClick={startOverRecording}
                  >
                    <TrashIcon />
                    התחל מההתחלה
                  </button>
                </>
              ) : (
                <span className="record-help">{message}</span>
              )}
            </div>

            {hasActiveRecording ? <p className="record-help">{message}</p> : null}
            {error ? <p className="message error">{error}</p> : null}
          </div>

          <div className="draft-panel">
            <div className="draft-head">
              <div>
                <p className="eyebrow">טיוטה</p>
                <h2>פרטי הפתק</h2>
              </div>
              <span className="type-chip">{NOTE_TYPE_LABELS[type]}</span>
            </div>

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

              <label className="field full">
                <span>תמלול</span>
                <textarea
                  value={transcript}
                  onChange={(event) => setTranscript(event.target.value)}
                  placeholder="התמלול יופיע כאן, ואפשר גם להקליד ידנית."
                />
              </label>

              <label className="field full">
                <span>תגיות</span>
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="למשל: עבודה, חלום, ערב"
                />
              </label>

              <div className="button-row full">
                <button
                  className="primary-button icon-button"
                  type="button"
                  onClick={saveNote}
                  disabled={status === "saving" || !transcript.trim()}
                >
                  <CheckIcon />
                  שמור פתק
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={resetDraft}
                  disabled={hasActiveRecording}
                >
                  נקה טיוטה
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="archive-panel" aria-labelledby="archive-title">
          <div className="archive-shell">
            <div className="archive-header">
              <div>
                <p className="eyebrow">ארכיון</p>
                <h2 id="archive-title">הפתקים שלי</h2>
              </div>
              <div className="archive-actions">
                <span className="status-pill">{notes.length} פתקים</span>
                <a
                  className="secondary-button icon-button export-link"
                  href="/api/export"
                >
                  <DownloadIcon />
                  ייצא הכל
                </a>
                <button
                  className={isSelectionMode ? "secondary-button active" : "secondary-button"}
                  type="button"
                  onClick={toggleSelectionMode}
                  disabled={notes.length === 0}
                >
                  {isSelectionMode ? "בטל בחירה" : "בחירה"}
                </button>
              </div>
            </div>

            {isSelectionMode ? (
              <div className="bulk-actions" aria-label="פעולות על פתקים מסומנים">
                <span>{selectedNoteIds.length} מסומנים</span>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={toggleAllVisibleNotes}
                  disabled={visibleNoteIds.length === 0}
                >
                  {allVisibleNotesSelected ? "נקה בחירה" : "בחר הכל"}
                </button>
                <button
                  className="danger-button icon-button"
                  type="button"
                  onClick={() => void deleteSelectedNotes()}
                  disabled={selectedNoteIds.length === 0}
                >
                  <TrashIcon />
                  מחק נבחרים
                </button>
              </div>
            ) : null}

            <div className="stats-row" aria-label="סיכום פתקים">
              <span>
                <strong>{todayNoteCount}</strong>
                היום
              </span>
              <span>
                <strong>{groupedNotes.length}</strong>
                קטגוריות
              </span>
            </div>

            <div className="search-row">
              <label className="search-box">
                <SearchIcon />
                <input
                  aria-label="חיפוש"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="חפש בפתקים..."
                />
              </label>
            </div>

            <div className="filter-chips" aria-label="סינון לפי סוג">
              <button
                className={filterType === "all" ? "filter-chip active" : "filter-chip"}
                type="button"
                onClick={() => setFilterType("all")}
              >
                הכל
              </button>
              {NOTE_TYPES.map((noteType) => (
                <button
                  className={filterType === noteType ? "filter-chip active" : "filter-chip"}
                  key={noteType}
                  type="button"
                  onClick={() => setFilterType(noteType)}
                >
                  {NOTE_TYPE_LABELS[noteType]}
                </button>
              ))}
            </div>

            <div className="notes-list">
              {notes.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon" aria-hidden="true">
                    <MicIcon />
                  </span>
                  <p>אין פתקים שמורים עדיין.</p>
                  <small>הקלטה ראשונה תופיע כאן עם חיפוש, סינון ופעולות מהירות.</small>
                </div>
              ) : (
                groupedNotes.map((group) => (
                  <section className="note-group" key={group.type}>
                    <div className="note-group-head">
                      <h3>{NOTE_TYPE_LABELS[group.type]}</h3>
                      <span>{group.notes.length}</span>
                    </div>
                    {group.notes.map((note) => {
                      const listTitle = getNoteListTitle(note);
                      const isSelected = selectedNoteIds.includes(note.id);

                      return (
                        <article
                          className={isSelected ? "note-card selected" : "note-card"}
                          key={note.id}
                        >
                          <div className="note-topline">
                            <span className="type-chip">{NOTE_TYPE_LABELS[note.type]}</span>
                            <time dateTime={note.createdAt}>{formatDate(note.createdAt)}</time>
                          </div>
                          <button
                            className="note-main"
                            type="button"
                            onClick={() => {
                              if (isSelectionMode) {
                                toggleNoteSelection(note.id);
                                return;
                              }

                              setSelectedNote(note);
                              setEditingNote(null);
                            }}
                            aria-pressed={isSelectionMode ? isSelected : undefined}
                          >
                            <h4 className="note-title">
                              {listTitle || "ללא שם"}
                            </h4>
                          </button>
                          <div className="note-actions">
                            {isSelectionMode ? (
                              <button
                                className={isSelected ? "select-note-button selected" : "select-note-button"}
                                type="button"
                                onClick={() => toggleNoteSelection(note.id)}
                                aria-pressed={isSelected}
                              >
                                {isSelected ? "מסומן" : "סמן"}
                              </button>
                            ) : (
                              <>
                                <button
                                  className="round-button"
                                  type="button"
                                  onClick={() => {
                                    setSelectedNote(note);
                                    setEditingNote(null);
                                  }}
                                  aria-label="פתח פתק"
                                  title="פתח"
                                >
                                  <OpenNoteIcon />
                                </button>
                                <button
                                  className="round-button"
                                  type="button"
                                  onClick={() => void copyNote(note)}
                                  aria-label="העתק פתק"
                                  title="העתק"
                                >
                                  <CopyIcon />
                                </button>
                                <button
                                  className="round-button"
                                  type="button"
                                  onClick={() => {
                                    setSelectedNote(note);
                                    setEditingNote(note);
                                  }}
                                  aria-label="ערוך פתק"
                                  title="ערוך"
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  className="round-button danger"
                                  type="button"
                                  onClick={() => void deleteNoteById(note.id)}
                                  aria-label="מחק פתק"
                                  title="מחק"
                                >
                                  <TrashIcon />
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </section>
                ))
              )}
            </div>
          </div>

          {selectedNote ? (
            <aside className="detail-panel" aria-label="פרטי פתק">
              <div className="detail-head">
                <div>
                  <p className="note-topline">
                    <span className="type-chip">{NOTE_TYPE_LABELS[selectedNote.type]}</span>
                    <time dateTime={selectedNote.createdAt}>
                      {formatDate(selectedNote.createdAt)}
                    </time>
                  </p>
                  <h3 className="detail-title">{selectedSummary}</h3>
                </div>
                <div className="detail-actions">
                  <button
                    className="round-button"
                    type="button"
                    onClick={() => void copyNote(selectedNote)}
                    aria-label="העתק פתק"
                    title="העתק"
                  >
                    <CopyIcon />
                  </button>
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
                      className="secondary-button icon-button"
                      type="button"
                      onClick={() => setEditingNote(selectedNote)}
                    >
                      <EditIcon />
                      ערוך
                    </button>
                    <button className="danger-button icon-button" type="button" onClick={deleteSelectedNote}>
                      <TrashIcon />
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
    <div className="field-grid compact-form">
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
      <label className="field full">
        <span>תמלול</span>
        <textarea
          value={note.transcript}
          onChange={(event) => onChange({ ...note, transcript: event.target.value })}
        />
      </label>
      <label className="field full">
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
      <div className="button-row full">
        <button className="primary-button icon-button" type="button" onClick={onSave}>
          <CheckIcon />
          שמור שינויים
        </button>
        <button className="secondary-button" type="button" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </div>
  );
}

function IconSvg({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function WaveMarkIcon() {
  return (
    <IconSvg className="brand-wave">
      <path d="M4 10v4" />
      <path d="M8 6v12" />
      <path d="M12 3v18" />
      <path d="M16 7v10" />
      <path d="M20 11v2" />
    </IconSvg>
  );
}

function MicIcon() {
  return (
    <IconSvg>
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </IconSvg>
  );
}

function SearchIcon() {
  return (
    <IconSvg>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </IconSvg>
  );
}

function DownloadIcon() {
  return (
    <IconSvg>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </IconSvg>
  );
}

function EditIcon() {
  return (
    <IconSvg>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </IconSvg>
  );
}

function CheckIcon() {
  return (
    <IconSvg>
      <path d="M20 6 9 17l-5-5" />
    </IconSvg>
  );
}

function TrashIcon() {
  return (
    <IconSvg>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </IconSvg>
  );
}

function OpenNoteIcon() {
  return (
    <IconSvg>
      <path d="M7 3h7l5 5v13H7Z" />
      <path d="M14 3v6h5" />
      <path d="M10 13h6" />
      <path d="M10 17h4" />
    </IconSvg>
  );
}

function CopyIcon() {
  return (
    <IconSvg>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </IconSvg>
  );
}

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return options.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function noteHeading(note: VoiceNote) {
  return note.title?.trim() || "ללא שם";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
