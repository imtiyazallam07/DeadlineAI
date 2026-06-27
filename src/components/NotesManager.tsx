import React, { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Note, Task, UserSession } from "../types";
import SkeuoButton from "./SkeuoButton";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Eye, 
  Edit3, 
  Heading, 
  Bold, 
  Italic, 
  Table, 
  Code, 
  List, 
  Link, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Check, 
  CheckCircle,
  HelpCircle,
  Sparkles,
  ChevronRight,
  RefreshCw
} from "lucide-react";

interface NotesManagerProps {
  session: UserSession;
  updateSessionInCloud: (updatedFields: Partial<UserSession>) => Promise<void>;
  triggerBleep: () => void;
}

interface ExtractedTask {
  id: string;
  title: string;
  due: string;
  priority: "low" | "medium" | "high";
  estimatedEffort: number;
  predictedEffort: number;
  underestimationRisk: boolean;
  category: string;
  selected: boolean;
}

interface ExtractedEvent {
  id: string;
  text: string;
  selected: boolean;
}

interface NotesAISuggestions {
  tasks: ExtractedTask[];
  calendarEvents: ExtractedEvent[];
  parsedSummary: string;
  isOpen: boolean;
}

export default function NotesManager({
  session,
  updateSessionInCloud,
  triggerBleep
}: NotesManagerProps) {
  // Safe default notes initialization
  const notes = session.notes || [];

  // Active editor states
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [activeTab, setActiveTab] = useState<"md" | "preview">("md");

  // Dirty state tracking (for unsaved changes dialog)
  const [originalTitle, setOriginalTitle] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const isDirty = editorTitle !== originalTitle || editorContent !== originalContent;

  // Unsaved close modal / dialogue state
  const [pendingAction, setPendingAction] = useState<{ type: "close" | "switch" | "create"; targetId?: string } | null>(null);

  // AI Scheduling Suggestion state
  const [aiSuggestions, setAiSuggestions] = useState<NotesAISuggestions | null>(null);
  const [isAiParsing, setIsAiParsing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle opening a note for editing
  const handleOpenNote = (note: Note) => {
    triggerBleep();
    if (isDirty) {
      // Trigger unsaved warning first
      setPendingAction({ type: "switch", targetId: note.id });
    } else {
      setActiveNoteId(note.id);
      setEditorTitle(note.title);
      setEditorContent(note.content);
      setOriginalTitle(note.title);
      setOriginalContent(note.content);
      setActiveTab("md");
    }
  };

  // Create a new note
  const handleCreateNewNote = () => {
    triggerBleep();
    if (isDirty) {
      setPendingAction({ type: "create" });
    } else {
      const newNote: Note = {
        id: "note-" + Date.now(),
        title: "Untitled Note",
        content: "# Untitled Note\n\nWrite your thoughts here...",
        updatedAt: new Date().toISOString()
      };
      const updatedNotes = [...notes, newNote];
      updateSessionInCloud({ notes: updatedNotes });
      
      // Auto open the new note
      setActiveNoteId(newNote.id);
      setEditorTitle(newNote.title);
      setEditorContent(newNote.content);
      setOriginalTitle(newNote.title);
      setOriginalContent(newNote.content);
      setActiveTab("md");
    }
  };

  // Close the current note
  const handleCloseNote = () => {
    triggerBleep();
    if (isDirty) {
      setPendingAction({ type: "close" });
    } else {
      setActiveNoteId(null);
      setEditorTitle("");
      setEditorContent("");
      setOriginalTitle("");
      setOriginalContent("");
    }
  };

  // Delete a note
  const handleDeleteNote = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerBleep();
    if (confirm("Are you sure you want to delete this note permanently?")) {
      const updatedNotes = notes.filter(n => n.id !== noteId);
      updateSessionInCloud({ notes: updatedNotes });
      if (activeNoteId === noteId) {
        setActiveNoteId(null);
        setEditorTitle("");
        setEditorContent("");
        setOriginalTitle("");
        setOriginalContent("");
      }
    }
  };

  // Save the note
  const handleSaveNote = async () => {
    if (!activeNoteId) return;
    triggerBleep();

    const updatedNotes = notes.map(n => {
      if (n.id === activeNoteId) {
        return {
          ...n,
          title: editorTitle.trim() || "Untitled Note",
          content: editorContent,
          updatedAt: new Date().toISOString()
        };
      }
      return n;
    });

    await updateSessionInCloud({ notes: updatedNotes });
    setOriginalTitle(editorTitle);
    setOriginalContent(editorContent);

    // AI Intelligent Time-Block Extraction
    const hasTriggers = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm|\d{1,2}:\d{2}|meeting|schedule|appt|call|deadline)\b/i.test(editorContent);
    if (hasTriggers) {
      setIsAiParsing(true);
      try {
        const response = await fetch("/api/parse-nlp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawInput: `Note Title: ${editorTitle}\n\nNote Content:\n${editorContent}` })
        });
        if (response.ok) {
          const data = await response.json();
          const extractedTasks = (data.tasks || []).map((t: any, index: number) => ({
            ...t,
            id: `ext-task-${Date.now()}-${index}`,
            selected: true
          }));
          const extractedEvents = (data.calendarEvents || []).map((e: any, index: number) => ({
            id: `ext-evt-${Date.now()}-${index}`,
            text: e,
            selected: true
          }));

          if (extractedTasks.length > 0 || extractedEvents.length > 0) {
            setAiSuggestions({
              tasks: extractedTasks,
              calendarEvents: extractedEvents,
              parsedSummary: data.parsedSummary || "Detected active references.",
              isOpen: true
            });
          }
        }
      } catch (err) {
        console.error("Failed to parse schedules via AI:", err);
      } finally {
        setIsAiParsing(false);
      }
    }
  };

  const toggleTaskSelected = (id: string) => {
    if (!aiSuggestions) return;
    triggerBleep();
    setAiSuggestions({
      ...aiSuggestions,
      tasks: aiSuggestions.tasks.map(t => t.id === id ? { ...t, selected: !t.selected } : t)
    });
  };

  const toggleEventSelected = (id: string) => {
    if (!aiSuggestions) return;
    triggerBleep();
    setAiSuggestions({
      ...aiSuggestions,
      calendarEvents: aiSuggestions.calendarEvents.map(e => e.id === id ? { ...e, selected: !e.selected } : e)
    });
  };

  const updateTaskField = (id: string, field: string, value: any) => {
    if (!aiSuggestions) return;
    setAiSuggestions({
      ...aiSuggestions,
      tasks: aiSuggestions.tasks.map(t => t.id === id ? { ...t, [field]: value } : t)
    });
  };

  const updateEventText = (id: string, value: string) => {
    if (!aiSuggestions) return;
    setAiSuggestions({
      ...aiSuggestions,
      calendarEvents: aiSuggestions.calendarEvents.map(e => e.id === id ? { ...e, text: value } : e)
    });
  };

  const handleRegisterSelected = async () => {
    if (!aiSuggestions) return;
    triggerBleep();

    // 1. Filter selected tasks and map to session Task format
    const selectedTasks = aiSuggestions.tasks
      .filter(t => t.selected)
      .map(t => {
        const est = Number(t.estimatedEffort) || 1.5;
        const task: Task = {
          id: t.id || "task-" + Date.now() + Math.random(),
          title: t.title.trim() || "Task from Note",
          due: t.due || "today",
          progress: 0,
          priority: t.priority || "medium",
          completed: false,
          estimatedEffort: est,
          predictedEffort: Number(t.predictedEffort) || (est * 1.5),
          underestimationRisk: t.underestimationRisk ?? false,
          category: t.category || "General"
        };
        return task;
      });

    // 2. Filter selected calendar events
    const selectedEvents = aiSuggestions.calendarEvents
      .filter(e => e.selected)
      .map(e => e.text);

    // 3. Update session in cloud
    const updatedTasks = [...session.tasks, ...selectedTasks];
    const updatedCal = [...session.calendarToday, ...selectedEvents];

    await updateSessionInCloud({
      tasks: updatedTasks,
      calendarToday: updatedCal
    });

    setAiSuggestions(null);
  };

  // Inject Markdown helpers into editor at selection or cursor
  const injectMarkdown = (syntax: string, placeholder: string = "") => {
    triggerBleep();
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = editorContent;

    const selectedText = currentText.substring(start, end);
    const replacement = syntax.replace("$1", selectedText || placeholder);

    const newContent = currentText.substring(0, start) + replacement + currentText.substring(end);
    setEditorContent(newContent);

    // Re-focus and set selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + replacement.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  // Handle Dialog Responses (Save, Don't Save, Cancel)
  const handleDialogSave = async () => {
    triggerBleep();
    // 1. Perform save
    await handleSaveNote();
    const act = pendingAction;
    setPendingAction(null);

    // 2. Perform the delayed action
    if (act) {
      if (act.type === "close") {
        setActiveNoteId(null);
        setEditorTitle("");
        setEditorContent("");
        setOriginalTitle("");
        setOriginalContent("");
      } else if (act.type === "switch" && act.targetId) {
        const target = notes.find(n => n.id === act.targetId);
        if (target) {
          setActiveNoteId(target.id);
          setEditorTitle(target.title);
          setEditorContent(target.content);
          setOriginalTitle(target.title);
          setOriginalContent(target.content);
          setActiveTab("md");
        }
      } else if (act.type === "create") {
        handleCreateNewNote();
      }
    }
  };

  const handleDialogDiscard = () => {
    triggerBleep();
    const act = pendingAction;
    setPendingAction(null);

    // Reset and perform delayed action
    if (act) {
      if (act.type === "close") {
        setActiveNoteId(null);
        setEditorTitle("");
        setEditorContent("");
        setOriginalTitle("");
        setOriginalContent("");
      } else if (act.type === "switch" && act.targetId) {
        const target = notes.find(n => n.id === act.targetId);
        if (target) {
          setActiveNoteId(target.id);
          setEditorTitle(target.title);
          setEditorContent(target.content);
          setOriginalTitle(target.title);
          setOriginalContent(target.content);
          setActiveTab("md");
        }
      } else if (act.type === "create") {
        // Clear dirty state so handleCreateNewNote can proceed safely
        setEditorTitle("");
        setEditorContent("");
        setOriginalTitle("");
        setOriginalContent("");
        
        const newNote: Note = {
          id: "note-" + Date.now(),
          title: "Untitled Note",
          content: "# Untitled Note\n\nWrite your thoughts here...",
          updatedAt: new Date().toISOString()
        };
        const updatedNotes = [...notes, newNote];
        updateSessionInCloud({ notes: updatedNotes });
        
        setActiveNoteId(newNote.id);
        setEditorTitle(newNote.title);
        setEditorContent(newNote.content);
        setOriginalTitle(newNote.title);
        setOriginalContent(newNote.content);
        setActiveTab("md");
      }
    }
  };

  const handleDialogCancel = () => {
    triggerBleep();
    setPendingAction(null);
  };

  return (
    <div id="notes-dock" className="border-4 border-black bg-[#fcfbeb] rounded-lg p-4 shadow-[4px_4px_0px_#000] space-y-4">
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2.5">
        <h4 className="font-mono text-xs font-bold text-gray-900 uppercase flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-emerald-700" />
          <span>SKEUOMORPHIC HANDWRITTEN NOTES</span>
        </h4>
        <span className="font-mono text-[9px] bg-black text-[#e5c543] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
          MARKDOWN INK SYSTEM
        </span>
      </div>

      {activeNoteId === null ? (
        /* ================= LIST MODE ================= */
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="font-mono text-[11px] text-gray-600 leading-tight">
              Maintain persistent offline records and scratchpads. Supports Markdown formatting, rendering preview tabs, and automatic AI schedule parsing on save.
            </p>
            <SkeuoButton
              onClick={handleCreateNewNote}
              variant="primary"
              size="sm"
              className="text-black font-bold flex items-center gap-1 shrink-0 ml-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>NEW NOTE</span>
            </SkeuoButton>
          </div>

          {notes.length === 0 ? (
            <div className="border-2 border-dashed border-zinc-400 rounded-lg p-6 text-center bg-white/60">
              <FileText className="w-8 h-8 text-zinc-400 mx-auto mb-2 animate-pulse" />
              <div className="font-mono text-xs font-bold text-zinc-600 uppercase">NO NOTES LOGGED</div>
              <p className="font-mono text-[10px] text-zinc-500 mt-1">
                Tap the "NEW NOTE" button to forge your first formatted markdown record.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
              {notes.map((note) => {
                const updatedString = new Date(note.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                });
                return (
                  <div
                    key={note.id}
                    onClick={() => handleOpenNote(note)}
                    className="border-2 border-black bg-white p-3 rounded shadow-[2.5px_2.5px_0px_rgba(0,0,0,1)] hover:bg-[#fffae0] hover:translate-y-[-1px] hover:shadow-[3.5px_3.5px_0px_rgba(0,0,0,1)] cursor-pointer transition-all flex flex-col justify-between group relative min-h-[95px]"
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-handwritten text-base font-bold text-gray-900 group-hover:text-amber-950 truncate max-w-[80%]">
                          {note.title}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          className="opacity-60 group-hover:opacity-100 hover:text-red-700 p-0.5"
                          title="Delete note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[10px] font-mono text-gray-500 line-clamp-2 leading-relaxed">
                        {note.content.replace(/[#*`_\[\]]/g, "")}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-dashed border-gray-200 pt-1.5 mt-2">
                      <span className="text-[9px] font-mono text-gray-400 uppercase">
                        🕒 {updatedString}
                      </span>
                      <span className="text-[9px] font-mono font-bold bg-[#f1f0e4] border border-black/10 px-1 py-0.5 rounded text-gray-700">
                        OPEN
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================= EDITOR MODE ================= */
        <div className="space-y-3">
          
          {/* Editor Header Title & Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#f1f0e4] p-2 border-2 border-black rounded shadow-[2px_2px_0px_#000]">
            <input
              type="text"
              value={editorTitle}
              onChange={(e) => setEditorTitle(e.target.value)}
              placeholder="Give note a title..."
              className="font-handwritten text-lg font-bold text-gray-900 bg-transparent border-b border-black/15 focus:border-black focus:outline-none px-1.5 py-0.5 flex-1 max-w-md placeholder-zinc-400"
            />
            
            {/* MD vs Preview Toggle tabs */}
            <div className="flex border-2 border-black rounded overflow-hidden h-7 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => { triggerBleep(); setActiveTab("md"); }}
                className={`font-mono text-[10px] font-bold px-3 uppercase tracking-wide transition-colors ${
                  activeTab === "md" 
                    ? "bg-black text-[#e5c543]" 
                    : "bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                MD (Edit)
              </button>
              <button
                type="button"
                onClick={() => { triggerBleep(); setActiveTab("preview"); }}
                className={`font-mono text-[10px] font-bold px-3 border-l border-black uppercase tracking-wide transition-colors ${
                  activeTab === "preview" 
                    ? "bg-black text-[#e5c543]" 
                    : "bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                Preview
              </button>
            </div>
          </div>

          {/* Quick-Formatting Buttons (Helper for users who don't know markdown) */}
          {activeTab === "md" && (
            <div className="flex flex-wrap gap-1.5 items-center p-1.5 bg-[#f5f4ea] border border-black/10 rounded">
              <span className="font-mono text-[9px] text-zinc-500 font-bold uppercase mr-1">INK UTILS:</span>
              
              <button
                type="button"
                onClick={() => injectMarkdown("### $1", "Section Heading")}
                className="font-mono text-[10px] px-1.5 py-0.5 bg-white hover:bg-zinc-100 border border-black rounded flex items-center gap-1 font-bold text-zinc-800"
                title="Heading 3"
              >
                <Heading className="w-3 h-3 text-zinc-600" />
                <span>Head</span>
              </button>

              <button
                type="button"
                onClick={() => injectMarkdown("**$1**", "bold text")}
                className="font-mono text-[10px] px-1.5 py-0.5 bg-white hover:bg-zinc-100 border border-black rounded flex items-center gap-1 font-bold text-zinc-800"
                title="Bold"
              >
                <Bold className="w-3 h-3 text-zinc-600" />
                <span>Bold</span>
              </button>

              <button
                type="button"
                onClick={() => injectMarkdown("*$1*", "italic text")}
                className="font-mono text-[10px] px-1.5 py-0.5 bg-white hover:bg-zinc-100 border border-black rounded flex items-center gap-1 font-bold text-zinc-800"
                title="Italic"
              >
                <Italic className="w-3 h-3 text-zinc-600" />
                <span>Ital</span>
              </button>

              <button
                type="button"
                onClick={() => injectMarkdown(
                  "\n| Header 1 | Header 2 |\n|---|---|\n| Item 1 | Item 2 |\n"
                )}
                className="font-mono text-[10px] px-1.5 py-0.5 bg-white hover:bg-zinc-100 border border-black rounded flex items-center gap-1 font-bold text-zinc-800"
                title="Table Template"
              >
                <Table className="w-3 h-3 text-zinc-600" />
                <span>Table</span>
              </button>

              <button
                type="button"
                onClick={() => injectMarkdown("\n```javascript\n// Write code here\n$1\n```\n", "console.log('hello');")}
                className="font-mono text-[10px] px-1.5 py-0.5 bg-white hover:bg-zinc-100 border border-black rounded flex items-center gap-1 font-bold text-zinc-800"
                title="Code block with syntax highlighting"
              >
                <Code className="w-3 h-3 text-zinc-600" />
                <span>Code</span>
              </button>

              <button
                type="button"
                onClick={() => injectMarkdown("- $1", "List Item")}
                className="font-mono text-[10px] px-1.5 py-0.5 bg-white hover:bg-zinc-100 border border-black rounded flex items-center gap-1 font-bold text-zinc-800"
                title="Unordered list"
              >
                <List className="w-3 h-3 text-zinc-600" />
                <span>List</span>
              </button>

              <button
                type="button"
                onClick={() => injectMarkdown("[$1](https://google.com)", "Link Title")}
                className="font-mono text-[10px] px-1.5 py-0.5 bg-white hover:bg-zinc-100 border border-black rounded flex items-center gap-1 font-bold text-zinc-800"
                title="Hyperlink"
              >
                <Link className="w-3 h-3 text-zinc-600" />
                <span>Link</span>
              </button>
            </div>
          )}

          {/* Core Content Area */}
          <div className="border-2 border-black rounded min-h-[220px] bg-white shadow-[inset_0px_2px_4px_rgba(0,0,0,0.1)]">
            {activeTab === "md" ? (
              <textarea
                ref={textareaRef}
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                placeholder="Compose thoughts, specifications, lists or plans here. Highlight key times/dates to trigger the automatic scheduler..."
                className="w-full h-56 font-mono text-xs p-3 focus:outline-none resize-none bg-transparent text-black"
              />
            ) : (
              <div className="markdown-body p-4 overflow-auto max-h-56 min-h-56 text-zinc-800 text-xs font-mono space-y-2 select-text leading-relaxed">
                {editorContent.trim() ? (
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ node, ...props }) => <h1 className="text-base font-bold mt-3 mb-1.5 border-b-2 border-black pb-0.5 text-black uppercase" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-sm font-bold mt-2.5 mb-1 border-b border-black/10 pb-0.5 text-zinc-900 uppercase" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-xs font-bold mt-2 mb-1 text-zinc-800 uppercase" {...props} />,
                      h4: ({ node, ...props }) => <h4 className="text-[11px] font-bold mt-2 mb-1 text-zinc-700 uppercase" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 space-y-1 text-zinc-800" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-zinc-800" {...props} />,
                      li: ({ node, ...props }) => <li className="list-item pl-0.5" {...props} />,
                      p: ({ node, ...props }) => <p className="my-1.5" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-extrabold text-black" {...props} />,
                      em: ({ node, ...props }) => <em className="italic text-zinc-700" {...props} />,
                      code: ({ node, className, children, ...props }) => (
                        <code className="bg-[#f0f0e8] px-1 py-0.5 border border-black/10 rounded font-mono text-[11px] text-red-700 break-all" {...props}>
                          {children}
                        </code>
                      ),
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-3">
                          <table className="min-w-full divide-y-2 divide-black border-2 border-black bg-white text-left text-[11px] font-mono shadow-[2px_2px_0px_#000]" {...props} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => <thead className="bg-[#cfcfc4] text-black" {...props} />,
                      tbody: ({ node, ...props }) => <tbody className="divide-y divide-black/20" {...props} />,
                      tr: ({ node, ...props }) => <tr className="hover:bg-zinc-50 transition-colors" {...props} />,
                      th: ({ node, ...props }) => <th className="px-3 py-2 font-bold uppercase text-zinc-900 border-r border-black last:border-r-0" {...props} />,
                      td: ({ node, ...props }) => <td className="px-3 py-1.5 text-zinc-700 border-r border-black/20 last:border-r-0" {...props} />,
                    }}
                  >
                    {editorContent}
                  </Markdown>
                ) : (
                  <p className="text-zinc-400 italic">No note content written yet. Switch to "MD" tab and type ink.</p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-between items-center">
            <span className="font-mono text-[9px] text-zinc-500">
              {isDirty ? (
                <span className="text-red-600 font-bold uppercase flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>Unsaved Changes Detected</span>
                </span>
              ) : (
                <span className="text-emerald-700 font-bold uppercase flex items-center gap-1">
                  <Check className="w-3 h-3 shrink-0" />
                  <span>Synced & Safe</span>
                </span>
              )}
            </span>

            <div className="flex gap-2">
              <SkeuoButton
                onClick={handleCloseNote}
                variant="secondary"
                size="sm"
                className="py-1 px-3 text-xs"
                disabled={isAiParsing}
              >
                <span>CLOSE NOTE</span>
              </SkeuoButton>

              <SkeuoButton
                onClick={handleSaveNote}
                variant="success"
                size="sm"
                className="py-1.5 px-4 font-bold text-xs flex items-center gap-1.5"
                disabled={isAiParsing}
              >
                {isAiParsing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-950" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{isAiParsing ? "PARSING WITH AI..." : "SAVE CHANGES"}</span>
              </SkeuoButton>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: UNSAVED CHANGES WARNING DIALOGUE ================= */}
      {pendingAction !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-mono">
          <div className="w-full max-w-sm border-4 border-black bg-white rounded-lg shadow-[8px_8px_0px_#000] p-4 space-y-4">
            
            {/* Modal Title Banner */}
            <div className="bg-red-200 border-2 border-black p-2 rounded flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-800 shrink-0" />
              <span className="text-xs font-extrabold text-red-900 uppercase">
                Warning: Unsaved Draft Edits
              </span>
            </div>

            <p className="text-xs text-zinc-800 leading-snug">
              Your note <strong>"{editorTitle || "Untitled"}"</strong> has unsaved changes. Leaving without saving will cause the new ink to evaporate.
            </p>

            {/* Standard 3 Actions Row */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleDialogSave}
                className="font-mono text-[10px] font-extrabold border-2 border-black rounded p-2 text-center bg-emerald-200 hover:bg-emerald-300 text-emerald-950 active:translate-y-0.5 cursor-pointer"
              >
                SAVE
              </button>
              
              <button
                type="button"
                onClick={handleDialogDiscard}
                className="font-mono text-[10px] font-extrabold border-2 border-black rounded p-2 text-center bg-red-100 hover:bg-red-200 text-red-900 active:translate-y-0.5 cursor-pointer"
              >
                DON'T SAVE
              </button>

              <button
                type="button"
                onClick={handleDialogCancel}
                className="font-mono text-[10px] font-extrabold border-2 border-black rounded p-2 text-center bg-gray-100 hover:bg-gray-200 text-zinc-800 active:translate-y-0.5 cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: MULTI-ITEM SCHEDULE SUGGESTIONS FROM NOTES ================= */}
      {aiSuggestions?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-mono">
          <div className="w-full max-w-md border-4 border-black bg-white rounded-lg shadow-[8px_8px_0px_#000] p-4 space-y-4">
            
            {/* Banner Header */}
            <div className="bg-[#fff9d0] border-2 border-black p-2.5 rounded flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600 shrink-0 animate-bounce" />
                <span className="text-xs font-extrabold text-amber-950 uppercase">
                  Multi-item Agenda Extracted!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAiSuggestions(null)}
                className="text-amber-950 hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Jarvis Speech Summary Brief */}
            {aiSuggestions.parsedSummary && (
              <div className="bg-zinc-950 text-emerald-400 p-3 rounded border-2 border-black font-mono text-[11px] leading-tight shadow-[3px_3px_0px_#000]">
                <div className="text-[9px] text-zinc-500 font-bold uppercase mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Jarvis Intelligence Briefing:</span>
                </div>
                {aiSuggestions.parsedSummary}
              </div>
            )}

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {/* Extracted Tasks Section */}
              {aiSuggestions.tasks.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="text-[10px] text-zinc-600 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Extracted Planner Tasks ({aiSuggestions.tasks.filter(t => t.selected).length}/{aiSuggestions.tasks.length})</span>
                  </h5>
                  <div className="space-y-2">
                    {aiSuggestions.tasks.map(t => (
                      <div key={t.id} className={`border-2 border-black p-2 bg-[#fbfbfa] rounded shadow-[2px_2px_0px_#000] flex flex-col gap-1.5 transition-opacity ${t.selected ? "opacity-100" : "opacity-60"}`}>
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={t.selected}
                            onChange={() => toggleTaskSelected(t.id)}
                            className="mt-1 cursor-pointer accent-black h-4 w-4"
                          />
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={t.title}
                              onChange={(e) => updateTaskField(t.id, "title", e.target.value)}
                              className="w-full font-mono font-bold text-xs bg-transparent border-b border-dashed border-black/25 focus:border-black focus:outline-none pb-0.5 text-black"
                            />
                          </div>
                        </div>
                        {t.selected && (
                          <div className="grid grid-cols-2 gap-2 pl-6">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] text-zinc-500 font-bold uppercase">DUE DATE</span>
                              <input
                                type="text"
                                value={t.due}
                                onChange={(e) => updateTaskField(t.id, "due", e.target.value)}
                                className="font-mono text-[10px] border border-black/20 px-1 py-0.5 rounded bg-white text-black focus:outline-none"
                              />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] text-zinc-500 font-bold uppercase">PRIORITY</span>
                              <select
                                value={t.priority}
                                onChange={(e) => updateTaskField(t.id, "priority", e.target.value)}
                                className="font-mono text-[10px] border border-black/20 px-1 py-0.5 rounded bg-white text-black focus:outline-none"
                              >
                                <option value="low">LOW</option>
                                <option value="medium">MEDIUM</option>
                                <option value="high">HIGH</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Calendar Events Section */}
              {aiSuggestions.calendarEvents.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <h5 className="text-[10px] text-zinc-600 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Calendar Agenda Slots ({aiSuggestions.calendarEvents.filter(e => e.selected).length}/{aiSuggestions.calendarEvents.length})</span>
                  </h5>
                  <div className="space-y-2">
                    {aiSuggestions.calendarEvents.map(e => (
                      <div key={e.id} className={`border-2 border-black p-2 bg-[#f0f9f4] rounded shadow-[2px_2px_0px_#000] flex items-start gap-2 transition-opacity ${e.selected ? "opacity-100" : "opacity-60"}`}>
                        <input
                          type="checkbox"
                          checked={e.selected}
                          onChange={() => toggleEventSelected(e.id)}
                          className="mt-1 cursor-pointer accent-black h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={e.text}
                            onChange={(evt) => updateEventText(e.id, evt.target.value)}
                            className="w-full font-mono text-xs bg-transparent border-b border-dashed border-black/25 focus:border-black focus:outline-none pb-0.5 text-black"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Bottom buttons */}
            <div className="flex gap-2 pt-2 border-t border-black/10">
              <button
                type="button"
                onClick={() => setAiSuggestions(null)}
                className="flex-1 font-mono text-xs font-bold border-2 border-black rounded p-2.5 bg-gray-100 hover:bg-gray-200 text-zinc-800 text-center cursor-pointer"
              >
                DISCARD ALL
              </button>

              <button
                type="button"
                onClick={handleRegisterSelected}
                disabled={aiSuggestions.tasks.filter(t => t.selected).length === 0 && aiSuggestions.calendarEvents.filter(e => e.selected).length === 0}
                className="flex-1 font-mono text-xs font-bold border-2 border-black rounded p-2.5 bg-emerald-200 hover:bg-emerald-300 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-300 disabled:cursor-not-allowed text-emerald-950 text-center cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>COMMIT ITEMS ({aiSuggestions.tasks.filter(t => t.selected).length + aiSuggestions.calendarEvents.filter(e => e.selected).length})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
