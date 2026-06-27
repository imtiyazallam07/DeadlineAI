import React, { useState, useEffect } from "react";
import { Task } from "../types";
import SkeuoButton from "./SkeuoButton";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  Clock, 
  Coffee, 
  Check, 
  CheckCircle, 
  AlertTriangle, 
  Timer, 
  Zap,
  BookOpen,
  Sliders,
  ChevronRight,
  ShieldAlert
} from "lucide-react";

interface FocusTimerProps {
  tasks: Task[];
  timerIsRunning: boolean;
  timerIsPaused: boolean;
  timerIntervals: any[];
  timerCurrentIndex: number;
  timerSecondsRemaining: number;
  timerSelectedTaskId: string;
  timerFocusHours: number;
  timerNumBreaks: number;
  timerBreakMinutes: number;
  
  setTimerIsRunning: (val: boolean) => void;
  setTimerIsPaused: (val: boolean) => void;
  setTimerIntervals: (val: any[]) => void;
  setTimerCurrentIndex: (val: number) => void;
  setTimerSecondsRemaining: (val: number) => void;
  setTimerSelectedTaskId: (val: string) => void;
  setTimerFocusHours: (val: number) => void;
  setTimerNumBreaks: (val: number) => void;
  setTimerBreakMinutes: (val: number) => void;
  
  handleUpdateProgress: (id: string, progress: number) => void;
  handleToggleCompleted: (id: string) => void;
  triggerBleep: () => void;
  playTimerBeep: (type: 'start' | 'pause' | 'switch' | 'complete') => void;
  advanceTimer: () => void;
}

export default function FocusTimer({
  tasks,
  timerIsRunning,
  timerIsPaused,
  timerIntervals,
  timerCurrentIndex,
  timerSecondsRemaining,
  timerSelectedTaskId,
  timerFocusHours,
  timerNumBreaks,
  timerBreakMinutes,
  
  setTimerIsRunning,
  setTimerIsPaused,
  setTimerIntervals,
  setTimerCurrentIndex,
  setTimerSecondsRemaining,
  setTimerSelectedTaskId,
  setTimerFocusHours,
  setTimerNumBreaks,
  setTimerBreakMinutes,
  
  handleUpdateProgress,
  handleToggleCompleted,
  triggerBleep,
  playTimerBeep,
  advanceTimer
}: FocusTimerProps) {
  // Local config UI state (temporary until they press START)
  const [localFocusHours, setLocalFocusHours] = useState(timerFocusHours);
  const [localNumBreaks, setLocalNumBreaks] = useState(timerNumBreaks);
  const [localBreakMinutes, setLocalBreakMinutes] = useState(timerBreakMinutes);

  // Filter out completed tasks so they only focus on active items
  const activeTasks = tasks.filter(t => !t.completed);
  const currentTask = tasks.find(t => t.id === timerSelectedTaskId);

  // Sync local states to parent config when modified
  useEffect(() => {
    if (!timerIsRunning) {
      setTimerFocusHours(localFocusHours);
      setTimerNumBreaks(localNumBreaks);
      setTimerBreakMinutes(localBreakMinutes);
    }
  }, [localFocusHours, localNumBreaks, localBreakMinutes, timerIsRunning]);

  // Handle building the sequence dynamically
  const calculateSequence = (hours: number, numBreaks: number, breakMins: number) => {
    const totalFocusSec = Math.round(hours * 60 * 60);
    const numFocusBlocks = numBreaks + 1;
    const focusSecPerBlock = Math.floor(totalFocusSec / numFocusBlocks);
    
    const calculatedIntervals: any[] = [];
    
    for (let i = 0; i < numFocusBlocks; i++) {
      // Focus Interval
      const isLastBlock = i === numFocusBlocks - 1;
      const blockSec = isLastBlock 
        ? totalFocusSec - (focusSecPerBlock * i) 
        : focusSecPerBlock;
        
      calculatedIntervals.push({
        type: 'focus',
        label: `Focus Block ${i + 1}/${numFocusBlocks}`,
        durationSec: blockSec,
        blockIndex: i + 1
      });
      
      // Break Interval
      if (i < numBreaks) {
        calculatedIntervals.push({
          type: 'break',
          label: `Break ${i + 1}/${numBreaks}`,
          durationSec: breakMins * 60,
          blockIndex: i + 1
        });
      }
    }
    
    return calculatedIntervals;
  };

  // Preview generated intervals for configuration UI
  const previewIntervals = calculateSequence(localFocusHours, localNumBreaks, localBreakMinutes);

  const startFocusSession = () => {
    triggerBleep();
    const seq = calculateSequence(localFocusHours, localNumBreaks, localBreakMinutes);
    setTimerIntervals(seq);
    setTimerCurrentIndex(0);
    setTimerSecondsRemaining(seq[0].durationSec);
    setTimerIsRunning(true);
    setTimerIsPaused(false);
    playTimerBeep('start');
  };

  const togglePause = () => {
    triggerBleep();
    setTimerIsPaused(!timerIsPaused);
    playTimerBeep('pause');
  };

  const skipInterval = () => {
    triggerBleep();
    advanceTimer();
  };

  const resetSession = () => {
    triggerBleep();
    setTimerIsRunning(false);
    setTimerIsPaused(false);
    setTimerCurrentIndex(0);
    setTimerSecondsRemaining(0);
  };

  // Format Helper: Seconds to MM:SS or HH:MM:SS
  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    
    const pad = (n: number) => n.toString().padStart(2, "0");
    
    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const currentInterval = timerIntervals[timerCurrentIndex];
  
  // Calculate percentage of remaining time in active interval
  const getIntervalProgress = () => {
    if (!currentInterval || currentInterval.durationSec === 0) return 0;
    return ((currentInterval.durationSec - timerSecondsRemaining) / currentInterval.durationSec) * 100;
  };

  return (
    <div id="pomodoro-focus-dock" className="border-4 border-black bg-[#fbfbf6] p-4 rounded-lg shadow-[4px_4px_0px_#000] space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2.5">
        <h4 className="font-mono text-xs font-bold text-gray-900 uppercase flex items-center gap-1.5">
          <Timer className={`w-4 h-4 text-amber-600 ${timerIsRunning && !timerIsPaused ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          <span>TACTILE POMODORO FOCUS DOCK</span>
        </h4>
        <span className="font-mono text-[9px] bg-black text-[#e5c543] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
          INTERVAL CONSOLE
        </span>
      </div>

      {!timerIsRunning ? (
        /* ================= CONFIGURATION MODE ================= */
        <div className="space-y-4">
          <p className="font-mono text-[11px] text-gray-600 leading-tight">
            Schedule a high-intensity focus loop. Map out your working intervals separated by restorative breaks to defeat cognitive fatigue and maintain deep flow.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#f1f0e4] p-3 rounded border border-black/10">
            {/* Focus settings */}
            <div className="space-y-3">
              <div className="font-mono text-[10px] font-bold text-gray-700 flex items-center gap-1 uppercase">
                <Sliders className="w-3.5 h-3.5 text-zinc-600" />
                <span>Timer Parameters</span>
              </div>

              {/* Total Focus Duration */}
              <div className="space-y-1">
                <label className="font-mono text-[10px] text-gray-600 block uppercase">
                  Total Focus Target ({localFocusHours === 0.5 ? "30 mins" : localFocusHours === 1 ? "1 Hour" : `${localFocusHours} Hours`})
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {[0.5, 1, 1.5, 2, 3].map((hr) => (
                    <button
                      key={hr}
                      type="button"
                      onClick={() => { triggerBleep(); setLocalFocusHours(hr); }}
                      className={`font-mono text-[10px] font-bold px-2 py-1 rounded border border-black ${
                        localFocusHours === hr 
                          ? "bg-black text-[#e5c543]" 
                          : "bg-white hover:bg-gray-100"
                      }`}
                    >
                      {hr === 0.5 ? "30m" : `${hr}h`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of Breaks */}
              <div className="space-y-1">
                <label className="font-mono text-[10px] text-gray-600 block uppercase">
                  Breaks Desired ({localNumBreaks} {localNumBreaks === 1 ? "break" : "breaks"})
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {[0, 1, 2, 3, 4].map((brk) => (
                    <button
                      key={brk}
                      type="button"
                      onClick={() => { triggerBleep(); setLocalNumBreaks(brk); }}
                      className={`font-mono text-[10px] font-bold px-2 py-1 rounded border border-black ${
                        localNumBreaks === brk 
                          ? "bg-black text-[#e5c543]" 
                          : "bg-white hover:bg-gray-100"
                      }`}
                    >
                      {brk === 0 ? "None" : `${brk} Break${brk > 1 ? 's' : ''}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Break Length */}
              {localNumBreaks > 0 && (
                <div className="space-y-1">
                  <label className="font-mono text-[10px] text-gray-600 block uppercase">
                    Duration per Break ({localBreakMinutes} mins)
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {[3, 5, 10, 15].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => { triggerBleep(); setLocalBreakMinutes(mins); }}
                        className={`font-mono text-[10px] font-bold px-2.5 py-1 rounded border border-black ${
                          localBreakMinutes === mins 
                            ? "bg-black text-[#e5c543]" 
                            : "bg-white hover:bg-gray-100"
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Task selection */}
            <div className="space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="font-mono text-[10px] font-bold text-gray-700 flex items-center gap-1 uppercase">
                  <BookOpen className="w-3.5 h-3.5 text-zinc-600" />
                  <span>Focused Task Attachment</span>
                </div>
                
                {activeTasks.length > 0 ? (
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] text-gray-600 block uppercase">
                      Select Task to Advance on Complete
                    </label>
                    <select
                      value={timerSelectedTaskId}
                      onChange={(e) => { triggerBleep(); setTimerSelectedTaskId(e.target.value); }}
                      className="w-full font-mono text-xs border-2 border-black p-2 rounded bg-white focus:outline-none cursor-pointer text-black"
                    >
                      <option value="">-- Focus on General Session --</option>
                      {activeTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.category || "General"}) — Priority: {t.priority.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="text-[10px] font-mono text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                    ⚠️ No active tasks enrolled. You can start a general focus session, or scratch in a task first in the form below.
                  </div>
                )}
              </div>

              {currentTask && (
                <div className="bg-white/80 border border-black/10 p-2.5 rounded font-mono text-xs text-zinc-800 space-y-1">
                  <div className="font-bold flex items-center gap-1 text-zinc-900">
                    <Zap className="w-3.5 h-3.5 text-yellow-600" />
                    <span>Target: {currentTask.title}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 flex justify-between">
                    <span>Progress: {currentTask.progress}%</span>
                    <span className="uppercase text-amber-700 font-bold">Priority: {currentTask.priority}</span>
                  </div>
                  <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden border border-black/10">
                    <div className="bg-emerald-600 h-full" style={{ width: `${currentTask.progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Map Visualization */}
          <div className="border border-dashed border-zinc-400 p-2.5 rounded bg-zinc-50 space-y-2">
            <div className="font-mono text-[10px] font-bold text-gray-600 uppercase flex justify-between items-center">
              <span>🗺️ Dynamic Schedule Map</span>
              <span className="text-[9px] text-zinc-500 font-medium lowercase">
                ({previewIntervals.filter(i => i.type === 'focus').length} focus blocks + {previewIntervals.filter(i => i.type === 'break').length} breaks)
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
              {previewIntervals.map((interval, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                  <span className={`px-2 py-0.5 rounded border border-black font-bold flex items-center gap-1 select-none ${
                    interval.type === 'focus' 
                      ? 'bg-yellow-100 text-yellow-900' 
                      : 'bg-emerald-100 text-emerald-900'
                  }`}>
                    {interval.type === 'focus' ? <Clock className="w-3 h-3 text-amber-700" /> : <Coffee className="w-3 h-3 text-emerald-700" />}
                    <span>{Math.round(interval.durationSec / 60)}m</span>
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Ignite Button */}
          <SkeuoButton
            onClick={startFocusSession}
            variant="primary"
            className="w-full py-3 text-black font-bold text-xs flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>IGNITE FOCUS SEQUENCE ({localFocusHours * 60} MINS TOTAL)</span>
          </SkeuoButton>
        </div>
      ) : (
        /* ================= COUNTDOWN RUNNING MODE ================= */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            
            {/* Big LED Clock Readout */}
            <div className="md:col-span-5 border-2 border-black bg-black p-3.5 rounded-lg flex flex-col items-center justify-center text-[#8da387] shadow-[inset_0px_3px_5px_rgba(0,0,0,0.8)]">
              <span className="font-mono text-[9px] font-bold text-[#687a63] tracking-widest uppercase mb-1">
                {currentInterval ? currentInterval.label : "SESSION"}
              </span>
              <span className="font-mono text-3xl font-extrabold tracking-widest leading-none">
                {formatTime(timerSecondsRemaining)}
              </span>
              <div className="flex gap-2.5 mt-2 text-[10px] font-bold font-mono">
                <span className={currentInterval?.type === 'focus' ? 'text-[#e5c543]' : 'text-[#687a63]'}>
                  ● WORK
                </span>
                <span className={currentInterval?.type === 'break' ? 'text-emerald-400' : 'text-[#687a63]'}>
                  ● REST
                </span>
              </div>
            </div>

            {/* Interval Status and Attached Task Info */}
            <div className="md:col-span-7 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs font-bold px-2.5 py-0.5 border border-black rounded uppercase tracking-wide flex items-center gap-1 ${
                  currentInterval?.type === 'focus' 
                    ? "bg-red-200 text-red-900" 
                    : "bg-emerald-200 text-emerald-900"
                }`}>
                  {currentInterval?.type === 'focus' ? <Zap className="w-3.5 h-3.5 text-red-700 animate-pulse" /> : <Coffee className="w-3.5 h-3.5 text-emerald-700" />}
                  <span>{currentInterval?.type === 'focus' ? "FOCUSING" : "BREAK INTERVAL"}</span>
                </span>
                
                {timerIsPaused && (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 border border-black rounded uppercase bg-amber-200 text-amber-900 blink-fast">
                    PAUSED
                  </span>
                )}
              </div>

              {currentTask ? (
                <div className="border border-black p-2 rounded bg-white space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-gray-900 truncate pr-2">Target: {currentTask.title}</span>
                    <span className="text-[10px] text-gray-500 shrink-0 font-bold uppercase">{currentTask.category}</span>
                  </div>
                  
                  {/* Task Progress Controls */}
                  <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-dashed border-gray-200">
                    <span className="text-[10px] text-gray-600 font-bold">Progress: {currentTask.progress}%</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => { triggerBleep(); handleUpdateProgress(currentTask.id, Math.min(100, currentTask.progress + 10)); }}
                        className="text-[9px] bg-gray-200 hover:bg-gray-300 border border-black px-1.5 py-0.5 rounded font-bold"
                        title="Add 10% progress"
                      >
                        +10%
                      </button>
                      <button 
                        onClick={() => { triggerBleep(); handleUpdateProgress(currentTask.id, 100); }}
                        className="text-[9px] bg-emerald-200 hover:bg-emerald-300 border border-black px-1.5 py-0.5 rounded font-bold text-emerald-900"
                      >
                        COMPLETE
                      </button>
                    </div>
                  </div>
                  
                  {/* Visual Progress Bar */}
                  <div className="w-full bg-zinc-100 h-1 rounded-full overflow-hidden border border-black/10">
                    <div className="bg-emerald-600 h-full" style={{ width: `${currentTask.progress}%` }} />
                  </div>
                </div>
              ) : (
                <div className="p-2 border-2 border-dashed border-gray-400 bg-[#f4f3e9] rounded font-mono text-[11px] text-zinc-600 leading-tight">
                  ☕ Focusing on a General Session. Feel free to scratch tasks or write quick notes down below.
                </div>
              )}
            </div>
          </div>

          {/* Segment Progress Gauge */}
          <div className="space-y-1">
            <div className="flex justify-between items-center font-mono text-[9px] font-bold text-gray-500 uppercase">
              <span>Segment Progress</span>
              <span>{Math.round(getIntervalProgress())}%</span>
            </div>
            <div className="w-full h-3 border-2 border-black rounded-sm bg-white overflow-hidden p-0.5 flex gap-0.5">
              {/* Segmented display bars */}
              {Array.from({ length: 20 }).map((_, i) => {
                const isActive = (i / 20) * 100 < getIntervalProgress();
                return (
                  <div
                    key={i}
                    className={`flex-1 h-full rounded-sm transition-all duration-300 ${
                      isActive 
                        ? currentInterval?.type === 'focus' 
                          ? 'bg-amber-500 border border-amber-600/20' 
                          : 'bg-emerald-500 border border-emerald-600/20'
                        : 'bg-gray-100'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Overall Pipeline Sequence Map Tracking */}
          <div className="border border-black bg-zinc-50 p-2.5 rounded text-xs font-mono space-y-1.5">
            <div className="text-[10px] font-bold text-zinc-500 uppercase flex justify-between">
              <span>SEQUENCE WORKFLOW TRACKING</span>
              <span>INDEX: {timerCurrentIndex + 1} / {timerIntervals.length}</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-1.5">
              {timerIntervals.map((interval, idx) => {
                const isCurrent = idx === timerCurrentIndex;
                const isCompleted = idx < timerCurrentIndex;
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronRight className="w-3 h-3 text-zinc-300" />}
                    <span className={`px-2 py-0.5 rounded text-[10px] border font-bold flex items-center gap-1 ${
                      isCurrent 
                        ? 'bg-black text-[#e5c543] border-black scale-105' 
                        : isCompleted
                        ? 'bg-gray-200 text-gray-500 border-gray-300 line-through'
                        : 'bg-white text-gray-700 border-zinc-400'
                    }`}>
                      {interval.type === 'focus' ? <Clock className="w-2.5 h-2.5" /> : <Coffee className="w-2.5 h-2.5" />}
                      <span>{Math.round(interval.durationSec / 60)}m</span>
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Tactile Control Buttons */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <SkeuoButton
              onClick={togglePause}
              variant={timerIsPaused ? "success" : "secondary"}
              size="sm"
              className="py-2 text-xs"
            >
              {timerIsPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{timerIsPaused ? "RESUME" : "PAUSE"}</span>
            </SkeuoButton>

            <SkeuoButton
              onClick={skipInterval}
              variant="warning"
              size="sm"
              className="py-2 text-xs"
              disabled={timerCurrentIndex + 1 >= timerIntervals.length}
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>SKIP</span>
            </SkeuoButton>

            <SkeuoButton
              onClick={resetSession}
              variant="danger"
              size="sm"
              className="py-2 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET</span>
            </SkeuoButton>
          </div>
        </div>
      )}
    </div>
  );
}
