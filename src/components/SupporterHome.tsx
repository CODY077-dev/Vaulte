import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Megaphone, 
  User as UserIcon, 
  Trophy, 
  Check, 
  X,
  UserX,
  ChevronDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { MOCK_SCHEDULE, MOCK_TEAMS } from "../constants";
import { User } from "../types";
import StorageService, { Announcement, AttendanceRecord } from "../services/StorageService";

interface SupporterHomeProps {
  user: User | null;
  onTabChange: (tab: string) => void;
}

export default function SupporterHome({ user, onTabChange }: SupporterHomeProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, 'going' | 'absent' | null>>({});
  const [realEvents, setRealEvents] = useState<any[]>([]);

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
    const loadData = () => {
      const allAnnouncements = StorageService.getAnnouncements();
      const userClubId = user?.clubId || null;
      const filteredAnnouncements = allAnnouncements.filter(a =>
        a.teamId === user?.linkedTeamId ||
        (a.teamId === 'all' && userClubId && a.clubId === userClubId)
      );
      setAnnouncements(filteredAnnouncements);

      const allAttendance = StorageService.getAttendance();
      const userAttendance: Record<string, 'going' | 'absent' | null> = {};
      Object.keys(allAttendance).forEach(eventId => {
        const record = allAttendance[eventId].find(a => a.userId === user?.id);
        if (record) {
          userAttendance[eventId] = record.status;
        }
      });
      setAttendance(userAttendance);

      const storedEvents = StorageService.getEvents();
      setRealEvents(storedEvents);
    };
    
    loadData();
    window.addEventListener('focus', loadData);
    window.addEventListener('gameday_update', loadData);
    
    return () => {
      window.removeEventListener('focus', loadData);
      window.removeEventListener('gameday_update', loadData);
    };
  }, [user]);

  const sortedAnnouncements = useMemo(() => {
    return announcements;
  }, [announcements]);

  const upcomingEvents = useMemo(() => {
    const allEvents = [...MOCK_SCHEDULE, ...realEvents];
    return allEvents
      .filter(e => e.teamId === user?.linkedTeamId)
      .slice(0, 3);
  }, [user, realEvents]);

  const handleRSVP = (eventId: string, status: 'going' | 'absent') => {
    if (!user) return;
    const newStatus = attendance[eventId] === status ? null : status;
    StorageService.updateAttendance(eventId, user.id, user.name, newStatus);
    setAttendance(prev => ({ ...prev, [eventId]: newStatus }));
  };

  const linkedTeam = MOCK_TEAMS.find(t => t.id === user?.linkedTeamId);

  return (
    <div className="bg-slate-50 min-h-screen pb-24 px-4 pt-6 space-y-4">
      {/* Header & Player Card */}
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between px-2">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic leading-tight">
              Welcome back,{" "}
              <br />
              {user?.name.replace('Supporter ', '')}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Dashboard</p>
          </div>

          <button
            onClick={() => onTabChange('profile')}
            className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
          >
            <UserIcon className="w-4 h-4 text-slate-400" />
            My Profile
          </button>
        </div>

        <Card className="border-none shadow-xl bg-slate-900 text-white rounded-[2rem] overflow-hidden">
          <CardContent className="p-6">
            <div className="space-y-1">
              <Badge className="bg-primary hover:bg-primary border-none text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-2">
                Linked Player
              </Badge>
              <h2 className="text-2xl font-black uppercase italic tracking-tight leading-none">
                {user?.linkedPlayerName}
              </h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                {linkedTeam?.name} • Age {user?.linkedPlayerAge}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Announcements */}
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between px-2 mb-3">
          <h3 className="text-xs font-black text-slate-900 uppercase italic tracking-widest">
            Announcements
          </h3>
          {sortedAnnouncements.length > 0 && (
            <span className="bg-primary text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full">
              {sortedAnnouncements.length}
            </span>
          )}
        </div>

        {sortedAnnouncements.length === 0 ? (
          <Card className="border-none shadow-sm bg-white rounded-[1.5rem] p-8 text-center border-dashed border-2 border-slate-100">
            <Megaphone className="w-8 h-8 text-slate-100 mx-auto mb-2" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No announcements yet</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedAnnouncements.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-2xl shadow-sm border-l-[3px] border-primary p-4 relative group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider">{a.title}</h4>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{a.senderName} • {formatAnnouncementDate(a.timestamp)}</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed italic">{a.content}</p>
              </div>
            ))}

            {sortedAnnouncements.length > 3 && (
              <button
                onClick={() => setShowAllAnnouncements(true)}
                className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors flex items-center justify-center gap-1.5"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                See {sortedAnnouncements.length - 3} More
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Upcoming Events */}
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <div className="flex justify-between items-center px-2">
          <h3 className="text-xs font-black text-slate-900 uppercase italic tracking-widest">Upcoming Events</h3>
          <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-widest border-slate-200">
            Next 3 Sessions
          </Badge>
        </div>

        <div className="space-y-3">
          {upcomingEvents.map((event) => (
            <Card key={event.id} className="border-none shadow-sm bg-white rounded-[1.5rem] overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                        event.type === 'match' ? "bg-primary" : "bg-slate-900"
                      )}>
                        {event.type}
                      </Badge>
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider">{event.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400">
                      <div className="flex items-center gap-1 font-bold text-[9px] uppercase tracking-wider">
                        <Calendar className="w-3 h-3" />
                        {event.date}
                      </div>
                      <div className="flex items-center gap-1 font-bold text-[9px] uppercase tracking-wider">
                        <Clock className="w-3 h-3" />
                        {event.time}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 font-bold text-[9px] text-slate-400 uppercase tracking-wider pt-0.5">
                      <MapPin className="w-3 h-3 text-slate-300" />
                      {event.location}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Button 
                    size="sm"
                    onClick={() => handleRSVP(event.id, 'going')}
                    className={cn(
                      "h-9 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                      attendance[event.id] === 'going' 
                        ? "bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20" 
                        : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-100"
                    )}
                  >
                    <Check className={cn("w-3 h-3 mr-1.5", attendance[event.id] === 'going' ? "text-white" : "text-slate-400")} />
                    Jamie's Going
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => handleRSVP(event.id, 'absent')}
                    className={cn(
                      "h-9 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                      attendance[event.id] === 'absent' 
                        ? "bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/20" 
                        : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-100"
                    )}
                  >
                    <X className={cn("w-3 h-3 mr-1.5", attendance[event.id] === 'absent' ? "text-white" : "text-slate-400")} />
                    Can't Make It
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

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
                      {sortedAnnouncements.length} total
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
                {sortedAnnouncements.map((a) => (
                  <div
                    key={a.id}
                    className="bg-white rounded-2xl shadow-sm border-l-[3px] border-primary p-4 relative group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider">{a.title}</h4>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{a.senderName} • {formatAnnouncementDate(a.timestamp)}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed italic">{a.content}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
