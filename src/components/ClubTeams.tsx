import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import DefaultAvatar from "./DefaultAvatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  Plus, Users, Trophy, Copy, Check, Building2, Clock,
  MessageSquare, Calendar as CalendarIcon, ChevronLeft,
  ChevronDown, Activity, Search, Bell, CheckCircle2, X as XIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MOCK_TEAMS, MOCK_CLUB } from "../constants";
import StorageService from "../services/StorageService";
import { User } from "../types";

interface Player {
  id: string;
  name: string;
  avatar: string;
  age: number;
  position: string;
  teamIds: string[];
}

interface ClubTeamsProps {
  user: User | null;
  onUpdateUser: (updates: Partial<User>) => void;
  onTabChange?: (tab: string) => void;
}

const PAST_TEAMS = [
  { id: "p1", name: "2023 Wildcats U13",  logo: "https://api.dicebear.com/7.x/identicon/svg?seed=p1", coach: "Sarah Miller", joinCode: "EXPIRED", year: "2023" },
  { id: "p2", name: "2023 Thunder Elite", logo: "https://api.dicebear.com/7.x/identicon/svg?seed=p2", coach: "Mike Ross",     joinCode: "EXPIRED", year: "2023" },
  { id: "p3", name: "2022 Red Hawks",     logo: "https://api.dicebear.com/7.x/identicon/svg?seed=p3", coach: "Dave Carter",   joinCode: "EXPIRED", year: "2022" },
  { id: "p4", name: "2022 Storm Chasers", logo: "https://api.dicebear.com/7.x/identicon/svg?seed=p4", coach: "Lisa Park",     joinCode: "EXPIRED", year: "2022" },
];

const ALL_PLAYERS: Player[] = [
  { id: "1",  name: "Cody Johnson",       avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Cody",      age: 24, position: "Midfield",   teamIds: ["1"] },
  { id: "2",  name: "Liam Smith",         avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Liam",      age: 22, position: "Goalkeeper", teamIds: ["1"] },
  { id: "3",  name: "Noah Williams",      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Noah",      age: 25, position: "Defender",   teamIds: ["1", "p1"] },
  { id: "4",  name: "Oliver Brown",       avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver",    age: 23, position: "Defender",   teamIds: ["1"] },
  { id: "5",  name: "James Jones",        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=James",     age: 26, position: "Midfield",   teamIds: ["2"] },
  { id: "6",  name: "William Garcia",     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=William",   age: 21, position: "Forward",    teamIds: ["2"] },
  { id: "7",  name: "Lucas Miller",       avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lucas",     age: 24, position: "Forward",    teamIds: ["p1"] },
  { id: "8",  name: "Ethan Hunt",         avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ethan",     age: 27, position: "Midfield",   teamIds: ["p2"] },
  { id: "9",  name: "Mason Mount",        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mason",     age: 22, position: "Midfield",   teamIds: ["p1", "p2"] },
  { id: "10", name: "Ben Chilwell",       avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben",       age: 25, position: "Defender",   teamIds: ["p1"] },
  { id: "11", name: "Reece James",        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Reece",     age: 23, position: "Defender",   teamIds: ["p1"] },
  { id: "12", name: "Kai Havertz",        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kai",       age: 24, position: "Forward",    teamIds: ["p1"] },
  { id: "13", name: "Raheem Sterling",    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Raheem",    age: 29, position: "Forward",    teamIds: ["p1"] },
  { id: "14", name: "Enzo Fernandez",     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Enzo",      age: 22, position: "Midfield",   teamIds: ["p1"] },
  { id: "15", name: "Conor Gallagher",    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Conor",     age: 23, position: "Midfield",   teamIds: ["p1"] },
  { id: "16", name: "Thiago Silva",       avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Thiago",    age: 39, position: "Defender",   teamIds: ["p1"] },
  { id: "17", name: "Levi Colwill",       avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Levi",      age: 20, position: "Defender",   teamIds: ["p1"] },
  { id: "18", name: "Malo Gusto",         avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Malo",      age: 20, position: "Defender",   teamIds: ["p1"] },
  { id: "19", name: "Robert Sanchez",     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Robert",    age: 26, position: "Goalkeeper", teamIds: ["p1"] },
  { id: "20", name: "Benoit Badiashile",  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Benoit",    age: 22, position: "Defender",   teamIds: ["p1"] },
  { id: "21", name: "Axel Disasi",        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Axel",      age: 25, position: "Defender",   teamIds: ["p1"] },
  { id: "22", name: "Cole Palmer",        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Cole",      age: 21, position: "Midfield",   teamIds: ["p1"] },
  { id: "23", name: "Nicolas Jackson",    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nicolas",   age: 22, position: "Forward",    teamIds: ["p1"] },
  { id: "24", name: "Mykhailo Mudryk",    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mykhailo",  age: 22, position: "Forward",    teamIds: ["p1"] },
  { id: "25", name: "Noni Madueke",       avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Noni",      age: 21, position: "Forward",    teamIds: ["p1"] },
  { id: "26", name: "Carney Chukwuemeka", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Carney",    age: 19, position: "Midfield",   teamIds: ["p1"] },
  { id: "27", name: "Alex Turner",        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",      age: 21, position: "Forward",    teamIds: ["3"] },
  { id: "28", name: "Sam Davies",         avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sam",       age: 23, position: "Midfield",   teamIds: ["4"] },
  { id: "29", name: "Jordan Lee",         avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan",    age: 20, position: "Defender",   teamIds: ["5"] },
  { id: "30", name: "Chris Evans",        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ChrisE",    age: 25, position: "Goalkeeper", teamIds: ["6"] },
  { id: "31", name: "Tom Harris",         avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tom",       age: 22, position: "Forward",    teamIds: ["7"] },
  { id: "32", name: "Jake Wilson",        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jake",      age: 26, position: "Midfield",   teamIds: ["p3"] },
  { id: "33", name: "Ryan Cooper",        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ryan",      age: 24, position: "Defender",   teamIds: ["p3"] },
  { id: "34", name: "Sean Murphy",        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sean",      age: 22, position: "Forward",    teamIds: ["p4"] },
  { id: "35", name: "Dylan Walsh",        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dylan",     age: 23, position: "Goalkeeper", teamIds: ["p4"] },
];

export default function ClubTeams({ user, onUpdateUser, onTabChange }: ClubTeamsProps) {
  const [teams, setTeams]                     = useState<any[]>([]);
  const [coaches, setCoaches]                 = useState<User[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<string>("");
  const [activeTab, setActiveTab]             = useState<"dashboard" | "active" | "past">("dashboard");
  const [isCreating, setIsCreating]           = useState(false);
  const [newTeamName, setNewTeamName]         = useState("");
  const [newTeamSport, setNewTeamSport]       = useState("");
  const [copiedCode, setCopiedCode]           = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam]       = useState<any | null>(null);
  const [archiveChatId, setArchiveChatId]     = useState<string>("players");
  const [activeSub, setActiveSub]             = useState<"members" | "teams">("members");
  const [pastSub, setPastSub]                 = useState<"members" | "teams">("members");
  const [rosterTeam, setRosterTeam]           = useState<any | null>(null);
  const [showDeleteModal, setShowDeleteModal]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [removedMemberIds, setRemovedMemberIds] = useState<Set<string>>(new Set());
  const [activeSearch, setActiveSearch]       = useState("");
  const [pastSearch, setPastSearch]           = useState("");
  const [activeYearFilter, setActiveYearFilter] = useState("all");
  const [pastYearFilter, setPastYearFilter]     = useState("all");
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  useEffect(() => {
    const loadRequests = () => {
      const all = JSON.parse(localStorage.getItem('gameday_club_requests') || '[]');
      setPendingRequests(all.filter((r: any) => r.status === 'pending'));
    };
    loadRequests();
    window.addEventListener('gameday_update', loadRequests);
    return () => window.removeEventListener('gameday_update', loadRequests);
  }, []);

  useEffect(() => {
    setRemovedMemberIds(new Set());
  }, [rosterTeam]);

  const loadTeams = () => {
    const legacyTeams = StorageService.getTeams();
    const customTeams = StorageService.getCustomTeams();
    const allStored = [...legacyTeams, ...customTeams];

    const deletedMockIds = JSON.parse(localStorage.getItem('gameday_deleted_mock_teams') || '[]');

    const mockMapped = MOCK_TEAMS
      .filter(t => !deletedMockIds.includes(t.id))
      .map(t => ({
        ...t,
        year: "2026",
      }));

    const clubStoredTeams = allStored.filter(t =>
      t.clubId === MOCK_CLUB.id
    );

    setTeams([...mockMapped, ...clubStoredTeams]);
    setCoaches(StorageService.getCoaches());
  };

  useEffect(() => {
    loadTeams();
    window.addEventListener('gameday_update', loadTeams);
    return () => window.removeEventListener('gameday_update', loadTeams);
  }, []);

  const [teamLogos, setTeamLogos] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadLogos = () => {
      const logos: Record<string, string> = {};
      [...MOCK_TEAMS, ...StorageService.getTeams(), ...StorageService.getCustomTeams()].forEach(t => {
        const savedLogo = StorageService.getTeamLogo(t.id);
        if (savedLogo) logos[t.id] = savedLogo;
      });
      setTeamLogos(logos);
    };
    loadLogos();
    window.addEventListener('gameday_update', loadLogos);
    return () => window.removeEventListener('gameday_update', loadLogos);
  }, []);

  const activeYears: string[] = ["all", ...Array.from(new Set<string>(teams.filter(t => t.status !== 'archived').map(t => (t.year || "2026") as string))).sort().reverse()];
  const pastTeams = [
    ...PAST_TEAMS,
    ...teams.filter(t => t.status === 'archived')
  ];
  const pastYears: string[]   = ["all", ...Array.from(new Set<string>(pastTeams.map(t => ((t.year || new Date(t.archivedAt).getFullYear().toString()) as string)))).sort().reverse()];

  const activeCoachEntries = teams.map(team => {
    // Try to find the coach's real profile data from storage
    const allUserKeys = Object.keys(localStorage).filter(k => k.startsWith('gameday_user_'));
    const coachProfile = allUserKeys
      .map(k => JSON.parse(localStorage.getItem(k) || '{}'))
      .find(u =>
        u.name === team.coach ||
        (u.teamIds?.includes(team.id) && (u.role === 'coach' || localStorage.getItem(`gameday_role_${u.id}_${team.id}`) === 'coach'))
      );

    return {
      id:       coachProfile?.id || `coach-${team.id}`,
      name:     coachProfile?.name || team.coach || "Unknown Coach",
      avatar:   coachProfile?.avatar || coachProfile?.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(team.coach || "coach")}`,
      role:     "Coach" as const,
      teamName: team.name,
      teamId:   team.id,
      year:     team.year || "2026",
    };
  });

  const pastCoachEntries = PAST_TEAMS.map(team => ({
    id:       `coach-past-${team.id}`,
    name:     team.coach || "Unknown Coach",
    avatar:   `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(team.coach || "coach")}`,
    role:     "Coach" as const,
    teamName: team.name,
    teamId:   team.id,
    year:     team.year,
  }));

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !newTeamSport.trim() || !selectedCoachId) return;
    const selectedCoach = coaches.find(c => c.id === selectedCoachId);
    if (!selectedCoach) return;
    const teamId  = Math.random().toString(36).substr(2, 9);
    const newTeam = {
      id: teamId, name: newTeamName, sport: newTeamSport,
      logo: `https://api.dicebear.com/7.x/identicon/svg?seed=${newTeamName}`,
      coach: selectedCoach.name, coachId: selectedCoachId,
      joinCode: Math.random().toString(36).substr(2, 6).toUpperCase(),
      year: new Date().getFullYear().toString(), members: 0, clubId: "karaka-rfc",
    };
    StorageService.addTeam(newTeam);

    // Sync new team to Firestore with clubId
    try {
      const { db } = await import('../firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'teams', newTeam.id), newTeam);
    } catch (e) {
      console.warn('Firestore team write failed:', e);
    }

    const coachData      = StorageService.getUserData(selectedCoachId) || selectedCoach;
    const updatedTeamIds = [...(coachData.teamIds || []), teamId];
    StorageService.updateUserData(selectedCoachId, { teamIds: updatedTeamIds });
    if (user && user.role === "club") {
      const updatedClubTeamIds = [...(user.teamIds || []), teamId];
      onUpdateUser({ teamIds: updatedClubTeamIds });
      StorageService.updateUserData(user.id, { teamIds: updatedClubTeamIds });
    }
    StorageService.createChat({
      id: `chat-${teamId}`, name: `${newTeamName} Group`, teamId,
      type: "group", lastMessage: "Team chat initialized", timestamp: new Date().toISOString(),
    });
    setTeams([newTeam, ...teams]);
    setNewTeamName(""); setNewTeamSport(""); setSelectedCoachId(""); setIsCreating(false);
  };

  const copyToClipboard = (code: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code);
    } else {
      const ta = document.createElement('textarea'); ta.value = code; ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const renderSearchFilter = (
    search: string, setSearch: (v: string) => void,
    yearFilter: string, setYearFilter: (v: string) => void,
    years: string[]
  ) => (
    <div className="flex gap-2 px-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-10 pl-9 bg-white border-none rounded-xl shadow-sm text-[11px] font-medium focus-visible:ring-primary"
        />
      </div>
      <div className="relative">
        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="appearance-none h-10 bg-white border-none rounded-xl px-4 pr-8 text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
        >
          {years.map(y => (
            <option key={y} value={y}>{y === "all" ? "All Years" : y}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );

  const renderMemberCard = (
    id: string, name: string, avatar: string, role: string,
    detail: string, teamName: string, isCoach: boolean, index: number
  ) => (
    <motion.div key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
        <CardContent className="p-3 flex items-center gap-3">
          <div className={`relative flex-shrink-0 ${isCoach ? "ring-2 ring-primary/30 rounded-xl" : ""}`}>
            <DefaultAvatar src={avatar} name={name} size="md" className="rounded-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[11px] font-black text-slate-900 uppercase italic truncate">{name}</p>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{detail}</p>
          </div>
          <div className="flex-shrink-0">
            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
              isCoach
                ? "bg-primary/10 text-primary"
                : "bg-slate-100 text-slate-500"
            }`}>
              {isCoach ? "Coach" : "Member"}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderActiveMembers = () => {
    const yearTeams   = activeYearFilter === "all" 
      ? teams.filter(t => t.status !== 'archived') 
      : teams.filter(t => t.status !== 'archived' && (t.year || "2026") === activeYearFilter);
    const yearTeamIds = new Set(yearTeams.map(t => t.id));
    const filteredCoaches = activeCoachEntries
      .filter(c => yearTeamIds.has(c.teamId))
      .filter(c => !activeSearch || c.name.toLowerCase().includes(activeSearch.toLowerCase()));
    const filteredPlayers = ALL_PLAYERS
      .filter(p => p.teamIds.some(tid => yearTeamIds.has(tid)))
      .filter(p => !activeSearch || p.name.toLowerCase().includes(activeSearch.toLowerCase()));
    const seenCoachNames = new Set<string>();
    const uniqueCoaches  = filteredCoaches.filter(c => {
      if (seenCoachNames.has(c.name)) return false;
      seenCoachNames.add(c.name); return true;
    });
    return (
      <div className="space-y-3 px-4">
        {uniqueCoaches.length === 0 && filteredPlayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-8 h-8 text-slate-200 mb-3" />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No members found</p>
          </div>
        ) : (
          <>
            {uniqueCoaches.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 pt-1">Coaches · {uniqueCoaches.length}</p>
                {uniqueCoaches.map((c, i) => renderMemberCard(c.id, c.name, c.avatar, "Coach", c.teamName, c.teamName, true, i))}
              </div>
            )}
            {filteredPlayers.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 pt-2">Members · {filteredPlayers.length}</p>
                {filteredPlayers.map((p, i) => {
                  const playerTeam = teams.find(t => p.teamIds.includes(t.id));
                  return renderMemberCard(p.id, p.name, p.avatar, p.position, p.position, playerTeam?.name || "—", false, uniqueCoaches.length + i);
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderActiveTeams = () => {
    const filtered = teams
      .filter(t => t.status !== 'archived')
      .filter(t => activeYearFilter === "all" || (t.year || "2026") === activeYearFilter)
      .filter(t => !activeSearch || t.name.toLowerCase().includes(activeSearch.toLowerCase()));
    if (filtered.length === 0) return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Trophy className="w-8 h-8 text-slate-200 mb-3" />
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No teams found</p>
      </div>
    );
    return (
      <div className="grid grid-cols-1 gap-3 px-4">
        {filtered.map((team, index) => (
          <motion.div key={team.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
            <Card
              className="border-none shadow-sm bg-white rounded-[1.75rem] overflow-hidden cursor-pointer active:scale-[0.98] transition-all"
              onClick={() => setRosterTeam(team)}
            >
              <CardContent className="p-0">
                <div className="p-4 flex items-center gap-4">
                  <DefaultAvatar src={teamLogos[team.id] || team.logo} name={team.name} size="lg" objectFit="contain" className="rounded-2xl shadow-sm border border-slate-100" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{team.year || "2026"}</span>
                    <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tight leading-tight">{team.name}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{team.coach}</p>
                  </div>
                </div>
                <div className="bg-slate-50/50 p-3 flex items-center justify-between border-t border-slate-100">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Team Code</p>
                    <code className="text-[11px] font-black tracking-[0.1em] text-slate-900">{team.joinCode || `GD-${team.id.toUpperCase().slice(0, 4)}`}</code>
                  </div>
                  <Button variant="ghost" size="sm"
                    onClick={() => copyToClipboard(team.joinCode || `GD-${team.id.toUpperCase().slice(0, 4)}`)}
                    className="h-8 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center gap-2 active:scale-95 transition-all px-3"
                  >
                    {copiedCode === (team.joinCode || `GD-${team.id.toUpperCase().slice(0, 4)}`) ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    );
  };

  const renderPastMembers = () => {
    const yearTeams   = pastYearFilter === "all" ? pastTeams : pastTeams.filter(t => (t.year || new Date(t.archivedAt).getFullYear().toString()) === pastYearFilter);
    const yearTeamIds = new Set(yearTeams.map(t => t.id));
    const filteredCoaches = pastCoachEntries
      .filter(c => yearTeamIds.has(c.teamId))
      .filter(c => !pastSearch || c.name.toLowerCase().includes(pastSearch.toLowerCase()));
    const filteredPlayers = ALL_PLAYERS
      .filter(p => p.teamIds.some(tid => yearTeamIds.has(tid)))
      .filter(p => !pastSearch || p.name.toLowerCase().includes(pastSearch.toLowerCase()));
    const seenCoachNames = new Set<string>();
    const uniqueCoaches  = filteredCoaches.filter(c => {
      if (seenCoachNames.has(c.name)) return false;
      seenCoachNames.add(c.name); return true;
    });
    return (
      <div className="space-y-3 px-4">
        {uniqueCoaches.length === 0 && filteredPlayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-8 h-8 text-slate-200 mb-3" />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No members found</p>
          </div>
        ) : (
          <>
            {uniqueCoaches.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 pt-1">Coaches · {uniqueCoaches.length}</p>
                {uniqueCoaches.map((c, i) => renderMemberCard(c.id, c.name, c.avatar, "Coach", c.teamName, c.teamName, true, i))}
              </div>
            )}
            {filteredPlayers.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 pt-2">Members · {filteredPlayers.length}</p>
                {filteredPlayers.map((p, i) => {
                  const playerTeam = pastTeams.find(t => p.teamIds.includes(t.id));
                  return renderMemberCard(p.id, p.name, p.avatar, p.position, p.position, playerTeam?.name || "—", false, uniqueCoaches.length + i);
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderPastTeams = () => {
    const filtered = pastTeams
      .filter(t => pastYearFilter === "all" || (t.year || new Date(t.archivedAt).getFullYear().toString()) === pastYearFilter)
      .filter(t => !pastSearch || t.name.toLowerCase().includes(pastSearch.toLowerCase()));
    if (filtered.length === 0) return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Clock className="w-8 h-8 text-slate-200 mb-3" />
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No teams found</p>
      </div>
    );
    return (
      <div className="grid grid-cols-1 gap-3 px-4">
        {filtered.map((team, index) => {
          const isArchived = team.status === 'archived';
          return (
            <motion.div key={team.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <Card 
                className={`border-none shadow-sm hover:shadow-md bg-white rounded-[1.75rem] overflow-hidden cursor-pointer active:scale-[0.98] transition-all ${isArchived ? 'opacity-70' : ''}`} 
                onClick={() => setSelectedTeam(team)}
              >
                <CardContent className="p-0">
                  <div className="p-4 flex items-center gap-4">
                    <DefaultAvatar 
                      src={teamLogos[team.id] || team.logo} 
                      name={team.name} 
                      size="lg" 
                      objectFit="contain" 
                      className="rounded-2xl shadow-sm border border-slate-100" 
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        {team.year || (team.archivedAt ? new Date(team.archivedAt).getFullYear().toString() : 'PAST')}
                      </span>
                      <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tight leading-tight">{team.name}</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{team.coach}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50/50 p-3 border-t border-slate-100">
                    <code className="text-[10px] font-black tracking-[0.1em] text-slate-400 uppercase">
                      {isArchived ? 'ARCHIVED' : 'PAST'}
                    </code>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    );
  };

  const renderSubTabs = (active: "members" | "teams", setActive: (v: "members" | "teams") => void) => (
    <div className="flex gap-2 px-4">
      {(["members", "teams"] as const).map(tab => (
        <button key={tab} onClick={() => setActive(tab)}
          className={`flex-1 h-9 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
            active === tab ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-400 hover:bg-slate-100 shadow-sm"
          }`}
        >
          {tab === "members"
            ? <Users  className={`w-3 h-3 ${active === tab ? "text-primary" : "text-slate-300"}`} />
            : <Trophy className={`w-3 h-3 ${active === tab ? "text-primary" : "text-slate-300"}`} />
          }
          {tab}
        </button>
      ))}
    </div>
  );

  const renderRosterModal = () => {
    if (!rosterTeam) return null;

    const coach = activeCoachEntries.find(c => c.teamId === rosterTeam.id);
    const players = ALL_PLAYERS
      .filter(p => p.teamIds.includes(rosterTeam.id))
      .filter(p => !removedMemberIds.has(p.id));

    const handleRemoveMember = (id: string) => {
      setRemovedMemberIds(prev => new Set([...prev, id]));
    };

    const MemberRow = ({
      id, name, avatar, detail, isCoach
    }: { id: string; name: string; avatar: string; detail: string; isCoach: boolean; key?: string }) => (
      <motion.div
        key={id}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 8 }}
        layout
        className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl"
      >
        <div className={isCoach ? "ring-2 ring-primary/40 rounded-xl flex-shrink-0" : "flex-shrink-0"}>
          <DefaultAvatar src={avatar} name={name} size="md" className="rounded-xl" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-black text-slate-900 uppercase italic truncate">{name}</p>
            {isCoach && (
              <span className="flex-shrink-0 text-[7px] font-black uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                Coach
              </span>
            )}
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{detail}</p>
        </div>
        <button
          onClick={() => handleRemoveMember(id)}
          className="flex-shrink-0 w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 active:scale-95 transition-all flex items-center justify-center"
        >
          <span className="text-red-400 font-black text-sm leading-none">−</span>
        </button>
      </motion.div>
    );

    return (
      <AnimatePresence>
        {rosterTeam && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setRosterTeam(null)}
          >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-sm max-h-[85vh] flex flex-col bg-white rounded-[2rem] shadow-2xl overflow-hidden relative"
                onClick={e => e.stopPropagation()}
              >
              {/* Dark header */}
              <div className="bg-slate-900 p-5 flex items-center gap-4 flex-shrink-0">
                <DefaultAvatar
                  src={teamLogos[rosterTeam.id] || rosterTeam.logo}
                  name={rosterTeam.name}
                  size="lg"
                  objectFit="contain"
                  className="rounded-xl border border-slate-700"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{rosterTeam.year || "2026"}</p>
                  <h2 className="text-base font-black text-white uppercase italic tracking-tight truncate">{rosterTeam.name}</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    {(coach ? 1 : 0) + players.length} members
                  </p>
                </div>
                <button
                  onClick={() => setRosterTeam(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center flex-shrink-0 active:scale-95 transition-all"
                >
                  <span className="text-slate-400 font-black text-sm leading-none">✕</span>
                </button>
              </div>

              {/* Scrollable roster */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {/* Coach section */}
                {coach && !removedMemberIds.has(coach.id) && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">
                      Coaching Staff · 1
                    </p>
                    <MemberRow
                      id={coach.id}
                      name={coach.name}
                      avatar={coach.avatar}
                      detail={coach.teamName}
                      isCoach={true}
                    />
                  </div>
                )}

                {/* Players section */}
                {players.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">
                      Squad · {players.length}
                    </p>
                    <AnimatePresence>
                      {players.map(p => (
                        <MemberRow
                          key={p.id}
                          id={p.id}
                          name={p.name}
                          avatar={p.avatar}
                          detail={p.position}
                          isCoach={false}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* Empty state */}
                {!coach && players.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Users className="w-8 h-8 text-slate-200 mb-3" />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No members</p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="p-4 border-t border-slate-100 flex-shrink-0 space-y-2">
                <button
                  onClick={() => {
                    localStorage.setItem('gameday_navigate_team', rosterTeam.id);
                    onTabChange?.('teams');
                    setRosterTeam(null);
                  }}
                  className="w-full h-11 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                >
                  View Full Team
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full h-11 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all border border-red-100"
                >
                  Delete Team
                </button>
              </div>

              {/* Delete confirmation overlay */}
              {showDeleteConfirm && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-[2rem] flex flex-col items-center justify-center p-6 text-center z-10">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                    <span className="text-red-400 text-xl">🗑</span>
                  </div>
                  <p className="text-sm font-black text-slate-900 uppercase italic mb-1">Delete {rosterTeam.name}?</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
                    This will remove the team from all profiles and cannot be undone.
                  </p>
                  <div className="w-full space-y-2">
                    <button
                      onClick={async () => {
                        await StorageService.deleteTeam(rosterTeam.id);
                        setShowDeleteConfirm(false);
                        setRosterTeam(null);
                      }}
                      className="w-full h-11 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="w-full h-11 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderTeamArchive = (team: any) => {
    const teamPlayers = ALL_PLAYERS.filter(p => p.teamIds.includes(team.id));
    const teamGames = [
      { id: "g1", opponent: "Eagles Utd", score: "2-1", result: "W", date: "Aug 12, 2023" },
      { id: "g2", opponent: "Titans SC",  score: "0-0", result: "D", date: "Aug 19, 2023" },
      { id: "g3", opponent: "Lions FC",   score: "1-3", result: "L", date: "Aug 26, 2023" },
    ];
    const teamSchedule = [
      { id: "s1", title: "Final Training", date: "Aug 24, 2023", time: "5:00 PM" },
      { id: "s2", title: "Season Awards",  date: "Sep 05, 2023", time: "7:00 PM" },
    ];
    const availableChats = [
      { id: "players",  name: "Players Chat",  messages: [
        { id: "c1", user: "Coach Sarah",   message: "Great season everyone! Proud of the effort.", time: "Sep 06, 2023" },
        { id: "c2", user: "Cody Johnson",  message: "Thanks Coach! See you all next year.",        time: "Sep 06, 2023" },
        { id: "c3", user: "Noah Williams", message: "Anyone found my left boot in the locker room?", time: "Sep 07, 2023" },
      ]},
      { id: "captains", name: "Captains Chat", messages: [
        { id: "cc1", user: "Noah Williams", message: "We need to talk about the team dinner logistics.", time: "Aug 30, 2023" },
        { id: "cc2", user: "Coach Sarah",   message: "I've booked the venue. Check your emails.",       time: "Aug 31, 2023" },
      ]},
      { id: "coaches",  name: "Coaches Chat",  messages: [
        { id: "co1", user: "Coach Sarah", message: "Reviewing the match tapes from last week.",         time: "Aug 27, 2023" },
        { id: "co2", user: "Mike Ross",   message: "The defensive line needs more work on set pieces.", time: "Aug 28, 2023" },
      ]},
    ];
    const currentChat = availableChats.find(c => c.id === archiveChatId) || availableChats[0];
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedTeam(null)} className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 px-2">
          <ChevronLeft className="w-4 h-4 mr-1" />Back to Teams
        </Button>
        <Card className="border-none shadow-lg bg-slate-900 text-white rounded-[2.5rem] overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <CardContent className="p-8 relative z-10">
            <div className="flex items-center gap-6">
              <DefaultAvatar src={team.logo} name={team.name} size="xl" objectFit="contain" className="rounded-3xl shadow-2xl border-2 border-slate-800" />
              <div className="space-y-1">
                <Badge variant="outline" className="text-[8px] font-bold border-slate-700 text-slate-400 uppercase tracking-widest">Season {team.year}</Badge>
                <h2 className="text-2xl font-black uppercase italic tracking-tight">{team.name}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Coach: {team.coach}</p>
                
                {team.clubId === MOCK_CLUB.id && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                    <div className="w-5 h-5 rounded-md bg-white p-0.5 flex items-center justify-center">
                      <img src={MOCK_CLUB.logo} alt={MOCK_CLUB.name} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">
                      Affiliated with {MOCK_CLUB.name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2"><Users className="w-4 h-4 text-primary" /><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Squad Members</h3></div>
          <div className="grid grid-cols-3 gap-3">
            {teamPlayers.map(player => (
              <Card key={player.id} className="border-none shadow-sm bg-white rounded-2xl p-2 flex flex-col items-center text-center space-y-2">
                <DefaultAvatar src={player.avatar} name={player.name} size="md" className="rounded-xl" />
                <div className="space-y-0.5">
                  <p className="text-[9px] font-black text-slate-900 uppercase italic leading-tight truncate w-full px-1">{player.name.split(" ")[0]}</p>
                  <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">{player.position}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2"><Trophy className="w-4 h-4 text-amber-500" /><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Match History</h3></div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {teamGames.map(game => (
              <Card key={game.id} className="border-none shadow-sm bg-white rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${game.result === "W" ? "bg-green-50 text-green-600" : game.result === "L" ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600"}`}>{game.result}</div>
                  <div><p className="text-[10px] font-black text-slate-900 uppercase">vs {game.opponent}</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{game.date}</p></div>
                </div>
                <span className="text-sm font-black italic text-slate-900">{game.score}</span>
              </Card>
            ))}
          </div>
        </section>
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2"><CalendarIcon className="w-4 h-4 text-blue-500" /><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Past Events</h3></div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {teamSchedule.map(event => (
              <Card key={event.id} className="border-none shadow-sm bg-white rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex flex-col items-center justify-center">
                  <span className="text-[8px] font-black text-primary uppercase">{event.date.split(" ")[0]}</span>
                  <span className="text-xs font-black text-slate-900">{event.date.split(" ")[1].replace(",", "")}</span>
                </div>
                <div><p className="text-[10px] font-black text-slate-900 uppercase">{event.title}</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{event.time}</p></div>
              </Card>
            ))}
          </div>
        </section>
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-purple-500" /><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Chat Archive</h3></div>
            <div className="relative">
              <select value={archiveChatId} onChange={e => setArchiveChatId(e.target.value)} className="appearance-none bg-slate-100 border-none rounded-xl px-4 py-2 pr-10 text-[10px] font-black uppercase tracking-widest text-slate-600 focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer">
                {availableChats.map(chat => <option key={chat.id} value={chat.id}>{chat.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
            <div className="p-4 space-y-4 max-h-[300px] overflow-y-auto bg-slate-50/50">
              {currentChat.messages.map(chat => (
                <div key={chat.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black text-primary uppercase tracking-widest">{chat.user}</span>
                    <span className="text-[7px] font-bold text-slate-400 uppercase">{chat.time}</span>
                  </div>
                  <div className="p-3 bg-white rounded-2xl rounded-tl-none shadow-sm border border-slate-100">
                    <p className="text-[11px] font-medium text-slate-700">{chat.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </motion.div>
    );
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      {renderRosterModal()}
      <div className="pt-6 pb-4 px-4 space-y-6">
        <div className="flex justify-between items-end px-2">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Karaka RFC</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Club Management Hub</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="px-4">
          <Button onClick={() => setIsCreating(true)} className="w-full h-14 rounded-2xl shadow-lg shadow-primary/20 font-black text-xs uppercase tracking-[0.2em] italic">
            <Plus className="w-4 h-4 mr-2" />Create New Team
          </Button>
        </div>

        <AnimatePresence>
          {isCreating && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
              <Card className="w-full max-w-sm border-none shadow-2xl bg-slate-900 rounded-[2rem] overflow-hidden">
                <CardHeader className="bg-slate-900 text-white p-6">
                  <CardTitle className="text-xl font-black uppercase italic tracking-tight">New Squad</CardTitle>
                  <CardDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Register a new team to your club</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Team Name</label>
                    <Input placeholder="e.g. Wildcats U15" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="h-12 bg-slate-50 border-none rounded-xl focus-visible:ring-primary text-[11px] font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sport</label>
                    <Input placeholder="e.g. Rugby" value={newTeamSport} onChange={e => setNewTeamSport(e.target.value)} className="h-12 bg-slate-50 border-none rounded-xl focus-visible:ring-primary text-[11px] font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Assign Coach</label>
                    <div className="relative">
                      <select value={selectedCoachId} onChange={e => setSelectedCoachId(e.target.value)} className="w-full h-12 bg-slate-50 border-none rounded-xl px-4 appearance-none text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer">
                        <option value="">Select a Coach…</option>
                        {coaches.map(coach => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="ghost" onClick={() => { setIsCreating(false); setNewTeamName(""); setNewTeamSport(""); setSelectedCoachId(""); }} className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400">Cancel</Button>
                    <Button onClick={handleCreateTeam} disabled={!newTeamName.trim() || !newTeamSport.trim() || !selectedCoachId} className="flex-1 h-12 rounded-xl shadow-lg shadow-primary/20 font-black text-[10px] uppercase tracking-widest disabled:opacity-50">Create Team</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {selectedTeam ? (
            <div className="px-4">{renderTeamArchive(selectedTeam)}</div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="grid grid-cols-3 gap-1 px-4">
                {(["dashboard", "active", "past"] as const).map(tab => {
                  const Icon  = tab === "dashboard" ? Activity : tab === "active" ? Trophy : Clock;
                  const label = tab === "dashboard" ? "Overview" : tab.charAt(0).toUpperCase() + tab.slice(1);
                  return (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`h-10 rounded-xl text-[8px] font-black uppercase tracking-tighter transition-all flex flex-col items-center justify-center gap-0.5 ${activeTab === tab ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "bg-white text-slate-400 hover:bg-slate-50"}`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${activeTab === tab ? "text-primary" : "text-slate-300"}`} />
                      {label}
                    </button>
                  );
                })}
              </div>

              {activeTab === "dashboard" && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="px-4 space-y-4">
                  {/* Join Requests */}
                  {pendingRequests.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-slate-900" />
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Join Requests</h3>
                        </div>
                        <div className="bg-primary text-white rounded-full text-[8px] font-black px-2 py-0.5">
                          {pendingRequests.length}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {pendingRequests.map(request => (
                          <Card key={request.id} className="border-none shadow-sm bg-white rounded-2xl overflow-hidden p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-black text-slate-900 uppercase italic truncate">{request.teamName}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Requested to join your club</p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const all = JSON.parse(localStorage.getItem('gameday_club_requests') || '[]');
                                    const idx = all.findIndex((r: any) => r.id === request.id);
                                    if (idx !== -1) {
                                      all[idx].status = 'approved';
                                      localStorage.setItem('gameday_club_requests', JSON.stringify(all));
                                      
                                      // Update custom teams
                                      const customTeams = JSON.parse(localStorage.getItem('gameday_custom_teams') || '[]');
                                      const customIdx = customTeams.findIndex((t: any) => t.id === request.teamId);
                                      if (customIdx !== -1) {
                                        customTeams[customIdx].clubId = MOCK_CLUB.id;
                                        localStorage.setItem('gameday_custom_teams', JSON.stringify(customTeams));
                                      }

                                      // Update standard teams (e.g. legacy or other custom)
                                      const teams = JSON.parse(localStorage.getItem('gameday_teams') || '[]');
                                      const teamIdx = teams.findIndex((t: any) => t.id === request.teamId);
                                      if (teamIdx !== -1) {
                                        teams[teamIdx].clubId = MOCK_CLUB.id;
                                        localStorage.setItem('gameday_teams', JSON.stringify(teams));
                                      }
                                      
                                      window.dispatchEvent(new Event('gameday_update'));
                                    }
                                  }}
                                  className="bg-green-500 hover:bg-green-600 text-white rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => {
                                    const all = JSON.parse(localStorage.getItem('gameday_club_requests') || '[]');
                                    const idx = all.findIndex((r: any) => r.id === request.id);
                                    if (idx !== -1) {
                                      all[idx].status = 'declined';
                                      localStorage.setItem('gameday_club_requests', JSON.stringify(all));
                                      window.dispatchEvent(new Event('gameday_update'));
                                    }
                                  }}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pb-4">
                    <Card className="border-none shadow-sm bg-white rounded-2xl p-4">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Members</p>
                      <div className="flex items-end justify-between">
                        <span className="text-2xl font-black italic text-slate-900">{ALL_PLAYERS.filter(p => p.teamIds.some(tid => teams.map(t => t.id).includes(tid))).length}</span>
                        <Users className="w-4 h-4 text-primary opacity-20" />
                      </div>
                    </Card>
                    <Card className="border-none shadow-sm bg-white rounded-2xl p-4">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Teams</p>
                      <div className="flex items-end justify-between">
                        <span className="text-2xl font-black italic text-slate-900">{teams.length}</span>
                        <Trophy className="w-4 h-4 text-amber-500 opacity-20" />
                      </div>
                    </Card>
                    <Card className="border-none shadow-sm bg-white rounded-2xl p-4">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Coaches</p>
                      <div className="flex items-end justify-between">
                        <span className="text-2xl font-black italic text-slate-900">{teams.length}</span>
                        <Activity className="w-4 h-4 text-blue-500 opacity-20" />
                      </div>
                    </Card>
                    <Card className="border-none shadow-sm bg-white rounded-2xl p-4">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Past Teams</p>
                      <div className="flex items-end justify-between">
                        <span className="text-2xl font-black italic text-slate-900">{PAST_TEAMS.length}</span>
                        <Clock className="w-4 h-4 text-slate-400 opacity-20" />
                      </div>
                    </Card>
                  </div>
                </motion.div>
              )}

              {activeTab === "active" && (
                <motion.div key="active-tab" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  {renderSubTabs(activeSub, setActiveSub)}
                  {renderSearchFilter(activeSearch, setActiveSearch, activeYearFilter, setActiveYearFilter, activeYears)}
                  <div className="pb-2">{activeSub === "members" ? renderActiveMembers() : renderActiveTeams()}</div>
                </motion.div>
              )}

              {activeTab === "past" && (
                <motion.div key="past-tab" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  {renderSubTabs(pastSub, setPastSub)}
                  {renderSearchFilter(pastSearch, setPastSearch, pastYearFilter, setPastYearFilter, pastYears)}
                  <div className="pb-2">{pastSub === "members" ? renderPastMembers() : renderPastTeams()}</div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                         z-[110] w-[90%] max-w-sm bg-white rounded-[2rem] shadow-2xl
                         overflow-hidden"
            >
              <div className="bg-slate-900 p-6 flex items-center justify-between">
                <h3 className="text-base font-black uppercase italic text-white leading-none">
                  DELETE TEAM
                </h3>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20
                             flex items-center justify-center text-white/60
                             hover:text-white transition-all"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <p className="text-sm font-medium text-slate-600 leading-relaxed">
                  This will permanently delete this team and remove it from all member profiles. This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 h-12 rounded-2xl border border-slate-200 bg-white text-slate-600
                               text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const teamToDelete = rosterTeam || selectedTeam;
                      if (teamToDelete) {
                        StorageService.deleteTeam(teamToDelete.id);
                        setShowDeleteModal(false);
                        setRosterTeam(null);
                        setSelectedTeam(null);
                        window.dispatchEvent(new Event('gameday_update'));
                        loadTeams();
                      }
                    }}
                    className="flex-1 h-12 rounded-2xl bg-red-500 text-white
                               text-[11px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                  >
                    Delete
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
