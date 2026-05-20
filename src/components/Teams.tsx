import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { ChevronRight, Plus, Activity, Building2, Dribbble, CircleDot, Search, Users, User as UserIcon, Calendar, FileText, MapPin, Clock, ChevronLeft, Download, ExternalLink, Trophy, ChevronDown, AlertCircle, UserPlus, ShieldCheck, UserCog, Image, FolderOpen, LogIn, CheckCircle2, Key, X, Copy, Target, Repeat, Edit2, Minus, GripVertical, Archive, Save, PartyPopper, Pencil } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import DefaultAvatar from "./DefaultAvatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

import { MOCK_TEAMS, MOCK_LINEUP, MOCK_SCHEDULE, MOCK_CLUB } from "../constants";
import { User } from "../types";
import StorageService from "../services/StorageService";
import { doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

declare global { interface Window { google: any; } }

const MOCK_CLUBS = [
  { id: "karaka-rfc", name: "Karaka RFC", code: "KRK2026" }
];

interface TeamsProps {
  user: User | null;
  memberRoles: Record<string, 'coach' | 'manager' | null>;
  setMemberRoles: React.Dispatch<React.SetStateAction<Record<string, 'coach' | 'manager' | null>>>;
  onTabChange?: (tab: any, userId?: string) => void;
  onUpdateUser: (updates: Partial<User>) => void;
}

export default function Teams({ user, memberRoles, setMemberRoles, onTabChange, onUpdateUser }: TeamsProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamsAttendanceModalEvent, setTeamsAttendanceModalEvent] = useState<any>(null);
  const [teamsAttendanceData, setTeamsAttendanceData] = useState<Record<string, any[]>>(StorageService.getAttendance());
  const [teamScheduleEvents, setTeamScheduleEvents] = useState<any[]>([]);
  const [teamRealEvents, setTeamRealEvents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'going' | 'absent' | null>>({});
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [viewingDetail, setViewingDetail] = useState<'schedule' | 'lineup' | 'squad' | 'gallery' | 'resources' | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [lineups, setLineups] = useState<any[]>([]);
  const [activeLineupId, setActiveLineupId] = useState<string | null>(null);
  const [isEditingLineup, setIsEditingLineup] = useState(false);
  const [isRenamingLineup, setIsRenamingLineup] = useState(false);
  const [renameLineupValue, setRenameLineupValue] = useState('');
  const [isCreatingLineup, setIsCreatingLineup] = useState(false);
  const [newLineupName, setNewLineupName] = useState('');
  const [activeSquadId, setActiveSquadId] = useState<string | null>(null);
  const [playerPickerSlotIdx, setPlayerPickerSlotIdx] = useState<number | null>(null);
  const [isAddingSquad, setIsAddingSquad] = useState(false);
  const [newSquadName, setNewSquadName] = useState('');
  const [confirmDeleteLineupId, setConfirmDeleteLineupId] = useState<string | null>(null);
  const [isRenamingSquad, setIsRenamingSquad] = useState(false);
  const [renameSquadValue, setRenameSquadValue] = useState('');
  const [isPlayerPickerOpen, setIsPlayerPickerOpen] = useState(false);
  const [pickerAttendance, setPickerAttendance] = useState<Record<string, 'going' | 'absent'>>({});
  const [pickerEventTitle, setPickerEventTitle] = useState<string>('');
  const [newLineupEventId, setNewLineupEventId] = useState<string>('');
  const [lineupEventSearch, setLineupEventSearch] = useState<string>('');
  const [draggedPlayerIndex, setDraggedPlayerIndex] = useState<{squadId: string, index: number, type: 'starting' | 'reserves'} | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<{squadId: string, index: number, type: 'starting' | 'reserves'} | null>(null);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [archivedLineups, setArchivedLineups] = useState<any[]>([]);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [viewingArchive, setViewingArchive] = useState<any>(null);
  const [archiveNotesEdit, setArchiveNotesEdit] = useState('');
  const [showArchiveList, setShowArchiveList] = useState(false);

  const parseEventDate = (dateStr: string): Date => {
    if (!dateStr) return new Date(0);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(dateStr + 'T00:00:00');
    }
    return new Date(dateStr);
  };

  const formatEventDate = (dateStr: string): string => {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    return dateStr;
  };

  const formatEventTime = (timeStr: string): string => {
    if (!timeStr) return '';
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const h = parseInt(match[1]), m = match[2];
      const suffix = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      return `${hour}:${m} ${suffix}`;
    }
    return timeStr;
  };

  const TEAM_EVENT_TYPE_STYLES = {
    training: { bg: 'bg-blue-100',   text: 'text-blue-600',   selectedBg: 'bg-blue-400/40',   selectedText: 'text-white' },
    match:    { bg: 'bg-red-100',    text: 'text-red-500',    selectedBg: 'bg-red-400/40',    selectedText: 'text-white' },
    meeting:  { bg: 'bg-amber-100',  text: 'text-amber-600',  selectedBg: 'bg-amber-400/40',  selectedText: 'text-white' },
    event:    { bg: 'bg-purple-100', text: 'text-purple-500', selectedBg: 'bg-purple-400/40', selectedText: 'text-white' },
    custom:   { bg: 'bg-slate-100',  text: 'text-slate-500',  selectedBg: 'bg-white/20',      selectedText: 'text-white' },
  };

  const getTeamEventTypeCounts = (events: any[]) => {
    const counts: Record<string, number> = {};
    events.forEach(e => {
      const t = e.type || 'event';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  };

  useEffect(() => {
    if (!activeLineupId || !selectedTeamId) {
      setPickerAttendance({});
      setPickerEventTitle('');
      return;
    }
    const today = new Date(); today.setHours(0,0,0,0);
    const allEvents = StorageService.getEvents();
    const activeLineup = lineups.find(l => l.id === activeLineupId);
    
    let targetEvent = null;
    if (activeLineup?.eventId) {
      targetEvent = allEvents.find(e => e.id === activeLineup.eventId);
    }

    if (!targetEvent) {
      const upcoming = allEvents
        .filter(e => e.teamId === selectedTeamId)
        .filter(e => { const d = parseEventDate(e.date); return d >= today; })
        .sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime());
      targetEvent = upcoming[0];
    }

    if (targetEvent) {
      setPickerEventTitle(targetEvent.title);
      const allAttendance = StorageService.getAttendance();
      const eventRecords = allAttendance[targetEvent.id] || [];
      const map: Record<string, 'going' | 'absent'> = {};
      eventRecords.forEach(r => { if (r.status) map[r.userName] = r.status as 'going' | 'absent'; });
      setPickerAttendance(map);
    } else {
      setPickerAttendance({});
      setPickerEventTitle('');
    }
  }, [activeLineupId, selectedTeamId, lineups]);

  useEffect(() => {
    if (selectedTeamId) {
      StorageService.autoArchivePastLineups(selectedTeamId);
      setLineups(StorageService.getLineups(selectedTeamId));
      setArchivedLineups(StorageService.getArchivedLineups(selectedTeamId));
    }
    const handleUpdate = () => {
      if (selectedTeamId) {
        setLineups(StorageService.getLineups(selectedTeamId));
        setArchivedLineups(StorageService.getArchivedLineups(selectedTeamId));
      }
    };
    window.addEventListener('gameday_update', handleUpdate);
    return () => window.removeEventListener('gameday_update', handleUpdate);
  }, [selectedTeamId]);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addMemberType, setAddMemberType] = useState<'manager' | 'coach' | null>(null);
  const [scheduleView, setScheduleView] = useState<'month' | 'week'>('week');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
  const calendarMonthName = new Date(calendarYear, calendarMonth, 1).toLocaleDateString('en-US', { month: 'long' });
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const _now = new Date();
  const today = _now.getDate();
  const [selectedDate, setSelectedDate] = useState<number>(today);

  const eventMatchesDay = (eventDate: string, day: number): boolean => {
    if (!eventDate) return false;
    // YYYY-MM-DD format (from date picker)
    if (/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      const d = new Date(eventDate + 'T00:00:00');
      return d.getFullYear() === calendarYear && d.getMonth() === calendarMonth && d.getDate() === day;
    }
    // Legacy string format e.g. "Wednesday, May 5"
    const legacyDate = new Date(calendarYear, calendarMonth, day);
    const weekday = legacyDate.toLocaleDateString('en-US', { weekday: 'long' });
    const month = legacyDate.toLocaleDateString('en-US', { month: 'short' });
    return eventDate === `${weekday}, ${month} ${day}`;
  };
  const [pendingDeleteEventId, setPendingDeleteEventId] = useState<string | null>(null);

  const [isTeamEventModalOpen, setIsTeamEventModalOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const [teamNewEvent, setTeamNewEvent] = useState({
    teamId: '',
    type: 'training' as 'training' | 'match' | 'meeting' | 'event' | 'custom',
    title: '',
    date: toLocalDateStr(new Date(calendarYear, calendarMonth, selectedDate)),
    time: '18:00',
    location: '',
    notes: '',
    opponent: '',
    repeat: false,
    repeatDays: [] as string[],
    repeatStartDate: toLocalDateStr(new Date(calendarYear, calendarMonth, selectedDate)),
    repeatEndDate: toLocalDateStr(new Date(calendarYear, calendarMonth + 1, selectedDate)),
    pinLocation: null as { lat: number; lng: number; label: string } | null,
  });

  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    sport: '',
  });
  const [createSuccess, setCreateSuccess] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [joinedTeamName, setJoinedTeamName] = useState('');
  const [joinStep, setJoinStep] = useState<'code' | 'who' | 'child' | 'success'>('code');
  const [foundTeam, setFoundTeam] = useState<any>(null);
  const [childName, setChildName] = useState('');
  const [childDob, setChildDob] = useState('');
  const [childMatchFound, setChildMatchFound] = useState<any>(null);
  const [childLinkConfirm, setChildLinkConfirm] = useState(false);
  const [isJoinClubOpen, setIsJoinClubOpen] = useState(false);
  const [clubCodeInput, setClubCodeInput] = useState('');
  const [clubCodeError, setClubCodeError] = useState('');
  const [clubRequestSent, setClubRequestSent] = useState(false);
  const [customTeams, setCustomTeams] = useState<any[]>([]);
  const [teamLogos, setTeamLogos] = useState<Record<string, string>>({});
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamLogo, setEditTeamLogo] = useState<string | null>(null);
  const [editTeamLogoFile, setEditTeamLogoFile] = useState<File | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSquadEditMode, setIsSquadEditMode] = useState(false);
  const [rosterMembers, setRosterMembers] = useState<any[]>([]);
  const [memberToRemove, setMemberToRemove] = useState<any>(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});
  const [teamResources, setTeamResources] = useState<any[]>([]);
  const [isTeamSearchingLocation, setIsTeamSearchingLocation] = useState(false);
  const [locationMode, setLocationMode] = useState<'pin' | 'address' | 'text'>('pin');
  const [teamMapPin, setTeamMapPin] = useState<{ lat: number; lng: number } | null>(null);
  const teamSearchInputRef = useRef<HTMLInputElement>(null);
  const teamMapRef = useRef<HTMLDivElement>(null);
  const teamMapInstanceRef = useRef<any>(null);

  const formatDate = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    
    const todayStart = new Date(
      now.getFullYear(), now.getMonth(), now.getDate()
    );
    const yesterdayStart = new Date(
      now.getFullYear(), now.getMonth(), now.getDate() - 1
    );
    const dateStart = new Date(
      date.getFullYear(), date.getMonth(), date.getDate()
    );

    if (dateStart.getTime() === todayStart.getTime()) {
      return 'Today';
    } else if (dateStart.getTime() === yesterdayStart.getTime()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-NZ', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      });
    }
  };

  useEffect(() => {
    if (window.google) return;
    if (document.querySelector('script[src*="maps.googleapis"]')) return;
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
    s.async = true;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!isTeamSearchingLocation) return;
    const init = () => {
      if (!teamMapRef.current || !window.google) return;
      const map = new window.google.maps.Map(teamMapRef.current, {
        center: { lat: -37.0731, lng: 174.9507 }, zoom: 14,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      });
      teamMapInstanceRef.current = map;
      const marker = new window.google.maps.Marker({ map, draggable: true, visible: false });
      map.addListener('click', (e: any) => {
        const lat = e.latLng.lat(), lng = e.latLng.lng();
        marker.setPosition({ lat, lng }); marker.setVisible(true);
        setTeamMapPin({ lat, lng });
      });
      marker.addListener('dragend', (e: any) => setTeamMapPin({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
      if (teamSearchInputRef.current) {
        const ac = new window.google.maps.places.Autocomplete(teamSearchInputRef.current);
        ac.addListener('place_changed', () => {
          const p = ac.getPlace();
          if (!p.geometry?.location) return;
          const lat = p.geometry.location.lat(), lng = p.geometry.location.lng();
          map.setCenter({ lat, lng }); map.setZoom(17);
          marker.setPosition({ lat, lng }); marker.setVisible(true);
          setTeamMapPin({ lat, lng });
        });
      }
    };
    window.google ? init() : (() => { const t = setInterval(() => { if (window.google) { clearInterval(t); init(); } }, 200); })();
  }, [isTeamSearchingLocation]);

  useEffect(() => {
    if (selectedTeamId) {
      const raw = StorageService.getTeamMembers(selectedTeamId);
      const enriched = raw.map((member: any) => {
        const savedProfile = StorageService.getUserData(member.id);
        const activeUser = JSON.parse(localStorage.getItem('gameday_user') || '{}');
        const isActiveUser = activeUser.id === member.id;
        // Also scan all stored user profiles for this member
        const allProfileKeys = Object.keys(localStorage).filter(k =>
          k.startsWith('gameday_user_')
        );
        let storedAvatar = member.avatar || null;
        let storedName = member.name || '';
        for (const key of allProfileKeys) {
          try {
            const profile = JSON.parse(localStorage.getItem(key) || '{}');
            if (profile.id === member.id) {
              storedAvatar = profile.avatar || storedAvatar;
              storedName = profile.name || storedName;
              break;
            }
          } catch {}
        }
        return {
          ...member,
          avatar: (isActiveUser ? activeUser.avatar : null) || savedProfile?.avatar || storedAvatar,
          name: (isActiveUser ? activeUser.name : null) || savedProfile?.name || storedName,
        };
      });
      // Filter out ghost entries — members with no name and no stored profile
      const valid = enriched.filter((m: any) => m.name && m.name.trim() !== '');
      setRosterMembers(valid);

      const savedResources = JSON.parse(localStorage.getItem(`gameday_resources_${selectedTeamId}`) || '[]');
      setTeamResources(savedResources);
    }
  }, [selectedTeamId]);

  useEffect(() => {
    setIsSquadEditMode(false);
  }, [viewingDetail]);

  useEffect(() => {
    const navTeam = localStorage.getItem("gameday_navigate_team");
    if (navTeam) {
      setSelectedTeamId(navTeam);
      localStorage.removeItem("gameday_navigate_team");
    }
  }, []);

  const confirmRemoveMember = () => {
    if (!memberToRemove || !selectedTeam) return;

    const teamId = selectedTeam.id;
    const memberId = memberToRemove.id;

    // Check if this is a child (id starts with 'child-')
    if (memberId && memberId.startsWith('child-')) {
      const children = JSON.parse(localStorage.getItem('gameday_children') || '[]');
      const updated = children.map((c: any) =>
        c.id === memberId
          ? { ...c, teamIds: (c.teamIds || []).filter((id: string) => id !== teamId) }
          : c
      );
      localStorage.setItem('gameday_children', JSON.stringify(updated));
    } else {
      // Regular member removal
      StorageService.removeTeamMember(teamId, memberId);

      // Strip teamId from member's stored profile (even if profile data is sparse)
      const userData = StorageService.getUserData(memberId) || {};
      const existingTeamIds: string[] = userData.teamIds || [];
      const updatedTeamIds = existingTeamIds.filter((id: string) => id !== teamId);
      StorageService.updateUserData(memberId, { ...userData, teamIds: updatedTeamIds });

      // Also strip from active session if same user is currently logged in
      const activeUser = JSON.parse(localStorage.getItem('gameday_user') || '{}');
      if (activeUser.id === memberId) {
        activeUser.teamIds = (activeUser.teamIds || []).filter((id: string) => id !== teamId);
        localStorage.setItem('gameday_user', JSON.stringify(activeUser));
      }

      // Remove role key
      localStorage.removeItem(`gameday_role_${memberId}_${teamId}`);

      // Sync removal to Firestore so all users see the updated roster
      StorageService.removeMemberFromFirestore(teamId, memberId).catch(() => {});
    }

    // Update local state
    setRosterMembers(prev => prev.filter(m => m.id !== memberId));
    // Dispatch update after state is set so the reload picks up the already-filtered storage
    setTimeout(() => window.dispatchEvent(new Event('gameday_update')), 50);
    setShowRemoveModal(false);
    setMemberToRemove(null);
  };


  useEffect(() => {
    const loadLogos = () => {
      const logos: Record<string, string> = {};
      const names: Record<string, string> = {};
      const stored = StorageService.getCustomTeams();
      const legacyStored = StorageService.getTeams();
      const combined = [...MOCK_TEAMS, ...stored, ...legacyStored];
      
      combined.forEach(t => {
        const savedLogo = StorageService.getTeamLogo(t.id);
        if (savedLogo) logos[t.id] = savedLogo;
        const savedName = localStorage.getItem(`gameday_team_name_${t.id}`);
        if (savedName) names[t.id] = savedName;
      });
      setTeamLogos(logos);
      setTeamNames(names);
    };

    const handleUpdate = () => {
      const stored = StorageService.getCustomTeams();
      const legacyStored = StorageService.getTeams();
      const combinedCustom = [...stored, ...legacyStored];
      
      const currentUserData = user ? StorageService.getUserData(user.id) || user : null;
      const userJoinedTeams = combinedCustom.filter(t => {
        const inTeamIds = currentUserData?.teamIds?.includes(t.id);
        if (!inTeamIds) return false;

        // For non-coach/club users, verify they're still in the team roster
        // This catches cases where a coach removed them
        if (user?.role === 'player' || user?.role === 'supporter') {
          const isCreator = t.createdBy === user?.id || t.coachId === user?.id;
          const storedRole = localStorage.getItem(`gameday_role_${user?.id}_${t.id}`);
          const isCoach = storedRole === 'coach' || storedRole === 'club';
          const rosterMembers = StorageService.getTeamMembers(t.id);
          const isInRoster = rosterMembers.some(m => m.id === user?.id);
          const children = JSON.parse(localStorage.getItem('gameday_children') || '[]');
          const hasChild = children.some((c: any) =>
            c.teamIds?.includes(t.id) && c.parentIds?.includes(user?.id)
          );

          // If roster has entries and user is not in it, they were removed
          // If roster is empty (not yet restored from Firestore), trust teamIds
          if (rosterMembers.length > 0) {
            return isCreator || isCoach || isInRoster || hasChild;
          }
          return true; // roster not loaded yet — teamIds is the source of truth
        }

        return true;
      });
      setCustomTeams(userJoinedTeams);
      loadLogos();

      const currentTeamId = selectedTeamId || selectedTeam?.id || '';
      if (currentTeamId) {
        const raw = StorageService.getTeamMembers(currentTeamId);
        const enriched = raw.map((member: any) => {
          const savedProfile = StorageService.getUserData(member.id);
          const activeUser = JSON.parse(localStorage.getItem('gameday_user') || '{}');
          const isActiveUser = activeUser.id === member.id;
          // Also scan all stored user profiles for this member
          const allProfileKeys = Object.keys(localStorage).filter(k =>
            k.startsWith('gameday_user_')
          );
          let storedAvatar = member.avatar || null;
          let storedName = member.name || '';
          for (const key of allProfileKeys) {
            try {
              const profile = JSON.parse(localStorage.getItem(key) || '{}');
              if (profile.id === member.id) {
                storedAvatar = profile.avatar || storedAvatar;
                storedName = profile.name || storedName;
                break;
              }
            } catch {}
          }
          return {
            ...member,
            avatar: (isActiveUser ? activeUser.avatar : null) || savedProfile?.avatar || storedAvatar,
            name: (isActiveUser ? activeUser.name : null) || savedProfile?.name || storedName,
          };
        });
        const valid = enriched.filter((m: any) => m.name && m.name.trim() !== '');
        setRosterMembers(valid);
      }

      const allEvents = StorageService.getEvents();
      const teamEvents = allEvents.filter((e: any) => e.teamId === (selectedTeamId || selectedTeam?.id || ''));
      setTeamScheduleEvents(teamEvents);
      setTeamRealEvents(allEvents);
    };

    handleUpdate();

    const allAttendance = StorageService.getAttendance();
    const formattedAttendance: Record<string, 'going' | 'absent' | null> = {};
    
    Object.keys(allAttendance).forEach(eventId => {
      const userRecord = allAttendance[eventId].find(a => a.userId === user?.id);
      if (userRecord) {
        formattedAttendance[eventId] = userRecord.status;
      }
    });
    setAttendance(formattedAttendance);

    window.addEventListener('gameday_update', handleUpdate);
    const refreshTeamsAttendance = () => setTeamsAttendanceData(StorageService.getAttendance());
    window.addEventListener('gameday_update', refreshTeamsAttendance);
    return () => {
      window.removeEventListener('gameday_update', handleUpdate);
      window.removeEventListener('gameday_update', refreshTeamsAttendance);
    };
  }, [user, selectedTeamId]);


  const activeLineup = lineups.find(l => l.id === activeLineupId);

  const handleAttendance = (eventId: string, status: 'going' | 'absent') => {
    const newStatus = attendance[eventId] === status ? null : status;
    setAttendance(prev => ({
      ...prev,
      [eventId]: newStatus
    }));

    if (user) {
      StorageService.updateAttendance(eventId, user.id, user.name, newStatus);
    }
    window.dispatchEvent(new Event('gameday_update'));
  };

  const handleDeleteEvent = (eventId: string) => {
    StorageService.deleteEvent(eventId);
    setExpandedEventId(null);
    window.dispatchEvent(new Event('gameday_update'));
  };

  const currentUser = user ? StorageService.getUserData(user.id) || user : null;
  const userRole = user?.role;
  const allTeams = [
    ...MOCK_TEAMS.filter(t => currentUser?.teamIds?.includes(t.id)),
    ...customTeams
  ];
  const userTeams = allTeams;
  const selectedTeam = allTeams.find(t => t.id === selectedTeamId);
  const isTeamCoach =
    user?.role === 'coach' ||
    user?.role === 'club' ||
    (selectedTeam != null && localStorage.getItem(`gameday_role_${user?.id}_${selectedTeam.id}`) === 'coach') ||
    (selectedTeam != null && selectedTeam.createdBy === user?.id) ||
    (selectedTeam != null && selectedTeam.coachId === user?.id);

  const teamClubId = (() => {
    const stored = JSON.parse(localStorage.getItem('gameday_custom_teams') || '[]')
      .find((t: any) => t.id === selectedTeam?.id);
    return selectedTeam?.clubId || stored?.clubId || null;
  })();

  const pendingClubRequest = (() => {
    const requests = JSON.parse(localStorage.getItem('gameday_club_requests') || '[]');
    return requests.find((r: any) => r.teamId === selectedTeam?.id && r.status === 'pending') || null;
  })();

  const getActualMemberCount = (teamId: string) => {
    const members = StorageService.getTeamMembers(teamId);
    const children = JSON.parse(localStorage.getItem('gameday_children') || '[]')
      .filter((c: any) => c.teamIds?.includes(teamId));
    return members.length + children.length;
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-24 relative">
      {selectedTeamId && selectedTeam ? (
        <>
        <AnimatePresence mode="wait">
          {!viewingDetail ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Team Header */}
              <div className="bg-white border-b border-slate-100 sticky top-0 z-30">
                <div className="p-4 flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedTeamId(null)}
                    className="rounded-full hover:bg-slate-100 shrink-0"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>

                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center shadow-sm shrink-0">
                      {selectedTeam && !logoErrors[selectedTeam.id] && (teamLogos[selectedTeam.id] || selectedTeam.logo) ? (
                        <img
                          src={teamLogos[selectedTeam.id] || selectedTeam.logo}
                          alt={selectedTeam.name}
                          className="w-full h-full object-contain p-0.5"
                          onError={() => setLogoErrors(prev => ({ ...prev, [selectedTeam.id]: true }))}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-xl">
                          <Users className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col leading-tight">
                      <h1 className="text-base font-black text-slate-900 uppercase italic tracking-tight">
                        {teamNames[selectedTeamId || ""] || selectedTeam?.name}
                      </h1>
                      {selectedTeam?.clubId === MOCK_CLUB.id && (
                        <span className="text-[9px] font-medium italic text-slate-400 tracking-wide">
                          {MOCK_CLUB.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {isTeamCoach && (
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Edit button */}
                      <button
                        onClick={() => {
                          setEditTeamName(teamNames[selectedTeam.id] || selectedTeam.name);
                          setEditTeamLogo(teamLogos[selectedTeam.id] || null);
                          setIsEditTeamOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all"
                      >
                        Edit
                      </button>

                      {/* Existing + button (coach only) */}
                      {isTeamCoach && (
                        <div className="ml-auto">
                          <Dialog open={isAddMemberOpen} onOpenChange={(open) => {
                            setIsAddMemberOpen(open);
                            if (!open) {
                              setAddMemberType(null);
                            }
                          }}>
                            <DialogTrigger render={<Button variant="ghost" size="icon" className="rounded-full bg-slate-50 hover:bg-primary/10 hover:text-primary transition-all" />}>
                              <Plus className="w-5 h-5" />
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] border-none p-0 overflow-hidden">
                              <div className="p-6 bg-slate-900 text-white">
                                <DialogTitle className="text-xl font-black uppercase italic">Assign Team Responsibilities</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                  Promote members to leadership roles
                                </DialogDescription>
                              </div>
                              
                              <div className="p-6 space-y-6">
                                {!addMemberType ? (
                                  <div className="grid gap-3">
                                    {[
                                      { id: 'manager', label: 'Add a Manager', icon: ShieldCheck, color: 'text-amber-500', bg: 'bg-amber-50' },
                                      { id: 'coach', label: 'Add a Coach', icon: UserCog, color: 'text-primary', bg: 'bg-primary/10' },
                                    ].map((option) => (
                                      <button
                                        key={option.id}
                                        onClick={() => setAddMemberType(option.id as any)}
                                        className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 hover:border-primary/30 hover:shadow-md transition-all group text-left"
                                      >
                                        <div className={`w-10 h-10 rounded-xl ${option.bg} ${option.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                          <option.icon className="w-5 h-5" />
                                        </div>
                                        <span className="text-sm font-black text-slate-900 uppercase italic">{option.label}</span>
                                        <ChevronRight className="ml-auto w-4 h-4 text-slate-300" />
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <motion.div 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-6"
                                  >
                                    <div className="flex items-center gap-2 mb-2">
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setAddMemberType(null)}
                                        className="p-0 h-auto text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                                      >
                                        <ChevronLeft className="w-3 h-3 mr-1" /> Back
                                      </Button>
                                    </div>
                                    
                                    <div className="space-y-4">
                                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                        Select Member to promote to {addMemberType.toUpperCase()}
                                      </h4>
                                      <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2">
                                        {MOCK_LINEUP.map((player) => (
                                          <button
                                            key={player.id}
                                            onClick={() => {
                                              setMemberRoles(prev => ({ ...prev, [player.id]: addMemberType }));
                                              setIsAddMemberOpen(false);
                                              setAddMemberType(null);
                                            }}
                                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-left"
                                          >
                                            <DefaultAvatar name={player.name} size="md" className="rounded-lg" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-bold text-slate-900 truncate">{player.name}</p>
                                              <p className="text-[9px] font-bold text-slate-400 uppercase">{player.position}</p>
                                            </div>
                                            {memberRoles[player.id] === addMemberType && (
                                              <Badge className="bg-primary text-[8px] font-black">ACTIVE</Badge>
                                            )}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-4 space-y-6">

                {/* Action Cards Row */}
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setViewingDetail('schedule')}
                    className="aspect-square bg-white rounded-[2rem] shadow-sm flex flex-col items-center justify-center gap-3 group active:scale-95 transition-all border border-slate-100"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <Calendar className="w-5 h-5 text-primary group-hover:text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Schedule</span>
                  </button>

                  <button 
                    onClick={() => setViewingDetail('lineup')}
                    className="aspect-square bg-white rounded-[2rem] shadow-sm flex flex-col items-center justify-center gap-3 group active:scale-95 transition-all border border-slate-100"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <Users className="w-5 h-5 text-primary group-hover:text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Lineup</span>
                  </button>
                </div>

                {/* Important Notes Section (Like Home) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-2">
                    <AlertCircle className="w-4 h-4 text-slate-400" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Important Notes</h3>
                  </div>
                  {(() => {
                    const teamAnnouncements = StorageService.getAnnouncements()
                      .filter(ann => ann.teamId === selectedTeam?.id);

                    if (teamAnnouncements.length === 0) {
                      return (
                        <p className="px-2 text-[10px] font-medium text-slate-400 italic">No announcements for this team yet.</p>
                      );
                    }

                    const visible = teamAnnouncements.slice(0, 3);
                    const remaining = teamAnnouncements.length - 3;

                    return (
                      <>
                        {visible.map((ann, idx) => (
                          <div key={ann.id || idx} className="bg-white rounded-2xl shadow-sm border-l-[3px] border-primary p-4">
                            <p className="text-[11px] font-black uppercase text-slate-900 mb-1">{ann.title}</p>
                            <p className="text-[11px] text-slate-600 leading-relaxed mb-3">{ann.content}</p>
                            <div className="flex items-center justify-between">
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                — Sent by {ann.senderName}
                              </p>
                              <p className="text-[10px] font-semibold text-slate-400">
                                {formatDate(ann.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                        {remaining > 0 && (
                          <button
                            onClick={() => setShowAllNotes(true)}
                            className="w-full text-center text-[11px] font-bold text-slate-400 py-2 hover:text-slate-600 transition-colors"
                          >
                            ↓ See {remaining} More
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* See All Notes Modal */}
                {showAllNotes && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/50 z-[60]"
                      onClick={() => setShowAllNotes(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92%] max-w-sm max-h-[85vh] flex flex-col bg-white rounded-[2rem] shadow-2xl overflow-hidden"
                    >
                      <div className="bg-slate-900 p-6 flex items-center justify-between">
                        <h2 className="text-white text-sm font-black uppercase tracking-widest">Important Notes</h2>
                        <button onClick={() => setShowAllNotes(false)} className="text-white/70 hover:text-white">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {StorageService.getAnnouncements()
                          .filter(ann => ann.teamId === selectedTeam?.id)
                          .map((ann, idx) => (
                            <div key={ann.id || idx} className="bg-white rounded-2xl shadow-sm border-l-[3px] border-primary p-4">
                              <p className="text-[11px] font-black uppercase text-slate-900 mb-1">{ann.title}</p>
                              <p className="text-[11px] text-slate-600 leading-relaxed mb-3">{ann.content}</p>
                              <div className="flex items-center justify-between">
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                  — Sent by {ann.senderName}
                                </p>
                                <p className="text-[10px] font-semibold text-slate-400">
                                  {formatDate(ann.timestamp)}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </motion.div>
                  </>
                )}

                {/* Secondary Action Row */}
                <div className="grid grid-cols-3 gap-4">
                  <button 
                    onClick={() => setViewingDetail('gallery')}
                    className="aspect-square bg-white rounded-[2rem] shadow-sm flex flex-col items-center justify-center gap-3 group active:scale-95 transition-all border border-slate-100"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <Image className="w-5 h-5 text-primary group-hover:text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Gallery</span>
                  </button>

                  <button 
                    onClick={() => setViewingDetail('resources')}
                    className="aspect-square bg-white rounded-[2rem] shadow-sm flex flex-col items-center justify-center gap-3 group active:scale-95 transition-all border border-slate-100"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <FolderOpen className="w-5 h-5 text-primary group-hover:text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Resources</span>
                  </button>

                  <button 
                    onClick={() => setViewingDetail('squad')}
                    className="aspect-square bg-white rounded-[2rem] shadow-sm flex flex-col items-center justify-center gap-3 group active:scale-95 transition-all border border-slate-100"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <Activity className="w-5 h-5 text-primary group-hover:text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Team</span>
                  </button>
                </div>

                {/* Team Join Code */}
                <div className="mt-8 p-4 bg-white rounded-3xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Team Access Code
                    </p>
                    <p className="text-[13px] font-black text-slate-900 uppercase tracking-widest">
                      {selectedTeam.joinCode || selectedTeam.id.toUpperCase().slice(0, 7)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const code = selectedTeam?.joinCode || selectedTeam?.id?.toUpperCase().slice(0, 7) || '';
                      const doCopy = (text: string) => {
                        if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
                        const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
                        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                        return Promise.resolve();
                      };
                      doCopy(code).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 active:scale-95 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? '✓ COPIED' : 'COPY'}
                  </button>
                </div>

                {/* Club Affiliation Section */}
                {isTeamCoach && (
                  <div className="space-y-3">
                    {teamClubId ? (
                      <div className="mt-8 p-4 bg-white rounded-3xl border border-slate-100 flex items-center justify-between">
                        <h4 className="text-sm font-black text-slate-900 uppercase italic">
                          {MOCK_CLUBS.find(c => c.id === teamClubId)?.name || teamClubId}
                        </h4>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-green-500">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      </div>
                    ) : pendingClubRequest ? (
                      <div className="mt-8 p-4 bg-white rounded-3xl border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                            <Clock className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Pending Approval</p>
                            <p className="text-[10px] italic text-slate-400">
                              {pendingClubRequest.clubName} — awaiting approval
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-8 p-4 bg-white rounded-3xl border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">No Club Affiliation</p>
                            <button
                              onClick={() => setIsJoinClubOpen(true)}
                              className="bg-slate-900 text-white rounded-xl h-8 px-4 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all mt-1"
                            >
                              Join a Club
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}


                {user?.role !== 'club' && (
                  <button
                    onClick={() => setIsLeaveModalOpen(true)}
                    className="w-full mt-3 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-50 active:scale-[0.98] transition-all border border-red-100"
                  >
                    Leave Team
                  </button>
                )}
              </div>
            </motion.div>
          ) : viewingDetail === 'gallery' ? (
            <motion.div 
              key="gallery-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white min-h-screen"
            >
              <div className="p-4 flex items-center gap-4 border-b border-slate-100">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setViewingDetail(null)}
                  className="rounded-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-lg font-black text-slate-900 uppercase italic flex-1">Team Gallery</h2>
                <Button size="sm" className="rounded-xl h-8 text-[9px] font-black uppercase tracking-widest">
                  <Plus className="w-3 h-3 mr-1" /> Upload
                </Button>
              </div>
              <div className="p-4 grid grid-cols-3 gap-2">
                {[1,2,3,4,5,6,7,8,9].map(i => (
                  <div key={i} className="aspect-square bg-slate-100 rounded-xl overflow-hidden">
                    <img 
                      src={`https://picsum.photos/seed/sports-${i}/300/300`} 
                      alt="Gallery" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          ) : viewingDetail === 'resources' ? (
            <motion.div
              key="resources-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white min-h-screen"
            >
              <div className="p-4 flex items-center gap-4 border-b border-slate-100">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewingDetail(null)}
                  className="rounded-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-lg font-black text-slate-900 uppercase italic flex-1">Team Resources</h2>
              </div>
              <div className="p-4 space-y-6">
                {/* Files Section */}
                {teamResources.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Files</h3>
                    {teamResources.map((d: any) => (
                      <div key={d.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                        <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm truncate">{d.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d.size} • {d.type}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-slate-300">
                          <Download className="w-5 h-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Archive Button */}
                <button
                  onClick={() => { setShowArchiveList(true); setArchiveSearch(''); }}
                  className="w-full flex items-center gap-4 p-4 bg-slate-50 rounded-2xl text-left hover:bg-slate-100 active:scale-[0.98] transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                    <Archive className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm">Archive</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {archivedLineups.length > 0 ? `${archivedLineups.length} past lineup${archivedLineups.length === 1 ? '' : 's'}` : 'No archived lineups yet'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              </div>

              {/* Archive Detail Modal */}
              <AnimatePresence>
                {showArchiveList && !viewingArchive && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/50 z-[60]"
                      onClick={() => setShowArchiveList(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92%] max-w-sm max-h-[85vh] flex flex-col bg-white rounded-[2rem] shadow-2xl overflow-hidden"
                    >
                      <div className="bg-slate-900 p-6 flex items-center justify-between">
                        <h2 className="text-white text-sm font-black uppercase tracking-widest">Archive</h2>
                        <button onClick={() => setShowArchiveList(false)} className="text-white/70 hover:text-white">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {archivedLineups.length > 0 && (
                          <div className="p-4 pb-0">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                              <input
                                type="text"
                                placeholder="Search by event name..."
                                value={archiveSearch}
                                onChange={(e) => setArchiveSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 border-0 focus:outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </div>
                          </div>
                        )}
                        <div className="p-4 space-y-3">
                          {(() => {
                            if (archivedLineups.length === 0) {
                              return (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                                    <Archive className="w-7 h-7 text-slate-300" />
                                  </div>
                                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No archived lineups yet</p>
                                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1">Past lineups will appear here automatically</p>
                                </div>
                              );
                            }

                            const filtered = archivedLineups.filter((a: any) =>
                              !archiveSearch || a.event?.title?.toLowerCase().includes(archiveSearch.toLowerCase()) || a.lineupName?.toLowerCase().includes(archiveSearch.toLowerCase())
                            );

                            if (filtered.length === 0) {
                              return (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No matches found</p>
                                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1">Try a different search</p>
                                </div>
                              );
                            }

                            return filtered.map((archive: any) => (
                              <button
                                key={archive.id}
                                onClick={() => { setViewingArchive(archive); setArchiveNotesEdit(archive.notesAndResults || ''); }}
                                className="w-full flex items-center gap-4 p-4 bg-slate-50 rounded-2xl text-left hover:bg-slate-100 active:scale-[0.98] transition-all"
                              >
                                <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                                  <Calendar className="w-5 h-5 text-slate-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-slate-900 text-sm truncate">{archive.lineupName}</h4>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {archive.event?.title} • {archive.event?.date ? new Date(archive.event.date + 'T00:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                                  </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                              </button>
                            ));
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
                {viewingArchive && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/50 z-[60]"
                      onClick={() => setViewingArchive(null)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92%] max-w-sm max-h-[85vh] flex flex-col bg-white rounded-[2rem] shadow-2xl overflow-hidden"
                    >
                      <div className="bg-slate-900 p-6 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h2 className="text-white text-sm font-black uppercase tracking-widest truncate">{viewingArchive.lineupName}</h2>
                          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1">{viewingArchive.event?.title}</p>
                        </div>
                        <button onClick={() => setViewingArchive(null)} className="text-white/70 hover:text-white ml-3">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Event Info */}
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Event Details</h4>
                          <div className="bg-slate-50 rounded-2xl p-3 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[11px] font-medium text-slate-700">
                                {viewingArchive.event?.date ? new Date(viewingArchive.event.date + 'T00:00:00').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'No date'}
                              </span>
                            </div>
                            {viewingArchive.event?.time && (
                              <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-[11px] font-medium text-slate-700">{viewingArchive.event.time}</span>
                              </div>
                            )}
                            {viewingArchive.event?.location && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-[11px] font-medium text-slate-700">{viewingArchive.event.location}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Squad */}
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Squad</h4>
                          {viewingArchive.squads?.map((squad: any) => (
                            <div key={squad.id} className="bg-slate-50 rounded-2xl p-3 space-y-1">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{squad.name}</p>
                              {squad.players?.filter(Boolean).map((player: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 py-1">
                                  <span className="text-[10px] font-bold text-slate-400 w-5 text-right">{i + 1}</span>
                                  <span className="text-[11px] font-medium text-slate-700">{player.name || player}</span>
                                  {player.position && <span className="text-[9px] font-bold text-slate-400 ml-auto">{player.position}</span>}
                                </div>
                              ))}
                              {(!squad.players || squad.players.filter(Boolean).length === 0) && (
                                <p className="text-[10px] text-slate-400 italic">No players</p>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Attendance */}
                        {viewingArchive.attendance?.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attendance</h4>
                            <div className="bg-slate-50 rounded-2xl p-3 space-y-1">
                              {viewingArchive.attendance.map((a: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 py-1">
                                  <div className={`w-2 h-2 rounded-full ${a.status === 'going' ? 'bg-green-500' : 'bg-red-500'}`} />
                                  <span className="text-[11px] font-medium text-slate-700 flex-1">{a.userName}</span>
                                  <span className={`text-[9px] font-bold uppercase ${a.status === 'going' ? 'text-green-600' : 'text-red-500'}`}>
                                    {a.status}
                                  </span>
                                  {a.reason && <span className="text-[9px] text-slate-400 italic ml-1">— {a.reason}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes & Results */}
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes & Results</h4>
                          {isTeamCoach ? (
                            <div className="space-y-2">
                              <textarea
                                value={archiveNotesEdit}
                                onChange={(e) => setArchiveNotesEdit(e.target.value)}
                                placeholder="Add match notes, scores, results..."
                                rows={3}
                                className="w-full bg-slate-50 rounded-2xl p-3 text-[11px] text-slate-700 placeholder:text-slate-300 border-0 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                              />
                              {archiveNotesEdit !== (viewingArchive.notesAndResults || '') && (
                                <button
                                  onClick={() => {
                                    StorageService.updateArchivedLineup(selectedTeamId!, viewingArchive.id, { notesAndResults: archiveNotesEdit });
                                    setViewingArchive({ ...viewingArchive, notesAndResults: archiveNotesEdit });
                                  }}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  Save
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="bg-slate-50 rounded-2xl p-3">
                              <p className="text-[11px] text-slate-700 whitespace-pre-wrap">
                                {viewingArchive.notesAndResults || <span className="text-slate-300 italic">No notes added</span>}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          ) : viewingDetail === 'squad' ? (
            <motion.div 
              key="squad-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white min-h-screen"
            >
              <div className="p-4 flex items-center gap-4 border-b border-slate-100">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setViewingDetail(null)}
                  className="rounded-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-lg font-black text-slate-900 uppercase italic flex-1">Team Management</h2>
                {isTeamCoach && (
                  <button
                    onClick={() => setIsSquadEditMode(p => !p)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase
                               tracking-widest transition-all ${
                      isSquadEditMode
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {isSquadEditMode ? 'Done' : 'Edit'}
                  </button>
                )}
              </div>

              <div className="p-4 space-y-6">
                {/* Coaches Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Coaches</h3>
                  {(() => {
                    const coachId = selectedTeam?.coachId || (selectedTeam?.createdBy) || 'coach-sarah';
                    const coachData = StorageService.getUserData(coachId);
                    const coachName = coachData?.name || selectedTeam?.coach || user?.name || 'Coach';
                    const coachAvatar = coachData?.avatar || null;

                    return (
                      <button 
                        onClick={() => onTabChange?.('profile')} // TODO: deep-link to coach profile post-Firebase
                        className="w-full flex items-center gap-4 p-4 bg-slate-900 rounded-2xl text-white text-left hover:bg-slate-800 transition-colors"
                      >
                        <DefaultAvatar src={coachAvatar} name={coachName} size="md" className="rounded-xl border-2 border-primary shadow-sm" />
                        <div className="flex-1">
                          <h4 className="font-bold text-sm uppercase italic">{coachName}</h4>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Head Coach</p>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          COACH
                        </span>
                      </button>
                    );
                  })()}
                  {MOCK_LINEUP.filter(p => memberRoles[p.id] === 'coach').map((player, idx) => (
                    <div key={player.id || idx} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                      <DefaultAvatar name={player.name} size="md" className="rounded-xl border-2 border-white shadow-sm" />
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 text-sm">{player.name}</h4>
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest">Coach</p>
                      </div>
                      {isSquadEditMode ? (
                        <button
                          onClick={() => {
                            setMemberToRemove({ id: player.id, name: player.name });
                            setShowRemoveModal(true);
                          }}
                          className="w-7 h-7 rounded-full bg-red-50 border border-red-200
                                     flex items-center justify-center text-red-400 text-lg font-light shrink-0"
                        >
                          −
                        </button>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Managers Section */}
                {MOCK_LINEUP.filter(p => memberRoles[p.id] === 'manager').length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Managers</h3>
                    {MOCK_LINEUP.filter(p => memberRoles[p.id] === 'manager').map((player) => (
                      <div key={player.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                        <DefaultAvatar name={player.name} size="md" className="rounded-xl border-2 border-white shadow-sm" />
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900 text-sm">{player.name}</h4>
                          <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Manager</p>
                        </div>
                        {isSquadEditMode ? (
                          <button
                            onClick={() => {
                              setMemberToRemove({ id: player.id, name: player.name });
                              setShowRemoveModal(true);
                            }}
                            className="w-7 h-7 rounded-full bg-red-50 border border-red-200
                                       flex items-center justify-center text-red-400 text-lg font-light shrink-0"
                          >
                            −
                          </button>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  {(() => {
                    const allChildren = JSON.parse(localStorage.getItem('gameday_children') || '[]');
                    const teamChildren = allChildren.filter((c: any) => c.teamIds?.includes(selectedTeam?.id));
                    return (
                      <div className="flex justify-between items-center px-2 mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {rosterMembers.length + teamChildren.length} Members
                        </span>
                        <div className="relative w-32">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                          <Input placeholder="Search..." className="h-7 pl-6 text-[10px] bg-slate-50 border-none rounded-lg" />
                        </div>
                      </div>
                    );
                  })()}
                  {rosterMembers.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                        No members yet — share your team code to get started.
                      </p>
                    </div>
                  ) : (
                    rosterMembers.map((member, idx) => (
                      <div 
                        key={member.id || idx} 
                        onClick={() => !isSquadEditMode && onTabChange?.('profile', member.id)}
                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl group active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <DefaultAvatar src={member.avatar} name={member.name} size="md" className="rounded-xl border-2 border-white shadow-sm" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 text-sm">{member.name}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-primary uppercase tracking-wider">
                              {member.role === 'player' || member.role === 'Player' ? 'Member' : (member.position || member.role || 'Member')}
                            </span>
                          </div>
                        </div>
                        {isSquadEditMode ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMemberToRemove(member);
                              setShowRemoveModal(true);
                            }}
                            className="w-7 h-7 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-400 text-lg font-light shrink-0"
                          >
                            −
                          </button>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                    ))
                  )}

                  {(() => {
                    const all = JSON.parse(localStorage.getItem('gameday_children') || '[]');
                    const teamChildren = all.filter((c: any) => c.teamIds?.includes(selectedTeam?.id));
                    return teamChildren.map((child: any, idx: number) => (
                      <div key={child.id || idx} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                        <DefaultAvatar name={child.name} size="md" className="rounded-xl border-2 border-white shadow-sm" />
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900 text-sm">{child.name}</h4>
                          <p className="text-[10px] text-slate-400 italic">
                            {child.parentNames?.join(' & ')}
                          </p>
                        </div>
                        {isSquadEditMode ? (
                          <button
                            onClick={() => {
                              setMemberToRemove({ id: child.id, name: child.name });
                              setShowRemoveModal(true);
                            }}
                            className="w-7 h-7 rounded-full bg-red-50 border border-red-200
                                       flex items-center justify-center text-red-400 text-lg font-light shrink-0"
                          >
                            −
                          </button>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-400 text-[7px] font-black border-none">JUNIOR</Badge>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </motion.div>
          ) : viewingDetail === 'schedule' ? (
            <motion.div 
              key="schedule-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white min-h-screen"
            >
              <div className="p-4 flex items-center gap-4 border-b border-slate-100">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setViewingDetail(null)}
                  className="rounded-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-lg font-black text-slate-900 uppercase italic flex-1">Team Schedule</h2>
                {isTeamCoach && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setTeamNewEvent(p => ({
                        ...p,
                        teamId: selectedTeam?.id || '',
                        date: toLocalDateStr(new Date(calendarYear, calendarMonth, selectedDate)),
                        repeatStartDate: toLocalDateStr(new Date(calendarYear, calendarMonth, selectedDate)),
                        repeatEndDate: toLocalDateStr(new Date(calendarYear, calendarMonth + 1, selectedDate)),
                        pinLocation: null,
                        opponent: '',
                      }));
                      setIsTeamSearchingLocation(false);
                      setTeamMapPin(null);
                      setIsTeamEventModalOpen(true);
                    }}
                    className="rounded-xl h-8 text-[9px] font-black 
                               uppercase tracking-widest bg-slate-900 
                               hover:bg-slate-800 text-white"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Event
                  </Button>
                )}
              </div>

              <div className="p-4 space-y-6">
                {/* Flexible Schedule View */}
                <div className="bg-slate-50 rounded-[2rem] p-5 shadow-inner">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <button 
                        onClick={() => setShowMonthPicker(true)}
                        className="font-black text-slate-900 uppercase italic text-lg hover:text-primary transition-colors flex items-center gap-1"
                      >
                        {calendarMonthName} {calendarYear}
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {scheduleView === 'month' ? 'Full Month View' : '7-Day Week View'}
                      </p>
                    </div>
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                      <button 
                        onClick={() => setScheduleView('week')}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          scheduleView === 'week' ? "bg-primary text-white shadow-md" : "text-slate-400 hover:text-slate-600"
                        }`}
                      >Week</button>
                      <button 
                        onClick={() => { setScheduleView('month'); setShowMonthPicker(true); }}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          scheduleView === 'month' ? "bg-primary text-white shadow-md" : "text-slate-400 hover:text-slate-600"
                        }`}
                      >Month</button>
                    </div>
                  </div>

                  {scheduleView === 'month' ? (
                    <>
                      <div className="grid grid-cols-7 gap-2 mb-3">
                        {['S','M','T','W','T','F','S'].map((d, i) => (
                          <div key={`${d}-${i}`} className="text-[10px] font-black text-slate-400 text-center">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                          <div key={`blank-${i}`} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1;
                          const hasEvent = MOCK_SCHEDULE.some(e => e.teamId === selectedTeamId && e.date.includes(day.toString()));
                          const isSelected = selectedDate === day;
                          return (
                            <button
                              key={i}
                              onClick={() => setSelectedDate(day)}
                              className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-xs font-bold relative transition-all active:scale-90 ${
                                isSelected
                                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                  : 'bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {day}
                              {hasEvent && !isSelected && (
                                <div className="absolute bottom-1.5 w-1 h-1 bg-primary rounded-full" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      {/* 4 Cards on Top - Starts from Today */}
                      <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => {
                          const day = Math.min(30, today + i);
                          const dayEvents = [...MOCK_SCHEDULE, ...teamRealEvents].filter(e => e.teamId === selectedTeamId && eventMatchesDay(e.date, day));
                          const dayName = new Date(calendarYear, calendarMonth, day).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                          return (
                            <button 
                              key={i}
                              onClick={() => setSelectedDate(day)}
                              className={`p-4 rounded-[2rem] text-left transition-all active:scale-95 border-2 ${
                                selectedDate === day ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'bg-white border-transparent'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${selectedDate === day ? 'text-white' : 'text-slate-900'}`}>
                                  {dayName}
                                </span>
                                <span className={`text-sm font-black italic ${selectedDate === day ? 'text-white' : 'text-slate-900'}`}>
                                  {day}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {dayEvents.length > 0 ? (
                                  Object.entries(getTeamEventTypeCounts(dayEvents)).map(([type, count]) => {
                                    const style = TEAM_EVENT_TYPE_STYLES[type as keyof typeof TEAM_EVENT_TYPE_STYLES] || TEAM_EVENT_TYPE_STYLES.event;
                                    return (
                                      <span key={type} className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[9px] font-black ring-1 ring-white/60 ${selectedDate === day ? `${style.selectedBg} ${style.selectedText}` : `${style.bg} ${style.text}`}`}>
                                        {count}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className={`text-[9px] font-bold italic ${selectedDate === day ? 'text-white/40' : 'text-slate-300'}`}>No events</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {/* 3 Cards on Bottom - Next 3 days */}
                      <div className="grid grid-cols-3 gap-3">
                        {Array.from({ length: 3 }).map((_, i) => {
                          const day = Math.min(30, today + 4 + i);
                          const dayEvents = [...MOCK_SCHEDULE, ...teamRealEvents].filter(e => e.teamId === selectedTeamId && eventMatchesDay(e.date, day));
                          const dayName = new Date(calendarYear, calendarMonth, day).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                          return (
                            <button 
                              key={i}
                              onClick={() => setSelectedDate(day)}
                              className={`p-3 rounded-[1.5rem] text-left transition-all active:scale-95 border-2 ${
                                selectedDate === day ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'bg-white border-transparent'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className={`text-[8px] font-black uppercase tracking-widest ${selectedDate === day ? 'text-white' : 'text-slate-900'}`}>
                                  {dayName}
                                </span>
                                <span className={`text-xs font-black italic ${selectedDate === day ? 'text-white' : 'text-slate-900'}`}>
                                  {day}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {dayEvents.length > 0 ? (
                                  Object.entries(getTeamEventTypeCounts(dayEvents)).map(([type, count]) => {
                                    const style = TEAM_EVENT_TYPE_STYLES[type as keyof typeof TEAM_EVENT_TYPE_STYLES] || TEAM_EVENT_TYPE_STYLES.event;
                                    return (
                                      <span key={type} className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[9px] font-black ring-1 ring-white/60 ${selectedDate === day ? `${style.selectedBg} ${style.selectedText}` : `${style.bg} ${style.text}`}`}>
                                        {count}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className={`text-[8px] font-bold italic ${selectedDate === day ? 'text-white/40' : 'text-slate-300'}`}>No events</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-xs font-black text-slate-400 
                                uppercase tracking-widest">
                    Events for {calendarMonthName} {selectedDate}
                  </h3>
                  <Badge variant="outline" className="text-[8px] font-bold border-slate-200 text-slate-400">
                    {[...MOCK_SCHEDULE, ...teamRealEvents].filter(e => e.teamId === selectedTeamId && eventMatchesDay(e.date, selectedDate)).length || 0} EVENTS
                  </Badge>
                </div>

                  {[...MOCK_SCHEDULE, ...teamRealEvents].filter(e => e.teamId === selectedTeamId && eventMatchesDay(e.date, selectedDate)).length > 0 ? (
                    [...MOCK_SCHEDULE, ...teamRealEvents].filter(e => e.teamId === selectedTeamId && eventMatchesDay(e.date, selectedDate)).map((event) => {
                      const isExpanded = expandedEventId === event.id;
                      return (
                        <Card key={event.id} className="border-none shadow-sm overflow-hidden bg-slate-50/50 transition-all duration-300">
                          <CardContent className="p-0">
                            <button 
                              onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                              className="w-full p-4 flex items-center justify-between hover:bg-slate-100/50 transition-colors text-left"
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 relative ${
                                  event.type === 'match' ? 'bg-red-50 text-red-500' :
                                  event.type === 'meeting' ? 'bg-amber-50 text-amber-500' :
                                  event.type === 'event' ? 'bg-purple-50 text-purple-500' :
                                  event.type === 'custom' ? 'bg-slate-50 text-slate-500' :
                                  'bg-blue-50 text-blue-500'
                                }`}>
                                  {event.type === 'match' && <Trophy className="w-4 h-4" />}
                                  {event.type === 'training' && <Activity className="w-4 h-4" />}
                                  {event.type === 'meeting' && <Users className="w-4 h-4" />}
                                  {event.type === 'event' && <PartyPopper className="w-4 h-4" />}
                                  {event.type === 'custom' && <Pencil className="w-4 h-4" />}
                                  {!['match','training','meeting','event','custom'].includes(event.type) && <Activity className="w-4 h-4" />}
                                  <span className="text-[7px] font-black uppercase mt-0.5">{event.type}</span>
                                  
                                  {/* Attendance Indicator Dot */}
                                  {attendance[event.id] && (
                                    <motion.div 
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${
                                        attendance[event.id] === 'going' ? 'bg-green-500' : 'bg-red-500'
                                      }`} 
                                    />
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-900 text-sm">{event.title}</h4>
                                  <p className="text-[10px] text-slate-400 font-medium">{formatEventDate(event.date)} • {formatEventTime(event.time)}</p>
                                </div>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="px-4 pb-4 space-y-4"
                                >
                                  <div className="pl-14 space-y-2">
                                    <div className="flex items-center gap-1 text-slate-400">
                                      <MapPin className="w-3 h-3" />
                                      <span className="text-xs font-medium truncate">{event.location}</span>
                                    </div>
                                    {event.notes && <p className="text-[10px] text-slate-400 italic">Note: {event.notes}</p>}
                                  </div>
                                  
                                  <div className="pt-3 border-t border-slate-100 space-y-2">
                                    {/* Going / Absent — all roles */}
                                    <div className="flex gap-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleAttendance(event.id, 'going'); }}
                                        className={`flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                                          attendance[event.id] === 'going'
                                            ? 'bg-green-500 text-white'
                                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                                        }`}
                                      >
                                        ✓ Going
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleAttendance(event.id, 'absent'); }}
                                        className={`flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                                          attendance[event.id] === 'absent'
                                            ? 'bg-red-500 text-white'
                                            : 'bg-red-50 text-red-500 hover:bg-red-100'
                                        }`}
                                      >
                                        ✗ Absent
                                      </button>
                                    </div>

                                    {/* Count + View All — coach only */}
                                    {isTeamCoach && (() => {
                                      const records = teamsAttendanceData[event.id] || [];
                                      const goingCount = records.filter((r: any) => r.status === 'going').length;
                                      const absentCount = records.filter((r: any) => r.status === 'absent').length;
                                      return (
                                        <div className="flex items-center justify-between px-1">
                                          <div className="flex items-center gap-2">
                                            {goingCount > 0 && <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">{goingCount} going</span>}
                                            {absentCount > 0 && <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">{absentCount} absent</span>}
                                          </div>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setTeamsAttendanceData(StorageService.getAttendance()); setTeamsAttendanceModalEvent(event); }}
                                            className="h-7 px-3 rounded-xl border border-slate-200 bg-white text-slate-500 text-[8px] font-black uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all"
                                          >
                                            View All
                                          </button>
                                        </div>
                                      );
                                    })()}

                                    {/* Delete — coach only */}
                                    {isTeamCoach && (
                                      pendingDeleteEventId === event.id ? (
                                        <div className="space-y-2 mt-1">
                                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Remove this event for all members?</p>
                                          <div className="flex gap-2">
                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); setPendingDeleteEventId(null); }} className="flex-1 h-9 rounded-xl text-[9px] font-black uppercase tracking-widest bg-red-500 text-white">Yes, Delete</button>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); setPendingDeleteEventId(null); }} className="flex-1 h-9 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">Cancel</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button type="button" onClick={(e) => { e.stopPropagation(); setPendingDeleteEventId(event.id); }} className="w-full h-9 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-400 hover:bg-red-50 transition-all border border-red-100">
                                          Delete Event
                                        </button>
                                      )
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </CardContent>
                        </Card>
                      );
                    })
                  ) : (
                    <div className="p-12 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                      <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No events scheduled for this day</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="lineup-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white min-h-screen"
            >
              {/* LINEUP LIST VIEW */}
              {!activeLineupId ? (
                <div className="flex-1 flex flex-col h-full bg-white">
                  <div className="p-4 flex items-center gap-4 border-b border-slate-100">
                    <Button variant="ghost" size="icon" onClick={() => setViewingDetail(null)} className="rounded-full">
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <h2 className="text-lg font-black text-slate-900 uppercase italic flex-1">Lineups</h2>
                    <button
                      onClick={() => { setNewLineupName(''); setIsCreatingLineup(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-[9px] font-black uppercase tracking-widest"
                    >
                      <Plus className="w-3.5 h-3.5" /> New
                    </button>
                  </div>

                  <div className="p-4 space-y-3">
                    {lineups.length === 0 && (
                      <div className="text-center py-16 text-slate-300">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="text-[11px] font-black uppercase tracking-widest">No lineups yet</p>
                        {(user?.role === 'coach' || user?.role === 'manager' || user?.role === 'club') && (
                          <p className="text-[10px] text-slate-400 mt-1">Tap New to create your first lineup</p>
                        )}
                      </div>
                    )}
                    {lineups.map((lineup) => (
                      <div key={lineup.id} className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-all">
                        <button
                          className="flex-1 flex items-center gap-4 text-left"
                          onClick={() => {
                            setActiveLineupId(lineup.id);
                          }}
                        >
                          <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 truncate">{lineup.name}</h4>

                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                        </button>
                        {(user?.role === 'coach' || user?.role === 'manager' || user?.role === 'club') && (
                          confirmDeleteLineupId === lineup.id ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => {
                                StorageService.deleteLineup(selectedTeamId!, lineup.id);
                                setConfirmDeleteLineupId(null);
                              }} className="px-2 py-1 rounded-lg bg-red-500 text-white text-[9px] font-black uppercase">
                                Delete
                              </button>
                              <button onClick={() => setConfirmDeleteLineupId(null)} className="px-2 py-1 rounded-lg bg-slate-200 text-slate-600 text-[9px] font-black uppercase">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteLineupId(lineup.id)}
                              className="w-8 h-8 rounded-xl border border-red-100 flex items-center justify-center text-red-300 hover:bg-red-50 transition-all shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Create Lineup Modal */}
                  {isCreatingLineup && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
                      <div className="bg-white rounded-[2rem] w-full max-w-md p-6 space-y-4">
                        <h3 className="text-base font-black text-slate-900 uppercase italic">New Lineup</h3>
                        <input
                          autoFocus
                          value={newLineupName}
                          onChange={e => setNewLineupName(e.target.value)}
                          placeholder="e.g. Vs. Pukekohe Apr 12"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-primary/50"
                        />
                        <div className="mt-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Link to Event (optional)</p>
                          <input
                            type="text"
                            placeholder="Search events..."
                            value={lineupEventSearch}
                            onChange={e => setLineupEventSearch(e.target.value)}
                            className="w-full h-9 bg-slate-50 rounded-xl px-3 text-[11px] font-bold text-slate-700 outline-none mb-2"
                          />
                          <div className="max-h-36 overflow-y-auto space-y-1.5">
                            {StorageService.getEvents()
                              .filter(e => e.teamId === selectedTeamId)
                              .filter(e => {
                                const today = new Date(); today.setHours(0,0,0,0);
                                return parseEventDate(e.date) >= today;
                              })
                              .filter(e => !lineupEventSearch || e.title?.toLowerCase().includes(lineupEventSearch.toLowerCase()) || e.date?.includes(lineupEventSearch))
                              .sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime())
                              .map(event => (
                                <button
                                  key={event.id}
                                  type="button"
                                  onClick={() => setNewLineupEventId(prev => prev === event.id ? '' : event.id)}
                                  className={`w-full text-left px-3 py-2 rounded-xl border-2 transition-all ${
                                    newLineupEventId === event.id ? 'border-primary bg-primary/5' : 'border-transparent bg-slate-50 hover:bg-slate-100'
                                  }`}
                                >
                                  <p className="text-[11px] font-black text-slate-900">{event.title}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">{event.date} · {event.time}</p>
                                </button>
                              ))
                            }
                          </div>
                        </div>
                              <div className="flex gap-3">
                                <button onClick={() => {
                                  setIsCreatingLineup(false);
                                  setNewLineupEventId('');
                                  setLineupEventSearch('');
                                }} className="flex-1 h-11 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                  Cancel
                                </button>
                                <button
                                  disabled={!newLineupName.trim()}
                                  onClick={() => {
                                    const newLineup = {
                                      id: Date.now().toString(),
                                      name: newLineupName.trim(),
                                      squads: [{
                                        id: 'squad-1',
                                        name: 'Main Squad',
                                        players: [],
                                      }],
                                      savedAt: new Date().toISOString(),
                                      eventId: newLineupEventId || null,
                                    };
                                    StorageService.saveLineup(selectedTeamId!, newLineup);
                                    setActiveLineupId(newLineup.id);
                                    setIsCreatingLineup(false);
                                  }}
                                  className="flex-1 h-11 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                                >
                                  Create
                                </button>
                              </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : activeLineup && (
                <div className="flex flex-col min-h-screen bg-slate-50">
                  <div className="p-4 flex items-center gap-4 border-b border-slate-100 bg-white sticky top-0 z-40">
                        <Button variant="ghost" size="icon" onClick={() => setActiveLineupId(null)} className="rounded-full">
                          <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <h2 className="text-lg font-black text-slate-900 uppercase italic flex-1 truncate">
                          {activeLineup.name}
                        </h2>
                        <button
                          onClick={() => { setRenameLineupValue(activeLineup.name); setIsRenamingLineup(true); }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-600 transition-all"
                        >
                          Rename
                        </button>
                      </div>

                      <div className="p-4 space-y-6">
                        <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16" />

                          <h3 className="text-2xl font-black italic uppercase leading-tight mb-2 text-white">{activeLineup.name}</h3>
                          <p className="text-white/70 text-xs font-bold uppercase tracking-widest">
                            {activeLineup.savedAt ? new Date(activeLineup.savedAt).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'short' }) : ''}
                          </p>
                        </div>

                        {/* Inline Squads Section */}
                        <div className="pb-32">
                          {pickerEventTitle && (
                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 px-4 mb-4">
                              Availability for: {pickerEventTitle}
                            </p>
                          )}
                          {(activeLineup.squads || []).map((squad: any, squadIndex: number) => (
                            <div key={squad.id} className="mb-8">
                                {/* Squad title row */}
                                <div className="flex items-center justify-between px-4 mb-3">
                                  <div className="flex items-center gap-2">
                                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{squad.name}</h3>
                                  <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">
                                    {(squad.players || []).filter((p: any) => p !== null).length}/{(squad.players || []).length}
                                  </span>
                                  <button onClick={() => {
                                    setActiveSquadId(squad.id);
                                    setRenameSquadValue(squad.name);
                                    setIsRenamingSquad(true);
                                  }} className="p-1 hover:bg-slate-100 rounded-lg text-slate-300">
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <button onClick={() => {
                                  // Append a null slot to the players array
                                  const updatedSquads = activeLineup.squads.map((s: any) =>
                                    s.id === squad.id ? { ...s, players: [...(s.players || []), null] } : s
                                  );
                                  StorageService.saveLineup(selectedTeamId!, { ...activeLineup, squads: updatedSquads, savedAt: new Date().toISOString() });
                                }} className="flex items-center gap-1.5 text-[9px] font-black text-primary uppercase tracking-widest hover:opacity-70">
                                  <Plus className="w-3.5 h-3.5" /> Add Slot
                                </button>
                              </div>

                              {/* Fixed Players Slots */}
                              <div className="space-y-1.5 px-2">
                                {(squad.players || []).map((slot: any, idx: number) => {
                                  const playerId = slot?.playerId || (typeof slot === 'string' ? slot : null);
                                  const player = playerId ? MOCK_LINEUP.find(p => p.id === playerId) : null;
                                  
                                  if (!player) {
                                    return (
                                      <button
                                        key={`${squad.id}-p-${idx}`}
                                        onClick={() => {
                                          setActiveSquadId(squad.id);
                                          setPlayerPickerSlotIdx(idx);

                                          // Load attendance for the linked event
                                          const linkedEventId = activeLineup?.eventId;
                                          const attendanceMap: Record<string, 'going' | 'absent'> = {};
                                          if (linkedEventId) {
                                            const allAttendance = StorageService.getAttendance();
                                            const records = allAttendance[linkedEventId] || [];
                                            records.forEach(r => { if (r.status) attendanceMap[r.userName] = r.status as 'going' | 'absent'; });
                                          }
                                          setPickerAttendance(attendanceMap);
                                          setIsPlayerPickerOpen(true);
                                        }}
                                        className="w-full h-14 flex items-center gap-4 px-4 rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/30 hover:border-primary/20 hover:bg-slate-50 transition-all group"
                                      >
                                        <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black italic text-slate-300">
                                          {idx + 1}
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 group-hover:text-primary/40">Empty Slot</span>
                                        <Plus className="w-4 h-4 text-slate-200 ml-auto group-hover:text-primary transition-colors" />
                                      </button>
                                    );
                                  }

                                  return (
                                    <div 
                                      key={`${squad.id}-p-${idx}`} 
                                      draggable
                                      onDragStart={() => setDraggedPlayerIndex({ squadId: squad.id, index: idx, type: 'starting' })}
                                      onDragOver={(e) => { e.preventDefault(); setDragOverIndex({ squadId: squad.id, index: idx, type: 'starting' }); }}
                                      onDragEnd={() => { setDraggedPlayerIndex(null); setDragOverIndex(null); }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        if (!draggedPlayerIndex || draggedPlayerIndex.squadId !== squad.id) return;
                                        const players = [...(squad.players || [])];
                                        const [moved] = players.splice(draggedPlayerIndex.index, 1);
                                        players.splice(idx, 0, moved);
                                        const updatedSquads = activeLineup.squads.map((s: any) =>
                                          s.id === squad.id ? { ...s, players } : s
                                        );
                                        StorageService.saveLineup(selectedTeamId!, { ...activeLineup, squads: updatedSquads, savedAt: new Date().toISOString() });
                                        setDraggedPlayerIndex(null);
                                        setDragOverIndex(null);
                                      }}
                                      className={cn(
                                        "flex items-center gap-3 bg-white border border-slate-100 rounded-2xl p-2.5 group",
                                        dragOverIndex?.squadId === squad.id && dragOverIndex?.index === idx ? "border-2 border-primary border-dashed" : ""
                                      )}
                                    >
                                      <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0 cursor-grab" />
                                      <div className="w-7 h-7 rounded-xl bg-slate-50 flex items-center justify-center text-[10px] font-black italic text-slate-400 shadow-sm shrink-0">
                                        {idx + 1}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold text-slate-900 truncate uppercase tracking-tight">{player.name}</p>
                                        <p className="text-[8px] font-black text-primary/50 uppercase tracking-widest -mt-0.5">{player.position}</p>
                                      </div>
                                      {(() => {
                                        const status = pickerAttendance[player.name];
                                        if (!status) return null;
                                        return (
                                          <div className={`w-2 h-2 rounded-full shrink-0 ${status === 'going' ? 'bg-green-500' : 'bg-red-500'}`} />
                                        );
                                      })()}
                                      <button 
                                        onClick={() => {
                                          const updatedSquads = activeLineup.squads.map((s: any) => {
                                            if (s.id === squad.id) {
                                              const players = [...(s.players || [])];
                                              players.splice(idx, 1);
                                              return { ...s, players };
                                            }
                                            return s;
                                          });
                                          StorageService.saveLineup(selectedTeamId!, { ...activeLineup, squads: updatedSquads, savedAt: new Date().toISOString() });
                                        }}
                                        className="w-7 h-7 rounded-xl bg-red-50 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <Minus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                                {(squad.players || []).length === 0 && (
                                  <div className="py-4 text-center border-2 border-dashed border-slate-100 rounded-2xl mx-2">
                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Empty Squad</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                          <button 
                            onClick={() => {
                              setIsAddingSquad(true);
                              setNewSquadName('');
                            }}
                            className="w-full mt-4 py-5 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 text-slate-400 hover:text-primary hover:border-primary/30 transition-all group"
                          >
                            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Add Another Squad</span>
                          </button>
                        </div>
                      </div>

                      {/* Add Squad modal */}
                      {isAddingSquad && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-6">
                          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 space-y-4">
                            <h3 className="text-base font-black text-slate-900 uppercase italic">New Squad</h3>
                            <input autoFocus value={newSquadName} onChange={e => setNewSquadName(e.target.value)} placeholder="e.g. Boat 1, Attack Group" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-primary/50" />
                            <div className="flex gap-3">
                              <button onClick={() => setIsAddingSquad(false)} className="flex-1 h-11 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Cancel
                              </button>
                              <button disabled={!newSquadName.trim()} onClick={() => { const newSquad = { id: Date.now().toString(), name: newSquadName.trim(), players: [] }; const updatedSquads = [...(activeLineup?.squads || []), newSquad]; StorageService.saveLineup(selectedTeamId!, { ...activeLineup, squads: updatedSquads }); setIsAddingSquad(false); }} className="flex-1 h-11 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
                                Create
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Rename Squad Modal */}
                      {isRenamingSquad && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-6">
                          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 space-y-4">
                            <h3 className="text-base font-black text-slate-900 uppercase italic">Rename Squad</h3>
                            <input 
                              autoFocus 
                              value={renameSquadValue} 
                              onChange={e => setRenameSquadValue(e.target.value)} 
                              placeholder="e.g. Boat 1" 
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-primary/50" 
                            />
                            <div className="flex gap-3">
                              <button onClick={() => setIsRenamingSquad(false)} className="flex-1 h-11 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Cancel
                              </button>
                              <button 
                                disabled={!renameSquadValue.trim()} 
                                onClick={() => {
                                  const updatedSquads = activeLineup.squads.map((s: any) => 
                                    s.id === activeSquadId ? { ...s, name: renameSquadValue.trim() } : s
                                  );
                                  StorageService.saveLineup(selectedTeamId!, { ...activeLineup, squads: updatedSquads });
                                  setIsRenamingSquad(false);
                                }} 
                                className="flex-1 h-11 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Player Picker Modal */}
                      {isPlayerPickerOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-6">
                          <div className="bg-white rounded-[2rem] w-full max-w-sm flex flex-col max-h-[80vh] overflow-hidden shadow-2xl">
                            <div className="p-6 bg-slate-900 shrink-0">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-base font-black text-white uppercase italic">
                                  Add to {activeLineup.squads.find((s: any) => s.id === activeSquadId)?.name}
                                </h3>
                                <button onClick={() => setIsPlayerPickerOpen(false)} className="text-white/40 hover:text-white transition-colors">
                                  <X className="w-5 h-5" />
                                </button>
                              </div>
                              {pickerEventTitle && (
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">
                                  Availability: {pickerEventTitle}
                                </p>
                              )}
                              {!activeLineup?.eventId && (
                                <p className="text-[9px] font-bold text-white/30 text-center">
                                  No event linked — availability unavailable
                                </p>
                              )}
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                              {MOCK_LINEUP.map(p => {
                                const currentSquad = activeLineup.squads.find((s: any) => s.id === activeSquadId);
                                const isAlreadyAdded = (currentSquad?.players || []).some((s: any) => (s?.playerId || s) === p.id);
                                
                                return (
                                  <button 
                                    key={p.id}
                                    disabled={isAlreadyAdded}
                                    onClick={() => {
                                      const updatedSquads = activeLineup.squads.map((s: any) => {
                                        if (s.id === activeSquadId) {
                                          const players = [...(s.players || [])];
                                          if (playerPickerSlotIdx !== null) {
                                            players[playerPickerSlotIdx] = { playerId: p.id };
                                          } else {
                                            players.push({ playerId: p.id });
                                          }
                                          return { ...s, players };
                                        }
                                        return s;
                                      });
                                      StorageService.saveLineup(selectedTeamId!, { ...activeLineup, squads: updatedSquads, savedAt: new Date().toISOString() });
                                      setIsPlayerPickerOpen(false);
                                      setPlayerPickerSlotIdx(null);
                                    }}
                                    className={cn(
                                      "w-full flex items-center justify-between p-4 rounded-[1.25rem] transition-all text-left group",
                                      isAlreadyAdded 
                                        ? "bg-slate-100 opacity-50 cursor-not-allowed" 
                                        : "bg-white border border-slate-100 hover:border-primary/30 hover:shadow-md"
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-[10px] font-black italic text-slate-400">
                                        #
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-black text-slate-900 uppercase">{p.name}</p>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{p.position}</p>
                                      </div>
                                      {(() => {
                                        const status = pickerAttendance[p.name];
                                        if (!status) return <div className="w-2 h-2 rounded-full bg-slate-200 ml-auto mr-2" />;
                                        return (
                                          <div className={`w-2 h-2 rounded-full ml-auto mr-2 ${status === 'going' ? 'bg-green-500' : 'bg-red-500'}`} />
                                        );
                                      })()}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {!isAlreadyAdded && <Plus className="w-4 h-4 text-slate-200 group-hover:text-primary transition-colors" />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                              <button 
                                onClick={() => setIsPlayerPickerOpen(false)}
                                className="w-full h-12 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 active:scale-[0.98] transition-all"
                              >
                                Close Picker
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Rename Lineup Modal */}
                      {isRenamingLineup && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-6">
                          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 space-y-4 shadow-2xl">
                            <h3 className="text-base font-black text-slate-900 uppercase italic">Rename Lineup</h3>
                            <input
                              autoFocus
                              value={renameLineupValue}
                              onChange={e => setRenameLineupValue(e.target.value)}
                              placeholder="e.g. Vs. Pukekohe Apr 12"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-primary/50"
                            />
                            <div className="flex gap-3">
                              <button onClick={() => setIsRenamingLineup(false)} className="flex-1 h-11 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Cancel
                              </button>
                              <button
                                disabled={!renameLineupValue.trim()}
                                onClick={() => {
                                  const updated = { ...activeLineup, name: renameLineupValue.trim() };
                                  StorageService.saveLineup(selectedTeamId!, updated);
                                  setIsRenamingLineup(false);
                                }}
                                className="flex-1 h-11 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                }
              </motion.div>
            )}
        </AnimatePresence>

      {/* Team Event Modal */}
      <AnimatePresence>
        {isTeamEventModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsTeamEventModalOpen(false);
                setIsTeamSearchingLocation(false);
                setTeamMapPin(null);
                setIsDatePickerOpen(false);
              }}
              className="fixed inset-0 bg-slate-900/60 
                         backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[95%] max-w-md max-h-[90vh] flex flex-col bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-6 shrink-0 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase italic text-white leading-none">
                    Create Event
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {selectedTeam?.name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsTeamEventModalOpen(false);
                    setIsTeamSearchingLocation(false);
                    setTeamMapPin(null);
                    setIsDatePickerOpen(false);
                  }}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 
                                    uppercase tracking-widest px-1">
                    Event Type
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { type: 'training', label: 'Training', icon: Activity },
                      { type: 'match', label: 'Match', icon: Trophy },
                      { type: 'meeting', label: 'Meeting', icon: Users },
                      { type: 'event', label: 'Event', icon: PartyPopper },
                    ].map(({ type, label, icon: Icon }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setTeamNewEvent(p => ({
                          ...p, type: type as any
                        }))}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all text-center",
                          teamNewEvent.type === type
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[9px] font-black uppercase
                                         tracking-widest leading-tight">
                          {label}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTeamNewEvent(p => ({
                        ...p, type: 'custom' as any
                      }))}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all text-center",
                        teamNewEvent.type === 'custom'
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
                      )}
                    >
                      <Pencil className="w-5 h-5" />
                      <span className="text-[9px] font-black uppercase
                                       tracking-widest leading-tight">
                        Custom
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 
                                    uppercase tracking-widest px-1">
                    Event Title
                  </label>
                  <input
                    type="text"
                    placeholder={teamNewEvent.type === 'match' ? 'e.g. Pukekohe RFC' : 'e.g. Thursday Training'}
                    value={teamNewEvent.title}
                    onChange={e => setTeamNewEvent(p => ({
                      ...p, title: e.target.value
                    }))}
                    className="w-full h-12 bg-slate-50 rounded-2xl px-4 text-sm font-bold text-slate-900 border-none outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>


                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 
                                    uppercase tracking-widest px-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={teamNewEvent.time}
                    onChange={e => setTeamNewEvent(p => ({ ...p, time: e.target.value }))}
                    className="w-full h-12 bg-slate-50 rounded-2xl px-4 text-sm font-bold text-slate-900 border-none outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Date</label>
                  
                  {/* Date display button */}
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(p => !p)}
                    className="w-full h-12 bg-slate-50 rounded-2xl px-4 text-sm font-bold text-slate-900 border-none outline-none focus:ring-2 focus:ring-primary/20 flex items-center justify-between"
                  >
                    <span className={teamNewEvent.date ? 'text-slate-900' : 'text-slate-400'}>
                      {teamNewEvent.date
                        ? (() => {
                            const [y, m, d] = teamNewEvent.date.split('-');
                            const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                            return dt.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
                          })()
                        : 'Select a date'}
                    </span>
                    <Calendar className="w-4 h-4 text-slate-400" />
                  </button>

                  {/* Inline calendar */}
                  {isDatePickerOpen && (() => {
                    const { year, month } = datePickerMonth;
                    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                    const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];

                    const selectedDateObj = teamNewEvent.date
                      ? (() => { const [y,m,d] = teamNewEvent.date.split('-'); return new Date(parseInt(y), parseInt(m)-1, parseInt(d)); })()
                      : null;

                    const cells: (number | null)[] = [
                      ...Array(firstDay).fill(null),
                      ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
                    ];
                    // Pad to complete grid
                    while (cells.length % 7 !== 0) cells.push(null);

                    return (
                      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                        {/* Month navigation */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                          <button
                            type="button"
                            onClick={() => setDatePickerMonth(p => {
                              const d = new Date(p.year, p.month - 1, 1);
                              return { year: d.getFullYear(), month: d.getMonth() };
                            })}
                            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-all"
                          >
                            <ChevronLeft className="w-4 h-4 text-slate-600" />
                          </button>
                          <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">
                            {monthNames[month]} {year}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDatePickerMonth(p => {
                              const d = new Date(p.year, p.month + 1, 1);
                              return { year: d.getFullYear(), month: d.getMonth() };
                            })}
                            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-all"
                          >
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                          </button>
                        </div>

                        {/* Day headers */}
                        <div className="grid grid-cols-7 px-2 pt-2">
                          {dayNames.map(d => (
                            <div key={d} className="text-center text-[8px] font-black text-slate-400 uppercase tracking-widest py-1">
                              {d}
                            </div>
                          ))}
                        </div>

                        {/* Day cells */}
                        <div className="grid grid-cols-7 px-2 pb-3 gap-y-1">
                          {cells.map((day, idx) => {
                            if (!day) return <div key={`empty-${idx}`} />;
                            const cellDate = new Date(year, month, day);
                            cellDate.setHours(0, 0, 0, 0);
                            const isPast = cellDate < today;
                            const isToday = cellDate.getTime() === today.getTime();
                            const isSelected = selectedDateObj && cellDate.getTime() === selectedDateObj.getTime();
                            return (
                              <button
                                key={day}
                                type="button"
                                disabled={isPast}
                                onClick={() => {
                                  const iso = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                                  setTeamNewEvent(p => ({ ...p, date: iso }));
                                  setIsDatePickerOpen(false);
                                }}
                                className={`
                                  h-9 w-full rounded-xl text-[11px] font-black transition-all
                                  ${isSelected ? 'bg-primary text-white shadow-lg shadow-primary/30' : ''}
                                  ${isToday && !isSelected ? 'border-2 border-primary text-primary' : ''}
                                  ${!isSelected && !isToday && !isPast ? 'hover:bg-slate-100 text-slate-900' : ''}
                                  ${isPast ? 'text-slate-300 cursor-not-allowed' : ''}
                                `}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Location</label>

                  {teamNewEvent.pinLocation ? (
                    <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                      <img
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${teamNewEvent.pinLocation.lat},${teamNewEvent.pinLocation.lng}&zoom=16&size=600x200&maptype=roadmap&markers=color:red%7C${teamNewEvent.pinLocation.lat},${teamNewEvent.pinLocation.lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                        alt="Pinned location"
                        className="w-full h-32 object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">📍 {teamNewEvent.pinLocation.label || 'Pin Set'}</p>
                          <p className="text-[9px] text-slate-400">{teamNewEvent.pinLocation.lat.toFixed(5)}, {teamNewEvent.pinLocation.lng.toFixed(5)}</p>
                        </div>
                        <button type="button"
                          onClick={() => setTeamNewEvent(p => ({ ...p, pinLocation: null }))}
                          className="text-[9px] font-black text-red-400 uppercase tracking-widest">
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : !isTeamSearchingLocation ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-3">
                        <button type="button"
                          onClick={() => { 
                            setLocationMode('pin');
                            setTeamNewEvent(p => ({ ...p, location: 'Current Location' }));
                            if (!navigator.geolocation) {
                              return;
                            }
                            navigator.geolocation.getCurrentPosition(
                              pos => setTeamNewEvent(p => ({
                                ...p,
                                location: 'Current Location',
                                pinLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Current Location' }
                              })),
                              () => {
                                // GPS denied — keep 'Current Location' as the label so the button stays enabled
                              }
                            );
                          }}
                          className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all ${
                            locationMode === 'pin'
                              ? 'border-primary bg-primary/5'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                          }`}>
                          <span className="text-xl">📍</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 text-center leading-tight">Use My Location</span>
                        </button>
                        <button type="button"
                          onClick={() => { 
                            setLocationMode('address'); 
                            setTeamNewEvent(p => ({ ...p, location: '' }));
                            setIsTeamSearchingLocation(true); 
                          }}
                          className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all ${
                            locationMode === 'address'
                              ? 'border-primary bg-primary/5'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                          }`}>
                          <span className="text-xl">🔍</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 text-center leading-tight">Enter Address</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocationMode('text')}
                          className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all ${
                            locationMode === 'text'
                              ? 'border-primary bg-primary/5'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-xl">✏️</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 text-center leading-tight">Type a Name</span>
                        </button>
                      </div>
                      {locationMode === 'text' && (
                        <input
                          type="text"
                          placeholder="e.g. Field 3, Home Ground, Sports Hall..."
                          value={teamNewEvent.location}
                          onChange={e => setTeamNewEvent(p => ({ ...p, location: e.target.value }))}
                          className="w-full h-12 bg-slate-50 rounded-2xl px-4 text-sm font-bold text-slate-900 border-none outline-none focus:ring-2 focus:ring-primary/20 mt-2"
                          autoFocus
                        />
                      )}
                      <p className="text-[9px] text-slate-400 text-center">Pin the exact location so members get directions</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input ref={teamSearchInputRef} type="text"
                        placeholder="Search for a field or address..."
                        className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-primary" />
                      <div ref={teamMapRef} className="w-full rounded-2xl border border-slate-100 bg-slate-100" style={{ height: '200px' }} />
                      <p className="text-[8px] text-slate-400 text-center uppercase tracking-widest">Tap anywhere on the map to drop a pin</p>
                      <div className="flex gap-2">
                        {teamMapPin && (
                          <button type="button"
                            onClick={() => {
                              const label = teamSearchInputRef.current?.value || teamNewEvent.location || 'Event Location';
                              setTeamNewEvent(p => ({ ...p, pinLocation: { lat: teamMapPin.lat, lng: teamMapPin.lng, label }, location: p.location || label }));
                              setIsTeamSearchingLocation(false); setTeamMapPin(null);
                            }}
                            className="flex-1 h-10 rounded-xl bg-primary text-white text-[9px] font-black uppercase tracking-widest">
                            Confirm Pin
                          </button>
                        )}
                        <button type="button"
                          onClick={() => { setIsTeamSearchingLocation(false); setTeamMapPin(null); }}
                          className="h-10 px-4 rounded-xl bg-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-600">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 
                                    uppercase tracking-widest px-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    placeholder="e.g. Full kit required..."
                    value={teamNewEvent.notes}
                    onChange={e => setTeamNewEvent(p => ({
                      ...p, notes: e.target.value
                    }))}
                    rows={3}
                    className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 border-none outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>


                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3.5">
                      <div className="flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-slate-400" />
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
                          Repeat
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTeamNewEvent(p => ({
                          ...p, repeat: !p.repeat
                        }))}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          teamNewEvent.repeat 
                            ? "bg-primary" : "bg-slate-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all",
                          teamNewEvent.repeat ? "left-6" : "left-0.5"
                        )} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {teamNewEvent.repeat && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4 overflow-hidden"
                        >
                          <div className="space-y-2">
                            <label className="text-[9px] font-black 
                                              text-slate-400 uppercase 
                                              tracking-widest px-1">
                              Repeat On
                            </label>
                            <div className="grid grid-cols-7 gap-1">
                              {['Mon','Tue','Wed','Thu',
                                'Fri','Sat','Sun'].map(day => {
                                const fullDay = {
                                  Mon:'Monday', Tue:'Tuesday',
                                  Wed:'Wednesday', Thu:'Thursday',
                                  Fri:'Friday', Sat:'Saturday',
                                  Sun:'Sunday'
                                }[day]!;
                                const isSelected = teamNewEvent
                                  .repeatDays.includes(fullDay);
                                return (
                                  <button
                                    key={`repeat-${day}`}
                                    type="button"
                                    onClick={() => setTeamNewEvent(p => ({
                                      ...p,
                                      repeatDays: isSelected
                                        ? p.repeatDays.filter(
                                            d => d !== fullDay
                                          )
                                        : [...p.repeatDays, fullDay]
                                    }))}
                                    className={cn(
                                      "h-9 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                                      isSelected
                                        ? "bg-primary text-white"
                                        : "bg-slate-50 text-slate-400"
                                    )}
                                  >
                                    {day}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[8px] font-black 
                                               text-slate-400 uppercase 
                                               tracking-widest">
                                From
                              </label>
                              <input
                                type="date"
                                value={teamNewEvent.repeatStartDate}
                                onChange={e => setTeamNewEvent(p => ({
                                  ...p, repeatStartDate: e.target.value
                                }))}
                                className="w-full h-11 bg-slate-50 rounded-xl px-3 text-[11px] font-bold text-slate-700 border-none outline-none"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-black 
                                               text-slate-400 uppercase 
                                               tracking-widest">
                                Until
                              </label>
                              <input
                                type="date"
                                value={teamNewEvent.repeatEndDate}
                                min={teamNewEvent.repeatStartDate}
                                onChange={e => setTeamNewEvent(p => ({
                                  ...p, repeatEndDate: e.target.value
                                }))}
                                className="w-full h-11 bg-slate-50 rounded-xl px-3 text-[11px] font-bold text-slate-700 border-none outline-none"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

              </div>

              <div className="p-4 border-t border-slate-100 
                              bg-white shrink-0">
                <button
                  onClick={() => {
                    if (!teamNewEvent.title) return;
                    const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    const eventsToCreate: any[] = [];
                    if (teamNewEvent.repeat &&
                        teamNewEvent.repeatDays.length > 0 &&
                        teamNewEvent.repeatStartDate &&
                        teamNewEvent.repeatEndDate) {
                      const start = new Date(
                        teamNewEvent.repeatStartDate + 'T00:00:00'
                      );
                      const end = new Date(
                        teamNewEvent.repeatEndDate + 'T00:00:00'
                      );
                      const cur = new Date(start);
                      const batchId = Date.now().toString();
                      let n = 1;
                      while (cur <= end) {
                        const dayName = cur.toLocaleDateString(
                          'en-US', { weekday: 'long' }
                        );
                        if (teamNewEvent.repeatDays
                              .includes(dayName)) {
                          eventsToCreate.push({
                            id: `${batchId}-${n}`,
                            title: teamNewEvent.title,
                            type: teamNewEvent.type,
                            time: teamNewEvent.time,
                            location: teamNewEvent.location,
                            notes: teamNewEvent.notes,
                            pinLocation: teamNewEvent.pinLocation,
                            teamId: teamNewEvent.teamId,
                            teamName: selectedTeam?.name || '',
                            date: toDateStr(cur),
                          });
                          n++;
                        }
                        cur.setDate(cur.getDate() + 1);
                      }
                    } else {
                      const eventDate = teamNewEvent.date || toDateStr(new Date(calendarYear, calendarMonth, selectedDate));
                      eventsToCreate.push({
                        id: Date.now().toString(),
                        title: teamNewEvent.title,
                        type: teamNewEvent.type,
                        time: teamNewEvent.time,
                        location: teamNewEvent.location,
                        notes: teamNewEvent.notes,
                        pinLocation: teamNewEvent.pinLocation,
                        teamId: teamNewEvent.teamId,
                        teamName: selectedTeam?.name || '',
                        date: eventDate,
                        opponent: teamNewEvent.title,
                      });
                    }
                    eventsToCreate.forEach(e =>
                      StorageService.addEvent(e)
                    );
                    window.dispatchEvent(new Event('gameday_update'));
                    setIsTeamEventModalOpen(false);
                    setIsTeamSearchingLocation(false);
                    setTeamMapPin(null);
                    setIsDatePickerOpen(false);
                    const resetDateStr = toDateStr(new Date(calendarYear, calendarMonth, selectedDate));
                    setTeamNewEvent({
                      teamId: '',
                      type: 'training',
                      title: '',
                      date: resetDateStr,
                      time: '18:00',
                      location: '',
                      notes: '',
                      opponent: '',
                      repeat: false,
                      repeatDays: [],
                      repeatStartDate: resetDateStr,
                      repeatEndDate: toDateStr(new Date(calendarYear, calendarMonth + 1, selectedDate)),
                      pinLocation: null,
                    });
                  }}
                  disabled={!teamNewEvent.title}
                  className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  Confirm & Schedule
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
        </>
      ) : (
        <>
      {/* Header Section */}
      <div className="pt-6 pb-4 px-4 space-y-6">
        <div className="flex justify-between items-end px-2">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">My Teams</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Your Active Squads</p>
          </div>
          
          <button 
            onClick={() => setIsActionSheetOpen(true)}
            className="w-8 h-8 bg-white shadow-sm rounded-full flex items-center justify-center active:scale-90 transition-all hover:bg-slate-50"
          >
            <Plus className="w-4 h-4 text-slate-400" />
          </button>
      </div>
    </div>

    <div className="grid gap-4 px-4 mt-2">
        {userTeams.length > 0 ? (
          userTeams.map((team, index) => {
            const SportIcon = team.icon || Activity;
            return (
              <motion.div
                key={team.id || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedTeamId(team.id)}
              >
                <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all cursor-pointer group bg-white rounded-[1.75rem]">
                  <CardContent className="p-0">
                    <div className="flex items-center p-4 gap-4">
                      <div className="w-16 h-16 rounded-xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center shadow-sm shrink-0">
                        {(!logoErrors[team.id] && (teamLogos[team.id] || team.logo)) ? (
                          <img
                            src={teamLogos[team.id] || team.logo}
                            alt={team.name}
                            className="w-full h-full object-contain p-1"
                            onError={() => setLogoErrors(prev => ({ ...prev, [team.id]: true }))}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-xl">
                            <Users className="w-8 h-8 text-slate-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-slate-900 text-sm uppercase italic leading-tight break-words px-1">
                          {teamNames[team.id] || team.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge className="bg-slate-50 text-slate-400 text-[8px] font-black px-2 py-0.5 border-none tracking-widest leading-none">
                            {getActualMemberCount(team.id)} MEMBERS
                          </Badge>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        ) : (
          <div className="p-12 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
            <Users className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">No teams joined yet</p>
          </div>
        )}
      </div>
      </>
    )}

      <AnimatePresence>
        {isEditTeamOpen && selectedTeam && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditTeamOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92%] max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="bg-slate-900 p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black uppercase italic text-white leading-none">Edit Team</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Changes apply everywhere</p>
                </div>
                <button
                  onClick={() => setIsEditTeamOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">

                {/* Logo upload */}
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Team Photo</p>
                  <label
                    htmlFor="edit-team-logo"
                    className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-primary/30 transition-all"
                  >
                    <div className="w-14 h-14 rounded-xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center shadow-sm shrink-0">
                      <img
                        src={editTeamLogo || teamLogos[selectedTeam?.id || ""] || selectedTeam?.logo}
                        alt="Team"
                        className="w-full h-full object-contain p-0.5"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase italic text-slate-900">Change Photo</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tap to upload or take photo</p>
                    </div>
                    <input
                      id="edit-team-logo"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setEditTeamLogoFile(file);
                        setEditTeamLogo(URL.createObjectURL(file));
                      }}
                    />
                  </label>
                </div>

                {/* Name input */}
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Team Name</p>
                  <input
                    type="text"
                    value={editTeamName}
                    onChange={e => setEditTeamName(e.target.value)}
                    className="w-full h-12 bg-slate-50 rounded-2xl px-4 text-[12px] font-bold text-slate-900 border border-slate-100 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <button
                  onClick={() => {
                    if (!selectedTeam) return;
                    if (confirm('Archive this team? It will be hidden but data will be kept.')) {
                      StorageService.deleteTeam(selectedTeam.id);
                      setIsEditTeamOpen(false);
                      window.dispatchEvent(new Event('gameday_update'));
                    }
                  }}
                  className="w-full h-10 rounded-2xl border border-red-200 bg-white text-red-400 text-[9px] font-black uppercase tracking-widest transition-all hover:bg-red-50 active:scale-[0.98]"
                >
                  Archive Team
                </button>

                {/* Save button */}
                <button
                  onClick={async () => {
                    if (!selectedTeam) return;
                    // Upload logo to Firebase Storage if a new file was selected
                    if (editTeamLogoFile) {
                      try {
                        const url = await StorageService.uploadTeamLogo(selectedTeam.id, editTeamLogoFile);
                        setTeamLogos(prev => ({ ...prev, [selectedTeam.id]: url }));
                      } catch (e) {
                        console.error('Logo upload failed:', e);
                      }
                    }
                    // Save name
                    if (editTeamName.trim()) {
                      localStorage.setItem(`gameday_team_name_${selectedTeam.id}`, editTeamName.trim());
                      setTeamNames(prev => ({ ...prev, [selectedTeam.id]: editTeamName.trim() }));
                    }
                    window.dispatchEvent(new Event('gameday_update'));
                    setIsEditTeamOpen(false);
                    setEditTeamLogoFile(null);
                  }}
                  disabled={!editTeamName.trim()}
                  className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isActionSheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsActionSheetOpen(false)}
              className="fixed inset-0 bg-slate-900/50 
                         backdrop-blur-sm z-[60]"
            />

            {/* Centered modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 
                         -translate-y-1/2 z-[70] w-[90%] max-w-sm 
                         bg-white rounded-[2rem] p-6 shadow-2xl"
            >

              <h3 className="text-lg font-black uppercase italic 
                             text-slate-900 tracking-tight mb-2">
                Add a Team
              </h3>
              <p className="text-[10px] font-bold text-slate-400 
                            uppercase tracking-widest mb-6">
                Join an existing team or create a new one
              </p>

              <div className="space-y-3">
                {/* Join a Team */}
                <button
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    setTimeout(() => setIsJoinModalOpen(true), 200);
                  }}
                  className="w-full bg-slate-50 hover:bg-slate-100 
                             rounded-2xl p-5 flex items-center gap-4 
                             transition-all active:scale-[0.98] text-left"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl 
                                 flex items-center justify-center shrink-0">
                    <LogIn className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-[13px] font-black uppercase italic 
                                 text-slate-900 leading-tight">
                      Join a Team
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 
                                 uppercase tracking-widest mt-0.5">
                      Enter a team access code
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 ml-auto" />
                </button>

                {/* Create a Team */}
                <button
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    setTimeout(() => setIsCreateModalOpen(true), 200);
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 
                             rounded-2xl p-5 flex items-center gap-4 
                             transition-all active:scale-[0.98] text-left"
                >
                  <div className="w-12 h-12 bg-white/10 rounded-2xl 
                                 flex items-center justify-center shrink-0">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-[13px] font-black uppercase italic 
                                 text-white leading-tight">
                      Create a Team
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 
                                 uppercase tracking-widest mt-0.5">
                      Set up a new squad
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 ml-auto" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isJoinModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsJoinModalOpen(false);
                setJoinCode('');
                setJoinError('');
                setJoinSuccess(false);
                setJoinStep('code');
                setFoundTeam(null);
                setChildName('');
                setChildDob('');
                setChildMatchFound(null);
                setChildLinkConfirm(false);
              }}
              className="fixed inset-0 bg-slate-900/60 
                         backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 
                         -translate-y-1/2 z-[70] w-[90%] max-w-sm 
                         bg-white rounded-[2rem] shadow-2xl 
                         overflow-hidden"
            >
              {/* Header */}
              <div className="bg-slate-900 p-6 flex items-center 
                              justify-between">
                <div className="flex items-center gap-3">
                  {joinStep !== 'code' && joinStep !== 'success' && (
                    <button 
                      onClick={() => {
                        if (joinStep === 'who') setJoinStep('code');
                        if (joinStep === 'child') setJoinStep('who');
                      }}
                      className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white mr-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div className="w-8 h-8 bg-primary/20 rounded-xl 
                                 flex items-center justify-center">
                    <LogIn className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase italic 
                                  text-white leading-none">Join a Team</h3>
                    <p className="text-[9px] font-bold text-slate-400 
                                 uppercase tracking-widest mt-1">
                      {joinStep === 'code' && "Enter your access code"}
                      {joinStep === 'who' && "Who is joining?"}
                      {joinStep === 'child' && "Child's details"}
                      {joinStep === 'success' && "All done"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsJoinModalOpen(false);
                    setJoinCode('');
                    setJoinError('');
                    setJoinSuccess(false);
                    setJoinStep('code');
                    setFoundTeam(null);
                    setChildName('');
                    setChildDob('');
                    setChildMatchFound(null);
                    setChildLinkConfirm(false);
                  }}
                  className="w-8 h-8 rounded-xl bg-white/5 
                             hover:bg-white/15 flex items-center 
                             justify-center text-white/60 
                             hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {joinStep === 'success' ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-6"
                  >
                    <div className="w-16 h-16 bg-green-50 rounded-full 
                                   flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <p className="text-[13px] font-black uppercase italic 
                                 text-slate-900">Team Joined!</p>
                    <p className="text-[11px] font-bold text-primary mt-1">
                      {joinedTeamName}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 
                                 uppercase tracking-widest mt-1">
                      You have been added to the squad
                    </p>

                    <button
                      onClick={() => {
                        setIsJoinModalOpen(false);
                        setJoinCode('');
                        setJoinError('');
                        setJoinSuccess(false);
                        setJoinStep('code');
                        setFoundTeam(null);
                        setChildName('');
                        setChildDob('');
                        setChildMatchFound(null);
                        setChildLinkConfirm(false);
                        setJoinedTeamName('');
                        window.dispatchEvent(new Event('gameday_update'));
                      }}
                      className="w-full h-11 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all mt-6"
                    >
                      Done
                    </button>
                  </motion.div>
                ) : joinStep === 'code' ? (
                  <>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Ask your club admin or head coach for the team 
                      access code, then enter it below.
                    </p>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 
                                        uppercase tracking-widest px-1">
                        Team Access Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. A3F-9KL"
                        value={joinCode}
                        onChange={e => {
                          setJoinCode(e.target.value.toUpperCase());
                          setJoinError('');
                        }}
                        className="w-full h-12 bg-slate-50 rounded-xl 
                                   px-4 text-[13px] font-black tracking-widest 
                                   text-slate-900 border border-slate-100 
                                   outline-none focus:border-primary/40 
                                   focus:ring-2 focus:ring-primary/10 
                                   text-center uppercase"
                      />
                    </div>

                    {joinError && (
                      <div className="bg-red-50 rounded-xl p-3 flex 
                                     items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-[10px] font-bold text-red-600">
                          {joinError}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={async () => {
                        if (!joinCode || joinCode.length < 4) {
                          setJoinError('Please enter a valid access code');
                          return;
                        }

                        // Check if this is a club join code first
                        const { MOCK_CLUB } = await import('../constants');
                        if (joinCode.toUpperCase() === MOCK_CLUB.joinCode.toUpperCase()) {
                          // User is joining the club directly
                          if (user?.id) {
                            try {
                              const { db } = await import('../firebase');
                              const { doc, setDoc } = await import('firebase/firestore');
                              await setDoc(doc(db, 'users', user.id), {
                                clubId: MOCK_CLUB.id,
                              }, { merge: true });
                              onUpdateUser({ clubId: MOCK_CLUB.id });
                            } catch (e) {
                              console.warn('Firestore club join failed:', e);
                            }
                          }
                          setJoinSuccess(true);
                          setJoinedTeamName(MOCK_CLUB.name);
                          setTimeout(() => {
                            setIsJoinModalOpen(false);
                            setJoinCode('');
                            setJoinSuccess(false);
                          }, 2000);
                          return;
                        }

                        // Check custom created teams first
                        const customTeam = StorageService.findTeamByCode(joinCode);
                        
                        // Also check MOCK_TEAMS
                        const mockTeam = MOCK_TEAMS.find(t => 
                          t.joinCode?.toUpperCase() === joinCode.toUpperCase()
                        );

                        const fTeam = customTeam || mockTeam;

                        if (!fTeam) {
                          setJoinError('Invalid code. Check with your coach and try again.');
                          return;
                        }

                        setFoundTeam(fTeam);
                        setJoinStep('who');
                      }}
                      disabled={!joinCode}
                      className="w-full h-12 bg-primary hover:bg-primary/90 
                                 text-white rounded-2xl text-[11px] font-black 
                                 uppercase tracking-widest transition-all 
                                 active:scale-[0.98] disabled:opacity-50"
                    >
                      Join Team
                    </button>
                  </>
                ) : joinStep === 'who' ? (
                  <div className="space-y-3">
                    <div 
                      onClick={async () => {
                        if (user?.id && foundTeam) {
                          StorageService.addTeamToUser(user.id, foundTeam.id);
                          
                          StorageService.addTeamMember(foundTeam.id, {
                            id: user.id,
                            name: user.name,
                            avatar: user.avatar || undefined,
                            position: 'Player',
                            role: 'player'
                          });
                          
                          const savedUser = JSON.parse(
                            localStorage.getItem('gameday_user') || '{}'
                          );
                          const updatedTeamIds = [
                            ...new Set([...(savedUser.teamIds || []), foundTeam.id])
                          ];
                          savedUser.teamIds = updatedTeamIds;
                          localStorage.setItem('gameday_user', JSON.stringify(savedUser));
                          
                          localStorage.setItem(`gameday_role_${user?.id}_${foundTeam.id}`, 'player');
                          
                          // Persist join to Firestore so link never breaks
                          if (user?.id && foundTeam) {
                            try {
                              const { db } = await import('../firebase');
                              const { doc, getDoc, updateDoc, setDoc } = await import('firebase/firestore');

                              const userRef = doc(db, 'users', user.id);
                              const userSnap = await getDoc(userRef);
                              const existingData = userSnap.exists() ? userSnap.data() : {};
                              const updatedTeamIds = [...new Set([...(existingData.teamIds || []), foundTeam.id])];
                              const clubId = foundTeam.clubId || existingData.clubId || '';

                              await setDoc(userRef, {
                                ...existingData,
                                teamIds: updatedTeamIds,
                                clubId: clubId,
                              }, { merge: true });

                              // Update local user state too
                              onUpdateUser({ teamIds: updatedTeamIds, clubId });
                            } catch (e) {
                              console.warn('Firestore team join write failed:', e);
                            }
                          }
                          
                          setJoinedTeamName(foundTeam.name);
                          setJoinStep('success');
                          window.dispatchEvent(new Event('gameday_update'));
                        }
                      }}
                      className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all border-2 border-transparent hover:border-primary/20"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 uppercase italic">Myself</p>
                        <p className="text-[10px] font-bold text-slate-400">Join as a player</p>
                      </div>
                    </div>

                    <div 
                      onClick={() => setJoinStep('child')}
                      className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all border-2 border-transparent hover:border-primary/20"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 uppercase italic">My Child</p>
                        <p className="text-[10px] font-bold text-slate-400">Register a child player</p>
                      </div>
                    </div>
                  </div>
                ) : joinStep === 'child' ? (
                  <div className="space-y-4">
                    {childMatchFound ? (
                      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 mb-2">
                        <p className="text-[11px] font-bold text-amber-900 mb-3">
                          Is <span className="font-black underline">{childMatchFound.name}</span> already on this team — are you their parent too?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              const children = JSON.parse(localStorage.getItem('gameday_children') || '[]');
                              const idx = children.findIndex((c: any) => c.id === childMatchFound.id);
                              if (idx !== -1 && user?.id) {
                                if (!children[idx].parentIds) children[idx].parentIds = [];
                                if (!children[idx].parentIds.includes(user.id)) {
                                  children[idx].parentIds.push(user.id);
                                }
                                if (!children[idx].parentNames) children[idx].parentNames = [];
                                if (!children[idx].parentNames.includes(user.name || 'Parent')) {
                                  children[idx].parentNames.push(user.name || 'Parent');
                                }
                                localStorage.setItem('gameday_children', JSON.stringify(children));
                                
                                // Add team to user
                                StorageService.addTeamToUser(user.id, foundTeam.id);
                                const savedUser = JSON.parse(localStorage.getItem('gameday_user') || '{}');
                                const updatedTeamIds = [...new Set([...(savedUser.teamIds || []), foundTeam.id])];
                                savedUser.teamIds = updatedTeamIds;
                                localStorage.setItem('gameday_user', JSON.stringify(savedUser));
                                
                                localStorage.setItem(`gameday_role_${user.id}_${foundTeam.id}`, 'parent');

                                // Persist join to Firestore so link never breaks
                                if (user?.id && foundTeam) {
                                  try {
                                    const { db } = await import('../firebase');
                                    const { doc, getDoc, updateDoc, setDoc } = await import('firebase/firestore');

                                    const userRef = doc(db, 'users', user.id);
                                    const userSnap = await getDoc(userRef);
                                    const existingData = userSnap.exists() ? userSnap.data() : {};
                                    const updatedTeamIds = [...new Set([...(existingData.teamIds || []), foundTeam.id])];
                                    const clubId = foundTeam.clubId || existingData.clubId || '';

                                    await setDoc(userRef, {
                                      ...existingData,
                                      teamIds: updatedTeamIds,
                                      clubId: clubId,
                                    }, { merge: true });

                                    // Update local user state too
                                    onUpdateUser({ teamIds: updatedTeamIds, clubId });
                                  } catch (e) {
                                    console.warn('Firestore team join write failed:', e);
                                  }
                                }

                                localStorage.setItem(`gameday_child_${user.id}_${foundTeam.id}`, childMatchFound.id);
                                window.dispatchEvent(new Event('gameday_update'));
                                setJoinedTeamName(foundTeam.name);
                                setJoinStep('success');
                              }
                            }}
                            className="flex-1 h-9 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                          >
                            Yes, that's my child
                          </button>
                          <button
                            onClick={() => {
                              setChildMatchFound(null);
                              setChildName('');
                              setChildDob('');
                            }}
                            className="flex-1 h-9 bg-white text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-200"
                          >
                            No, re-enter details
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Child's Full Name</label>
                          <input
                            type="text"
                            placeholder="Full Name"
                            value={childName}
                            onChange={e => setChildName(e.target.value)}
                            className="w-full h-11 bg-slate-50 rounded-xl px-4 text-xs font-bold text-slate-900 border border-slate-100 outline-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Date of Birth</label>
                          <input
                            type="date"
                            value={childDob}
                            onChange={e => setChildDob(e.target.value)}
                            className="w-full h-11 bg-slate-50 rounded-xl px-4 text-xs font-bold text-slate-900 border border-slate-100 outline-none"
                          />
                        </div>
                        <button
                          onClick={async () => {
                            if (!childName || !childDob) return;
                            
                            const children = JSON.parse(localStorage.getItem('gameday_children') || '[]');
                            const match = children.find((c: any) => 
                              c.name.toLowerCase() === childName.toLowerCase().trim() && 
                              c.dob === childDob && 
                              c.teamIds?.includes(foundTeam.id)
                            );

                            if (match) {
                              setChildMatchFound(match);
                            } else {
                              const newChild = {
                                id: 'child-' + Date.now().toString(),
                                name: childName.trim(),
                                dob: childDob,
                                parentIds: [user?.id],
                                parentNames: [user?.name || 'Parent'],
                                teamIds: [foundTeam.id],
                              };
                              children.push(newChild);
                              localStorage.setItem('gameday_children', JSON.stringify(children));
                              
                              if (user?.id) {
                                StorageService.addTeamToUser(user.id, foundTeam.id);
                                const savedUser = JSON.parse(localStorage.getItem('gameday_user') || '{}');
                                const updatedTeamIds = [...new Set([...(savedUser.teamIds || []), foundTeam.id])];
                                savedUser.teamIds = updatedTeamIds;
                                localStorage.setItem('gameday_user', JSON.stringify(savedUser));
                                
                                localStorage.setItem(`gameday_role_${user?.id}_${foundTeam.id}`, 'parent');

                                // Persist join to Firestore so link never breaks
                                if (user?.id && foundTeam) {
                                  try {
                                    const { db } = await import('../firebase');
                                    const { doc, getDoc, updateDoc, setDoc } = await import('firebase/firestore');

                                    const userRef = doc(db, 'users', user.id);
                                    const userSnap = await getDoc(userRef);
                                    const existingData = userSnap.exists() ? userSnap.data() : {};
                                    const updatedTeamIds = [...new Set([...(existingData.teamIds || []), foundTeam.id])];
                                    const clubId = foundTeam.clubId || existingData.clubId || '';

                                    await setDoc(userRef, {
                                      ...existingData,
                                      teamIds: updatedTeamIds,
                                      clubId: clubId,
                                    }, { merge: true });

                                    // Update local user state too
                                    onUpdateUser({ teamIds: updatedTeamIds, clubId });
                                  } catch (e) {
                                    console.warn('Firestore team join write failed:', e);
                                  }
                                }


                                localStorage.setItem(`gameday_child_${user?.id}_${foundTeam.id}`, newChild.id);
                                window.dispatchEvent(new Event('gameday_update'));
                              }
                              
                              setJoinedTeamName(foundTeam.name);
                              setJoinStep('success');
                            }
                          }}
                          disabled={!childName || !childDob}
                          className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                          Continue
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isJoinClubOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsJoinClubOpen(false);
                setClubCodeInput('');
                setClubCodeError('');
                setClubRequestSent(false);
              }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                         w-[calc(100%-2.5rem)] max-w-[360px] bg-white 
                         rounded-[2.5rem] shadow-2xl z-[70] overflow-hidden"
            >
              {/* Header */}
              <div className="bg-slate-900 p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-xl flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black italic uppercase text-white leading-none">Join a Club</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Connect with your organization
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsJoinClubOpen(false);
                    setClubCodeInput('');
                    setClubCodeError('');
                    setClubRequestSent(false);
                  }}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {clubRequestSent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-6"
                  >
                    <div className="w-16 h-16 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-black uppercase italic text-slate-900">Request Sent!</h4>
                    <p className="text-[11px] font-medium text-slate-400 leading-relaxed max-w-[200px] mx-auto mt-2">
                      Request sent to {MOCK_CLUB.name}.
                    </p>
                    <button
                      onClick={() => {
                        setIsJoinClubOpen(false);
                        setClubCodeInput('');
                        setClubRequestSent(false);
                      }}
                      className="w-full h-11 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all mt-6"
                    >
                      Done
                    </button>
                  </motion.div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <p className="text-xs font-medium text-slate-500 text-center leading-relaxed">
                        Enter the club code provided by your club administrator.
                      </p>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Club Code</label>
                        <input
                          type="text"
                          placeholder="E.G. CLB-123"
                          value={clubCodeInput}
                          onChange={e => {
                             setClubCodeInput(e.target.value.toUpperCase());
                             setClubCodeError('');
                          }}
                          className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-center text-sm font-black uppercase tracking-[0.2em] outline-none focus:border-primary/30 transition-all"
                        />
                        {clubCodeError && (
                          <p className="text-[10px] font-bold text-red-500 px-1 mt-1 text-center">{clubCodeError}</p>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          if (!clubCodeInput) return;
                          
                          if (clubCodeInput.toUpperCase() !== MOCK_CLUB.joinCode.toUpperCase()) {
                            setClubCodeError('Club not found. Check the code and try again.');
                            return;
                          }

                          if (selectedTeam) {
                            const requests = JSON.parse(localStorage.getItem('gameday_club_requests') || '[]');
                            requests.push({ 
                              id: Date.now().toString(), 
                              teamId: selectedTeam.id, 
                              teamName: teamNames[selectedTeam.id] || selectedTeam.name, 
                              clubId: MOCK_CLUB.id, 
                              clubName: MOCK_CLUB.name, 
                              status: 'pending', 
                              requestedAt: new Date().toISOString() 
                            });
                            localStorage.setItem('gameday_club_requests', JSON.stringify(requests));
                            window.dispatchEvent(new Event('gameday_update'));
                            setClubRequestSent(true);
                          }
                        }}
                        disabled={!clubCodeInput}
                        className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        Send Request
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCreateModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 
                         backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 
                         -translate-y-1/2 z-[70] w-[90%] max-w-sm 
                         bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="bg-slate-900 p-6 flex items-center 
                              justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-xl 
                                 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase italic 
                                  text-white leading-none">Create a Team</h3>
                    <p className="text-[9px] font-bold text-slate-400 
                                 uppercase tracking-widest mt-1">
                      Set up your new squad
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setCreateForm({ name: '', sport: '' });
                    setCreateSuccess(false);
                  }}
                  className="w-8 h-8 rounded-xl bg-white/5 
                             hover:bg-white/15 flex items-center 
                             justify-center text-white/60 
                             hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {createSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-4 space-y-4"
                  >
                    <div className="w-16 h-16 bg-green-50 rounded-full 
                                   flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <div>
                      <p className="text-[13px] font-black uppercase italic 
                                   text-slate-900">Team Created!</p>
                      <p className="text-[10px] font-bold text-slate-400 
                                   uppercase tracking-widest mt-1">
                        Share this code with your players
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4">
                      <p className="text-[9px] font-black text-slate-400 
                                   uppercase tracking-widest mb-2">
                        Team Access Code
                      </p>
                      <p className="text-2xl font-black tracking-widest 
                                   text-primary uppercase">
                        {generatedCode}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const copyText = (text: string) => {
                          if (navigator.clipboard && window.isSecureContext) {
                            return navigator.clipboard.writeText(text);
                          }
                          const ta = document.createElement('textarea');
                          ta.value = text;
                          ta.style.position = 'fixed';
                          ta.style.left = '-9999px';
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand('copy');
                          document.body.removeChild(ta);
                          return Promise.resolve();
                        };
                        copyText(generatedCode).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        });
                      }}
                      className="flex items-center gap-2 mx-auto bg-white 
                                 border border-slate-100 rounded-xl px-4 py-2 
                                 text-[10px] font-black uppercase tracking-widest 
                                 text-slate-600 hover:bg-slate-50 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? '✓ COPIED!' : 'COPY CODE'}
                    </button>

                    <button
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        setCreateForm({ name: '', sport: '' });
                        setCreateSuccess(false);
                        setGeneratedCode('');
                        window.dispatchEvent(new Event('gameday_update'));
                      }}
                      className="w-full h-11 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all mt-4"
                    >
                      Done
                    </button>
                  </motion.div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 
                                        uppercase tracking-widest px-1">
                        Team Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Karaka U21 Premier"
                        value={createForm.name}
                        onChange={e => setCreateForm(p => ({
                          ...p, name: e.target.value
                        }))}
                        className="w-full h-12 bg-slate-50 rounded-xl 
                                   px-4 text-[12px] font-bold text-slate-900 
                                   border border-slate-100 outline-none 
                                   focus:border-primary/40 focus:ring-2 
                                   focus:ring-primary/10"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 
                                        uppercase tracking-widest px-1">
                        Sport
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rugby, Basketball, Netball"
                        value={createForm.sport}
                        onChange={e => setCreateForm(p => ({
                          ...p, sport: e.target.value
                        }))}
                        className="w-full h-12 bg-slate-50 rounded-xl 
                                   px-4 text-[12px] font-bold text-slate-900 
                                   border border-slate-100 outline-none 
                                   focus:border-primary/40 focus:ring-2 
                                   focus:ring-primary/10"
                      />
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4 flex 
                                   items-start gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-xl 
                                     flex items-center justify-center shrink-0 mt-0.5">
                        <Key className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-700 
                                     uppercase tracking-widest">
                          Access Code Auto-Generated
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 
                                     leading-relaxed">
                          A unique join code will be created for your team 
                          that players can use to join.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        if (!createForm.name || !createForm.sport) return;

                        // Generate unique join code
                        const joinCode = Math.random().toString(36).substring(2, 5).toUpperCase() + '-' + Math.random().toString(36).substring(2, 5).toUpperCase();

                        // Build new team object
                        const newTeam = {
                          id: Date.now().toString(),
                          name: createForm.name,
                          sport: createForm.sport,
                          joinCode,
                          coach: user?.name || 'Coach',
                          coachId: user?.id,
                          createdBy: user?.id,
                          members: 1,
                          clubId: null,
                          createdAt: new Date().toISOString(),
                        };

                        // Save to shared storage
                        StorageService.saveTeam(newTeam);

                        // Add to coach's own team list
                        if (user?.id) {
                          StorageService.addTeamToUser(user.id, newTeam.id);
                          StorageService.addTeamMember(newTeam.id, {
                            id: user.id,
                            name: user.name,
                            avatar: user.avatar || undefined,
                            position: 'Coach',
                            role: 'coach'
                          });
                          localStorage.setItem(`gameday_role_${user?.id}_${newTeam.id}`, 'coach');

                          // Sync to Firestore
                          await StorageService.syncTeamToFirestore(newTeam);
                          await StorageService.syncTeamMembersToFirestore(newTeam.id, [{
                            id: user.id,
                            name: user.name,
                            avatar: user.avatar || null,
                            position: 'Coach',
                            role: 'coach'
                          }]);

                          await setDoc(doc(db, 'users', user.id), {
                            teamIds: arrayUnion(newTeam.id),
                            [`roles.${newTeam.id}`]: 'coach'
                          }, { merge: true });

                          // Verify the write actually worked
                          try {
                            const { getDoc } = await import('firebase/firestore');
                            const check = await getDoc(doc(db, 'users', user.id));
                            if (check.exists()) {
                              const saved = check.data();
                              console.log('Firestore verify — teamIds saved:', saved.teamIds);
                            } else {
                              console.error('Firestore verify FAILED — user doc does not exist after write');
                            }
                          } catch (verifyErr) {
                            console.error('Firestore verify error:', verifyErr);
                          }
                        }

                        setCreateSuccess(true);
                        setGeneratedCode(joinCode);
                      }}
                      disabled={!createForm.name || !createForm.sport}
                      className="w-full h-12 bg-slate-900 hover:bg-slate-800 
                                 text-white rounded-2xl text-[11px] font-black 
                                 uppercase tracking-widest transition-all 
                                 active:scale-[0.98] disabled:opacity-50"
                    >
                      Create Team
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}

        {isLeaveModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLeaveModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
            />
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                         z-[70] w-[88%] max-w-sm bg-white rounded-[2rem] shadow-2xl
                         overflow-hidden"
            >
              {/* Dark header */}
              <div className="bg-slate-900 p-6 flex items-center justify-between">
                <h3 className="text-base font-black uppercase italic text-white">
                  Leave Team
                </h3>
                <button
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15
                             flex items-center justify-center text-white/60
                             hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                <p className="text-sm font-medium text-slate-600 leading-relaxed">
                  Are you sure you want to leave{' '}
                  <span className="font-black text-slate-900">
                    {teamNames[selectedTeam?.id || ''] || selectedTeam?.name}
                  </span>
                  ? You will lose access to all team content, chat, and announcements.
                </p>

                <div className="flex gap-3">
                  {/* Cancel */}
                  <button
                    onClick={() => setIsLeaveModalOpen(false)}
                    className="flex-1 h-12 rounded-2xl bg-slate-100 text-slate-600
                               text-[11px] font-black uppercase tracking-widest
                               hover:bg-slate-200 active:scale-[0.98] transition-all"
                  >
                    Cancel
                  </button>

                  {/* Confirm Leave */}
                  <button
                    onClick={() => {
                      if (!selectedTeam || !user?.id) return;
                      const teamId = selectedTeam.id;
                      const userId = user.id;

                      // 1. Remove team from user's teamIds in gameday_user
                      const savedUser = JSON.parse(localStorage.getItem('gameday_user') || '{}');
                      savedUser.teamIds = (savedUser.teamIds || []).filter((id: string) => id !== teamId);
                      localStorage.setItem('gameday_user', JSON.stringify(savedUser));

                      // 2. Remove from per-user profile data
                      const userData = JSON.parse(localStorage.getItem(`gameday_user_${userId}`) || '{}');
                      userData.teamIds = (userData.teamIds || []).filter((id: string) => id !== teamId);
                      localStorage.setItem(`gameday_user_${userId}`, JSON.stringify(userData));

                      // Storage Service removal
                      StorageService.removeTeamMember(teamId, userId);

                      // 3. Remove role key for this team
                      localStorage.removeItem(`gameday_role_${userId}_${teamId}`);

                      // 4. Remove child link key if parent
                      localStorage.removeItem(`gameday_child_${userId}_${teamId}`);

                      // 5. Fire update and navigate back to team list
                      window.dispatchEvent(new Event('gameday_update'));
                      setIsLeaveModalOpen(false);
                      setSelectedTeamId(null);
                    }}
                    className="flex-1 h-12 rounded-2xl bg-red-500 hover:bg-red-600
                               text-white text-[11px] font-black uppercase tracking-widest
                               active:scale-[0.98] transition-all"
                  >
                    Leave
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {showRemoveModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRemoveModal(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
            />
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                         z-[70] w-[88%] max-w-sm bg-white rounded-[2rem] shadow-2xl
                         overflow-hidden"
            >
              {/* Dark header */}
              <div className="bg-slate-900 p-6 flex items-center justify-between">
                <h3 className="text-base font-black uppercase italic text-white uppercase leading-none">
                  REMOVE MEMBER
                </h3>
                <button
                  onClick={() => setShowRemoveModal(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20
                             flex items-center justify-center text-white/60
                             hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                <p className="text-sm font-medium text-slate-600 leading-relaxed">
                  Remove <span className="font-black text-slate-900">{memberToRemove?.name}</span> from the roster? This cannot be undone.
                </p>

                <div className="flex gap-3">
                  {/* Cancel */}
                  <button
                    onClick={() => setShowRemoveModal(false)}
                    className="flex-1 h-12 rounded-2xl border border-slate-200 bg-white text-slate-600
                               text-[11px] font-black uppercase tracking-widest
                               hover:bg-slate-50 active:scale-[0.98] transition-all"
                  >
                    Cancel
                  </button>

                  {/* Confirm Remove */}
                  <button
                    onClick={confirmRemoveMember}
                    className="flex-1 h-12 rounded-2xl bg-red-500 text-white
                               text-[11px] font-black uppercase tracking-widest
                               hover:bg-red-600 active:scale-[0.98] transition-all
                               shadow-lg shadow-red-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
        <AnimatePresence>
          {teamsAttendanceModalEvent && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setTeamsAttendanceModalEvent(null)}
                className="fixed inset-0 bg-black z-[60]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92%] max-w-md max-h-[85vh] bg-white rounded-[2rem] flex flex-col overflow-hidden shadow-2xl"
              >
                <div className="px-6 pb-4 pt-5 border-b border-slate-100 shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black uppercase italic text-slate-900 leading-tight">
                        {teamsAttendanceModalEvent.title}
                      </h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {teamsAttendanceModalEvent.date} • {teamsAttendanceModalEvent.time}
                      </p>
                    </div>
                    <button
                      onClick={() => setTeamsAttendanceModalEvent(null)}
                      className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {(() => {
                    const records = teamsAttendanceData[teamsAttendanceModalEvent.id] || [];
                    const going = records.filter(r => r.status === 'going');
                    const absent = records.filter(r => r.status === 'absent');
                    const pending = records.filter(r => !r.status || r.status === null);
                    return (
                      <div className="flex gap-2 mt-3">
                        <div className="flex-1 bg-green-50 rounded-xl p-2 text-center">
                          <p className="text-lg font-black italic text-green-600">{going.length}</p>
                          <p className="text-[8px] font-black text-green-500 uppercase tracking-widest">Going</p>
                        </div>
                        <div className="flex-1 bg-red-50 rounded-xl p-2 text-center">
                          <p className="text-lg font-black italic text-red-500">{absent.length}</p>
                          <p className="text-[8px] font-black text-red-400 uppercase tracking-widest">Absent</p>
                        </div>
                        <div className="flex-1 bg-slate-50 rounded-xl p-2 text-center">
                          <p className="text-lg font-black italic text-slate-500">{pending.length}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pending</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="overflow-y-auto flex-1 px-4 py-4 space-y-2">
                  {(() => {
                    const records = teamsAttendanceData[teamsAttendanceModalEvent.id] || [];
                    if (records.length === 0) {
                      return (
                        <div className="py-8 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No responses yet</p>
                        </div>
                      );
                    }
                    return records.map((r, i) => {
                      const status = r.status;
                      return (
                        <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3">
                          <DefaultAvatar name={r.userName || r.userId || '?'} size="sm" className="rounded-xl shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black uppercase italic text-slate-900 truncate">
                              {(r.userName || r.userId || 'Unknown').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
                            </p>
                            {r.reason && (
                              <p className="text-[9px] text-slate-400 italic mt-0.5">"{r.reason}"</p>
                            )}
                          </div>
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shrink-0",
                            status === 'going' ? "bg-green-100 text-green-600"
                            : status === 'absent' ? "bg-red-100 text-red-500"
                            : "bg-slate-100 text-slate-400"
                          )}>
                            {status === 'going' ? '✓ Going' : status === 'absent' ? '✗ Absent' : 'Pending'}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </AnimatePresence>

      <AnimatePresence>
        {showMonthPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center pb-6 px-4"
            onClick={() => setShowMonthPicker(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-white uppercase italic text-lg">Select Month</h3>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{calendarYear}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCalendarYear(y => y - 1)}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={() => setCalendarYear(y => y + 1)}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={() => setShowMonthPicker(false)}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors ml-1"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
              <div className="p-5 grid grid-cols-3 gap-3">
                {MONTHS.map((month, i) => (
                  <button
                    key={month}
                    onClick={() => {
                      setCalendarMonth(i);
                      setSelectedDate(1);
                      setShowMonthPicker(false);
                    }}
                    className={`py-3 rounded-2xl text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                      i === calendarMonth && calendarYear === new Date().getFullYear()
                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                        : i === new Date().getMonth() && calendarYear === new Date().getFullYear()
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {month.slice(0, 3)}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

