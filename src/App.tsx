import React, { useState, useEffect } from "react";
import { doc, setDoc, getDoc, onSnapshot, getDocFromServer } from "firebase/firestore";
import { db, auth } from "./lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { Task, UserSession, AIReport } from "./types";
import { PRIYA_SAMPLE_STATE, DEFAULT_AI_REPORT_SEED } from "./initialState";
import SkeuoButton from "./components/SkeuoButton";
import RetroLcd from "./components/RetroLcd";
import NotebookPaper from "./components/NotebookPaper";
import FocusTimer from "./components/FocusTimer";
import NotesManager from "./components/NotesManager";

// Cookie Helper Functions for Auto-Login Persistence
const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

const setCookie = (name: string, value: string, days: number) => {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = "; expires=" + date.toUTCString();
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
};

const eraseCookie = (name: string) => {
  document.cookie = name + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax";
};
import {
  Calendar,
  Check,
  Plus,
  Trash2,
  Clock,
  Zap,
  RefreshCw,
  Sliders,
  Database,
  HelpCircle,
  Activity,
  Sparkles,
  Smartphone,
  Laptop,
  AlertOctagon,
  Award,
  ChevronRight,
  Smile,
  Send,
  X,
  Mic,
  MicOff,
  Volume2,
  Shuffle,
  Mail,
  AlertTriangle,
  UserCheck,
  ZapOff,
  Search,
  Filter,
  Bell,
  BellOff,
  ListTodo,
  Timer,
  Notebook
} from "lucide-react";

export default function App() {
  // Firebase Auth states
  const [user, setUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authActionLoading, setAuthActionLoading] = useState(false);

  // Current active pocket device sync code. Defaults to Priya's sample.
  const [pocketId, setPocketId] = useState<string>(() => {
    return localStorage.getItem("pocketId") || "PRIYA-POCKET";
  });
  
  // Local state mirrored with Firestore sync
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<"CONNECTED" | "SYNCING" | "OFFLINE" | "ERROR">("CONNECTED");
  
  // UI Tabs: 0 = PLANNER, 1 = CHIEF-OF-STAFF, 2 = DEVICE SYNC
  const [activeTab, setActiveTab] = useState<number>(0);
  
  // Planner Sub-tabs for better non-scrolling UI
  const [plannerSubTab, setPlannerSubTab] = useState<"tasks" | "timer" | "agenda" | "notes">("tasks");
  
  // Local task creation states
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("today 6pm");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [newTaskCategory, setNewTaskCategory] = useState("Coding");
  const [newTaskEstimate, setNewTaskEstimate] = useState("2");
  
  // Calendar creation states
  const [newCalEvent, setNewCalEvent] = useState("");
  
  // Natural Language & Voice Capture states
  const [rawNlpInput, setRawNlpInput] = useState("");
  const [nlpLoading, setNlpLoading] = useState(false);
  const [nlpResult, setNlpResult] = useState<any | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  
  // AI Question answer state
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [recentBleep, setRecentBleep] = useState(false);

  // Sync Input state
  const [syncInputId, setSyncInputId] = useState("");

  // ==================== TASK SEARCH & FILTER STATES ====================
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>("all");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>("all");

  // ==================== DESKTOP BROWSER NOTIFICATIONS STATES ====================
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem("deadlineai_notifications_enabled") === "true";
  });
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default";
  });

  const notifiedTasksRef = React.useRef<Set<string>>(new Set());

  const parseTimeToMinutes = (timeStr: string): number | null => {
    if (!timeStr) return null;
    const str = timeStr.toLowerCase().trim();
    const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/;
    const match = str.match(timeRegex);
    if (!match) return null;
    
    let hours = parseInt(match[1], 10);
    let minutes = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3];
    
    if (ampm) {
      if (ampm === "pm" && hours < 12) {
        hours += 12;
      } else if (ampm === "am" && hours === 12) {
        hours = 0;
      }
    }
    
    return hours * 60 + minutes;
  };

  const getRealMinutes = (): number => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  };

  const handleToggleNotifications = async () => {
    triggerBleep();
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notifications.");
      return;
    }

    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      localStorage.setItem("deadlineai_notifications_enabled", "false");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    
    if (permission === "granted") {
      setNotificationsEnabled(true);
      localStorage.setItem("deadlineai_notifications_enabled", "true");
      new Notification("🔔 DeadlineAI Notifications Active!", {
        body: "You will be alerted of upcoming deadlines within 1 hour.",
        icon: "/assets/logo.png"
      });
    } else {
      alert("Notification permission denied. Please enable notifications in your browser settings to receive alerts.");
    }
  };

  // Browser notifications monitoring effect
  React.useEffect(() => {
    if (!notificationsEnabled || !session || !session.tasks) return;

    const tasks = session.tasks;
    const refClockStr = session.currentTime || "10:00 AM";
    const refMinutes = parseTimeToMinutes(refClockStr);
    const realMinutes = getRealMinutes();

    tasks.forEach((task) => {
      if (task.completed) return;

      const taskMinutes = parseTimeToMinutes(task.due);
      if (taskMinutes === null) return;

      // Simulated clock diff
      let diffRef = taskMinutes - (refMinutes ?? 0);
      if (diffRef < -1200) diffRef += 1440;

      // Real clock diff
      let diffReal = taskMinutes - realMinutes;
      if (diffReal < -1200) diffReal += 1440;

      const isApproachingRef = refMinutes !== null && diffRef > 0 && diffRef <= 60;
      const isApproachingReal = diffReal > 0 && diffReal <= 60;

      if (isApproachingRef || isApproachingReal) {
        const notificationKey = `${task.id}-${refClockStr}-${new Date().getHours()}`;
        if (!notifiedTasksRef.current.has(notificationKey)) {
          notifiedTasksRef.current.add(notificationKey);

          const isHighPriority = task.priority === "high";
          const title = isHighPriority 
            ? `🚨 CRITICAL DEADLINE: ${task.title.toUpperCase()}`
            : `🔔 Upcoming Deadline: ${task.title}`;
          
          const body = isHighPriority
            ? `CRITICAL (High Priority): This high priority task is due in ${Math.round(isApproachingRef ? diffRef : diffReal)} minutes (${task.due})! Gear up immediately.`
            : `Task "${task.title}" is due in ${Math.round(isApproachingRef ? diffRef : diffReal)} minutes (${task.due}).`;

          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, {
              body,
              requireInteraction: isHighPriority,
              icon: "/assets/logo.png"
            });
            triggerBleep();
          }
        }
      }
    });
  }, [session?.tasks, session?.currentTime, notificationsEnabled]);

  // Sound/Visual feedback flash helper
  const triggerBleep = () => {
    setRecentBleep(true);
    setTimeout(() => setRecentBleep(false), 200);
  };

  // ==================== POMODORO FOCUS TIMER PERSISTENT STATES ====================
  const [timerIsRunning, setTimerIsRunning] = useState(false);
  const [timerIsPaused, setTimerIsPaused] = useState(false);
  const [timerIntervals, setTimerIntervals] = useState<any[]>([]);
  const [timerCurrentIndex, setTimerCurrentIndex] = useState(0);
  const [timerSecondsRemaining, setTimerSecondsRemaining] = useState(0);
  const [timerSelectedTaskId, setTimerSelectedTaskId] = useState("");
  const [timerFocusHours, setTimerFocusHours] = useState(2); // Default 2 hours
  const [timerNumBreaks, setTimerNumBreaks] = useState(2); // Default 2 breaks
  const [timerBreakMinutes, setTimerBreakMinutes] = useState(5); // Default 5 mins break

  // Audio synthesis helper
  const playTimerBeep = (type: 'start' | 'pause' | 'switch' | 'complete') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === 'start') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'pause') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'switch') {
        const playChirp = (delay: number, freq: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
          gain.gain.setValueAtTime(0.1, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.08);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.08);
        };
        playChirp(0, 600);
        playChirp(0.1, 800);
      } else if (type === 'complete') {
        const playTone = (delay: number, freq: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
          gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + duration);
        };
        playTone(0, 523.25, 0.1);
        playTone(0.1, 659.25, 0.1);
        playTone(0.2, 783.99, 0.1);
        playTone(0.3, 1046.50, 0.25);
      }
    } catch (e) {
      console.warn("Audio Context failed to initialize:", e);
    }
  };

  const advanceTimer = () => {
    if (timerCurrentIndex + 1 < timerIntervals.length) {
      const nextIdx = timerCurrentIndex + 1;
      setTimerCurrentIndex(nextIdx);
      setTimerSecondsRemaining(timerIntervals[nextIdx].durationSec);
      playTimerBeep('switch');
    } else {
      setTimerIsRunning(false);
      setTimerIsPaused(false);
      playTimerBeep('complete');
      
      // Auto-update task progress by +30% when whole cycle is complete!
      if (timerSelectedTaskId && session) {
        const targetTask = session.tasks.find(t => t.id === timerSelectedTaskId);
        if (targetTask) {
          const currentProgress = targetTask.progress;
          const nextProgress = Math.min(100, currentProgress + 30);
          handleUpdateProgress(timerSelectedTaskId, nextProgress);
        }
      }
    }
  };

  // Timer runner effect with safe asynchronous updates
  useEffect(() => {
    let intervalId: any = null;
    if (timerIsRunning && !timerIsPaused) {
      intervalId = setInterval(() => {
        setTimerSecondsRemaining((prev) => {
          if (prev <= 1) {
            setTimeout(() => {
              advanceTimer();
            }, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [timerIsRunning, timerIsPaused, timerCurrentIndex, timerIntervals, timerSelectedTaskId, session]);

  // Keep local storage cache up-to-date with current session state
  useEffect(() => {
    if (session && pocketId) {
      localStorage.setItem(`session_${pocketId}`, JSON.stringify(session));
    }
  }, [session, pocketId]);

  // Listen for Firebase Auth state changes & sync cookies for auto-login
  useEffect(() => {
    const isSessionCookieActive = getCookie("deadlineai_auth_status") === "authenticated";
    
    // If cookie is NOT present at all, immediately bypass wait and direct to login screen
    if (!isSessionCookieActive) {
      setAuthLoading(false);
      setUser(null);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setCookie("deadlineai_auth_status", "authenticated", 7);
        setCookie("deadlineai_user_email", firebaseUser.email || "", 7);
        
        // Auto-assign personalized Pocket ID if default is still set
        const userPocketId = `POCKET-${firebaseUser.uid.substring(0, 8).toUpperCase()}`;
        const currentSavedPocket = localStorage.getItem("pocketId");
        if (!currentSavedPocket || currentSavedPocket === "PRIYA-POCKET") {
          setPocketId(userPocketId);
          localStorage.setItem("pocketId", userPocketId);
        }
      } else {
        setUser(null);
        eraseCookie("deadlineai_auth_status");
        eraseCookie("deadlineai_user_email");
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle email/password registration or session sign-in
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setAuthError("Email and password are required.");
      return;
    }
    if (isSignUp && (!fullName.trim() || !dob.trim())) {
      setAuthError("Name and Date of Birth are required for registration.");
      return;
    }
    setAuthActionLoading(true);
    setAuthError("");
    triggerBleep();

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
        const firebaseUser = userCredential.user;
        
        // Set cookies immediately for 7 days
        setCookie("deadlineai_auth_status", "authenticated", 7);
        setCookie("deadlineai_user_email", firebaseUser.email || "", 7);
        
        // Seed default document for new user
        const userPocketId = `POCKET-${firebaseUser.uid.substring(0, 8).toUpperCase()}`;
        setPocketId(userPocketId);
        localStorage.setItem("pocketId", userPocketId);
        
        const seedState: UserSession = {
          userId: userPocketId,
          username: fullName.trim() || firebaseUser.email?.split("@")[0] || "User",
          tasks: [
            { id: "starter-1", title: "Complete setup of DeadlineAI", due: "today 5pm", progress: 50, priority: "high" }
          ],
          calendarToday: ["2:00 PM — Demo DeadlineAI"],
          energyLevel: "medium",
          currentTime: "10:00 AM",
          burnoutStreak: 0,
          dob: dob.trim(),
          updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, "users", userPocketId), seedState);
        setUser(firebaseUser);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
        const firebaseUser = userCredential.user;
        
        // Set cookies immediately for 7 days
        setCookie("deadlineai_auth_status", "authenticated", 7);
        setCookie("deadlineai_user_email", firebaseUser.email || "", 7);
        
        const userPocketId = `POCKET-${firebaseUser.uid.substring(0, 8).toUpperCase()}`;
        setPocketId(userPocketId);
        localStorage.setItem("pocketId", userPocketId);
        setUser(firebaseUser);
      }
    } catch (err: any) {
      console.error("Authentication error:", err);
      let msg = err.message;
      if (err.code === "auth/operation-not-allowed") {
        msg = "Email/Password provider is disabled in Firebase Console. Please turn on 'Email/Password' in your Firebase Authentication settings, or bypass using the Offline Guest Mode button below.";
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        msg = "Incorrect email or password. Please try again.";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "Email is already registered. Try logging in.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password should be at least 6 characters.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      }
      setAuthError(msg);
    } finally {
      setAuthActionLoading(false);
    }
  };

  // Sign out and clear active auth cookies
  const handleSignOut = async () => {
    triggerBleep();
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out error:", err);
    }
    eraseCookie("deadlineai_auth_status");
    eraseCookie("deadlineai_user_email");
    setUser(null);
    setSession(null);
  };

  // Test connection to Firestore on mount as required by integration rules
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, "test", "connection"));
        setSyncStatus("CONNECTED");
      } catch (error) {
        const errMsg = error instanceof Error ? error.message.toLowerCase() : "";
        if (
          !navigator.onLine ||
          errMsg.includes("offline") ||
          errMsg.includes("unavailable") ||
          errMsg.includes("network") ||
          errMsg.includes("failed to get document")
        ) {
          setSyncStatus("OFFLINE");
          console.warn("Firebase offline mode detected. Continuing in offline local-only mode.");
        } else {
          // If permission-denied occurred because rule was being refreshed or other error, fallback safely
          console.warn("Firebase connection status query returned error:", error);
          setSyncStatus("CONNECTED");
        }
      }
    }
    testConnection();
  }, []);

  // Set up the real-time document listener on the current pocketId (authenticated user only)
  useEffect(() => {
    if (!user || !pocketId) return;
    setLoading(true);
    localStorage.setItem("pocketId", pocketId);

    const docRef = doc(db, "users", pocketId);
    
    // Safety fallback timeout: if we don't get any update from Firestore within 4.5 seconds,
    // fallback to local offline mode so the user is never stuck on a loading screen.
    const fallbackTimeout = setTimeout(() => {
      console.warn("Firestore handshake timed out. Falling back to offline cached state.");
      setSyncStatus("OFFLINE");
      
      const cached = localStorage.getItem(`session_${pocketId}`);
      if (cached) {
        try {
          setSession(JSON.parse(cached));
        } catch (e) {
          console.error("Failed to parse cached local-first session:", e);
        }
      } else {
        let seedState: UserSession;
        if (pocketId === "PRIYA-POCKET") {
          seedState = {
            ...PRIYA_SAMPLE_STATE,
            aiReport: DEFAULT_AI_REPORT_SEED,
            updatedAt: new Date().toISOString()
          };
        } else {
          seedState = {
            userId: pocketId,
            username: pocketId.split("-")[0] || "User",
            tasks: [
              { id: "starter-1", title: "Complete setup of DeadlineAI", due: "today 5pm", progress: 50, priority: "high" }
            ],
            calendarToday: ["2:00 PM — Demo DeadlineAI"],
            energyLevel: "medium",
            currentTime: "10:00 AM",
            burnoutStreak: 0,
            updatedAt: new Date().toISOString()
          };
        }
        setSession(seedState);
      }
      setLoading(false);
    }, 4500);

    // Listen in real-time
    const unsubscribe = onSnapshot(
      docRef,
      async (docSnap) => {
        clearTimeout(fallbackTimeout);
        if (docSnap.exists()) {
          setSession(docSnap.data() as UserSession);
          setSyncStatus("CONNECTED");
        } else {
          // Document does not exist in Firestore. Seed it!
          // If it is the default PRIYA-POCKET, seed with Priya's exact initial state and initial AI report
          let seedState: UserSession;
          if (pocketId === "PRIYA-POCKET") {
            seedState = {
              ...PRIYA_SAMPLE_STATE,
              aiReport: DEFAULT_AI_REPORT_SEED,
              updatedAt: new Date().toISOString()
            };
          } else {
            // Seed generic starter session
            seedState = {
              userId: pocketId,
              username: pocketId.split("-")[0] || "User",
              tasks: [
                { id: "starter-1", title: "Complete setup of DeadlineAI", due: "today 5pm", progress: 50, priority: "high" }
              ],
              calendarToday: ["2:00 PM — Demo DeadlineAI"],
              energyLevel: "medium",
              currentTime: "10:00 AM",
              burnoutStreak: 0,
              updatedAt: new Date().toISOString()
            };
          }
          
          try {
            setSyncStatus("SYNCING");
            await setDoc(docRef, seedState);
            setSession(seedState);
            setSyncStatus("CONNECTED");
          } catch (err) {
            console.error("Seeding document error:", err);
            // Fallback to local session setup even if write fails (offline/permission error)
            setSession(seedState);
            setSyncStatus("OFFLINE");
          }
        }
        setLoading(false);
      },
      (error) => {
        clearTimeout(fallbackTimeout);
        console.error("Real-time listener failed, attempting offline local-storage recovery:", error);
        setSyncStatus("OFFLINE");
        
        // Load from local storage cache if available
        const cached = localStorage.getItem(`session_${pocketId}`);
        if (cached) {
          try {
            setSession(JSON.parse(cached));
          } catch (e) {
            console.error("Failed to parse cached local-first session:", e);
          }
        } else {
          // No cached data, seed state purely in local memory
          let seedState: UserSession;
          if (pocketId === "PRIYA-POCKET") {
            seedState = {
              ...PRIYA_SAMPLE_STATE,
              aiReport: DEFAULT_AI_REPORT_SEED,
              updatedAt: new Date().toISOString()
            };
          } else {
            seedState = {
              userId: pocketId,
              username: pocketId.split("-")[0] || "User",
              tasks: [
                { id: "starter-1", title: "Complete setup of DeadlineAI", due: "today 5pm", progress: 50, priority: "high" }
              ],
              calendarToday: ["2:00 PM — Demo DeadlineAI"],
              energyLevel: "medium",
              currentTime: "10:00 AM",
              burnoutStreak: 0,
              updatedAt: new Date().toISOString()
            };
          }
          setSession(seedState);
        }
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(fallbackTimeout);
      unsubscribe();
    };
  }, [user, pocketId]);

  // Push updates to Firestore (triggers local state update dynamically through onSnapshot listener)
  const updateSessionInCloud = async (updatedFields: Partial<UserSession>) => {
    if (!pocketId || !session) return;
    
    // Optimistically update local state immediately so UI is 100% responsive and works offline with zero latency
    const updatedSession = {
      ...session,
      ...updatedFields,
      updatedAt: new Date().toISOString()
    };
    setSession(updatedSession);
    triggerBleep();

    try {
      setSyncStatus("SYNCING");
      const docRef = doc(db, "users", pocketId);
      await setDoc(docRef, updatedSession);
      setSyncStatus("CONNECTED");
    } catch (err) {
      console.warn("Failed to update Firestore, updates saved locally in offline mode:", err);
      setSyncStatus("OFFLINE");
    }
  };

  // Perform AI Triage request to the backend Express server
  const triggerAiTriage = async (customAnswer?: string) => {
    if (!session) return;
    setAiLoading(true);
    triggerBleep();
    try {
      // Append custom answer to the request if user replied to the AI's clarifying question
      let payloadPrompt = "";
      if (customAnswer) {
        payloadPrompt = `(Note: The user answered your previous question: "${session.aiReport?.oneQuestion || ""}" with: "${customAnswer}". Please re-triage and re-calculate schedule blocks based on this input.)`;
      }

      const res = await fetch("/api/triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: session.username,
          tasks: session.tasks,
          calendarToday: session.calendarToday,
          energyLevel: session.energyLevel,
          currentTime: session.currentTime,
          burnoutStreak: session.burnoutStreak,
          customInstruction: payloadPrompt
        })
      });

      if (!res.ok) {
        throw new Error("Triage request failed");
      }

      const report: AIReport = await res.json();
      
      // Update session in cloud with the new AI Triage report
      await updateSessionInCloud({
        aiReport: report
      });
      
      setQuestionAnswer(""); // Clear answer input
    } catch (err) {
      console.error("AI Triage failed:", err);
      alert("DeadlineAI failed to contact the command station. Check your network or server logs.");
    } finally {
      setAiLoading(false);
    }
  };

  // Natural Language Command Parsing & Web Speech APIs
  const handleParseNlp = async (text: string) => {
    if (!text.trim()) return;
    setNlpLoading(true);
    triggerBleep();
    try {
      const res = await fetch("/api/parse-nlp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: text })
      });
      if (!res.ok) throw new Error("NLP Parsing failed");
      const data = await res.json();
      setNlpResult(data);
      setRawNlpInput("");
      
      // Try speech synthesis for immediate Jarvis voice feedback
      if ('speechSynthesis' in window && data.parsedSummary) {
        // Cancel ongoing speeches first
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(data.parsedSummary);
        utterance.rate = 1.05;
        utterance.pitch = 0.95; // slightly deeper, techy tone
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error("NLP Parse failed:", err);
      alert("Failed to parse natural language input. Please make sure the backend is active.");
    } finally {
      setNlpLoading(false);
    }
  };

  const startVoiceCapture = () => {
    triggerBleep();
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("Speech Recognition not supported in this browser. Try Chrome, or click SIMULATE!");
      simulateVoiceCapture();
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsRecording(true);
        setVoiceStatus("Listening... Speak your task/command!");
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
        setVoiceStatus(`Mic issue: ${event.error}. Enter text below, or tap SIMULATE.`);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setVoiceStatus(`Captured: "${transcript}"`);
        handleParseNlp(transcript);
      };

      recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition", err);
      setIsRecording(false);
      setVoiceStatus("Failed to access mic.");
    }
  };

  const simulateVoiceCapture = () => {
    const presets = [
      "I have a presentation Friday for my boss and need 3 hours",
      "add task design prototype tomorrow with high priority, estimate 4 hours",
      "need to review database schema on Monday morning, estimate 2 hours",
      "urgent meeting with Dave today at 3pm",
      "write a blog post next monday, take 3 hours"
    ];
    const randomPreset = presets[Math.floor(Math.random() * presets.length)];
    setVoiceStatus(`[SIMULATION] Spoken: "${randomPreset}"`);
    handleParseNlp(randomPreset);
  };

  const handleApplyNlpResult = async () => {
    if (!session || !nlpResult) return;
    triggerBleep();
    
    const newTasks = (nlpResult.tasks || []).map((t: any) => ({
      id: "task-" + Date.now() + Math.random().toString(36).substr(2, 4),
      title: t.title,
      due: t.due,
      progress: 0,
      priority: t.priority || "medium",
      completed: false,
      estimatedEffort: t.estimatedEffort || 1,
      predictedEffort: t.predictedEffort || (t.estimatedEffort ? t.estimatedEffort * 1.5 : 2),
      underestimationRisk: t.underestimationRisk ?? false,
      category: t.category || "General"
    }));

    const updatedTasks = [...session.tasks, ...newTasks];
    const updatedCal = [...session.calendarToday, ...(nlpResult.calendarEvents || [])];

    await updateSessionInCloud({
      tasks: updatedTasks,
      calendarToday: updatedCal
    });

    setNlpResult(null);
    setVoiceStatus("");
  };

  const handleAutoReschedule = async () => {
    if (!session) return;
    setAiLoading(true);
    triggerBleep();
    try {
      const healPrompt = "Instruction: Find all overdue tasks or incomplete schedule blocks. Rearrange them silently into available time gaps after the current reference clock, taking energy and peak focus windows into account.";
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: session.username,
          tasks: session.tasks,
          calendarToday: session.calendarToday,
          energyLevel: session.energyLevel,
          currentTime: session.currentTime,
          burnoutStreak: session.burnoutStreak,
          customInstruction: healPrompt
        })
      });

      if (!res.ok) throw new Error("Auto-reschedule failed");
      const report: AIReport = await res.json();
      await updateSessionInCloud({ aiReport: report });
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  // Task Operations
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !session) return;

    const est = parseFloat(newTaskEstimate) || 1;
    // Simple mock heuristic matching our server: 2x risk factor adjustment for coding/writing
    const isCodeOrWrite = ["coding", "writing", "design", "prep"].some(c => newTaskCategory.toLowerCase().includes(c));
    const predicted = isCodeOrWrite ? est * 2 : est * 1.25;

    const task: Task = {
      id: "task-" + Date.now(),
      title: newTaskTitle.trim(),
      due: newTaskDue,
      progress: 0,
      priority: newTaskPriority,
      completed: false,
      estimatedEffort: est,
      predictedEffort: predicted,
      underestimationRisk: isCodeOrWrite,
      category: newTaskCategory
    };

    const updatedTasks = [...session.tasks, task];
    await updateSessionInCloud({ tasks: updatedTasks });
    setNewTaskTitle("");
    setNewTaskEstimate("2");
  };

  const handleDeleteTask = async (id: string) => {
    if (!session) return;
    const updatedTasks = session.tasks.filter((t) => t.id !== id);
    await updateSessionInCloud({ tasks: updatedTasks });
  };

  const handleToggleCompleted = async (id: string) => {
    if (!session) return;
    const updatedTasks = session.tasks.map((t) => {
      if (t.id === id) {
        return { ...t, completed: !t.completed, progress: t.completed ? 0 : 100 };
      }
      return t;
    });
    await updateSessionInCloud({ tasks: updatedTasks });
  };

  const handleUpdateProgress = async (id: string, newProg: number) => {
    if (!session) return;
    const progress = Math.max(0, Math.min(100, newProg));
    const updatedTasks = session.tasks.map((t) => {
      if (t.id === id) {
        return { ...t, progress, completed: progress === 100 };
      }
      return t;
    });
    await updateSessionInCloud({ tasks: updatedTasks });
  };

  const handleCyclePriority = async (id: string) => {
    if (!session) return;
    const priorities: ("low" | "medium" | "high")[] = ["low", "medium", "high"];
    const updatedTasks = session.tasks.map((t) => {
      if (t.id === id) {
        const nextIdx = (priorities.indexOf(t.priority) + 1) % priorities.length;
        return { ...t, priority: priorities[nextIdx] };
      }
      return t;
    });
    await updateSessionInCloud({ tasks: updatedTasks });
  };

  // Calendar Operations
  const handleAddCalEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCalEvent.trim() || !session) return;
    const updatedCal = [...session.calendarToday, newCalEvent.trim()];
    await updateSessionInCloud({ calendarToday: updatedCal });
    setNewCalEvent("");
  };

  const handleDeleteCalEvent = async (index: number) => {
    if (!session) return;
    const updatedCal = session.calendarToday.filter((_, idx) => idx !== index);
    await updateSessionInCloud({ calendarToday: updatedCal });
  };

  // Quick setup: load specific Pocket Sync ID
  const handleLoadSyncId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncInputId.trim()) return;
    setPocketId(syncInputId.trim().toUpperCase());
    setSyncInputId("");
    triggerBleep();
    setActiveTab(0);
  };

  // Generate random cool pocket code
  const handleGenerateRandomCode = () => {
    const prefixes = ["ALPHA", "DELTA", "OMEGA", "NEXUS", "ROVER", "TITAN", "SOLAR"];
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const code = `${prefixes[Math.floor(Math.random() * prefixes.length)]}-${randomNum}`;
    setPocketId(code);
    triggerBleep();
    setActiveTab(0);
  };

  // Reset current session back to Priya sample values
  const handleFactoryReset = async () => {
    if (!session) return;
    if (confirm("Reset current Pocket Card to Priya's initial state? This overrides existing state.")) {
      await updateSessionInCloud({
        ...PRIYA_SAMPLE_STATE,
        aiReport: DEFAULT_AI_REPORT_SEED
      });
    }
  };

  // Check if Crisis mode is active (any task <6 hours to deadline with <30% progress)
  // Let's analyze current tasks for this.
  const hasCrisisTasks = () => {
    if (!session) return false;
    // Let's look for "today" in due and low progress
    return session.tasks.some((t) => {
      const isDueToday = t.due.toLowerCase().includes("today") || t.due.toLowerCase().includes("hrs") || t.due.toLowerCase().includes("hours");
      return isDueToday && t.progress < 30 && !t.completed;
    });
  };

  const crisisTasks = session ? session.tasks.filter((t) => {
    const isDueToday = t.due.toLowerCase().includes("today") || t.due.toLowerCase().includes("hrs") || t.due.toLowerCase().includes("hours");
    return isDueToday && t.progress < 30 && !t.completed;
  }) : [];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#1c2c1b] flex items-center justify-center p-4">
        <div className="border-4 border-black bg-[#cfcfc4] p-6 rounded-lg shadow-[6px_6px_0px_#000] text-center max-w-sm w-full space-y-4">
          <div className="flex justify-center">
            <RefreshCw className="w-10 h-10 animate-spin text-emerald-800" />
          </div>
          <h3 className="font-mono text-sm font-bold uppercase text-black">
            SYNCHRONIZING POCKET PDA AUTHENTICATION STATE...
          </h3>
          <p className="font-mono text-[11px] text-gray-600 leading-tight">
            Checking cookies & session token validity...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1c2c1b] flex items-center justify-center p-4 sm:p-6 md:p-10 font-mono">
        <div className="w-full max-w-md flex flex-col relative">
          <NotebookPaper title="🔒 SECURE ACCESS PORTAL">
            <div className="space-y-6 pt-2">
              <div className="text-center space-y-2">
                <h2 className="font-sans font-extrabold text-2xl tracking-tight text-gray-900 uppercase">
                  DeadlineAI PDA
                </h2>
                <p className="text-[11px] text-gray-600 leading-tight uppercase font-bold tracking-wide">
                  Offline-First Personal Planning Companion
                </p>
              </div>

              <div className="border-2 border-black bg-[#cfcfc4] p-3 rounded font-mono text-[11px] text-zinc-800 leading-tight">
                <strong>SECURE LOGIN ENFORCED:</strong> Please authenticate using your email and password. Your session will be securely persisted on this device using local cookie cache.
              </div>

              {authError && (
                <div className="border-2 border-red-600 bg-red-50 p-3 rounded text-red-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <span className="font-bold">AUTH FAILURE:</span> {authError}
                  </div>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-600 font-bold block uppercase">
                        Operator Full Name
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Priya Sharma"
                          className="w-full font-mono text-xs border-2 border-black p-2.5 rounded bg-white focus:outline-none focus:bg-yellow-50/20 text-black placeholder-gray-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-600 font-bold block uppercase">
                        Date of Birth (DOB)
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          required
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="w-full font-mono text-xs border-2 border-black p-2.5 rounded bg-white focus:outline-none focus:bg-yellow-50/20 text-black placeholder-gray-400"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-600 font-bold block uppercase">
                    Operator Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. operator@deadline.ai"
                      className="w-full font-mono text-xs border-2 border-black p-2.5 rounded bg-white focus:outline-none focus:bg-yellow-50/20 text-black placeholder-gray-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-600 font-bold block uppercase">
                    Security Passphrase
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full font-mono text-xs border-2 border-black p-2.5 rounded bg-white focus:outline-none focus:bg-yellow-50/20 text-black placeholder-gray-400"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <SkeuoButton
                    type="submit"
                    variant="primary"
                    className="w-full text-black font-bold py-3 text-xs tracking-wider uppercase border-2 border-black rounded shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2"
                    disabled={authActionLoading}
                  >
                    {authActionLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                    <span>{isSignUp ? "REGISTER OPERATOR PROFILE" : "AUTHORIZE DEVICE CONNECTION"}</span>
                  </SkeuoButton>
                </div>
              </form>

              <div className="border-t border-dashed border-gray-400 pt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError("");
                    triggerBleep();
                  }}
                  className="text-xs font-bold text-gray-700 hover:text-black underline cursor-pointer uppercase tracking-wide"
                >
                  {isSignUp
                    ? "Already Registered? Login"
                    : "New User? Sign Up"}
                </button>
              </div>

              <div className="text-[10px] text-gray-500 font-mono leading-relaxed border-t border-gray-300 pt-3">
                <span className="font-bold block text-gray-600 uppercase mb-0.5">📌 Operator Walk-Through:</span>
                If you have not enabled email/password provider yet in your Firebase console, make sure to enable the <strong>Email/Password</strong> provider in your Firebase project Authentication settings.
              </div>
            </div>
          </NotebookPaper>
          
          <div className="text-center mt-3 text-[10px] text-emerald-600/60 font-mono">
            SECURED END-TO-END VIA CLOUD FIRESTORE AUTHENTICATION
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#343d3c] p-2 sm:p-4 md:p-8 flex flex-col items-center justify-start lg:justify-center font-sans antialiased select-none text-black selection:bg-yellow-200">
      
      {/* Pocket PDA / Organizer Shell */}
      <div className="w-full max-w-6xl rounded-2xl border-4 border-black bg-[#4a5554] p-2.5 sm:p-4 md:p-6 skeuo-panel-shadow flex flex-col lg:flex-row gap-6 relative mt-6 lg:mt-0">
        
        {/* Physical Status Indicator / Brand Line */}
        <div className="absolute top-2 left-4 right-4 text-[10px] sm:text-xs font-mono font-bold text-[#b5c2c1] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span className="truncate">DEADLINE_AI // PERSONAL CHIEF-OF-STAFF</span>
          </div>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${recentBleep ? "bg-red-500 blink-fast" : "bg-green-500"}`} />
        </div>

        {/* ==================== LEFT SIDE: LCD PANEL & SYSTEM PANEL ==================== */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 mt-4">
          
          {/* Retro-Nostalgic LCD Monitor screen */}
          <RetroLcd title="System Terminal v1.9">
            <div className="space-y-3 text-xs leading-tight">
              <div className="flex justify-between items-center border-b border-[#2d3e2b] pb-1.5 font-bold gap-2">
                <span className="flex items-center gap-1 flex-shrink-0">
                  <Database className="w-3.5 h-3.5" />
                  POCKET ID:
                </span>
                <span className="bg-[#1b2b1a] text-[#9cb196] px-1 rounded text-[11px] truncate max-w-[120px] sm:max-w-none" title={pocketId}>
                  {pocketId}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="truncate">
                  <span className="text-[#3c503a]">USER:</span>{" "}
                  <span className="font-bold truncate" title={session?.username || ""}>{session?.username || "---"}</span>
                </div>
                <div>
                  <span className="text-[#3c503a]">SYNC:</span>{" "}
                  <span className="font-bold text-emerald-900">{syncStatus}</span>
                </div>
                <div>
                  <span className="text-[#3c503a]">ENERGY:</span>{" "}
                  <span className="font-bold uppercase text-[#1b2b1a]">{session?.energyLevel || "---"}</span>
                </div>
                <div>
                  <span className="text-[#3c503a]">REF CLOCK:</span>{" "}
                  <span className="font-bold text-[#1b2b1a]">{session?.currentTime || "---"}</span>
                </div>
              </div>

              {/* Status Ticker */}
              <div className="bg-[#1e2e1d] text-[#80a476] p-1.5 rounded text-[10px] h-12 overflow-y-auto font-mono scrollbar-none">
                {aiLoading ? (
                  <span className="blink-fast flex items-center gap-1 text-yellow-300">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    TRANSMITTING STATE TO COGNITIVE BASE...
                  </span>
                ) : hasCrisisTasks() ? (
                  <span className="text-red-400 blink-fast font-bold flex items-center gap-1">
                    <AlertOctagon className="w-3 h-3" />
                    CRISIS TRIGGERED: SAVE PLAN ACTIVE
                  </span>
                ) : (
                  <span>ALL SYSTEMS OPERATIONAL. DYNAMIC TIME-BLOCKING SYNCED IN CLOUD.</span>
                )}
              </div>
            </div>
          </RetroLcd>

          {/* SKEUOMORPHIC CONTROLS: Plastic dials and sliders */}
          <div className="border-4 border-black bg-[#cfcfc4] p-4 rounded-lg shadow-[4px_4px_0px_#000] flex flex-col gap-4">
            <div className="font-mono text-xs font-bold text-gray-700 flex items-center gap-1 border-b border-gray-400 pb-1">
              <Sliders className="w-3.5 h-3.5" />
              <span>POCKET COMPANION CALIBRATOR</span>
            </div>

            {/* 1. ENERGY SELECTOR (Clicky toggle buttons) */}
            <div className="space-y-1">
              <span className="font-mono text-[11px] font-bold text-gray-600 block">
                CURRENT USER ENERGY:
              </span>
              <div className="grid grid-cols-3 gap-1">
                {(["low", "medium", "high"] as const).map((level) => (
                  <SkeuoButton
                    key={level}
                    size="sm"
                    variant={session?.energyLevel === level ? "warning" : "secondary"}
                    selected={session?.energyLevel === level}
                    onClick={() => {
                      if (session) updateSessionInCloud({ energyLevel: level });
                    }}
                  >
                    {level === "low" && <Smile className="w-3 h-3 mr-0.5" />}
                    {level === "medium" && <Zap className="w-3 h-3 mr-0.5" />}
                    {level === "high" && <Sparkles className="w-3 h-3 mr-0.5" />}
                    {level}
                  </SkeuoButton>
                ))}
              </div>
            </div>

            {/* 2. CLOCK TUNER */}
            <div className="space-y-1">
              <span className="font-mono text-[11px] font-bold text-gray-600 block">
                REFERENCE WALL CLOCK:
              </span>
              <div className="grid grid-cols-3 gap-1">
                {["08:00 AM", "10:00 AM", "02:00 PM"].map((t) => (
                  <SkeuoButton
                    key={t}
                    size="sm"
                    variant={session?.currentTime === t ? "primary" : "secondary"}
                    selected={session?.currentTime === t}
                    onClick={() => {
                      if (session) updateSessionInCloud({ currentTime: t });
                    }}
                  >
                    <Clock className="w-3 h-3 mr-0.5" />
                    {t.split(" ")[0]}
                  </SkeuoButton>
                ))}
              </div>
            </div>

            {/* 3. BURNOUT STREAK DIAL */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-mono text-[11px] font-bold text-gray-600">
                  MISSED DAYS STREAK:
                </span>
                <span className="font-mono text-xs font-bold bg-black text-yellow-400 px-1.5 rounded">
                  {session?.burnoutStreak || 0}d
                </span>
              </div>
              <div className="flex gap-1.5 items-center justify-between">
                <SkeuoButton
                  size="sm"
                  onClick={() => {
                    if (session) {
                      const current = session.burnoutStreak || 0;
                      updateSessionInCloud({ burnoutStreak: Math.max(0, current - 1) });
                    }
                  }}
                >
                  -1 Day
                </SkeuoButton>
                <SkeuoButton
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (session) {
                      const current = session.burnoutStreak || 0;
                      updateSessionInCloud({ burnoutStreak: current + 1 });
                    }
                  }}
                >
                  +1 Day
                </SkeuoButton>
              </div>
            </div>

            {/* 4. DESKTOP NOTIFICATIONS DIAL */}
            <div className="space-y-1 border-t border-gray-400 pt-3">
              <div className="flex justify-between items-center">
                <span className="font-mono text-[11px] font-bold text-gray-600 uppercase">
                  DESKTOP ALERTS:
                </span>
                <span className={`font-mono text-[10px] font-bold px-1.5 rounded ${
                  notificationsEnabled 
                    ? "bg-emerald-200 text-emerald-900 border border-emerald-500 animate-pulse" 
                    : "bg-zinc-300 text-zinc-700"
                }`}>
                  {notificationsEnabled ? "ACTIVE" : "OFF"}
                </span>
              </div>
              <SkeuoButton
                size="sm"
                variant={notificationsEnabled ? "success" : "secondary"}
                className="w-full flex items-center justify-center gap-1.5"
                onClick={handleToggleNotifications}
              >
                {notificationsEnabled ? (
                  <>
                    <Bell className="w-3.5 h-3.5 text-emerald-800 animate-bounce" />
                    <span>ALERTS ENABLED</span>
                  </>
                ) : (
                  <>
                    <BellOff className="w-3.5 h-3.5 text-zinc-600" />
                    <span>ENABLE ALERTS</span>
                  </>
                )}
              </SkeuoButton>
              <div className="text-[9px] font-mono text-gray-500 leading-tight">
                Pushes browser alerts for high-priority or upcoming tasks due within 1 hour (syncs with real-world & clock tuner).
              </div>
            </div>

            {/* 5. MAIN ACTION TRANSMIT TO AI BUTTON */}
            <SkeuoButton
              variant="primary"
              className="w-full mt-2 font-bold flex items-center justify-center gap-1 text-black py-3 border-2 border-black rounded shadow-[4px_4px_0px_#000]"
              onClick={() => triggerAiTriage()}
              disabled={aiLoading || !session}
            >
              <Sparkles className="w-4.5 h-4.5 animate-pulse text-red-700" />
              <span>RE-TRIAGE WITH AI</span>
            </SkeuoButton>
          </div>

          {/* CRISIS FLOOD warning light */}
          {hasCrisisTasks() && (
            <div className="border-4 border-red-800 bg-[#3d1a1a] p-3 rounded-lg flex items-center gap-2 blink-fast border-double">
              <div className="w-4 h-4 rounded-full bg-red-600 animate-ping shadow-[0_0_8px_red]" />
              <div className="font-mono text-xs font-bold text-red-200">
                ⚠️ [CRISIS WARNING ACTIVE] <br />
                TASK &lt;6H TO DUE &lt;30% PROGRESS
              </div>
            </div>
          )}

          {/* Quick factory reset & Logout panel */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center px-1 text-[11px] font-mono text-gray-400 mt-3 gap-2 border-t border-white/5 pt-2">
            <div className="flex items-center gap-2">
              <span>DEVICE ID: DL-816677</span>
              <span className="text-gray-600">|</span>
              <span className="text-[#8da387] uppercase truncate max-w-[150px]" title={user?.email || ""}>
                👤 {user?.email?.split("@")[0]}
              </span>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleFactoryReset}
                className="underline hover:text-white cursor-pointer active:text-red-300"
              >
                Reset State
              </button>
              <span className="text-gray-600">|</span>
              <button 
                onClick={handleSignOut}
                className="underline hover:text-red-400 text-red-300 font-bold cursor-pointer"
              >
                LOGOUT
              </button>
            </div>
          </div>
        </div>


        {/* ==================== RIGHT SIDE: THE BINDER NOTEBOOK ==================== */}
        <div className="flex-1 flex flex-col relative min-h-[550px] mt-6 lg:mt-0">
          
          {/* Mobile Binder Tabs (Horizontal at the top) */}
          <div className="flex lg:hidden flex-row gap-1 w-full justify-start relative z-20 -mb-1 px-1 overflow-x-auto scrollbar-none pb-1">
            {[
              { id: 0, label: "PLANNER", color: "bg-[#e5c543]" },
              { id: 1, label: "JARVIS AI", color: "bg-[#cfcfc4]" },
              { id: 2, label: "SYNC STATION", color: "bg-[#8da387]" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  triggerBleep();
                }}
                className={`px-3 py-1.5 border-2 border-black rounded-t-lg flex items-center justify-center ${tab.color} text-black font-mono font-bold text-[10px] sm:text-[11px] cursor-pointer shadow-[1px_1px_0px_rgba(0,0,0,0.5)] transition-all hover:translate-y-[-1px] uppercase select-none ${
                  activeTab === tab.id ? "translate-y-[-1px] border-b-0 pb-2.5 z-20" : "opacity-80 translate-y-0"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Desktop Binder Tabs (Vertical hanging on the right) */}
          <div className="hidden lg:flex absolute right-[-44px] top-10 flex-col gap-2 z-0">
            {[
              { id: 0, label: "PLANNER", color: "bg-[#e5c543]" },
              { id: 1, label: "JARVIS AI", color: "bg-[#cfcfc4]" },
              { id: 2, label: "SYNC STATION", color: "bg-[#8da387]" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  triggerBleep();
                }}
                className={`w-11 h-24 border-2 border-black rounded-r-md flex items-center justify-center ${tab.color} text-black font-mono font-bold text-[11px] cursor-pointer shadow-[2px_2px_0px_rgba(0,0,0,0.5)] transition-all hover:translate-x-1 writing-vertical uppercase select-none ${
                  activeTab === tab.id ? "translate-x-2 border-l-0 pr-2 z-20" : "opacity-80 translate-x-0"
                }`}
                style={{ writingMode: "vertical-rl" }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* MAIN WINDOW FOR PLANNER NOTEBOOK */}
          <div className="flex-1 z-10">
            {loading ? (
              <NotebookPaper title="LOADING STATE...">
                <div className="h-full flex flex-col items-center justify-center text-center py-20 font-mono text-lg text-gray-500">
                  <RefreshCw className="w-10 h-10 animate-spin text-zinc-500 mb-4" />
                  <span>SYNCHRONIZING POCKET ORGANIZER...</span>
                </div>
              </NotebookPaper>
            ) : !session ? (
              <NotebookPaper title="EMPTY STATE">
                <div className="h-full text-center py-20 font-mono text-lg">
                  <span>No organizer card loaded. Use sync tab to load a device profile.</span>
                </div>
              </NotebookPaper>
            ) : (
              <>
                {/* -------------------- TAB 0: THE PLANNER -------------------- */}
                {activeTab === 0 && (
                  <NotebookPaper title={`${session.username.toUpperCase()}'S DAILY PLANNING POCKET`}>
                    <div className="space-y-6">
                      
                      {/* Activities Sub-Navigation Menu */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-4 mb-2">
                        <span className="font-mono text-[11px] font-bold text-gray-600 uppercase flex items-center gap-1">
                          <Sliders className="w-3.5 h-3.5" />
                          <span>PLANNER WORKSPACES:</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5 font-mono">
                          {[
                            { id: "tasks", label: "Tasks & Capture", icon: ListTodo },
                            { id: "timer", label: "Focus Timer", icon: Timer },
                            { id: "agenda", label: "Daily Agenda", icon: Calendar },
                            { id: "notes", label: "Scribble Notes", icon: Notebook },
                          ].map((sub) => {
                            const isSelected = plannerSubTab === sub.id;
                            const Icon = sub.icon;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  setPlannerSubTab(sub.id as any);
                                  triggerBleep();
                                }}
                                className={`px-3 py-1.5 border-2 border-black rounded font-mono font-bold text-[10px] sm:text-[11px] cursor-pointer shadow-[2px_2px_0px_#000] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000] flex items-center gap-1.5 text-black transition-all ${
                                  isSelected 
                                    ? "bg-amber-400 -translate-y-[1px]" 
                                    : "bg-white hover:bg-zinc-50"
                                }`}
                              >
                                <Icon className={`w-3.5 h-3.5 ${isSelected ? "animate-pulse text-red-600" : "text-zinc-600"}`} />
                                <span>{sub.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* WORKSPACE CONTENT PANELS */}
                      {plannerSubTab === "tasks" && (
                        <div className="space-y-6">
                          {/* Section: Voice & NLP Task Capturer */}
                          <div className="border-4 border-black bg-[#cfcfc4] p-4 rounded-lg shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
                          <h4 className="font-mono text-xs font-bold text-gray-800 uppercase flex items-center gap-1.5">
                            <Mic className="w-4 h-4 text-red-600 animate-pulse" />
                            <span>VOICE & NLP TASK CAPTURE</span>
                          </h4>
                          <span className="font-mono text-[9px] bg-black text-[#8da387] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            SPEECH / NLP ENGINE
                          </span>
                        </div>
                        
                        <p className="font-mono text-[11px] text-gray-600 leading-tight">
                          Dictate tasks or type casual expressions (e.g. <em>"Submit slide draft by tomorrow 5pm"</em>). DeadlineAI automatically extracts deadlines, predicts actual efforts, and flags underestimation risks.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={rawNlpInput}
                            onChange={(e) => setRawNlpInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleParseNlp(rawNlpInput);
                              }
                            }}
                            placeholder="Type raw task notes or click RECORD..."
                            className="font-mono text-xs border-2 border-black p-2 rounded bg-white flex-1 focus:outline-none placeholder-gray-400 text-black min-w-0"
                            disabled={nlpLoading}
                          />
                          
                          <div className="flex gap-2">
                            <SkeuoButton
                              variant={isRecording ? "danger" : "secondary"}
                              size="sm"
                              onClick={startVoiceCapture}
                              disabled={nlpLoading}
                              className={`flex-1 sm:flex-initial ${isRecording ? "animate-pulse text-white" : "text-black"}`}
                            >
                              {isRecording ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-black" />}
                              <span>{isRecording ? "STOP" : "RECORD"}</span>
                            </SkeuoButton>

                            <SkeuoButton
                              variant="lcd"
                              size="sm"
                              onClick={simulateVoiceCapture}
                              disabled={nlpLoading}
                              className="flex-1 sm:flex-initial"
                            >
                              <Shuffle className="w-3 h-3" />
                              <span>SIMULATE</span>
                            </SkeuoButton>
                          </div>
                        </div>

                        {voiceStatus && (
                          <div className="font-mono text-[10px] text-zinc-700 bg-zinc-200/60 px-2 py-1 rounded flex items-center gap-1.5">
                            <Volume2 className="w-3.5 h-3.5 text-zinc-600 animate-bounce" />
                            <span className="truncate">{voiceStatus}</span>
                          </div>
                        )}

                        {/* Staged NLP Result Preview to let user inspect and approve */}
                        {nlpLoading && (
                          <div className="py-2 flex items-center justify-center gap-2 font-mono text-xs text-zinc-700">
                            <RefreshCw className="w-4 h-4 animate-spin text-red-600" />
                            <span>AI ANALYZING COMMAND & PREDICTING DEADLINE RISKS...</span>
                          </div>
                        )}

                        {nlpResult && (
                          <div className="border-2 border-black bg-[#fffae0] p-3 rounded shadow-[2px_2px_0px_#000] space-y-2.5 text-black">
                            <div className="font-mono text-[10px] font-bold text-gray-700 border-b border-dashed border-gray-400 pb-1 uppercase flex justify-between items-center">
                              <span>🔮 EXTRACTED PREVIEW (ML PIPELINE)</span>
                              <button type="button" onClick={() => setNlpResult(null)} className="text-gray-500 hover:text-black">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            <p className="font-mono text-[11px] text-zinc-800 italic leading-snug">
                              "{nlpResult.parsedSummary}"
                            </p>

                            <div className="space-y-1.5">
                              {nlpResult.tasks && nlpResult.tasks.map((t: any, idx: number) => (
                                <div key={idx} className="bg-white/80 p-2 rounded border border-black/10 flex flex-col gap-1">
                                  <div className="flex justify-between items-start">
                                    <span className="font-handwritten text-base font-bold text-gray-900 leading-none">{t.title}</span>
                                    <span className="font-mono text-[9px] bg-zinc-200 px-1 rounded uppercase font-bold text-zinc-700">{t.category}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-600">
                                    <div>📅 Due: <strong className="text-zinc-800">{t.due}</strong></div>
                                    <div>⚠️ Priority: <strong className="text-zinc-800 uppercase">{t.priority}</strong></div>
                                    <div>⏱️ User Est: <strong className="text-zinc-800">{t.estimatedEffort}h</strong></div>
                                    <div className="flex items-center gap-0.5">
                                      🤖 AI Predicts: 
                                      <strong className={`${t.underestimationRisk ? "text-red-700 font-bold" : "text-zinc-800"}`}>
                                        {t.predictedEffort}h
                                      </strong>
                                      {t.underestimationRisk && <AlertTriangle className="w-3 h-3 text-red-600 animate-bounce" />}
                                    </div>
                                  </div>
                                  {t.underestimationRisk && (
                                    <div className="text-[9px] font-mono text-red-800 bg-red-50 p-1 rounded border border-red-200">
                                      ⚠️ <strong>Underestimation Risk:</strong> Based on behavior templates, you always underestimate {t.category} tasks. Effort adjusted by ~2x.
                                    </div>
                                  )}
                                </div>
                              ))}

                              {nlpResult.calendarEvents && nlpResult.calendarEvents.map((evt: string, idx: number) => (
                                <div key={idx} className="bg-blue-50/80 p-1.5 rounded border border-blue-200 flex items-center gap-1.5 font-mono text-[10px] text-blue-900">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>Calendar Sync: {evt}</span>
                                </div>
                              ))}
                            </div>

                            <SkeuoButton
                              variant="success"
                              size="sm"
                              onClick={handleApplyNlpResult}
                              className="w-full text-xs text-white"
                            >
                              <Check className="w-4 h-4" />
                              <span>PLUG DIRECTLY INTO POCKET BOARD</span>
                            </SkeuoButton>
                          </div>
                        )}
                      </div>

                      {/* Section: Lined Task List */}
                      <div>
                        <div className="font-mono text-xs font-bold text-gray-600 border-b border-gray-400 pb-1.5 mb-2 uppercase tracking-wide flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                          <span>📝 POCKET TO-DO CHECKLIST ({session.tasks.length} ACTIVE)</span>
                          <span className="text-[10px] text-gray-500 font-medium">TAP PRIORITY TO CYCLE / SLIDER TO UPDATE</span>
                        </div>
                        
                        {/* Search & Filter Station */}
                        {(() => {
                          const tasksList = session.tasks || [];
                          const uniqueCategories = Array.from(new Set(tasksList.map(t => t.category?.trim() || "General"))).filter(Boolean);
                          const filteredTasks = tasksList.filter((task) => {
                            const matchesSearch = 
                              task.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
                              (task.category && task.category.toLowerCase().includes(taskSearchQuery.toLowerCase()));

                            const matchesPriority = taskPriorityFilter === "all" || task.priority === taskPriorityFilter;

                            const matchesCategory = taskCategoryFilter === "all" || 
                              (task.category || "General").toLowerCase() === taskCategoryFilter.toLowerCase();

                            return matchesSearch && matchesPriority && matchesCategory;
                          });

                          return (
                            <>
                              <div className="bg-[#fcfbeb] border-2 border-black p-3 rounded-lg mb-4 shadow-[2px_2px_0px_#000] space-y-3">
                                {/* Search Input */}
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                  <input
                                    type="text"
                                    value={taskSearchQuery}
                                    onChange={(e) => {
                                      setTaskSearchQuery(e.target.value);
                                      triggerBleep();
                                    }}
                                    placeholder="Search tasks by title or category..."
                                    className="w-full pl-9 pr-8 py-1.5 font-mono text-xs border-2 border-black bg-white rounded focus:outline-none placeholder-zinc-400 focus:bg-amber-50/20"
                                  />
                                  {taskSearchQuery && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTaskSearchQuery("");
                                        triggerBleep();
                                      }}
                                      className="absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-xs text-zinc-400 hover:text-black cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Priority Filter Chips */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-1 font-mono text-[9px] font-bold text-zinc-600 uppercase">
                                      <Filter className="w-3 h-3" />
                                      <span>FILTER BY PRIORITY:</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {["all", "high", "medium", "low"].map((prio) => {
                                        const isSelected = taskPriorityFilter === prio;
                                        const colorClasses = 
                                          prio === "high" 
                                            ? (isSelected ? "bg-red-600 text-white animate-pulse" : "bg-red-50 text-red-800 hover:bg-red-100")
                                            : prio === "medium"
                                            ? (isSelected ? "bg-amber-500 text-black font-bold" : "bg-amber-50 text-amber-800 hover:bg-amber-100")
                                            : prio === "low"
                                            ? (isSelected ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-800 hover:bg-blue-100")
                                            : (isSelected ? "bg-black text-[#e5c543]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200");

                                        return (
                                          <button
                                            key={prio}
                                            type="button"
                                            onClick={() => {
                                              setTaskPriorityFilter(prio);
                                              triggerBleep();
                                            }}
                                            className={`font-mono text-[10px] font-bold px-2.5 py-1 border border-black rounded uppercase transition-all shadow-[1px_1px_0px_rgba(0,0,0,1)] hover:translate-y-[-0.5px] cursor-pointer ${colorClasses}`}
                                          >
                                            {prio === "high" ? "🔴 " : prio === "medium" ? "🟡 " : prio === "low" ? "🔵 " : "⚪ "}
                                            {prio}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Category Filter Chips */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-1 font-mono text-[9px] font-bold text-zinc-600 uppercase">
                                      <Sliders className="w-3 h-3" />
                                      <span>FILTER BY CATEGORY:</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 max-h-[60px] overflow-y-auto pr-1">
                                      {["all", ...uniqueCategories].map((cat) => {
                                        const isSelected = taskCategoryFilter.toLowerCase() === cat.toLowerCase();
                                        const colorClasses = isSelected 
                                          ? "bg-black text-[#e5c543]" 
                                          : "bg-white text-zinc-700 hover:bg-zinc-100";

                                        return (
                                          <button
                                            key={cat}
                                            type="button"
                                            onClick={() => {
                                              setTaskCategoryFilter(cat);
                                              triggerBleep();
                                            }}
                                            className={`font-mono text-[9px] font-bold px-2.5 py-0.5 border border-black rounded uppercase transition-all shadow-[1px_1px_0px_rgba(0,0,0,1)] hover:translate-y-[-0.5px] cursor-pointer ${colorClasses}`}
                                          >
                                            {cat}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                {filteredTasks.map((task) => {
                                  const isCrisis = task.due.toLowerCase().includes("today") && task.progress < 30 && !task.completed;
                                  const hasRisk = task.underestimationRisk;
                                  return (
                                    <div
                                      key={task.id}
                                      className={`flex flex-col border-b border-dashed border-gray-300 pb-3 gap-2 ${
                                        task.completed ? "opacity-65 line-through decoration-black decoration-2" : ""
                                      }`}
                                    >
                                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                                        {/* Left Side: Checkbox + Title */}
                                        <div className="flex items-start gap-3 flex-1">
                                          {/* Custom Tactile Checkbox */}
                                          <button
                                            onClick={() => handleToggleCompleted(task.id)}
                                            className="w-6 h-6 border-2 border-black bg-white rounded flex items-center justify-center font-mono font-bold cursor-pointer hover:bg-yellow-50 select-none flex-shrink-0"
                                          >
                                            {task.completed ? (
                                              <span className="text-red-700 text-lg font-bold">X</span>
                                            ) : (
                                              ""
                                            )}
                                          </button>
                                          
                                          <div className="flex flex-col leading-tight">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className={`font-handwritten text-lg font-bold ${isCrisis ? "text-red-700" : "text-gray-800"}`}>
                                                {task.title}
                                              </span>
                                              {task.category && (
                                                <span className="font-mono text-[9px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded uppercase font-bold border border-gray-300">
                                                  {task.category}
                                                </span>
                                              )}
                                              {hasRisk && (
                                                <span className="font-mono text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-300 flex items-center gap-0.5">
                                                  <AlertTriangle className="w-3 h-3 text-red-600 animate-bounce" />
                                                  UNDERESTIMATION RISK
                                                </span>
                                              )}
                                            </div>
                                            <span className="font-mono text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                              <Clock className="w-3 h-3 text-amber-600" />
                                              DUE: {task.due}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Right Side: Controls (Priority & Slider) */}
                                        <div className="flex items-center gap-3 justify-start pl-9 md:justify-end md:pl-0 flex-wrap w-full md:w-auto">
                                          {/* Tactile priority cycling */}
                                          <button
                                            onClick={() => handleCyclePriority(task.id)}
                                            className={`font-mono text-[10px] font-bold px-2 py-0.5 border border-black rounded uppercase select-none cursor-pointer ${
                                              task.priority === "high"
                                                ? "bg-red-200 text-red-800"
                                                : task.priority === "medium"
                                                ? "bg-yellow-100 text-yellow-800"
                                                : "bg-blue-100 text-blue-800"
                                            }`}
                                          >
                                            {task.priority}
                                          </button>

                                          {/* Progress bar controller */}
                                          <div className="flex items-center gap-1">
                                            <span className="font-mono text-xs w-8 text-right font-bold">
                                              {task.progress}%
                                            </span>
                                            <input
                                              type="range"
                                              min="0"
                                              max="100"
                                              step="10"
                                              value={task.progress}
                                              onChange={(e) => handleUpdateProgress(task.id, parseInt(e.target.value))}
                                              className="w-16 accent-black cursor-pointer h-2 bg-yellow-100 border border-black rounded-lg"
                                            />
                                          </div>

                                          {/* Delete */}
                                          <button
                                            onClick={() => handleDeleteTask(task.id)}
                                            className="p-1 text-gray-500 hover:text-red-600 cursor-pointer active:scale-90"
                                            title="Tear Out Task"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Underestimation details */}
                                      {task.estimatedEffort !== undefined && (
                                        <div className="pl-9 flex items-center gap-3 font-mono text-[10px] text-gray-600 mt-[-2px] flex-wrap">
                                          <span>User Effort Estimate: <strong>{task.estimatedEffort}h</strong></span>
                                          <ChevronRight className="w-3 h-3 text-gray-400" />
                                          <span>AI Predicted Actual: <strong className={hasRisk ? "text-red-700 font-bold" : "text-gray-700"}>{task.predictedEffort}h</strong></span>
                                          {hasRisk && (
                                            <span className="text-red-700/80 italic">(Learned from history: coding task scaled by 2x)</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {filteredTasks.length === 0 && (
                                  <div className="text-center py-6 text-gray-400 font-mono text-xs italic">
                                    {tasksList.length === 0 
                                      ? "NO TASKS ENROLLED. USE POST-IT FORM BELOW TO SCRATCH ONE IN." 
                                      : "NO TASKS MATCH THE APPLIED SEARCH AND FILTER CRITERIA."
                                    }
                                  </div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Add Task Post-it Note Form */}
                      <form onSubmit={handleAddTask} className="border-2 border-black bg-[#fffae0] p-4 rounded shadow-[3px_3px_0px_rgba(0,0,0,1)] relative rotate-[-0.5deg]">
                        <div className="absolute top-1 right-2 flex gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-black" />
                        </div>
                        <div className="font-mono text-xs font-bold text-gray-700 mb-2 border-b border-dashed border-gray-400 pb-1 flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5" />
                          <span>SCRATCH A NEW TASK</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="md:col-span-4 flex flex-col">
                            <label className="font-mono text-[10px] text-gray-600 font-bold">TASK TITLE</label>
                            <input
                              type="text"
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                              placeholder="Submit project report..."
                              className="font-handwritten text-base border-b-2 border-black focus:outline-none bg-transparent placeholder-gray-400 text-black"
                            />
                          </div>
                          <div className="md:col-span-2 flex flex-col">
                            <label className="font-mono text-[10px] text-gray-600 font-bold">DUE STATEMENT</label>
                            <input
                              type="text"
                              value={newTaskDue}
                              onChange={(e) => setNewTaskDue(e.target.value)}
                              placeholder="today 6pm..."
                              className="font-handwritten text-base border-b-2 border-black focus:outline-none bg-transparent text-black"
                            />
                          </div>
                          <div className="md:col-span-2 flex flex-col">
                            <label className="font-mono text-[10px] text-gray-600 font-bold">CATEGORY</label>
                            <select
                              value={newTaskCategory}
                              onChange={(e) => setNewTaskCategory(e.target.value)}
                              className="font-mono text-xs bg-transparent border-b-2 border-black focus:outline-none py-1 cursor-pointer font-bold text-black"
                            >
                              <option value="Coding">CODING</option>
                              <option value="Writing">WRITING</option>
                              <option value="Admin">ADMIN</option>
                              <option value="Design">DESIGN</option>
                              <option value="Personal">PERSONAL</option>
                            </select>
                          </div>
                          <div className="md:col-span-1 flex flex-col">
                            <label className="font-mono text-[10px] text-gray-600 font-bold">EST. HOURS</label>
                            <select
                              value={newTaskEstimate}
                              onChange={(e) => setNewTaskEstimate(e.target.value)}
                              className="font-mono text-xs bg-transparent border-b-2 border-black focus:outline-none py-1 cursor-pointer font-bold text-black"
                            >
                              <option value="1">1h</option>
                              <option value="2">2h</option>
                              <option value="3">3h</option>
                              <option value="4">4h</option>
                              <option value="5">5h</option>
                              <option value="6">6h</option>
                              <option value="8">8h</option>
                            </select>
                          </div>
                          <div className="md:col-span-2 flex flex-col">
                            <label className="font-mono text-[10px] text-gray-600 font-bold">PRIORITY</label>
                            <select
                              value={newTaskPriority}
                              onChange={(e) => setNewTaskPriority(e.target.value as "low" | "medium" | "high")}
                              className="font-mono text-xs bg-transparent border-b-2 border-black focus:outline-none py-1 cursor-pointer font-bold text-black"
                            >
                              <option value="low">LOW</option>
                              <option value="medium">MEDIUM</option>
                              <option value="high">HIGH</option>
                            </select>
                          </div>
                          <div className="md:col-span-1 flex items-end">
                            <SkeuoButton type="submit" variant="primary" size="sm" className="w-full text-black">
                              ADD
                            </SkeuoButton>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}

                      {/* Section: Pomodoro Focus Timer */}
                      {plannerSubTab === "timer" && (
                        <FocusTimer
                          tasks={session.tasks}
                          timerIsRunning={timerIsRunning}
                          timerIsPaused={timerIsPaused}
                          timerIntervals={timerIntervals}
                          timerCurrentIndex={timerCurrentIndex}
                          timerSecondsRemaining={timerSecondsRemaining}
                          timerSelectedTaskId={timerSelectedTaskId}
                          timerFocusHours={timerFocusHours}
                          timerNumBreaks={timerNumBreaks}
                          timerBreakMinutes={timerBreakMinutes}
                          setTimerIsRunning={setTimerIsRunning}
                          setTimerIsPaused={setTimerIsPaused}
                          setTimerIntervals={setTimerIntervals}
                          setTimerCurrentIndex={setTimerCurrentIndex}
                          setTimerSecondsRemaining={setTimerSecondsRemaining}
                          setTimerSelectedTaskId={setTimerSelectedTaskId}
                          setTimerFocusHours={setTimerFocusHours}
                          setTimerNumBreaks={setTimerNumBreaks}
                          setTimerBreakMinutes={setTimerBreakMinutes}
                          handleUpdateProgress={handleUpdateProgress}
                          handleToggleCompleted={handleToggleCompleted}
                          triggerBleep={triggerBleep}
                          playTimerBeep={playTimerBeep}
                          advanceTimer={advanceTimer}
                        />
                      )}

                      {/* Section: Markdown Notes Manager */}
                      {plannerSubTab === "notes" && (
                        <NotesManager
                          session={session}
                          updateSessionInCloud={updateSessionInCloud}
                          triggerBleep={triggerBleep}
                        />
                      )}

                      {/* Section: Calendar Agenda */}
                      {plannerSubTab === "agenda" && (
                        <div className="pt-2">
                          <div className="font-mono text-xs font-bold text-gray-600 border-b border-gray-400 pb-1 mb-2 uppercase tracking-wide flex justify-between">
                            <span>📅 DAILY CALENDAR AGENDA</span>
                            <span className="text-[10px] text-gray-500">AUTO-MERGES INTO TIME-BLOCKS</span>
                          </div>

                          <div className="space-y-2">
                            {session.calendarToday.map((item, index) => (
                              <div key={index} className="flex justify-between items-center bg-[#f3f2e4] border border-black p-2 rounded text-sm font-mono font-medium">
                                <span className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-zinc-600" />
                                  {item}
                                </span>
                                <button
                                  onClick={() => handleDeleteCalEvent(index)}
                                  className="text-gray-400 hover:text-red-600 cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}

                            <form onSubmit={handleAddCalEvent} className="flex gap-2">
                              <input
                                type="text"
                                value={newCalEvent}
                                onChange={(e) => setNewCalEvent(e.target.value)}
                                placeholder="3:00 PM — Team standup (30 min)"
                                className="font-mono text-xs border-2 border-black p-2 rounded bg-[#fbfbf6] flex-1 focus:outline-none"
                              />
                              <SkeuoButton type="submit" variant="secondary" size="sm">
                                PLUG IN
                              </SkeuoButton>
                            </form>
                          </div>
                        </div>
                      )}

                    </div>
                  </NotebookPaper>
                )}

                {/* -------------------- TAB 1: DEADLINE-AI CHIEF-OF-STAFF -------------------- */}
                {activeTab === 1 && (
                  <NotebookPaper title="📅 DEADLINE-AI INTELLIGENT TRIAGE ENGINE">
                    <div className="space-y-6">
                      
                      {/* Jarvis Brief Address */}
                      <div className="border-4 border-black bg-neutral-900 text-yellow-100 p-4 rounded shadow-[4px_4px_0px_#000] relative">
                        <div className="absolute top-2 right-3 font-mono text-[9px] bg-yellow-400 text-black px-1.5 py-0.5 rounded font-bold uppercase tracking-widest animate-pulse">
                          JARVIS COGNITION
                        </div>
                        <h4 className="font-mono text-xs font-bold text-[#e5c543] uppercase mb-1 flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5" />
                          DEADLINE-AI INTELLIGENCE REPORT
                        </h4>
                        <p className="font-mono text-sm leading-relaxed text-gray-200">
                          "{session.aiReport?.chatResponse || "No cognitive analysis run. Calibrate your parameters on the left and hit 'RE-TRIAGE WITH AI' above."}"
                        </p>
                      </div>

                      {/* Structured Output Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* 1. CRITICAL NOW BANNER */}
                        <div className="border-2 border-black bg-[#ffcccc] p-4 rounded-lg shadow-[3px_3px_0px_#000] flex flex-col gap-2">
                          <h5 className="font-mono text-xs font-bold text-red-900 border-b border-red-300 pb-1 uppercase flex items-center gap-1.5">
                            <AlertOctagon className="w-4 h-4 text-red-700" />
                            🔴 CRITICAL NOW
                          </h5>
                          <div className="font-handwritten text-lg font-bold text-red-900 leading-tight">
                            {session.aiReport?.criticalNow.action || "All processes nominal."}
                          </div>
                          <div className="font-mono text-[11px] text-red-800 leading-relaxed bg-[#ffe6e6] p-2 rounded border border-red-300">
                            <strong>WHY:</strong> {session.aiReport?.criticalNow.why || "No active threat vectors found."}
                          </div>
                        </div>

                        {/* 2. RISK ALERT & CRISIS RESCUE PLAN */}
                        <div className={`border-2 border-black p-4 rounded-lg shadow-[3px_3px_0px_#000] flex flex-col gap-2 ${
                          session.aiReport?.riskAlert.active ? "bg-[#ffe3c2]" : "bg-[#e2f0d9]"
                        }`}>
                          <h5 className="font-mono text-xs font-bold border-b pb-1 uppercase flex items-center gap-1.5">
                            <AlertOctagon className={`w-4 h-4 ${session.aiReport?.riskAlert.active ? "text-amber-700" : "text-green-700"}`} />
                            ⚠️ {session.aiReport?.riskAlert.active ? "RISK ALERT IN PROGRESS" : "SYSTEM RISK INVENTORY"}
                          </h5>
                          {session.aiReport?.riskAlert.active ? (
                            <div className="space-y-2">
                              <div className="font-handwritten text-base font-bold text-amber-900 leading-tight">
                                {session.aiReport.riskAlert.title}
                              </div>
                              <p className="font-mono text-[11px] text-amber-800">
                                {session.aiReport.riskAlert.why}
                              </p>
                              {session.aiReport.riskAlert.rescuePlan && (
                                <div className="space-y-1 bg-amber-50 p-2.5 rounded border border-amber-300">
                                  <span className="font-mono text-[10px] font-bold text-amber-800 uppercase block mb-1">
                                    🚨 CRISIS MODE STEP-BY-STEP RESCUE:
                                  </span>
                                  {session.aiReport.riskAlert.rescuePlan.map((step, sIdx) => (
                                    <div key={sIdx} className="flex items-start gap-1.5 text-xs font-mono font-medium text-amber-950">
                                      <input type="checkbox" className="mt-0.5 accent-amber-800" />
                                      <span>{step}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-4 text-center">
                              <span className="font-mono text-xs text-green-800 font-bold flex items-center justify-center gap-1">
                                <Smile className="w-4 h-4" />
                                NO CRITICAL RISK DETECTED
                              </span>
                              <span className="font-mono text-[10px] text-green-600 block mt-1">
                                All tasks are matched comfortably with scheduled times.
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 3. BURNOUT FLAG STATUS */}
                        {session.aiReport?.burnoutRisk.active && (
                          <div className="md:col-span-2 border-2 border-black bg-[#e2f0ff] p-4 rounded-lg shadow-[3px_3px_0px_#000]">
                            <h5 className="font-mono text-xs font-bold text-blue-900 border-b border-blue-300 pb-1 uppercase flex items-center gap-1.5 mb-2">
                              <Award className="w-4 h-4 text-blue-700" />
                              🧩 BURNOUT & WELL-BEING ANALYSIS
                            </h5>
                            <p className="font-handwritten text-base font-bold text-blue-950">
                              {session.aiReport.burnoutRisk.message}
                            </p>
                          </div>
                        )}
                        
                      </div>

                      {/* Context Switching Cost Warning Banner */}
                      {session.aiReport?.contextSwitchingWarning && (
                        <div className="border-2 border-black bg-purple-100 p-4 rounded-lg shadow-[3px_3px_0px_#000] flex flex-col gap-2">
                          <h5 className="font-mono text-xs font-bold text-purple-900 border-b border-purple-300 pb-1 uppercase flex items-center gap-1.5">
                            <Sliders className="w-4 h-4 text-purple-700 animate-pulse" />
                            🔀 CONTEXT SWITCHING COST DETECTED
                          </h5>
                          <p className="font-mono text-xs text-purple-950 leading-relaxed">
                            {session.aiReport.contextSwitchingWarning}
                          </p>
                          <div className="text-[10px] font-mono text-purple-700 bg-purple-50 p-2 rounded border border-purple-200">
                            <strong>AI Solution:</strong> We bundled similar categories (e.g. coding vs admin) into sequential blocks in your timeline below to minimize cognitive drag.
                          </div>
                        </div>
                      )}

                      {/* Procrastination Shield Intervention Panel */}
                      {session.aiReport?.procrastinationIntervention && (
                        <div className={`border-2 border-black p-4 rounded-lg shadow-[3px_3px_0px_#000] flex flex-col gap-2 ${
                          session.aiReport.procrastinationIntervention.active ? "bg-red-50 border-red-900" : "bg-zinc-100"
                        }`}>
                          <h5 className="font-mono text-xs font-bold border-b pb-1 uppercase flex items-center justify-between gap-1.5">
                            <span className="flex items-center gap-1.5 text-amber-900">
                              <ZapOff className="w-4 h-4 text-amber-700" />
                              🛡️ PROCRASTINATION SHIELD ACTIVE
                            </span>
                            <span className="text-[9px] bg-amber-200 text-amber-800 px-1 rounded font-bold uppercase">
                              INTERCEPT PATTERN
                            </span>
                          </h5>
                          
                          {session.aiReport.procrastinationIntervention.active ? (
                            <div className="space-y-2">
                              <div className="font-handwritten text-base font-bold text-amber-950">
                                <strong>Detected Trigger:</strong> "{session.aiReport.procrastinationIntervention.trigger}"
                              </div>
                              <p className="font-mono text-xs text-zinc-800 bg-white/80 p-2.5 rounded border border-black/10">
                                <strong>Jarvis Advice:</strong> {session.aiReport.procrastinationIntervention.advice}
                              </p>
                              <div className="font-mono text-xs font-bold text-green-800 bg-green-50 p-2.5 rounded border border-green-300 flex items-center justify-between flex-wrap gap-2">
                                <span>💡 Task Swap: {session.aiReport.procrastinationIntervention.suggestion}</span>
                                <SkeuoButton
                                  variant="primary"
                                  size="sm"
                                  onClick={() => {
                                    triggerBleep();
                                    // Set focus to planner tab
                                    setActiveTab(0);
                                  }}
                                  className="text-black"
                                >
                                  SWAP NOW
                                </SkeuoButton>
                              </div>
                            </div>
                          ) : (
                            <div className="py-2 flex items-center justify-between flex-wrap gap-2 text-black">
                              <span className="font-mono text-xs text-zinc-600">
                                No passive avoidant behavior or procrastination triggers detected yet.
                              </span>
                              <SkeuoButton
                                variant="danger"
                                size="sm"
                                onClick={async () => {
                                  triggerBleep();
                                  // Update session in cloud to activate procrastination mock alert
                                  if (session.aiReport) {
                                    await updateSessionInCloud({
                                      aiReport: {
                                        ...session.aiReport,
                                        procrastinationIntervention: {
                                          active: true,
                                          trigger: "Opened low-impact Admin task instead of Critical Coding task 3 times in a row.",
                                          advice: "Avoidance pattern detected. We recommend breaking down the Coding task into 15-minute micro-sprints or performing a quick Task Swap to rebuild momentum.",
                                          suggestion: "Write 1 function or read 1 file"
                                        }
                                      }
                                    });
                                  }
                                }}
                                className="text-white"
                              >
                                TRIGGER CUE
                              </SkeuoButton>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Delegation Suggestions Panel */}
                      {session.aiReport?.delegationSuggestions && session.aiReport.delegationSuggestions.length > 0 && (
                        <div className="border-2 border-black bg-blue-50 p-4 rounded-lg shadow-[3px_3px_0px_#000] space-y-3 text-black">
                          <h5 className="font-mono text-xs font-bold text-blue-900 border-b border-blue-300 pb-1 uppercase flex items-center gap-1.5">
                            <UserCheck className="w-4 h-4 text-blue-700 animate-bounce" />
                            📨 AUTONOMOUS DELEGATION DRAFTS
                          </h5>
                          <p className="font-mono text-[11px] text-blue-800 leading-snug">
                            DeadlineAI detected task overload. We drafted professional delegation emails for you to copy and dispatch instantly.
                          </p>

                          <div className="space-y-3.5">
                            {session.aiReport.delegationSuggestions.map((del, dIdx) => (
                              <div key={dIdx} className="bg-white rounded border border-blue-300 p-3 space-y-2">
                                <div className="flex justify-between items-center flex-wrap gap-2 text-xs font-mono">
                                  <span className="font-bold text-gray-800">Task: "{del.taskTitle}"</span>
                                  <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">To: {del.delegateTo}</span>
                                </div>
                                <div className="font-mono text-[10px] text-gray-600 bg-gray-50 p-2.5 rounded border border-gray-200 whitespace-pre-wrap select-all">
                                  {del.emailDraft}
                                </div>
                                <SkeuoButton
                                  variant="secondary"
                                  size="sm"
                                  className="w-full text-xs text-black"
                                  onClick={() => {
                                    triggerBleep();
                                    navigator.clipboard.writeText(del.emailDraft);
                                    alert("Delegation email draft copied to clipboard!");
                                  }}
                                >
                                  <Mail className="w-3.5 h-3.5 text-gray-700 inline mr-1" />
                                  <span>COPY DELEGATION EMAIL DRAFT</span>
                                </SkeuoButton>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested Time-block Schedule */}
                      <div>
                        <div className="font-mono text-xs font-bold text-gray-600 border-b border-gray-400 pb-1.5 mb-2 uppercase tracking-wide flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5">
                          <span>📅 SUGGESTED TIMELINE (HOURLY TIME-BLOCKS)</span>
                          <SkeuoButton
                            variant="success"
                            size="sm"
                            onClick={handleAutoReschedule}
                            disabled={aiLoading}
                            className="text-xs py-0.5 font-bold uppercase flex items-center gap-1 text-white"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                            <span>AUTO-HEAL TIMELINE</span>
                          </SkeuoButton>
                        </div>

                        <div className="space-y-1.5 relative pl-4 border-l-2 border-black">
                          {session.aiReport?.suggestedSchedule && session.aiReport.suggestedSchedule.map((block, bIdx) => {
                            const isBreak = block.type === "break";
                            const isMeeting = block.type === "meeting";
                            return (
                              <div key={bIdx} className="flex items-start gap-2 sm:gap-3 relative py-1.5">
                                {/* Bullet Node */}
                                <span className={`absolute left-[-21px] top-2.5 w-3 h-3 rounded-full border-2 border-black ${
                                  isBreak ? "bg-green-400" : isMeeting ? "bg-blue-400" : "bg-yellow-400"
                                }`} />
                                
                                <span className="font-mono text-[11px] sm:text-xs font-bold text-zinc-600 w-16 sm:w-20 flex-shrink-0 mt-0.5">
                                  {block.time}
                                </span>
                                
                                <span className={`font-mono text-[9px] sm:text-xs px-1.5 py-0.5 border border-black rounded flex-shrink-0 mt-0.5 ${
                                  isBreak ? "bg-green-100 text-green-800" : isMeeting ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"
                                }`}>
                                  {block.type.toUpperCase()}
                                </span>

                                <span className="font-handwritten text-base text-gray-900 font-bold flex-1 break-words">
                                  {block.activity}
                                </span>
                              </div>
                            );
                          })}

                          {(!session.aiReport?.suggestedSchedule || session.aiReport.suggestedSchedule.length === 0) && (
                            <div className="text-center py-6 font-mono text-xs text-gray-400 italic">
                              NO SUGGESTED SCHEDULE BLOCKS CALCULATED yet.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 4. ONE QUESTION CLARIFIER FEEDBACK LOOP */}
                      <div className="border-2 border-black bg-[#fdf2e9] p-4 rounded-lg shadow-[3px_3px_0px_#000]">
                        <h5 className="font-mono text-xs font-bold text-amber-900 border-b border-amber-300 pb-1 uppercase flex items-center gap-1.5 mb-2">
                          <HelpCircle className="w-4 h-4 text-amber-700" />
                          💬 ONE CLARIFYING QUESTION
                        </h5>
                        <p className="font-handwritten text-base font-bold text-amber-950 mb-3">
                          "{session.aiReport?.oneQuestion || "How are you pacing your daily breaks today?"}"
                        </p>
                        
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={questionAnswer}
                            onChange={(e) => setQuestionAnswer(e.target.value)}
                            placeholder="Type your response to tune priority, e.g. 'I can postpone standup'..."
                            className="font-mono text-xs border-2 border-black p-2.5 rounded bg-white flex-1 focus:outline-none text-black"
                          />
                          <SkeuoButton
                            variant="primary"
                            onClick={() => triggerAiTriage(questionAnswer)}
                            disabled={aiLoading || !questionAnswer.trim()}
                            className="text-black"
                          >
                            <Send className="w-3.5 h-3.5" />
                            TRANSMIT
                          </SkeuoButton>
                        </div>
                      </div>

                    </div>
                  </NotebookPaper>
                )}

                {/* -------------------- TAB 2: DEVICE SYNC STATION -------------------- */}
                {activeTab === 2 && (
                  <NotebookPaper title="🌐 POCKET CLOUD SYNC TERMINAL">
                    <div className="space-y-6 max-w-xl mx-auto">
                      
                      {/* Interactive pocket syncing diagram */}
                      <div className="border-4 border-black bg-[#cfcfc4] p-4 rounded-lg shadow-[4px_4px_0px_#000] text-center space-y-4">
                        <h4 className="font-mono text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-1">
                          <Smartphone className="w-4 h-4 text-emerald-800 animate-bounce" />
                          MULTI-DEVICE SEAMLESS HANDOFF
                          <Laptop className="w-4 h-4 text-blue-800 animate-bounce" />
                        </h4>
                        
                        <p className="font-mono text-xs text-gray-700 leading-relaxed">
                          Your DeadlineAI planner automatically saves with Firestore database. 
                          To sync another phone, laptop, or preview screen in real-time, simply enter this unique **POCKET ID CODE** on the secondary device.
                        </p>

                        {/* Large LCD Badge showing current sync code */}
                        <div className="bg-[#1b2b1a] p-4 rounded border-2 border-black inline-block">
                          <span className="font-mono text-2xl font-bold tracking-widest text-[#9cb196] lcd-glow select-all">
                            {pocketId}
                          </span>
                        </div>

                        <div className="text-[10px] font-mono text-gray-500">
                          (Tip: Double click or tap above to copy code to your clipboard)
                        </div>
                      </div>

                      {/* Swap Planner sync card form */}
                      <div className="border-2 border-black bg-[#e1e0d3] p-4 rounded shadow-[3px_3px_0px_#000]">
                        <h4 className="font-mono text-xs font-bold text-gray-800 border-b border-gray-400 pb-1 mb-3 uppercase">
                          🔗 LOAD DIFFERENT CARD OR SWAP PLANNER
                        </h4>
                        
                        <form onSubmit={handleLoadSyncId} className="space-y-3">
                          <div className="flex flex-col gap-1">
                            <label className="font-mono text-[10px] text-gray-600 font-bold">
                              TARGET POCKET SYNC ID
                            </label>
                            <input
                              type="text"
                              value={syncInputId}
                              onChange={(e) => setSyncInputId(e.target.value)}
                              placeholder="e.g. PRIYA-POCKET or CHIP-1422"
                              className="font-mono text-xs border-2 border-black p-2 rounded bg-white uppercase focus:outline-none"
                            />
                          </div>

                          <div className="flex gap-2">
                            <SkeuoButton type="submit" variant="primary" className="flex-1">
                              LOAD CARD
                            </SkeuoButton>
                            <SkeuoButton type="button" variant="secondary" onClick={handleGenerateRandomCode} className="flex-1">
                              NEW RANDOM CARD
                            </SkeuoButton>
                          </div>
                        </form>
                      </div>

                      {/* Informational Guidelines on design & features */}
                      <div className="border-2 border-black bg-yellow-50 p-4 rounded text-xs font-mono text-yellow-900 space-y-2">
                        <div className="font-bold border-b border-yellow-200 pb-1 flex items-center gap-1">
                          <HelpCircle className="w-3.5 h-3.5" />
                          DEADLINE-AI HIGHLIGHTS
                        </div>
                        <ul className="list-disc pl-4 space-y-1 leading-relaxed">
                          <li><strong>Zero-Gradient Skeuomorphic Design:</strong> Every bezel, notebook page, and coil mimics classic offline personal pocket assistants (PDAs).</li>
                          <li><strong>Crisis Rescue Mode:</strong> Triggers immediately when low-progress tasks near their deadline. Provides an incremental actionable solution.</li>
                          <li><strong>Empathetic Tone Adaptation:</strong> Adjusts from comforting and decompressed ("Low Energy") to highly sharp and aggressive ("High Energy").</li>
                          <li><strong>Real-time Synchronized Base:</strong> Fully backed by persistent Firestore sync for immediate cross-tab mirroring.</li>
                        </ul>
                      </div>

                    </div>
                  </NotebookPaper>
                )}
              </>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
