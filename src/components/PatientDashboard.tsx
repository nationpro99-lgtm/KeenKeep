import React, { useState, useEffect } from 'react';
import { 
  Copy, 
  Check, 
  Volume2, 
  ChevronRight, 
  Image as ImageIcon, 
  Gamepad2, 
  Flower2, 
  Phone, 
  Pill, 
  Mic, 
  Music2, 
  AlertCircle, 
  Home, 
  Calendar, 
  MoreHorizontal, 
  Clock, 
  Smile, 
  Radio, 
  ShieldCheck, 
  Users, 
  TrendingUp, 
  MessageSquare, 
  HeartHandshake, 
  Play,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PatientProfile, TaskItem, Language } from '../types';
import { translations } from '../data/translations';
import { speakText, playChime } from '../utils/audio';
import { UserAvatar } from './UserAvatar';
import { LocationSharingToggle } from './LocationSharingToggle';
import { authService, CaregiverConnectionRequest } from '../services/authService';
import { calculateAgeFromDob } from '../utils/ageUtils';
import { sortTasksChronologically } from '../utils/timeUtils';

interface PatientDashboardProps {
  patient: PatientProfile;
  tasks: TaskItem[];
  language: Language;
  onOpenPhotos: () => void;
  onOpenGames: () => void;
  onOpenCalm: () => void;
  onOpenCalling: () => void;
  onOpenRoutine: () => void;
  onOpenVoiceNotes: () => void;
  onOpenMusic: () => void;
  onOpenSOS: () => void;
  onOpenMoodTracker: () => void;
  onOpenMemoryLane: () => void;
  onOpenCalmCorner: () => void;
  onOpenMedicationTracker: () => void;
  onOpenFamilyConnect: () => void;
  onOpenTaskReminder: (task: TaskItem) => void;
  onConfirmTask: (taskId: string) => void;
  onSnoozeTask: (taskId: string) => void;
  onOpenSettings: () => void;
  onOpenVoiceCompanion: () => void;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  patient,
  tasks,
  language,
  onOpenPhotos,
  onOpenGames,
  onOpenCalm,
  onOpenCalling,
  onOpenRoutine,
  onOpenVoiceNotes,
  onOpenMusic,
  onOpenSOS,
  onOpenMoodTracker,
  onOpenMemoryLane,
  onOpenCalmCorner,
  onOpenMedicationTracker,
  onOpenFamilyConnect,
  onOpenTaskReminder,
  onConfirmTask,
  onSnoozeTask,
  onOpenSettings,
  onOpenVoiceCompanion
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<CaregiverConnectionRequest[]>([]);
  const t = translations[language];

  // Automatic Voice Announcement and Notification Logic
  useEffect(() => {
    if (!patient.voiceSettings?.enabled) return;

    // Request notification permission on mount if not already granted
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    const notifiedState = new Map<string, { tenMin: boolean; due: boolean }>();

    const interval = setInterval(() => {
      const now = new Date();
      
      tasks.forEach(task => {
        if (task.completed || task.status === 'completed') return;
        
        const taskTime = new Date(task.time);
        const timeDiffMinutes = (taskTime.getTime() - now.getTime()) / (1000 * 60);

        const state = notifiedState.get(task.id) || { tenMin: false, due: false };

        // 1. Exact Time Announcement
        if (timeDiffMinutes <= 0 && timeDiffMinutes > -1 && !state.due) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Task Due Now', { body: `It is time for: ${task.title}` });
          }
          
          const announcement = `Hello, it is time for: ${task.title}. ${task.description || ''}`;
          speakText(announcement, patient.voiceSettings?.language || 'en');
          
          state.due = true;
        } 
        // 2. 10 Minute Warning
        else if (timeDiffMinutes > 0 && timeDiffMinutes <= 10 && !state.tenMin) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Upcoming Task', { body: `${task.title} is starting in 10 minutes.` });
          }
          state.tenMin = true;
        }

        notifiedState.set(task.id, state);
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [tasks, patient.voiceSettings]);

  // Real-time listener for pending caregiver connection requests (onSnapshot)
  useEffect(() => {
    const pUid = patient.uid || '';
    const pId = patient.id || '';

    console.log('[PatientDashboard] Registering real-time onSnapshot listener for pending requests. pUid:', pUid, 'pId:', pId);
    const unsubscribe = authService.subscribeToPendingRequestsForPatient(
      pUid,
      pId,
      (requests) => {
        setPendingRequests(requests);
      },
      (err) => {
        console.warn('Real-time connection listener notice:', err);
      }
    );

    return () => {
      console.log('[PatientDashboard] Unsubscribing real-time request listener.');
      unsubscribe();
    };
  }, [patient.uid, patient.id]);

  const handleRespondRequest = async (req: CaregiverConnectionRequest, approve: boolean) => {
    try {
      await authService.respondToConnectionRequest(req, approve);
      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
      if (approve) {
        alert(`Connection approved! Caregiver ${req.caregiverName} is now connected to your account.`);
      } else {
        alert(`Connection request from ${req.caregiverName} was declined.`);
      }
    } catch (err) {
      alert('Could not update connection request. Please try again.');
    }
  };

  // The most prominent upcoming task sorted chronologically, strictly excluding completed tasks
  const sortedTasks = sortTasksChronologically(tasks);
  const nextTask = sortedTasks.find((t) => !t.completed && t.status !== 'completed');

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(patient.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleVoiceNextTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nextTask) {
      speakText(`${t.nextTask}: ${nextTask.title}. Scheduled for ${nextTask.time}.`, language);
    }
  };

  const handleQuickMarkDone = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    playChime();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 }
    });
    onConfirmTask(taskId);
  };

  const handleQuickSnooze = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    onSnoozeTask(taskId);
  };

  // Completed count for daily progress
  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = Math.round((completedCount / (tasks.length || 1)) * 100);

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#F8F7F0] pb-24 sm:pb-12 pt-4 px-4 sm:px-6 max-w-3xl mx-auto space-y-6">
      
      {/* Caregiver Pending Connection Approval Banner */}
      {pendingRequests.length > 0 && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-3xl shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Caregiver Connection Request Received</span>
          </div>

          {pendingRequests.map((req) => (
            <div key={req.id} className="p-3 bg-white rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <UserAvatar src={req.caregiverPhotoURL} name={req.caregiverName} size="md" />
                <div>
                  <h4 className="font-bold text-xs text-[#263238]">
                    {req.caregiverName}
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Phone: {req.caregiverPhone || 'N/A'} • Email: {req.caregiverEmail || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleRespondRequest(req, true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#3B664B] hover:bg-[#2D4F3B] text-white text-xs font-bold cursor-pointer"
                >
                  Approve Access
                </button>

                <button
                  type="button"
                  onClick={() => handleRespondRequest(req, false)}
                  className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}



      {/* Top Greeting matching Section 2 */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#263238] font-['Poppins'] flex items-center space-x-2">
          <span>Good morning, {(patient?.name || 'Patient').split(' ')[0]}!</span>
        </h1>
      </div>

      {/* Patient Info Card matching Section 2 */}
      <div 
        onClick={onOpenSettings}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#D8EAF5]/90 via-[#A8C9B0]/40 to-[#EBF3EE] p-4 sm:p-5 border border-[#A8C9B0]/40 shadow-xs flex items-center justify-between cursor-pointer group hover:shadow-md transition-all"
      >
        <div className="flex items-center space-x-4 relative z-10">
          <UserAvatar src={patient.avatar} name={patient.name} size="lg" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-[#263238]">
                {t.patientId}: {patient.id}
              </span>
              <button
                onClick={handleCopyId}
                className="p-1 rounded-md bg-white/70 hover:bg-white text-gray-600 transition-colors"
                title="Copy Patient ID"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-green-700" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs font-semibold text-gray-600 mt-0.5">
              {t.age}: {calculateAgeFromDob(patient.dateOfBirth || patient.age)} | {t.bloodGroup}: <span className="text-red-700 font-bold">{patient.bloodGroup}</span>
            </p>
            {patient.caregiverName && patient.caregiverName !== 'Not added yet' && (
              <p className="text-[11px] font-medium text-[#2D4F3B] mt-1 bg-white/80 px-2 py-0.5 rounded-md inline-block border border-gray-200">
                Caregiver: <strong className="text-[#263238]">{patient.caregiverName}</strong> {patient.caregiverPhone && patient.caregiverPhone !== 'Not added yet' ? `(${patient.caregiverPhone})` : ''}
              </p>
            )}
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-700 group-hover:translate-x-1 transition-all" />
      </div>

      {/* AI VOICE COMPANION HERO BANNER matching Section 1 */}
      <div 
        onClick={onOpenVoiceCompanion}
        className="bg-gradient-to-r from-[#EBF3EE] via-[#F4FAF6] to-[#E7DFFA]/40 rounded-3xl p-4 sm:p-5 border-2 border-[#A8C9B0] shadow-xs hover:shadow-md transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3.5">
            <div className="relative">
              <div className="w-13 h-13 rounded-2xl bg-[#3B664B] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Mic className="w-7 h-7 text-[#A8C9B0]" />
              </div>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm sm:text-base text-[#263238] font-['Poppins']">
                  KeenKeep Voice Companion
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#A8C9B0]/30 text-[#2D4F3B] text-[10px] font-bold">
                  AI Assistant
                </span>
              </div>
              <p className="text-xs text-[#4B7358] font-medium mt-0.5">
                Tap anywhere or press Speak to talk naturally
              </p>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenVoiceCompanion();
            }}
            className="px-4 py-2.5 rounded-2xl bg-[#3B664B] hover:bg-[#2D4F3B] text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 shrink-0 group-hover:shadow-md transition-all cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>Speak</span>
          </button>
        </div>

        {/* Suggestion prompt preview pills */}
        <div className="mt-3 pt-2.5 border-t border-[#A8C9B0]/30 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px] font-medium text-gray-600">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider shrink-0">Try asking:</span>
          <span className="bg-white/80 px-2.5 py-1 rounded-xl shrink-0 border border-gray-200/60">&ldquo;What is my next task?&rdquo;</span>
          <span className="bg-white/80 px-2.5 py-1 rounded-xl shrink-0 border border-gray-200/60">&ldquo;Call my daughter&rdquo;</span>
          <span className="bg-white/80 px-2.5 py-1 rounded-xl shrink-0 border border-gray-200/60">&ldquo;Play relaxing music&rdquo;</span>
        </div>
      </div>

      {/* NEXT TASK (Most Prominent Element) matching Section 2 */}
      {nextTask ? (
        <div 
          onClick={() => onOpenTaskReminder(nextTask)}
          className="relative bg-white rounded-3xl p-5 sm:p-6 shadow-md border-2 border-[#A8C9B0]/60 cursor-pointer hover:shadow-lg transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#4B7358] uppercase tracking-wider">
              <Clock className="w-4 h-4 text-[#A8C9B0]" />
              <span>{t.nextTask} ⏰</span>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#A8C9B0]/25 text-[#2D4F3B]">
              {nextTask.time}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#F8F7F0] flex items-center justify-center text-red-500 shrink-0 mt-0.5 group-hover:bg-[#EEF6FB] transition-colors">
                <Pill className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#263238] font-['Poppins']">
                  {nextTask.title}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Scheduled time: {nextTask.time} • Tap to view confirmation
                </p>
              </div>
            </div>

            {/* Quick Action Buttons matching Section 2 */}
            <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
              <button
                onClick={handleVoiceNextTask}
                className="p-3 rounded-2xl bg-[#F8F7F0] text-[#3B664B] hover:bg-[#A8C9B0]/30 transition-colors"
                title="Play voice reminder aloud"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </button>

              <button
                onClick={(e) => handleQuickMarkDone(e, nextTask.id)}
                className="px-4 py-2.5 rounded-2xl bg-[#3B664B] hover:bg-[#2D4F3B] text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
              >
                Mark Done
              </button>

              <button
                onClick={(e) => handleQuickSnooze(e, nextTask.id)}
                className="px-3 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-all"
              >
                Snooze
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-200/80 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#A8C9B0]/20 text-[#2D4F3B] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-[#3B664B]" />
          </div>
          <h3 className="text-base font-bold text-[#263238]">No tasks remaining.</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            All scheduled routines and medications are completed for now!
          </p>
        </div>
      )}

      {/* FOUR PRIMARY ACTION CARDS (2x2 Grid) matching Section 2 */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* 1. Photos */}
        <button
          onClick={onOpenPhotos}
          className="group bg-white hover:bg-[#F2F7FB] border border-gray-100 hover:border-[#A0CDE8] rounded-3xl p-5 text-left shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[140px]"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#D8EAF5] text-[#1E4D6B] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-[#263238] font-['Poppins']">
              {t.photos}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {t.photosDesc}
            </p>
          </div>
        </button>

        {/* 2. Games */}
        <button
          onClick={onOpenGames}
          className="group bg-white hover:bg-[#F2F8F4] border border-gray-100 hover:border-[#A8C9B0] rounded-3xl p-5 text-left shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[140px]"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#A8C9B0]/35 text-[#2D4F3B] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-[#263238] font-['Poppins']">
              {t.games}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {t.gamesDesc}
            </p>
          </div>
        </button>

        {/* 3. Calm */}
        <button
          onClick={onOpenCalmCorner}
          className="group bg-white hover:bg-[#F8F5FE] border border-gray-100 hover:border-[#D5C6F5] rounded-3xl p-5 text-left shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[140px]"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#E7DFFA] text-[#4A3B69] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Flower2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-[#263238] font-['Poppins']">
              {t.calm}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {t.calmDesc}
            </p>
          </div>
        </button>

        {/* 4. Calling */}
        <button
          onClick={onOpenFamilyConnect}
          className="group bg-white hover:bg-[#EFFBF9] border border-gray-100 hover:border-[#86DCD0] rounded-3xl p-5 text-left shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[140px]"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#D4F4EE] text-[#1B675B] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-[#263238] font-['Poppins']">
              {t.calling}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {t.callingDesc}
            </p>
          </div>
        </button>

      </div>

      {/* PATIENT FEATURES GRID matching Section 2 middle strip */}
      <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Patient Features
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          
          {/* Mood Tracker */}
          <button
            onClick={onOpenMoodTracker}
            className="p-3 rounded-2xl bg-[#F8F7F0] hover:bg-[#EEF6FB] transition-all text-left flex items-start space-x-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Smile className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#263238] block">Mood Tracker</span>
              <span className="text-[10px] text-gray-400">5 moods + trends</span>
            </div>
          </button>

          {/* Memory Lane */}
          <button
            onClick={onOpenMemoryLane}
            className="p-3 rounded-2xl bg-[#F8F7F0] hover:bg-[#EEF6FB] transition-all text-left flex items-start space-x-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#263238] block">Memory Lane</span>
              <span className="text-[10px] text-gray-400">Photos, faces, dates</span>
            </div>
          </button>

          {/* Calm Corner */}
          <button
            onClick={onOpenCalmCorner}
            className="p-3 rounded-2xl bg-[#F8F7F0] hover:bg-[#EEF6FB] transition-all text-left flex items-start space-x-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Flower2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#263238] block">Calm Corner</span>
              <span className="text-[10px] text-gray-400">Breathing &amp; sounds</span>
            </div>
          </button>

          {/* Medication Tracker */}
          <button
            onClick={onOpenMedicationTracker}
            className="p-3 rounded-2xl bg-[#F8F7F0] hover:bg-[#EEF6FB] transition-all text-left flex items-start space-x-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <Pill className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#263238] block">Medication Tracker</span>
              <span className="text-[10px] text-gray-400">Confirm, refill</span>
            </div>
          </button>

          {/* Family Connect */}
          <button
            onClick={onOpenFamilyConnect}
            className="p-3 rounded-2xl bg-[#F8F7F0] hover:bg-[#EEF6FB] transition-all text-left flex items-start space-x-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#263238] block">Family Connect</span>
              <span className="text-[10px] text-gray-400">Calls, video, visits</span>
            </div>
          </button>

          {/* Voice Notes */}
          <button
            onClick={onOpenVoiceNotes}
            className="p-3 rounded-2xl bg-[#F8F7F0] hover:bg-[#EEF6FB] transition-all text-left flex items-start space-x-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-[#A8C9B0]/30 text-[#2D4F3B] flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#263238] block">Voice Notes</span>
              <span className="text-[10px] text-gray-400">Record &amp; listen</span>
            </div>
          </button>

          {/* Daily Progress */}
          <button
            onClick={onOpenRoutine}
            className="p-3 rounded-2xl bg-[#F8F7F0] hover:bg-[#EEF6FB] transition-all text-left flex items-start space-x-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-green-100 text-green-700 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#263238] block">Daily Progress</span>
              <span className="text-[10px] text-gray-400">{progressPercent}% completed</span>
            </div>
          </button>

          {/* Family Messages */}
          <button
            onClick={onOpenMemoryLane}
            className="p-3 rounded-2xl bg-[#F8F7F0] hover:bg-[#EEF6FB] transition-all text-left flex items-start space-x-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#263238] block">Family Messages</span>
              <span className="text-[10px] text-gray-400">Updates &amp; birthdays</span>
            </div>
          </button>

        </div>
      </div>

      {/* Location Sharing Toggle */}
      <LocationSharingToggle patient={patient} />

      {/* PROMINENT RED EMERGENCY SOS BUTTON matching Section 2 bottom */}
      <button
        onClick={onOpenSOS}
        className="w-full py-4 px-6 rounded-3xl bg-[#F16F6F] hover:bg-red-600 text-white font-black text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-3 active:scale-[0.98] cursor-pointer animate-sos-pulse"
      >
        <span className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center text-white text-sm font-black">
          SOS
        </span>
        <span className="tracking-wide">SOS — Help is always here</span>
      </button>

      {/* Bottom Sticky Mobile Navigation matching Section 2 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 px-6 py-2 z-20 sm:hidden">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button
            onClick={() => {}}
            className="flex flex-col items-center py-1 text-[#2D4F3B]"
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-0.5">{t.navHome}</span>
          </button>
          <button
            onClick={onOpenRoutine}
            className="flex flex-col items-center py-1 text-gray-400 hover:text-gray-700"
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-0.5">{t.navRoutine}</span>
          </button>
          <button
            onClick={onOpenPhotos}
            className="flex flex-col items-center py-1 text-gray-400 hover:text-gray-700"
          >
            <ImageIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-0.5">{t.navPhotos}</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="flex flex-col items-center py-1 text-gray-400 hover:text-gray-700"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-0.5">{t.navMore}</span>
          </button>
        </div>
      </div>

      {/* PERMANENT FLOATING MICROPHONE BUTTON matching Section 1 */}
      <div className="fixed bottom-20 sm:bottom-8 right-4 sm:right-8 z-30">
        <button
          onClick={onOpenVoiceCompanion}
          className="group relative flex items-center bg-[#3B664B] hover:bg-[#2D4F3B] text-white p-3.5 sm:p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border-2 border-white ring-4 ring-[#A8C9B0]/40"
          title="Open AI Voice Companion"
        >
          <div className="relative">
            <Mic className="w-6 h-6 sm:w-7 sm:h-7" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap text-xs font-bold pl-0 group-hover:pl-2">
            Ask KeenKeep
          </span>
        </button>
      </div>

    </div>
  );
};
