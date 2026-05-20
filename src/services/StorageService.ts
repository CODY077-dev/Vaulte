/**
 * Persistence layer for cross-profile demo.
 * Uses localStorage to simulate shared backend.
 */

import { User } from "../types";
import FirestoreService from './FirestoreService';
import { db } from '../firebase';
import {
  doc, setDoc, deleteDoc, updateDoc, collection,
  getDocs, onSnapshot, query, where
} from 'firebase/firestore';

export interface Announcement {
  id: string;
  senderId: string;
  senderName: string;
  teamId: string | 'all';
  teamName: string;
  title: string;
  content: string;
  timestamp: string;
  editedAt?: string;
  clubId?: string;
  type?: 'attendance_reminder' | 'broadcast' | 'direct_message';
  eventId?: string;
  isReminder?: boolean;
}

export interface AttendanceRecord {
  eventId: string;
  userId: string;
  userName: string;
  status: 'going' | 'absent' | null;
  reason?: string;
  timestamp: string;
}

class StorageService {
  private static readonly ANNOUNCEMENTS_KEY = 'gameday_announcements';
  private static readonly ATTENDANCE_KEY = 'gameday_attendance';
  private static readonly EVENTS_KEY = 'gameday_events';
  private static readonly USER_PREFIX = 'gameday_user_';

  private static dispatch() {
    window.dispatchEvent(new Event('gameday_update'));
  }

  // --- User Profile ---

  static getUserData(userId: string): Partial<User> | null {
    const data = localStorage.getItem(`${this.USER_PREFIX}${userId}`);
    return data ? JSON.parse(data) : null;
  }

  static updateUserData(userId: string, data: Partial<User>): Partial<User> {
    const existing = this.getUserData(userId) || {};
    const updated = { ...existing, ...data };
    localStorage.setItem(`${this.USER_PREFIX}${userId}`, JSON.stringify(updated));
    
    // Also update the current active user if it's the same
    const currentActiveStr = localStorage.getItem('gameday_user');
    if (currentActiveStr) {
      const currentActive = JSON.parse(currentActiveStr);
      if (currentActive.id === userId) {
        localStorage.setItem('gameday_user', JSON.stringify({ ...currentActive, ...data }));
      }
    }
    
    return updated;
  }

  // --- Announcements ---

  static getAnnouncements(): Announcement[] {
    const data = localStorage.getItem(this.ANNOUNCEMENTS_KEY);
    if (!data) return [];
    
    const all: Announcement[] = JSON.parse(data);
    return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  static getClubAnnouncements(clubId: string): Announcement[] {
    const announcements = this.getAnnouncements();
    // In a real app, teams would be linked to clubId in the announcement metadata
    // For this demo, we can cross-reference the teamId with the club's teams
    return announcements; // Currently returns all, but logic can be added to filter by club's teams
  }

  static addAnnouncement(announcement: Omit<Announcement, 'id' | 'timestamp'>) {
    const announcements = this.getAnnouncements();
    const newAnnouncement: Announcement = {
      ...announcement,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
    };
    announcements.unshift(newAnnouncement);
    localStorage.setItem(this.ANNOUNCEMENTS_KEY, JSON.stringify(announcements));
    FirestoreService.saveAnnouncement(newAnnouncement).catch(console.error);
    this.dispatch();
    return newAnnouncement;
  }

  static deleteAnnouncement(announcementId: string) {
    const announcements = this.getAnnouncements();
    const updated = announcements.filter(a => a.id !== announcementId);
    localStorage.setItem(this.ANNOUNCEMENTS_KEY, JSON.stringify(updated));
    this.dispatch();
  }

  // --- Teams ---

  static getTeams(): any[] {
    const data = localStorage.getItem('gameday_teams');
    return data ? JSON.parse(data) : [];
  }

  static addTeam(team: any) {
    const teams = this.getTeams();
    teams.push(team);
    localStorage.setItem('gameday_teams', JSON.stringify(teams));
    return team;
  }

  // --- Coaches ---

  static getCoaches(): User[] {
    // In a real app, this would query a database
    // For demo, we scan localStorage for users with role === 'coach'
    const coaches: User[] = [
      { id: "coach-sarah", name: "Coach Sarah", role: "coach", clubId: "karaka-rfc", teamIds: ["1"] },
      { id: "coach-mike", name: "Coach Mike", role: "coach", clubId: "karaka-rfc", teamIds: ["2"] },
      { id: "coach-dave", name: "Coach Dave", role: "coach", clubId: "karaka-rfc", teamIds: ["3"] },
      { id: "coach-john", name: "Coach John", role: "coach", clubId: "karaka-rfc", teamIds: ["4"] },
      { id: "coach-amy", name: "Coach Amy", role: "coach", clubId: "karaka-rfc", teamIds: ["5"] },
    ];
    
    // Supplement or update hardcoded coaches with any data from localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.USER_PREFIX)) {
            const user = JSON.parse(localStorage.getItem(key) || '{}');
            if (user.role === 'coach') {
                const existingIdx = coaches.findIndex(c => c.id === user.id);
                if (existingIdx !== -1) {
                    coaches[existingIdx] = user;
                } else {
                    coaches.push(user);
                }
            }
        }
    }
    
    return coaches;
  }

  // --- Chats ---

  static getChats(): any[] {
    const data = localStorage.getItem('gameday_chats');
    return data ? JSON.parse(data) : [];
  }

  static createChat(chat: any) {
    const chats = this.getChats();
    chats.push(chat);
    localStorage.setItem('gameday_chats', JSON.stringify(chats));
    return chat;
  }

  // --- Attendance ---

  static getAttendance(): Record<string, AttendanceRecord[]> {
    const data = localStorage.getItem(this.ATTENDANCE_KEY);
    return data ? JSON.parse(data) : {};
  }

  static updateAttendance(eventId: string, userId: string, userName: string, status: 'going' | 'absent' | null, reason?: string) {
    const allAttendance = this.getAttendance();
    if (!allAttendance[eventId]) allAttendance[eventId] = [];
    
    const existingIndex = allAttendance[eventId].findIndex(a => a.userId === userId);
    if (existingIndex > -1) {
      if (status === null) {
        allAttendance[eventId].splice(existingIndex, 1);
      } else {
        allAttendance[eventId][existingIndex] = {
          ...allAttendance[eventId][existingIndex],
          status,
          reason,
          timestamp: new Date().toISOString()
        };
      }
    } else if (status !== null) {
      allAttendance[eventId].push({
        eventId,
        userId,
        userName,
        status,
        reason,
        timestamp: new Date().toISOString()
      });
    }

    localStorage.setItem(this.ATTENDANCE_KEY, JSON.stringify(allAttendance));
    FirestoreService.saveAttendance(eventId, userId, { name: userName, status }).catch(console.error);
    this.dispatch();
  }

  // --- Events ---

  static getEvents(): any[] {
    const data = localStorage.getItem(this.EVENTS_KEY);
    return data ? JSON.parse(data) : [];
  }

  static addEvent(event: any) {
    const events = this.getEvents();
    const newEvent = { ...event, id: event.id || Math.random().toString(36).substr(2, 9) };
    events.push(newEvent);
    localStorage.setItem(this.EVENTS_KEY, JSON.stringify(events));
    this.syncEventToFirestore(newEvent).catch(console.error);
    this.dispatch();
    return newEvent;
  }

  static updateEvent(eventId: string, data: any) {
    const events = this.getEvents();
    const index = events.findIndex(e => e.id === eventId);
    if (index !== -1) {
      events[index] = { ...events[index], ...data };
      localStorage.setItem(this.EVENTS_KEY, JSON.stringify(events));
      // Sync to Firestore
      this.syncEventToFirestore(events[index]).catch(console.error);
      this.dispatch();
      return events[index];
    }
    return null;
  }

  static deleteEvent(eventId: string): void {
    const events = this.getEvents().filter((e: any) => e.id !== eventId);
    localStorage.setItem(this.EVENTS_KEY, JSON.stringify(events));
    deleteDoc(doc(db, 'events', eventId)).catch(console.error);
    this.dispatch();
  }

  static getLineups(teamId: string): any[] {
    const key = `gameday_lineups_${teamId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const lineups = JSON.parse(stored);
      // Migrate old format (starting/reserves at top level OR in squads) to players array
      return lineups.map((l: any) => {
        let squads = l.squads;
        if (!squads) {
          squads = [{
            id: 'squad-1',
            name: 'Main Squad',
            starting: l.starting || [],
            reserves: l.reserves || [],
          }];
        }

        // Migrate starting/reserves to players if players is missing
        const migratedSquads = squads.map((s: any) => {
          if (!s.players) {
            const combined = [...(s.starting || []), ...(s.reserves || [])];
            const players = [...combined];
            return {
              id: s.id,
              name: s.name,
              players,
            };
          }
          return s;
        });

        return {
          ...l,
          squads: migratedSquads,
          // Clean up old top level props
          starting: undefined,
          reserves: undefined,
        };
      });
    }
    return [];
  }

  static saveLineup(teamId: string, lineup: any): void {
    const lineups = this.getLineups(teamId);
    const idx = lineups.findIndex((l: any) => l.id === lineup.id);
    if (idx >= 0) { lineups[idx] = lineup; } else { lineups.push(lineup); }
    localStorage.setItem(`gameday_lineups_${teamId}`, JSON.stringify(lineups));
    this.dispatch();
  }

  static deleteLineup(teamId: string, lineupId: string): void {
    const lineups = this.getLineups(teamId).filter((l: any) => l.id !== lineupId);
    localStorage.setItem(`gameday_lineups_${teamId}`, JSON.stringify(lineups));
    this.dispatch();
  }

  // --- Lineup Archive ---

  static getArchivedLineups(teamId: string): any[] {
    const data = localStorage.getItem(`gameday_archived_lineups_${teamId}`);
    return data ? JSON.parse(data) : [];
  }

  static archiveLineup(teamId: string, snapshot: any): void {
    const archived = this.getArchivedLineups(teamId);
    if (archived.find((a: any) => a.id === snapshot.id)) return;
    archived.unshift(snapshot);
    localStorage.setItem(`gameday_archived_lineups_${teamId}`, JSON.stringify(archived));
    this.syncArchivedLineupToFirestore(teamId, snapshot).catch(console.error);
  }

  static updateArchivedLineup(teamId: string, archiveId: string, updates: any): void {
    const archived = this.getArchivedLineups(teamId);
    const idx = archived.findIndex((a: any) => a.id === archiveId);
    if (idx !== -1) {
      archived[idx] = { ...archived[idx], ...updates };
      localStorage.setItem(`gameday_archived_lineups_${teamId}`, JSON.stringify(archived));
      this.syncArchivedLineupToFirestore(teamId, archived[idx]).catch(console.error);
      this.dispatch();
    }
  }

  static autoArchivePastLineups(teamId: string): void {
    const lineups = this.getLineups(teamId);
    const events = this.getEvents();
    const attendance = this.getAttendance();
    const now = new Date();
    const toArchive: any[] = [];
    const remaining: any[] = [];

    for (const lineup of lineups) {
      if (!lineup.eventId) { remaining.push(lineup); continue; }
      const event = events.find((e: any) => e.id === lineup.eventId);
      if (!event) { remaining.push(lineup); continue; }

      const eventDate = new Date(event.date + 'T' + (event.time ? this.parseTime(event.time) : '23:59'));
      if (eventDate < now) {
        const eventAttendance = (attendance[event.id] || []).map((r: any) => ({
          userId: r.userId,
          userName: r.userName,
          status: r.status,
          reason: r.reason || null,
        }));
        toArchive.push({
          id: lineup.id,
          lineupName: lineup.name,
          squads: lineup.squads,
          event: {
            id: event.id,
            title: event.title,
            date: event.date,
            time: event.time,
            location: event.location || null,
            type: event.type,
          },
          attendance: eventAttendance,
          notesAndResults: '',
          archivedAt: new Date().toISOString(),
        });
      } else {
        remaining.push(lineup);
      }
    }

    if (toArchive.length > 0) {
      for (const snapshot of toArchive) {
        this.archiveLineup(teamId, snapshot);
      }
      localStorage.setItem(`gameday_lineups_${teamId}`, JSON.stringify(remaining));
      this.dispatch();
    }
  }

  private static parseTime(timeStr: string): string {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return '23:59';
    let hours = parseInt(match[1]);
    const mins = match[2];
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${mins}`;
  }

  private static async syncArchivedLineupToFirestore(teamId: string, snapshot: any): Promise<void> {
    try {
      await setDoc(doc(db, 'archivedLineups', `${teamId}_${snapshot.id}`), {
        teamId, ...snapshot,
      });
    } catch (e) {
      console.warn('[Firestore] Archive sync failed:', e);
    }
  }

  // --- Custom Teams (Join Flows) ---

  // Save a created team to shared storage
  static saveTeam(team: any): void {
    const teams = this.getCustomTeams().filter((t: any) => t.id !== team.id);
    teams.push(team);
    localStorage.setItem('gameday_custom_teams', JSON.stringify(teams));
  }

  // Get all custom created teams
  static getCustomTeams(): any[] {
    const data = localStorage.getItem('gameday_custom_teams');
    return data ? JSON.parse(data) : [];
  }

  // Find a team by join code
  static findTeamByCode(code: string): any | null {
    const customTeams = this.getCustomTeams(); // reads gameday_custom_teams
    const legacyTeams = this.getTeams();       // reads gameday_teams
    const allTeams = [...customTeams, ...legacyTeams];
    return allTeams.find(t =>
      t.joinCode?.toUpperCase() === code.toUpperCase()
    ) || null;
  }

  // Add a team to a user's team list
  static addTeamToUser(userId: string, teamId: string): void {
    const userData = this.getUserData(userId) || {};
    const teamIds = userData.teamIds || [];
    if (!teamIds.includes(teamId)) {
      teamIds.push(teamId);
      this.updateUserData(userId, { ...userData, teamIds });
    }
  }

  static getTeamLogo(teamId: string): string | null {
    return localStorage.getItem(`gameday_team_logo_${teamId}`);
  }

  static setTeamLogo(teamId: string, base64: string): void {
    localStorage.setItem(`gameday_team_logo_${teamId}`, base64);
    window.dispatchEvent(new Event('gameday_update'));
  }

  static async uploadTeamLogo(teamId: string, file: File): Promise<string> {
    try {
      const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../firebase');
      const logoRef = ref(storage, `team-logos/${teamId}`);
      await uploadBytes(logoRef, file);
      const url = await getDownloadURL(logoRef);
      // Save URL to localStorage for fast access
      localStorage.setItem(`gameday_team_logo_${teamId}`, url);
      // Update team doc in Firestore so it restores on next login
      try {
        const { setDoc, doc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        await setDoc(doc(db, 'teams', teamId), { logo: url }, { merge: true });
      } catch (e) {
        console.warn('Could not sync logo URL to Firestore:', e);
      }
      // Update gameday_custom_teams in localStorage
      const customTeams = JSON.parse(localStorage.getItem('gameday_custom_teams') || '[]');
      const updated = customTeams.map((t: any) => t.id === teamId ? { ...t, logo: url } : t);
      localStorage.setItem('gameday_custom_teams', JSON.stringify(updated));
      window.dispatchEvent(new Event('gameday_update'));
      return url;
    } catch (e) {
      console.error('Logo upload failed:', e);
      throw e;
    }
  }

  static getTeamName(teamId: string): string | null {
    return localStorage.getItem(`gameday_team_name_${teamId}`);
  }

  static setTeamName(teamId: string, name: string): void {
    localStorage.setItem(`gameday_team_name_${teamId}`, name);
    window.dispatchEvent(new Event('gameday_update'));
  }

  static getTeamMembers(teamId: string): any[] {
    return JSON.parse(localStorage.getItem(`gameday_team_members_${teamId}`) || '[]');
  }

  static addTeamMember(teamId: string, member: { id: string; name: string; avatar?: string; position?: string; role?: string }) {
    const members = this.getTeamMembers(teamId);
    if (!members.find(m => m.id === member.id)) {
      members.push(member);
      localStorage.setItem(`gameday_team_members_${teamId}`, JSON.stringify(members));
      window.dispatchEvent(new Event('gameday_update'));
    }
  }

  static removeTeamMember(teamId: string, memberId: string) {
    const members = this.getTeamMembers(teamId).filter((m: any) => m.id !== memberId);
    localStorage.setItem(`gameday_team_members_${teamId}`, JSON.stringify(members));
  }

  // ── Firestore: Teams ──────────────────────────────────────
  static async syncTeamToFirestore(team: any): Promise<void> {
    await setDoc(doc(db, 'teams', team.id), team);
  }

  static async deleteTeamFromFirestore(teamId: string): Promise<void> {
    await deleteDoc(doc(db, 'teams', teamId));
  }

  static async getAllTeamsFromFirestore(): Promise<any[]> {
    const snap = await getDocs(collection(db, 'teams'));
    return snap.docs.map(d => d.data());
  }

  // ── Firestore: Users ──────────────────────────────────────
  static async syncUserToFirestore(userId: string, data: any): Promise<void> {
    await setDoc(doc(db, 'users', userId), data, { merge: true });
  }

  static async getUserFromFirestore(userId: string): Promise<any | null> {
    const { getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? snap.data() : null;
  }

  static async syncAnnouncementToFirestore(announcement: Announcement) {
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await setDoc(doc(db, 'announcements', announcement.id), announcement);
    } catch (e) {
      console.warn('Firestore sync failed:', e);
    }
  }

  static async deleteAnnouncementFromFirestore(announcementId: string): Promise<void> {
    await deleteDoc(doc(db, 'announcements', announcementId));
  }

  // ── Firestore: Real-time sync ──────────────────────────────
  private static eventsUnsubscribe: (() => void) | null = null;
  private static announcementsUnsubscribe: (() => void) | null = null;
  private static attendanceUnsubscribe: (() => void) | null = null;
  private static hydratedTeamIds: string[] = [];

  static async syncEventToFirestore(event: any): Promise<void> {
    try {
      await setDoc(doc(db, 'events', String(event.id)), event);
    } catch (err) {
      console.error('[Firestore] Failed to save event:', event.id, err);
      throw err;
    }
  }

  static async getAllEventsFromFirestore(): Promise<any[]> {
    const snap = await getDocs(collection(db, 'events'));
    return snap.docs.map(d => d.data());
  }

  static async hydrateAll(teamIds: string[]): Promise<void> {
    this.teardownListeners();
    this.hydratedTeamIds = teamIds;
    if (teamIds.length === 0) return;

    await Promise.all([
      this.hydrateEvents(teamIds),
      this.hydrateAnnouncements(teamIds),
      this.hydrateAttendance(teamIds),
    ]);
  }

  static teardownListeners(): void {
    if (this.eventsUnsubscribe) { this.eventsUnsubscribe(); this.eventsUnsubscribe = null; }
    if (this.announcementsUnsubscribe) { this.announcementsUnsubscribe(); this.announcementsUnsubscribe = null; }
    if (this.attendanceUnsubscribe) { this.attendanceUnsubscribe(); this.attendanceUnsubscribe = null; }
  }

  private static async hydrateEvents(teamIds: string[]): Promise<void> {
    // Initial fetch per team
    try {
      const allEvents: any[] = [];
      for (const teamId of teamIds) {
        const q = query(collection(db, 'events'), where('teamId', '==', teamId));
        const snap = await getDocs(q);
        snap.forEach(d => allEvents.push(d.data()));
      }
      this.mergeIntoLocal(this.EVENTS_KEY, allEvents);
    } catch (e) {
      console.warn('[StorageService] Event hydration failed:', e);
    }

    // Real-time listener — Firestore doesn't support `where('field', 'in', [])` with empty arrays
    // and `in` is limited to 30 items, so we listen to the full collection and filter client-side
    this.eventsUnsubscribe = onSnapshot(collection(db, 'events'), (snap) => {
      const teamSet = new Set(this.hydratedTeamIds);
      const firestoreEvents = snap.docs
        .map(d => d.data())
        .filter((e: any) => teamSet.has(e.teamId));
      this.mergeIntoLocal(this.EVENTS_KEY, firestoreEvents);
      this.dispatch();
    });
  }

  private static async hydrateAnnouncements(teamIds: string[]): Promise<void> {
    try {
      const allAnnouncements: any[] = [];
      for (const teamId of teamIds) {
        const q = query(collection(db, 'announcements'), where('teamId', '==', teamId));
        const snap = await getDocs(q);
        snap.forEach(d => allAnnouncements.push(d.data()));
      }
      // Also fetch 'all' team announcements (broadcasts)
      const allQ = query(collection(db, 'announcements'), where('teamId', '==', 'all'));
      const allSnap = await getDocs(allQ);
      allSnap.forEach(d => allAnnouncements.push(d.data()));

      this.mergeIntoLocal(this.ANNOUNCEMENTS_KEY, allAnnouncements);
    } catch (e) {
      console.warn('[StorageService] Announcement hydration failed:', e);
    }

    this.announcementsUnsubscribe = onSnapshot(collection(db, 'announcements'), (snap) => {
      const teamSet = new Set(this.hydratedTeamIds);
      const firestoreAnnouncements = snap.docs
        .map(d => d.data())
        .filter((a: any) => a.teamId === 'all' || teamSet.has(a.teamId));
      this.mergeIntoLocal(this.ANNOUNCEMENTS_KEY, firestoreAnnouncements);
      this.dispatch();
    });
  }

  private static async hydrateAttendance(teamIds: string[]): Promise<void> {
    // Attendance is keyed by eventId — fetch events first to know which eventIds belong to our teams
    try {
      const localEvents: any[] = JSON.parse(localStorage.getItem(this.EVENTS_KEY) || '[]');
      const teamSet = new Set(teamIds);
      const relevantEventIds = new Set(
        localEvents.filter((e: any) => teamSet.has(e.teamId)).map((e: any) => String(e.id))
      );

      const snap = await getDocs(collection(db, 'attendance'));
      const firestoreRecords = snap.docs.map(d => d.data()).filter((r: any) => relevantEventIds.has(String(r.eventId)));

      const localAttendance = this.getAttendance();
      for (const record of firestoreRecords) {
        const eid = record.eventId;
        if (!localAttendance[eid]) localAttendance[eid] = [];
        const idx = localAttendance[eid].findIndex((a: any) => a.userId === record.userId);
        if (idx !== -1) {
          localAttendance[eid][idx] = { ...localAttendance[eid][idx], ...record };
        } else {
          localAttendance[eid].push(record);
        }
      }
      localStorage.setItem(this.ATTENDANCE_KEY, JSON.stringify(localAttendance));
    } catch (e) {
      console.warn('[StorageService] Attendance hydration failed:', e);
    }

    this.attendanceUnsubscribe = onSnapshot(collection(db, 'attendance'), (snap) => {
      const localEvents: any[] = JSON.parse(localStorage.getItem(this.EVENTS_KEY) || '[]');
      const teamSet = new Set(this.hydratedTeamIds);
      const relevantEventIds = new Set(
        localEvents.filter((e: any) => teamSet.has(e.teamId)).map((e: any) => String(e.id))
      );

      const firestoreRecords = snap.docs.map(d => d.data()).filter((r: any) => relevantEventIds.has(String(r.eventId)));
      const localAttendance = this.getAttendance();

      for (const record of firestoreRecords) {
        const eid = record.eventId;
        if (!localAttendance[eid]) localAttendance[eid] = [];
        const idx = localAttendance[eid].findIndex((a: any) => a.userId === record.userId);
        if (idx !== -1) {
          localAttendance[eid][idx] = { ...localAttendance[eid][idx], ...record };
        } else {
          localAttendance[eid].push(record);
        }
      }
      localStorage.setItem(this.ATTENDANCE_KEY, JSON.stringify(localAttendance));
      this.dispatch();
    });
  }

  private static mergeIntoLocal(key: string, firestoreItems: any[]): void {
    const localItems: any[] = JSON.parse(localStorage.getItem(key) || '[]');
    const firestoreIds = new Set(firestoreItems.map((item: any) => String(item.id)));
    const localOnly = localItems.filter((item: any) => !firestoreIds.has(String(item.id)));
    const merged = [...firestoreItems, ...localOnly];
    localStorage.setItem(key, JSON.stringify(merged));
  }

  // ── Firestore: Team Members ───────────────────────────────
  static async syncTeamMembersToFirestore(teamId: string, members: any[]): Promise<void> {
    await setDoc(doc(db, 'teamMembers', teamId), { teamId, members }, { merge: true });
  }

  static async removeMemberFromFirestore(teamId: string, memberId: string): Promise<void> {
    const current = this.getTeamMembers(teamId);
    const updated = current.filter((m: any) => m.id !== memberId);
    await setDoc(doc(db, 'teamMembers', teamId), { teamId, members: updated }, { merge: true });
    // Also remove teamId from the member's user doc
    try {
      const userDoc = await import('firebase/firestore').then(fb =>
        fb.getDoc(fb.doc(db, 'users', memberId))
      );
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const updatedTeamIds = (userData.teamIds || []).filter((id: string) => id !== teamId);
        await updateDoc(doc(db, 'users', memberId), { teamIds: updatedTeamIds });
      }
    } catch (e) {
      // Member may not have a Firestore account yet, that's fine
    }
  }

  // ── Firestore: Full Delete Team ───────────────────────────
  static async deleteTeam(teamId: string): Promise<void> {
    // Remove from localStorage
    const customTeams = JSON.parse(localStorage.getItem('gameday_custom_teams') || '[]');
    localStorage.setItem('gameday_custom_teams', JSON.stringify(
      customTeams.filter((t: any) => t.id !== teamId)
    ));
    const legacyTeams = JSON.parse(localStorage.getItem('gameday_teams') || '[]');
    localStorage.setItem('gameday_teams', JSON.stringify(
      legacyTeams.filter((t: any) => t.id !== teamId)
    ));
    localStorage.removeItem(`gameday_team_members_${teamId}`);
    localStorage.removeItem(`gameday_team_logo_${teamId}`);
    localStorage.removeItem(`gameday_team_name_${teamId}`);

    const announcements = JSON.parse(localStorage.getItem('gameday_announcements') || '[]');
    localStorage.setItem('gameday_announcements', JSON.stringify(
      announcements.filter((a: any) => a.teamId !== teamId)
    ));
    const events = JSON.parse(localStorage.getItem('gameday_events') || '[]');
    localStorage.setItem('gameday_events', JSON.stringify(
      events.filter((e: any) => e.teamId !== teamId)
    ));
    Object.keys(localStorage)
      .filter(key => key.startsWith('gameday_user_'))
      .forEach(key => {
        const userData = JSON.parse(localStorage.getItem(key) || '{}');
        if (userData.teamIds?.includes(teamId)) {
          userData.teamIds = userData.teamIds.filter((id: string) => id !== teamId);
          localStorage.setItem(key, JSON.stringify(userData));
        }
      });
    Object.keys(localStorage)
      .filter(key => key.startsWith('gameday_role_') && key.endsWith(`_${teamId}`))
      .forEach(key => localStorage.removeItem(key));
    const activeUser = JSON.parse(localStorage.getItem('gameday_user') || '{}');
    if (activeUser.teamIds?.includes(teamId)) {
      activeUser.teamIds = activeUser.teamIds.filter((id: string) => id !== teamId);
      localStorage.setItem('gameday_user', JSON.stringify(activeUser));
    }
    const children = JSON.parse(localStorage.getItem('gameday_children') || '[]');
    localStorage.setItem('gameday_children', JSON.stringify(
      children.map((c: any) => ({
        ...c,
        teamIds: (c.teamIds || []).filter((id: string) => id !== teamId)
      }))
    ));

    // Track deleted mock team IDs so hardcoded teams can be hidden
    const deletedMocks = JSON.parse(localStorage.getItem('gameday_deleted_mock_teams') || '[]');
    if (!deletedMocks.includes(teamId)) {
      deletedMocks.push(teamId);
      localStorage.setItem('gameday_deleted_mock_teams', JSON.stringify(deletedMocks));
    }

    // Remove from Firestore
    await Promise.all([
      deleteDoc(doc(db, 'teams', teamId)),
      deleteDoc(doc(db, 'teamMembers', teamId)),
    ]);

    window.dispatchEvent(new Event('gameday_update'));
  }

  // ── Firestore: Real-time listener for teams ───────────────
  static subscribeToTeams(callback: (teams: any[]) => void): () => void {
    const unsubscribe = onSnapshot(collection(db, 'teams'), (snap) => {
      const teams = snap.docs.map(d => d.data());
      callback(teams);
    });
    return unsubscribe;
  }
}

export default StorageService;
