import React, { useState, useEffect, useRef, useMemo } from "react";
import { Message, UserRole, Team, User } from "../types";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Send, Hash, Users, ChevronLeft, MessageSquare, ChevronDown, Star, Mic, Square, Trash2, X, Plus, Check, Search } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import DefaultAvatar from "./DefaultAvatar";
import { Badge } from "./ui/badge";
import { motion, AnimatePresence } from "motion/react";
import { MOCK_TEAMS } from "../constants";
import StorageService from "../services/StorageService";
import { Card, CardContent } from "./ui/card";
import { db } from "../firebase";
import { canSend, recordSend, trimMessage, MAX_MESSAGE_LENGTH } from "../utils/rateLimiter";
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
  getDocs,
  where,
  deleteDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

const CHANNELS = [
  { id: "general", name: "General", label: "general" },
  { id: "coaches", name: "Coaches", label: "coaches" },
  { id: "players", name: "Players", label: "players" },
];

interface ChatProps {
  user: User;
  memberRoles: Record<string, 'coach' | 'manager' | null>;
  onChatOpen?: (isOpen: boolean) => void;
  onUnreadCount?: (count: number) => void;
}

export default function Chat({ user, memberRoles, onChatOpen, onUnreadCount }: ChatProps) {
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
  const [lastMessages, setLastMessages] = useState<Record<string, { userName: string; text: string; timestamp: number }>>({});
  const [unreadSinceLast, setUnreadSinceLast] = useState<Record<string, number>>({});

  // ── Create chat / manage members state ──────────────────────
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [chatModalMode, setChatModalMode] = useState<'choose' | 'create' | 'addMember'>('choose');
  const [createStep, setCreateStep] = useState<'team' | 'name' | 'members'>('team');
  const [createTeamId, setCreateTeamId] = useState<string | null>(null);
  const [createChatName, setCreateChatName] = useState('');
  const [createSelectedMembers, setCreateSelectedMembers] = useState<string[]>([]);
  const [createMemberSearch, setCreateMemberSearch] = useState('');
  const [customChats, setCustomChats] = useState<any[]>([]);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  // Add member flow state
  const [addMemberStep, setAddMemberStep] = useState<'team' | 'members' | 'chats'>('team');
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [addMemberSelectedMembers, setAddMemberSelectedMembers] = useState<string[]>([]);
  const [addMemberSelectedChats, setAddMemberSelectedChats] = useState<string[]>([]);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  // Notify parent when chat is open/closed
  useEffect(() => {
    onChatOpen?.(!!selectedTeamId);
  }, [selectedTeamId, onChatOpen]);

  // Report total unread count to parent for nav badge
  useEffect(() => {
    const total = Object.values(unreadSinceLast).reduce((sum, n) => sum + n, 0);
    onUnreadCount?.(total);
  }, [unreadSinceLast, onUnreadCount]);

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
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedTeamId) return;

    // Rate limit check
    const check = canSend('chat');
    if (!check.allowed) {
      setRateLimitMsg(check.reason || 'Please wait');
      setTimeout(() => setRateLimitMsg(null), 2000);
      return;
    }

    setIsSending(true);
    const roomId = `${selectedTeamId}_${selectedChannel.id}`;
    const text = trimMessage(inputText.trim());
    setInputText("");
    recordSend('chat');

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
          const voiceCheck = canSend('chat');
          if (!voiceCheck.allowed) {
            setRateLimitMsg(voiceCheck.reason || 'Please wait');
            setTimeout(() => setRateLimitMsg(null), 2000);
            return;
          }
          recordSend('chat');
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
  const chatTeams = useMemo(() => [
    ...MOCK_TEAMS.filter(t => currentUser?.teamIds?.includes(t.id)),
    ...customTeams
  ], [currentUser?.teamIds?.join(','), customTeams]);

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
    // Include coach/creator if not already in roster
    const allTeams = [...MOCK_TEAMS, ...StorageService.getCustomTeams()];
    const team = allTeams.find(t => t.id === teamId);
    const coachId = team?.coachId || team?.createdBy;
    const coachInRoster = coachId ? members.some((m: any) => m.id === coachId) : true;
    const totalExtra = (!coachInRoster && coachId) ? 1 : 0;
    if (channel.id === 'coaches') {
      const coachCount = members.filter(m => m.role === 'coach' || m.role === 'manager').length;
      return coachCount + totalExtra;
    }
    if (channel.id === 'players') return members.filter(m => m.role !== 'coach' && m.role !== 'manager').length;
    return members.length + totalExtra;
  };

  // ── Load custom chats from Firestore ──────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, 'customChats'), where('memberIds', 'array-contains', user.id));
    const unsub = onSnapshot(q, (snap) => {
      const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCustomChats(chats);
    }, (err) => {
      console.warn('[Chat] Custom chats listener error:', err);
    });
    return () => unsub();
  }, [user?.id]);

  // ── Load last messages for channel list preview ─────────────
  useEffect(() => {
    if (chatTeams.length === 0) return;
    const unsubscribes: (() => void)[] = [];

    // Helper to listen for last message + count unreads since last visit
    const listenRoom = (roomId: string) => {
      const messagesRef = collection(db, 'chatRooms', roomId, 'messages');

      // Last message preview
      const q1 = query(messagesRef, orderBy('createdAt', 'desc'), limit(1));
      const unsub1 = onSnapshot(q1, (snap) => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          const ts = data.createdAt ? (data.createdAt as Timestamp).toMillis() : 0;
          setLastMessages(prev => ({
            ...prev,
            [roomId]: { userName: data.userName || 'Unknown', text: data.text || '', timestamp: ts }
          }));
        }
      }, () => {});
      unsubscribes.push(unsub1);

      // Unread count since last visit
      const lastVisited = localStorage.getItem(`gameday_chat_last_visited_${user.id}_${roomId}`);
      if (lastVisited) {
        const lastVisitedDate = new Date(lastVisited);
        const q2 = query(messagesRef, where('createdAt', '>', Timestamp.fromDate(lastVisitedDate)), orderBy('createdAt', 'desc'));
        const unsub2 = onSnapshot(q2, (snap) => {
          // Don't count the user's own messages
          const unreadCount = snap.docs.filter(d => d.data().userId !== user.id).length;
          setUnreadSinceLast(prev => ({ ...prev, [roomId]: unreadCount }));
        }, () => {});
        unsubscribes.push(unsub2);
      } else {
        // Never visited — count all messages (excluding own)
        const q2 = query(messagesRef, orderBy('createdAt', 'desc'));
        const unsub2 = onSnapshot(q2, (snap) => {
          const unreadCount = snap.docs.filter(d => d.data().userId !== user.id).length;
          setUnreadSinceLast(prev => ({ ...prev, [roomId]: unreadCount }));
        }, () => {});
        unsubscribes.push(unsub2);
      }
    };

    chatTeams.forEach(team => {
      CHANNELS.forEach(channel => {
        listenRoom(`${team.id}_${channel.id}`);
      });
    });

    customChats.forEach(chat => {
      listenRoom(`${chat.teamId}_custom_${chat.id}`);
    });

    return () => unsubscribes.forEach(u => u());
  }, [chatTeams, customChats]);

  // ── Create custom chat ──────────────────────────────────────
  const handleCreateChat = async () => {
    if (!createTeamId || !createChatName.trim() || createSelectedMembers.length === 0) return;
    setIsCreatingChat(true);
    try {
      const allTeams = [...MOCK_TEAMS, ...StorageService.getCustomTeams()];
      const team = allTeams.find(t => t.id === createTeamId);
      const members = StorageService.getTeamMembers(createTeamId);
      const selectedMemberData = members.filter((m: any) => createSelectedMembers.includes(m.id));
      // Always include the creator
      const memberIds = [...new Set([user.id, ...createSelectedMembers])];
      const memberNames = memberIds.map(id => {
        if (id === user.id) return user.name;
        const m = members.find((m: any) => m.id === id);
        return m?.name || 'Unknown';
      });

      const chatDoc = {
        name: createChatName.trim(),
        teamId: createTeamId,
        teamName: team?.name || 'Unknown Team',
        createdBy: user.id,
        createdByName: user.name,
        memberIds,
        memberNames,
        createdAt: serverTimestamp(),
        lastMessage: '',
        lastMessageBy: '',
        lastMessageAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'customChats'), chatDoc);
      resetChatModal();
    } catch (err) {
      console.error('[Chat] Failed to create chat:', err);
    } finally {
      setIsCreatingChat(false);
    }
  };

  // ── Add members to existing chats ───────────────────────────
  const handleAddMembersToChats = async () => {
    if (addMemberSelectedMembers.length === 0 || addMemberSelectedChats.length === 0) return;
    setIsAddingMembers(true);
    try {
      const members = StorageService.getTeamMembers(addMemberTeamId || '');
      for (const chatId of addMemberSelectedChats) {
        const chatRef = doc(db, 'customChats', chatId);
        const newNames = addMemberSelectedMembers.map(id => {
          const m = members.find((m: any) => m.id === id);
          return m?.name || 'Unknown';
        });
        await updateDoc(chatRef, {
          memberIds: arrayUnion(...addMemberSelectedMembers),
          memberNames: arrayUnion(...newNames),
        });
      }
      // Reset and close
      resetChatModal();
    } catch (err) {
      console.error('[Chat] Failed to add members to chats:', err);
    } finally {
      setIsAddingMembers(false);
    }
  };

  const resetChatModal = () => {
    setShowCreateChat(false);
    setChatModalMode('choose');
    setCreateStep('team');
    setCreateTeamId(null);
    setCreateChatName('');
    setCreateSelectedMembers([]);
    setCreateMemberSearch('');
    setAddMemberStep('team');
    setAddMemberTeamId(null);
    setAddMemberSelectedMembers([]);
    setAddMemberSelectedChats([]);
    setAddMemberSearch('');
  };

  const chatChannels = useMemo(() => {
    const rows: { team: any; channel: typeof CHANNELS[0]; teamName: string; unread: number; isCustom?: boolean; customChat?: any }[] = [];
    chatTeams.forEach(team => {
      const name = teamNames[team.id] || team.name;
      CHANNELS.forEach(channel => {
        const totalUnread = (channel.id === 'team' ? (unreadCounts[team.id] || 0) : 0) + (channelUnreads[channel.id] || 0);
        rows.push({ team, channel, teamName: name, unread: totalUnread });
      });
    });
    // Add custom chats into the same list
    customChats.forEach((chat: any) => {
      rows.push({
        team: { id: chat.teamId, name: chat.teamName, logo: null },
        channel: { id: `custom_${chat.id}`, name: chat.name, label: chat.name.toLowerCase() },
        teamName: chat.name,
        unread: 0,
        isCustom: true,
        customChat: chat,
      });
    });
    // Sort by most recent message activity (newest first)
    rows.sort((a, b) => {
      const roomA = a.isCustom ? `${a.team.id}_custom_${a.customChat.id}` : `${a.team.id}_${a.channel.id}`;
      const roomB = b.isCustom ? `${b.team.id}_custom_${b.customChat.id}` : `${b.team.id}_${b.channel.id}`;
      const tsA = lastMessages[roomA]?.timestamp || 0;
      const tsB = lastMessages[roomB]?.timestamp || 0;
      return tsB - tsA;
    });
    return rows;
  }, [chatTeams, teamNames, unreadCounts, channelUnreads, customChats, lastMessages]);

  // ── Channel list view ─────────────────────────────────────
  if (!selectedTeamId) {
    return (
      <div className="bg-white min-h-screen pb-24">
        <div className="pt-6 pb-2 px-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Messages</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Your Team Channels</p>
          </div>
          <button
            onClick={() => {
              setShowCreateChat(true);
              setChatModalMode('choose');
            }}
            className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center active:scale-90 transition-all hover:bg-slate-50"
          >
            <Plus className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {chatChannels.map(({ team, channel, teamName, unread, isCustom, customChat }, index) => {
            const roomId = isCustom ? `${team.id}_custom_${customChat.id}` : `${team.id}_${channel.id}`;
            const unreadCount = unreadSinceLast[roomId] || 0;
            const lastMsg = lastMessages[roomId];
            const displayName = isCustom ? customChat.name : teamName;
            const memberCount = isCustom ? (customChat.memberIds?.length || 0) : getMemberCount(team.id, channel);

            return (
              <motion.button
                key={roomId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => {
                  localStorage.setItem(`gameday_chat_last_visited_${user.id}_${roomId}`, new Date().toISOString());
                  setUnreadSinceLast(prev => ({ ...prev, [roomId]: 0 }));
                  setSelectedTeamId(team.id);
                  if (isCustom) {
                    setSelectedChannel({ id: `custom_${customChat.id}`, name: customChat.name, label: customChat.name.toLowerCase() });
                  } else {
                    setSelectedChannel(channel);
                    setChannelUnreads(prev => ({ ...prev, [channel.id]: 0 }));
                    setUnreadCounts(prev => ({ ...prev, [team.id]: 0 }));
                  }
                }}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  {isCustom ? (
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                  ) : (
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
                  )}
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
                      {displayName}
                    </h3>
                    {!isCustom && (
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">
                        # {channel.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {lastMsg
                      ? `${lastMsg.userName}: ${lastMsg.text}`
                      : isCustom ? customChat.teamName : 'No messages yet'}
                  </p>
                </div>

                {/* Right side */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] font-bold text-slate-300 uppercase">{memberCount} ppl</span>
                  {unreadCount > 0 && (
                    <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Create Chat / Add Member Modal */}
        <AnimatePresence>
          {showCreateChat && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-[60]"
                onClick={resetChatModal}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92%] max-w-sm max-h-[85vh] flex flex-col bg-white rounded-[2rem] shadow-2xl overflow-hidden"
              >
                {/* Header */}
                <div className="bg-slate-900 p-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Back button logic */}
                    {chatModalMode === 'create' && (
                      <button onClick={() => {
                        if (createStep === 'members') setCreateStep('name');
                        else if (createStep === 'name' && chatTeams.length > 1) { setCreateStep('team'); setCreateTeamId(null); }
                        else if (createStep === 'name' && chatTeams.length === 1) { setChatModalMode('choose'); setCreateTeamId(null); setCreateChatName(''); }
                        else if (createStep === 'team') setChatModalMode('choose');
                      }} className="text-white/60 hover:text-white">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    )}
                    {chatModalMode === 'addMember' && (
                      <button onClick={() => {
                        if (addMemberStep === 'chats') setAddMemberStep('members');
                        else if (addMemberStep === 'members' && chatTeams.length > 1) { setAddMemberStep('team'); setAddMemberTeamId(null); }
                        else if (addMemberStep === 'members' && chatTeams.length === 1) { setChatModalMode('choose'); setAddMemberTeamId(null); setAddMemberSelectedMembers([]); }
                        else if (addMemberStep === 'team') setChatModalMode('choose');
                      }} className="text-white/60 hover:text-white">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    )}
                    <div>
                      <h2 className="text-white font-black uppercase italic text-lg">
                        {chatModalMode === 'choose' ? 'Chat Options' :
                         chatModalMode === 'create' ? (createStep === 'team' ? 'Select Team' : createStep === 'name' ? 'Chat Name' : 'Add Members') :
                         addMemberStep === 'team' ? 'Select Team' : addMemberStep === 'members' ? 'Select Members' : 'Select Chats'}
                      </h2>
                      {chatModalMode !== 'choose' && (
                        <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">
                          {chatModalMode === 'create'
                            ? `Step ${createStep === 'team' ? '1 of 3' : createStep === 'name' ? (chatTeams.length === 1 ? '1 of 2' : '2 of 3') : (chatTeams.length === 1 ? '2 of 2' : '3 of 3')}`
                            : `Step ${addMemberStep === 'team' ? '1 of 3' : addMemberStep === 'members' ? (chatTeams.length === 1 ? '1 of 2' : '2 of 3') : (chatTeams.length === 1 ? '2 of 2' : '3 of 3')}`
                          }
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={resetChatModal} className="text-white/60 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">

                  {/* ── Choose Mode ── */}
                  {chatModalMode === 'choose' && (
                    <>
                      <button
                        onClick={() => {
                          setChatModalMode('create');
                          if (chatTeams.length === 1) {
                            setCreateTeamId(chatTeams[0].id);
                            setCreateStep('name');
                          } else {
                            setCreateStep('team');
                          }
                        }}
                        className="w-full flex items-center gap-4 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Plus className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900 text-sm">Create a Chat</h4>
                          <p className="text-[9px] text-slate-400 font-medium">Start a new group conversation</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90" />
                      </button>
                      <button
                        onClick={() => {
                          setChatModalMode('addMember');
                          if (chatTeams.length === 1) {
                            setAddMemberTeamId(chatTeams[0].id);
                            setAddMemberStep('members');
                          } else {
                            setAddMemberStep('team');
                          }
                        }}
                        className="w-full flex items-center gap-4 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900 text-sm">Add Member to Chat</h4>
                          <p className="text-[9px] text-slate-400 font-medium">Add people to existing chats</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90" />
                      </button>
                    </>
                  )}

                  {/* ── Create Chat Flow ── */}
                  {chatModalMode === 'create' && createStep === 'team' && (
                    chatTeams.map(team => {
                      const name = teamNames[team.id] || team.name;
                      return (
                        <button
                          key={team.id}
                          onClick={() => {
                            setCreateTeamId(team.id);
                            setCreateStep('name');
                          }}
                          className="w-full flex items-center gap-3 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors text-left"
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${
                            (!logoErrors[team.id] && (teamLogos[team.id] || team.logo)) ? 'bg-white border border-slate-100' : getTeamColor(team.id)
                          }`}>
                            {(!logoErrors[team.id] && (teamLogos[team.id] || team.logo)) ? (
                              <img src={teamLogos[team.id] || team.logo} alt={name} className="w-full h-full object-contain p-1" onError={() => setLogoErrors(prev => ({ ...prev, [team.id]: true }))} />
                            ) : (
                              <span className="text-white text-xs font-black">{getTeamInitials(name)}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-900 text-sm">{name}</h4>
                            <p className="text-[9px] text-slate-400 font-medium">{StorageService.getTeamMembers(team.id).length} members</p>
                          </div>
                          <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90" />
                        </button>
                      );
                    })
                  )}

                  {chatModalMode === 'create' && createStep === 'name' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Chat Name</label>
                        <Input
                          value={createChatName}
                          onChange={e => setCreateChatName(e.target.value)}
                          placeholder="e.g. Forward Pack, Match Day Squad"
                          className="h-12 rounded-xl text-sm"
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (createChatName.trim()) setCreateStep('members');
                        }}
                        disabled={!createChatName.trim()}
                        className="w-full h-12 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-slate-800 transition-all active:scale-[0.98]"
                      >
                        Next — Select Members
                      </button>
                    </div>
                  )}

                  {chatModalMode === 'create' && createStep === 'members' && createTeamId && (() => {
                    const members = StorageService.getTeamMembers(createTeamId);
                    // Also include the coach/creator
                    const allTeams = [...MOCK_TEAMS, ...StorageService.getCustomTeams()];
                    const team = allTeams.find(t => t.id === createTeamId);
                    const coachId = team?.coachId || team?.createdBy;
                    const coachInList = members.some((m: any) => m.id === coachId);
                    let allMembers = members;
                    if (coachId && !coachInList) {
                      const coachData = StorageService.getUserData(coachId);
                      allMembers = [{ id: coachId, name: coachData?.name || 'Coach', avatar: coachData?.avatar, role: 'Coach' }, ...members];
                    }
                    // Filter out current user (auto-included) and apply search
                    const filteredMembers = allMembers
                      .filter((m: any) => m.id !== user.id)
                      .filter((m: any) => !createMemberSearch || m.name?.toLowerCase().includes(createMemberSearch.toLowerCase()));

                    return (
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            value={createMemberSearch}
                            onChange={e => setCreateMemberSearch(e.target.value)}
                            placeholder="Search members..."
                            className="h-10 pl-9 rounded-xl text-sm"
                          />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{createSelectedMembers.length} selected · You'll be added automatically</p>
                        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                          {filteredMembers.map((member: any) => {
                            const isSelected = createSelectedMembers.includes(member.id);
                            return (
                              <button
                                key={member.id}
                                onClick={() => {
                                  setCreateSelectedMembers(prev =>
                                    isSelected ? prev.filter(id => id !== member.id) : [...prev, member.id]
                                  );
                                }}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                                  isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-slate-50 hover:bg-slate-100'
                                }`}
                              >
                                <DefaultAvatar src={member.avatar} name={member.name} size="sm" className="rounded-full" />
                                <div className="flex-1">
                                  <h4 className="font-bold text-slate-900 text-sm">{member.name}</h4>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">{member.role || 'Member'}</p>
                                </div>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                  isSelected ? 'bg-primary text-white' : 'bg-slate-200'
                                }`}>
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={handleCreateChat}
                          disabled={createSelectedMembers.length === 0 || isCreatingChat}
                          className="w-full h-12 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-slate-800 transition-all active:scale-[0.98]"
                        >
                          {isCreatingChat ? 'Creating...' : `Create Chat (${createSelectedMembers.length + 1} members)`}
                        </button>
                      </div>
                    );
                  })()}

                  {/* ── Add Member Flow ── */}
                  {chatModalMode === 'addMember' && addMemberStep === 'team' && (
                    chatTeams.map(team => {
                      const name = teamNames[team.id] || team.name;
                      const teamCustomChats = customChats.filter((c: any) => c.teamId === team.id);
                      if (teamCustomChats.length === 0) return (
                        <div key={team.id} className="w-full flex items-center gap-3 p-4 bg-slate-50 rounded-2xl text-left opacity-50">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${
                            (!logoErrors[team.id] && (teamLogos[team.id] || team.logo)) ? 'bg-white border border-slate-100' : getTeamColor(team.id)
                          }`}>
                            {(!logoErrors[team.id] && (teamLogos[team.id] || team.logo)) ? (
                              <img src={teamLogos[team.id] || team.logo} alt={name} className="w-full h-full object-contain p-1" onError={() => setLogoErrors(prev => ({ ...prev, [team.id]: true }))} />
                            ) : (
                              <span className="text-white text-xs font-black">{getTeamInitials(name)}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-900 text-sm">{name}</h4>
                            <p className="text-[9px] text-slate-400 font-medium">No custom chats</p>
                          </div>
                        </div>
                      );
                      return (
                        <button
                          key={team.id}
                          onClick={() => {
                            setAddMemberTeamId(team.id);
                            setAddMemberStep('members');
                          }}
                          className="w-full flex items-center gap-3 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors text-left"
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${
                            (!logoErrors[team.id] && (teamLogos[team.id] || team.logo)) ? 'bg-white border border-slate-100' : getTeamColor(team.id)
                          }`}>
                            {(!logoErrors[team.id] && (teamLogos[team.id] || team.logo)) ? (
                              <img src={teamLogos[team.id] || team.logo} alt={name} className="w-full h-full object-contain p-1" onError={() => setLogoErrors(prev => ({ ...prev, [team.id]: true }))} />
                            ) : (
                              <span className="text-white text-xs font-black">{getTeamInitials(name)}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-900 text-sm">{name}</h4>
                            <p className="text-[9px] text-slate-400 font-medium">{teamCustomChats.length} custom chat{teamCustomChats.length !== 1 ? 's' : ''}</p>
                          </div>
                          <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90" />
                        </button>
                      );
                    })
                  )}

                  {chatModalMode === 'addMember' && addMemberStep === 'members' && addMemberTeamId && (() => {
                    const members = StorageService.getTeamMembers(addMemberTeamId);
                    const allTeams = [...MOCK_TEAMS, ...StorageService.getCustomTeams()];
                    const team = allTeams.find(t => t.id === addMemberTeamId);
                    const coachId = team?.coachId || team?.createdBy;
                    const coachInList = members.some((m: any) => m.id === coachId);
                    let allMembers = members;
                    if (coachId && !coachInList) {
                      const coachData = StorageService.getUserData(coachId);
                      allMembers = [{ id: coachId, name: coachData?.name || 'Coach', avatar: coachData?.avatar, role: 'Coach' }, ...members];
                    }
                    const filteredMembers = allMembers
                      .filter((m: any) => !addMemberSearch || m.name?.toLowerCase().includes(addMemberSearch.toLowerCase()));

                    return (
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            value={addMemberSearch}
                            onChange={e => setAddMemberSearch(e.target.value)}
                            placeholder="Search members..."
                            className="h-10 pl-9 rounded-xl text-sm"
                          />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{addMemberSelectedMembers.length} selected</p>
                        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                          {filteredMembers.map((member: any) => {
                            const isSelected = addMemberSelectedMembers.includes(member.id);
                            return (
                              <button
                                key={member.id}
                                onClick={() => {
                                  setAddMemberSelectedMembers(prev =>
                                    isSelected ? prev.filter(id => id !== member.id) : [...prev, member.id]
                                  );
                                }}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                                  isSelected ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'bg-slate-50 hover:bg-slate-100'
                                }`}
                              >
                                <DefaultAvatar src={member.avatar} name={member.name} size="sm" className="rounded-full" />
                                <div className="flex-1">
                                  <h4 className="font-bold text-slate-900 text-sm">{member.name}</h4>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">{member.role || 'Member'}</p>
                                </div>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                  isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-200'
                                }`}>
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => {
                            if (addMemberSelectedMembers.length > 0) setAddMemberStep('chats');
                          }}
                          disabled={addMemberSelectedMembers.length === 0}
                          className="w-full h-12 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-slate-800 transition-all active:scale-[0.98]"
                        >
                          Next — Select Chats
                        </button>
                      </div>
                    );
                  })()}

                  {chatModalMode === 'addMember' && addMemberStep === 'chats' && addMemberTeamId && (() => {
                    const teamChats = customChats.filter((c: any) => c.teamId === addMemberTeamId);
                    return (
                      <div className="space-y-3">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          Adding {addMemberSelectedMembers.length} member{addMemberSelectedMembers.length !== 1 ? 's' : ''} · {addMemberSelectedChats.length} chat{addMemberSelectedChats.length !== 1 ? 's' : ''} selected
                        </p>
                        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                          {teamChats.map((chat: any) => {
                            const isSelected = addMemberSelectedChats.includes(chat.id);
                            // Check which selected members are already in this chat
                            const alreadyIn = addMemberSelectedMembers.filter(id => chat.memberIds?.includes(id));
                            const newCount = addMemberSelectedMembers.length - alreadyIn.length;
                            return (
                              <button
                                key={chat.id}
                                onClick={() => {
                                  setAddMemberSelectedChats(prev =>
                                    isSelected ? prev.filter(id => id !== chat.id) : [...prev, chat.id]
                                  );
                                }}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                                  isSelected ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'bg-slate-50 hover:bg-slate-100'
                                }`}
                              >
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <MessageSquare className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-bold text-slate-900 text-sm">{chat.name}</h4>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">
                                    {chat.memberIds?.length || 0} members{newCount > 0 ? ` · +${newCount} new` : ' · all already added'}
                                  </p>
                                </div>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                  isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-200'
                                }`}>
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {teamChats.length === 0 && (
                          <div className="text-center py-6">
                            <p className="text-sm text-slate-400 font-medium">No custom chats for this team yet</p>
                            <p className="text-[10px] text-slate-300 mt-1">Create a chat first</p>
                          </div>
                        )}
                        <button
                          onClick={handleAddMembersToChats}
                          disabled={addMemberSelectedChats.length === 0 || isAddingMembers}
                          className="w-full h-12 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-emerald-700 transition-all active:scale-[0.98]"
                        >
                          {isAddingMembers ? 'Adding...' : `Confirm — Add to ${addMemberSelectedChats.length} Chat${addMemberSelectedChats.length !== 1 ? 's' : ''}`}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Chat view ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 z-10">
      <div className="bg-white border-b border-slate-100 p-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 -ml-2"
            onClick={() => {
              // Save last visited timestamp when leaving
              if (selectedTeamId) {
                const roomId = `${selectedTeamId}_${selectedChannel.id}`;
                localStorage.setItem(`gameday_chat_last_visited_${user.id}_${roomId}`, new Date().toISOString());
                setUnreadSinceLast(prev => ({ ...prev, [roomId]: 0 }));
              }
              setSelectedTeamId(null);
            }}
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
        className="shrink-0 px-3 py-2 bg-white border-t border-slate-100"
      >
        <AnimatePresence mode="wait">
          {isRecording ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-3 bg-red-50 p-2 rounded-xl border border-red-100"
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
                className="w-9 h-9 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all shrink-0"
              >
                <Mic className="w-4 h-4" />
              </Button>
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                placeholder="Type a message..."
                maxLength={MAX_MESSAGE_LENGTH}
                className="flex-1 bg-slate-50 border-none rounded-xl focus-visible:ring-primary h-9 text-base disabled:opacity-50"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!inputText.trim() || isSending}
                className="w-9 h-9 rounded-xl shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none shrink-0"
              >
                <Send className={`w-4 h-4 ${isSending ? "animate-pulse" : ""}`} />
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
        {/* Rate limit toast */}
        <AnimatePresence>
          {rateLimitMsg && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute bottom-16 left-4 right-4 bg-slate-900 text-white text-[10px] font-bold text-center py-2 px-3 rounded-xl z-10"
            >
              {rateLimitMsg}
            </motion.div>
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
                {channelMembers.members.map((member: any) => {
                  const memberData = StorageService.getUserData(member.id);
                  const avatar = memberData?.avatar || member.avatar || null;
                  return (
                  <div key={member.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-50">
                    <DefaultAvatar
                      src={avatar}
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
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
