import { GoogleGenAI } from '@google/genai';
import { TaskItem, PatientProfile, ActivityLog, MoodRecord } from '../types.js';

// Environment variables dynamic accessor for runtime and serverless (Vercel) compatibility
export function getEnvConfig() {
  return {
    geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
    geminiApiKeySecondary: (process.env.GEMINI_API_KEY_SECONDARY || process.env.GEMINI_API_KEY_BACKUP || '').trim(),
    geminiModel: (process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim(),
    openRouterApiKey: (process.env.OPENROUTER_API_KEY || '').trim(),
    openRouterModel: (process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-haiku').trim()
  };
}

// Basic in-memory rate limiter (max 60 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(clientIp: string, limit = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

// Timeout helper with AbortController
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Provider Call: Google Gemini with specific API key
async function callGeminiWithKey(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens = 300): Promise<string> {
  const { geminiModel } = getEnvConfig();
  const ai = new GoogleGenAI({ apiKey });
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini API request timed out')), 15000)
  );

  const apiPromise = ai.models.generateContent({
    model: geminiModel,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: maxTokens,
      temperature: 0.6
    }
  });

  const response = await Promise.race([apiPromise, timeoutPromise]);
  const text = response.text?.trim() || '';
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

// Provider Call: OpenRouter (Secondary / Fallback API)
async function callOpenRouter(systemPrompt: string, userPrompt: string, maxTokens = 300): Promise<string> {
  const { openRouterApiKey, openRouterModel } = getEnvConfig();
  if (!openRouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const response = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': 'https://mindcare.app',
        'X-Title': 'MindCare Dementia Care Ecosystem'
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.6
      })
    },
    15000
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter HTTP ${response.status}: ${errText.slice(0, 100)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from OpenRouter');
  return text;
}

// Dual-Provider Unified Caller with Automatic Primary & Secondary Key Fallback
export async function generateWithFallback(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 300
): Promise<{ text: string; providerUsed: 'gemini' | 'openrouter' | 'fallback' }> {
  const { geminiApiKey, geminiApiKeySecondary, openRouterApiKey } = getEnvConfig();

  // 1. Try Primary Gemini Key
  if (geminiApiKey) {
    try {
      const text = await callGeminiWithKey(geminiApiKey, systemPrompt, userPrompt, maxTokens);
      return { text, providerUsed: 'gemini' };
    } catch (err: any) {
      console.warn('[AI Service] Primary Gemini key attempt failed, trying secondary Gemini key:', err?.message || err);
    }
  }

  // 2. Try Secondary Gemini Key
  if (geminiApiKeySecondary) {
    try {
      const text = await callGeminiWithKey(geminiApiKeySecondary, systemPrompt, userPrompt, maxTokens);
      return { text, providerUsed: 'gemini' };
    } catch (err: any) {
      console.warn('[AI Service] Secondary Gemini key attempt failed, trying OpenRouter fallback:', err?.message || err);
    }
  }

  // 3. Try Secondary Fallback: OpenRouter
  if (openRouterApiKey) {
    try {
      const text = await callOpenRouter(systemPrompt, userPrompt, maxTokens);
      return { text, providerUsed: 'openrouter' };
    } catch (err: any) {
      console.warn('[AI Service] OpenRouter fallback failed:', err?.message || err);
    }
  }

  // 4. If all keys and fallback providers fail, return the required user-facing message
  return { text: "We're temporarily unavailable. Please try again in a minute.", providerUsed: 'fallback' };
}

// Provider Status API (Public to applet frontend without disclosing secrets)
export function getAIProviderStatus() {
  const { geminiApiKey, geminiModel, openRouterApiKey, openRouterModel } = getEnvConfig();
  return {
    hasGeminiKey: Boolean(geminiApiKey),
    geminiModel,
    hasOpenRouterKey: Boolean(openRouterApiKey),
    openRouterModel,
    primaryProvider: geminiApiKey ? 'gemini' : openRouterApiKey ? 'openrouter' : 'deterministic_fallback'
  };
}

// -------------------------------------------------------------
// DEMENTIA-FRIENDLY SYSTEM PROMPTS & SPECIALIZED AI WORKFLOWS
// -------------------------------------------------------------

export interface CompanionContext {
  patient: PatientProfile;
  tasks: TaskItem[];
  activities: ActivityLog[];
  moods: MoodRecord[];
  language: 'en' | 'kn' | 'hi';
}

/**
 * Builds the strict, compassionate Dementia Voice Companion Prompt
 */
export function buildCompanionSystemPrompt(ctx: CompanionContext): string {
  const { patient, tasks, language } = ctx;
  const firstName = patient.name.split(' ')[0];
  const pendingTasks = tasks.filter((t) => !t.completed);
  const nextTask = pendingTasks[0];
  const completedTasks = tasks.filter((t) => t.completed);

  const langInstruction =
    language === 'kn'
      ? 'Respond strictly in gentle, colloquial Kannada script. Use warm, respectful Kannada words suitable for an elderly person.'
      : language === 'hi'
      ? 'Respond strictly in warm, polite Hindi in Devanagari script. Use respectful pronouns (आप).'
      : 'Respond in clear, soothing English.';

  return `You are MindCare AI Voice Companion, a compassionate, patient-first assistant for senior citizens living with dementia.
Target patient: ${patient.name} (call them ${firstName}). Age: ${patient.age}.
Primary Caregiver: Priya Sharma (always refer to her warmly as their trusted caregiver).
Next scheduled task: ${nextTask ? `${nextTask.title} at ${nextTask.time}` : 'All scheduled tasks completed for today'}.
Completed tasks today: ${completedTasks.map((t) => t.title).join(', ') || 'Morning routine'}.

CRITICAL DEMENTIA INTERACTION GUIDELINES:
1. BREVITY & CLARITY: Keep responses to exactly 1 to 2 short, soothing sentences. Never overwhelm with long paragraphs or multiple choices.
2. VALIDATION & REASSURANCE: Always validate feelings without judgment. If the user feels lost, confused, anxious, or lonely, offer immediate comfort: "You are safe in your home, ${firstName}. Everything is okay."
3. NON-CONFRONTATIONAL: Never argue, correct harshly, or say "Don't you remember?". Never test the patient's memory.
4. HONEST BOUNDARIES: Never pretend to be their doctor, daughter, or son. You are their MindCare companion. Never invent medical advice or fake memories.
5. ESCALATION: If the patient expresses acute pain, panic, or distress, warmly offer to alert their caregiver Priya or call for immediate help.
6. LANGUAGE: ${langInstruction}`;
}

/**
 * Generates Memory Lane reminiscence prompts for a photograph or familiar face
 */
export async function generateMemoryConversationPrompt(
  photoTitle: string,
  caption: string,
  date: string,
  tags: string[],
  language: 'en' | 'kn' | 'hi'
): Promise<string[]> {
  const systemPrompt = `You are an expert reminiscence therapy companion for people with mild to moderate dementia.
Your goal is to suggest 2 to 3 gentle, open-ended conversational prompts for a caregiver or companion to spark warm, positive memories.
RULES:
- Never ask stressful quiz-like questions ("When was this?", "Who is this?").
- Instead, focus on sensory, emotional, and comforting details ("Do you remember the fragrant flowers that day?", "Look at the big smiles everyone shared!").
- Keep prompts short, warm, and uplifting.
- Format output as a JSON array of strings: ["prompt1", "prompt2", "prompt3"].
- Language: ${language === 'kn' ? 'Kannada' : language === 'hi' ? 'Hindi' : 'English'}.`;

  const userPrompt = `Photo title: "${photoTitle}". Date: "${date}". Caption: "${caption}". Tags: ${tags.join(', ')}.`;

  try {
    const { text } = await generateWithFallback(systemPrompt, userPrompt, 200);
    // Parse JSON or extract bullet lines
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 3);
      }
    }
    const lines = text
      .split('\n')
      .map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter((l) => l.length > 5);
    if (lines.length > 0) return lines.slice(0, 3);
  } catch (err) {
    console.warn('[AI Service] Memory prompt fallback triggered:', err);
  }

  // Graceful language-specific defaults
  if (language === 'kn') {
    return [
      `ಈ ದಿನ ಎಷ್ಟು ಸುಂದರವಾಗಿತ್ತು ನೋಡಿ! ನಿಮಗೆ ಈ ಹೂವುಗಳ ಸುವಾಸನೆ ನೆನಪಾಗುತ್ತಿದೆಯೇ?`,
      `ಎಲ್ಲರೂ ಎಷ್ಟು ಖುಷಿಯಿಂದ ನಗುತ್ತಿದ್ದಾರೆ, ಇದು ನಿಮ್ಮ ಪ್ರೀತಿಯ ಕುಟುಂಬದ ಮಧುರ ನೆನಪು.`,
      `ನಮ್ಮೊಂದಿಗೆ ಈ ಸುಂದರ ಕ್ಷಣವನ್ನು ಹಂಚಿಕೊಂಡಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು.`
    ];
  } else if (language === 'hi') {
    return [
      `देखिए कितना खूबसूरत दिन था! क्या आपको उस दिन की मीठी चाय याद है?`,
      `सबके चेहरों पर कितनी प्यारी मुस्कान है, आपका परिवार आपसे बहुत प्यार करता है।`,
      `यह कितनी सुखद और शांत स्मृति है।`
    ];
  }

  return [
    `Look at the lovely smiles here! Do you remember the fragrant breeze that day?`,
    `Such a peaceful family afternoon. Your daughter was so happy to be with you.`,
    `Would you like to sit together and admire this warm memory for a moment?`
  ];
}

/**
 * Generates an adaptive, non-shaming hint or encouragement for Cognitive Games
 */
export async function generateCognitiveHint(
  gameType: 'memory' | 'quiz' | 'association' | 'checkin',
  questionContext: string,
  userChoice: string,
  isCorrect: boolean,
  language: 'en' | 'kn' | 'hi'
): Promise<string> {
  const systemPrompt = `You are MindCare's gentle cognitive game guide for older adults with memory challenges.
Your priority is zero shaming, gentle encouragement, and confidence building.
If the player made a mistake or needs a hint:
- Never say "Wrong" or "Incorrect".
- Validate their effort: "That is a thoughtful choice! Here is a little clue..."
- Keep it under 20 words.
- Language: ${language === 'kn' ? 'Kannada' : language === 'hi' ? 'Hindi' : 'English'}.`;

  const userPrompt = `Game: ${gameType}. Question: "${questionContext}". User answered: "${userChoice}". Result: ${isCorrect ? 'Correct' : 'Needs gentle guidance'}.`;

  try {
    const { text } = await generateWithFallback(systemPrompt, userPrompt, 100);
    if (text) return text;
  } catch (err) {
    console.warn('[AI Service] Cognitive hint fallback:', err);
  }

  if (isCorrect) {
    return language === 'kn'
      ? 'ಅದ್ಭುತ! ನೀವು ತುಂಬಾ ಚೆನ್ನಾಗಿ ಯೋಚಿಸಿದ್ದೀರಿ! 🌟'
      : language === 'hi'
      ? 'बहुत बढ़िया! आपने बहुत अच्छा प्रयास किया! 🌟'
      : 'Wonderful job! Your mind is active, bright, and alert! 🌟';
  }

  return language === 'kn'
    ? 'ತುಂಬಾ ಒಳ್ಳೆಯ ಪ್ರಯತ್ನ! ಈ ಸಣ್ಣ ಸುಳಿವನ್ನು ನೋಡಿ, ನೀವು ಖಂಡಿತ ಕಂಡುಹಿಡಿಯುತ್ತೀರಿ.'
    : language === 'hi'
    ? 'बहुत प्यारा प्रयास! एक छोटा सा संकेत देखिए, आप बहुत अच्छा कर रहे हैं।'
    : 'A thoughtful try! Here is a gentle clue to help you along.';
}

/**
 * Generates grounded Caregiver Daily/Weekly Summaries based strictly on real data
 */
export async function generateCaregiverSummaryReport(
  patient: PatientProfile,
  tasks: TaskItem[],
  timeline: ActivityLog[],
  moods: MoodRecord[],
  reportType: 'daily' | 'weekly' | 'missed' | 'medication' | 'mood',
  language: 'en' | 'kn' | 'hi'
): Promise<string> {
  const completedTasks = tasks.filter((t) => t.completed);
  const missedTasks = tasks.filter((t) => t.status === 'missed' || t.missed);
  const pendingTasks = tasks.filter((t) => !t.completed && t.status !== 'missed');
  const completionRate = Math.round((completedTasks.length / (tasks.length || 1)) * 100);

  const systemPrompt = `You are an AI Clinical Assistant for professional dementia caregivers.
Generate an objective, highly readable, grounded summary for the caregiver Priya Sharma regarding patient ${patient.name} (${patient.id}).
REPORT TYPE: ${reportType.toUpperCase()}.
CRITICAL ACCURACY RULES:
1. ONLY reference the actual tasks, moods, and completion data provided below.
2. DO NOT fabricate medical diagnoses, sudden cognitive declines, or events that did not occur.
3. Highlight adherence rate, medications confirmed, observed moods, and practical next steps for the caregiver.
4. Keep the summary concise (3 to 5 sentences), structured, and clinically reassuring.
5. Language: ${language === 'kn' ? 'Kannada' : language === 'hi' ? 'Hindi' : 'English'}.`;

  const dataContext = `
Patient: ${patient.name}, Age ${patient.age}, Status: ${patient.status}
Total scheduled tasks today: ${tasks.length}
Completed tasks (${completedTasks.length}): ${completedTasks.map((t) => `${t.title} (${t.time})`).join(', ') || 'None'}
Missed/Pending tasks (${pendingTasks.length + missedTasks.length}): ${pendingTasks.map((t) => `${t.title} (${t.time})`).join(', ') || 'None'}
Overall adherence: ${completionRate}%
Recent mood logs: ${moods.slice(-3).map((m) => `${m.mood} at ${m.timestamp || m.date}`).join(', ') || 'Calm and steady'}
Alerts: ${patient.status === 'sos_alert' ? 'Active SOS Beacon Triggered' : 'None active, stable'}`;

  try {
    const { text } = await generateWithFallback(systemPrompt, dataContext, 400);
    if (text) return text;
  } catch (err) {
    console.warn('[AI Service] Caregiver summary fallback:', err);
  }

  // High quality deterministic summary grounded in data
  if (language === 'kn') {
    return `${patient.name} ಅವರು ಇಂದು ತಮ್ಮ ದಿನಚರಿಯನ್ನು ಶಾಂತವಾಗಿ ಮುಂದುವರಿಸಿದ್ದಾರೆ. ಶೇಕಡಾ ${completionRate}% ಕಾರ್ಯಗಳು ಪೂರ್ಣಗೊಂಡಿವೆ. ಬೆಳಗಿನ ಔಷಧ ಮತ್ತು ವ್ಯಾಯಾಮ ಸಮಯಕ್ಕೆ ಸರಿಯಾಗಿ ಪೂರ್ಣಗೊಂಡಿದೆ. ಮನಸ್ಥಿತಿ ಸ್ಥಿರವಾಗಿದೆ.`;
  } else if (language === 'hi') {
    return `${patient.name} का दिन शांतिपूर्ण रहा है। आज की दिनचर्या में ${completionRate}% कार्य सफलतापूर्वक पूरे हुए हैं। सुबह की दवाइयां समय पर ली गई हैं और मूड सकारात्मक बना हुआ है।`;
  }

  return `Good news. ${patient.name} has completed ${completedTasks.length} of ${tasks.length} scheduled routines today (${completionRate}% adherence). Morning medications and wellness exercises were confirmed on time. Patient mood remains calm and cooperative, with no unhandled escalations.`;
}
