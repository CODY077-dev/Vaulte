import React, { useState, useEffect, useRef, useMemo } from "react";
import { Message, UserRole, Team, User } from "../types";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Send, Hash, Users, ChevronLeft, MessageSquare, ChevronDown, Star, Mic, Square, Trash2, X } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import DefaultAvatar from "./DefaultAvatar";
import { Badge } from "./ui/badge";
import { motion, AnimatePresence } from "motion/react";
import { MOCK_TEAMS } from "../constants";
import StorageService from "../services/StorageService";
import { Card, CardContent } from "./ui/card";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  limit,
  doc,
  setDoc,
} from "firebase/firestore";

const CHANNELS = [
  { id: "general", name: "General", label: "general" },
  { id: "coaches", name: "Coaches", label: "coaches" },
  { id: "players", name: "Players", label: "players" },
];

interface ChatProps {
  user: User;
  memberRoles: Record<string, 'coach' | 'manager' | null>;
}

export default function Chat({ user, memberRoles }: ChatProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    user.role === 'supporter' && user.linkedTeamId ? user.linkedTeamId : null
  );
  const [selectedChannel, setSelectedChannel] = useState(CHANNELS[0]);
  const [teamLogos, setTeamLogos] = useState<Record<string, string>>({});
  const [isChannelMenuOpen, setIsChannelMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});
  const [channelUnreads, setChannelUnreads] = useState<Record<string, number>>({
    general: 0,
    coaches: 0,
    players: 0
  });
  const [showMembers, setShowMembers] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Firestore real-time listener ──────────────────────────
  useEffect(() => {
    if (!selectedTeamId) return;

    const roomId = `${selectedTeamId}_${selectedChannel.id}`;
    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(200));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          teamId: data.teamId,
          channelId: data.channelId,
          userId: data.userId,
          userName: data.userName,
          userRole: data.userRole,
          userAvatar: data.userAvatar || undefined,
          subRole: data.subRole || null,
          text: data.text,
          isAudio: data.isAudio || false,
          timestamp: data.createdAt
            ? (data.createdAt as Timestamp).toDate().toISOString()
            : new Date().toISOString(),
        });
      });
      setMessages(msgs);
    }, (error) => {
      console.warn("[Chat] Firestore listener error:", error.message);
      // Fall back to localStorage cache
      const cached = localStorage.getItem(`gameday_chat_${roomId}`);
      if (cached) {
        try { setMessages(JSON.parse(cached)); } catch {}
      }
    });

    return () => unsubscribe();
  }, [selectedTeamId, selectedChannel.id]);

  // Cache messages to localStorage as backup
  useEffect(() => {
    if (selectedTeamId && messages.length > 0) {
      const roomId = `${selectedTeamId}_${selectedChannel.id}`;
      localStorage.setItem(`gameday_chat_${roomId}`, JSON.stringify(messages.slice(-100)));
    }
  }, [messages, selectedTeamId, selectedChannel.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedTeamId) return;

    setIsSending(true);
    const roomId = `${selectedTeamId}_${selectedChannel.id}`;
    const text = inputText.trim();
    setInputText("");

    // Optimistic local message
    const tempId = "temp-" + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      teamId: selectedTeamId,
      channelId: selectedChannel.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      userAvatar: user.avatar,
      subRole: memberRoles[user.id] || null,
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const messagesRef = collection(db, "chatRooms", roomId, "messages");
      await addDoc(messagesRef, {
        teamId: selectedTeamId,
        channelId: selectedChannel.id,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        userAvatar: user.avatar || null,
        subRole: memberRoles[user.id] || null,
        text,
        isAudio: false,
        createdAt: serverTimestamp(),
      });

      // Update room metadata (last message preview)
      const roomRef = doc(db, "chatRooms", roomId);
      await setDoc(roomRef, {
        teamId: selectedTeamId,
        channelId: selectedChannel.id,
        lastMessage: text.substring(0, 100),
        lastMessageBy: user.name,
        lastMessageAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error("[Chat] Failed to send message:", err);
      // Remove optimistic message on failure, keep in localStorage fallback
      setMessages((prev) => prev.filter(m => m.id !== tempId));

      // Fallback: store locally
      const cached = JSON.parse(localStorage.getItem(`gameday_chat_${roomId}`) || '[]');
      cached.push(optimisticMsg);
      localStorage.setItem(`gameday_chat_${roomId}`, JSON.stringify(cached.slice(-100)));
      setMessages(cached);
    } finally {
      setIsSending(false);
    }
  };

  // ── Voice recording ───────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (chunks.length > 0 && recordingTime > 0 && selectedTeamId) {
          const roomId = `${selectedTeamId}_${selectedChannel.id}`;
          const voiceText = "🎤 Voice Message (" + formatTime(recordingTime) + ")";

          try {
            const messagesRef = collection(db, "chatRooms", roomId, "messages");
            await addDoc(messagesRef, {
              teamId: selectedTeamId,
              channelId: selectedChannel.id,
              userId: user.id,
              userName: user.name,
              userRole: user.role,
              userAvatar: user.avatar || null,
              subRole: memberRoles[user.id] || null,
              text: voiceText,
              isAudio: true,
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            console.error("[Chat] Failed to send voice message:", err);
          }
        }
        setRecordingTime(0);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      setIsRecording(false);
      setRecordingTime(0);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Teams & channels ──────────────────────────────────────
  const [customTeams, setCustomTeams] = useState<any[]>([]);

  useEffect(() => {
    const stored = StorageService.getCustomTeams();
    const legacyStored = StorageService.getTeams();
    const combinedCustom = [...stored, ...legacyStored];

    const currentUserData = user ? StorageService.getUserData(user.id) || user : null;
    const userJoinedTeams = combinedCustom.filter(t =>
      currentUserData?.teamIds?.includes(t.id)
    );
    setCustomTeams(userJoinedTeams);
  }, [user]);

  const currentUser = user ? StorageService.getUserData(user.id) || user : null;
  const chatTeams = [
    ...MOCK_TEAMS.filter(t => currentUser?.teamIds?.includes(t.id)),
    ...customTeams
  ];

  useEffect(() => {
    const loadData = () => {
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
    };
    loadData();
    window.addEventListener('gameday_update', loadData);
    return () => window.removeEventListener('gameday_update', loadData);
  }, []);

  const selectedTeam = [...MOCK_TEAMS, ...StorageService.getCustomTeams(), ...StorageService.getTeams()].find(t => t.id === selectedTeamId);

  // Channel members from real team data
  const channelMembers = useMemo(() => {
    if (!selectedTeamId) return { members: [], showCoach: true };
    const members = StorageService.getTeamMembers(selectedTeamId);
    const id = selectedChannel?.id || '';
    if (id === 'coaches') {
      return { members: members.filter(m => m.role === 'coach' || m.role === 'manager'), showCoach: true };
    }
    if (id === 'players') {
      return { members: members.filter(m => m.role !== 'coach' && m.role !== 'manager'), showCoach: false };
    }
    return { members, showCoach: true };
  }, [selectedTeamId, selectedChannel]);

  const CHANNEL_COLORS = [
    'bg-slate-800', 'bg-blue-700', 'bg-emerald-700', 'bg-purple-700', 'bg-amber-700', 'bg-rose-700', 'bg-cyan-700',
  ];

  const getTeamInitials = (name: string) => {
    const words = name.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getTeamColor = (teamId: string) => {
    let hash = 0;
    for (let i = 0; i < teamId.length; i++) hash = teamId.charCodeAt(i) + ((hash << 5) - hash);
    return CHANNEL_COLORS[Math.abs(hash) % CHANNEL_COLORS.length];
  };

  const getMemberCount = (teamId: string, channel: typeof CHANNELS[0]) => {
    const members = StorageService.getTeamMembers(teamId);
    if (channel.id === 'coaches') return members.filter(m => m.role === 'coach' || m.role === 'manager').length;
    if (channel.id === 'players') return members.filter(m => m.role !== 'coach' && m.role !== 'manager').length;
    return members.length;
  };

  const chatChannels = useMemo(() => {
    const rows: { team: any; channel: typeof CHANNELS[0]; teamName: string; unread: number }[] = [];
    chatTeams.forEach(team => {
      const name = teamNames[team.id] || team.name;
      CHANNELS.forEach(channel => {
        const totalUnread = (channel.id === 'team' ? (unreadCounts[team.id] || 0) : 0) + (channelUnreads[channel.id] || 0);
        rows.push({ team, channel, teamName: name, unread: totalUnread });
      });
    });
    return rows;
  }, [chatTeams, teamNames, unreadCounts, channelUnreads]);

  // ── Channel list view ─────────────────────────────────────
  if (!selectedTeamId) {
    return (
      <div className="bg-white min-h-screen pb-24">
        <div className="pt-6 pb-2 px-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Messages</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Your Team Channels</p>
        </div>

        <div className="divide-y divide-slate-100">
          {chatChannels.map(({ team, channel, teamName, unread }, index) => (
            <motion.button
              key={`${team.id}-${channel.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => {
                setSelectedTeamId(team.id);
                setSelectedChannel(channel);
                setChannelUnreads(prev => ({ ...prev, [channel.id]: 0 }));
                setUnreadCounts(prev => ({ ...prev, [team.id]: 0 }));
              }}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left"
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ${
                  (!logoErrors[team.id] && (teamLogos[team.id] || team.logo)) ? 'bg-white border border-slate-100' : getTeamColor(team.id)
                }`}>
                  {(!logoErrors[team.id] && (teamLogos[team.id] || team.logo)) ? (
                    <img
                      src={teamLogos[team.id] || team.logo}
                      alt={teamName}
                      className="w-full h-full object-contain p-1"
                      onError={() => setLogoErrors(prev => ({ ...prev, [team.id]: true }))}
                    />
                  ) : (
                    <span className="text-white text-sm font-black">{getTeamInitials(teamName)}</span>
                  )}
                </div>
                {unread > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white z-10">
                    {unread}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-black uppercase tracking-tight truncate ${unread > 0 ? 'text-slate-900' : 'text-slate-700'}`}>
                    {teamName}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 shrink-0">
                    # {channel.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  Tap to open chat
                </p>
              </div>

              {/* Right side */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] font-bold text-slate-300 uppercase">{getMemberCount(team.id, channel)} ppl</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  // ── Chat view ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      <div className="bg-white border-b border-slate-100 p-4 flex items-center justify-between shadow-sm shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 -ml-2"
            onClick={() => setSelectedTeamId(null)}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center">
              {selectedTeam && !logoErrors[selectedTeam.id] && (teamLogos[selectedTeam.id] || selectedTeam.logo) ? (
                <img
                  src={teamLogos[selectedTeam.id] || selectedTeam.logo}
                  alt={selectedTeam.name}
                  className="w-full h-full object-contain p-0.5"
                  onError={() => selectedTeam && setLogoErrors(prev => ({ ...prev, [selectedTeam.id]: true }))}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-xl">
                  <Users className="w-5 h-5 text-slate-300" />
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setIsChannelMenuOpen(!isChannelMenuOpen)}
                className="flex flex-col items-start group"
              >
                <h2 className="font-black text-slate-900 leading-tight uppercase italic text-sm group-hover:text-primary transition-colors flex items-center gap-1">
                  {teamNames[selectedTeam?.id || ""] || selectedTeam?.name}
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isChannelMenuOpen ? "rotate-180" : ""}`} />
                </h2>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  {selectedChannel.name}
                </div>
              </button>

              <AnimatePresence>
                {isChannelMenuOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-30"
                      onClick={() => setIsChannelMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-40"
                    >
                      {CHANNELS.map((channel) => {
                        const isActive = selectedChannel.id === channel.id;
                        const unreadCount = channelUnreads[channel.id] || 0;
                        return (
                          <button
                            key={channel.id}
                            onClick={() => {
                              setSelectedChannel(channel);
                              setIsChannelMenuOpen(false);
                              setChannelUnreads(prev => ({ ...prev, [channel.id]: 0 }));
                            }}
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-widest">{channel.name}</span>
                            {unreadCount > 0 && (
                              <div className="bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
                                {unreadCount}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-slate-400" onClick={() => setShowMembers(true)}>
          <Users className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 opacity-40">
              <MessageSquare className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No messages yet</p>
              <p className="text-[10px] text-slate-300 mt-1">Be the first to say something!</p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => {
              const isMe = msg.userId === user.id;
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const showDateDivider = !prevMsg ||
                new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();

              return (
                <React.Fragment key={msg.id}>
                  {showDateDivider && (
                    <div className="flex justify-center my-4">
                      <span className="bg-slate-200 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full">
                        {new Date(msg.timestamp).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex items-start gap-3 ${isMe ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`flex flex-col space-y-1 max-w-[75%] ${isMe ? "items-end" : ""}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isMe ? "text-primary" : "text-slate-700"}`}>{msg.userName}</span>
                        {msg.subRole && (
                          <Badge className={`${msg.subRole === 'coach' ? 'bg-primary' : 'bg-amber-500'} text-[7px] font-black uppercase px-1.5 py-0 h-3.5`}>
                            {msg.subRole}
                          </Badge>
                        )}
                      </div>
                      <div className={`py-2 px-3 rounded-2xl text-sm shadow-sm ${
                        isMe
                          ? "bg-primary text-white rounded-tr-none"
                          : msg.userRole === 'club'
                            ? "bg-purple-50 text-purple-900 border border-purple-200 rounded-tl-none"
                            : msg.userRole === 'coach'
                              ? "bg-amber-50 text-amber-900 border border-amber-200 rounded-tl-none"
                              : "bg-white text-slate-700 rounded-tl-none border border-slate-100"
                      } ${msg.isAudio ? "flex items-center gap-2 italic" : ""}`}>
                        {msg.isAudio && <Mic className="w-3.5 h-3.5" />}
                        {msg.text}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 px-1 uppercase tracking-wider">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </motion.div>
                </React.Fragment>
              );
            })}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div
        className="shrink-0 px-4 py-3 bg-white border-t border-slate-100 pb-safe"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <AnimatePresence mode="wait">
          {isRecording ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-4 bg-red-50 p-3 rounded-2xl border border-red-100"
            >
              <div className="flex items-center gap-2 flex-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-black text-red-600 uppercase tracking-widest">Recording {formatTime(recordingTime)}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={cancelRecording}
                  className="text-red-400 hover:text-red-600 hover:bg-red-100 rounded-xl"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
                <Button
                  type="button"
                  onClick={stopRecording}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 flex items-center gap-2 shadow-lg shadow-red-200"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Stop & Send</span>
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleSendMessage}
              className="flex gap-2"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={startRecording}
                className="w-12 h-12 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
              >
                <Mic className="w-5 h-5" />
              </Button>
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onFocus={() => {
                  setTimeout(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                  }, 300);
                }}
                placeholder="Type a message..."
                className="flex-1 bg-slate-50 border-none rounded-xl focus-visible:ring-primary h-12 disabled:opacity-50"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!inputText.trim() || isSending}
                className="w-12 h-12 rounded-xl shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
              >
                <Send className={`w-5 h-5 ${isSending ? "animate-pulse" : ""}`} />
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Members modal */}
      <AnimatePresence>
        {showMembers && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMembers(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[90%] max-w-sm bg-white rounded-[2rem] max-h-[75vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="px-6 py-4 border-b border-slate-100 shrink-0 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black uppercase italic text-slate-900 leading-none">
                    {teamNames[selectedTeamId] || selectedTeam?.name || 'Team'} — {selectedChannel?.name}
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {channelMembers.members.length} members
                  </p>
                </div>
                <button
                  onClick={() => setShowMembers(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
                {channelMembers.members.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-8">No members in this channel yet</p>
                )}
                {channelMembers.members.map((member: any) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-50">
                    <DefaultAvatar
                      name={member.name}
                      size="md"
                      className="rounded-xl shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black uppercase italic text-slate-900 truncate">
                        {member.name}
                      </p>
                      {(member.role === 'coach' || member.role === 'manager') && (
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          {member.role === 'coach' ? 'Coach' : 'Manager'}
                        </p>
                      )}
                    </div>
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
