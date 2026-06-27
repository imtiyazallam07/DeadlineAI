import { UserSession, AIReport } from "./types";

export const PRIYA_SAMPLE_STATE: UserSession = {
  userId: "PRIYA-POCKET",
  username: "Priya",
  tasks: [
    { 
      id: "t1", 
      title: "Submit project report", 
      due: "today 6pm", 
      progress: 20, 
      priority: "high",
      estimatedEffort: 2,
      predictedEffort: 4.5,
      underestimationRisk: true,
      category: "Writing"
    },
    { 
      id: "t2", 
      title: "Pay electricity bill", 
      due: "tomorrow", 
      progress: 0, 
      priority: "medium",
      estimatedEffort: 0.25,
      predictedEffort: 0.25,
      underestimationRisk: false,
      category: "Admin"
    },
    { 
      id: "t3", 
      title: "Prepare for job interview", 
      due: "in 2 days", 
      progress: 10, 
      priority: "high",
      estimatedEffort: 3,
      predictedEffort: 6,
      underestimationRisk: true,
      category: "Personal"
    },
    { 
      id: "t4", 
      title: "Reply to 12 emails", 
      due: "end of week", 
      progress: 0, 
      priority: "low",
      estimatedEffort: 1,
      predictedEffort: 1.5,
      underestimationRisk: false,
      category: "Admin"
    }
  ],
  calendarToday: [
    "3:00 PM — Team standup (30 min)",
    "5:00 PM — Gym"
  ],
  energyLevel: "low",
  currentTime: "10:00 AM",
  burnoutStreak: 0
};

export const DEFAULT_AI_REPORT_SEED: AIReport = {
  criticalNow: {
    action: "Focus on the Project Report immediately",
    why: "Due in 8 hours at 6:00 PM with only 20% progress. Highest urgency."
  },
  suggestedSchedule: [
    { time: "10:00 AM", activity: "Micro-session: Brainstorm outline (15 mins) [Peak Energy Slot]", type: "task", taskId: "t1" },
    { time: "10:15 AM", activity: "15 min decompression break", type: "break" },
    { time: "10:30 AM", activity: "Draft introduction paragraph (15 mins)", type: "task", taskId: "t1" },
    { time: "11:00 AM", activity: "Pay electricity bill (10 mins quick win)", type: "task", taskId: "t2" },
    { time: "12:00 PM", activity: "Lunch and recovery break", type: "break" },
    { time: "01:00 PM", activity: "Review interview questions [Warning: Context Switch]", type: "task", taskId: "t3" },
    { time: "03:00 PM", activity: "Team standup (30 min)", type: "meeting" },
    { time: "03:30 PM", activity: "Write report draft (Part 1)", type: "task", taskId: "t1" },
    { time: "04:30 PM", activity: "Final Polish of report", type: "task", taskId: "t1" },
    { time: "05:00 PM", activity: "Gym / Mental health walk", type: "meeting" },
    { time: "06:00 PM", activity: "Report Submit Deadline", type: "task", taskId: "t1" }
  ],
  riskAlert: {
    active: true,
    title: "CRISIS MODE: PROJECT REPORT AT RISK",
    why: "Due at 6:00 PM today with only 20% progress. High risk of failure.",
    rescuePlan: [
      "Open report draft on desktop right now.",
      "Write three bullet points of key outcomes.",
      "Ask a colleague for quick data check.",
      "Submit draft for final sign-off by 5:30 PM."
    ]
  },
  burnoutRisk: {
    active: false,
    message: "Energy is low, but streak is healthy. Stick to short bursts and take breaks."
  },
  contextSwitchingWarning: "You are switching between Writing (Report) and Personal prep (Interview) with no buffer. We suggest adding a 10m breathing break between blocks to offset the 25% cognitive load loss.",
  procrastinationIntervention: {
    active: true,
    trigger: "Avoidance pattern detected (opening mail/bill paying instead of Report writing).",
    advice: "Your brain is choosing easy low-stakes tasks to avoid the friction of starting the report. This is common when energy is low.",
    suggestion: "Open the report document and write just ONE sentence. That's it. Action precedes motivation!"
  },
  delegationSuggestions: [
    {
      taskTitle: "Reply to 12 emails",
      delegateTo: "AI Assistant Draft generator / Deputy Chief-of-Staff",
      emailDraft: "Hi team, Priya is currently heads-down finalizing the critical project report due at 6 PM. She has drafted quick confirmations for these items. Please find the compiled bullet points attached..."
    }
  ],
  oneQuestion: "Can you defer any meetings after 3 PM to secure an extra hour for the report draft?",
  chatResponse: "Priya. I've analyzed your agenda. Your report is currently at high risk of slipping. Since your energy level is LOW, I've broken the afternoon into micro-sessions with built-in resets so you don't burn out. Let's secure the report outline before the 3:00 PM Standup."
};
