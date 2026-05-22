import React from "react";
import { Users, MessageSquare, Calendar, Home, Trophy } from "lucide-react";
import { cn } from "../lib/utils";
import { User as UserType } from "../types";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  user: UserType | null;
  chatUnreadCount?: number;
}

export default function Navigation({ activeTab, onTabChange, user, chatUnreadCount = 0 }: NavigationProps) {
  const allTabs = [
    { id: "home",     label: "Home",     icon: Home,         roles: ["supporter", "coach", "player", "manager", "club"] },
    { id: "teams",    label: "Teams",    icon: Users,        roles: ["coach", "player", "manager", "club"] },
    { id: "schedule", label: "Schedule", icon: Calendar,     roles: ["supporter", "coach", "player", "manager", "club"] },
    { id: "chat",     label: "Chat",     icon: MessageSquare,roles: ["supporter", "coach", "player", "manager", "club"] },
    { id: "games",    label: "Games",    icon: Trophy,       roles: ["supporter", "coach", "player", "manager", "club"] },
  ];

  const tabs = allTabs.filter(tab => !user || tab.roles.includes(user.role));

  return (
    <div className="fixed bottom-5 left-0 right-0 flex justify-center z-50 px-4 pointer-events-none">
      <nav className="pointer-events-auto bg-primary backdrop-blur-md rounded-full px-1.5 py-1.5 flex items-center gap-0.5 shadow-2xl shadow-black/40 w-full max-w-sm justify-between">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-full transition-all duration-200 flex-1",
                isActive
                  ? "bg-primary/80 backdrop-blur-sm border border-primary"
                  : "hover:bg-white/5 active:bg-white/10"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "w-5 h-5 transition-all duration-200",
                    isActive ? "text-white" : "text-slate-400"
                  )}
                />
                {tab.id === 'chat' && chatUnreadCount > 0 && !isActive && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center border-2 border-primary">
                    {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[8px] font-black uppercase tracking-wider leading-none transition-all duration-200",
                  isActive ? "text-white" : "text-slate-400"
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
