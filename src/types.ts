export type Language = 'en' | 'kn' | 'hi';

export type UserRole = 'patient' | 'caregiver' | null;

export type TaskStatus = 
  | 'upcoming' 
  | 'in_progress' 
  | 'completed' 
  | 'missed' 
  | 'snoozed' 
  | 'unconfirmed';

export type MoodType = 'very_happy' | 'happy' | 'okay' | 'sad' | 'anxious';
export type PatientMood = MoodType;

export interface TaskItem {
  id: string;
  patientId: string;
  patientUid?: string;
  caregiverUid?: string;
  assignedBy?: string;
  assignedByName?: string;
  title: string;
  description?: string;
  time: string;
  dueDate?: string;
  dueTime?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category: 'medicine' | 'exercise' | 'calm' | 'meal' | 'activity';
  completed: boolean;
  snoozed: boolean;
  missed?: boolean;
  completedAt?: string;
  completedTime?: string;
  patientConfirmation?: boolean;
  patientConfirmed?: boolean;
  status?: TaskStatus;
  voiceReminderText?: string;
  dosage?: string;
  notes?: string;
  source?: 'caregiver_created' | 'system_generated' | 'patient_logged' | 'caregiver' | 'system' | string;
  createdBy?: 'caregiver' | 'system' | 'patient' | string;
  refillDays?: number;
  refillAlert?: boolean;
}

export interface CallLog {
  id: string;
  callLogId: string;
  patientUid?: string;
  patientId: string;
  caregiverUid?: string;
  callerUid: string;
  callerName: string;
  callerRole?: 'patient' | 'caregiver';
  receiverUid?: string;
  receiverName: string;
  receiverRole?: 'patient' | 'caregiver';
  callType: 'incoming' | 'outgoing' | 'audio' | 'video';
  callStatus: 'completed' | 'missed' | 'declined';
  callDate: string; // e.g. "2026-10-30" or "Today"
  callTime: string; // e.g. "10:30 AM"
  duration: string; // e.g. "04:12" or "0 mins"
  notes?: string;
  createdBy: string; // UID
  createdByName?: string;
  createdAt: string; // ISO string
  updatedAt?: string;
  lastEditedBy?: string;
  lastEditedByName?: string;
}

export interface ActivityLog {
  id: string;
  patientId: string;
  taskName: string;
  category: 'medicine' | 'exercise' | 'calm' | 'activity' | 'meal';
  scheduledTime: string;
  completedTime?: string;
  actualCompletionTime?: string;
  status: TaskStatus;
  patientConfirmed?: boolean;
  patientConfirmation?: boolean;
  source?: 'caregiver_created' | 'system_generated' | 'patient_logged' | 'caregiver' | 'system' | string;
  timestamp: string;
}

export type ActivityTimelineItem = ActivityLog;

export interface MoodRecord {
  id: string;
  patientId: string;
  mood: MoodType;
  date?: string; // e.g. '2026-10-30'
  dayOfWeek?: string; // 'Mon', 'Tue'
  day?: string;
  timeOfDay?: 'morning' | 'evening' | string;
  timestamp?: string;
  recordedAt?: string;
  timeLabel?: string;
  note?: string;
}

export interface SmartMedication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  scheduledTime: string;
  taken: boolean;
  takenAt?: string;
  missed: boolean;
  snoozeUntil?: string;
  refillNeeded: boolean;
  refillInDays: number;
  pillCount: number;
  instructions: string;
}

export interface FamiliarFace {
  id: string;
  name: string;
  relation?: string;
  relationship?: string;
  avatar?: string;
  photoUrl?: string;
  phone?: string;
  notes?: string;
  description?: string;
  birthday?: string;
  lastVisited?: string;
}

export interface FamilyMessage {
  id: string;
  senderName: string;
  relation: string;
  avatar: string;
  message: string;
  date: string;
  type: 'text' | 'voice' | 'birthday';
  audioDuration?: string;
}

export interface ImportantDate {
  id: string;
  title: string;
  date: string;
  relation: string;
  description?: string;
  badge?: string;
}

export interface RoutineSuggestion {
  id: string;
  patientId: string;
  title: string;
  suggestedTime: string;
  category: 'exercise' | 'calm' | 'medicine' | 'meal';
  reason: string;
  status: 'pending' | 'approved' | 'dismissed';
  confidence?: number;
  personalizationInsights: string[];
}

export interface AppNotification {
  id: string;
  patientId: string;
  title: string;
  message: string;
  type: 
    | 'task_completed' 
    | 'missed_activity' 
    | 'sos_alert' 
    | 'voice_note' 
    | 'mood_checkin' 
    | 'refill_alert' 
    | 'meeting'
    | 'routine_change';
  targetRole: 'caregiver' | 'patient' | 'both' | 'all';
  urgency: 'gentle' | 'normal' | 'emergency' | 'low' | 'medium';
  timestamp: string;
  timeAgo?: string;
  read: boolean;
}

export interface ContactItem {
  id: string;
  patientId?: string;
  patientUid?: string;
  caregiverUid?: string;
  name: string;
  relationship?: string;
  relation?: string;
  phone: string;
  avatar: string;
  isQuickCall?: boolean;
  birthday?: string;
  videoEnabled?: boolean;
}

export interface LiveLocation {
  lat: number;
  lng: number;
  accuracy: number; // in meters (e.g. 5m)
  address: string;
  lastUpdated: string;
  isSharing: boolean;
}

export interface PatientProfile {
  id: string;
  uid?: string;
  name: string;
  age: number;
  gender: string;
  bloodGroup: string;
  homeLocation: string;
  liveLocationEnabled: boolean;
  currentLocation?: LiveLocation;
  currentLatitude?: number;
  currentLongitude?: number;
  locationAccuracy?: string | number;
  locationLastUpdated?: string;
  dateOfBirth: string;
  avatar: string;
  status: 'all_good' | 'meds_pending' | 'sos_alert';
  streakDays: number;
  overallCompletion: number;
  caregiverId: string;
  caregiverName?: string;
  caregiverPhone?: string;
  phone?: string;
  adaptiveNotes?: string;
  voiceSettings?: {
    enabled: boolean;
    language: 'en' | 'kn' | 'hi';
    speed: number;
    volume: number;
  };
}

export interface DayProgress {
  day: string;
  fullDate: string;
  completionRate: number;
  medsTaken: number;
  medsTotal: number;
  mood: 'great' | 'good' | 'okay' | 'low' | 'sad';
  sleepHours: number;
  activitiesMinutes: number;
}

export interface PhotoMemory {
  id: string;
  album: string;
  title: string;
  date: string;
  caption: string;
  imageUrl: string;
  tags: string[];
}

export interface VoiceNoteRecord {
  id: string;
  senderName: string;
  senderRole: 'patient' | 'caregiver';
  timestamp: string;
  duration: string;
  audioBlobUrl?: string;
  transcription: string;
  patientId: string;
}

export interface RelativeMeeting {
  id: string;
  patientId: string;
  relativeName: string;
  relationship: string;
  date: string;
  time: string;
  note: string;
  avatar: string;
  isRecurring?: boolean;
  isRecurringWeekly?: boolean;
}

export interface EmergencyAlertItem {
  id: string;
  patientId: string;
  patientName: string;
  time?: string;
  timestamp: string;
  location: string;
  latitude?: number;
  longitude?: number;
  lastUpdatedText?: string;
  coords?: { lat: number; lng: number };
  accuracyMeters?: number;
  status: 'active' | 'resolved' | 'escalated';
  hasVoiceNote: boolean;
  notes?: string;
  ambulanceContacted?: boolean;
  acknowledgedBy?: string;
  resolvedAt?: string;
  historyLogs?: Array<{ time: string; message: string }>;
}

export interface MusicTrack {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  soundType: 'flute' | 'rain' | 'ocean' | 'forest' | 'bells';
  category: string;
}

export type VoiceCompanionAction = 
  | 'open_photos'
  | 'open_music'
  | 'open_breathing'
  | 'call_contact'
  | 'remind_task'
  | 'mark_task_completed'
  | 'record_caregiver_message'
  | 'trigger_sos_confirmation'
  | 'none';

export interface VoiceCompanionMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  action?: VoiceCompanionAction;
  actionPayload?: {
    contactId?: string;
    contactName?: string;
    phone?: string;
    taskId?: string;
    taskTitle?: string;
    trackId?: string;
    message?: string;
  };
  needsConfirmation?: boolean;
  confirmationPrompt?: string;
  confirmed?: boolean;
}
