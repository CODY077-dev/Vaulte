/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserRole, User } from "./types";
import Login from "./components/Login";
import Navigation from "./components/Navigation";
import Teams from "./components/Teams";
import Chat from "./components/Chat";
import Games from "./components/Games";
import Schedule from "./components/Schedule";
import Profile from "./components/Profile";
import Home from "./components/Home";
import ClubTeams from "./components/ClubTeams";
import SupporterHome from "./components/SupporterHome";
import { AnimatePresence, motion } from "motion/react";
import StorageService from "./services/StorageService";
import { MOCK_LINEUP } from "./constants";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("home");
  const [memberRoles, setMemberRoles] = useState<Record<string, 'coach' | 'manager' | null>>({});
  const [forceTeamsView, setForceTeamsView] = useState(false);
  const [viewUserId, setViewUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          let userDocSnap = await getDoc(userDocRef);

          // If no Firestore doc, create a minimal one from localStorage fallback
          if (!userDocSnap.exists()) {
            const localUser = JSON.parse(localStorage.getItem('gameday_user') || '{}');
            const minimalDoc = {
              id: firebaseUser.uid,
              name: localUser.name || firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: localUser.role || 'player',
              roles: localUser.roles || {},
              teamIds: localUser.teamIds || [],
              createdAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, minimalDoc);
            userDocSnap = await getDoc(userDocRef);
          }

          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            console.log('Firestore restore — user data:', {
              id: firebaseUser.uid,
              teamIds: data.teamIds,
              roles: data.roles,
            });
            const appUser: User = {
              id: firebaseUser.uid,
              name: data.name || firebaseUser.displayName || 'User',
              email: firebaseUser.email || undefined,
              role: data.role,
              roles: data.roles || {},
              avatar: data.avatar || undefined,
              teamIds: (() => {
                const firestoreIds: string[] = data.teamIds || [];
                // Also pick up any role keys saved locally for this user
                const localIds: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key?.startsWith(`gameday_role_${firebaseUser.uid}_`)) {
                    const teamId = key.replace(`gameday_role_${firebaseUser.uid}_`, '');
                    localIds.push(teamId);
                  }
                }
                return [...new Set([...firestoreIds, ...localIds])];
              })(),
              clubId: data.clubId || undefined,
            };
            setUser(appUser);
            setIsLoggedIn(true);
            setActiveTab("home");
            localStorage.setItem('gameday_user', JSON.stringify(appUser));
            StorageService.updateUserData(appUser.id, appUser);

            // Hydrate user from Firestore on load (Fix 3)
            try {
              const { db } = await import('./firebase');
              const { doc, getDoc } = await import('firebase/firestore');
              const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (snap.exists()) {
                const firestoreData = snap.data();
                const merged = { ...appUser, ...firestoreData };
                setUser(merged);
                localStorage.setItem('gameday_user', JSON.stringify(merged));
              }
            } catch (e) {
              console.warn('Firestore user hydration failed:', e);
            }

            // Build full list of team IDs: Firestore + any local role keys
            const localTeamIds: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k?.startsWith(`gameday_role_${firebaseUser.uid}_`)) {
                localTeamIds.push(k.replace(`gameday_role_${firebaseUser.uid}_`, ''));
              }
            }
            const allTeamIds = [...new Set([...(data.teamIds || []), ...localTeamIds])];

            // Restore teams from Firestore
            if (allTeamIds.length > 0) {
              const teamPromises = allTeamIds.map((teamId: string) =>
                getDoc(doc(db, 'teams', teamId))
              );
              const teamDocs = await Promise.all(teamPromises);
              const firestoreTeams = teamDocs
                .filter(d => d.exists())
                .map(d => d.data());

              // Save teams back to localStorage
              if (firestoreTeams.length > 0) {
                const existingCustom = JSON.parse(localStorage.getItem('gameday_custom_teams') || '[]');
                const merged = [
                  ...firestoreTeams,
                  ...existingCustom.filter((t: any) => !firestoreTeams.find((ft: any) => ft.id === t.id))
                ];
                localStorage.setItem('gameday_custom_teams', JSON.stringify(merged));
              }

              // Restore role keys from Firestore roles map
              if (data.roles && typeof data.roles === 'object') {
                Object.entries(data.roles).forEach(([teamId, role]) => {
                  if (typeof role === 'string' && teamId !== appUser.role) {
                    localStorage.setItem(`gameday_role_${appUser.id}_${teamId}`, role as string);
                  }
                });
              }

              // Restore team members
              const memberPromises = allTeamIds.map((teamId: string) =>
                getDoc(doc(db, 'teamMembers', teamId))
              );
              const memberDocs = await Promise.all(memberPromises);
              memberDocs.forEach((d, index) => {
                if (d.exists()) {
                  const memberData = d.data();
                  if (memberData) {
                    const teamId = allTeamIds[index];
                    // Merge array-format members + any map-format entries (from old join flow)
                    const arrayMembers: any[] = Array.isArray(memberData.members)
                      ? memberData.members : [];
                    const mapMembers: any[] = Object.entries(memberData)
                      .filter(([k]) => k !== 'teamId' && k !== 'members')
                      .map(([, v]) => v)
                      .filter((v: any) => v && typeof v === 'object' && v.id);
                    const allIds = new Set(arrayMembers.map((m: any) => m.id));
                    const membersArray = [
                      ...arrayMembers,
                      ...mapMembers.filter((m: any) => !allIds.has(m.id))
                    ];
                    localStorage.setItem(`gameday_team_members_${teamId}`, JSON.stringify(membersArray));
                  }
                }
              });

              // Hydrate events, announcements & attendance from Firestore + subscribe to real-time updates
              StorageService.hydrateAll(allTeamIds).catch(e =>
                console.warn('Firestore hydration failed:', e)
              );

              // Hydrate children from Firestore
              StorageService.hydrateChildren(appUser.id).catch(e =>
                console.warn('Children hydration failed:', e)
              );
            }
          }
        } else {
          StorageService.teardownListeners();
          setUser(null);
          setIsLoggedIn(false);
          localStorage.removeItem('gameday_user');
        }
      } catch (err) {
        console.error("Auth state change error:", err);
      }
    });
    return () => unsubscribe();
  }, []);

  // One-time cleanup of custom teams
  useEffect(() => {
    const cleanupKey = 'gameday_cleanup_20260426';
    if (!localStorage.getItem(cleanupKey)) {
      try {
        const teamsStr = localStorage.getItem('gameday_custom_teams');
        if (teamsStr) {
          const teams = JSON.parse(teamsStr);
          const filtered = teams.filter((t: any) => 
            t.name && 
            !t.name.toLowerCase().includes('u13') && 
            !t.name.toLowerCase().includes('u8') && 
            !t.name.toLowerCase().includes('test')
          );
          localStorage.setItem('gameday_custom_teams', JSON.stringify(filtered));
          window.dispatchEvent(new Event('gameday_update'));
        }
        localStorage.setItem(cleanupKey, 'true');
      } catch (e) {
        console.error('Cleanup failed:', e);
      }
    }
  }, []);

  // One-time cleanup: Remove Johnny Simon from Karaka Prems roster
  useEffect(() => {
    const teamId = "1";
    try {
      const members = JSON.parse(localStorage.getItem(`gameday_team_members_${teamId}`) || '[]');
      const filtered = members.filter((m: any) => m.name !== 'Johnny Simon');
      if (members.length !== filtered.length) {
        localStorage.setItem(`gameday_team_members_${teamId}`, JSON.stringify(filtered));
        window.dispatchEvent(new Event('gameday_update'));
      }
    } catch (e) {
      console.error('Johnny Simon removal failed:', e);
    }
  }, []);

  // Remove TEST team from all storage
  useEffect(() => {
    const cleanupKey = 'gameday_cleanup_test_team_20260429';
    if (!localStorage.getItem(cleanupKey)) {
      try {
        const custom = JSON.parse(localStorage.getItem('gameday_custom_teams') || '[]');
        const legacy = JSON.parse(localStorage.getItem('gameday_teams') || '[]');
        const testId = [...custom, ...legacy].find(t => t.name === 'TEST')?.id;
        
        if (testId) {
          localStorage.setItem('gameday_custom_teams', JSON.stringify(custom.filter((t: any) => t.name !== 'TEST')));
          localStorage.setItem('gameday_teams', JSON.stringify(legacy.filter((t: any) => t.name !== 'TEST')));
          localStorage.removeItem(`gameday_team_members_${testId}`);
          localStorage.removeItem(`gameday_team_logo_${testId}`);
          Object.keys(localStorage).filter(k => k.endsWith(`_${testId}`)).forEach(k => localStorage.removeItem(k));
          
          // Strip from all user profiles
          Object.keys(localStorage).filter(k => k.startsWith('gameday_user')).forEach(k => {
            const u = JSON.parse(localStorage.getItem(k) || '{}');
            if (u.teamIds?.includes(testId)) {
              u.teamIds = u.teamIds.filter((id: string) => id !== testId);
              localStorage.setItem(k, JSON.stringify(u));
            }
          });
          window.dispatchEvent(new Event('gameday_update'));
        }
        localStorage.setItem(cleanupKey, 'true');
      } catch (e) {
        console.error('TEST cleanup failed:', e);
      }
    }
  }, []);

  useEffect(() => {
    // One-time dedup: only runs once per browser session
    const dedupKey = 'gameday_dedup_20260501';
    if (localStorage.getItem(dedupKey)) return;
    localStorage.setItem(dedupKey, 'true');
    const raw = localStorage.getItem('gameday_custom_teams');
    if (raw) {
      const teams = JSON.parse(raw);
      const seen = new Set<string>();
      const cleaned = teams.filter((t: any) => {
        const key = (t.name || '').toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (cleaned.length !== teams.length) {
        localStorage.setItem('gameday_custom_teams', JSON.stringify(cleaned));
        window.dispatchEvent(new Event('gameday_update'));
      }
    }
  }, []);

  const handleLogin = (user: User) => {
    setUser(user);
    setIsLoggedIn(true);
    localStorage.setItem('gameday_user', JSON.stringify(user));
    StorageService.updateUserData(user.id, user);
    setActiveTab("home");
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsLoggedIn(false);
    setUser(null);
    // Only clear user session — preserve teams and role keys for restore
    localStorage.removeItem('gameday_user');
    // Clear per-user profile caches but keep team data intact
    Object.keys(localStorage)
      .filter(k => k.startsWith('gameday_user_'))
      .forEach(k => localStorage.removeItem(k));
  };

  const handleUpdateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem("gameday_user", JSON.stringify(updatedUser));
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  const handleTabChange = (tab: string, viewId?: string) => {
    setActiveTab(tab);
    setViewUserId(viewId || null);
    // If navigating to teams from club and we have a target team, allow the detour
    if (tab === 'teams' && localStorage.getItem('gameday_navigate_team')) {
      setForceTeamsView(true);
    } else if (tab !== 'teams') {
      setForceTeamsView(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        if (user?.role === "supporter") return <SupporterHome user={user} onTabChange={handleTabChange} />;
        return <Home user={user} onTabChange={handleTabChange} />;
      case "teams":
        // For club admins, if they have a team navigation pending, show the Teams component instead of ClubTeams
        if (user?.role === "club" && !forceTeamsView) {
          return <ClubTeams user={user} onUpdateUser={handleUpdateUser} onTabChange={handleTabChange} />;
        }
        return <Teams user={user} memberRoles={memberRoles} setMemberRoles={setMemberRoles} onTabChange={handleTabChange} onUpdateUser={handleUpdateUser} />;
      case "chat":
        return user ? <Chat user={user} memberRoles={memberRoles} /> : null;
      case "schedule":
        return <Schedule user={user} onTabChange={handleTabChange} />;
      case "games":
        return <Games user={user} />;
      case "profile":
        if (!user) return null;
        let profileUser = user;
        if (viewUserId && viewUserId !== user.id) {
          const stored = StorageService.getUserData(viewUserId);
          const mock = MOCK_LINEUP.find(p => p.id === viewUserId);
          if (stored || mock) {
            profileUser = {
              id: viewUserId,
              name: stored?.name || mock?.name || "Member",
              role: (stored?.role as UserRole) || "player",
              avatar: stored?.avatar || undefined,
              teamIds: stored?.teamIds || [],
              linkedPlayerNumber: stored?.linkedPlayerNumber || mock?.number,
              linkedPlayerPosition: stored?.linkedPlayerPosition || mock?.position,
            } as User;
          }
        }
        return <Profile 
          user={profileUser} 
          onLogout={handleLogout} 
          onBack={() => {
            if (viewUserId) {
              setViewUserId(null);
              setActiveTab("home");
            } else {
              setActiveTab("home");
            }
          }} 
          onUpdateUser={handleUpdateUser} 
          isViewingSelf={profileUser.id === user.id}
        />;
      default:
        return <Home user={user} onTabChange={handleTabChange} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      <main className="max-w-md mx-auto min-h-screen bg-white shadow-2xl relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
        
        <Navigation activeTab={activeTab} onTabChange={handleTabChange} user={user} />
      </main>
    </div>
  );
}

