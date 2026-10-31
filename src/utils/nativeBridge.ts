/**
 * Native Bridge for Android Integration
 * Enables communication between Web (React) and Native (Android Kotlin/Java)
 */

export const nativeBridge = {
  // Check if we are running inside the Android wrapper
  isNative: (): boolean => {
    return typeof (window as any).Android !== 'undefined';
  },

  // Tell Android to schedule a TTS reminder at a specific time
  scheduleReminder: (taskId: string, title: string, time: string) => {
    if (nativeBridge.isNative()) {
      console.log(`[NativeBridge] Scheduling native reminder: ${title} for ${time}`);
      (window as any).Android.scheduleReminder(taskId, title, time);
    } else {
      console.warn('[NativeBridge] Native bridge not found (Standard Web Mode)');
    }
  }
};
