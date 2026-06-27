import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini AI client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// DeadlineAI triage API endpoint
app.post("/api/triage", async (req, res) => {
  try {
    const { username, tasks, calendarToday, energyLevel, currentTime, burnoutStreak, customInstruction } = req.body;

    const ai = getGeminiClient();

    const systemPrompt = `You are DeadlineAI — a proactive AI productivity companion, not a passive reminder tool.
ROLE: Act as a chief-of-staff for the user's time. You receive their task list, deadlines, calendar, and energy state.

Your job is to:
1. Triage tasks by urgency × impact (not just due date).
2. Detect deadline risk early and escalate before it's too late.
3. Recommend the single most important action right now.
4. Auto-generate a realistic time-block plan for today (incorporating their calendar events and suggesting breaks when there's a spike in scheduled demands).
5. Adapt tone to energy level:
   - "low" energy: Suggest micro-tasks (15 min chunks), defer non-urgent items, be gentle, supportive, and focus on psychological support.
   - "medium" energy: Balanced, action-oriented, solid chunks.
   - "high" energy: Direct, high-impact, sharp focus. Be very sharp, direct, and zero fluff.

SPECIAL RULES:
- If a task is <6 hours to its deadline and has <30% progress, TRIGGER CRISIS MODE: Create a step-by-step rescue plan to save the deadline.
- If there are 3+ consecutive days of missed tasks (burnoutStreak >= 3), flag burnout risk gently, suggesting a high-priority self-care or decompressed schedule instead of pushing harder.
- NEVER list tasks passively or say "don't forget X." Always frame around active next steps.
- Your personality is calm, sharp, zero fluff. Like Jarvis — highly intelligent, supportive but never preachy.
- Respect the wall-clock reference time provided by the user to build the hourly plan.
- Warn user about high "Context Switching Cost" if their calendar has more than 3 distinct unrelated back-to-back blocks.
- Provide a "Procrastination Intervention" if energy is low or burnoutStreak is high. Detect trigger behaviors and recommend a healthy quick-start action.
- Provide delegation suggestions for high effort but low priority tasks.`;

    const userPrompt = `
User name: ${username}
Current reference time: ${currentTime}
Current Energy level: ${energyLevel}
Burnout streak: ${burnoutStreak || 0} days of missed tasks
Calendar events today:
${JSON.stringify(calendarToday, null, 2)}

Tasks:
${JSON.stringify(tasks, null, 2)}

${customInstruction || ""}

Analyze the user's situation and generate a structured triage response.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            criticalNow: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING, description: "The single most important actionable step right now." },
                why: { type: Type.STRING, description: "Clear explanation of why this takes precedence based on urgency x impact." }
              },
              required: ["action", "why"]
            },
            suggestedSchedule: {
              type: Type.ARRAY,
              description: "Hourly schedule breakdown starting from the current time. Blend calendar events and suggested task sessions or breaks.",
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING, description: "Time of the block, e.g., '10:15 AM' or '11:00 AM'." },
                  activity: { type: Type.STRING, description: "Active name of task, break or calendar event. Use clear verb framing." },
                  type: { type: Type.STRING, enum: ["task", "break", "meeting"] },
                  taskId: { type: Type.STRING, description: "If this block maps to a specific task ID, provide it here." }
                },
                required: ["time", "activity", "type"]
              }
            },
            riskAlert: {
              type: Type.OBJECT,
              properties: {
                active: { type: Type.BOOLEAN, description: "True if any deadline is under critical risk (e.g. less than 6 hrs to deadline with <30% progress, or overlapping calendar limits)." },
                title: { type: Type.STRING, description: "The risk heading (e.g., 'CRISIS: PROJECT REPORT DEADLINE AT RISK')." },
                why: { type: Type.STRING, description: "Explanation of why this risk triggers." },
                rescuePlan: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "A solid, step-by-step rescue plan (broken down into micro-tasks) if risk is active."
                }
              },
              required: ["active", "title", "why"]
            },
            burnoutRisk: {
              type: Type.OBJECT,
              properties: {
                active: { type: Type.BOOLEAN, description: "True if the user is showing signs of high burnout (e.g., 3+ burnout streak or very high task density on low energy)." },
                message: { type: Type.STRING, description: "Gentle coaching advice for decompressing." }
              },
              required: ["active", "message"]
            },
            contextSwitchingWarning: {
              type: Type.STRING,
              description: "Warning about context switching cost if they have too many scattered task categories. Otherwise leave empty or keep brief."
            },
            procrastinationIntervention: {
              type: Type.OBJECT,
              properties: {
                active: { type: Type.BOOLEAN, description: "True if user is at high risk of procrastinating (e.g. low energy or zero progress)." },
                trigger: { type: Type.STRING, description: "Identified behavior/psychological trigger (e.g., 'Perfectionism block' or 'Low battery exhaustion')." },
                advice: { type: Type.STRING, description: "Jarvis advice to bypass this block." },
                suggestion: { type: Type.STRING, description: "A micro-task swap or ultra-easy starting step." }
              },
              required: ["active", "trigger", "advice", "suggestion"]
            },
            delegationSuggestions: {
              type: Type.ARRAY,
              description: "Suggestions for low-priority, high-effort items that can be delegated.",
              items: {
                type: Type.OBJECT,
                properties: {
                  taskTitle: { type: Type.STRING },
                  delegateTo: { type: Type.STRING, description: "Recommended virtual assistant, team member or service." },
                  emailDraft: { type: Type.STRING, description: "A drafted delegation message ready to send." }
                },
                required: ["taskTitle", "delegateTo", "emailDraft"]
              }
            },
            oneQuestion: {
              type: Type.STRING,
              description: "The single, sharp clarifying question to help prioritize better."
            },
            chatResponse: {
              type: Type.STRING,
              description: "A highly polished, Jarvis-like direct address. Keep it brief, sharp, encouraging, tailored to their energy level."
            }
          },
          required: ["criticalNow", "suggestedSchedule", "riskAlert", "burnoutRisk", "oneQuestion", "chatResponse"]
        }
      }
    });

    const reportData = JSON.parse(response.text || "{}");
    res.json(reportData);
  } catch (error: any) {
    console.error("Gemini triage error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze schedule." });
  }
});

// Endpoint to handle voice transcription or text containing natural language task descriptions,
// email text, or voice commands, and parse them into structured tasks & calendar events
app.post("/api/parse-nlp", async (req, res) => {
  try {
    const { rawInput } = req.body;
    if (!rawInput || !rawInput.trim()) {
      return res.status(400).json({ error: "Missing rawInput payload." });
    }

    const ai = getGeminiClient();

    const systemPrompt = `You are DeadlineAI's high-fidelity Natural Language Processing engine.
Your task is to take a raw voice transcription, spoken command, email text, or messy note, and parse it into structured tasks and/or calendar events.

Apply these ML behavior guidelines:
1. DEADLINE RISK PREDICTION: Users always underestimate task times by 1.5x to 2.5x. For any task detected, look at the type. If it's "Coding", "Writing", or "Design", predict a "predictedEffort" that is roughly 2x their "estimatedEffort" (or defaults to a sensible AI estimate if none was specified). Set "underestimationRisk" to true.
2. NATURAL LANGUAGE CAPTURE: Correctly extract the task title, a clean due date expression (e.g. "today 6pm", "tomorrow", "Friday"), and classify it into a category like "Coding", "Meeting", "Personal", "Admin", "Design".
3. Calendar extraction: If the text describes a calendar event (e.g. "meeting tomorrow at 3pm" or "sync with team Thursday 11am"), parse it into a structured calendar string like "Thursday 11:00 AM — Sync with team".

Return ONLY a JSON response conforming strictly to the requested schema.`;

    const userPrompt = `Input messy text/voice transcription to parse:
"""
${rawInput}
"""

Parse this text into clean, actionable, high-productivity objects.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tasks: {
              type: Type.ARRAY,
              description: "List of structured tasks extracted from the input.",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  due: { type: Type.STRING, description: "Simplified relative deadline representation, e.g., 'Friday 5pm' or 'today 6pm'." },
                  priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
                  estimatedEffort: { type: Type.NUMBER, description: "How many hours the user estimated, or a default baseline if none specified." },
                  predictedEffort: { type: Type.NUMBER, description: "Your ML risk-adjusted predicted effort (often 1.5x-2.5x user estimate for design/code tasks)." },
                  underestimationRisk: { type: Type.BOOLEAN, description: "True if the user is likely underestimating this task type." },
                  category: { type: Type.STRING, description: "e.g., 'Coding', 'Admin', 'Writing', 'Personal', 'Design'." }
                },
                required: ["title", "due", "priority", "estimatedEffort", "predictedEffort", "underestimationRisk", "category"]
              }
            },
            calendarEvents: {
              type: Type.ARRAY,
              description: "Calendar events formatted nicely, e.g., '3:00 PM — Team standup (30 min)'.",
              items: { type: Type.STRING }
            },
            parsedSummary: {
              type: Type.STRING,
              description: "A short, sharp human-like speech brief from Jarvis detailing what was parsed and any predictive risk warnings (e.g., 'I parsed your email. Extracted 1 coding task. Note: I adjusted your 2h coding estimate to 4.5h due to high underestimation patterns.')."
            }
          },
          required: ["tasks", "calendarEvents", "parsedSummary"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (error: any) {
    console.error("NLP Parse error:", error);
    res.status(500).json({ error: error.message || "Failed to parse natural language." });
  }
});

// Setup Vite development server or production static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DeadlineAI custom Express server booted on http://localhost:${PORT}`);
  });
}

startServer();
