export type UserRole = "supporter" | "coach" | "player" | "manager" | "club";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  roles?: Record<string, string>;
  avatar?: string;
  email?: string;
  phone?: string;
  position?: string;
  teamIds: string[];
  clubId?: string;
  linkedPlayerName?: string;
  linkedPlayerAge?: number;
  linkedPlayerNumber?: string;
  linkedPlayerPosition?: string;
  linkedTeamId?: string;
  children?: string[];
}

export interface Team {
  id: string;
  name: string;
  sport: string;
  logo: string;
  coach: string;
  unreadCount?: number;
  clubId?: string;
}

export interface Club {
  id: string;
  name: string;
  logo: string;
  adminId: string;
  joinCode: string;
}

export interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  location: string;
  score?: {
    home: number;
    away: number;
  };
  status: "upcoming" | "live" | "finished";
}

export interface Message {
  id: string;
  teamId: string;
  channelId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  userAvatar?: string;
  subRole?: 'coach' | 'manager' | null;
  text: string;
  isAudio?: boolean;
  timestamp: string;
}
