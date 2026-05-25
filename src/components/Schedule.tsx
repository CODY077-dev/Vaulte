import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, ChevronLeft, ChevronRight, Trophy, Activity, MapPin, Clock, ChevronDown, Plus, FileText, Target, Users, Repeat, X, Navigation, Search, CheckCircle2, CalendarPlus, Check, Bell, PartyPopper, Pencil, Copy, Trash2 } from "lucide-react";

declare global {
  interface Window {
    google: any;
  }
}
import { cn } from "../lib/utils";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { MOCK_SCHEDULE, MOCK_TEAMS, MOCK_LINEUP } from "../constants";
import { User } from "../types";
import StorageService, { AttendanceRecord } from "../services/StorageService";
import FirestoreService from '../services/FirestoreService';
import DefaultAvatar from "./DefaultAvatar";

const getShortLocation = (location: string | undefined): string => {
  if (!location) return '';
  return location.split(',')[0].trim();
};

interface ScheduleProps {
  user: User | null;
  onTabChange: (tab: string) => void;
}

export default function Schedule({ user, onTabChange }: ScheduleProps) {
  const customTeams: any[] = StorageService.getCustomTeams ? StorageService.getCustomTeams() : [];
  const isCoach = user?.role === 'coach' || user?.role === 'club' || user?.role === 'manager' ||
    (user?.teamIds || []).some(tid => {
      const storedRole = localStorage.getItem(`gameday_role_${user?.id}_${tid}`);
      if (storedRole === 'coach' || storedRole === 'manager') return true;
      const team = customTeams.find((t: any) => t.id === tid);
      if (team && (team.createdBy === user?.id || team.coachId === user?.id)) return true;
      return false;
    });

  const [scheduleView, setScheduleView] = useState<'month' | 'week'>('week');
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Real current date — never hardcoded
  const _now = new Date();
  const currentYear = _now.getFullYear();
  const currentMonth = _now.getMonth();
  const today = _now.getDate();

  // Calendar navigation state
  const [calendarYear, setCalendarYear] = useState(currentYear);
  const [calendarMonth, setCalendarMonth] = useState(currentMonth);

  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
  const calendarMonthName = new Date(calendarYear, calendarMonth, 1).toLocaleDateString('en-US', { month: 'long' });
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const [selectedDate, setSelectedDate] = useState<number>(today);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [realEvents, setRealEvents] = useState<any[]>([]);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dpMonth, setDpMonth] = useState(currentMonth);
  const [dpYear, setDpYear] = useState(currentYear);
  const [attendanceModalEvent, setAttendanceModalEvent] = useState<any>(null);
  const [scheduleTeamLogos, setScheduleTeamLogos] = useState<Record<string, string>>({});
  const [scheduleLogoErrors, setScheduleLogoErrors] = useState<Record<string, boolean>>({});
  const [reminderSentEventId, setReminderSentEventId] = useState<string | null>(null);
  const [locationModalEvent, setLocationModalEvent] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceRecord[]>>({});
  const [scheduleSuccess, setScheduleSuccess] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedEvent, setCopiedEvent] = useState<any>(null);
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [mapPin, setMapPin] = useState<{ lat: number; lng: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  // Always format dates using local timezone (not UTC) — avoids NZ being rolled back a day
  const toLocalDateStr = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const handleAttendance = (eventId: string, status: 'going' | 'absent') => {
    const currentStatus = (attendanceData[eventId] || []).find(r => r.userId === user?.id)?.status;
    const newStatus = currentStatus === status ? null : status;
    StorageService.updateAttendance(eventId, user?.id || '', user?.name || '', newStatus);
    setAttendanceData(StorageService.getAttendance());
  };

  const handleDateClick = (day: number, month?: number, year?: number) => {
    const targetMonth = month ?? calendarMonth;
    const targetYear = year ?? calendarYear;
    if (month !== undefined) setCalendarMonth(month);
    if (year !== undefined) setCalendarYear(year);
    setSelectedDate(day);

    if (copiedEvent) {
      const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const newEvent = {
        ...copiedEvent,
        id: `${Date.now()}-copy`,
        date: dateStr,
        createdBy: user?.id || '',
      };
      StorageService.addEvent(newEvent);
      setCopiedEvent(null);
    }
  };

  // New event form state
  const [newEvent, setNewEvent] = useState({
    teamId: user?.teamIds?.[0] || MOCK_TEAMS[0].id,
    selectedTeamIds: [user?.teamIds?.[0] || MOCK_TEAMS[0].id] as string[],
    type: 'training' as 'training' | 'match' | 'meeting' | 'event' | 'custom',
    title: '',
    time: '6:00 PM',
    location: '',
    pinLocation: null as { lat: number; lng: number; label: string } | null,
    notes: '',
    repeat: false,
    repeatDays: [] as string[],
    repeatStartDate: toLocalDateStr(new Date(currentYear, currentMonth, today)),
    repeatEndDate: toLocalDateStr(new Date(currentYear, currentMonth + 1, today)),
  });

  useEffect(() => {
    const loadData = () => {
      setRealEvents(StorageService.getEvents());
      const data = StorageService.getAttendance();
      setAttendanceData(data);

      const logos: Record<string, string> = {};
      const allStoredTeams = [
        ...StorageService.getTeams(),
        ...(StorageService.getCustomTeams ? StorageService.getCustomTeams() : []),
      ];
      allStoredTeams.forEach((t: any) => {
        const savedLogo = StorageService.getTeamLogo ? StorageService.getTeamLogo(t.id) : null;
        if (savedLogo) logos[t.id] = savedLogo;
      });
      setScheduleTeamLogos(logos);
    };

    loadData();
    window.addEventListener('focus', loadData);
    window.addEventListener('gameday_update', loadData);

    if (localStorage.getItem('gameday_open_create_event')) {
      localStorage.removeItem('gameday_open_create_event');
      setIsAddEventOpen(true);
    }

    return () => {
      window.removeEventListener('focus', loadData);
      window.removeEventListener('gameday_update', loadData);
    };
  }, []);

  useEffect(() => {
    if (window.google) return;
    if (document.querySelector('script[src*="maps.googleapis"]')) return;
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
    s.async = true;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!isSearchingLocation) return;
    const init = () => {
      if (!mapRef.current || !window.google) return;
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: -37.0731, lng: 174.9507 }, zoom: 14,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      });
      mapInstanceRef.current = map;
      const marker = new window.google.maps.Marker({ map, draggable: true, visible: false });
      map.addListener('click', (e: any) => {
        const lat = e.latLng.lat(), lng = e.latLng.lng();
        marker.setPosition({ lat, lng }); marker.setVisible(true);
        setMapPin({ lat, lng });
      });
      marker.addListener('dragend', (e: any) => setMapPin({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
      if (searchInputRef.current) {
        const ac = new window.google.maps.places.Autocomplete(searchInputRef.current);
        ac.addListener('place_changed', () => {
          const p = ac.getPlace();
          if (!p.geometry?.location) return;
          const lat = p.geometry.location.lat(), lng = p.geometry.location.lng();
          map.setCenter({ lat, lng }); map.setZoom(17);
          marker.setPosition({ lat, lng }); marker.setVisible(true);
          setMapPin({ lat, lng });
        });
      }
    };
    window.google ? init() : (() => { const t = setInterval(() => { if (window.google) { clearInterval(t); init(); } }, 200); })();
  }, [isSearchingLocation]);

  useEffect(() => {
    if (user?.teamIds?.[0]) {
      setNewEvent(prev => ({ ...prev, teamId: user.teamIds[0] }));
    }
  }, [user]);

  // Filter events for the current user — scoped to their club/teams
  const allEvents = useMemo(() => {
    const customTeamsData = StorageService.getCustomTeams ? StorageService.getCustomTeams() : [];
    const customTeamIds = customTeamsData.map((t: any) => t.id);
    const allMyTeamIds = [...(user?.teamIds || []), ...customTeamIds];
    const userClubId = user?.clubId || MOCK_TEAMS.find(t => user?.teamIds?.includes(t.id))?.clubId || null;
    const allTeamsData = [...MOCK_TEAMS, ...customTeamsData];
    const clubTeamIds = userClubId
      ? allTeamsData.filter(t => t.clubId === userClubId).map(t => t.id)
      : [];
    const combined = [...MOCK_SCHEDULE, ...realEvents];
    return combined.filter(e =>
      (user?.role === 'club' && clubTeamIds.includes(e.teamId)) ||
      (isCoach && allMyTeamIds.includes(e.teamId)) ||
      allMyTeamIds.includes(e.teamId) ||
      e.teamId === user?.linkedTeamId
    );
  }, [realEvents, user]);

  const userEvents = allEvents;

  const calculateSessionCount = () => {
    if (!newEvent.repeatStartDate || !newEvent.repeatEndDate || newEvent.repeatDays.length === 0) return 0;
    const start = new Date(newEvent.repeatStartDate + 'T00:00:00');
    const end = new Date(newEvent.repeatEndDate + 'T00:00:00');
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayName = current.toLocaleDateString('en-US', { weekday: 'long' });
      if (newEvent.repeatDays.includes(dayName)) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  const handleAddEvent = () => {
    // Only title is required — location is optional
    if (!newEvent.title) return;

    if (editingEventId) {
      StorageService.updateEvent(editingEventId, {
        title: newEvent.title,
        time: newEvent.time,
        location: newEvent.location,
        notes: newEvent.notes,
        type: newEvent.type,
        pinLocation: newEvent.pinLocation,
        teamId: newEvent.teamId,
      });
      setScheduleSuccess(true);
      setTimeout(() => {
        setScheduleSuccess(false);
        setIsAddEventOpen(false);
        setEditingEventId(null);
        setIsSearchingLocation(false);
        setNewEvent({
          teamId: user?.teamIds?.[0] || MOCK_TEAMS[0].id,
          selectedTeamIds: [user?.teamIds?.[0] || MOCK_TEAMS[0].id] as string[],
          type: 'training', title: '', time: '6:00 PM', location: '', notes: '',
          repeat: false, repeatDays: [],
      repeatStartDate: toLocalDateStr(new Date(calendarYear, calendarMonth, selectedDate)),
      repeatEndDate: toLocalDateStr(new Date(calendarYear, calendarMonth + 1, selectedDate)),
          pinLocation: null,
        });
        setMapPin(null);
      }, 1500);
      return;
    }

    const eventsToCreate: any[] = [];
    const teamsToCreate = newEvent.selectedTeamIds.length > 0 ? newEvent.selectedTeamIds : [newEvent.teamId];

    for (const tid of teamsToCreate) {
      if (newEvent.repeat && newEvent.repeatDays.length > 0 && newEvent.repeatStartDate && newEvent.repeatEndDate) {
        const start = new Date(newEvent.repeatStartDate + 'T00:00:00');
        const end = new Date(newEvent.repeatEndDate + 'T00:00:00');
        const cur = new Date(start);
        const batchId = `${Date.now()}-${tid}`;
        let n = 1;
        while (cur <= end) {
          const dayName = cur.toLocaleDateString('en-US', { weekday: 'long' });
          if (newEvent.repeatDays.includes(dayName)) {
            eventsToCreate.push({
              id: `${batchId}-${n}`,
              title: newEvent.title,
              type: newEvent.type,
              time: newEvent.time,
              location: newEvent.location,
              notes: newEvent.notes,
              pinLocation: newEvent.pinLocation,
              teamId: tid,
              date: toLocalDateStr(cur),
              createdBy: user?.id || '',
            });
            n++;
          }
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        const _d = new Date(calendarYear, calendarMonth, selectedDate);
        const dateStr = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;
        eventsToCreate.push({
          ...newEvent,
          id: `${Date.now()}-${tid}`,
          date: dateStr,
          teamId: tid,
          createdBy: user?.id || '',
        });
      }
    }

    // Persist to storage — gameday_update listener will reload state automatically
    eventsToCreate.forEach(e => StorageService.addEvent(e));

    // Navigate calendar to the first event's date so user sees it straight away
    if (eventsToCreate.length > 0) {
      const firstDate = new Date(eventsToCreate[0].date + 'T00:00:00');
      setCalendarYear(firstDate.getFullYear());
      setCalendarMonth(firstDate.getMonth());
      setSelectedDate(firstDate.getDate());
      setScheduleView('week');
    }



    setScheduleSuccess(true);
    setTimeout(() => {
      setScheduleSuccess(false);
      setIsAddEventOpen(false);
      setIsSearchingLocation(false);
      setNewEvent({
        teamId: user?.teamIds?.[0] || MOCK_TEAMS[0].id,
        selectedTeamIds: [user?.teamIds?.[0] || MOCK_TEAMS[0].id] as string[],
        type: 'training', title: '', time: '6:00 PM', location: '', notes: '',
        repeat: false, repeatDays: [],
        repeatStartDate: toLocalDateStr(new Date(calendarYear, calendarMonth, selectedDate)),
        repeatEndDate: toLocalDateStr(new Date(calendarYear, calendarMonth + 1, selectedDate)),
        pinLocation: null,
      });
      setMapPin(null);
    }, 1500);
  };

  const getTeamInfo = (teamId: string) => {
    const customTeams = StorageService.getCustomTeams ? StorageService.getCustomTeams() : [];
    return [...MOCK_TEAMS, ...customTeams].find((t: any) => t.id === teamId);
  };

  // Match an event's date string against a calendar day
  // Handles YYYY-MM-DD (new format) and legacy "Wednesday, May 5" format
  const eventMatchesDay = (eventDate: string, day: number): boolean => {
    if (!eventDate) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      const d = new Date(eventDate + 'T00:00:00');
      return d.getFullYear() === calendarYear && d.getMonth() === calendarMonth && d.getDate() === day;
    }
    // Legacy string format fallback
    const legacyStr = new Date(calendarYear, calendarMonth, day)
      .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return eventDate === legacyStr || eventDate.includes(`${calendarMonth === currentMonth ? MONTHS[calendarMonth].slice(0,3) : MONTHS[calendarMonth].slice(0,3)} ${day}`);
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

  // Week view: 7 days starting from today in the current real-world month
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentYear, currentMonth, today + i);
    return {
      day: d.getDate(),
      month: d.getMonth(),
      year: d.getFullYear(),
      label: ['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()],
    };
  });

  const EVENT_TYPE_STYLES = {
    training: { bg: 'bg-blue-100',  text: 'text-blue-600', selectedBg: 'bg-white', selectedText: 'text-blue-500' },
    match:    { bg: 'bg-red-100',    text: 'text-red-500',    selectedBg: 'bg-white',    selectedText: 'text-red-500' },
    meeting:  { bg: 'bg-orange-100',  text: 'text-orange-600',  selectedBg: 'bg-white',  selectedText: 'text-orange-500' },
    event:    { bg: 'bg-purple-100', text: 'text-purple-500', selectedBg: 'bg-white', selectedText: 'text-purple-500' },
    custom:   { bg: 'bg-slate-100',  text: 'text-slate-500',  selectedBg: 'bg-white',      selectedText: 'text-slate-500' },
  };

  const getEventTypeCounts = (events: any[]) => {
    const counts: Record<string, number> = {};
    events.forEach(e => {
      const t = e.type || 'event';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  };

  return (
    <div className="bg-white min-h-screen pb-24">
      {/* Header */}
      <div className="pt-6 pb-4 px-4 flex justify-between items-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Master Schedule</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            {user?.role === 'club' ? "Club-wide event monitoring" : "All your teams in one place"}
          </p>
        </div>

        {isCoach && (
          <Dialog
            open={isAddEventOpen}
            onOpenChange={(open) => {
              setIsAddEventOpen(open);
              if (!open) {
                setEditingEventId(null);
                setIsSearchingLocation(false);
                setNewEvent(prev => ({ ...prev, pinLocation: null }));
              }
            }}
          >
            <DialogTrigger render={
              <Button size="icon" className="rounded-2xl bg-primary hover:bg-primary/90" />
            }>
              <Plus className="w-5 h-5 text-white" />
            </DialogTrigger>
            <DialogContent
              showCloseButton={false}
              className="sm:max-w-[425px] rounded-[2.5rem] p-0 border-none overflow-hidden bg-white max-h-[90vh] flex flex-col"
            >
              <div className="p-6 bg-slate-900 text-white shrink-0 flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-black uppercase italic">
                    {editingEventId ? 'Edit Event' : 'Create Event'}
                  </DialogTitle>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {editingEventId
                      ? 'Update event details'
                      : `${MONTHS[calendarMonth]} ${selectedDate}, ${calendarYear}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsAddEventOpen(false);
                    setEditingEventId(null);
                    setIsSearchingLocation(false);
                    setNewEvent(p => ({ ...p, pinLocation: null }));
                  }}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-90 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 space-y-5">
                {/* Team Selector — pill buttons */}
                {(() => {
                  const allTeams = [...MOCK_TEAMS, ...(StorageService.getCustomTeams ? StorageService.getCustomTeams() : []),
                    ...StorageService.getTeams()]
                    .filter((t: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === t.id) === i)
                    .filter((t: any) => user?.teamIds?.includes(t.id));
                  if (allTeams.length <= 1) return null;
                  return (
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-900 uppercase italic tracking-[0.18em] px-1">Select Team</label>
                      <div className="flex flex-wrap gap-2">
                        {allTeams.map((team: any) => {
                          const selected = newEvent.selectedTeamIds.includes(team.id);
                          const teamColor = team.color || '#6366f1';
                          return (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => setNewEvent(prev => {
                                const ids = prev.selectedTeamIds;
                                const newIds = selected
                                  ? ids.filter(id => id !== team.id)
                                  : [...ids, team.id];
                                // Must have at least one team selected
                                if (newIds.length === 0) return prev;
                                return { ...prev, selectedTeamIds: newIds, teamId: newIds[0] };
                              })}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                selected ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: selected ? '#fff' : teamColor }} />
                              {team.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Event Type */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-900 uppercase italic tracking-[0.18em] px-1">Event Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { value: 'training', label: 'Training', icon: Activity },
                      { value: 'match', label: 'Match', icon: Trophy },
                      { value: 'meeting', label: 'Meeting', icon: Users },
                      { value: 'event', label: 'Event', icon: PartyPopper },
                    ] as const).map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setNewEvent(prev => ({ ...prev, type: value as any }))}
                        className={`py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                          newEvent.type === value ? "bg-primary/5 border-primary text-primary shadow-sm" : "bg-slate-50 border-transparent text-slate-400"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => setNewEvent(prev => ({ ...prev, type: 'custom' as any }))}
                      className={`py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                        newEvent.type === 'custom' ? "bg-primary/5 border-primary text-primary shadow-sm" : "bg-slate-50 border-transparent text-slate-400"
                      }`}
                    >
                      <Pencil className="w-4 h-4" />
                      <span className="text-[8px] font-black uppercase tracking-tighter">Custom</span>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-900 uppercase italic tracking-[0.18em] px-1">Event Title</label>
                  <Input
                    placeholder="e.g. Tactical Drill"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                    className="h-14 bg-slate-50 border-none rounded-2xl px-4 text-sm font-bold text-slate-700"
                  />
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-900 uppercase italic tracking-[0.18em] px-1">Date</label>
                  {(() => {
                    const dpDaysInMonth = new Date(dpYear, dpMonth + 1, 0).getDate();
                    const dpFirstDay = new Date(dpYear, dpMonth, 1).getDay();
                    const dpMonthName = new Date(dpYear, dpMonth, 1).toLocaleDateString('en-US', { month: 'long' });
                    const dpPrev = () => { if (dpMonth === 0) { setDpMonth(11); setDpYear(dpYear - 1); } else setDpMonth(dpMonth - 1); };
                    const dpNext = () => { if (dpMonth === 11) { setDpMonth(0); setDpYear(dpYear + 1); } else setDpMonth(dpMonth + 1); };
                    const isDpToday = (d: number) => d === today && dpMonth === currentMonth && dpYear === currentYear;
                    const isDpSelected = (d: number) => d === selectedDate && dpMonth === calendarMonth && dpYear === calendarYear;

                    return (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => { setDpMonth(calendarMonth); setDpYear(calendarYear); setDatePickerOpen(!datePickerOpen); }}
                          className="w-full h-14 bg-slate-50 rounded-2xl px-4 flex items-center justify-between text-left"
                        >
                          <span className="text-sm font-bold text-slate-700">
                            {new Date(calendarYear, calendarMonth, selectedDate).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${datePickerOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {datePickerOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -8, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -8, scale: 0.97 }}
                              transition={{ duration: 0.15 }}
                              className="absolute left-0 right-0 top-[60px] z-30 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 space-y-3"
                            >
                              {/* Month nav */}
                              <div className="flex items-center justify-between">
                                <button type="button" onClick={dpPrev} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors">
                                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                                </button>
                                <span className="text-[12px] font-black text-slate-900 uppercase tracking-[0.15em]">{dpMonthName} {dpYear}</span>
                                <button type="button" onClick={dpNext} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors">
                                  <ChevronRight className="w-4 h-4 text-slate-500" />
                                </button>
                              </div>
                              {/* Day headers */}
                              <div className="grid grid-cols-7 gap-1">
                                {['M','T','W','T','F','S','S'].map((d, i) => (
                                  <div key={i} className="text-center text-[9px] font-black text-slate-300 uppercase">{d}</div>
                                ))}
                              </div>
                              {/* Days grid */}
                              <div className="grid grid-cols-7 gap-1">
                                {/* Offset for first day — shift Sunday(0) to end */}
                                {Array.from({ length: (dpFirstDay + 6) % 7 }).map((_, i) => (
                                  <div key={`empty-${i}`} />
                                ))}
                                {Array.from({ length: dpDaysInMonth }).map((_, i) => {
                                  const day = i + 1;
                                  return (
                                    <button
                                      key={day}
                                      type="button"
                                      onClick={() => {
                                        setCalendarYear(dpYear);
                                        setCalendarMonth(dpMonth);
                                        setSelectedDate(day);
                                        setDatePickerOpen(false);
                                      }}
                                      className={`w-full aspect-square rounded-xl text-[12px] font-bold transition-all flex items-center justify-center ${
                                        isDpSelected(day)
                                          ? 'bg-primary text-white shadow-md shadow-primary/30'
                                          : isDpToday(day)
                                            ? 'bg-primary/10 text-primary font-black'
                                            : 'text-slate-600 hover:bg-slate-50'
                                      }`}
                                    >
                                      {day}
                                    </button>
                                  );
                                })}
                              </div>
                              {/* Today shortcut */}
                              <button
                                type="button"
                                onClick={() => {
                                  setCalendarYear(currentYear);
                                  setCalendarMonth(currentMonth);
                                  setSelectedDate(today);
                                  setDatePickerOpen(false);
                                }}
                                className="w-full py-2 text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary/5 rounded-xl transition-colors"
                              >
                                Today
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}
                </div>

                {/* Time */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-900 uppercase italic tracking-[0.18em] px-1">Time</label>
                  <Input
                    placeholder="e.g. 6:00 PM"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                    className="h-14 bg-slate-50 border-none rounded-2xl px-4 text-sm font-bold text-slate-700"
                  />
                </div>

                {/* Location — optional */}
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-900 uppercase italic tracking-[0.18em] px-1">Location (Optional)</label>

                  {!newEvent.pinLocation && (
                    <div className="grid grid-cols-2 gap-3 mb-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!navigator.geolocation) return;
                          navigator.geolocation.getCurrentPosition(
                            pos => {
                              const lat = pos.coords.latitude;
                              const lng = pos.coords.longitude;
                              const applyLabel = (label: string) => {
                                setNewEvent(p => ({
                                  ...p,
                                  location: label,
                                  pinLocation: { lat, lng, label },
                                }));
                              };
                              if (window.google?.maps?.Geocoder) {
                                const geocoder = new window.google.maps.Geocoder();
                                geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
                                  applyLabel(status === 'OK' && results?.[0]
                                    ? results[0].formatted_address
                                    : 'Current Location');
                                });
                              } else {
                                fetch(
                                  `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
                                )
                                  .then(r => r.json())
                                  .then(data => applyLabel(data.results?.[0]?.formatted_address || 'Current Location'))
                                  .catch(() => applyLabel('Current Location'));
                              }
                            },
                            () => alert('Unable to get your location. Please allow location access and try again.')
                          );
                        }}
                        className="flex flex-col items-center gap-2 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 hover:border-primary hover:text-primary transition-all"
                      >
                        <span className="text-2xl">📍</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-center">Use My Location</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSearchingLocation(true)}
                        className="flex flex-col items-center gap-2 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 hover:border-primary hover:text-primary transition-all"
                      >
                        <span className="text-2xl">🔍</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-center">Enter Address</span>
                      </button>
                    </div>
                  )}

                  {/* Optional text input for address */}
                  <Input
                    placeholder="e.g. Field 3, Park Side (optional)"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                    className="h-14 bg-slate-50 border-none rounded-2xl px-4 text-sm font-bold text-slate-700"
                  />

                  {isSearchingLocation && !newEvent.pinLocation && (
                    <div className="space-y-2">
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search for a field or address..."
                        onChange={e => setNewEvent(p => ({ ...p, location: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-primary"
                      />
                      <div ref={mapRef} className="w-full rounded-2xl border border-slate-100 bg-slate-100" style={{ height: '200px' }} />
                      <p className="text-[8px] text-slate-400 text-center uppercase tracking-widest">Or tap on the map to drop a pin</p>
                      <div className="flex gap-2">
                        {mapPin && (
                          <button
                            type="button"
                            onClick={() => {
                              const label = searchInputRef.current?.value || newEvent.location || 'Event Location';
                              setNewEvent(p => ({ ...p, pinLocation: { lat: mapPin.lat, lng: mapPin.lng, label }, location: p.location || label }));
                              setIsSearchingLocation(false);
                              setMapPin(null);
                            }}
                            className="flex-1 h-10 rounded-xl bg-primary text-white text-[9px] font-black uppercase tracking-widest"
                          >Confirm Pin</button>
                        )}
                        <button
                          type="button"
                          onClick={() => { setIsSearchingLocation(false); setMapPin(null); }}
                          className="h-10 px-4 rounded-xl bg-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-600"
                        >Cancel</button>
                      </div>
                    </div>
                  )}

                  {newEvent.pinLocation && (
                    <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                      <img
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${newEvent.pinLocation.lat},${newEvent.pinLocation.lng}&zoom=16&size=600x200&maptype=roadmap&markers=color:red%7C${newEvent.pinLocation.lat},${newEvent.pinLocation.lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                        alt="Pinned location"
                        className="w-full h-32 object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">📍 {newEvent.pinLocation.label || 'Pin Set'}</p>
                          <p className="text-[9px] text-slate-400">{newEvent.pinLocation.lat.toFixed(5)}, {newEvent.pinLocation.lng.toFixed(5)}</p>
                        </div>
                        <button type="button"
                          onClick={() => setNewEvent(p => ({ ...p, pinLocation: null }))}
                          className="text-[9px] font-black text-red-400 uppercase tracking-widest"
                        >Remove</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Repeat */}
                {!editingEventId && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-slate-400" />
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Repeat</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewEvent(p => ({ ...p, repeat: !p.repeat }))}
                        className={cn("w-11 h-6 rounded-full transition-all relative", newEvent.repeat ? "bg-primary" : "bg-slate-200")}
                      >
                        <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all", newEvent.repeat ? "left-5" : "left-0.5")} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {newEvent.repeat && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Repeat On</label>
                            <div className="grid grid-cols-7 gap-1">
                              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => {
                                const fullDayMap: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
                                const fullDay = fullDayMap[day];
                                const isSelected = newEvent.repeatDays.includes(fullDay);
                                return (
                                  <button key={day} type="button" onClick={() => setNewEvent(p => ({ ...p, repeatDays: isSelected ? p.repeatDays.filter(d => d !== fullDay) : [...p.repeatDays, fullDay] }))}
                                    className={cn("h-9 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all", isSelected ? "bg-primary text-white shadow-sm shadow-primary/30" : "bg-slate-50 text-slate-400 hover:bg-slate-100")}
                                  >{day}</button>
                                );
                              })}
                            </div>
                            {newEvent.repeatDays.length > 0 && (
                              <p className="text-[9px] font-bold text-primary uppercase tracking-widest px-1">Every {newEvent.repeatDays.join(", ")}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Date Range</label>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">From</p>
                                <div className="relative">
                                  <input type="date" value={newEvent.repeatStartDate} onChange={e => setNewEvent(p => ({ ...p, repeatStartDate: e.target.value }))}
                                    className="w-full h-11 bg-slate-50 border-none rounded-xl px-3 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 opacity-0 absolute inset-0 z-10 cursor-pointer" />
                                  <div className="w-full h-11 bg-slate-50 rounded-xl px-3 flex items-center justify-between pointer-events-none">
                                    <span className="text-[11px] font-bold text-slate-700">
                                      {newEvent.repeatStartDate ? newEvent.repeatStartDate.split('-').reverse().join('/') : 'DD/MM/YYYY'}
                                    </span>
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Until</p>
                                <div className="relative">
                                  <input type="date" value={newEvent.repeatEndDate} min={newEvent.repeatStartDate} onChange={e => setNewEvent(p => ({ ...p, repeatEndDate: e.target.value }))}
                                    className="w-full h-11 bg-slate-50 border-none rounded-xl px-3 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 opacity-0 absolute inset-0 z-10 cursor-pointer" />
                                  <div className="w-full h-11 bg-slate-50 rounded-xl px-3 flex items-center justify-between pointer-events-none">
                                    <span className="text-[11px] font-bold text-slate-700">
                                      {newEvent.repeatEndDate ? newEvent.repeatEndDate.split('-').reverse().join('/') : 'DD/MM/YYYY'}
                                    </span>
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          {newEvent.repeatDays.length > 0 && newEvent.repeatStartDate && newEvent.repeatEndDate && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-primary/5 border border-primary/20 rounded-2xl p-3 flex items-start gap-2">
                              <Repeat className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                              <div>
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-relaxed">Every {newEvent.repeatDays.join(" & ")}</p>
                                <p className="text-[10px] font-bold text-primary/70 uppercase tracking-widest mt-0.5">
                                  {new Date(newEvent.repeatStartDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} → {new Date(newEvent.repeatEndDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} · {calculateSessionCount()} sessions
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-900 uppercase italic tracking-[0.18em] px-1">Notes (Optional)</label>
                  <Input
                    placeholder="e.g. Wear home colors"
                    value={newEvent.notes}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, notes: e.target.value }))}
                    className="h-14 bg-slate-50 border-none rounded-2xl px-4 text-sm font-bold text-slate-700"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                <button
                  onClick={handleAddEvent}
                  disabled={!newEvent.title}
                  className={cn(
                    "w-full h-14 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-primary/20",
                    scheduleSuccess ? "bg-green-500 text-white" : "bg-slate-900 hover:bg-slate-800 text-white"
                  )}
                >
                  {scheduleSuccess ? (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      {editingEventId ? 'Saved!' : 'Scheduled!'}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <CalendarPlus className="w-5 h-5" />
                      {editingEventId ? 'Save Changes' : 'Confirm & Schedule'}
                    </span>
                  )}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-6">
        {/* Calendar */}
        <div className="px-4">
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
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
              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                <button
                  onClick={() => setScheduleView('week')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${scheduleView === 'week' ? "bg-primary text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}
                >Week</button>
                <button
                  onClick={() => setScheduleView('month')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${scheduleView === 'month' ? "bg-primary text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}
                >Month</button>
              </div>
            </div>

            {/* Copy event banner */}
            <AnimatePresence>
              {copiedEvent && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 flex items-center justify-between bg-slate-900 rounded-2xl px-4 py-3 shadow-xl"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <Copy className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-white">{copiedEvent.title}</p>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Click a day to paste • Esc to cancel</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        StorageService.deleteEvent(copiedEvent.id);
                        setCopiedEvent(null);
                      }}
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all"
                      title="Delete event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setCopiedEvent(null)}
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white/10 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {scheduleView === 'month' ? (
              <>
                <div className="grid grid-cols-7 gap-2 mb-3">
                  {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={`${d}-${i}`} className="text-[10px] font-black text-slate-400 text-center">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`blank-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const hasEvent = userEvents.some(e => eventMatchesDay(e.date, day));
                    const isSelected = selectedDate === day && calendarYear === calendarYear && calendarMonth === calendarMonth;
                    const isToday = day === today && calendarYear === currentYear && calendarMonth === currentMonth;
                    return (
                      <button
                        key={i}
                        onClick={() => handleDateClick(day)}
                        className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-xs font-bold relative transition-all active:scale-90 ${
                          isSelected ? 'bg-primary text-white shadow-lg shadow-primary/30' : isToday ? 'bg-primary/10 text-primary' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
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
                {/* 4 cards */}
                <div className="grid grid-cols-2 gap-3">
                  {weekDays.slice(0, 4).map((wd, i) => {
                    const dayEvents = userEvents.filter(e => {
                      if (!e.date) return false;
                      if (/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
                        const d = new Date(e.date + 'T00:00:00');
                        return d.getFullYear() === wd.year && d.getMonth() === wd.month && d.getDate() === wd.day;
                      }
                      return false;
                    });
                    const isSelected = selectedDate === wd.day && calendarMonth === wd.month && calendarYear === wd.year;
                    return (
                      <button
                        key={i}
                        onClick={() => handleDateClick(wd.day, wd.month, wd.year)}
                        className={`p-4 rounded-[2rem] text-left transition-all active:scale-95 border-2 ${isSelected ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'bg-slate-50 border-transparent'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-white' : 'text-slate-900'}`}>{wd.label}</span>
                          <span className={`text-sm font-black italic ${isSelected ? 'text-white' : 'text-slate-900'}`}>{wd.day}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dayEvents.length > 0 ? (
                            Object.entries(getEventTypeCounts(dayEvents)).map(([type, count]) => {
                              const style = EVENT_TYPE_STYLES[type as keyof typeof EVENT_TYPE_STYLES] || EVENT_TYPE_STYLES.event;
                              return (
                                <span
                                  key={type}
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[9px] font-black ring-1 ring-white/60 ${isSelected ? `${style.selectedBg} ${style.selectedText}` : `${style.bg} ${style.text}`}`}
                                >
                                  {count}
                                </span>
                              );
                            })
                          ) : (
                            <span className={`text-[9px] font-bold italic ${isSelected ? 'text-white/40' : 'text-slate-300'}`}>No events</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {/* 3 cards */}
                <div className="grid grid-cols-3 gap-3">
                  {weekDays.slice(4, 7).map((wd, i) => {
                    const dayEvents = userEvents.filter(e => {
                      if (!e.date) return false;
                      if (/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
                        const d = new Date(e.date + 'T00:00:00');
                        return d.getFullYear() === wd.year && d.getMonth() === wd.month && d.getDate() === wd.day;
                      }
                      return false;
                    });
                    const isSelected = selectedDate === wd.day && calendarMonth === wd.month && calendarYear === wd.year;
                    return (
                      <button
                        key={i}
                        onClick={() => handleDateClick(wd.day, wd.month, wd.year)}
                        className={`p-3 rounded-[1.5rem] text-left transition-all active:scale-95 border-2 ${isSelected ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'bg-slate-50 border-transparent'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[8px] font-black uppercase tracking-widest ${isSelected ? 'text-white' : 'text-slate-900'}`}>{wd.label}</span>
                          <span className={`text-xs font-black italic ${isSelected ? 'text-white' : 'text-slate-900'}`}>{wd.day}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dayEvents.length > 0 ? (
                            Object.entries(getEventTypeCounts(dayEvents)).map(([type, count]) => {
                              const style = EVENT_TYPE_STYLES[type as keyof typeof EVENT_TYPE_STYLES] || EVENT_TYPE_STYLES.event;
                              return (
                                <span
                                  key={type}
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[9px] font-black ring-1 ring-white/60 ${isSelected ? `${style.selectedBg} ${style.selectedText}` : `${style.bg} ${style.text}`}`}
                                >
                                  {count}
                                </span>
                              );
                            })
                          ) : (
                            <span className={`text-[8px] font-bold italic ${isSelected ? 'text-white/40' : 'text-slate-300'}`}>No events</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Events List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
              Events for {MONTHS[calendarMonth]} {selectedDate}
            </h3>
            <Badge variant="outline" className="text-[8px] font-bold border-slate-200 text-slate-900">
              {userEvents.filter(e => eventMatchesDay(e.date, selectedDate)).length} EVENTS
            </Badge>
          </div>

          <div className="space-y-3 px-4">
            {userEvents.filter(e => eventMatchesDay(e.date, selectedDate)).length > 0 ? (
              userEvents.filter(e => eventMatchesDay(e.date, selectedDate)).map((event) => {
                const isExpanded = expandedEventId === event.id;
                const team = getTeamInfo(event.teamId);
                return (
                  <Card key={event.id} className="border-none shadow-sm overflow-hidden bg-white transition-all duration-300 rounded-3xl">
                    <CardContent className="p-0">
                      <button
                        onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 relative ${
                            event.type === 'match' ? 'bg-red-50 text-red-500' :
                            event.type === 'training' ? 'bg-blue-50 text-blue-500' :
                            event.type === 'meeting' ? 'bg-orange-50 text-orange-500' :
                            event.type === 'event' ? 'bg-purple-50 text-purple-500' :
                            'bg-slate-50 text-slate-500'
                          }`}>
                            {event.type === 'match' && <Trophy className="w-5 h-5" />}
                            {event.type === 'training' && <Activity className="w-5 h-5" />}
                            {event.type === 'meeting' && <Users className="w-5 h-5" />}
                            {event.type === 'event' && <PartyPopper className="w-5 h-5" />}
                            {event.type === 'custom' && <Pencil className="w-5 h-5" />}
                            <span className="text-[8px] font-black uppercase mt-0.5">{event.type}</span>
                            {(() => {
                              const myRecord = (attendanceData[event.id] || []).find((r: any) => r.userId === user?.id);
                              if (!myRecord?.status) return null;
                              return (
                                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                                  myRecord.status === 'going' ? 'bg-green-500' : 'bg-red-500'
                                }`} />
                              );
                            })()}
                          </div>
                          <div>
                            {(team || (event as any).teamName) && (
                              <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-0.5">{(team as any)?.name || (event as any).teamName}</p>
                            )}
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
                              {event.location && (
                                <button
                                  onClick={() => setLocationModalEvent(event)}
                                  className="flex items-center gap-1 text-slate-400 hover:text-primary transition-colors"
                                >
                                  <MapPin className="w-3 h-3" />
                                  <span className="text-xs font-medium">{getShortLocation(event.pinLocation?.label || event.location)}</span>
                                </button>
                              )}
                              {event.notes && <p className="text-[10px] text-slate-400 italic">Note: {event.notes}</p>}
                            </div>

                            <div className="pt-3 border-t border-slate-100 space-y-2">
                              {/* Going / Absent buttons for current user */}
                              {(() => {
                                const myRecord = (attendanceData[event.id] || []).find((r: any) => r.userId === user?.id);
                                const myStatus = myRecord?.status || null;
                                return (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleAttendance(event.id, 'going')}
                                      className={`flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                                        myStatus === 'going'
                                          ? 'bg-green-500 text-white'
                                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                                      }`}
                                    >
                                      ✓ Going
                                    </button>
                                    <button
                                      onClick={() => handleAttendance(event.id, 'absent')}
                                      className={`flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                                        myStatus === 'absent'
                                          ? 'bg-red-500 text-white'
                                          : 'bg-red-50 text-red-500 hover:bg-red-100'
                                      }`}
                                    >
                                      ✗ Absent
                                    </button>
                                  </div>
                                );
                              })()}

                              {/* Compact going count + view attendance */}
                              <div className="flex items-center justify-between px-1">
                                {(() => {
                                  const goingCount = (attendanceData[event.id] || []).filter((r: any) => r.status === 'going').length;
                                  const absentCount = (attendanceData[event.id] || []).filter((r: any) => r.status === 'absent').length;
                                  return (
                                    <div className="flex items-center gap-2">
                                      {goingCount > 0 && (
                                        <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">{goingCount} going</span>
                                      )}
                                      {absentCount > 0 && (
                                        <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">{absentCount} absent</span>
                                      )}
                                    </div>
                                  );
                                })()}
                                <button
                                  onClick={() => { const data = StorageService.getAttendance(); setAttendanceData(data); setAttendanceModalEvent(event); }}
                                  className="h-7 px-3 rounded-xl border border-slate-200 bg-white text-slate-500 text-[8px] font-black uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all"
                                >
                                  View All
                                </button>
                              </div>
                              {/* Copy to another date */}
                              {(isCoach || user?.role === 'club') && (
                                <button
                                  onClick={() => {
                                    setCopiedEvent(event);
                                    setCopyToastVisible(true);
                                    setExpandedEventId(null);
                                    setTimeout(() => setCopyToastVisible(false), 3000);
                                  }}
                                  className={`w-full h-10 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 ${
                                    copiedEvent?.id === event.id
                                      ? 'bg-primary text-white'
                                      : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  {copiedEvent?.id === event.id ? 'Copied — Select a Date' : 'Copy to Another Date'}
                                </button>
                              )}
                              {realEvents.some((re: any) => String(re.id) === String(event.id)) && (isCoach || user?.role === 'club' || event.createdBy === user?.id) && (
                                confirmDeleteId === event.id ? (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        StorageService.deleteEvent(event.id);
                                        setConfirmDeleteId(null);
                                        setExpandedEventId(null);
                                      }}
                                      className="flex-1 h-10 rounded-2xl bg-red-500 text-white text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                                    >
                                      Confirm Delete
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="flex-1 h-10 rounded-2xl bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteId(event.id)}
                                    className="w-full h-10 rounded-2xl border border-red-200 bg-white text-red-400 text-[9px] font-black uppercase tracking-widest transition-all hover:bg-red-50 active:scale-[0.98]"
                                  >
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
              <div className="p-12 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No events scheduled for this day</p>
                {isCoach && (
                  <p className="text-[10px] text-slate-300 mt-2">Tap + to create one</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attendance Modal */}
      <AnimatePresence>
        {attendanceModalEvent && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} onClick={() => setAttendanceModalEvent(null)} className="fixed inset-0 bg-black z-[60]" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92%] max-w-md max-h-[85vh] bg-white rounded-[2rem] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="bg-slate-900 p-5 text-white shrink-0 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black uppercase italic">{attendanceModalEvent.title}</h3>
                  <p className="text-[9px] font-bold text-white/60 uppercase tracking-[0.2em] mt-0.5">{formatEventDate(attendanceModalEvent.date)} · {attendanceModalEvent.time}</p>
                </div>
                <button onClick={() => setAttendanceModalEvent(null)} className="w-8 h-8 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-4 py-5 bg-slate-50 space-y-4">
                {(() => {
                  const records = attendanceData[attendanceModalEvent.id] || [];
                  const going = records.filter(r => r.status === 'going');
                  const absent = records.filter(r => r.status === 'absent');
                  return (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 px-1">
                          <h5 className="text-[10px] font-black text-green-600 uppercase tracking-widest whitespace-nowrap">Going ({going.length})</h5>
                          <div className="h-px flex-1 bg-green-200" />
                        </div>
                        {going.length === 0 ? <p className="text-[9px] text-slate-400 italic px-1">No one yet</p> : going.map((r, i) => (
                          <div key={i} className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-green-400 h-14">
                            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-500 shrink-0"><Check className="w-4 h-4" /></div>
                            <p className="text-xs font-black text-slate-900 italic truncate">{r.userName || r.userId || 'Unknown'}</p>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 px-1">
                          <h5 className="text-[10px] font-black text-red-600 uppercase tracking-widest whitespace-nowrap">Absent ({absent.length})</h5>
                          <div className="h-px flex-1 bg-red-200" />
                        </div>
                        {absent.length === 0 ? <p className="text-[9px] text-slate-400 italic px-1">No one yet</p> : absent.map((r, i) => (
                          <div key={i} className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-red-400 h-14">
                            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 shrink-0"><X className="w-4 h-4" /></div>
                            <p className="text-xs font-black text-slate-900 italic truncate">{r.userName || r.userId || 'Unknown'}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
              {isCoach && (
                <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                  <button
                    onClick={() => {
                      if (!attendanceModalEvent) return;
                      StorageService.addAnnouncement({
                        senderId: user?.id || 'coach',
                        senderName: user?.name || 'Coach',
                        teamId: attendanceModalEvent.teamId || user?.teamIds?.[0] || 'all',
                        teamName: attendanceModalEvent.title || 'Team',
                        title: `⏰ Reminder: ${attendanceModalEvent.title}`,
                        content: `Please confirm attendance for "${attendanceModalEvent.title}" on ${attendanceModalEvent.date} at ${attendanceModalEvent.time}.`,
                        eventId: attendanceModalEvent.id,
                        isReminder: true,
                      });
                      setReminderSentEventId(attendanceModalEvent.id);
                      setTimeout(() => setReminderSentEventId(null), 3000);
                    }}
                    className={cn(
                      "w-full h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2",
                      reminderSentEventId === attendanceModalEvent?.id ? "bg-green-500 text-white" : "bg-slate-900 hover:bg-slate-800 text-white"
                    )}
                  >
                    {reminderSentEventId === attendanceModalEvent?.id ? <><CheckCircle2 className="w-4 h-4" /> Reminder Sent!</> : <><Bell className="w-4 h-4" /> Send Reminder</>}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Location Modal */}
      <AnimatePresence>
        {locationModalEvent && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLocationModalEvent(null)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92%] max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-xl flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Event Location</p>
                    <p className="text-sm font-black uppercase italic text-white leading-tight">{locationModalEvent.title}</p>
                  </div>
                </div>
                <button onClick={() => setLocationModalEvent(null)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {locationModalEvent.pinLocation ? (
                <img
                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${locationModalEvent.pinLocation.lat},${locationModalEvent.pinLocation.lng}&zoom=16&size=400x220&maptype=roadmap&markers=color:red|${locationModalEvent.pinLocation.lat},${locationModalEvent.pinLocation.lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                  alt="Event location map"
                  className="w-full h-48 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="h-32 bg-slate-50 flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-slate-200 mx-auto" />
                </div>
              )}
              <div className="p-5 space-y-4">
                <p className="text-[13px] font-black uppercase italic text-slate-900">{locationModalEvent.pinLocation?.label || locationModalEvent.location || 'Location not set'}</p>
                <a
                  href={locationModalEvent.pinLocation
                    ? `https://www.google.com/maps/dir/?api=1&destination=${locationModalEvent.pinLocation.lat},${locationModalEvent.pinLocation.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationModalEvent.location || '')}`
                  }
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-14 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] no-underline"
                >
                  <Navigation className="w-5 h-5" />
                  Get Directions
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Month Picker */}
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
                  <button onClick={() => setCalendarYear(y => y - 1)} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                  <button onClick={() => setCalendarYear(y => y + 1)} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                  <button onClick={() => setShowMonthPicker(false)} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors ml-1">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
              <div className="p-5 grid grid-cols-3 gap-3">
                {MONTHS.map((month, i) => (
                  <button
                    key={month}
                    onClick={() => { setCalendarMonth(i); setSelectedDate(1); setShowMonthPicker(false); }}
                    className={`py-3 rounded-2xl text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                      i === calendarMonth && calendarYear === currentYear ? 'bg-primary text-white shadow-lg shadow-primary/30'
                      : i === currentMonth && calendarYear === currentYear ? 'bg-primary/10 text-primary border border-primary/20'
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
