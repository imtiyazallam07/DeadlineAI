export interface Task {
  id: string;
  title: string;
  due: string; // e.g. "today 6pm", "tomorrow"
  progress: number; // 0-100
  priority: 'low' | 'medium' | 'high';
  completed?: boolean;
  estimatedEffort?: number; // hours estimated by user
  predictedEffort?: number; // hours predicted by AI based on behavior/underestimation risk
  underestimationRisk?: boolean; // AI flags if likely underestimated
  category?: string; // e.g. "Coding", "Meeting", "Personal", "Admin"
}

export interface ScheduleBlock {
  time: string;
  activity: string;
  type: 'task' | 'break' | 'meeting';
  taskId?: string;
}

export interface ProcrastinationIntervention {
  active: boolean;
  trigger: string;
  advice: string;
  suggestion: string;
}

export interface DelegationSuggestion {
  taskTitle: string;
  delegateTo: string;
  emailDraft: string;
}

export interface AIReport {
  criticalNow: {
    action: string;
    why: string;
  };
  suggestedSchedule: ScheduleBlock[];
  riskAlert: {
    active: boolean;
    title: string;
    why: string;
    rescuePlan?: string[];
  };
  burnoutRisk: {
    active: boolean;
    message: string;
  };
  oneQuestion: string;
  chatResponse: string;
  contextSwitchingWarning?: string; // Warning about high switching cost
  procrastinationIntervention?: ProcrastinationIntervention; // Intercept procrastinator cues
  delegationSuggestions?: DelegationSuggestion[]; // AI drafted delegations
}

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface UserSession {
  userId: string;
  username: string;
  tasks: Task[];
  calendarToday: string[];
  energyLevel: 'low' | 'medium' | 'high';
  currentTime: string;
  burnoutStreak: number;
  dob?: string;
  updatedAt?: string;
  aiReport?: AIReport;
  notes?: Note[];
}
