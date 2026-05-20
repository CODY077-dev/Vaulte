import { db } from '../firebase';
import {
  collection, doc, setDoc, getDocs, deleteDoc,
  onSnapshot, serverTimestamp
} from 'firebase/firestore';

export default class FirestoreService {
  static async saveEvent(event: any) {
    await setDoc(doc(db, 'events', String(event.id)), { ...event, updatedAt: serverTimestamp() });
  }
  static async deleteEvent(eventId: string) {
    await deleteDoc(doc(db, 'events', String(eventId)));
  }
  static async getAllEvents(): Promise<any[]> {
    const snap = await getDocs(collection(db, 'events'));
    return snap.docs.map(d => d.data());
  }
  static onEventsChange(callback: (events: any[]) => void) {
    return onSnapshot(collection(db, 'events'), snap => {
      callback(snap.docs.map(d => d.data()));
    });
  }
  static async saveAttendance(eventId: string, userId: string, data: any) {
    await setDoc(doc(db, 'attendance', `${eventId}_${userId}`), {
      eventId, userId, ...data, updatedAt: serverTimestamp()
    });
  }
  static async getAllAttendance(): Promise<any[]> {
    const snap = await getDocs(collection(db, 'attendance'));
    return snap.docs.map(d => d.data());
  }
  static async saveAnnouncement(announcement: any) {
    await setDoc(doc(db, 'announcements', String(announcement.id)), {
      ...announcement, updatedAt: serverTimestamp()
    });
  }
  static async getAllAnnouncements(): Promise<any[]> {
    const snap = await getDocs(collection(db, 'announcements'));
    return snap.docs.map(d => d.data());
  }
}
