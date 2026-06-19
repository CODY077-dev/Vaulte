import React, { useState, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Calendar, MapPin, Clock, Trophy, ChevronRight, ChevronDown, Star, Trophy as TrophyIcon, Activity, Dribbble, CircleDot, Timer, Search, Bike, Waves, Target, Dumbbell, Flag, Navigation, X, PartyPopper } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import DefaultAvatar from "./DefaultAvatar";
import StorageService from "../services/StorageService";
import { openExternal } from "../utils/openExternal";

import { MOCK_TEAMS } from "../constants";
import { User } from "../types";

const MOCK_GAMES = [
  { 
    id: "1", 
    league: "Premier",
    homeTeam: "Karaka Premier", 
    homeTeamId: "1",
    awayTeam: "Pukekohe", 
    date: "Today", 
    time: "4:30 PM", 
    location: "Karaka Sports Park", 
    status: "upcoming",
    homeLogo: "https://picsum.photos/seed/karaka/100/100",
    awayLogo: "https://picsum.photos/seed/puke/100/100",
    sport: "Soccer",
    lineups: { 
      home: [
        "Cody Johnson (C)", 
        "Ben Smith", 
        "David Miller", 
        "James Williams", 
        "Robert Brown", 
        "Michael Davis", 
        "Thomas Wilson", 
        "Joseph Taylor", 
        "Richard Moore", 
        "Charles Anderson", 
        "Paul Martin (GK)"
      ], 
      away: [
        "Chris Evans", 
        "Mark Ruffalo", 
        "Jeremy Renner", 
        "Scarlett Johansson", 
        "Robert Downey", 
        "Chris Hemsworth", 
        "Tom Hiddleston", 
        "Anthony Mackie", 
        "Sebastian Stan", 
        "Paul Rudd", 
        "Tom Holland (GK)"
      ] 
    }
  },
  { 
    id: "2", 
    league: "Premier",
    homeTeam: "Thunder Basketball", 
    homeTeamId: "2",
    awayTeam: "Lions SC", 
    date: "Today", 
    time: "6:00 PM", 
    location: "North High", 
    status: "upcoming",
    homeLogo: "https://picsum.photos/seed/team3/100/100",
    awayLogo: "https://picsum.photos/seed/team4/100/100",
    sport: "Basketball",
    lineups: { home: [], away: [] }
  },
  { 
    id: "3", 
    league: "Junior Cup",
    homeTeam: "Red Sox Juniors", 
    homeTeamId: "3",
    awayTeam: "Blue Jays", 
    date: "Tomorrow", 
    time: "10:00 AM", 
    location: "Memorial", 
    status: "upcoming",
    homeLogo: "https://picsum.photos/seed/team5/100/100",
    awayLogo: "https://picsum.photos/seed/team6/100/100",
    sport: "Baseball",
    lineups: { home: [], away: [] }
  },
  { 
    id: "4", 
    league: "Junior Cup",
    homeTeam: "Strikers", 
    awayTeam: "Titans", 
    date: "Tomorrow", 
    time: "11:30 AM", 
    location: "Memorial", 
    status: "upcoming",
    homeLogo: "https://picsum.photos/seed/team7/100/100",
    awayLogo: "https://picsum.photos/seed/team8/100/100",
    sport: "Soccer",
    lineups: { home: [], away: [] }
  },
  { 
    id: "5", 
    league: "Premier",
    homeTeam: "Karaka Premier", 
    homeTeamId: "1",
    awayTeam: "Ardmore", 
    date: "Saturday 5th April", 
    time: "2:00 PM", 
    location: "Central Park", 
    status: "completed",
    score: { home: 27, away: 7 },
    homeLogo: "https://picsum.photos/seed/karaka/100/100",
    awayLogo: "https://picsum.photos/seed/ardmore/100/100",
    sport: "Soccer",
    lineups: { home: [], away: [] }
  },
  { 
    id: "6", 
    league: "Premier",
    homeTeam: "Thunder Basketball", 
    homeTeamId: "2",
    awayTeam: "Heat", 
    date: "Saturday 5th April", 
    time: "4:00 PM", 
    location: "North High", 
    status: "completed",
    score: { home: 88, away: 82 },
    homeLogo: "https://picsum.photos/seed/team3/100/100",
    awayLogo: "https://picsum.photos/seed/team10/100/100",
    sport: "Basketball",
    lineups: { home: [], away: [] }
  },
  { 
    id: "7", 
    league: "Premier",
    homeTeam: "Karaka Premier", 
    homeTeamId: "1",
    awayTeam: "Drury", 
    date: "Saturday 19th April", 
    time: "1:00 PM", 
    location: "Drury Complex", 
    status: "upcoming",
    homeLogo: "https://picsum.photos/seed/karaka/100/100",
    awayLogo: "https://picsum.photos/seed/drury/100/100",
    sport: "Soccer",
    lineups: { home: [], away: [] }
  },
  { 
    id: "8", 
    league: "Premier",
    homeTeam: "Karaka Premier", 
    homeTeamId: "1",
    awayTeam: "Manurewa", 
    date: "Saturday 26th April", 
    time: "3:30 PM", 
    location: "Karaka Sports Park", 
    status: "upcoming",
    homeLogo: "https://picsum.photos/seed/karaka/100/100",
    awayLogo: "https://picsum.photos/seed/manurewa/100/100",
    sport: "Soccer",
    lineups: { home: [], away: [] }
  },
  { 
    id: "9", 
    league: "Rugby Championship",
    homeTeam: "Steelers Elite", 
    homeTeamId: "4",
    awayTeam: "Counties RFC", 
    date: "Today", 
    time: "2:30 PM", 
    location: "Navigation Homes", 
    status: "upcoming",
    homeLogo: "https://picsum.photos/seed/rugby1/100/100",
    awayLogo: "https://picsum.photos/seed/rugby2/100/100",
    sport: "Rugby",
    lineups: { home: [], away: [] }
  },
  { 
    id: "10", 
    league: "Netball League",
    homeTeam: "Flyers", 
    homeTeamId: "5",
    awayTeam: "Storm", 
    date: "Tomorrow", 
    time: "1:00 PM", 
    location: "Bruce Pulman", 
    status: "upcoming",
    homeLogo: "https://picsum.photos/seed/netball1/100/100",
    awayLogo: "https://picsum.photos/seed/netball2/100/100",
    sport: "Netball",
    lineups: { home: [], away: [] }
  },
  { 
    id: "11", 
    league: "Volleyball Div 1",
    homeTeam: "Swift Warriors", 
    awayTeam: "Spiking Souls", 
    date: "Saturday 19th April", 
    time: "11:00 AM", 
    location: "Arena 1", 
    status: "upcoming",
    homeLogo: "https://picsum.photos/seed/vball1/100/100",
    awayLogo: "https://picsum.photos/seed/vball2/100/100",
    sport: "Volleyball",
    lineups: { home: [], away: [] }
  }
];

const MOCK_SPORTS = [
  { name: "Athletics", icon: Activity },
  { name: "Baseball", icon: CircleDot },
  { name: "Basketball", icon: Dribbble },
  { name: "Cricket", icon: Target },
  { name: "Cycling", icon: Bike },
  { name: "Football", icon: Activity },
  { name: "Golf", icon: Target },
  { name: "Hockey", icon: Activity },
  { name: "Netball", icon: Dribbble },
  { name: "Rugby League", icon: Timer },
  { name: "Rugby Union", icon: Timer },
  { name: "Softball", icon: CircleDot },
  { name: "Surfing", icon: Waves },
  { name: "Swimming", icon: Waves },
  { name: "Tennis", icon: CircleDot },
  { name: "Touch Rugby", icon: Timer },
  { name: "Volleyball", icon: Dribbble },
  { name: "Water Polo", icon: Waves },
].sort((a, b) => a.name.localeCompare(b.name));

const MOCK_FAV_TEAMS = [
  { name: "Wildcats FC", sport: "Soccer", logo: "https://picsum.photos/seed/team1/100/100" },
  { name: "Thunder", sport: "Basketball", logo: "https://picsum.photos/seed/team3/100/100" },
];

const MOCK_COMPETITIONS = [
  { 
    name: "U13 South Auckland Division", 
    teams: ["Wildcats FC", "South Auckland Utd", "Manukau City", "Papatoetoe AFC", "Otahuhu Utd"],
    icon: TrophyIcon
  }
];

const MOCK_STANDINGS: Record<string, any[]> = {
  "U13 South Auckland Division": [
    { team: "South Auckland Utd", played: 12, won: 9, drawn: 2, lost: 1, points: 29 },
    { team: "Wildcats FC", played: 12, won: 8, drawn: 3, lost: 1, points: 27 },
    { team: "Manukau City", played: 12, won: 6, drawn: 2, lost: 4, points: 20 },
    { team: "Papatoetoe AFC", played: 12, won: 4, drawn: 1, lost: 7, points: 13 },
    { team: "Otahuhu Utd", played: 12, won: 2, drawn: 0, lost: 10, points: 6 },
  ]
};

const MOCK_COMPETITION_DETAILS = {
  name: "U13 South Auckland Division",
  rounds: [
    {
      number: 1,
      status: "completed",
      games: [
        { home: "South Auckland Utd", away: "Manukau City", score: "2 - 1", location: "Central Park" },
        { home: "Papatoetoe AFC", away: "Otahuhu Utd", score: "0 - 3", location: "Memorial Park" }
      ]
    },
    {
      number: 2,
      status: "completed",
      games: [
        { home: "South Auckland Utd", away: "Papatoetoe AFC", score: "1 - 1", location: "South Park" },
        { home: "Manukau City", away: "Otahuhu Utd", score: "4 - 2", location: "North High" }
      ]
    },
    {
      number: 3,
      status: "upcoming",
      games: [
        { home: "Otahuhu Utd", away: "South Auckland Utd", time: "Sat 10:00 AM", location: "Memorial Park" },
        { home: "Manukau City", away: "Papatoetoe AFC", time: "Sat 11:30 AM", location: "Central Park" }
      ]
    },
    {
      number: 4,
      status: "upcoming",
      games: [
        { home: "South Auckland Utd", away: "Manukau City", time: "Apr 18, 10:00 AM", location: "South Park" },
        { home: "Papatoetoe AFC", away: "Otahuhu Utd", time: "Apr 18, 11:30 AM", location: "North High" }
      ]
    }
  ]
};

type ViewType = "my-games" | "favourites" | "sport";

const getShortLocation = (location: string | undefined): string => {
  if (!location) return '';
  // Take the part before the first comma
  const beforeComma = location.split(',')[0].trim();
  // If still long (more than 2 words), only show the first 2 words
  const words = beforeComma.split(/\s+/);
  if (words.length > 2) return words.slice(0, 2).join(' ');
  return beforeComma;
};

interface GamesProps {
  user: User | null;
}

export default function Games({ user }: GamesProps) {
  const isCoach = user?.role === 'coach' || user?.role === 'club' || user?.role === 'manager' ||
    (user?.teamIds || []).some(tid =>
      localStorage.getItem(`gameday_role_${user?.id}_${tid}`) === 'coach'
    );

  const [locationModalEvent, setLocationModalEvent] = useState<any>(null);
  const [teamLogos, setTeamLogos] = useState<Record<string, string>>({});
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [activeView, setActiveView] = useState<ViewType>("my-games");
  const [gameFilter, setGameFilter] = useState<"upcoming" | "today" | "finished">("today");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [pendingDeleteGameId, setPendingDeleteGameId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const toggleDate = (dateKey: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      next.has(dateKey) ? next.delete(dateKey) : next.add(dateKey);
      return next;
    });
  };
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [sportSearch, setSportSearch] = useState("");
  const [selectedGame, setSelectedGame] = useState<typeof MOCK_GAMES[0] | null>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<typeof MOCK_COMPETITIONS[0] | null>(null);
  const [realMatchEvents, setRealMatchEvents] = useState<any[]>([]);
  const [realCustomEvents, setRealCustomEvents] = useState<any[]>([]);
  const [expandedCompetitions, setExpandedCompetitions] = useState<Record<string, boolean>>({});
  const [scoreInputGame, setScoreInputGame] = useState<any>(null);
  const [scoreHome, setScoreHome] = useState('');
  const [scoreAway, setScoreAway] = useState('');
  const [savedScores, setSavedScores] = useState<Record<string, { home: number; away: number }>>({});

  const toggleCompetition = (name: string) => {
    setExpandedCompetitions(prev => ({ ...prev, [name]: !prev[name] }));
  };

  useEffect(() => {
    const loadData = () => {
      const logos: Record<string, string> = {};
      const names: Record<string, string> = {};
      const stored = StorageService.getCustomTeams();
      const legacyStored = StorageService.getTeams();
      
      [...MOCK_TEAMS, ...stored, ...legacyStored].forEach(t => {
        const savedLogo = StorageService.getTeamLogo(t.id);
        if (savedLogo) logos[t.id] = savedLogo;
        else if (t.logo) logos[t.id] = t.logo;
        const savedName = localStorage.getItem(`gameday_team_name_${t.id}`);
        if (savedName) names[t.id] = savedName;
      });
      setTeamLogos(logos);
      setTeamNames(names);

      const allEvents = StorageService.getEvents();
      setRealMatchEvents(allEvents.filter((e: any) => e.type === 'match'));
      setRealCustomEvents(allEvents.filter((e: any) => e.type === 'custom' || e.type === 'event'));
    };
    loadData();
    window.addEventListener('gameday_update', loadData);
    return () => window.removeEventListener('gameday_update', loadData);
  }, []);

  const filteredSports = MOCK_SPORTS.filter(sport => 
    sport.name.toLowerCase().includes(sportSearch.toLowerCase())
  );

  const parseGameDate = (dateStr: string): Date => {
    const currentYear = new Date().getFullYear();
    if (dateStr === "Today") return new Date();
    if (dateStr === "Tomorrow") { const d = new Date(); d.setDate(d.getDate() + 1); return d; }
    if (dateStr === "Saturday 12th April") return new Date(currentYear, 3, 12);
    if (dateStr === "Sunday 13th April") return new Date(currentYear, 3, 13);
    const months: Record<string, number> = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
    };
    const match = dateStr.match(/(\d+)(?:st|nd|rd|th)\s+(\w+)/);
    if (match) {
      const day = parseInt(match[1]);
      const month = months[match[2]];
      if (month !== undefined) return new Date(currentYear, month, day);
    }
    return new Date();
  };

  const parseStoredDate = (dateStr: string): Date => {
    if (!dateStr) return new Date(0);
    // DD/MM/YYYY
    const dmy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    // YYYY-MM-DD
    const ymd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
    // Legacy: "Wednesday, May 6" or "Saturday, Apr 12"
    const months: Record<string, number> = {
      Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,
      Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11,
      January:0,February:1,March:2,April:3,June:5,
      July:6,August:7,September:8,October:9,November:10,December:11
    };
    const legacy = dateStr.match(/(\w+)\s+(\d{1,2})(?:,?\s*(\d{4}))?$/);
    if (legacy) {
      const monthNum = months[legacy[1]];
      const day = parseInt(legacy[2]);
      const year = legacy[3] ? parseInt(legacy[3]) : new Date().getFullYear();
      if (monthNum !== undefined && !isNaN(day)) {
        return new Date(year, monthNum, day);
      }
    }
    return new Date(0);
  };

  const formatStoredTime = (timeStr: string): string => {
    if (!timeStr) return '';
    // HH:MM 24h → 12h
    const hhmm = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
      const h = parseInt(hhmm[1]);
      const m = hhmm[2];
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:${m} ${ampm}`;
    }
    // Already contains AM/PM — strip any accidental double suffix
    if (/AM|PM/i.test(timeStr)) {
      return timeStr.replace(/^(\d{1,2}:\d{2}\s*(?:AM|PM))\s*(?:AM|PM)\s*$/i, '$1').trim();
    }
    return timeStr;
  };

  const formatStoredDate = (dateStr: string): string => {
    const d = parseStoredDate(dateStr);
    if (!d || d.getTime() === 0) return dateStr;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const suffix = (n: number) => ['th','st','nd','rd'][(n > 3 && n < 21) || n % 10 > 3 ? 0 : n % 10] || 'th';
    return `${days[d.getDay()]} ${d.getDate()}${suffix(d.getDate())} ${months[d.getMonth()]}`;
  };

  const TODAY = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

  const renderClubGames = () => {
    // Get all teams the user belongs to (custom + mock)
    const customTeams = StorageService.getCustomTeams();
    const legacyTeams = StorageService.getTeams();
    const allMyTeamIds = [...(user?.teamIds || [])];
    const allMyTeamNames = [
      ...MOCK_TEAMS.filter(t => allMyTeamIds.includes(t.id)).map(t => t.name),
      ...customTeams.filter((t: any) => allMyTeamIds.includes(t.id)).map((t: any) => t.name),
      ...legacyTeams.filter((t: any) => allMyTeamIds.includes(t.id)).map((t: any) => t.name),
    ];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Map real match events into display objects
    const myGames = realMatchEvents
      .filter((e: any) => {
        // Include if this event belongs to one of the user's teams
        return allMyTeamIds.includes(e.teamId) || allMyTeamNames.some(n => e.homeTeam === n || e.title?.includes(n));
      })
      .map((e: any) => {
        const eventDate = parseStoredDate(e.date);
        const isPast = eventDate < now;
        const isToday = eventDate.getTime() === now.getTime();
        // Try to parse awayTeam from title like "Vs Pukekohe" or "vs Pukekohe"
        const vsMatch = e.title?.match(/[Vv]s\.?\s+(.+)/);
        const allTeams = [...MOCK_TEAMS, ...customTeams, ...legacyTeams];
        const matchedTeam = allTeams.find((t: any) => t.id === e.teamId);
        const rawHomeName = matchedTeam?.name || e.teamName || e.homeTeam || 'Unknown Team';
        const homeTeam = (e.teamId && teamNames[e.teamId]) || rawHomeName;
        const awayTeam = e.opponent || e.title || (vsMatch ? vsMatch[1].trim() : '') || e.awayTeam || 'TBC';
        return {
          id: e.id,
          league: e.league || '',
          homeTeam,
          homeTeamId: e.teamId || '',
          awayTeam,
          date: formatStoredDate(e.date),
          rawDate: eventDate,
          time: formatStoredTime(e.time || ''),
          location: e.location || '',
          status: isPast ? 'completed' : isToday ? 'live' : 'upcoming',
          homeLogo: '',
          awayLogo: '',
          sport: e.sport || '',
          lineups: { home: [], away: [] },
        };
      });

    // Map custom events (club events like "End of Season Awards") — show all
    const myEvents = realCustomEvents
      .filter((e: any) => allMyTeamIds.includes(e.teamId))
      .map((e: any) => {
        const eventDate = parseStoredDate(e.date);
        const isPast = eventDate < now;
        const isToday = eventDate.getTime() === now.getTime();
        const allTeams = [...MOCK_TEAMS, ...customTeams, ...legacyTeams];
        const matchedTeam = allTeams.find((t: any) => t.id === e.teamId);
        return {
          id: e.id,
          league: '',
          homeTeam: (e.teamId && teamNames[e.teamId]) || matchedTeam?.name || 'Club',
          homeTeamId: e.teamId || '',
          awayTeam: '',
          title: e.title || 'Event',
          date: formatStoredDate(e.date),
          rawDate: eventDate,
          time: formatStoredTime(e.time || ''),
          location: e.pinLocation?.label || e.location || '',
          pinLocation: e.pinLocation || null,
          status: isPast ? 'completed' : isToday ? 'live' : 'upcoming',
          homeLogo: '',
          awayLogo: '',
          sport: '',
          notes: e.notes || '',
          lineups: { home: [], away: [] },
          isEvent: true,
        };
      });

    const validGames = myGames.filter(g => g.rawDate.getTime() !== 0 && g.date !== 'Invalid Date' && g.date !== '');
    const validEvents = myEvents.filter(g => g.rawDate.getTime() !== 0 && g.date !== 'Invalid Date' && g.date !== '');
    const myGamesFiltered = [...validGames, ...validEvents];

    if (myGamesFiltered.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-8">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">No Games Yet</p>
          <p className="text-[10px] text-slate-400 text-center">Match events and club events will appear here.</p>
        </div>
      );
    }

    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

    const todayGame = myGamesFiltered.find(g => g.rawDate.getTime() === todayStart.getTime());

    const parseTime12 = (t: string): number => {
      const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!m) return 0;
      let h = parseInt(m[1]);
      const min = parseInt(m[2]);
      if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
      if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
      return h * 60 + min;
    };

    const gamesToShow = gameFilter === 'today'
      ? myGamesFiltered.filter(g => g.rawDate.getTime() === todayStart.getTime())
      : gameFilter === 'upcoming'
        ? myGamesFiltered.filter(g => g.status === 'upcoming' || g.status === 'live')
        : myGamesFiltered.filter(g => g.status === 'completed');

    // Sort games by time within each group
    const sortedGamesToShow = [...gamesToShow].sort((a, b) => {
      const dateDiff = (a.rawDate?.getTime() ?? 0) - (b.rawDate?.getTime() ?? 0);
      if (dateDiff !== 0) return dateDiff;
      return parseTime12(a.time) - parseTime12(b.time);
    });

    // Group by date label
    const gamesByDate: Record<string, typeof myGamesFiltered> = {};
    sortedGamesToShow.forEach(game => {
      const key = game.date;
      if (!gamesByDate[key]) gamesByDate[key] = [];
      gamesByDate[key].push(game);
    });

    // Sort date groups chronologically
    const sortedDates = Object.keys(gamesByDate).sort(
      (a, b) => (gamesByDate[a][0]?.rawDate?.getTime() ?? 0) - (gamesByDate[b][0]?.rawDate?.getTime() ?? 0)
    );

    const autoExpandKey = sortedDates.length > 0 ? sortedDates[0] : null;

    const isExpanded = (dateKey: string) => {
      if (dateKey === autoExpandKey) return true;
      return expandedDates.has(dateKey);
    };

    const initials = (name: string) => name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

    const renderGameCard = (game: typeof myGamesFiltered[0]) => {
      const homeLogo = (game.homeTeamId && teamLogos[game.homeTeamId]) || game.homeLogo || '';
      const isCompleted = game.status === 'completed';
      const isToday = game.rawDate?.getTime() === todayStart.getTime();

      return (
        <div
          key={game.id}
          className="bg-white rounded-2xl p-4 shadow-sm mx-4 mb-3 cursor-pointer active:scale-[0.99] transition-all relative"
          onClick={() => setSelectedGame(game as any)}
        >
          {/* Spacer for top padding */}
          <div className="mb-1" />

          {/* Teams row: home | score/vs | away */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {/* Home */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                {homeLogo
                  ? <img src={homeLogo} alt={game.homeTeam} className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <span className="text-[10px] font-black text-slate-400">{initials(game.homeTeam)}</span>
                }
              </div>
              <span className="text-[11px] font-black uppercase tracking-tight text-slate-900 truncate">{game.homeTeam}</span>
            </div>

            {/* Score or VS */}
            <div className="text-center">
              {savedScores[game.id] ? (
                <p className="text-[20px] font-black text-slate-900 tracking-tight tabular-nums leading-none">
                  {savedScores[game.id].home}<span className="text-slate-300 mx-0.5">·</span>{savedScores[game.id].away}
                </p>
              ) : (game as any).score ? (
                <p className="text-[20px] font-black text-slate-900 tracking-tight tabular-nums leading-none">
                  {(game as any).score.home}<span className="text-slate-300 mx-0.5">·</span>{(game as any).score.away}
                </p>
              ) : isCompleted && isCoach && gameFilter === 'finished' ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setScoreInputGame(game); setScoreHome(''); setScoreAway(''); }}
                  className="text-[11px] font-black text-primary uppercase tracking-wider active:scale-95 transition-all"
                >
                  Score?
                </button>
              ) : isCompleted && !isCoach ? (
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.16em]">TBD</p>
              ) : (
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.16em]">vs</p>
              )}
            </div>

            {/* Away */}
            <div className="flex items-center gap-2 justify-end">
              <span className="text-[11px] font-black uppercase tracking-tight text-slate-900 truncate text-right">{game.awayTeam}</span>
              <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                <span className="text-[10px] font-black text-slate-400">{initials(game.awayTeam)}</span>
              </div>
            </div>
          </div>

          {/* Footer: date/time + location */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-[0.16em]">
            <span className="flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              {game.date} · {game.time}
            </span>
            {game.location ? (
              <button
                onClick={e => { e.stopPropagation(); setLocationModalEvent(game); }}
                className="flex items-center gap-1 text-primary active:scale-[0.98] transition-all"
              >
                <MapPin className="w-2.5 h-2.5" />
                {getShortLocation(game.location)}
              </button>
            ) : null}
          </div>

          {/* Edit-mode delete button */}
          {isEditMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPendingDeleteGameId(game.id);
              }}
              className="absolute top-1/2 -translate-y-1/2 right-2 w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-all active:scale-95 z-10"
            >
              <span className="text-red-500 text-lg font-black leading-none">−</span>
            </button>
          )}
        </div>
      );
    };

    const renderEventCard = (event: typeof myGamesFiltered[0]) => {
      const isCompleted = event.status === 'completed';
      const isToday = event.rawDate?.getTime() === todayStart.getTime();
      const ev = event as any;

      return (
        <div
          key={event.id}
          className="mx-4 mb-3 rounded-[22px] overflow-hidden cursor-pointer active:scale-[0.99] transition-all relative"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
          onClick={() => setSelectedGame(event as any)}
        >
          {/* Glow accent */}
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-20 blur-2xl" style={{ background: 'oklch(0.55 0.18 272)' }} />

          <div className="relative p-4">
            {/* Status + type row */}
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.12em] ${
                isToday && !isCompleted ? 'bg-emerald-500/20 text-emerald-400' : isCompleted ? 'bg-white/10 text-white/50' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {isToday && !isCompleted && (
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                    <span className="relative rounded-full w-1.5 h-1.5 bg-emerald-500" />
                  </span>
                )}
                {isToday && !isCompleted ? 'Today' : isCompleted ? 'Finished' : 'Upcoming'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.12em] bg-white/10 text-white/50 border border-white/10">
                <PartyPopper className="w-2.5 h-2.5" />
                Event
              </span>
            </div>

            {/* Event title */}
            <h3 className="text-[18px] font-black text-white uppercase italic tracking-tight leading-tight">
              {ev.title || event.homeTeam}
            </h3>
            {ev.title && event.homeTeam && (
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.18em] mt-1.5">{event.homeTeam}</p>
            )}

            {/* Details footer */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[9px] font-bold text-white/50 uppercase tracking-[0.16em]">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-2.5 h-2.5" />
                {event.date} · {event.time}
              </span>
              {event.location ? (
                <button
                  onClick={e => { e.stopPropagation(); setLocationModalEvent(event); }}
                  className="flex items-center gap-1 text-white/70 active:scale-[0.98] transition-all"
                >
                  <MapPin className="w-2.5 h-2.5" />
                  {getShortLocation(event.location)}
                </button>
              ) : null}
            </div>
          </div>

          {/* Edit-mode delete button */}
          {isEditMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPendingDeleteGameId(event.id);
              }}
              className="absolute top-1/2 -translate-y-1/2 right-2 w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-all active:scale-95 z-10"
            >
              <span className="text-red-500 text-lg font-black leading-none">−</span>
            </button>
          )}
        </div>
      );
    };

    return (
      <div className="flex flex-col">
        {sortedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8">
            <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">
              No Games
            </p>
            <p className="text-[10px] text-slate-400 text-center">
              Match events created by your coach will appear here.
            </p>
          </div>
        ) : (
          sortedDates.map(dateKey => (
            <div key={dateKey} className="mb-1">
              <button
                className="w-full flex items-center justify-between px-6 py-3 transition-all"
                onClick={() => {
                  if (dateKey === autoExpandKey) return;
                  setExpandedDates(prev => {
                    const next = new Set(prev);
                    next.has(dateKey) ? next.delete(dateKey) : next.add(dateKey);
                    return next;
                  });
                }}
              >
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.18em] truncate flex-1 min-w-0 text-left">{dateKey}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[13px] font-black text-primary tabular-nums">
                    {gamesByDate[dateKey].length}
                  </span>
                  {dateKey !== autoExpandKey && (
                    isExpanded(dateKey)
                      ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
              </button>
              <AnimatePresence initial={false}>
                {isExpanded(dateKey) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    {gamesByDate[dateKey].map(game => (game as any).isEvent ? renderEventCard(game) : renderGameCard(game))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderGameDetail = (game: typeof MOCK_GAMES[0]) => (
    <motion.div 
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="fixed inset-0 bg-slate-50 z-[60] overflow-y-auto pb-24"
    >
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setSelectedGame(null)} className="rounded-full hover:bg-slate-100">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-tight">{game.league}</h2>
        </div>
        {/* LIVE badge removed */}

      </div>

      {/* Scoreboard */}
      <div className="p-8 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_70%)]" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="text-center flex-1">
            <div className="relative inline-block mb-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center shadow-sm">
                <img
                  src={(game.homeTeamId && teamLogos[game.homeTeamId]) || game.homeLogo}
                  alt={game.homeTeam}
                  className="w-full h-full object-contain p-0.5"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                <div className="w-3 h-3 rounded-full bg-primary" />
              </div>
            </div>
            <h3 className="text-xs font-black uppercase tracking-tight leading-tight text-center break-words w-full px-1">
              {game.homeTeamId ? (teamNames[game.homeTeamId] || game.homeTeam) : game.homeTeam}
            </h3>
          </div>
          
          <div className="text-center px-4">
            <div className="flex items-center justify-center gap-4 mb-2">
              <span className={`text-5xl font-black italic tracking-tighter ${game.status === 'live' ? 'text-red-500' : 'text-white'}`}>
                {game.score?.home ?? 0}
              </span>
              <span className="text-2xl font-black text-slate-700">:</span>
              <span className={`text-5xl font-black italic tracking-tighter ${game.status === 'live' ? 'text-red-500' : 'text-white'}`}>
                {game.score?.away ?? 0}
              </span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700/50">
              <Clock className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{game.time}</span>
            </div>
          </div>

          <div className="text-center flex-1">
            <div className="relative inline-block mb-3">
              <DefaultAvatar src={game.awayLogo} name={game.awayTeam} size="xl" className="rounded-2xl shadow-2xl border-2 border-slate-800" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-tight leading-tight text-center break-words w-full px-1">
              {(game as any).awayTeamId ? (teamNames[(game as any).awayTeamId] || game.awayTeam) : game.awayTeam}
            </h3>
          </div>
        </div>
      </div>

      {/* Details Content */}
      <div className="p-4 space-y-6">
        {/* Match Info */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              if ((game as any).pinLocation || game.location) {
                setLocationModalEvent(game);
              }
            }}
            className="border-none shadow-sm bg-white p-4 flex items-center gap-3 w-full text-left active:scale-[0.98] transition-all"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Location</p>
              <p className="text-[10px] font-black text-slate-900 uppercase">{getShortLocation(game.location)}</p>
              {((game as any).pinLocation || game.location) && (
                <span className="text-[7px] font-bold text-primary uppercase tracking-widest mt-0.5 block">Tap for map</span>
              )}
            </div>
          </button>
          <Card className="border-none shadow-sm bg-white p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Date</p>
              <p className="text-[10px] font-black text-slate-900 uppercase">{game.date}</p>
            </div>
          </Card>
        </div>
        {(game as any).notes && (
          <div className="px-4 py-3 bg-slate-50 rounded-xl mt-2">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</p>
            <p className="text-xs font-medium text-slate-700">{(game as any).notes}</p>
          </div>
        )}

        {/* Lineups Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Team Lineups</h2>
            <Badge variant="outline" className="text-[8px] font-bold border-slate-200">STARTING XI</Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Home Lineup */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center shadow-sm">
                  <img
                    src={(game.homeTeamId && teamLogos[game.homeTeamId]) || game.homeLogo}
                    alt={game.homeTeam}
                    className="w-full h-full object-contain p-0.5"
                  />
                </div>
                <span className="text-[10px] font-black text-slate-900 uppercase leading-tight break-words flex-1 px-1">
                  {game.homeTeamId ? (teamNames[game.homeTeamId] || game.homeTeam) : game.homeTeam}
                </span>
              </div>
              {game.lineups?.home.map((player, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-3 bg-white rounded-xl shadow-xs flex items-center gap-3 border border-slate-50"
                >
                  <div className="w-5 h-5 rounded-lg bg-slate-50 flex items-center justify-center text-[9px] font-bold text-slate-400">
                    {i + 1}
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 truncate">{player}</span>
                </motion.div>
              ))}
            </div>

            {/* Away Lineup */}
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-2 mb-3 px-1">
                <span className="text-[10px] font-black text-slate-900 uppercase leading-tight break-words flex-1 px-1 text-right">
                  {(game as any).awayTeamId ? (teamNames[(game as any).awayTeamId] || game.awayTeam) : game.awayTeam}
                </span>
                <DefaultAvatar src={(game as any).awayTeamId && teamLogos[(game as any).awayTeamId] || game.awayLogo} name={(game as any).awayTeamId ? (teamNames[(game as any).awayTeamId] || game.awayTeam) : game.awayTeam} size="sm" className="rounded-sm" />
              </div>
              {game.lineups?.away.map((player, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-3 bg-white rounded-xl shadow-xs flex items-center gap-3 flex-row-reverse border border-slate-50"
                >
                  <div className="w-5 h-5 rounded-lg bg-slate-50 flex items-center justify-center text-[9px] font-bold text-slate-400">
                    {i + 1}
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 truncate text-right">{player}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );

  const renderCompetitionDetail = (comp: typeof MOCK_COMPETITIONS[0]) => (
    <motion.div 
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="fixed inset-0 bg-slate-50 z-[60] overflow-y-auto pb-24"
    >
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-4 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => setSelectedCompetition(null)} className="rounded-full hover:bg-slate-100">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-tight">{comp.name}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Competition Details</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {MOCK_COMPETITION_DETAILS.rounds.map((round) => (
          <section key={round.number} className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Round {round.number}</h3>
              <Badge variant="outline" className={`text-[8px] font-bold border-none ${round.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                {round.status.toUpperCase()}
              </Badge>
            </div>
            
            <div className="space-y-2">
              {round.games.map((game, i) => (
                <Card key={i} className="border-none shadow-sm bg-white p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                        <DefaultAvatar name={game.home} size="md" className="rounded-lg shadow-sm" />
                        <p className="text-xs font-black uppercase italic text-slate-900 text-center leading-tight break-words w-full px-1">
                          {game.home}
                        </p>
                      </div>
                      
                      <div className="px-3 py-1 rounded-lg bg-slate-900 text-white min-w-[70px] text-center">
                        <span className="text-[10px] font-black italic">
                          {round.status === 'completed' ? game.score : game.time}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                        <DefaultAvatar name={game.away} size="md" className="rounded-lg shadow-sm" />
                        <p className="text-xs font-black uppercase italic text-slate-900 text-center leading-tight break-words w-full px-1">
                          {game.away}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if ((game as any).pinLocation || (game as any).location) {
                          setLocationModalEvent(game);
                        }
                      }}
                      className="flex items-center justify-center gap-1 text-slate-400 active:scale-[0.98] transition-all"
                    >
                      <MapPin className="w-3 h-3" />
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] font-bold uppercase tracking-widest">{getShortLocation((game as any).location)}</span>
                        {((game as any).pinLocation || (game as any).location) && (
                          <span className="text-[6px] font-bold text-primary uppercase tracking-widest block">Tap for map</span>
                        )}
                      </div>
                    </button>
                    {(game as any).pinLocation && (
                      <div className="flex justify-center mt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openExternal(`https://www.google.com/maps/dir/?api=1&destination=${(game as any).pinLocation.lat},${(game as any).pinLocation.lng}`); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary/20 transition-colors"
                        >
                          <MapPin className="w-3 h-3" />
                          Get Directions
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </motion.div>
  );

  const renderFavourites = () => (
    <div className="space-y-8">
      {/* Games Grid (Original Layout) */}
      <div className="grid grid-cols-2 gap-3">
        {MOCK_GAMES.map((game, index) => (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card 
              className="border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-all cursor-pointer group relative"
              onClick={() => setSelectedGame(game)}
            >
              <div className="absolute top-0 left-0 right-0 h-1 flex">
                <div className={`h-full transition-all duration-500 ${game.status === 'live' ? 'w-full bg-red-500' : 'w-0 bg-primary'}`} />
              </div>
              <CardContent className="p-3 relative">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest truncate max-w-[60px]">
                    {game.league}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">{game.date}</span>

                </div>
                <div className="py-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1 flex-col">
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center shadow-sm">
                        <img
                          src={(game.homeTeamId && teamLogos[game.homeTeamId]) || game.homeLogo}
                          alt={game.homeTeam}
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-900 leading-tight break-words text-center w-full px-1">
                        {game.homeTeamId ? (teamNames[game.homeTeamId] || game.homeTeam) : game.homeTeam}
                      </span>
                    </div>
                    {game.score && <span className="text-xs font-black text-slate-900">{game.score.home}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1 flex-col">
                      <DefaultAvatar src={(game as any).awayTeamId && teamLogos[(game as any).awayTeamId] || game.awayLogo} name={(game as any).awayTeamId ? (teamNames[(game as any).awayTeamId] || game.awayTeam) : game.awayTeam} size="md" className="rounded-md shadow-sm" />
                      <span className="text-[11px] font-bold text-slate-900 leading-tight break-words text-center w-full px-1">
                        {(game as any).awayTeamId ? (teamNames[(game as any).awayTeamId] || game.awayTeam) : game.awayTeam}
                      </span>
                    </div>
                    {game.score && <span className="text-xs font-black text-slate-900">{game.score.away}</span>}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase">
                      <Clock className="w-2.5 h-2.5" />
                      {game.time}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if ((game as any).pinLocation || game.location) {
                          setLocationModalEvent(game);
                        }
                      }}
                      className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase mt-0.5 active:scale-[0.98] transition-all"
                    >
                      <MapPin className="w-2.5 h-2.5" />
                      <div className="flex flex-col text-left">
                        <span className="truncate max-w-[50px]">{getShortLocation(game.location)}</span>
                        {((game as any).pinLocation || game.location) && (
                          <span className="text-[6px] font-bold text-primary uppercase tracking-widest block">Tap for map</span>
                        )}
                      </div>
                    </button>
                    {(game as any).pinLocation && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openExternal(`https://www.google.com/maps/dir/?api=1&destination=${(game as any).pinLocation.lat},${(game as any).pinLocation.lng}`); }}
                        className="inline-flex items-center gap-1 mt-1.5 px-2 py-1 bg-primary/10 text-primary rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-primary/20 transition-colors"
                      >
                        <MapPin className="w-2 h-2" />
                        Directions
                      </button>
                    )}
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-primary" />
                  </div>
                </div>

                {/* Edit-mode delete button */}
                {isEditMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteGameId(game.id);
                    }}
                    className="absolute top-1/2 -translate-y-1/2 right-2 w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-all active:scale-95 z-10"
                  >
                    <span className="text-red-500 text-lg font-black leading-none">−</span>
                  </button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Favourite Competitions Section */}
      <section>
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2 px-2">
          Favourite Competitions
        </h2>
        <div className="space-y-3">
          {MOCK_COMPETITIONS.map((comp, index) => (
            <motion.div
              key={comp.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="border-none shadow-sm bg-white overflow-hidden cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
                onClick={() => setSelectedCompetition(comp)}
              >
                <div className="bg-slate-900 p-3 flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-wider">{comp.name}</h3>
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                </div>
                <CardContent className="p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {comp.teams.map((team) => (
                      <div key={team} className="flex flex-col items-center gap-2 p-2 rounded-lg bg-slate-50">
                        <DefaultAvatar name={team} size="sm" className="rounded-sm" />
                        <span className="text-[9px] font-bold text-slate-700 leading-tight break-words text-center w-full px-1">{team}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Match of the Week Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative rounded-3xl overflow-hidden bg-slate-900 p-6 text-white shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/20 rounded-full blur-3xl -mr-24 -mt-24" />
        <div className="relative z-10">
          <Badge className="bg-primary text-[10px] font-black mb-4 border-none">MATCH OF THE WEEK</Badge>
          <div className="flex items-center justify-between gap-4">
            <div className="text-center flex-1 min-w-0">
              <img src="https://picsum.photos/seed/t1/100/100" className="w-12 h-12 rounded-2xl mx-auto mb-2 shadow-lg" alt="" referrerPolicy="no-referrer" />
              <p className="text-xs font-black uppercase tracking-tight leading-tight break-words w-full px-1">Wildcats</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black italic text-primary">VS</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">SAT 18:00</p>
            </div>
            <div className="text-center flex-1 min-w-0">
              <img src="https://picsum.photos/seed/t2/100/100" className="w-12 h-12 rounded-2xl mx-auto mb-2 shadow-lg" alt="" referrerPolicy="no-referrer" />
              <p className="text-xs font-black uppercase tracking-tight leading-tight break-words w-full px-1">Eagles</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );

  const renderSport = () => {
    if (selectedSport) {
      const filteredGames = MOCK_GAMES.filter(g => g.sport === selectedSport);
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedSport(null)}
              className="text-primary font-bold text-[10px] uppercase tracking-widest p-0 h-auto hover:bg-transparent"
            >
              <ChevronRight className="w-3 h-3 rotate-180 mr-1" />
              Back to Sports
            </Button>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">{selectedSport} Games</h2>
          </div>
          {filteredGames.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {filteredGames.map((game, index) => (
                <motion.div key={game.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }}>
                  <Card 
                    className="border-none shadow-sm overflow-hidden bg-white relative cursor-pointer hover:shadow-md transition-all"
                    onClick={() => setSelectedGame(game)}
                  >
                    <CardContent className="p-3 relative">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[8px] font-black text-slate-300 uppercase truncate">{game.league}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">{game.date}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-col items-center gap-2 min-w-0">
                          <p className="text-[10px] font-bold text-slate-900 leading-tight break-words text-center w-full px-1">{game.homeTeamId ? (teamNames[game.homeTeamId] || game.homeTeam) : game.homeTeam}</p>
                          {game.score && <span className="text-[10px] font-black">{game.score.home}</span>}
                        </div>
                        <div className="flex flex-col items-center gap-2 min-w-0">
                          <p className="text-[10px] font-bold text-slate-900 leading-tight break-words text-center w-full px-1">{(game as any).awayTeamId ? (teamNames[(game as any).awayTeamId] || game.awayTeam) : game.awayTeam}</p>
                          {game.score && <span className="text-[10px] font-black">{game.score.away}</span>}
                        </div>
                      </div>

                      {/* Edit-mode delete button */}
                      {isEditMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteGameId(game.id);
                          }}
                          className="absolute top-1/2 -translate-y-1/2 right-2 w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-all active:scale-95 z-10"
                        >
                          <span className="text-red-500 text-lg font-black leading-none">−</span>
                        </button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400 text-xs font-bold uppercase">No games found for {selectedSport}</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="relative px-2">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search sports..." 
            value={sportSearch}
            onChange={(e) => setSportSearch(e.target.value)}
            className="pl-10 h-10 bg-white border-none rounded-xl shadow-sm focus-visible:ring-primary text-xs"
          />
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {filteredSports.map((sport, index) => {
            const Icon = sport.icon;
            return (
              <motion.div
                key={sport.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
              >
                <Card 
                  className="border-none shadow-sm bg-white p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md transition-all group aspect-square"
                  onClick={() => setSelectedSport(sport.name)}
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center mb-2 group-hover:bg-primary/10 transition-colors">
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="text-[8px] font-black text-slate-900 uppercase tracking-tight leading-tight">{sport.name}</h3>
                </Card>
              </motion.div>
            );
          })}
        </div>
        {filteredSports.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400 text-[10px] font-bold uppercase">No sports found matching "{sportSearch}"</p>
          </div>
        )}
      </div>
    );
  };

  return (
      <div className="bg-white min-h-full pb-24">
      {/* Header Section */}
      <div className="pt-6 pb-4 px-4 space-y-5">
        <div className="flex items-end justify-between px-2">
          <div>
            <h1 className="text-[26px] font-black text-slate-900 uppercase italic leading-none tracking-tight">Games</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.24em] mt-1">Match Day Central</p>
          </div>
          {isCoach && (
            <button
              onClick={() => setIsEditMode(prev => !prev)}
              className="w-11 h-11 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-500 active:scale-95 transition-all"
            >
              {isEditMode ? <X className="w-4 h-4" /> : <span className="text-[9px] font-black uppercase">Edit</span>}
            </button>
          )}
        </div>

        {/* Filter tabs — pill bar */}
        {activeView === "my-games" && (
          <div className="flex gap-1 bg-white rounded-full p-1 shadow-sm">
            {(['today', 'upcoming', 'finished'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setGameFilter(tab)}
                className={`flex-1 py-2.5 rounded-full text-[9px] font-black uppercase tracking-[0.18em] transition-colors ${
                  gameFilter === tab ? 'bg-primary text-white' : 'text-slate-400'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="">
        <AnimatePresence mode="wait">
          {selectedGame ? (
            renderGameDetail(selectedGame)
          ) : selectedCompetition ? (
            renderCompetitionDetail(selectedCompetition)
          ) : (
            <motion.div
              key={activeView + (selectedSport || "")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeView === "my-games" && renderClubGames()}
              {activeView === "favourites" && renderFavourites()}
              {activeView === "sport" && renderSport()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
                         backdrop-blur-sm z-[70]"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, 
                            stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 
                         -translate-y-1/2 z-[80] w-[92%] max-w-sm 
                         bg-white rounded-[2rem] shadow-2xl 
                         overflow-hidden"
            >
              {/* Header */}
              <div className="bg-slate-900 p-5 flex items-center 
                              justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-xl 
                                 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 
                                 uppercase tracking-widest">
                      Game Location
                    </p>
                    <p className="text-sm font-black uppercase italic 
                                 text-white leading-tight">
                      {locationModalEvent.homeTeamId ? (teamNames[locationModalEvent.homeTeamId] || locationModalEvent.homeTeam) : locationModalEvent.homeTeam} vs {(locationModalEvent as any).awayTeamId ? (teamNames[(locationModalEvent as any).awayTeamId] || locationModalEvent.awayTeam) : locationModalEvent.awayTeam}
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
              <div className="relative w-full h-48 bg-slate-100 overflow-hidden">
                <iframe
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  src={
                    locationModalEvent.pinLocation
                      ? `https://maps.google.com/maps?q=${locationModalEvent.pinLocation.lat},${locationModalEvent.pinLocation.lng}&z=16&output=embed`
                      : `https://maps.google.com/maps?q=${encodeURIComponent(
                          locationModalEvent.pinLocation?.label || locationModalEvent.location || ''
                        )}&z=15&output=embed`
                  }
                />
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white/60 to-transparent pointer-events-none" />
              </div>

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

                {/* Maps choice */}
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-3">Open in Maps</p>
                  
                  <button
                    onClick={() => { setLocationModalEvent(null); openExternal(locationModalEvent.pinLocation ? `https://maps.apple.com/?daddr=${locationModalEvent.pinLocation.lat},${locationModalEvent.pinLocation.lng}` : `https://maps.apple.com/?q=${encodeURIComponent(locationModalEvent.location || '')}`); }}
                    className="flex items-center justify-center gap-2 w-full h-12 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                  >
                    <Navigation className="w-4 h-4" />
                    Apple Maps
                  </button>

                  <button
                    onClick={() => { setLocationModalEvent(null); openExternal(locationModalEvent.pinLocation ? `https://www.google.com/maps/dir/?api=1&destination=${locationModalEvent.pinLocation.lat},${locationModalEvent.pinLocation.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationModalEvent.location || '')}`); }}
                    className="flex items-center justify-center gap-2 w-full h-12 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                  >
                    <MapPin className="w-4 h-4" />
                    Google Maps
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Game Modal */}
      <AnimatePresence>
        {pendingDeleteGameId && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPendingDeleteGameId(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70]"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] w-[88%] max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              {/* Dark header */}
              <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Delete Game</h2>
                <button
                  onClick={() => setPendingDeleteGameId(null)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                <p className="text-[13px] font-bold text-slate-600 leading-relaxed">
                  Are you sure you want to delete this game? This cannot be undone.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setPendingDeleteGameId(null)}
                    className="flex-1 h-12 rounded-2xl bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-widest transition-all hover:bg-slate-200 active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (pendingDeleteGameId) {
                        StorageService.deleteEvent(pendingDeleteGameId);
                        window.dispatchEvent(new Event('gameday_update'));
                        setPendingDeleteGameId(null);
                      }
                    }}
                    className="flex-1 h-12 rounded-2xl bg-red-500 text-white text-[11px] font-black uppercase tracking-widest transition-all hover:bg-red-600 active:scale-[0.98] shadow-lg shadow-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Score Input Modal */}
      <AnimatePresence>
        {scoreInputGame && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[200]"
              onClick={() => setScoreInputGame(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[210] w-[92%] max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-6 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-white text-sm font-black uppercase tracking-widest">Final Score</h3>
                  <p className="text-white/50 text-[9px] font-bold uppercase tracking-[0.2em] mt-1">Enter the match result</p>
                </div>
                <button onClick={() => setScoreInputGame(null)} className="text-white/70 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                      <span className="text-[11px] font-black text-slate-500">
                        {scoreInputGame.homeTeam?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    <p className="text-[9px] font-black text-slate-700 uppercase tracking-wider text-center leading-tight">{scoreInputGame.homeTeam}</p>
                    <input
                      type="number"
                      min="0"
                      value={scoreHome}
                      onChange={(e) => setScoreHome(e.target.value)}
                      className="w-16 h-14 text-center text-2xl font-black text-slate-900 bg-slate-50 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                      style={{ fontSize: 24 }}
                      placeholder="0"
                    />
                  </div>
                  <span className="text-slate-300 text-xl font-black mt-8">·</span>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                      <span className="text-[11px] font-black text-slate-500">
                        {scoreInputGame.awayTeam?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    <p className="text-[9px] font-black text-slate-700 uppercase tracking-wider text-center leading-tight">{scoreInputGame.awayTeam}</p>
                    <input
                      type="number"
                      min="0"
                      value={scoreAway}
                      onChange={(e) => setScoreAway(e.target.value)}
                      className="w-16 h-14 text-center text-2xl font-black text-slate-900 bg-slate-50 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                      style={{ fontSize: 24 }}
                      placeholder="0"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    const h = parseInt(scoreHome) || 0;
                    const a = parseInt(scoreAway) || 0;
                    setSavedScores(prev => ({ ...prev, [scoreInputGame.id]: { home: h, away: a } }));
                    setScoreInputGame(null);
                  }}
                  disabled={scoreHome === '' && scoreAway === ''}
                  className="w-full h-12 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  Save Score
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

