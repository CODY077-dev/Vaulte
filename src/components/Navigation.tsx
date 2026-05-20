import React from "react";
import { Users, MessageSquare, Calendar, Home, Trophy } from "lucide-react";
import { cn } from "../lib/utils";
import { User as UserType } from "../types";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  user: UserType | null;
}

export default function Navigation({ activeTab, onTabChange, user }: NavigationProps) {
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
              <Icon
                className={cn(
                  "w-5 h-5 transition-all duration-200",
                  isActive ? "text-white" : "text-white/40"
                )}
              />
              <span
                className={cn(
                  "text-[8px] font-black uppercase tracking-wider leading-none transition-all duration-200",
                  isActive ? "text-white" : "text-white/40"
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
