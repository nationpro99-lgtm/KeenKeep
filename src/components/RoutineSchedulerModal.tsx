import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Clock, 
  Pill, 
  Activity, 
  Coffee, 
  Volume2, 
  Check, 
  AlertCircle, 
  Calendar, 
  CheckCircle2, 
  Loader2, 
  User 
} from 'lucide-react';
import { TaskItem, PatientProfile } from '../types';
import { taskService } from '../services/taskService';

interface RoutineSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskItem[];
  activePatient: PatientProfile;
  connectedPatients?: PatientProfile[];
  onAddTask: (newTask: TaskItem) => void;
  onDeleteTask: (taskId: string) => void;
  caregiverUid?: string;
  caregiverName?: string;
}

export const RoutineSchedulerModal: React.FC<RoutineSchedulerModalProps> = ({
  isOpen,
  onClose,
  tasks,
  activePatient,
  connectedPatients = [],
  onAddTask,
  onDeleteTask,
  caregiverUid,
  caregiverName
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Available connected patients list (fallback to activePatient if connectedPatients is empty)
  const availablePatients = connectedPatients.length > 0 
    ? connectedPatients 
    : (activePatient && activePatient.name ? [activePatient] : []);

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    activePatient?.id || availablePatients[0]?.id || ''
  );

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [category, setCategory] = useState<'medicine' | 'exercise' | 'calm' | 'meal' | 'activity'>('medicine');
  const [dosage, setDosage] = useState('');
  const [notes, setNotes] = useState('');
  const [enableVoice, setEnableVoice] = useState(true);

  // Async Save & Feedback State
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Sync selectedPatientId when activePatient or availablePatients change
  useEffect(() => {
    if (activePatient?.id) {
      setSelectedPatientId(activePatient.id);
    } else if (availablePatients.length > 0) {
      setSelectedPatientId(availablePatients[0].id);
    }
  }, [activePatient?.id, availablePatients.length]);

  if (!isOpen) return null;

  const targetPatient = availablePatients.find(p => p.id === selectedPatientId) || activePatient;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    // 1. Validation
    if (!title.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a task title.' });
      return;
    }

    if (!dueTime.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a due time.' });
      return;
    }

    if (!selectedPatientId || !targetPatient) {
      setFeedback({ type: 'error', message: 'Please select a valid connected patient.' });
      return;
    }

    if (!caregiverUid) {
      setFeedback({ type: 'error', message: 'You must be authenticated as a caregiver to assign tasks.' });
      return;
    }

    setIsSaving(true);
    setFeedback({ type: 'info', message: 'Saving task to Firebase...' });

    try {
      const taskId = `task-${Date.now()}`;
      const newTask: TaskItem = {
        id: taskId,
        patientId: targetPatient.id,
        patientUid: targetPatient.uid || '',
        caregiverUid: caregiverUid,
        assignedBy: caregiverUid,
        assignedByName: caregiverName || 'Caregiver',
        title: title.trim(),
        description: description.trim() || undefined,
        // Combine date and time into a single ISO timestamp
        time: new Date(`${dueDate}T${dueTime}`).toISOString(),
        dueDate: dueDate,
        dueTime: dueTime,
        priority: priority,
        category: category,
        dosage: dosage.trim() || undefined,
        notes: (notes.trim() || description.trim()) || undefined,
        voiceReminderText: enableVoice
          ? `Hi ${targetPatient.name}, it's time for ${title}.`
          : '',
        completed: false,
        snoozed: false,
        status: 'upcoming',
        createdBy: 'caregiver',
        source: 'caregiver_created'
      };

      // Write directly to Firestore & wait for server confirmation
      await taskService.createTask(newTask);

      // Confirmation feedback
      setFeedback({
        type: 'success',
        message: `Task created successfully! Task assigned to ${targetPatient.name}.`
      });

      onAddTask(newTask);

      // Reset form after short delay so caregiver sees confirmation
      setTimeout(() => {
        setIsSaving(false);
        setShowAddForm(false);
        setFeedback(null);
        setTitle('');
        setDescription('');
        setDosage('');
        setNotes('');
      }, 1200);

    } catch (err: any) {
      console.error('[RoutineSchedulerModal] Error saving task to Firestore:', err);
      setIsSaving(false);
      setFeedback({
        type: 'error',
        message: `Failed to save task: ${err?.message || 'Permission or network error.'}`
      });
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      onDeleteTask(taskId);
      await taskService.deleteTask(taskId);
    } catch (err: any) {
      console.error('[RoutineSchedulerModal] Error deleting task:', err);
    }
  };

  const getStatusBadgeUI = (task: TaskItem) => {
    const calcStatus = taskService.getCalculatedStatus(task);
    switch (calcStatus) {
      case 'Completed':
        return (
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
            ✓ Completed
          </span>
        );
      case 'In Progress':
        return (
          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
            ⌛ In Progress
          </span>
        );
      case 'Overdue':
        return (
          <span className="text-[10px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded-md border border-red-200">
            ⚠️ Overdue
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200">
            📋 Pending
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto">
        
        {/* Header - Fixed Height */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-[#F8F7F0] shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-700 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#263238] font-['Poppins']">
                Routine Scheduler &amp; Task Assignment
              </h2>
              <p className="text-xs text-gray-500">
                {targetPatient?.name ? `Assigning schedule for ${targetPatient.name} (${targetPatient.id})` : 'Connected Patient Tasks'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setFeedback(null);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#3B664B] hover:bg-[#2D4F3B] text-white text-xs font-semibold flex items-center space-x-1 shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'View Tasks' : 'Add Routine'}</span>
          </button>
        </div>

        {/* Scrollable Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Feedback Banner */}
          {feedback && (
            <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center space-x-2 border transition-all ${
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' :
              feedback.type === 'error' ? 'bg-red-50 text-red-900 border-red-300' :
              'bg-blue-50 text-blue-900 border-blue-300'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : feedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Add Task Form - Fully Scrollable */}
          {showAddForm && (
            <form onSubmit={handleSave} className="p-4 sm:p-5 bg-[#EEF6FB] border border-[#A0CDE8] rounded-2xl space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between pb-1 border-b border-gray-200/80">
                <h4 className="text-xs font-bold text-[#1E4D6B] uppercase tracking-wider flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-[#3B664B]" />
                  <span>Assign New Task to Patient</span>
                </h4>
                <span className="text-[10px] text-gray-500 font-semibold">Real-Time Firebase Sync</span>
              </div>
              
              {/* 1. Select Patient Dropdown */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  Select Connected Patient <span className="text-red-500">*</span>
                </label>
                {availablePatients.length === 0 ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                    No connected patients available. Please connect a patient first using their Patient ID.
                  </div>
                ) : (
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-xl font-bold text-[#263238] focus:ring-2 focus:ring-[#A8C9B0]"
                    required
                  >
                    {availablePatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.id})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. Task Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    Task Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Morning Blood Pressure Tablet"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-[#A8C9B0]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Task Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-xl font-medium"
                  >
                    <option value="medicine">Medicine / Supplement</option>
                    <option value="exercise">Exercise / Stroll</option>
                    <option value="calm">Calm / Breathing</option>
                    <option value="meal">Nutritious Meal</option>
                    <option value="activity">Social / Mind Activity</option>
                  </select>
                </div>
              </div>

              {/* 3. Task Description */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">Task Description / Instructions</label>
                <textarea
                  placeholder="e.g. Take 1 tablet with warm water 30 minutes after breakfast."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-xl font-medium min-h-[60px]"
                  rows={2}
                />
              </div>

              {/* 4. Due Date, Due Time, Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Due Time</label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-xl font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-xl font-medium"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent Priority</option>
                  </select>
                </div>
              </div>

              {/* 5. Dosage / Details */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">Dosage / Additional Details</label>
                <input
                  type="text"
                  placeholder="e.g. 1 Capsule • 500mg"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-xl font-medium"
                />
              </div>

              {/* Voice Toggle & Footer Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-200/80">
                <label className="flex items-center space-x-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableVoice}
                    onChange={(e) => setEnableVoice(e.target.checked)}
                    className="rounded text-[#3B664B] focus:ring-[#A8C9B0]"
                  />
                  <Volume2 className="w-3.5 h-3.5 text-[#3B664B]" />
                  <span>Speak reminder aloud automatically</span>
                </label>

                <div className="flex items-center space-x-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setFeedback(null);
                    }}
                    disabled={isSaving}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-200 cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || availablePatients.length === 0}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#3B664B] text-white hover:bg-[#2D4F3B] shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSaving ? 'Saving task...' : 'Save Task'}</span>
                  </button>
                </div>
              </div>

            </form>
          )}

          {/* Existing Assigned Tasks List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Assigned Tasks for {targetPatient?.name || 'Patient'} ({tasks.length})
              </h4>
            </div>

            {tasks.length === 0 ? (
              <div className="p-8 text-center bg-[#F8F7F0] rounded-2xl border border-gray-200">
                <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-600">
                  No tasks assigned to {targetPatient?.name || 'this patient'} yet.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Click &ldquo;Add Routine&rdquo; above to assign tasks to the patient&apos;s real-time schedule.
                </p>
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3.5 rounded-2xl bg-white border border-gray-200 shadow-xs flex items-center justify-between hover:border-[#A8C9B0] transition-colors"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-[#F8F7F0] flex items-center justify-center text-gray-700 shrink-0">
                      {task.category === 'medicine' ? (
                        <Pill className="w-5 h-5 text-red-500" />
                      ) : task.category === 'exercise' ? (
                        <Activity className="w-5 h-5 text-green-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                          {task.time}
                        </span>
                        <span className="text-xs font-bold text-[#263238]">
                          {task.title}
                        </span>
                        {getStatusBadgeUI(task)}
                      </div>
                      {task.description && (
                        <p className="text-xs text-gray-600 font-medium mt-0.5">
                          {task.description}
                        </p>
                      )}
                      {task.dosage && (
                        <p className="text-[11px] text-[#4B7358] font-medium mt-0.5">
                          Dosage: {task.dosage}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(task.id)}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
