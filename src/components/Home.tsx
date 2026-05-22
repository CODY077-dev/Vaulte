import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Calendar, Users, Trophy, Activity, Clock, MapPin, AlertCircle, Send, Megaphone, UserX, ChevronDown, Check, ChevronLeft, ChevronRight, User as UserIcon, FileText, CheckCircle2, Bell, Navigation, X, Search, Pencil, Trash2, MessageSquare } from "lucide-react";
import DefaultAvatar from "./DefaultAvatar";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { MOCK_TEAMS, MOCK_SCHEDULE } from "../constants";
import { User } from "../types";
import StorageService, { Announcement, AttendanceRecord } from "../services/StorageService";

interface DashboardSummary {
  lineupHighlight: string;
  motivationalQuote: string;
  coachInsight?: string;
}

const getShortLocation = (location: string | undefined): string => {
  if (!location) return '';
  // Take only the part before the first comma to avoid long addresses
  const beforeComma = location.split(',')[0].trim();
  return beforeComma;
};

interface HomeProps {
  user: User | null;
  onTabChange: (tab: string, viewId?: string) => void;
}

export default function Home({ user, onTabChange }: HomeProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [showTeamsPicker, setShowTeamsPicker] = useState(false);
  const [showDirectPicker, setShowDirectPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [isAbsenteesExpanded, setIsAbsenteesExpanded] = useState(false);
  const [selectedAttendanceTeam, setSelectedAttendanceTeam] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<Record<string, { status: 'going' | 'absent' | null, reason?: string } | undefined>>({});
  const [isAbsenceDialogOpen, setIsAbsenceDialogOpen] = useState(false);
  const [absenceReason, setAbsenceReason] = useState("");
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [reminderSentEventId, setReminderSentEventId] = useState<string | null>(null);
  const [locationModalEvent, setLocationModalEvent] = useState<any>(null);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [showAllAttendance, setShowAllAttendance] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [realAnnouncements, setRealAnnouncements] = useState<Announcement[]>([]);
  const [allRealAttendance, setAllRealAttendance] = useState<Record<string, AttendanceRecord[]>>({});
  const [realEvents, setRealEvents] = useState<any[]>([]);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [teamLogos, setTeamLogos] = useState<Record<string, string>>({});
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});

  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<Set<string>>(new Set());
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});
  const [pendingAnnouncementId, setPendingAnnouncementId] = useState<string | null>(null);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Read fresh teamIds from localStorage so we pick up newly created teams
  // even before App.tsx re-renders with updated user prop
  const freshUser = user?.id ? JSON.parse(localStorage.getItem('gameday_user') || '{}') : null;
  const allTeamIds = [...new Set([...(user?.teamIds || []), ...(freshUser?.teamIds || [])])];

  // Check all custom teams to see if this user is creator/coach/manager of any
  const customTeams: any[] = JSON.parse(localStorage.getItem('gameday_custom_teams') || '[]');

  const isCoach = user?.role === 'coach' ||
    user?.role === 'club' ||
    allTeamIds.some(tid => {
      const storedRole = localStorage.getItem(`gameday_role_${user?.id}_${tid}`);
      if (storedRole === 'coach' || storedRole === 'manager') return true;
      // Fallback: check if user is the creator or coachId on the team object
      const team = customTeams.find((t: any) => t.id === tid);
      if (team && (team.createdBy === user?.id || team.coachId === user?.id)) {
        // Auto-repair the missing role key
        localStorage.setItem(`gameday_role_${user?.id}_${tid}`, 'coach');
        return true;
      }
      return false;
    });

  const hasChildren = JSON.parse(localStorage.getItem('gameday_children') || '[]')
    .some((c: any) => c.parentIds?.includes(user?.id));

  const isPlayer = !isCoach || allTeamIds.some(tid =>
    localStorage.getItem(`gameday_role_${user?.id}_${tid}`) === 'player'
  );

  const formatAnnouncementDate = (timestamp: string) => {
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
    const loadData = async () => {
      // Derived clubId for the user (handles both club role and players in formatted club teams)
      const userClubId = user?.clubId || MOCK_TEAMS.find(t => user?.teamIds?.includes(t.id))?.clubId || null;

      // Load local data
      const allTeams = [...MOCK_TEAMS, ...StorageService.getCustomTeams()];
      const clubTeamIds = userClubId
        ? allTeams.filter(t => t.clubId === userClubId).map(t => t.id)
        : [];

      const announcements = StorageService.getAnnouncements();
      const filtered = announcements.filter(a =>
        a.teamId === 'all' ||
        (userClubId && a.teamId === userClubId) ||
        user?.teamIds?.includes(a.teamId) ||
        a.teamId === user?.linkedTeamId ||
        (user?.role === 'club' && clubTeamIds.includes(a.teamId))
      );
      setRealAnnouncements(filtered);

      const allAttendance = StorageService.getAttendance();
      setAllRealAttendance(allAttendance);

      const events = StorageService.getEvents();
      setRealEvents(events);
      
      const formattedAttendance: Record<string, { status: 'going' | 'absent' | null, reason?: string } | undefined> = {};
      
      // Map existing attendance for this user if available
      Object.keys(allAttendance).forEach(eventId => {
        const userRecord = allAttendance[eventId].find(a => a.userId === user?.id);
        if (userRecord) {
          formattedAttendance[eventId] = { status: userRecord.status, reason: userRecord.reason };
        }
      });
      setAttendance(formattedAttendance);

      const logos: Record<string, string> = {};
      const names: Record<string, string> = {};
      const stored = StorageService.getCustomTeams();
      const legacyStored = StorageService.getTeams();
      [...MOCK_TEAMS, ...stored, ...legacyStored].forEach(t => {
        const savedLogo = StorageService.getTeamLogo(t.id);
        if (savedLogo) logos[t.id] = savedLogo;
        const savedName = localStorage.getItem(`gameday_team_name_${t.id}`);
        if (savedName) names[t.id] = savedName;
      });
      setTeamLogos(logos);
      setTeamNames(names);
      setUpdateTrigger(prev => prev + 1);
    };
    
    loadData();
    window.addEventListener('focus', loadData);
    window.addEventListener('gameday_update', loadData);
    
    return () => {
      window.removeEventListener('focus', loadData);
      window.removeEventListener('gameday_update', loadData);
    };
  }, [user]);

  const formatEventSubtitle = (event: any) => {
    if (!event) return 'NO UPCOMING EVENT';
    const eventDate = new Date(event.date);
    const day = eventDate.toLocaleDateString('en-NZ', { weekday: 'long' });
    const time = event.time || '';
    return `${event.title}  ·  ${day}${time ? '  ' + time : ''}`;
  };

  const squadTeams = useMemo(() => {
    const customTeams = StorageService.getCustomTeams();
    const allTeams = [...MOCK_TEAMS, ...customTeams];

    const seen = new Set<string>();
    return allTeams.filter(team => {
      if (seen.has(team.id)) return false;
      const inTeamIds = user?.teamIds?.includes(team.id);
      const isCreator = (team as any).createdBy === user?.id;
      const storedRole = localStorage.getItem(`gameday_role_${user?.id}_${team.id}`);
      const hasCoachRole = storedRole === 'coach' || storedRole === 'club';
      if (inTeamIds || isCreator || hasCoachRole) {
        seen.add(team.id);
        return true;
      }
      return false;
    });
  }, [user, updateTrigger]);

  const sortedRealAnnouncements = useMemo(() => {
    const allAttendance = StorageService.getAttendance();
    return realAnnouncements
      .filter(ann => {
        // Visibility filter — only show announcements for this user's teams
        const visible =
          ann.teamId === 'all' ||
          user?.teamIds?.includes(ann.teamId) ||
          user?.role === 'club' ||
          ann.senderId === user?.id;
        if (!visible) return false;

        // Hide reminder announcements if the user has already responded
        if (ann.isReminder && ann.eventId) {
          const records = allAttendance[ann.eventId] || [];
          const myRecord = records.find((r: any) => r.userId === user?.id);
          if (myRecord?.status === 'going' || myRecord?.status === 'absent') return false;
        }

        return true;
      });
  }, [realAnnouncements, user]);

  const totalAnnouncementsCount = sortedRealAnnouncements.filter(ann => !dismissedAnnouncementIds.has(ann.id)).length;

  const parseEventDate = (dateStr: string): Date => {
    if (!dateStr) return new Date(0);
    // DD/MM/YYYY
    const dmy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    // YYYY-MM-DD
    const ymd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
    // "Saturday, Apr 12" — legacy MOCK_SCHEDULE format
    return new Date(dateStr);
  };

  const formatEventTime = (timeStr: string): string => {
    if (!timeStr) return '';
    const hhmm = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
      const h = parseInt(hhmm[1]);
      const m = hhmm[2];
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:${m} ${ampm}`;
    }
    return timeStr;
  };

  const formatDate = (day: number) => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return { weekday, full: `${weekday}, ${month} ${day}`, iso: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
  };

  const currentDayInfo = formatDate(selectedDate.getDate());
  const currentDayWeekday = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const currentMonthLabel = selectedDate.toLocaleDateString('en-NZ', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
  
  const allEvents = useMemo(() => {
    const allMyTeamIds = [...(user?.teamIds || [])];
    const combined = [...MOCK_SCHEDULE, ...realEvents];
    return combined.filter(e =>
      user?.role === 'club' ||
      allMyTeamIds.includes(e.teamId) ||
      e.teamId === user?.linkedTeamId
    );
  }, [realEvents, user]);

  const dayEvents = useMemo(() => {
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return allEvents
      .filter(event => {
        const d = parseEventDate(event.date);
        if (!d || d.getTime() === 0) return false;
        d.setHours(0, 0, 0, 0);
        return d.getTime() === selected.getTime();
      })
      .sort((a, b) => {
        const toMinutes = (t: string) => {
          if (!t) return 9999;
          const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (!match) return 9999;
          let h = parseInt(match[1]);
          const m = parseInt(match[2]);
          const ampm = match[3].toUpperCase();
          if (ampm === 'PM' && h !== 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
          return h * 60 + m;
        };
        return toMinutes(a.time) - toMinutes(b.time);
      });
  }, [allEvents, selectedDate]);


  const handleAttendance = (eventId: string, status: 'going' | 'absent', announcementId?: string) => {
    if (status === 'absent' && attendance[eventId]?.status !== 'absent') {
      setPendingEventId(eventId);
      setPendingAnnouncementId(announcementId || null);
      setAbsenceReason("");
      setIsAbsenceDialogOpen(true);
      return;
    }

    const newStatus = attendance[eventId]?.status === status ? null : status;
    setAttendance(prev => {
      if (newStatus === null) {
        const { [eventId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [eventId]: { status: newStatus }
      };
    });

    if (newStatus !== null && announcementId) {
      setDismissedAnnouncementIds(prev => new Set([...prev, announcementId]));
    }

    if (user) {
      StorageService.updateAttendance(eventId, user.id, user.name, newStatus);
    }
  };

  const submitAbsenceReason = () => {
    if (pendingEventId && user) {
      setAttendance(prev => ({
        ...prev,
        [pendingEventId]: { status: 'absent', reason: absenceReason }
      }));
      StorageService.updateAttendance(pendingEventId, user.id, user.name, 'absent', absenceReason);
      
      if (pendingAnnouncementId) {
        setDismissedAnnouncementIds(prev => new Set([...prev, pendingAnnouncementId]));
      }
      
      setIsAbsenceDialogOpen(false);
      setPendingEventId(null);
      setPendingAnnouncementId(null);
      setAbsenceReason("");
    }
  };

  const MOCK_ABSENTEES = [
    { name: "Liam Smith", event: "Team Training", status: "Absent", reason: "Doctors appointment" },
    { name: "Oliver Brown", event: "Vs. Eagles Utd", status: "Absent", reason: "Work" },
    { name: "Noah Williams", event: "Team Training", status: "Absent", reason: "Illness" },
    { name: "James Jones", event: "Vs. Eagles Utd", status: "Absent", reason: "Travel" },
    { name: "William Garcia", event: "Tactical Session", status: "Absent", reason: "Personal" },
  ];

  useEffect(() => {
    // Simulate a very short loading state for smooth transition
    const timer = setTimeout(() => {
      setSummary({
        lineupHighlight: user?.role === 'club' 
          ? "All 12 teams have submitted their weekend rosters." 
          : user?.role === 'coach' 
            ? "Squad is looking sharp for the weekend." 
            : user?.role === 'supporter'
              ? "Your followed teams have 3 matches this weekend!"
              : "You're starting as Captain / Midfield this weekend!",
        motivationalQuote: "Success is where preparation and opportunity meet.",
        coachInsight: user?.role === 'club' 
          ? "Club attendance is up 12% this month. New equipment has arrived for the junior squads." 
          : user?.role === 'coach' 
            ? "Attendance has been 95% this week. The team is highly motivated." 
            : user?.role === 'supporter'
              ? "Supporter engagement is at an all-time high! Check out the fan zone."
              : undefined
      });
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [user]);

  return (
    <div className="bg-white min-h-screen pb-24">
      {/* Header Section */}
      <div className="pt-6 pb-4 px-4 space-y-4">
        <div className="flex justify-between items-center px-2">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Home</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Dashboard</p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => onTabChange("profile")}
              className="px-4 py-1.5 rounded-full bg-white shadow-sm border border-slate-100 flex items-center gap-2 group active:scale-95 transition-all"
            >
              <UserIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary transition-colors" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">My Profile</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-2">
        {/* Dark schedule card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative px-4"
        >
          <div className="rounded-[28px] overflow-hidden relative bg-slate-900 text-white">
            {/* Radial glow */}
            <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
              background: 'radial-gradient(120% 80% at 100% 0%, oklch(0.40 0.18 272) 0%, transparent 60%)'
            }} />
            <div className="absolute -right-10 -bottom-12 w-48 h-48 rounded-full opacity-15 pointer-events-none bg-primary" />

            {/* Date header with chevrons */}
            <div className="relative flex items-center justify-between px-3 py-3.5 border-b border-white/10">
              <button
                onClick={() => setSelectedDate(prev => {
                  const d = new Date(prev);
                  d.setDate(d.getDate() - 1);
                  return d;
                })}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:bg-white/5 hover:text-white active:scale-95"
              >
                <ChevronLeft className="w-[18px] h-[18px]" />
              </button>
              <div className="text-center">
                <p className="text-[20px] font-black text-white uppercase italic tracking-tight leading-none">{currentDayWeekday}</p>
                <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.24em] mt-1.5">{currentMonthLabel.toUpperCase()}</p>
              </div>
              <button
                onClick={() => setSelectedDate(prev => {
                  const d = new Date(prev);
                  d.setDate(d.getDate() + 1);
                  return d;
                })}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:bg-white/5 hover:text-white active:scale-95"
              >
                <ChevronRight className="w-[18px] h-[18px]" />
              </button>
            </div>

            {/* Events */}
            <div className="relative p-3 space-y-2">
              <motion.div
                key={selectedDate.toISOString()}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 50) setSelectedDate(prev => { const d = new Date(prev); d.setDate(d.getDate() - 1); return d; });
                  else if (info.offset.x < -50) setSelectedDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + 1); return d; });
                }}
                className="space-y-2 cursor-grab active:cursor-grabbing"
              >
                {dayEvents.length > 0 ? (
                  dayEvents.map((event) => {
                    const isExpanded = expandedEventId === event.id;
                    const typeStyle = event.type === 'match'
                      ? { bg: 'rgba(255,255,255,0.08)', fg: 'oklch(0.80 0.13 272)', label: 'Match', Icon: Trophy }
                      : event.type === 'training'
                        ? { bg: 'rgba(245,158,11,0.12)', fg: '#fbbf24', label: 'Training', Icon: Activity }
                        : event.type === 'meeting'
                          ? { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.7)', label: 'Meeting', Icon: Users }
                          : { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.7)', label: event.type || 'Event', Icon: Calendar };

                    const attendanceRecords = allRealAttendance[event.id] || [];
                    const goingCount = attendanceRecords.filter(a => a.status === 'going').length;
                    const absentCount = attendanceRecords.filter(a => a.status === 'absent').length;
                    const total = goingCount + absentCount;
                    const ratio = total ? goingCount / total : 1;
                    const dotColor = attendance[event.id]?.status === 'going' ? '#10b981'
                      : attendance[event.id]?.status === 'absent' ? '#f43f5e'
                      : ratio >= 0.75 ? '#10b981' : ratio >= 0.4 ? '#f59e0b' : '#f43f5e';

                    return (
                      <div key={event.id} className="rounded-2xl border border-white/10 overflow-hidden transition-all bg-white/[0.04] backdrop-blur-sm">
                        <button onClick={() => setExpandedEventId(isExpanded ? null : event.id)} className="w-full p-2.5 flex items-center gap-3 text-left active:bg-white/5">
                          {/* Type tile */}
                          <div className="relative w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0" style={{ background: typeStyle.bg, color: typeStyle.fg }}>
                            <typeStyle.Icon className="w-5 h-5" />
                            <span className="text-[7.5px] font-black uppercase tracking-[0.14em] mt-0.5">{typeStyle.label}</span>
                            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2" style={{ background: dotColor, borderColor: '#0f172a' }} />
                          </div>

                          {/* Body */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {(() => {
                                const allTeams = [...MOCK_TEAMS, ...StorageService.getCustomTeams()];
                                const teamColor = allTeams.find(t => t.id === event.teamId)?.color || '#6366f1';
                                const name = teamNames[event.teamId] || allTeams.find(t => t.id === event.teamId)?.name || (event as any).teamName || '';
                                return name ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: teamColor }} />
                                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-[0.18em] truncate">{name}</span>
                                  </>
                                ) : null;
                              })()}
                            </div>
                            <p className="text-[14px] font-black text-white uppercase tracking-tight leading-tight mt-0.5 truncate">{event.title}</p>
                            <div className="flex items-center gap-3 text-white/50 mt-1">
                              <span className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.14em] whitespace-nowrap shrink-0">
                                <Clock className="w-[10px] h-[10px]" />{formatEventTime(event.time)}
                              </span>
                              {(event.location || event.pinLocation) && (
                                <span
                                  onClick={(e) => { e.stopPropagation(); setLocationModalEvent(event); }}
                                  className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.14em] truncate min-w-0 cursor-pointer"
                                >
                                  <MapPin className="w-[10px] h-[10px] shrink-0" />{getShortLocation(event.pinLocation?.label || event.location)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Chevron */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white/40 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </div>
                        </button>

                        {/* Expanded detail */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 pt-1 border-t border-white/10 mt-1 space-y-3">
                                {(event as any).notes && (
                                  <p className="text-[11px] text-white/70 leading-relaxed pt-2">
                                    <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] block mb-1">Notes</span>
                                    {(event as any).notes}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em]">
                                  <span className="text-emerald-400 flex items-center gap-1"><Check className="w-[9px] h-[9px]" />{goingCount} Going</span>
                                  <span className="text-rose-400">· {absentCount} Out</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleAttendance(event.id, 'going'); }}
                                    className={`h-9 rounded-xl text-[9px] font-black uppercase tracking-[0.18em] text-white active:scale-95 transition-all ${
                                      attendance[event.id]?.status === 'going' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-primary'
                                    }`}
                                  >
                                    {attendance[event.id]?.status === 'going' ? <span className="flex items-center justify-center gap-1"><Check className="w-2.5 h-2.5" />Going</span> : "I'm Going"}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleAttendance(event.id, 'absent'); }}
                                    className={`h-9 rounded-xl text-[9px] font-black uppercase tracking-[0.18em] active:scale-95 transition-all ${
                                      attendance[event.id]?.status === 'absent' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'text-white/80 bg-white/10'
                                    }`}
                                  >
                                    {attendance[event.id]?.status === 'absent' ? <span className="flex items-center justify-center gap-1"><Check className="w-2.5 h-2.5" />Absent</span> : "Can't Make It"}
                                  </button>
                                </div>
                                {attendance[event.id]?.status === 'absent' && attendance[event.id]?.reason && (
                                  <div className="px-3 py-2 bg-rose-500/10 rounded-xl border border-rose-500/20">
                                    <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-0.5">Reason:</p>
                                    <p className="text-[10px] font-medium text-rose-300 italic">"{attendance[event.id]?.reason}"</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                ) : (isCoach || user?.role === 'club') ? (
                  <button onClick={() => { localStorage.setItem('gameday_open_create_event', '1'); onTabChange('schedule'); }}
                    className="w-full rounded-2xl bg-white/5 p-5 flex items-center gap-3 border border-dashed border-white/10 active:scale-[0.98] transition-transform">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/30">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[11px] font-black text-white uppercase tracking-tight">Nothing scheduled</p>
                      <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.18em] mt-0.5">Tap to add an event</p>
                    </div>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white bg-primary">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ) : (
                  <div className="rounded-2xl bg-white/5 p-5 flex items-center gap-3 border border-dashed border-white/10">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/30">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[11px] font-black text-white uppercase tracking-tight">Nothing scheduled</p>
                      <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.18em] mt-0.5">No events for today</p>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Quick actions */}
        <div className={`grid ${isCoach || user?.role === 'club' ? 'grid-cols-3' : 'grid-cols-2'} gap-2 px-4`}>
          {[
            ...(isCoach || user?.role === 'club' ? [
              { label: 'Broadcast', Icon: Megaphone, filled: true, action: () => setIsBroadcastOpen(!isBroadcastOpen) },
            ] : []),
            { label: 'My Teams', Icon: Users, filled: false, action: () => onTabChange('teams') },
            ...(isCoach || user?.role === 'club' ? [
              { label: 'Add Event', Icon: Sparkles, filled: false, action: () => { localStorage.setItem('gameday_open_create_event', '1'); onTabChange('schedule'); } },
            ] : [
              { label: 'Schedule', Icon: Calendar, filled: false, action: () => onTabChange('schedule') },
            ]),
          ].map((q, i) => (
            <button key={i} onClick={q.action}
              className="bg-white rounded-2xl p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform shadow-sm border border-slate-100">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${q.filled ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                <q.Icon className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-black italic text-slate-700 uppercase tracking-[0.14em]">{q.label}</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-white rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : summary ? (
          <>
            {/* Broadcast section removed — now a modal, rendered at bottom of component */}


            {/* Announcements */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-3 px-4"
              >
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-slate-900" />
                    <h3 className="text-[11px] font-black text-slate-900 uppercase italic tracking-[0.18em]">
                      Announcements
                    </h3>
                  </div>
                  {totalAnnouncementsCount > 0 && (
                    <span className="min-w-[28px] h-[26px] px-2 rounded-full flex items-center justify-center text-white text-[11px] font-black tabular-nums bg-primary">
                      {totalAnnouncementsCount}
                    </span>
                  )}
                </div>
                <div 
                  className="space-y-3 overflow-y-auto pr-1"
                >
                  {/* Sort newest first */}
                  {(() => {
                    const sorted = [...sortedRealAnnouncements]
                      .filter(ann => !dismissedAnnouncementIds.has(ann.id))
                      .sort(
                        (a, b) => new Date(b.timestamp).getTime() - 
                                  new Date(a.timestamp).getTime()
                      );
                    const visible = sorted.slice(0, 3);
                    const remaining = sorted.length - 3;

                    return (
                      <div className="space-y-3">
                        {sorted.length === 0 && (
                          <div className="p-8 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100">
                            <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No announcements yet</p>
                          </div>
                        )}
                        {/* Show first 3 only */}
                        {visible.map((ann) => (
                          <div key={ann.id} className={`bg-white rounded-2xl overflow-hidden ${ann.isUrgent ? 'border-2 border-red-400 border-l-[4px] border-l-red-500' : 'border border-primary/30 border-l-[3px] border-l-primary'}`}>
                            <div className={`flex-1 relative ${ann.isUrgent ? 'py-3.5 px-4' : 'py-2.5 px-4'}`}>
                              {ann.isUrgent && (
                                <span className="absolute top-3 right-3 bg-red-50 text-red-500 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-red-100">Urgent</span>
                              )}
                              <div className="flex items-center gap-1.5 mb-1">
                                {ann.isUrgent && (
                                  <div className="w-4 h-4 bg-red-50 rounded-full flex items-center justify-center">
                                    <Bell className="w-2.5 h-2.5 text-red-500" />
                                  </div>
                                )}
                                {ann.type === 'attendance_reminder' && !ann.isUrgent && (
                                  <div className="w-4 h-4 bg-primary/10 rounded-full flex items-center justify-center">
                                    <Clock className="w-2.5 h-2.5 text-primary" />
                                  </div>
                                )}
                                <div className="mb-1">
                                  <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${ann.isUrgent ? 'text-red-400' : 'text-primary'}`}>{ann.teamName}</p>
                                  <p className={`font-black uppercase text-slate-900 ${ann.isUrgent ? 'text-[12px]' : 'text-[11px]'}`}>{ann.title}</p>
                                </div>
                              </div>
                              <p className={`text-slate-600 leading-relaxed mb-1.5 ${ann.isUrgent ? 'text-[12px]' : 'text-[11px]'}`}>{ann.content}</p>
                              
                              {ann.type === 'attendance_reminder' && ann.eventId && (
                                <div className="mb-3">
                                  {attendance[ann.eventId]?.status ? (
                                    <div className="flex items-center gap-2">
                                      <span className="bg-green-50 text-green-600 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full border border-green-100 flex items-center gap-1">
                                        <Check className="w-2.5 h-2.5" />
                                        You Responded
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAttendance(ann.eventId!, 'going', ann.id);
                                        }}
                                        className="flex-1 h-8 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-[0.98]"
                                      >
                                        Going
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAttendance(ann.eventId!, 'absent', ann.id);
                                        }}
                                        className="flex-1 h-8 bg-white border border-slate-200 text-slate-600 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-[0.98]"
                                      >
                                        Absent
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center justify-between">
                                <p className={`text-[8px] font-bold uppercase tracking-widest ${ann.isUrgent ? 'text-red-400' : 'text-slate-400'}`}>
                                  — Sent by {ann.senderName}
                                </p>
                                <div className="flex items-center gap-2">
                                  {user?.id === ann.senderId && (
                                    <button
                                      onClick={() => setConfirmDeleteId(ann.id)}
                                      className="w-5 h-5 rounded-full bg-slate-100 hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-400 transition-all active:scale-95"
                                    >
                                      <span className="text-[14px] font-bold leading-none mb-[1px]">−</span>
                                    </button>
                                  )}
                                  <p className={`text-[9px] font-bold ${ann.isUrgent ? 'text-red-400' : 'text-slate-400'}`}>
                                    {formatAnnouncementDate(ann.timestamp)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* See More button — only if more than 3 */}
                        {remaining > 0 && (
                          <button
                            onClick={() => setShowAllAnnouncements(true)}
                            className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                            See {remaining} More
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

            </motion.div>

            {/* Attendance Summary Section (Coach Only) */}
            {isCoach && (() => {
              // Pre-compute attendance data for all teams
              const attendanceTeams = squadTeams.map((team) => {
                const teamEvents = allEvents.filter(e => e.teamId === team.id);
                const todayDate = new Date();
                todayDate.setHours(0, 0, 0, 0);
                const upcomingEvents = teamEvents.filter(e => {
                  const d = parseEventDate(e.date);
                  return d >= todayDate;
                }).sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime());
                const mainEvent = upcomingEvents[0] || null;
                if (!mainEvent) return null;
                const eventSubtitle = formatEventSubtitle(mainEvent);
                const attendanceList = StorageService.getAttendance()[mainEvent.id] || [];
                const goingAttendees = attendanceList.filter((a: any) => a.status === 'going');
                const absentAttendees = attendanceList.filter((a: any) => a.status === 'absent');
                const totalGoing = goingAttendees.length;
                const totalAbsent = absentAttendees.length;
                const records = StorageService.getAttendance()[mainEvent.id] || [];
                const teamMembers = StorageService.getTeamMembers(team.id);
                const totalMembers = teamMembers.length;
                const teamInitials = (teamNames[team.id] || team.name).split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();
                return { team, mainEvent, eventSubtitle, goingAttendees, absentAttendees, totalGoing, totalAbsent, totalMembers, teamInitials, records, teamMembers };
              }).filter(Boolean) as any[];

              const visibleTeams = attendanceTeams.slice(0, 3);
              const remainingCount = attendanceTeams.length - 3;

              const renderAttendanceCard = (data: any) => {
                const { team, mainEvent, eventSubtitle, goingAttendees, absentAttendees, totalGoing, totalAbsent, totalMembers, teamInitials, records, teamMembers } = data;
                const teamCard = (
                      <button
                        type="button"
                        className={`w-full text-left bg-white rounded-2xl shadow-sm overflow-hidden
                                   flex items-stretch ${mainEvent ? 'hover:shadow-md transition-all active:scale-[0.99] group cursor-pointer' : ''}`}
                      >
                        {/* Color stripe — app accent */}
                        <span className="w-1 shrink-0 bg-primary" />

                        {/* Team badge tile */}
                        <div className="pl-3 py-3 flex items-center">
                          <div className="w-[50px] h-[50px] rounded-xl flex items-center justify-center text-primary font-black text-[12px] tracking-tight shrink-0 overflow-hidden bg-white border border-slate-100">
                            {(!logoErrors[team.id] && (teamLogos[team.id] || team.logo)) ? (
                              <img
                                src={teamLogos[team.id] || team.logo}
                                alt={team.name}
                                className="w-full h-full object-contain p-1"
                                onError={() => setLogoErrors(prev => ({ ...prev, [team.id]: true }))}
                              />
                            ) : (
                              teamInitials
                            )}
                          </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-w-0 py-2.5 px-3">
                          <p className="text-[14px] font-black text-slate-900 italic uppercase tracking-tight leading-none truncate">
                            {teamNames[team.id] || team.name}
                          </p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-[0.16em] mt-1.5 truncate" style={{ fontWeight: 500 }}>
                            {eventSubtitle}
                          </p>
                          <p className="text-[13px] font-semibold italic tracking-tight mt-1 tabular-nums">
                            <span className="text-emerald-600">{totalGoing}</span>
                            <span className="text-slate-300 mx-1.5 font-normal">/</span>
                            <span className="text-rose-600">{totalAbsent}</span>
                            <span className="text-slate-300 mx-1.5 font-normal">/</span>
                            <span className="text-slate-400">{totalMembers}</span>
                          </p>
                        </div>

                        {/* Chevron */}
                        {mainEvent && (
                          <div className="pr-3 flex items-center text-slate-300">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    );

                return (
                  <React.Fragment key={team.id}>
                    <Dialog>
                      <DialogTrigger render={teamCard} />
                            <DialogContent 
                              className="w-full sm:max-w-[425px] rounded-[2.5rem] border-none p-0 overflow-hidden flex flex-col max-h-[90vh]"
                              closeButtonClassName="top-6 right-6 w-8 h-8 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all"
                            >
                              <div className="bg-slate-900 p-5 text-white">
                                <DialogHeader>
                                  <div className="flex items-center gap-3 mb-1">
                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0">
                                      {(!logoErrors[team.id] && (teamLogos[team.id] || team.logo)) ? (
                                        <img
                                          src={teamLogos[team.id] || team.logo}
                                          alt={team.name}
                                          className="w-full h-full object-contain p-1"
                                          onError={() => setLogoErrors(prev => ({ ...prev, [team.id]: true }))}
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-xl">
                                          <Users className="w-6 h-6 text-slate-300" />
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <DialogTitle className="text-xl font-black uppercase italic tracking-tight text-white">
                                        {teamNames[team.id] || team.name}
                                      </DialogTitle>
                                      <p className="text-[10px] font-bold text-white uppercase tracking-[0.2em] opacity-60">{eventSubtitle}</p>
                                    </div>
                                  </div>
                                </DialogHeader>
                              </div>
                              
                              <ScrollArea className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50">
                            <div className="space-y-4">
                              {/* Going Section */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between px-2">
                                  <h5 className="text-[10px] font-black text-green-600 uppercase tracking-widest lowercase">Going ({totalGoing})</h5>
                                  <div className="h-px flex-1 bg-green-100 ml-4" />
                                </div>
                                <div className="grid gap-2">
                                  {goingAttendees.map(a => {
                                    const player = teamMembers.find(p => p.id === a.userId);
                                    return (
                                      <button 
                                        key={a.userId} 
                                        onClick={() => onTabChange('profile')} // TODO: deep-link to member profile post-Firebase
                                        className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-green-400 h-14 text-left"
                                      >
                                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-500 shrink-0">
                                          <Check className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-xs font-black text-slate-900 italic">{(a.userName || a.userId).split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</p>
                                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-none mt-1">{player?.position || 'PLAYER'}</p>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Absent Section */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between px-2">
                                  <h5 className="text-[10px] font-black text-red-600 uppercase tracking-widest lowercase">Absent ({totalAbsent})</h5>
                                  <div className="h-px flex-1 bg-red-100 ml-4" />
                                </div>
                                <div className="grid gap-2">
                                  {absentAttendees.map(a => {
                                    const player = teamMembers.find(p => p.id === a.userId);
                                    return (
                                      <button 
                                        key={a.userId} 
                                        onClick={() => onTabChange('profile')} // TODO: deep-link to member profile post-Firebase
                                        className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-red-400 h-14 text-left"
                                      >
                                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 shrink-0">
                                          <X className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-xs font-black text-slate-900 italic">{(a.userName || a.userId).split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</p>
                                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-none mt-1">
                                            {a.reason || "NOT SPECIFIED"}
                                          </p>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* No Response Section */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between px-2">
                                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Response ({teamMembers.filter(p => !records.find((r: any) => r.userId === p.id || r.userName === p.name)).length})</h5>
                                  <div className="h-px flex-1 bg-slate-200 ml-4" />
                                </div>
                                <div className="grid gap-2 opacity-60">
                                  {(() => {
                                    const records = StorageService.getAttendance()[mainEvent.id] || [];
                                    
                                    return teamMembers.map(player => {
                                      const record = records.find(r => r.userId === player.id || r.userName === player.name);
                                      if (record) return null;
                                      
                                      return (
                                        <div key={player.id} className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-dashed border-slate-200 h-14">
                                          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 text-[10px] font-black">
                                            ?
                                          </div>
                                          <div className="flex-1">
                                            <p className="text-xs font-black text-slate-400 italic">{player.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</p>
                                            <p className="text-[10px] font-medium text-slate-300 uppercase tracking-widest leading-none mt-1">{player.position}</p>
                                          </div>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            </div>
                          </ScrollArea>
                          <div className="p-4 bg-white border-t border-slate-100">
                            <button
                              onClick={() => {
                                if (!mainEvent) return;

                                // Sync club/team info
                                const allTeams = [...MOCK_TEAMS, ...StorageService.getCustomTeams()];
                                const targetTeamId = mainEvent.teamId || user?.teamIds?.[0] || 'all';
                                const selectedTeam = allTeams.find(t => t.id === targetTeamId);
                                const announcementClubId = user?.clubId || selectedTeam?.clubId || '';

                                // Get all players who haven't responded
                                const records = StorageService.getAttendance()[
                                  mainEvent.id
                                ] || [];
                                
                                const respondedIds = records
                                  .filter(r => r.status !== null)
                                  .map(r => r.userId);

                                // Send an announcement to the team for this event
                                StorageService.addAnnouncement({
                                  senderId: user?.id || 'coach',
                                  senderName: user?.name || 'Coach',
                                  teamId: targetTeamId,
                                  teamName: teamNames[team.id] || 
                                            team.name || 
                                            mainEvent.title || 'Team',
                                  clubId: announcementClubId,
                                  title: `⏰ Reminder: ${mainEvent.title}`,
                                  content: `Please confirm your attendance for "${mainEvent.title}" on ${mainEvent.date} at ${mainEvent.time}. ${mainEvent.location ? `Location: ${mainEvent.location}.` : ''} Tap Going or Can't Make It on your schedule.`,
                                  type: 'attendance_reminder',
                                  eventId: mainEvent.id,
                                });

                                setReminderSentEventId(mainEvent.id);
                                
                                // Reset after 3 seconds
                                setTimeout(() => {
                                  setReminderSentEventId(null);
                                }, 3000);
                              }}
                              className={cn(
                                "w-full h-14 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]",
                                reminderSentEventId === mainEvent?.id
                                  ? "bg-green-500 text-white"
                                  : "bg-slate-900 hover:bg-slate-800 text-white"
                              )}
                            >
                              {(() => {
                                const records = StorageService.getAttendance()[
                                  mainEvent?.id
                                ] || [];
                                const respondedIds = records
                                  .filter(r => r.status !== null)
                                  .map(r => r.userId);
                                const pendingCount = teamMembers.filter(
                                  p => !respondedIds.includes(p.id)
                                ).length;
                                
                                return reminderSentEventId === mainEvent?.id ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Reminder Sent!
                                  </span>
                                ) : (
                                  <span className="flex items-center justify-center gap-2">
                                    <Bell className="w-4 h-4" />
                                    Send Reminder to {pendingCount} Pending
                                  </span>
                                );
                              })()}
                            </button>
                          </div>
                        </DialogContent>
                    </Dialog>
                  </React.Fragment>
                );
              };

              return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between px-5">
                  <h3 className="text-[11px] font-black text-slate-900 uppercase italic tracking-[0.18em] flex items-center gap-2">
                    <Users className="w-[13px] h-[13px] text-slate-900" />
                    Team Attendance
                  </h3>
                  {attendanceTeams.length > 0 && (
                    <span className="min-w-[28px] h-[26px] px-2 rounded-full flex items-center justify-center text-white text-[11px] font-black tabular-nums bg-primary">
                      {attendanceTeams.length}
                    </span>
                  )}
                </div>

                <div className="space-y-3 px-4">
                  {attendanceTeams.length === 0 && (
                    <div className="p-8 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100">
                      <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No team attendance yet</p>
                    </div>
                  )}
                  {visibleTeams.map(data => renderAttendanceCard(data))}
                  {remainingCount > 0 && (
                    <button
                      onClick={() => setShowAllAttendance(true)}
                      className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      See {remainingCount} More
                    </button>
                  )}
                </div>
              </motion.div>
              );
            })()}


            {hasChildren && (
              <section className="space-y-3 px-4 pb-2">
                <h3 className="text-[11px] font-black text-slate-900 uppercase italic tracking-[0.18em] flex items-center gap-2 px-1">
                  <Users className="w-[13px] h-[13px] text-slate-900" />
                  My Kids
                </h3>
                {JSON.parse(localStorage.getItem('gameday_children') || '[]')
                  .filter((c: any) => c.parentIds?.includes(user?.id))
                  .map((child: any) => (
                    <Card key={child.id} className="border-none shadow-sm bg-white rounded-2xl p-4">
                      <div className="flex items-center gap-3">
                        <DefaultAvatar name={child.name} size="md" className="rounded-xl" />
                        <div>
                          <p className="text-[11px] font-black text-slate-900 uppercase italic">{child.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {(child.teamIds || []).length} team{(child.teamIds || []).length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))
                }
              </section>
            )}
          </>
        ) : null}
      </div>

      {/* Absence Reason Dialog */}
      <Dialog open={isAbsenceDialogOpen} onOpenChange={setIsAbsenceDialogOpen}>
        <DialogContent 
          className="sm:max-w-[400px] rounded-[2.5rem] border-none p-0 overflow-hidden"
          closeButtonClassName="top-6 right-6 w-8 h-8 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all"
        >
          <div className="bg-slate-900 p-8 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase italic tracking-tight text-white">
                Absence Reason
              </DialogTitle>
              <p className="text-[10px] font-bold text-white uppercase tracking-[0.2em] opacity-60">
                Please explain why you can't attend
              </p>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-4 bg-white">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Reason for Absence</label>
              <textarea 
                placeholder="e.g. Work commitments, feeling unwell, family event..." 
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.target.value)}
                className="w-full min-h-[120px] p-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none font-medium text-slate-700"
              />
            </div>
            <div className="flex gap-3">
              <Button 
                variant="ghost" 
                onClick={() => setIsAbsenceDialogOpen(false)}
                className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400"
              >
                Cancel
              </Button>
              <Button 
                onClick={submitAbsenceReason}
                className="flex-1 h-12 rounded-xl shadow-lg shadow-primary/20 font-black text-[10px] uppercase tracking-widest"
              >
                Submit Reason
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AnimatePresence>
        {locationModalEvent && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLocationModalEvent(null)}
              className="fixed inset-0 bg-slate-900/60 
                         backdrop-blur-sm z-[60]"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, 
                            stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 
                         -translate-y-1/2 z-[70] w-[92%] max-w-sm 
                         bg-white rounded-[2rem] shadow-2xl 
                         overflow-hidden"
            >
              {/* Header */}
              <div className="bg-slate-900 p-5 flex items-center 
                              justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-xl 
                                 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 
                                 uppercase tracking-widest">
                      Event Location
                    </p>
                    <p className="text-sm font-black uppercase italic 
                                 text-white leading-tight">
                      {locationModalEvent.title}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setLocationModalEvent(null)}
                  className="w-8 h-8 rounded-xl bg-white/5 
                             hover:bg-white/15 flex items-center 
                             justify-center text-white/60 
                             transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Map preview */}
              {locationModalEvent.pinLocation ? (
                <div className="relative">
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${locationModalEvent.pinLocation.lat},${locationModalEvent.pinLocation.lng}&zoom=16&size=400x220&maptype=roadmap&markers=color:red|label:📍|${locationModalEvent.pinLocation.lat},${locationModalEvent.pinLocation.lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                    alt="Event location map"
                    className="w-full h-48 object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).parentElement!
                        .classList.add('hidden');
                    }}
                  />
                  {/* Map overlay gradient */}
                  <div className="absolute bottom-0 left-0 right-0 
                                 h-12 bg-gradient-to-t from-white/80 
                                 to-transparent" />
                </div>
              ) : (
                <div className="h-32 bg-slate-50 flex items-center 
                                justify-center">
                  <div className="text-center">
                    <MapPin className="w-8 h-8 text-slate-200 
                                      mx-auto mb-1" />
                    <p className="text-[9px] font-bold text-slate-300 
                                 uppercase tracking-widest">
                      No pin set
                    </p>
                  </div>
                </div>
              )}

              {/* Location details */}
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-[9px] font-black text-slate-400 
                               uppercase tracking-widest mb-1">
                    Address
                  </p>
                  <p className="text-[13px] font-black uppercase italic 
                               text-slate-900 leading-tight">
                    {locationModalEvent.pinLocation?.label || 
                     locationModalEvent.location || 
                     'Location not set'}
                  </p>
                  {locationModalEvent.pinLocation && (
                    <p className="text-[9px] text-slate-400 mt-1">
                      {locationModalEvent.pinLocation.lat.toFixed(5)}, 
                      {locationModalEvent.pinLocation.lng.toFixed(5)}
                    </p>
                  )}
                </div>

                {/* Event details row */}
                <div className="flex items-center gap-3 
                                bg-slate-50 rounded-2xl p-3">
                  <Calendar className="w-4 h-4 text-slate-400 
                                      shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-slate-900 
                                 uppercase">
                      {locationModalEvent.date}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {locationModalEvent.time}
                    </p>
                  </div>
                </div>

                {/* Get Directions button */}
                <a
                  href={locationModalEvent.pinLocation
                    ? `https://www.google.com/maps/dir/?api=1&destination=${locationModalEvent.pinLocation.lat},${locationModalEvent.pinLocation.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationModalEvent.location || '')}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setLocationModalEvent(null)}
                  className="flex items-center justify-center gap-2 
                             w-full h-14 bg-primary hover:bg-primary/90 
                             text-white rounded-2xl text-[11px] font-black 
                             uppercase tracking-widest transition-all 
                             active:scale-[0.98] shadow-lg 
                             shadow-primary/20 no-underline"
                >
                  <Navigation className="w-5 h-5" />
                  Get Directions
                </a>

                {/* Open in Maps note */}
                <p className="text-[9px] text-slate-400 text-center">
                  Opens in Google Maps on your device
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAllAnnouncements && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAllAnnouncements(false)}
              className="fixed inset-0 bg-slate-900/60 
                         backdrop-blur-sm z-[60]"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, 
                            stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 
                         -translate-y-1/2 z-[70] w-[92%] max-w-sm 
                         max-h-[80vh] flex flex-col bg-white 
                         rounded-[2rem] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="bg-slate-900 p-5 shrink-0 flex 
                              items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-xl 
                                 flex items-center justify-center">
                    <Megaphone className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase 
                                  italic text-white leading-none">
                      Announcements
                    </h3>
                    <p className="text-[9px] font-bold text-slate-400 
                                 uppercase tracking-widest mt-0.5">
                      {totalAnnouncementsCount} total
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAllAnnouncements(false)}
                  className="w-8 h-8 rounded-xl bg-white/5 
                             hover:bg-white/15 flex items-center 
                             justify-center text-white/60 
                             hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable list */}
              <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {(() => {
                  const sorted = [...sortedRealAnnouncements]
                    .filter(ann => !dismissedAnnouncementIds.has(ann.id))
                    .sort(
                      (a, b) => new Date(b.timestamp).getTime() - 
                                new Date(a.timestamp).getTime()
                    );
                  return sorted.map((ann) => (
                    <div key={ann.id} className={`bg-white rounded-2xl overflow-hidden ${ann.isUrgent ? 'border-2 border-red-400 border-l-[4px] border-l-red-500' : 'border border-primary/30 border-l-[3px] border-l-primary'}`}>
                      <div className={`flex-1 relative ${ann.isUrgent ? 'py-3.5 px-4' : 'py-2.5 px-4'}`}>
                      {/* Urgent badge */}
                      {ann.isUrgent && (
                        <span className="absolute top-3 right-3 bg-red-50 text-red-500 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-red-100">Urgent</span>
                      )}
                      {/* Edit/Delete buttons — only for sender */}
                      {user?.id === ann.senderId && !ann.isUrgent && (
                        <div className="absolute top-3 right-3 flex gap-1 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingAnnouncementId(ann.id);
                              setEditTitle(ann.title);
                              setEditContent(ann.content);
                            }}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const all = StorageService.getAnnouncements();
                              const updated = all.filter(a => a.id !== ann.id);
                              localStorage.setItem('gameday_announcements', JSON.stringify(updated));
                              StorageService.deleteAnnouncementFromFirestore(ann.id);
                              window.dispatchEvent(new Event('gameday_update'));
                            }}
                            className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {user?.id === ann.senderId && ann.isUrgent && (
                        <div className="absolute top-3 right-28 flex gap-1 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingAnnouncementId(ann.id);
                              setEditTitle(ann.title);
                              setEditContent(ann.content);
                            }}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const all = StorageService.getAnnouncements();
                              const updated = all.filter(a => a.id !== ann.id);
                              localStorage.setItem('gameday_announcements', JSON.stringify(updated));
                              StorageService.deleteAnnouncementFromFirestore(ann.id);
                              window.dispatchEvent(new Event('gameday_update'));
                            }}
                            className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mb-1">
                        {ann.isUrgent && (
                          <div className="w-4 h-4 bg-red-50 rounded-full flex items-center justify-center">
                            <Bell className="w-2.5 h-2.5 text-red-500" />
                          </div>
                        )}
                        {ann.type === 'attendance_reminder' && !ann.isUrgent && (
                          <div className="w-4 h-4 bg-primary/10 rounded-full flex items-center justify-center">
                            <Clock className="w-2.5 h-2.5 text-primary" />
                          </div>
                        )}
                        <div className="mb-1">
                          <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${ann.isUrgent ? 'text-red-400' : 'text-primary'}`}>{ann.teamName}</p>
                          <p className={`font-black uppercase text-slate-900 ${ann.isUrgent ? 'text-[12px]' : 'text-[11px]'}`}>{ann.title}</p>
                        </div>
                      </div>
                      <p className={`text-slate-600 leading-relaxed mb-1.5 ${ann.isUrgent ? 'text-[12px]' : 'text-[11px]'}`}>{ann.content}</p>
                      
                      {ann.type === 'attendance_reminder' && ann.eventId && (
                        <div className="mb-3">
                          {attendance[ann.eventId]?.status ? (
                            <div className="flex items-center gap-2">
                              <span className="bg-green-50 text-green-600 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full border border-green-100 flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" />
                                You Responded
                              </span>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAttendance(ann.eventId!, 'going', ann.id);
                                }}
                                className="flex-1 h-9 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-[0.98]"
                              >
                                Going
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAttendance(ann.eventId!, 'absent', ann.id);
                                }}
                                className="flex-1 h-9 bg-white border border-slate-200 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-[0.98]"
                              >
                                Absent
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <p className={`text-[8px] font-bold uppercase tracking-widest ${ann.isUrgent ? 'text-red-400' : 'text-slate-400'}`}>
                          — Sent by {ann.senderName}
                        </p>
                        <p className={`text-[9px] font-bold ${ann.isUrgent ? 'text-red-400' : 'text-slate-400'}`}>
                          {formatAnnouncementDate(ann.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                  ));
                })()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* All Team Attendance Modal */}
      <AnimatePresence>
        {showAllAttendance && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAllAttendance(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92%] max-w-sm max-h-[80vh] flex flex-col bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-5 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-xl flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase italic text-white leading-none">Team Attendance</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {(() => {
                        const count = squadTeams.map(team => {
                          const teamEvents = allEvents.filter(e => e.teamId === team.id);
                          const todayDate = new Date(); todayDate.setHours(0,0,0,0);
                          return teamEvents.filter(e => parseEventDate(e.date) >= todayDate).length > 0 ? 1 : 0;
                        }).reduce((a, b) => a + b, 0);
                        return `${count} upcoming`;
                      })()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAllAttendance(false)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {squadTeams.map((team) => {
                  const teamEvents = allEvents.filter(e => e.teamId === team.id);
                  const todayDate = new Date(); todayDate.setHours(0,0,0,0);
                  const upcomingEvents = teamEvents.filter(e => parseEventDate(e.date) >= todayDate)
                    .sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime());
                  const mainEvent = upcomingEvents[0] || null;
                  if (!mainEvent) return null;
                  const eventSubtitle = formatEventSubtitle(mainEvent);
                  const attendanceList = StorageService.getAttendance()[mainEvent.id] || [];
                  const totalGoing = attendanceList.filter((a: any) => a.status === 'going').length;
                  const totalAbsent = attendanceList.filter((a: any) => a.status === 'absent').length;
                  const records = StorageService.getAttendance()[mainEvent.id] || [];
                  const modalTeamMembers = StorageService.getTeamMembers(team.id);
                  const totalMembers = modalTeamMembers.length;
                  const teamInitials = (teamNames[team.id] || team.name).split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <div key={team.id} className="w-full text-left bg-white rounded-2xl shadow-sm overflow-hidden flex items-stretch">
                      <span className="w-1 shrink-0 bg-primary" />
                      <div className="pl-3 py-3 flex items-center">
                        <div className="w-[50px] h-[50px] rounded-xl flex items-center justify-center text-primary font-black text-[12px] tracking-tight shrink-0 overflow-hidden bg-white border border-slate-100">
                          {(!logoErrors[team.id] && (teamLogos[team.id] || team.logo)) ? (
                            <img src={teamLogos[team.id] || team.logo} alt={team.name} className="w-full h-full object-contain p-1" onError={() => setLogoErrors(prev => ({ ...prev, [team.id]: true }))} />
                          ) : teamInitials}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 py-2.5 px-3">
                        <p className="text-[14px] font-black text-slate-900 italic uppercase tracking-tight leading-none truncate">{teamNames[team.id] || team.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-[0.16em] mt-1.5 truncate" style={{ fontWeight: 500 }}>{eventSubtitle}</p>
                        <p className="text-[13px] font-semibold italic tracking-tight mt-1 tabular-nums">
                          <span className="text-emerald-600">{totalGoing}</span>
                          <span className="text-slate-300 mx-1.5 font-normal">/</span>
                          <span className="text-rose-600">{totalAbsent}</span>
                          <span className="text-slate-300 mx-1.5 font-normal">/</span>
                          <span className="text-slate-400">{totalMembers}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingAnnouncementId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingAnnouncementId(null)}
              className="fixed inset-0 bg-slate-900/60 
                         backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, 
                            stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 
                         -translate-y-1/2 z-[70] w-[92%] max-w-sm 
                         bg-white rounded-[2rem] shadow-2xl 
                         overflow-hidden"
            >
              {/* Header */}
              <div className="bg-slate-900 p-5 shrink-0 flex 
                              items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-xl 
                                 flex items-center justify-center">
                    <Pencil className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase 
                                  italic text-white leading-none">
                      Edit Announcement
                    </h3>
                    <p className="text-[9px] font-bold text-slate-400 
                                 uppercase tracking-widest mt-0.5">
                      Only you can see these controls
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingAnnouncementId(null)}
                  className="w-8 h-8 rounded-xl bg-white/5 
                             hover:bg-white/15 flex items-center 
                             justify-center text-white/60 
                             hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black 
                                    text-slate-400 uppercase 
                                    tracking-widest px-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full h-12 bg-slate-50 rounded-2xl 
                               px-4 text-[12px] font-bold text-slate-900 
                               border border-slate-100 outline-none 
                               focus:border-primary/40 
                               focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black 
                                    text-slate-400 uppercase 
                                    tracking-widest px-1">
                    Message
                  </label>
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-50 rounded-2xl px-4 
                               py-3 text-[12px] font-medium 
                               text-slate-900 border border-slate-100 
                               outline-none focus:border-primary/40 
                               focus:ring-2 focus:ring-primary/10 
                               resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Delete button */}
                  <button
                    onClick={() => {
                      const all = StorageService.getAnnouncements();
                      const updated = all.filter(
                        ann => ann.id !== editingAnnouncementId
                      );
                      localStorage.setItem(
                        'gameday_announcements',
                        JSON.stringify(updated)
                      );
                      window.dispatchEvent(
                        new Event('gameday_update')
                      );
                      setEditingAnnouncementId(null);
                    }}
                    className="h-12 bg-red-50 hover:bg-red-100 
                               text-red-500 rounded-2xl text-[10px] 
                               font-black uppercase tracking-widest 
                               transition-all active:scale-[0.98] 
                               flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>

                  {/* Save button */}
                  <button
                    onClick={() => {
                      if (!editTitle || !editContent) return;
                      const all = StorageService.getAnnouncements();
                      const updated = all.map(ann =>
                        ann.id === editingAnnouncementId
                          ? { 
                              ...ann, 
                              title: editTitle, 
                              content: editContent,
                              editedAt: new Date().toISOString()
                            }
                          : ann
                      );
                      localStorage.setItem(
                        'gameday_announcements',
                        JSON.stringify(updated)
                      );
                      window.dispatchEvent(
                        new Event('gameday_update')
                      );
                      setEditingAnnouncementId(null);
                    }}
                    disabled={!editTitle || !editContent}
                    className="h-12 bg-slate-900 hover:bg-slate-800 
                               text-white rounded-2xl text-[10px] 
                               font-black uppercase tracking-widest 
                               transition-all active:scale-[0.98] 
                               disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDeleteId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDeleteId(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[85%] max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-6 flex items-center justify-between">
                <h3 className="text-base font-black uppercase italic text-white">Delete Announcement</h3>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm font-medium text-slate-600 text-center">Are you sure you want to delete this announcement? This cannot be undone.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="h-12 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const all = StorageService.getAnnouncements();
                      const updated = all.filter(a => a.id !== confirmDeleteId);
                      localStorage.setItem('gameday_announcements', JSON.stringify(updated));
                      StorageService.deleteAnnouncementFromFirestore(confirmDeleteId!);
                      window.dispatchEvent(new Event('gameday_update'));
                      setConfirmDeleteId(null);
                    }}
                    className="h-12 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Broadcast Modal */}
      <AnimatePresence>
        {isBroadcastOpen && (user?.role === 'club' || isCoach) && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsBroadcastOpen(false); setShowTeamsPicker(false); setShowDirectPicker(false); }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92%] max-w-sm max-h-[85vh] flex flex-col bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Megaphone className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-black uppercase italic text-slate-900 tracking-tight flex-1">New Broadcast</h3>
                <button
                  onClick={() => { setIsBroadcastOpen(false); setShowTeamsPicker(false); setShowDirectPicker(false); }}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
                {/* Teams / Direct toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowTeamsPicker(true); setShowDirectPicker(false); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      showTeamsPicker ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Teams
                  </button>
                  <button
                    onClick={() => { setShowDirectPicker(true); setShowTeamsPicker(false); setPickerSearch(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      showDirectPicker ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Direct
                  </button>
                </div>

                {/* Team selection — inline pills */}
                {showTeamsPicker && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Send to</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => { setSelectedTeamIds([]); }}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                          selectedTeamIds.length === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        All Teams
                      </button>
                      {squadTeams
                        .filter((t: any) => user?.role === 'club' || t.coachId === user?.id || (t as any).createdBy === user?.id || localStorage.getItem(`gameday_role_${user?.id}_${t.id}`) === 'coach')
                        .map((team: any) => {
                          const selected = selectedTeamIds.includes(team.id);
                          const teamColor = (team as any).color || '#6366f1';
                          return (
                            <button
                              key={team.id}
                              onClick={() => setSelectedTeamIds(p => selected ? p.filter(x => x !== team.id) : [...p, team.id])}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                selected ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: selected ? '#fff' : teamColor }} />
                              {(teamNames[team.id] || team.name).split(' ')[0]}
                            </button>
                          );
                        })}
                    </div>
                  </motion.div>
                )}

                {/* Direct player selection — inline list with search */}
                {showDirectPicker && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Send to</p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                      <input
                        placeholder="Search players..."
                        value={pickerSearch}
                        onChange={e => setPickerSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-2 text-[11px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300"
                      />
                    </div>
                    {/* Selected player chips */}
                    {selectedPlayerIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPlayerIds.map(id => {
                          const allMembers = squadTeams.flatMap((t: any) => StorageService.getTeamMembers(t.id));
                          const member = allMembers.find((m: any) => m.id === id);
                          return (
                            <span key={id} className="flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full">
                              {member?.name || id}
                              <button onClick={() => setSelectedPlayerIds(p => p.filter(x => x !== id))} className="hover:text-red-500 ml-0.5">×</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div className="max-h-[120px] overflow-y-auto space-y-1">
                      {(() => {
                        const seen = new Set<string>();
                        const allPlayers: any[] = [];
                        squadTeams.forEach((t: any) => {
                          StorageService.getTeamMembers(t.id).forEach((m: any) => {
                            if (!seen.has(m.id) && m.id !== user?.id) {
                              seen.add(m.id);
                              allPlayers.push(m);
                            }
                          });
                        });
                        const filtered = pickerSearch
                          ? allPlayers.filter(m => m.name?.toLowerCase().includes(pickerSearch.toLowerCase()))
                          : allPlayers;
                        if (filtered.length === 0) {
                          return <p className="text-center text-slate-400 text-[10px] font-medium py-3">No players found</p>;
                        }
                        return filtered.map((member: any) => {
                          const selected = selectedPlayerIds.includes(member.id);
                          return (
                            <button
                              key={member.id}
                              onClick={() => setSelectedPlayerIds(p => selected ? p.filter(x => x !== member.id) : [...p, member.id])}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-[11px] font-bold ${
                                selected ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {member.name}
                              {selected && <Check className="w-3.5 h-3.5 text-primary" />}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </motion.div>
                )}

                {/* Title */}
                <input
                  type="text"
                  placeholder="Title"
                  value={broadcastTitle}
                  onChange={e => setBroadcastTitle(e.target.value)}
                  className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-900 border border-slate-100 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 placeholder:font-medium"
                />

                {/* Message */}
                <div className="relative">
                  <textarea
                    placeholder="Message"
                    value={broadcastText}
                    onChange={e => setBroadcastText(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 pr-12 text-[12px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 resize-none placeholder:text-slate-300 min-h-[80px]"
                  />
                  <button
                    onClick={() => {
                      if (!broadcastText.trim() || !user) return;
                      const allTeams = [...MOCK_TEAMS, ...StorageService.getCustomTeams()];
                      if (selectedTeamIds.length > 0) {
                        selectedTeamIds.forEach(teamId => {
                          const selectedTeam = allTeams.find(t => t.id === teamId);
                          const announcementClubId = user?.clubId || selectedTeam?.clubId || '';
                          const teamName = teamNames[teamId] || selectedTeam?.name || allTeams.find(t => t.id === teamId)?.name || 'Unknown Team';
                          StorageService.addAnnouncement({
                            senderId: user.id, senderName: user.name,
                            teamId, teamName,
                            clubId: announcementClubId,
                            title: broadcastTitle.trim() || (user.role === 'club' ? 'Club Announcement' : 'Coach Update'),
                            content: broadcastText.trim(),
                            isUrgent,
                          });
                        });
                      }
                      if (selectedPlayerIds.length > 0) {
                        const fallbackTeam = allTeams.find(t => user?.teamIds?.includes(t.id));
                        const announcementClubId = user?.clubId || fallbackTeam?.clubId || '';
                        selectedPlayerIds.forEach(playerId => {
                          StorageService.addAnnouncement({
                            senderId: user.id, senderName: user.name,
                            teamId: 'direct', teamName: 'Direct Message',
                            clubId: announcementClubId,
                            title: broadcastTitle.trim() || 'Direct Message',
                            content: broadcastText.trim(),
                            isUrgent,
                          });
                        });
                      }
                      if (selectedTeamIds.length === 0 && selectedPlayerIds.length === 0) {
                        const fallbackTeam = allTeams.find(t => user?.teamIds?.includes(t.id));
                        const announcementClubId = user?.clubId || fallbackTeam?.clubId || '';
                        StorageService.addAnnouncement({
                          senderId: user.id, senderName: user.name,
                          teamId: 'all', teamName: 'All Teams',
                          clubId: announcementClubId,
                          title: broadcastTitle.trim() || (user.role === 'club' ? 'Club Announcement' : 'Coach Update'),
                          content: broadcastText.trim(),
                          isUrgent,
                        });
                      }
                      setBroadcastText(''); setBroadcastTitle('');
                      setSelectedTeamIds([]); setSelectedPlayerIds([]);
                      setShowTeamsPicker(false); setShowDirectPicker(false);
                      setIsUrgent(false);
                      setIsBroadcastOpen(false);
                    }}
                    className="absolute bottom-3 right-3 w-9 h-9 bg-primary/10 hover:bg-primary/20 rounded-xl flex items-center justify-center text-primary active:scale-95 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                {/* Mark as Urgent toggle */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Bell className={`w-3.5 h-3.5 ${isUrgent ? 'text-red-500' : 'text-slate-400'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isUrgent ? 'text-red-500' : 'text-slate-500'}`}>Mark as Urgent</span>
                  </div>
                  <button
                    onClick={() => setIsUrgent(!isUrgent)}
                    className={`w-10 h-6 rounded-full relative transition-colors ${isUrgent ? 'bg-red-500' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isUrgent ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
