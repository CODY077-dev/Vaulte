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
  recipientId?: string;
  eventId?: string;
  isReminder?: boolean;
  isUrgent?: boolean;
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

  /** Safe JSON parse — returns fallback on corrupted data instead of crashing */
  private static safeParse<T>(data: string | null, fallback: T): T {
    if (!data) return fallback;
    try {
      return JSON.parse(data);
    } catch (e) {
      console.warn('StorageService: corrupted localStorage data, returning fallback', e);
      return fallback;
    }
  }

  private static dispatch() {
    window.dispatchEvent(new Event('gameday_update'));
  }

  // --- User Profile ---

  static getUserData(userId: string): Partial<User> | null {
    const data = localStorage.getItem(`${this.USER_PREFIX}${userId}`);
    return data ? this.safeParse<Partial<User> | null>(data, null) : null;
  }

  static updateUserData(userId: string, data: Partial<User>): Partial<User> {
    const existing = this.getUserData(userId) || {};
    const updated = { ...existing, ...data };
    localStorage.setItem(`${this.USER_PREFIX}${userId}`, JSON.stringify(updated));
    
    // Also update the current active user if it's the same
    const currentActiveStr = localStorage.getItem('gameday_user');
    if (currentActiveStr) {
      const currentActive = this.safeParse(currentActiveStr, null);
      if (!currentActive) return updated;
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
    
    const all: Announcement[] = this.safeParse(data, []);
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
    return this.safeParse(data, []);
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
            const user = this.safeParse(localStorage.getItem(key), {} as any);
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
    return this.safeParse(data, []);
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
    return this.safeParse(data, {});
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
    // Sync to Firestore with all fields
    if (status === null) {
      // User removed their response — delete from Firestore
      deleteDoc(doc(db, 'attendance', `${eventId}_${userId}`)).catch(console.error);
    } else {
      setDoc(doc(db, 'attendance', `${eventId}_${userId}`), {
        eventId, userId, userName, status,
        ...(reason ? { reason } : {}),
        timestamp: new Date().toISOString(),
      }).catch(console.error);
    }
    this.dispatch();
  }

  // --- Events ---

  static getEvents(): any[] {
    const data = localStorage.getItem(this.EVENTS_KEY);
    return this.safeParse(data, []);
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
      const lineups = this.safeParse(stored, []);
      if (!lineups.length) return [];
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
    // Sync to Firestore
    this.syncLineupToFirestore(teamId, lineup).catch(console.error);
  }

  static deleteLineup(teamId: string, lineupId: string): void {
    const lineups = this.getLineups(teamId).filter((l: any) => l.id !== lineupId);
    localStorage.setItem(`gameday_lineups_${teamId}`, JSON.stringify(lineups));
    this.dispatch();
    // Remove from Firestore
    deleteDoc(doc(db, 'lineups', `${teamId}_${lineupId}`)).catch(console.error);
  }

  // ── Firestore: Lineups ──────────────────────────────────
  static async syncLineupToFirestore(teamId: string, lineup: any): Promise<void> {
    try {
      await setDoc(doc(db, 'lineups', `${teamId}_${lineup.id}`), {
        teamId, ...lineup, updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[Firestore] Lineup sync failed:', e);
    }
  }

  static async getAllLineupsFromFirestore(teamId: string): Promise<any[]> {
    try {
      const q = query(collection(db, 'lineups'), where('teamId', '==', teamId));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data());
    } catch (e) {
      console.warn('[Firestore] Failed to fetch lineups:', e);
      return [];
    }
  }

  static async hydrateLineups(teamIds: string[]): Promise<void> {
    for (const teamId of teamIds) {
      try {
        const firestoreLineups = await this.getAllLineupsFromFirestore(teamId);
        if (firestoreLineups.length > 0) {
          const localLineups = this.getLineups(teamId);
          const localIds = new Set(localLineups.map((l: any) => String(l.id)));
          const firestoreIds = new Set(firestoreLineups.map((l: any) => String(l.id)));
          // Merge: Firestore wins for existing, keep local-only ones
          const merged = [
            ...firestoreLineups,
            ...localLineups.filter((l: any) => !firestoreIds.has(String(l.id)))
          ];
          localStorage.setItem(`gameday_lineups_${teamId}`, JSON.stringify(merged));
          // Push local-only lineups to Firestore
          const localOnly = localLineups.filter((l: any) => !firestoreIds.has(String(l.id)));
          for (const lineup of localOnly) {
            this.syncLineupToFirestore(teamId, lineup).catch(console.error);
          }
        }
      } catch (e) {
        console.warn(`[Sync] Lineup hydration failed for team ${teamId}:`, e);
      }
    }
  }

  // --- Lineup Archive ---

  static getArchivedLineups(teamId: string): any[] {
    const data = localStorage.getItem(`gameday_archived_lineups_${teamId}`);
    return this.safeParse(data, []);
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
      const customTeams = this.safeParse(localStorage.getItem('gameday_custom_teams'), []);
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
    return this.safeParse(localStorage.getItem(`gameday_team_members_${teamId}`), []);
  }

  static addTeamMember(teamId: string, member: { id: string; name: string; avatar?: string; position?: string; role?: string; parentId?: string; parentName?: string }) {
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

  // ── Firebase Storage: Team Resources ─────────────────────
  static async uploadTeamResource(teamId: string, file: File): Promise<any> {
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../firebase');
      const fileId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const storageRef = ref(storage, `team-resources/${teamId}/${fileId}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      const sizeKB = file.size / 1024;
      const sizeStr = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.round(sizeKB)} KB`;
      const typeMap: Record<string, string> = { pdf: 'PDF', doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel', ppt: 'PowerPoint', pptx: 'PowerPoint', txt: 'Text', csv: 'CSV', png: 'Image', jpg: 'Image', jpeg: 'Image' };

      const resource = {
        id: fileId,
        name: file.name,
        size: sizeStr,
        type: typeMap[ext] || ext.toUpperCase(),
        ext,
        url: downloadUrl,
        storagePath: `team-resources/${teamId}/${fileId}_${file.name}`,
        uploadedAt: new Date().toISOString(),
        uploadedBy: this.safeParse(localStorage.getItem('gameday_user'), {} as any).name || 'Unknown',
      };

      // Save metadata to Firestore
      await setDoc(doc(db, 'teamResources', fileId), { teamId, ...resource });

      // Update local cache
      const local = this.safeParse(localStorage.getItem(`gameday_resources_${teamId}`), []);
      local.unshift(resource);
      localStorage.setItem(`gameday_resources_${teamId}`, JSON.stringify(local));

      return resource;
    } catch (e) {
      console.error('[Storage] Resource upload failed:', e);
      throw e;
    }
  }

  static async deleteTeamResource(teamId: string, resourceId: string, storagePath?: string): Promise<void> {
    try {
      // Delete from Firebase Storage
      if (storagePath) {
        const { ref, deleteObject } = await import('firebase/storage');
        const { storage } = await import('../firebase');
        await deleteObject(ref(storage, storagePath)).catch(console.warn);
      }
      // Delete metadata from Firestore
      await deleteDoc(doc(db, 'teamResources', resourceId)).catch(console.warn);
      // Update local cache
      const local = this.safeParse(localStorage.getItem(`gameday_resources_${teamId}`), []);
      const updated = local.filter((r: any) => r.id !== resourceId);
      localStorage.setItem(`gameday_resources_${teamId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('[Storage] Resource delete failed:', e);
      throw e;
    }
  }

  static async hydrateTeamResources(teamId: string): Promise<any[]> {
    try {
      const q = query(collection(db, 'teamResources'), where('teamId', '==', teamId));
      const snap = await getDocs(q);
      const resources = snap.docs.map(d => d.data());
      if (resources.length > 0) {
        localStorage.setItem(`gameday_resources_${teamId}`, JSON.stringify(resources));
      }
      return resources;
    } catch (e) {
      console.warn('[Firestore] Resource hydration failed:', e);
      return this.safeParse(localStorage.getItem(`gameday_resources_${teamId}`), []);
    }
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
    try {
      await deleteDoc(doc(db, 'announcements', announcementId));
    } catch (e) {
      console.warn('[Firestore] Failed to delete announcement:', announcementId, e);
    }
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

    // Push any local-only data up to Firestore first
    await this.pushLocalToFirestore(teamIds);

    await Promise.all([
      this.hydrateEvents(teamIds),
      this.hydrateAnnouncements(teamIds),
      this.hydrateAttendance(teamIds),
    ]);
  }

  /**
   * One-time push: sync any localStorage data that was created before
   * Firestore sync existed. Skips docs that already exist in Firestore.
   */
  private static async pushLocalToFirestore(teamIds: string[]): Promise<void> {
    const teamSet = new Set(teamIds);

    try {
      // ── Events ──
      const localEvents: any[] = this.safeParse(localStorage.getItem(this.EVENTS_KEY), []);
      const relevantEvents = localEvents.filter((e: any) => teamSet.has(e.teamId));
      if (relevantEvents.length > 0) {
        const existingSnap = await getDocs(collection(db, 'events'));
        const existingIds = new Set(existingSnap.docs.map(d => d.id));
        const newEvents = relevantEvents.filter((e: any) => !existingIds.has(String(e.id)));
        await Promise.all(newEvents.map(e =>
          setDoc(doc(db, 'events', String(e.id)), e).catch(console.warn)
        ));
        if (newEvents.length > 0) console.log(`[Sync] Pushed ${newEvents.length} events to Firestore`);
      }

      // ── Attendance ──
      const localAttendance = this.getAttendance();
      const attendanceEntries: any[] = [];
      for (const [eventId, records] of Object.entries(localAttendance)) {
        for (const record of (records as any[])) {
          attendanceEntries.push({
            eventId,
            userId: record.userId,
            userName: record.userName || record.name || '',
            status: record.status,
            ...(record.reason ? { reason: record.reason } : {}),
            timestamp: record.timestamp || new Date().toISOString(),
          });
        }
      }
      if (attendanceEntries.length > 0) {
        const existingSnap = await getDocs(collection(db, 'attendance'));
        const existingIds = new Set(existingSnap.docs.map(d => d.id));
        const newEntries = attendanceEntries.filter(a =>
          !existingIds.has(`${a.eventId}_${a.userId}`)
        );
        await Promise.all(newEntries.map(a =>
          setDoc(doc(db, 'attendance', `${a.eventId}_${a.userId}`), a).catch(console.warn)
        ));
        if (newEntries.length > 0) console.log(`[Sync] Pushed ${newEntries.length} attendance records to Firestore`);
      }
    } catch (e) {
      console.warn('[Sync] Push local→Firestore failed:', e);
    }
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

  /** Normalize a Firestore attendance record to match local AttendanceRecord shape */
  private static normalizeAttendanceRecord(record: any): any {
    return {
      eventId: record.eventId,
      userId: record.userId,
      userName: record.userName || record.name || '',
      status: record.status,
      ...(record.reason ? { reason: record.reason } : {}),
      timestamp: record.timestamp || record.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
    };
  }

  private static mergeAttendanceRecords(localAttendance: Record<string, any[]>, firestoreRecords: any[]): void {
    for (const raw of firestoreRecords) {
      const record = this.normalizeAttendanceRecord(raw);
      const eid = record.eventId;
      if (!localAttendance[eid]) localAttendance[eid] = [];
      const idx = localAttendance[eid].findIndex((a: any) => a.userId === record.userId);
      if (idx !== -1) {
        // Firestore wins — overwrite local with normalized record
        localAttendance[eid][idx] = record;
      } else {
        localAttendance[eid].push(record);
      }
    }
  }

  private static async hydrateAttendance(teamIds: string[]): Promise<void> {
    // Attendance is keyed by eventId — fetch events first to know which eventIds belong to our teams
    try {
      const localEvents: any[] = this.safeParse(localStorage.getItem(this.EVENTS_KEY), []);
      const teamSet = new Set(teamIds);
      const relevantEventIds = new Set(
        localEvents.filter((e: any) => teamSet.has(e.teamId)).map((e: any) => String(e.id))
      );

      const snap = await getDocs(collection(db, 'attendance'));
      const firestoreRecords = snap.docs.map(d => d.data()).filter((r: any) => relevantEventIds.has(String(r.eventId)));

      const localAttendance = this.getAttendance();
      this.mergeAttendanceRecords(localAttendance, firestoreRecords);
      localStorage.setItem(this.ATTENDANCE_KEY, JSON.stringify(localAttendance));
    } catch (e) {
      console.warn('[StorageService] Attendance hydration failed:', e);
    }

    this.attendanceUnsubscribe = onSnapshot(collection(db, 'attendance'), (snap) => {
      const localEvents: any[] = this.safeParse(localStorage.getItem(this.EVENTS_KEY), []);
      const teamSet = new Set(this.hydratedTeamIds);
      const relevantEventIds = new Set(
        localEvents.filter((e: any) => teamSet.has(e.teamId)).map((e: any) => String(e.id))
      );

      const firestoreRecords = snap.docs.map(d => d.data()).filter((r: any) => relevantEventIds.has(String(r.eventId)));
      const localAttendance = this.getAttendance();
      this.mergeAttendanceRecords(localAttendance, firestoreRecords);
      localStorage.setItem(this.ATTENDANCE_KEY, JSON.stringify(localAttendance));
      this.dispatch();
    });
  }

  private static mergeIntoLocal(key: string, firestoreItems: any[]): void {
    const localItems: any[] = this.safeParse(localStorage.getItem(key), []);
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

  // ── Firestore: Children ─────────────────────────────────
  static async syncChildToFirestore(child: any): Promise<void> {
    try {
      await setDoc(doc(db, 'children', child.id), { ...child, updatedAt: new Date().toISOString() });
    } catch (e) {
      console.warn('[Firestore] Child sync failed:', e);
    }
  }

  static async getAllChildrenFromFirestore(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(db, 'children'));
      return snap.docs.map(d => d.data());
    } catch (e) {
      console.warn('[Firestore] Failed to fetch children:', e);
      return [];
    }
  }

  static async hydrateChildren(userId: string): Promise<void> {
    try {
      // 1. Push any local-only children up to Firestore first
      const localChildren: any[] = this.safeParse(localStorage.getItem('gameday_children'), []);
      const myLocalChildren = localChildren.filter((c: any) => c.parentIds?.includes(userId));

      if (myLocalChildren.length > 0) {
        const existingSnap = await getDocs(collection(db, 'children'));
        const existingIds = new Set(existingSnap.docs.map(d => d.id));
        const toPush = myLocalChildren.filter((c: any) => !existingIds.has(c.id));
        if (toPush.length > 0) {
          await Promise.all(toPush.map(c =>
            setDoc(doc(db, 'children', c.id), { ...c, updatedAt: new Date().toISOString() }).catch(console.warn)
          ));
          console.log(`[Sync] Pushed ${toPush.length} children to Firestore`);
        }
      }

      // 2. Pull from Firestore and merge into local
      const firestoreChildren = await this.getAllChildrenFromFirestore();
      const relevant = firestoreChildren.filter((c: any) =>
        c.parentIds?.includes(userId)
      );
      if (relevant.length === 0) return;

      const freshLocal: any[] = this.safeParse(localStorage.getItem('gameday_children'), []);
      const localIds = new Set(freshLocal.map((c: any) => c.id));

      for (const child of relevant) {
        if (localIds.has(child.id)) {
          const idx = freshLocal.findIndex((c: any) => c.id === child.id);
          if (idx !== -1) {
            freshLocal[idx] = { ...freshLocal[idx], ...child };
          }
        } else {
          freshLocal.push(child);
        }
      }
      localStorage.setItem('gameday_children', JSON.stringify(freshLocal));
      this.dispatch();
    } catch (e) {
      console.warn('[StorageService] Children hydration failed:', e);
    }
  }

  // ── Firestore: Full Delete Team ───────────────────────────
  static async deleteTeam(teamId: string): Promise<void> {
    // Remove from localStorage
    const customTeams = this.safeParse(localStorage.getItem('gameday_custom_teams'), []);
    localStorage.setItem('gameday_custom_teams', JSON.stringify(
      customTeams.filter((t: any) => t.id !== teamId)
    ));
    const legacyTeams = this.safeParse(localStorage.getItem('gameday_teams'), []);
    localStorage.setItem('gameday_teams', JSON.stringify(
      legacyTeams.filter((t: any) => t.id !== teamId)
    ));
    localStorage.removeItem(`gameday_team_members_${teamId}`);
    localStorage.removeItem(`gameday_team_logo_${teamId}`);
    localStorage.removeItem(`gameday_team_name_${teamId}`);

    const announcements = this.safeParse(localStorage.getItem('gameday_announcements'), []);
    localStorage.setItem('gameday_announcements', JSON.stringify(
      announcements.filter((a: any) => a.teamId !== teamId)
    ));
    const events = this.safeParse(localStorage.getItem('gameday_events'), []);
    localStorage.setItem('gameday_events', JSON.stringify(
      events.filter((e: any) => e.teamId !== teamId)
    ));
    Object.keys(localStorage)
      .filter(key => key.startsWith('gameday_user_'))
      .forEach(key => {
        const userData = this.safeParse(localStorage.getItem(key), {} as any);
        if (userData.teamIds?.includes(teamId)) {
          userData.teamIds = userData.teamIds.filter((id: string) => id !== teamId);
          localStorage.setItem(key, JSON.stringify(userData));
        }
      });
    Object.keys(localStorage)
      .filter(key => key.startsWith('gameday_role_') && key.endsWith(`_${teamId}`))
      .forEach(key => localStorage.removeItem(key));
    const activeUser = this.safeParse(localStorage.getItem('gameday_user'), {} as any);
    if (activeUser.teamIds?.includes(teamId)) {
      activeUser.teamIds = activeUser.teamIds.filter((id: string) => id !== teamId);
      localStorage.setItem('gameday_user', JSON.stringify(activeUser));
    }
    const children = this.safeParse(localStorage.getItem('gameday_children'), []);
    const updatedChildren = children.map((c: any) => ({
      ...c,
      teamIds: (c.teamIds || []).filter((id: string) => id !== teamId)
    }));
    localStorage.setItem('gameday_children', JSON.stringify(updatedChildren));

    // Sync affected children to Firestore
    for (const child of updatedChildren) {
      if (children.find((c: any) => c.id === child.id && c.teamIds?.includes(teamId))) {
        this.syncChildToFirestore(child).catch(console.error);
      }
    }

    // Track deleted mock team IDs so hardcoded teams can be hidden
    const deletedMocks = this.safeParse(localStorage.getItem('gameday_deleted_mock_teams'), []);
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
