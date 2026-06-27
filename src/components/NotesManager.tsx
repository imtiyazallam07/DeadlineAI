import React, { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
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
  ChevronRight
} from "lucide-react";

interface NotesManagerProps {
  session: UserSession;
  updateSessionInCloud: (updatedFields: Partial<UserSession>) => Promise<void>;
  triggerBleep: () => void;
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
  const [scheduleSuggestion, setScheduleSuggestion] = useState<{
    detectedTerm: string;
    prefilledTitle: string;
    suggestedType: "task" | "calendar";
    isOpen: boolean;
  } | null>(null);

  // New Schedule Item state
  const [suggestedItemTitle, setSuggestedItemTitle] = useState("");
  const [suggestedItemTimeOrDue, setSuggestedItemTimeOrDue] = useState("today 5pm");
  const [suggestedItemCategory, setSuggestedItemCategory] = useState("General");
  const [suggestedItemPriority, setSuggestedItemPriority] = useState<"low" | "medium" | "high">("medium");

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

  // Scan text for date/time/schedule markers
  const scanForSchedules = (text: string): string | null => {
    // Regex for basic date/time mentions
    const markers = [
      /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\b\d{1,2}\s*(?:am|pm|am|pm)\b/i,
      /\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/i,
      /\b(?:at|by)\s+\d{1,2}\b/i,
      /\b(schedule|meeting|deadline|appt|appointment|calendar|call)\b/i
    ];

    for (const regex of markers) {
      const match = text.match(regex);
      if (match) {
        return match[0];
      }
    }
    return null;
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

    // Scan for schedules suggestion
    const mention = scanForSchedules(editorContent) || scanForSchedules(editorTitle);
    if (mention) {
      // Show AI suggestion dialog
      setSuggestedItemTitle(editorTitle.trim());
      setSuggestedItemTimeOrDue(mention.toLowerCase() === "meeting" || mention.toLowerCase() === "schedule" ? "today 5pm" : mention);
      setScheduleSuggestion({
        detectedTerm: mention,
        prefilledTitle: editorTitle.trim(),
        suggestedType: mention.toLowerCase().includes("meet") ? "calendar" : "task",
        isOpen: true
      });
    }
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

  // Add the suggested item to tasks or schedule
  const handleAddSuggestedItem = async () => {
    triggerBleep();
    if (scheduleSuggestion?.suggestedType === "task") {
      // Add as a Task
      const est = 1.5;
      const task: Task = {
        id: "task-" + Date.now(),
        title: suggestedItemTitle.trim() || "Task from Note",
        due: suggestedItemTimeOrDue || "today",
        progress: 0,
        priority: suggestedItemPriority,
        completed: false,
        estimatedEffort: est,
        predictedEffort: est * 1.5,
        underestimationRisk: false,
        category: suggestedItemCategory
      };
      const updatedTasks = [...session.tasks, task];
      await updateSessionInCloud({ tasks: updatedTasks });
    } else {
      // Add as Calendar Event
      const textEvent = `${suggestedItemTimeOrDue.toUpperCase()} — ${suggestedItemTitle.trim()}`;
      const updatedCal = [...session.calendarToday, textEvent];
      await updateSessionInCloud({ calendarToday: updatedCal });
    }
    setScheduleSuggestion(null);
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
                  <Markdown>{editorContent}</Markdown>
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
              >
                <span>CLOSE NOTE</span>
              </SkeuoButton>

              <SkeuoButton
                onClick={handleSaveNote}
                variant="success"
                size="sm"
                className="py-1.5 px-4 font-bold text-xs"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                <span>SAVE CHANGES</span>
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

      {/* ================= MODAL: SCHEDULE SUGGESTION FROM NOTES ================= */}
      {scheduleSuggestion?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-mono">
          <div className="w-full max-w-md border-4 border-black bg-white rounded-lg shadow-[8px_8px_0px_#000] p-4 space-y-4">
            
            {/* Banner Header */}
            <div className="bg-[#fff9d0] border-2 border-black p-2.5 rounded flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600 shrink-0 animate-bounce" />
                <span className="text-xs font-extrabold text-amber-950 uppercase">
                  Schedule Mentor Detected!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setScheduleSuggestion(null)}
                className="text-amber-950 hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 bg-[#f9f8f0] border border-black/10 p-2.5 rounded text-xs text-zinc-800">
              <p className="leading-snug">
                You saved a note mentioning a schedule trigger: <span className="bg-amber-100 text-amber-950 px-1 font-bold border border-amber-400 rounded">"{scheduleSuggestion.detectedTerm}"</span>.
              </p>
              <p className="font-medium text-[11px] text-zinc-500">
                Would you like to register this reference as an item in your workspace?
              </p>
            </div>

            <div className="space-y-3">
              {/* Event/Task Type Toggle */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-600 font-bold block uppercase">ITEM ARCHITECTURE</label>
                <div className="grid grid-cols-2 gap-2 h-7">
                  <button
                    type="button"
                    onClick={() => {
                      triggerBleep();
                      setScheduleSuggestion(prev => prev ? { ...prev, suggestedType: "task" } : null);
                    }}
                    className={`font-mono text-[10px] font-bold border-2 border-black rounded flex items-center justify-center gap-1 transition-colors ${
                      scheduleSuggestion.suggestedType === "task"
                        ? "bg-black text-[#e5c543]"
                        : "bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>WORK TASK</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerBleep();
                      setScheduleSuggestion(prev => prev ? { ...prev, suggestedType: "calendar" } : null);
                    }}
                    className={`font-mono text-[10px] font-bold border-2 border-black rounded flex items-center justify-center gap-1 transition-colors ${
                      scheduleSuggestion.suggestedType === "calendar"
                        ? "bg-black text-[#e5c543]"
                        : "bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>CALENDAR AGENDA</span>
                  </button>
                </div>
              </div>

              {/* Title Field */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-600 font-bold block uppercase">ITEM TITLE</label>
                <input
                  type="text"
                  value={suggestedItemTitle}
                  onChange={(e) => setSuggestedItemTitle(e.target.value)}
                  className="w-full font-mono text-xs border-2 border-black p-2 rounded bg-white text-black focus:outline-none"
                  placeholder="e.g. Discuss note contents with Priya"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Date or Time string */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-600 font-bold block uppercase">
                    {scheduleSuggestion.suggestedType === "task" ? "DUE TIME" : "EVENT SLOT"}
                  </label>
                  <input
                    type="text"
                    value={suggestedItemTimeOrDue}
                    onChange={(e) => setSuggestedItemTimeOrDue(e.target.value)}
                    className="w-full font-mono text-xs border-2 border-black p-2 rounded bg-white text-black focus:outline-none"
                    placeholder="e.g. tomorrow 5pm or 2:00 PM"
                  />
                </div>

                {scheduleSuggestion.suggestedType === "task" ? (
                  /* Task priority */
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-600 font-bold block uppercase">PRIORITY</label>
                    <select
                      value={suggestedItemPriority}
                      onChange={(e) => setSuggestedItemPriority(e.target.value as any)}
                      className="w-full font-mono text-xs border-2 border-black p-2 rounded bg-white text-black cursor-pointer focus:outline-none h-[38px]"
                    >
                      <option value="low">LOW</option>
                      <option value="medium">MEDIUM</option>
                      <option value="high">HIGH</option>
                    </select>
                  </div>
                ) : (
                  /* Event category */
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-600 font-bold block uppercase">CATEGORY</label>
                    <input
                      type="text"
                      value={suggestedItemCategory}
                      onChange={(e) => setSuggestedItemCategory(e.target.value)}
                      className="w-full font-mono text-xs border-2 border-black p-2 rounded bg-white text-black focus:outline-none h-[38px]"
                      placeholder="e.g. Meeting, Gym"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Action Bottom buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setScheduleSuggestion(null)}
                className="flex-1 font-mono text-xs font-bold border-2 border-black rounded p-2.5 bg-gray-100 hover:bg-gray-200 text-zinc-800 text-center cursor-pointer"
              >
                DISCARD SUGGESTION
              </button>

              <button
                type="button"
                onClick={handleAddSuggestedItem}
                className="flex-1 font-mono text-xs font-bold border-2 border-black rounded p-2.5 bg-emerald-200 hover:bg-emerald-300 text-emerald-950 text-center cursor-pointer flex items-center justify-center gap-1"
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>REGISTER ITEM</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
