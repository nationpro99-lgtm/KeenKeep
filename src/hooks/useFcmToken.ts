import { useEffect, useState } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging, firestore } from '../services/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { auth } from '../services/firebase';

export const useFcmToken = () => {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const registerToken = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const currentToken = await getToken(messaging, {
            vapidKey: 'BOCx-5WC_ATnHF2TJE2MamQY' // Need to ensure this matches the Firebase project VAPID key
          });
          if (currentToken) {
            setToken(currentToken);
            // Save token to user profile
            if (auth.currentUser) {
              const userRef = doc(firestore, 'users', auth.currentUser.uid);
              await updateDoc(userRef, {
                fcmTokens: arrayUnion(currentToken)
              });
            }
          }
        }
      } catch (err) {
        console.error('Error getting FCM token:', err);
      }
    };

    registerToken();
  }, []);

  return token;
};
