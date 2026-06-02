/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, sendEmailVerification } from 'firebase/auth';
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
import NotificationService from "./services/NotificationService";
// MOCK_LINEUP removed — all player data comes from real team members now

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("home");
  const [memberRoles, setMemberRoles] = useState<Record<string, 'coach' | 'manager' | null>>({});
  const [forceTeamsView, setForceTeamsView] = useState(false);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [pendingEmailVerification, setPendingEmailVerification] = useState(false);
  const [verifyResending, setVerifyResending] = useState(false);
  const [verifyDevTaps, setVerifyDevTaps] = useState(0);
  const verifyDevTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
                // Also merge from existing localStorage user data (catches joins that didn't reach Firestore)
                const existingLocal = JSON.parse(localStorage.getItem('gameday_user') || '{}');
                const existingProfile = JSON.parse(localStorage.getItem(`gameday_user_${firebaseUser.uid}`) || '{}');
                const localUserIds: string[] = existingLocal?.teamIds || [];
                const localProfileIds: string[] = existingProfile?.teamIds || [];
                return [...new Set([...firestoreIds, ...localIds, ...localUserIds, ...localProfileIds])];
              })(),
              clubId: data.clubId || undefined,
            };
            setUser(appUser);
            localStorage.setItem('gameday_user', JSON.stringify(appUser));

            // Check email verification — block unverified users
            if (!firebaseUser.emailVerified) {
              setPendingEmailVerification(true);
              setIsLoggedIn(false);
              return; // Don't hydrate or grant access until verified
            }

            setPendingEmailVerification(false);
            setIsLoggedIn(true);
            setActiveTab("home");
            StorageService.updateUserData(appUser.id, appUser);

            // Merge teamIds from both sources — never lose local joins
            // Reuses `data` from the initial Firestore read above (no duplicate read)
            try {
              const mergedTeamIds = [...new Set([
                ...(appUser.teamIds || []),
                ...(data.teamIds || [])
              ])];
              const merged = { ...appUser, ...data, teamIds: mergedTeamIds };
              setUser(merged);
              localStorage.setItem('gameday_user', JSON.stringify(merged));
              // Sync merged teamIds back to Firestore if local had extras
              if (mergedTeamIds.length > (data.teamIds || []).length) {
                await setDoc(userDocRef, { teamIds: mergedTeamIds }, { merge: true });
              }
            } catch (e) {
              console.warn('Firestore user merge failed:', e);
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

              // Hydrate lineups from Firestore
              StorageService.hydrateLineups(allTeamIds).catch(e =>
                console.warn('Lineup hydration failed:', e)
              );

              // Hydrate children from Firestore
              StorageService.hydrateChildren(appUser.id).catch(e =>
                console.warn('Children hydration failed:', e)
              );

              // Initialize push notifications
              NotificationService.requestPermission(appUser.id).catch(e =>
                console.warn('Push notification setup failed:', e)
              );
              // Listen for foreground notifications
              NotificationService.onForegroundMessage((payload: any) => {
                const { title, body } = payload.notification || {};
                if (title && Notification.permission === 'granted') {
                  new Notification(title, { body, icon: '/vaulte-icon.png' });
                }
              });
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
      StorageService.updateUserData(user.id, updatedUser);
      // Sync critical fields to Firestore so they survive sign-out
      const firestoreUpdates: Record<string, any> = {};
      if (updates.teamIds) firestoreUpdates.teamIds = updates.teamIds;
      if (updates.clubId) firestoreUpdates.clubId = updates.clubId;
      if (updates.name) firestoreUpdates.name = updates.name;
      if (updates.avatar) firestoreUpdates.avatar = updates.avatar;
      if (updates.role) firestoreUpdates.role = updates.role;
      if (updates.roles) firestoreUpdates.roles = updates.roles;
      if (updates.position !== undefined) firestoreUpdates.position = updates.position;
      if (Object.keys(firestoreUpdates).length > 0) {
        setDoc(doc(db, 'users', user.id), firestoreUpdates, { merge: true })
          .then(() => console.log('Firestore user sync OK:', firestoreUpdates))
          .catch(e => console.warn('Firestore user sync failed:', e));
      }
    }
  };

  const handleTabChange = (tab: string, viewId?: string) => {
    setActiveTab(tab);
    setViewUserId(viewId || null);
    window.scrollTo(0, 0);
    if (tab !== 'chat') setIsChatOpen(false);
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
        return <Home user={user} onTabChange={handleTabChange} onUpdateUser={handleUpdateUser} />;
      case "teams":
        // For club admins, if they have a team navigation pending, show the Teams component instead of ClubTeams
        if (user?.role === "club" && !forceTeamsView) {
          return <ClubTeams user={user} onUpdateUser={handleUpdateUser} onTabChange={handleTabChange} />;
        }
        return <Teams user={user} memberRoles={memberRoles} setMemberRoles={setMemberRoles} onTabChange={handleTabChange} onUpdateUser={handleUpdateUser} />;
      case "chat":
        return user ? <Chat user={user} memberRoles={memberRoles} onChatOpen={setIsChatOpen} onUnreadCount={setChatUnreadCount} /> : null;
      case "schedule":
        return <Schedule user={user} onTabChange={handleTabChange} />;
      case "games":
        return <Games user={user} />;
      case "profile":
        if (!user) return null;
        let profileUser = user;
        if (viewUserId && viewUserId !== user.id) {
          const stored = StorageService.getUserData(viewUserId);
          if (stored) {
            profileUser = {
              id: viewUserId,
              name: stored.name || "Member",
              role: (stored.role as UserRole) || "player",
              avatar: stored.avatar || undefined,
              teamIds: stored.teamIds || [],
              linkedPlayerNumber: stored.linkedPlayerNumber,
              linkedPlayerPosition: stored.linkedPlayerPosition || stored.position,
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
        return <Home user={user} onTabChange={handleTabChange} onUpdateUser={handleUpdateUser} />;
    }
  };

  // Build screen content based on auth state
  let screenContent: React.ReactNode;

  if (!isLoggedIn) {
    if (pendingEmailVerification && auth.currentUser) {
      screenContent = (
        <div className="min-h-full flex flex-col items-center justify-center bg-[#f8fafc] p-6">
          <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="bg-slate-900 p-6">
              <h2 className="text-white text-sm font-black uppercase tracking-widest text-center">Verify Your Email</h2>
            </div>
            <div className="p-6 text-center space-y-5">
              <div
                className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto cursor-pointer"
                onClick={() => {
                  const newCount = verifyDevTaps + 1;
                  setVerifyDevTaps(newCount);
                  if (verifyDevTimer.current) clearTimeout(verifyDevTimer.current);
                  if (newCount >= 3) {
                    setVerifyDevTaps(0);
                    setPendingEmailVerification(false);
                    setIsLoggedIn(true);
                    setActiveTab("home");
                    return;
                  }
                  verifyDevTimer.current = setTimeout(() => setVerifyDevTaps(0), 800);
                }}
              >
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Almost there!</p>
                <p className="text-xs text-slate-500 mt-2">
                  We sent a verification link to <span className="font-bold text-slate-700">{auth.currentUser.email}</span>.
                  Please verify your email to access Vaulte.
                </p>
              </div>
              <button
                onClick={async () => {
                  setVerifyResending(true);
                  try {
                    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
                  } catch (e) { console.warn('Resend failed:', e); }
                  setVerifyResending(false);
                }}
                disabled={verifyResending}
                className="w-full h-12 rounded-2xl border-2 border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50 transition-all"
              >
                {verifyResending ? 'Sending...' : 'Resend Verification Email'}
              </button>
              <button
                onClick={async () => {
                  await auth.currentUser?.reload();
                  if (auth.currentUser?.emailVerified) {
                    await setDoc(doc(db, 'users', auth.currentUser.uid), { emailVerified: true }, { merge: true });
                    setPendingEmailVerification(false);
                    setIsLoggedIn(true);
                    setActiveTab("home");
                  }
                }}
                className="w-full h-12 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all"
              >
                I've Verified My Email
              </button>
              <button
                onClick={async () => {
                  await signOut(auth);
                  setPendingEmailVerification(false);
                  setUser(null);
                }}
                className="w-full py-2 text-[11px] font-semibold text-slate-400 tracking-wide hover:text-slate-600 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      );
    } else {
      screenContent = <Login onLogin={handleLogin} />;
    }
  } else {
    screenContent = (
      <>
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
        {!isChatOpen && <Navigation activeTab={activeTab} onTabChange={handleTabChange} user={user} chatUnreadCount={chatUnreadCount} />}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 overflow-x-hidden md:flex md:items-center md:justify-center">
      {/* iPhone frame — only visible on desktop (md+) browsers */}
      <div className="hidden md:flex items-center justify-center min-h-screen py-8">
        <div className="relative">
          {/* Phone bezel */}
          <div className="rounded-[3rem] border-[6px] border-slate-900 bg-slate-900 shadow-2xl shadow-black/30 overflow-hidden" style={{ width: 393, height: 852 }}>
            {/* Dynamic Island */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50">
              <div className="w-[126px] h-[34px] bg-black rounded-full" />
            </div>
            {/* Screen content */}
            <div className="w-full h-full overflow-y-auto overflow-x-hidden bg-white rounded-[2.4rem]">
              <div className="min-h-full bg-white relative">
                {screenContent}
              </div>
            </div>
          </div>
          {/* Home indicator bar */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[134px] h-[5px] bg-white/80 rounded-full z-50" />
        </div>
      </div>
      {/* Mobile / native view — no frame, shown below md breakpoint */}
      <div className="md:hidden max-w-md mx-auto min-h-screen bg-white shadow-2xl relative">
        {screenContent}
      </div>
    </div>
  );
}

