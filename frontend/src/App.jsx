import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Bell,
  BookOpenText,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  CloudUpload,
  FileAudio,
  FileText,
  History,
  Languages,
  LayoutDashboard,
  Mic,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Square,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080"
)
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

const API = `${API_BASE_URL}/api`;

const LANGUAGES = [
  { value: "en-IN", label: "English (India)" },
  { value: "en-US", label: "English (US)" },
  { value: "ta-IN", label: "Tamil" },
  { value: "hi-IN", label: "Hindi" },
];

const blankTranscript = () => ({
  id: null,
  title: "Untitled transcription",
  language: "English (India)",
  text: "",
  createdAt: new Date().toISOString(),
});

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
}

function normalize(item = {}) {
  return {
    id: item.id ?? item.transcriptionId ?? null,
    title: item.title ?? item.name ?? "Untitled transcription",
    language: item.language ?? "English (India)",
    text: item.text ?? item.transcript ?? item.content ?? "",
    createdAt: item.createdAt ?? item.created_at ?? new Date().toISOString(),
  };
}

export default function App() {
  const [page, setPage] = useState("Workspace");
  const [language, setLanguage] = useState("en-IN");
  const [transcript, setTranscript] = useState(blankTranscript);
  const [history, setHistory] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const finalTextRef = useRef("");

  const wordCount = transcript.text.trim()
    ? transcript.text.trim().split(/\s+/).length
    : 0;

  useEffect(() => {
    checkApi();
    loadHistory();

    return () => {
      clearInterval(timerRef.current);
      recognitionRef.current?.abort();
    };
  }, []);

  async function checkApi() {
    try {
      const response = await fetch(`${API}/health`);
      setApiOnline(response.ok);
    } catch {
      setApiOnline(false);
    }
  }

  async function loadHistory() {
    try {
      const response = await fetch(`${API}/transcriptions`);
      if (!response.ok) throw new Error("History unavailable");

      const data = await response.json();
      const items = Array.isArray(data)
        ? data
        : (data.content ?? data.transcriptions ?? []);

      setHistory(items.map(normalize));
      setApiOnline(true);
    } catch {
      setApiOnline(false);
    }
  }

  function stopTimer() {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function startRecording() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setNotice(
        "Live transcription is not supported here. Please try Google Chrome or Microsoft Edge.",
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = true;

      finalTextRef.current = transcript.text
        ? transcript.text.trimEnd() + " "
        : "";

      recognition.onresult = (event) => {
        let interim = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const words = result[0].transcript;

          if (result.isFinal) {
            finalTextRef.current += words + " ";
          } else {
            interim += words;
          }
        }

        setTranscript((current) => ({
          ...current,
          text: (finalTextRef.current + interim).trimStart(),
        }));
      };

      recognition.onerror = (event) => {
        setNotice(
          event.error === "not-allowed"
            ? "Microphone permission denied. Allow microphone access in your browser."
            : `Recognition error: ${event.error}`,
        );
      };

      recognition.onend = () => {
        setRecording(false);
        stopTimer();
      };

      recognition.start();
      recognitionRef.current = recognition;
      setRecording(true);
      setNotice("");

      stopTimer();
      timerRef.current = setInterval(() => {
        setElapsed((seconds) => seconds + 1);
      }, 1000);
    } catch {
      setNotice(
        "Could not start recording. Check your microphone permissions.",
      );
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
    stopTimer();
  }

  function newTranscript() {
    stopRecording();
    setTranscript(blankTranscript());
    setElapsed(0);
    finalTextRef.current = "";
    setPage("Workspace");
    setNotice("");
  }

  function editText(value) {
    setTranscript((current) => ({ ...current, text: value }));
    finalTextRef.current = value;
  }

  async function saveTranscript() {
    if (!transcript.text.trim()) {
      setNotice("Record or enter some text before saving.");
      return;
    }

    const payload = {
      title: transcript.title.trim() || "Untitled transcription",
      language:
        LANGUAGES.find((item) => item.value === language)?.label ??
        transcript.language,
      text: transcript.text.trim(),
    };

    setBusy(true);

    try {
      const isExisting = transcript.id !== null;
      const url = isExisting
        ? `${API}/transcriptions/${transcript.id}`
        : `${API}/transcriptions`;

      const response = await fetch(url, {
        method: isExisting ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("The server could not save the transcript.");
      }

      let result = {};
      try {
        result = await response.json();
      } catch {
        // Some APIs return an empty response after saving.
      }

      setTranscript(
        normalize({
          ...payload,
          ...result,
          id: result.id ?? result.transcriptionId ?? transcript.id,
        }),
      );

      setNotice("Transcript saved successfully.");
      await loadHistory();
    } catch (error) {
      setNotice(
        `${error.message} Check your Spring Boot API routes and server status.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteTranscript(item) {
    if (!item.id) {
      setNotice("This transcript does not have a saved server ID.");
      return;
    }

    if (!window.confirm(`Delete "${item.title}"?`)) return;

    try {
      const response = await fetch(`${API}/transcriptions/${item.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Delete failed");

      setHistory((items) => items.filter((row) => row.id !== item.id));

      if (String(transcript.id) === String(item.id)) {
        newTranscript();
      }

      setNotice("Transcript deleted.");
    } catch {
      setNotice("Could not delete this transcript. Check the DELETE API.");
    }
  }

  function openTranscript(item) {
    stopRecording();
    const selected = normalize(item);
    setTranscript(selected);

    const matchingLanguage = LANGUAGES.find(
      (item) => item.label === selected.language,
    );

    if (matchingLanguage) setLanguage(matchingLanguage.value);

    finalTextRef.current = selected.text;
    setPage("Workspace");
    setNotice("");
  }

  const filteredHistory = history.filter((item) =>
    `${item.title} ${item.text}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <AudioLines size={23} />
          </div>
          <div>
            <strong>VoiceScribe</strong>
            <span>VOICE WORKSPACE</span>
          </div>
        </div>

        <button className="new-button" onClick={newTranscript}>
          <Plus size={18} /> New transcription
        </button>

        <div className="nav-label">WORKSPACE</div>

        <nav className="nav-list">
          <button
            className={`nav-item ${page === "Workspace" ? "active" : ""}`}
            onClick={() => setPage("Workspace")}
          >
            <LayoutDashboard size={18} /> Workspace
          </button>

          <button
            className={`nav-item ${page === "History" ? "active" : ""}`}
            onClick={() => setPage("History")}
          >
            <History size={18} /> Transcript history
            <span className="nav-count">{history.length}</span>
          </button>

          <button
            className={`nav-item ${page === "Guide" ? "active" : ""}`}
            onClick={() => setPage("Guide")}
          >
            <BookOpenText size={18} /> Quick guide
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="tip-card">
            <WandSparkles size={20} />
            <strong>Your voice, in writing.</strong>
            <p>Capture your ideas and turn conversations into editable text.</p>
          </div>

          <button
            className="nav-item"
            onClick={() => setNotice("Settings will be added soon.")}
          >
            <Settings size={18} /> Settings
          </button>

          <div className="profile">
            <div className="profile-avatar">VS</div>
            <div>
              <strong>My workspace</strong>
              <span>Personal account</span>
            </div>
            <MoreHorizontal size={19} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span>/</span>
            <strong>{page}</strong>
          </div>

          <div className="top-actions">
            <span className={`api-status ${apiOnline ? "online" : ""}`}>
              <i /> {apiOnline ? "API connected" : "API offline"}
            </span>
            <button
              className="icon-button"
              title="Help"
              onClick={() => setPage("Guide")}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="icon-button"
              title="Notifications"
              onClick={() => setNotice("You're all caught up.")}
            >
              <Bell size={19} />
            </button>
            <div className="top-avatar">V</div>
          </div>
        </header>

        <div className="page-content">
          {page === "Workspace" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">VOICE WORKSPACE · LIVE CAPTURE</div>
                  <h1>Turn your voice into words.</h1>
                  <p>
                    Record, transcribe, and refine your thoughts in one place.
                  </p>
                </div>

                <div className="session-card">
                  <Clock3 size={19} />
                  <div>
                    <span>SESSION TIME</span>
                    <strong>{formatTime(elapsed)}</strong>
                  </div>
                </div>
              </div>

              <div className="workspace-grid">
                <section className="panel recorder-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-label">01 / CAPTURE</span>
                      <h2>Voice recorder</h2>
                    </div>
                    <span
                      className={`record-status ${recording ? "recording" : ""}`}
                    >
                      <i /> {recording ? "Recording" : "Ready to record"}
                    </span>
                  </div>

                  <div className="recorder-body">
                    <div className={`mic-orbit ${recording ? "live" : ""}`}>
                      <div className="mic-circle">
                        {recording ? (
                          <AudioLines size={31} />
                        ) : (
                          <Mic size={31} />
                        )}
                      </div>
                    </div>

                    <div className="timer">{formatTime(elapsed)}</div>
                    <div className="timer-caption">
                      {recording
                        ? "Listening to your voice"
                        : "Your next idea starts here"}
                    </div>

                    <div
                      className={`waveform ${recording ? "wave-active" : ""}`}
                    >
                      {Array.from({ length: 35 }, (_, index) => (
                        <span
                          key={index}
                          style={{
                            "--bar-height": `${8 + ((index * 17 + 11) % 29)}px`,
                          }}
                        />
                      ))}
                    </div>

                    <div className="recorder-buttons">
                      {!recording ? (
                        <button
                          className="record-button"
                          onClick={startRecording}
                        >
                          <Mic size={18} /> Start recording
                        </button>
                      ) : (
                        <button className="stop-button" onClick={stopRecording}>
                          <Square size={15} fill="currentColor" /> Stop
                          recording
                        </button>
                      )}

                      <button
                        className="secondary-button"
                        onClick={() =>
                          setNotice(
                            "Audio upload support will be added in the next integration step.",
                          )
                        }
                      >
                        <Upload size={17} /> Upload audio
                      </button>
                    </div>

                    <p className="privacy-note">
                      <i /> Your browser will request microphone permission
                    </p>
                  </div>

                  <div className="recorder-footer">
                    <div className="language-picker">
                      <Languages size={17} />
                      <label htmlFor="language">Language</label>
                      <select
                        id="language"
                        value={language}
                        disabled={recording}
                        onChange={(event) => setLanguage(event.target.value)}
                      >
                        {LANGUAGES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </div>
                    <span>Speak clearly for best results</span>
                  </div>
                </section>

                <section className="panel editor-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-label">02 / TRANSCRIPT</span>
                      <h2>Transcript editor</h2>
                    </div>
                    <span className="editable-badge">
                      <i /> Editable
                    </span>
                  </div>

                  <div className="title-field">
                    <label htmlFor="doc-title">DOCUMENT TITLE</label>
                    <input
                      id="doc-title"
                      value={transcript.title}
                      onChange={(event) =>
                        setTranscript({
                          ...transcript,
                          title: event.target.value,
                        })
                      }
                      placeholder="Give your transcript a title"
                    />
                  </div>

                  <div className="editor-toolbar">
                    <span>
                      <FileText size={16} /> Transcript text
                    </span>
                    <span>{wordCount} words</span>
                  </div>

                  <textarea
                    className="transcript-editor"
                    value={transcript.text}
                    onChange={(event) => editText(event.target.value)}
                    placeholder={
                      "Your transcript will appear here as you speak...\n\nYou can also type or paste text here and edit it before saving."
                    }
                    spellCheck="true"
                  />

                  <div className="editor-meta">
                    <span>
                      <Check size={14} /> Changes stay editable
                    </span>
                    <span>{transcript.text.length} characters</span>
                  </div>

                  <div className="editor-actions">
                    <button
                      className="secondary-button"
                      onClick={() => {
                        editText("");
                        setNotice("");
                      }}
                    >
                      <X size={16} /> Clear text
                    </button>
                    <button
                      className="primary-button"
                      disabled={busy}
                      onClick={saveTranscript}
                    >
                      <CloudUpload size={17} />{" "}
                      {busy ? "Saving..." : "Save transcript"}
                    </button>
                  </div>
                </section>
              </div>

              <section className="recent-section">
                <div className="recent-heading">
                  <div>
                    <h2>Recent transcripts</h2>
                    <p>Your latest saved work, all in one place.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setPage("History")}
                  >
                    View all →
                  </button>
                </div>

                {history.length ? (
                  <div className="recent-grid">
                    {history.slice(0, 3).map((item) => (
                      <button
                        className="recent-card"
                        key={item.id ?? item.title}
                        onClick={() => openTranscript(item)}
                      >
                        <div className="file-icon">
                          <FileAudio size={19} />
                        </div>
                        <strong>{item.title}</strong>
                        <p>
                          {item.text.slice(0, 85) || "No transcript text yet"}
                        </p>
                        <div className="recent-meta">
                          <span>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                          <span>{item.language}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="recent-empty">
                    <div className="empty-icon">
                      <FileText size={20} />
                    </div>
                    <div>
                      <strong>Your saved transcripts will appear here</strong>
                      <p>Save a transcript to reopen and edit it later.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("History")}
                    >
                      Open history →
                    </button>
                  </div>
                )}
              </section>
            </>
          )}

          {page === "History" && (
            <section className="history-page">
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR LIBRARY</div>
                  <h1>Transcript history</h1>
                  <p>Find and reopen your saved voice notes.</p>
                </div>
                <button className="primary-button" onClick={newTranscript}>
                  <Plus size={17} /> New transcript
                </button>
              </div>

              <div className="search-box">
                <Search size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search transcripts..."
                />
              </div>

              <div className="history-list">
                {filteredHistory.length ? (
                  filteredHistory.map((item) => (
                    <div className="history-row" key={item.id ?? item.title}>
                      <div className="file-icon">
                        <FileText size={20} />
                      </div>
                      <button
                        className="history-info"
                        onClick={() => openTranscript(item)}
                      >
                        <strong>{item.title}</strong>
                        <span>
                          {new Date(item.createdAt).toLocaleString()} ·{" "}
                          {item.language}
                        </span>
                        <p>{item.text.slice(0, 140)}</p>
                      </button>
                      <button
                        className="icon-button delete-button"
                        title="Delete"
                        onClick={() => deleteTranscript(item)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <History size={30} />
                    <h3>No saved transcripts found</h3>
                    <p>Create and save your first transcript to see it here.</p>
                    <button className="primary-button" onClick={newTranscript}>
                      Create transcript
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {page === "Guide" && (
            <section className="guide-page">
              <div className="eyebrow">GETTING STARTED</div>
              <h1>Quick guide</h1>
              <p className="page-subtitle">
                Capture, edit, and save your voice transcripts.
              </p>

              <div className="guide-grid">
                <article className="guide-card">
                  <Mic size={24} />
                  <h3>1. Start speaking</h3>
                  <p>
                    Choose a language, allow microphone access, and start
                    recording.
                  </p>
                </article>
                <article className="guide-card">
                  <FileText size={24} />
                  <h3>2. Edit your transcript</h3>
                  <p>
                    Recognized words appear in the text area. Correct or rewrite
                    them anytime.
                  </p>
                </article>
                <article className="guide-card">
                  <CloudUpload size={24} />
                  <h3>3. Save your work</h3>
                  <p>
                    Give the transcript a title and save it when the backend is
                    connected.
                  </p>
                </article>
              </div>

              <button
                className="primary-button"
                onClick={() => setPage("Workspace")}
              >
                Open workspace
              </button>
            </section>
          )}

          {notice && (
            <div className="toast" role="status">
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss">
                <X size={17} />
              </button>
            </div>
          )}

          <footer className="page-footer">
            <span>VoiceScribe · Your voice, clearly captured.</span>
            <span>Built for focus and clarity</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
