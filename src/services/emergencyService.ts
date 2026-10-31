import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { firestore, handleFirestoreError, OperationType } from './firebase';
import { EmergencyAlertItem } from '../types';

export const emergencyService = {
  /**
   * Real-time listener for emergency / SOS alerts onSnapshot (only active alerts)
   */
  subscribeToEmergencyAlerts(
    patientId: string,
    onUpdate: (alerts: EmergencyAlertItem[]) => void,
    onError?: (err: any) => void
  ): () => void {
    if (!patientId) {
      onUpdate([]);
      return () => {};
    }

    const formattedId = patientId.trim().toUpperCase();
    console.log(`[EmergencyService] Subscribing to real-time SOS alerts for patientId: "${formattedId}"`);

    const q = query(
      collection(firestore, 'alerts'),
      where('patientId', '==', formattedId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: EmergencyAlertItem[] = [];
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status === 'active') {
            list.push({
              id: data.id || docSnap.id,
              patientId: data.patientId || formattedId,
              patientName: data.patientName || 'Patient',
              time: data.time || 'Just now',
              timestamp: data.timestamp || new Date().toISOString(),
              status: 'active',
              location: data.location || 'Patient location unavailable',
              latitude: data.latitude ?? undefined,
              longitude: data.longitude ?? undefined,
              accuracyMeters: data.accuracyMeters ?? undefined,
              hasVoiceNote: data.hasVoiceNote ?? false,
              resolvedAt: data.resolvedAt
            });
          }
        });

        console.log(`[EmergencyService] Received ${list.length} active alert record(s) from Firestore.`);
        onUpdate(list);
      },
      (error) => {
        console.error('[EmergencyService] Alerts snapshot error:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  },

  /**
   * Trigger SOS alert in Firestore with real device geolocation
   */
  async triggerSOS(params: {
    patientId: string;
    patientUid?: string;
    patientName: string;
  }): Promise<string> {
    const alertId = `sos-${params.patientId.toUpperCase()}-${Date.now()}`;
    const path = `alerts/${alertId}`;
    const nowIso = new Date().toISOString();

    let lat: number | null = null;
    let lng: number | null = null;
    let accuracy: number | null = null;
    let locationStr = 'Patient location unavailable';

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0
          });
        } else {
          reject(new Error('Geolocation not supported'));
        }
      });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
      accuracy = Math.round(position.coords.accuracy);
      locationStr = `GPS ±${accuracy}m (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    } catch (e) {
      console.warn('[EmergencyService] Geolocation unavailable or denied during SOS trigger:', e);
      locationStr = 'Patient location unavailable';
    }

    const alertDoc: EmergencyAlertItem = {
      id: alertId,
      patientId: params.patientId.toUpperCase(),
      patientName: params.patientName,
      time: 'Just now',
      timestamp: nowIso,
      status: 'active',
      hasVoiceNote: false,
      location: locationStr,
      latitude: lat ?? 0,
      longitude: lng ?? 0,
      accuracyMeters: accuracy ?? 0
    };

    try {
      console.log('[EmergencyService] Triggering real SOS Alert in Firestore:', alertDoc);
      await setDoc(doc(firestore, 'alerts', alertId), alertDoc);

      // Update patient document status to 'sos_alert'
      try {
        await updateDoc(doc(firestore, 'patients', params.patientId.toUpperCase()), {
          status: 'sos_alert',
          currentLatitude: lat ?? null,
          currentLongitude: lng ?? null,
          locationAccuracy: accuracy ?? null,
          updatedAt: nowIso
        });
      } catch (e) {
        console.warn('Patient index status update note:', e);
      }

      if (params.patientUid) {
        try {
          await updateDoc(doc(firestore, 'users', params.patientUid), {
            status: 'sos_alert',
            currentLatitude: lat ?? null,
            currentLongitude: lng ?? null,
            updatedAt: nowIso
          });
        } catch (e) {
          console.warn('Patient user status update note:', e);
        }
      }

      return alertId;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  /**
   * Update active SOS alert and patient document with real-time coordinates from watchPosition
   */
  async updateSOSLocation(patientId: string, lat: number, lng: number, accuracy: number): Promise<void> {
    const formattedId = patientId.trim().toUpperCase();
    const nowIso = new Date().toISOString();
    const locationStr = `GPS ±${accuracy}m (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

    try {
      await updateDoc(doc(firestore, 'patients', formattedId), {
        status: 'sos_alert',
        currentLatitude: lat,
        currentLongitude: lng,
        locationAccuracy: accuracy,
        updatedAt: nowIso
      });

      const q = query(
        collection(firestore, 'alerts'),
        where('patientId', '==', formattedId)
      );
      const snap = await onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(async (docSnap) => {
          const dData = docSnap.data();
          if (dData.status === 'active') {
            await updateDoc(doc(firestore, 'alerts', docSnap.id), {
              latitude: lat,
              longitude: lng,
              accuracyMeters: accuracy,
              location: locationStr,
              timestamp: nowIso
            });
          }
        });
      });
      setTimeout(() => snap(), 1500);
    } catch (e) {
      console.warn('[EmergencyService] updateSOSLocation error:', e);
    }
  },

  /**
   * Resolve active SOS alert in Firestore
   */
  async resolveSOS(patientId: string, resolvedBy: string = 'Caregiver'): Promise<void> {
    const formattedId = patientId.trim().toUpperCase();
    const nowIso = new Date().toISOString();

    try {
      // 1. Update patient index status to 'all_good'
      try {
        await updateDoc(doc(firestore, 'patients', formattedId), {
          status: 'all_good',
          currentLatitude: null,
          currentLongitude: null,
          updatedAt: nowIso
        });
      } catch (e) {
        console.warn('Patient index status resolution note:', e);
      }

      // 2. Find and update active alerts in 'alerts' collection
      const q = query(
        collection(firestore, 'alerts'),
        where('patientId', '==', formattedId)
      );
      const snap = await onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(async (docSnap) => {
          const dData = docSnap.data();
          if (dData.status === 'active') {
            await updateDoc(doc(firestore, 'alerts', docSnap.id), {
              status: 'resolved',
              resolvedBy,
              resolvedAt: nowIso
            });
          }
        });
      });
      setTimeout(() => snap(), 2000);

      console.log(`[EmergencyService] SOS emergency resolved for patient ${formattedId} by ${resolvedBy}.`);
    } catch (error) {
      console.warn('resolveSOS error:', error);
    }
  }
};
