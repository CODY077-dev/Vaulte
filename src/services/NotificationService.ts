import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import app from '../firebase';

class NotificationService {
  private messaging: any = null;
  private initialized = false;

  async init(): Promise<boolean> {
    try {
      const supported = await isSupported();
      if (!supported) {
        console.warn('[FCM] Messaging not supported in this browser');
        return false;
      }
      this.messaging = getMessaging(app);
      this.initialized = true;
      return true;
    } catch (e) {
      console.warn('[FCM] Init failed:', e);
      return false;
    }
  }

  async requestPermission(userId: string): Promise<string | null> {
    if (!this.initialized) {
      const ok = await this.init();
      if (!ok) return null;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[FCM] Permission denied');
        return null;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      const token = await getToken(this.messaging, {
        vapidKey: 'BEeXqTuoctkEkoPWZixqirFuoIOkVLwU-1uGymXQ0at0PWYp0UBXzEOO5pXv19iBecFWqySo33kRdAhmm3Ug1s8',
        serviceWorkerRegistration: registration,
      });

      if (token) {
        // Save token to Firestore for this user
        await setDoc(doc(db, 'fcmTokens', userId), {
          token,
          userId,
          platform: this.getPlatform(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        console.log('[FCM] Token saved for user:', userId);
        localStorage.setItem('gameday_fcm_token', token);
        return token;
      }
      return null;
    } catch (e) {
      console.error('[FCM] Token request failed:', e);
      return null;
    }
  }

  onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
    if (!this.messaging) return null;
    return onMessage(this.messaging, (payload) => {
      callback(payload);
    });
  }

  private getPlatform(): string {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    return 'web';
  }

  isPermissionGranted(): boolean {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  }

  hasToken(): boolean {
    return !!localStorage.getItem('gameday_fcm_token');
  }
}

export default new NotificationService();
