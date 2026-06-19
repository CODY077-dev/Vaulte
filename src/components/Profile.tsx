import React, { useState, useRef, useEffect } from "react";
import { doc, updateDoc, arrayUnion, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { deleteUser, reauthenticateWithCredential, EmailAuthProvider, signOut, updatePassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import NotificationService from '../services/NotificationService';
import { openExternal } from '../utils/openExternal';
import { UserRole, User as UserType } from "../types";
import DefaultAvatar from "./DefaultAvatar";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { 
  Settings, 
  Bell, 
  Shield, 
  LogOut, 
  ChevronRight, 
  Star, 
  Trophy, 
  Activity, 
  Users, 
  CreditCard, 
  ExternalLink, 
  ChevronLeft,
  Camera,
  Image as ImageIcon,
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
  User as UserIcon,
  Mail,
  Phone,
  Pencil,
  Trash2,
  UserMinus,
  LogIn,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { MOCK_CLUB } from "../constants";
import StorageService from "../services/StorageService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

interface ProfileProps {
  user: UserType;
  onLogout: () => void;
  onBack: () => void;
  onUpdateUser: (updates: Partial<UserType>) => void;
  isViewingSelf?: boolean;
}

export default function Profile({ user, onLogout, onBack, onUpdateUser, isViewingSelf = true }: ProfileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showChildModal, setShowChildModal] = useState(false);
  const [showRemoveChildModal, setShowRemoveChildModal] = useState(false);
  const [childrenList, setChildrenList] = useState<any[]>([]);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const [activeSetting, setActiveSetting] = useState<string | null>(null);
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email || "");
  const [editPhone, setEditPhone] = useState(user.phone || "");
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [editPosition, setEditPosition] = useState(user.position || "");
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState(user.emergencyContact || { firstName: '', lastName: '', email: '', phone: '' });
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [childJoinCode, setChildJoinCode] = useState("");
  const [childJoinError, setChildJoinError] = useState("");
  const [confirmRemoveChild, setConfirmRemoveChild] = useState<any>(null);
  const [confirmRemoveChildCallback, setConfirmRemoveChildCallback] = useState<(() => void) | null>(null);
  const [childJoinStep, setChildJoinStep] = useState<'view' | 'join' | 'success'>('view');
  const [childJoinedTeamName, setChildJoinedTeamName] = useState("");

  useEffect(() => {
    setEditName(user.name);
    setEditEmail(user.email || "");
    setEditPhone(user.phone || "");
  }, [user.name, user.email, user.phone]);

  const [notifications, setNotifications] = useState({
    push: NotificationService.isPermissionGranted(),
    email: false,
    sms: true,
    teamUpdates: true
  });
  const [privacy, setPrivacy] = useState({
    publicProfile: true,
    showStats: true,
    allowInvites: true
  });

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    newPass: '',
    confirm: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        onUpdateUser({ avatar: base64String });
        StorageService.updateUserData(user.id, { avatar: base64String });

        try {
          await updateDoc(doc(db, 'users', user.id), {
            avatar: base64String
          });
        } catch (e) {
          console.error('Failed to sync avatar to Firestore:', e);
        }

        window.dispatchEvent(new Event('gameday_update'));
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileSelect = () => fileInputRef.current?.click();
  const triggerCamera = () => cameraInputRef.current?.click();

  const handleLinkChild = async () => {
    if (!childName || !childAge) return;

    // If a join code was entered, find the matching team
    let matchedTeamId = '';
    if (joinCode.trim()) {
      const foundTeam = StorageService.findTeamByCode(joinCode.trim());
      if (foundTeam) {
        matchedTeamId = foundTeam.id;
      }
    }

    const child = {
      id: `child-${Date.now()}`,
      name: childName,
      age: parseInt(childAge),
      parentIds: [user.id],
      parentNames: [user.name || 'Parent'],
      teamIds: matchedTeamId ? [matchedTeamId] : [] as string[],
    };

    const existing = JSON.parse(localStorage.getItem('gameday_children') || '[]');
    existing.push(child);
    localStorage.setItem('gameday_children', JSON.stringify(existing));

    // If matched a team, also add the parent to that team as a parent role
    if (matchedTeamId) {
      StorageService.addTeamToUser(user.id, matchedTeamId);
      const savedUser = JSON.parse(localStorage.getItem('gameday_user') || '{}');
      savedUser.teamIds = [...new Set([...(savedUser.teamIds || []), matchedTeamId])];
      localStorage.setItem('gameday_user', JSON.stringify(savedUser));
      localStorage.setItem(`gameday_role_${user.id}_${matchedTeamId}`, 'parent');
      localStorage.setItem(`gameday_child_${user.id}_${matchedTeamId}`, child.id);
    }

    try {
      // Sync child to Firestore children collection
      StorageService.syncChildToFirestore(child).catch(console.error);

      await updateDoc(doc(db, 'users', user.id), {
        children: arrayUnion(child.id)
      });

      // If matched a team, also persist parent's team membership to Firestore
      if (matchedTeamId) {
        const { getDoc, setDoc } = await import('firebase/firestore');
        const userRef = doc(db, 'users', user.id);
        const userSnap = await getDoc(userRef);
        const existingData = userSnap.exists() ? userSnap.data() : {};
        const updatedTeamIds = [...new Set([...(existingData.teamIds || []), matchedTeamId])];
        await setDoc(userRef, {
          ...existingData,
          teamIds: updatedTeamIds,
        }, { merge: true });
        onUpdateUser({ teamIds: updatedTeamIds });
      }
    } catch (e) {
      console.error("Error updating user children in Firestore:", e);
    }

    window.dispatchEvent(new Event('gameday_update'));
    setShowChildModal(false);
    setChildName("");
    setChildAge("");
    setJoinCode("");
  };

  const handleDeleteAccount = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setDeleteError('No authenticated session found. Please sign in again.');
      return;
    }

    if (!deletePassword) {
      setDeleteError('Please enter your password to confirm');
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');

    try {
      // Reauthenticate first — Firebase requires recent login for account deletion
      const credential = EmailAuthProvider.credential(firebaseUser.email!, deletePassword);
      await reauthenticateWithCredential(firebaseUser, credential);

      const uid = firebaseUser.uid;

      // Delete user's Firestore data
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (e) { console.warn('Failed to delete user doc:', e); }

      // Delete FCM token
      try {
        await deleteDoc(doc(db, 'fcmTokens', uid));
      } catch (e) { console.warn('Failed to delete FCM token:', e); }

      // Delete children linked to this user
      try {
        const children = JSON.parse(localStorage.getItem('gameday_children') || '[]');
        const myChildren = children.filter((c: any) => c.parentIds?.includes(uid));
        for (const child of myChildren) {
          // Only delete if this user is the sole parent
          if (!child.parentIds || child.parentIds.length <= 1) {
            await deleteDoc(doc(db, 'children', child.id)).catch(() => {});
          }
        }
      } catch (e) { console.warn('Failed to clean up children:', e); }

      // Clear all localStorage data
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('gameday_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // Delete the Firebase Auth account
      await deleteUser(firebaseUser);

      // The onAuthStateChanged listener in App.tsx will handle the UI reset
    } catch (err: any) {
      console.error('Account deletion failed:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setDeleteError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setDeleteError('Too many attempts. Please wait a moment and try again.');
      } else {
        setDeleteError('Failed to delete account. Please try again.');
      }
      setDeleteLoading(false);
    }
  };

  const menuItems = [
    { icon: UserIcon, label: "Profile Info", color: "text-primary", bg: "bg-primary/10" },
    { icon: Bell, label: "Notifications", color: "text-primary", bg: "bg-primary/10" },
    { icon: Shield, label: "Privacy & Security", color: "text-primary", bg: "bg-primary/10" },
    { icon: CreditCard, label: "Subscription", color: "text-primary", bg: "bg-primary/10" },
    { icon: Settings, label: "App Settings", color: "text-primary", bg: "bg-primary/10" },
  ];

  const defaultStats = [
    { label: "Games", value: "12", icon: Activity },
    { label: "Teams", value: "3", icon: Users },
    { label: "Trophies", value: "5", icon: Trophy },
  ];

  const stats = user.role === "supporter" ? [] : defaultStats;

  return (
    <div className="bg-slate-50 min-h-full pb-24">
      {/* Header Section */}
      <div className="pt-6 pb-4 px-4 space-y-6">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBack}
              className="rounded-full hover:bg-white shadow-sm border border-slate-100 bg-white w-8 h-8"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </Button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Profile</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Member Dashboard</p>
            </div>
          </div>
          <div className="flex gap-1">
            {isViewingSelf && (
              <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
                <Settings className="w-4 h-4 text-slate-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* User Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-none border-b border-slate-100">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <DefaultAvatar
                    src={user.avatar || (user.role === 'club' ? "https://storage.googleapis.com/birdfood-image-uploads/ais-dev-74wzavla4ctuej6qasu33q-406567407991/1744392919323-karaka-rfc-logo.png" : null)}
                    name={user.name}
                    size="xl"
                    className="border-4 border-slate-50 shadow-sm"
                  />

                  {isViewingSelf && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                      <Star className="w-3 h-3 text-white fill-current" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">{user.name}</h2>
                  {user.position && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Activity className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {user.position}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {user.role === 'club' && (
                <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {user?.role === 'club' ? "Club Join Code" : "Your Unique Invite Code"}
                    </span>
                    <Badge variant="outline" className="text-[8px] font-bold border-slate-200 bg-white">SECURE</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-black text-slate-900 tracking-[0.2em]">
                      {user?.role === 'club' ? MOCK_CLUB.joinCode : `GD-${user?.name?.slice(0,3).toUpperCase()}-2024`}
                    </code>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        const code = user?.role === 'club' ? MOCK_CLUB.joinCode : `GD-${user?.name?.slice(0,3).toUpperCase()}-2024`;
                        if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(code); }
                        else { const ta = document.createElement('textarea'); ta.value = code; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
                      }}
                      className="h-7 px-3 text-[9px] font-black uppercase tracking-tight bg-white shadow-sm border border-slate-100"
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-[8px] font-bold text-slate-400 mt-2 leading-tight">
                    {user?.role === 'club'
                      ? "Share this code with coaches so their team can request to join your club."
                      : user?.role === 'supporter'
                      ? "Share this code with your child's coach to be added to a team roster."
                      : "Share this code with your coach to be added to a team roster."
                    }
                  </p>
                </div>
              )}
              
              {/* Removed Fan Level / XP Bar */}
            </CardContent>
          </Card>
        </motion.div>

        {/* Linked Children Section */}
        {isViewingSelf && (() => {
          const allChildren = JSON.parse(localStorage.getItem('gameday_children') || '[]');
          const myChildren = allChildren.filter((c: any) => c.parentIds?.includes(user.id));
          if (myChildren.length === 0) return null;

          const allTeams = [...(JSON.parse(localStorage.getItem('gameday_custom_teams') || '[]'))];

          return (
            <div className="px-4">
              <div className="mb-3 px-2">
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">My Children</h2>
              </div>
              <div className="space-y-2">
                {myChildren.map((child: any) => {
                  const childTeams = (child.teamIds || []).map((tid: string) => allTeams.find((t: any) => t.id === tid)).filter(Boolean);
                  return (
                    <button
                      key={child.id}
                      onClick={() => {
                        setSelectedChild(child);
                        setChildJoinStep('view');
                        setChildJoinCode('');
                        setChildJoinError('');
                      }}
                      className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-[0.98] transition-all text-left"
                    >
                      <DefaultAvatar name={child.name} size="md" className="rounded-xl border-2 border-white shadow-sm shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{child.name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold">
                          {childTeams.length > 0
                            ? childTeams.map((t: any) => t.name).join(', ')
                            : 'No teams yet'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* SportsUp Fundraising Button */}
        {isViewingSelf && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="px-4 mb-4"
          >
            <button
              onClick={() => openExternal('https://sportsup.co.nz')}
              className="block w-full rounded-2xl overflow-hidden active:scale-[0.98] transition-all text-left"
              style={{ background: 'linear-gradient(135deg, #0B1D3A 0%, #153A6B 50%, #1A4F8B 100%)' }}
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/game-day-app-115a4.firebasestorage.app/o/Screenshot%202026-05-24%20100022.png?alt=media&token=cf72ad8e-ea8a-4185-be10-616a088c1718"
                  alt="SportsUp"
                  className="w-10 h-10 object-contain shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-white uppercase italic tracking-tight leading-none">Fundraising</p>
                  <p className="text-[9px] font-semibold text-white/50 uppercase tracking-[0.15em] mt-1">Powered by SportsUp NZ</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <ExternalLink className="w-3.5 h-3.5 text-white/70" />
                </div>
              </div>
            </button>
          </motion.div>
        )}

        {/* Menu Section */}
        {isViewingSelf && (
          <div className="grid">
            <div className="px-6 mb-4">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Account Settings</h2>
            </div>
            <div className="">
              {menuItems.map((item, index) => (
                <div key={item.label}>
                  <Dialog open={activeSetting === item.label} onOpenChange={(open) => {
                    if (open && item.label === 'Profile Info') {
                      setEditPosition(user.position || '');
                      setEmergencyContact(user.emergencyContact || { firstName: '', lastName: '', email: '', phone: '' });
                    }
                    setActiveSetting(open ? item.label : null);
                  }}>
                    <DialogTrigger 
                      render={
                        <motion.button
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + index * 0.05 }}
                          className="w-full flex items-center justify-between p-6 bg-white shadow-none border-none border-b border-slate-100 last:border-none active:scale-[0.98] transition-all group"
                        />
                      }
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${item.bg} ${item.color}`}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{item.label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                    </DialogTrigger>
                    <DialogContent showCloseButton={false} className="sm:max-w-[400px] max-h-[85vh] rounded-[2.5rem] border-none p-0 overflow-hidden bg-white flex flex-col">
                    <div className={`p-5 ${item.bg} ${item.color} shrink-0 flex items-start justify-between`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center">
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <DialogTitle className="text-base font-black uppercase italic leading-none">
                            {item.label}
                          </DialogTitle>
                          <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest mt-1">
                            Manage your {item.label.toLowerCase()} preferences
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveSetting(null)}
                        className="w-8 h-8 rounded-xl bg-black/10 hover:bg-black/20 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all active:scale-90 shrink-0 mt-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                      {item.label === "Profile Info" && (
                        <div className="space-y-5">
                          {/* Centered avatar + name + position */}
                          <div className="flex flex-col items-center pb-4 border-b border-slate-100">
                            <div className="w-20 h-20 rounded-2xl overflow-hidden border-[3px] border-slate-200 shadow-sm bg-slate-100">
                              <DefaultAvatar
                                src={user.avatar}
                                name={user.name}
                                size="xl"
                                className="rounded-none w-full h-full"
                              />
                            </div>
                            <h3 className="text-base font-black uppercase italic text-slate-900 mt-3 text-center">{user.name}</h3>
                            {user.position && (
                              <span className="mt-2 px-3 py-1 rounded-full bg-primary text-[8px] font-black uppercase tracking-widest text-white">
                                {user.position}
                              </span>
                            )}
                          </div>

                          {/* Full Name */}
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Full Name</label>
                            <div className="relative">
                              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Enter your name"
                                className="w-full h-12 bg-slate-50 rounded-xl pl-12 pr-4 text-xs font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                              />
                            </div>
                          </div>

                          {/* Email */}
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Email Address</label>
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                placeholder="email@example.com"
                                className="w-full h-12 bg-slate-50 rounded-xl pl-12 pr-4 text-xs font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                              />
                            </div>
                          </div>

                          {/* Phone */}
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Phone Number</label>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="tel"
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value)}
                                placeholder="+64 21 000 0000"
                                className="w-full h-12 bg-slate-50 rounded-xl pl-12 pr-4 text-xs font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                              />
                            </div>
                          </div>

                          {/* Position */}
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Position</label>
                            <div className="relative">
                              <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                value={editPosition}
                                onChange={(e) => setEditPosition(e.target.value)}
                                placeholder="e.g. Hooker, Centre, Halfback"
                                className="w-full h-12 bg-slate-50 rounded-xl pl-12 pr-4 text-xs font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                              />
                            </div>
                          </div>

                          {/* Link a Child button */}
                          {(user.role !== 'coach' && user.role !== 'club') && (
                            <button
                              onClick={() => {
                                setActiveSetting(null);
                                setTimeout(() => setShowChildModal(true), 200);
                              }}
                              className="w-full h-12 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors
                                         flex items-center justify-center gap-2
                                         text-[10px] font-black uppercase tracking-widest text-slate-600 active:scale-[0.98]"
                            >
                              <Users className="w-4 h-4 text-primary" />
                              Link a Child
                            </button>
                          )}

                          {/* Emergency Contact section */}
                          <div className="pt-2 border-t border-slate-100">
                            <p className="text-[9px] font-black text-red-400 uppercase tracking-widest px-1 mb-3">Emergency Contact</p>

                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div className="space-y-1.5">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">First Name</label>
                                <input
                                  type="text"
                                  value={emergencyContact.firstName || ''}
                                  onChange={(e) => setEmergencyContact(prev => ({ ...prev, firstName: e.target.value }))}
                                  placeholder="First name"
                                  className="w-full h-11 bg-slate-50 rounded-xl px-3 text-xs font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Last Name</label>
                                <input
                                  type="text"
                                  value={emergencyContact.lastName || ''}
                                  onChange={(e) => setEmergencyContact(prev => ({ ...prev, lastName: e.target.value }))}
                                  placeholder="Last name"
                                  className="w-full h-11 bg-slate-50 rounded-xl px-3 text-xs font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-300" />
                                <input
                                  type="email"
                                  value={emergencyContact.email || ''}
                                  onChange={(e) => setEmergencyContact(prev => ({ ...prev, email: e.target.value }))}
                                  placeholder="Emergency email"
                                  className="w-full h-11 bg-slate-50 rounded-xl pl-12 pr-4 text-xs font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                              </div>
                              <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-300" />
                                <input
                                  type="tel"
                                  value={emergencyContact.phone || ''}
                                  onChange={(e) => setEmergencyContact(prev => ({ ...prev, phone: e.target.value }))}
                                  placeholder="Emergency phone"
                                  className="w-full h-11 bg-slate-50 rounded-xl pl-12 pr-4 text-xs font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <p className="text-[8px] font-bold text-slate-400 px-1 leading-tight">
                            Your info is visible to coaches and managers on your teams.
                          </p>
                        </div>
                      )}
  
                      {item.label === "Notifications" && (
                        <div className="space-y-4">
                          {Object.entries(notifications).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                              <span className="text-xs font-black uppercase italic text-slate-700">
                                {key.replace(/([A-Z])/g, ' $1')}
                              </span>
                              <button
                                onClick={async () => {
                                  if (key === 'push' && !value) {
                                    // Request push notification permission
                                    const token = await NotificationService.requestPermission(user.id);
                                    if (token) {
                                      setNotifications(prev => ({ ...prev, push: true }));
                                    }
                                  } else {
                                    setNotifications(prev => ({ ...prev, [key]: !value }));
                                  }
                                }}
                                className={`w-10 h-6 rounded-full transition-colors relative ${value ? 'bg-primary' : 'bg-slate-200'}`}
                              >
                                <motion.div
                                  animate={{ x: value ? 18 : 4 }}
                                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {item.label === "Privacy & Security" && (
                        <div className="space-y-4">
                          {Object.entries(privacy).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                              <span className="text-xs font-black uppercase italic text-slate-700">
                                {key.replace(/([A-Z])/g, ' $1')}
                              </span>
                              <button 
                                onClick={() => setPrivacy(prev => ({ ...prev, [key]: !value }))}
                                className={`w-10 h-6 rounded-full transition-colors relative ${value ? 'bg-primary' : 'bg-slate-200'}`}
                              >
                                <motion.div 
                                  animate={{ x: value ? 18 : 4 }}
                                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                                />
                              </button>
                            </div>
                          ))}
                          
                          <div className="space-y-3">
                            <button
                              onClick={() => {
                                setIsChangingPassword(!isChangingPassword);
                                setPasswordError('');
                                setPasswordSuccess(false);
                                setPasswordForm({ current: '', newPass: '', confirm: '' });
                              }}
                              className="w-full bg-slate-50 rounded-2xl p-4 text-[11px] 
                                         font-black uppercase tracking-widest text-slate-700 
                                         hover:bg-slate-100 transition-all text-center"
                            >
                              {isChangingPassword ? 'Cancel' : 'Change Password'}
                            </button>
  
                            {/* Inline password form */}
                            <AnimatePresence>
                              {isChangingPassword && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden space-y-3"
                                >
                                  {/* Current password */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 
                                                      uppercase tracking-widest px-1">
                                      Current Password
                                    </label>
                                    <input
                                      type="password"
                                      placeholder="Enter current password"
                                      value={passwordForm.current}
                                      onChange={e => setPasswordForm(p => ({
                                        ...p, current: e.target.value
                                      }))}
                                      className="w-full h-12 bg-slate-50 rounded-2xl px-4 
                                                 text-[12px] font-medium text-slate-900 
                                                 border border-slate-100 outline-none 
                                                 focus:border-primary/40 focus:ring-2 
                                                 focus:ring-primary/10 transition-all"
                                    />
                                  </div>
  
                                  {/* New password */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 
                                                      uppercase tracking-widest px-1">
                                      New Password
                                    </label>
                                    <input
                                      type="password"
                                      placeholder="Enter new password"
                                      value={passwordForm.newPass}
                                      onChange={e => setPasswordForm(p => ({
                                        ...p, newPass: e.target.value
                                      }))}
                                      className="w-full h-12 bg-slate-50 rounded-2xl px-4 
                                                 text-[12px] font-medium text-slate-900 
                                                 border border-slate-100 outline-none 
                                                 focus:border-primary/40 focus:ring-2 
                                                 focus:ring-primary/10 transition-all"
                                    />
                                  </div>
  
                                  {/* Confirm new password */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 
                                                      uppercase tracking-widest px-1">
                                      Confirm New Password
                                    </label>
                                    <input
                                      type="password"
                                      placeholder="Confirm new password"
                                      value={passwordForm.confirm}
                                      onChange={e => setPasswordForm(p => ({
                                        ...p, confirm: e.target.value
                                      }))}
                                      className="w-full h-12 bg-slate-50 rounded-2xl px-4 
                                                 text-[12px] font-medium text-slate-900 
                                                 border border-slate-100 outline-none 
                                                 focus:border-primary/40 focus:ring-2 
                                                 focus:ring-primary/10 transition-all"
                                    />
                                  </div>
  
                                  {/* Password strength indicator */}
                                  {passwordForm.newPass.length > 0 && (
                                    <div className="space-y-1 px-1">
                                      <div className="flex gap-1">
                                        {[1,2,3,4].map(i => (
                                          <div key={i} className={cn(
                                            "h-1 flex-1 rounded-full transition-all",
                                            passwordForm.newPass.length >= i * 3
                                              ? i <= 1 ? "bg-red-400"
                                              : i <= 2 ? "bg-amber-400"
                                              : i <= 3 ? "bg-blue-400"
                                              : "bg-green-500"
                                              : "bg-slate-100"
                                          )} />
                                        ))}
                                      </div>
                                      <p className="text-[9px] font-bold text-slate-400">
                                        {passwordForm.newPass.length < 4 ? "Too short" :
                                         passwordForm.newPass.length < 7 ? "Weak" :
                                         passwordForm.newPass.length < 10 ? "Good" :
                                         "Strong"}
                                      </p>
                                    </div>
                                  )}
  
                                  {/* Error message */}
                                  {passwordError && (
                                    <div className="bg-red-50 rounded-xl p-3 flex 
                                                    items-center gap-2">
                                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                      <p className="text-[10px] font-bold text-red-600">
                                        {passwordError}
                                      </p>
                                    </div>
                                  )}
  
                                  {/* Success message */}
                                  {passwordSuccess && (
                                    <div className="bg-green-50 rounded-xl p-3 flex 
                                                    items-center gap-2">
                                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                      <p className="text-[10px] font-bold text-green-600">
                                        Password updated successfully
                                      </p>
                                    </div>
                                  )}
  
                                  {/* Submit button */}
                                  <button
                                    disabled={passwordLoading}
                                    onClick={async () => {
                                      setPasswordError('');

                                      if (!passwordForm.current) {
                                        setPasswordError('Please enter your current password');
                                        return;
                                      }
                                      if (passwordForm.newPass.length < 6) {
                                        setPasswordError('New password must be at least 6 characters');
                                        return;
                                      }
                                      if (passwordForm.newPass !== passwordForm.confirm) {
                                        setPasswordError('Passwords do not match');
                                        return;
                                      }

                                      const firebaseUser = auth.currentUser;
                                      if (!firebaseUser || !firebaseUser.email) {
                                        setPasswordError('You must be signed in to change your password');
                                        return;
                                      }

                                      setPasswordLoading(true);
                                      try {
                                        // 1. Reauthenticate with current password
                                        const credential = EmailAuthProvider.credential(firebaseUser.email, passwordForm.current);
                                        await reauthenticateWithCredential(firebaseUser, credential);

                                        // 2. Update to new password
                                        await updatePassword(firebaseUser, passwordForm.newPass);

                                        // 3. Show success
                                        setPasswordSuccess(true);
                                        setTimeout(() => {
                                          setIsChangingPassword(false);
                                          setPasswordSuccess(false);
                                          setPasswordForm({ current: '', newPass: '', confirm: '' });
                                        }, 2000);
                                      } catch (err: any) {
                                        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                                          setPasswordError('Current password is incorrect');
                                        } else if (err.code === 'auth/weak-password') {
                                          setPasswordError('New password is too weak. Use at least 6 characters.');
                                        } else if (err.code === 'auth/too-many-requests') {
                                          setPasswordError('Too many attempts. Please try again later.');
                                        } else {
                                          setPasswordError('Failed to update password. Please try again.');
                                        }
                                      } finally {
                                        setPasswordLoading(false);
                                      }
                                    }}
                                    className="w-full h-12 bg-slate-900 hover:bg-slate-800
                                               text-white rounded-2xl text-[11px] font-black
                                               uppercase tracking-widest transition-all
                                               active:scale-[0.98] disabled:opacity-50"
                                  >
                                    {passwordLoading ? 'Updating...' : 'Update Password'}
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Delete Account */}
                          <div className="pt-4 border-t border-slate-100">
                            <AnimatePresence mode="wait">
                              {!showDeleteConfirm ? (
                                <motion.button
                                  key="delete-trigger"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  onClick={() => {
                                    setShowDeleteConfirm(true);
                                    setDeletePassword('');
                                    setDeleteError('');
                                  }}
                                  className="w-full bg-red-50 rounded-2xl p-4 text-[11px]
                                             font-black uppercase tracking-widest text-red-500
                                             hover:bg-red-100 transition-all text-center"
                                >
                                  Delete Account
                                </motion.button>
                              ) : (
                                <motion.div
                                  key="delete-confirm"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden space-y-3"
                                >
                                  <div className="bg-red-50 rounded-2xl p-4 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                      <p className="text-[11px] font-black text-red-600 uppercase tracking-wide">
                                        Are you sure?
                                      </p>
                                    </div>
                                    <p className="text-[10px] font-medium text-red-500/80 leading-relaxed">
                                      This will permanently delete your account, all your data, team memberships, and cannot be undone.
                                    </p>
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-red-400 uppercase tracking-widest px-1">
                                      Enter your password to confirm
                                    </label>
                                    <input
                                      type="password"
                                      placeholder="Your password"
                                      value={deletePassword}
                                      onChange={e => {
                                        setDeletePassword(e.target.value);
                                        setDeleteError('');
                                      }}
                                      className="w-full h-12 bg-white rounded-2xl px-4
                                                 text-[12px] font-medium text-slate-900
                                                 border border-red-200 outline-none
                                                 focus:border-red-400 focus:ring-2
                                                 focus:ring-red-100 transition-all"
                                    />
                                  </div>

                                  {deleteError && (
                                    <div className="bg-red-50 rounded-xl p-3 flex items-center gap-2">
                                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                      <p className="text-[10px] font-bold text-red-600">{deleteError}</p>
                                    </div>
                                  )}

                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setDeletePassword('');
                                        setDeleteError('');
                                      }}
                                      disabled={deleteLoading}
                                      className="flex-1 h-12 bg-slate-100 hover:bg-slate-200
                                                 text-slate-600 rounded-2xl text-[10px] font-black
                                                 uppercase tracking-widest transition-all
                                                 active:scale-[0.98]"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={handleDeleteAccount}
                                      disabled={deleteLoading || !deletePassword}
                                      className="flex-1 h-12 bg-red-500 hover:bg-red-600
                                                 text-white rounded-2xl text-[10px] font-black
                                                 uppercase tracking-widest transition-all
                                                 active:scale-[0.98] disabled:opacity-50"
                                    >
                                      {deleteLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                          Deleting...
                                        </span>
                                      ) : 'Delete Forever'}
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      )}

                      {item.label === "Subscription" && (
                        <div className="space-y-4">
                          <div className="p-6 bg-slate-900 rounded-[2rem] text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full blur-2xl -mr-12 -mt-12" />
                            <Badge className="bg-primary text-[8px] font-black border-none mb-2">CURRENT PLAN</Badge>
                            <h3 className="text-xl font-black uppercase italic">Pro Member</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">$9.99 / Month</p>
                            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Next billing: May 12, 2026</span>
                              <Button size="sm" variant="ghost" className="text-[9px] font-black text-primary uppercase p-0 h-auto">Manage</Button>
                            </div>
                          </div>
                          <Button className="w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-900 hover:bg-slate-100 border-none">
                            View Billing History
                          </Button>
                        </div>
                      )}
  
                      {item.label === "App Settings" && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                            <span className="text-xs font-black uppercase italic text-slate-700">Dark Mode</span>
                            <Badge variant="outline" className="text-[8px] font-bold border-slate-200 bg-white">SYSTEM</Badge>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                            <span className="text-xs font-black uppercase italic text-slate-700">Language</span>
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">English (US)</span>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                            <span className="text-xs font-black uppercase italic text-slate-700">App Version</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">v1.0.4</span>
                          </div>
                        </div>
                      )}
  
                      <Button 
                        onClick={async () => {
                          if (item.label === "Profile Info") {
                            onUpdateUser({
                              name: editName,
                              email: editEmail,
                              phone: editPhone,
                              position: editPosition,
                              emergencyContact
                            });
                            StorageService.updateUserData(user.id, {
                              name: editName,
                              email: editEmail,
                              phone: editPhone,
                              position: editPosition,
                              emergencyContact
                            } as any);

                            try {
                              await updateDoc(doc(db, 'users', user.id), {
                                name: editName,
                                email: editEmail,
                                phone: editPhone,
                                position: editPosition,
                                emergencyContact
                              });
                            } catch (e) {
                              console.error('Failed to sync profile info to Firestore:', e);
                            }
                          }
                          setActiveSetting(null);
                          window.dispatchEvent(new Event('gameday_update'));
                        }}
                        className="w-full h-12 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/10 mt-4"
                      >
                        Save Changes
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              ))}
            </div>
          </div>
        )}

        {/* Logout Button */}
        {isViewingSelf && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="px-4 pt-4"
          >
            <Button 
              className="w-full h-14 rounded-2xl shadow-lg shadow-primary/20 font-black text-xs uppercase tracking-[0.2em] italic bg-primary text-white hover:bg-primary/90 border-none"
              onClick={onLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </motion.div>
        )}

        {/* Edit Profile Modal */}
        <AnimatePresence>
          {showEditModal && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowEditModal(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
              />
              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                           z-[70] w-[90%] max-w-sm bg-white rounded-[2.5rem] shadow-2xl
                           overflow-hidden"
              >
                {/* Header */}
                <div className="bg-slate-900 p-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                      <Pencil className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-base font-black uppercase italic text-white leading-none">
                      Edit Profile
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20
                               flex items-center justify-center text-white/60
                               hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                  {/* Avatar section */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative group cursor-pointer" onClick={triggerFileSelect}>
                      <DefaultAvatar 
                        src={user.avatar} 
                        name={user.name}
                        size="xl"
                        className="border-4 border-slate-100 shadow-md transition-transform group-active:scale-95"
                      />
                      <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                        <Camera className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Tap to change photo
                    </p>
                  </div>

                  {/* Name section */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full h-12 bg-slate-50 rounded-2xl pl-12 pr-4 text-sm font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  </div>

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                  />

                  {/* Remove a Child — only when user has linked children */}
                  {JSON.parse(localStorage.getItem('gameday_children') || '[]').some((c: any) => c.parentIds?.includes(user.id)) && (
                    <button
                      onClick={() => {
                        const all = JSON.parse(localStorage.getItem('gameday_children') || '[]');
                        setChildrenList(all.filter((c: any) => c.parentIds?.includes(user.id)));
                        setShowEditModal(false);
                        setTimeout(() => setShowRemoveChildModal(true), 200);
                      }}
                      className="w-full h-10 rounded-2xl border border-red-200 bg-white text-red-400 text-[9px] font-black uppercase tracking-widest transition-all hover:bg-red-50 active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      Remove a Child
                    </button>
                  )}

                  {/* Save button */}
                  <button
                    onClick={async () => {
                      // Save to StorageService
                      StorageService.updateUserData(user.id, { name: editName });
                      onUpdateUser({ name: editName });

                      try {
                        await updateDoc(doc(db, 'users', user.id), {
                          name: editName
                        });
                      } catch (e) {
                        console.error('Failed to sync name to Firestore:', e);
                      }

                      window.dispatchEvent(new Event('gameday_update'));
                      setShowEditModal(false);
                    }}
                    className="w-full h-14 bg-slate-900 text-white rounded-2xl
                               text-[11px] font-black uppercase tracking-widest
                               hover:bg-slate-800 active:scale-[0.98] transition-all
                               shadow-lg shadow-slate-200"
                  >
                    Save Changes
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Link Child Modal */}
        <AnimatePresence>
          {showChildModal && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowChildModal(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
              />
              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                           z-[70] w-[90%] max-w-sm bg-white rounded-[2.5rem] shadow-2xl
                           overflow-hidden"
              >
                {/* Header */}
                <div className="bg-primary p-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-base font-black uppercase italic text-white leading-none">
                      Link a Child
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowChildModal(false)}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20
                               flex items-center justify-center text-white/60
                               hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  {/* Name section */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                      Child's Name
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        value={childName}
                        onChange={(e) => setChildName(e.target.value)}
                        placeholder="Enter name"
                        className="w-full h-12 bg-slate-50 rounded-2xl pl-12 pr-4 text-sm font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Age section */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                      Child's Age
                    </label>
                    <div className="relative">
                      <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number"
                        value={childAge}
                        onChange={(e) => setChildAge(e.target.value)}
                        placeholder="Enter age"
                        className="w-full h-12 bg-slate-50 rounded-2xl pl-12 pr-4 text-sm font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Join Code section */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                      Team Join Code (Optional)
                    </label>
                    <div className="relative">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        placeholder="e.g. KARAKA-2024"
                        className="w-full h-12 bg-slate-50 rounded-2xl pl-12 pr-4 text-sm font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  </div>

                  <p className="text-[8px] font-bold text-slate-400 px-1 leading-tight mb-2">
                    Link your child to see their team schedules and attendance right from your home screen.
                  </p>

                  {/* Link button */}
                  <button
                    onClick={handleLinkChild}
                    disabled={!childName || !childAge}
                    className="w-full h-14 bg-slate-900 text-white rounded-2xl
                               text-[11px] font-black uppercase tracking-widest
                               hover:bg-slate-800 active:scale-[0.98] transition-all
                               shadow-lg shadow-slate-200 disabled:opacity-50"
                  >
                    Link Profile
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Edit Position Modal */}
        <AnimatePresence>
          {showPositionModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPositionModal(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                           z-[70] w-[90%] max-w-sm bg-white rounded-[2.5rem] shadow-2xl
                           overflow-hidden"
              >
                {/* Header */}
                <div className="bg-slate-900 p-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                      <Activity className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-base font-black uppercase italic text-white leading-none">
                      Edit Position
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowPositionModal(false)}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20
                               flex items-center justify-center text-white/60
                               hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                      Your Position
                    </label>
                    <div className="relative">
                      <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={editPosition}
                        onChange={(e) => setEditPosition(e.target.value)}
                        placeholder="e.g. Centre Back, Hooker, Midfielder"
                        className="w-full h-12 bg-slate-50 rounded-2xl pl-12 pr-4 text-sm font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  </div>

                  <p className="text-[8px] font-bold text-slate-400 px-1 leading-tight">
                    Your position will appear in team lineups and squad lists where you are a member.
                  </p>

                  <button
                    onClick={async () => {
                      onUpdateUser({ position: editPosition });
                      StorageService.updateUserData(user.id, { position: editPosition });

                      try {
                        await updateDoc(doc(db, 'users', user.id), {
                          position: editPosition
                        });
                      } catch (e) {
                        console.error('Failed to sync position to Firestore:', e);
                      }

                      window.dispatchEvent(new Event('gameday_update'));
                      setShowPositionModal(false);
                    }}
                    className="w-full h-14 bg-slate-900 text-white rounded-2xl
                               text-[11px] font-black uppercase tracking-widest
                               hover:bg-slate-800 active:scale-[0.98] transition-all
                               shadow-lg shadow-slate-200"
                  >
                    Save Position
                  </button>
                </div>
              </motion.div>
            </>
          )}

          {/* Emergency Contact Modal */}
          {showEmergencyModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowEmergencyModal(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                           z-[70] w-[92%] max-w-sm max-h-[85vh] flex flex-col
                           bg-white rounded-[2rem] shadow-2xl overflow-hidden"
              >
                <div className="bg-slate-900 p-6 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-500/20 rounded-xl flex items-center justify-center">
                      <Phone className="w-4 h-4 text-red-400" />
                    </div>
                    <h3 className="text-base font-black uppercase italic text-white leading-none">
                      Emergency Contact
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowEmergencyModal(false)}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20
                               flex items-center justify-center text-white/60
                               hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">First Name</label>
                      <input
                        type="text"
                        value={emergencyContact.firstName || ''}
                        onChange={(e) => setEmergencyContact(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="First name"
                        className="w-full h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Last Name</label>
                      <input
                        type="text"
                        value={emergencyContact.lastName || ''}
                        onChange={(e) => setEmergencyContact(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Last name"
                        className="w-full h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Email</label>
                    <input
                      type="email"
                      value={emergencyContact.email || ''}
                      onChange={(e) => setEmergencyContact(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@example.com"
                      className="w-full h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Phone Number</label>
                    <input
                      type="tel"
                      value={emergencyContact.phone || ''}
                      onChange={(e) => setEmergencyContact(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+64 21 000 0000"
                      className="w-full h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>

                  <p className="text-[8px] font-bold text-slate-400 px-1 leading-tight">
                    Your emergency contact will be visible to your team coaches and managers.
                  </p>

                  <button
                    onClick={async () => {
                      onUpdateUser({ emergencyContact });
                      StorageService.updateUserData(user.id, { emergencyContact } as any);

                      try {
                        await updateDoc(doc(db, 'users', user.id), { emergencyContact });
                      } catch (e) {
                        console.error('Failed to sync emergency contact to Firestore:', e);
                      }

                      window.dispatchEvent(new Event('gameday_update'));
                      setShowEmergencyModal(false);
                    }}
                    className="w-full h-14 bg-slate-900 text-white rounded-2xl
                               text-[11px] font-black uppercase tracking-widest
                               hover:bg-slate-800 active:scale-[0.98] transition-all
                               shadow-lg shadow-slate-200"
                  >
                    Save Emergency Contact
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Child Detail / Join Team Modal */}
        <AnimatePresence>
          {selectedChild && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedChild(null)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                           z-[70] w-[90%] max-w-sm bg-white rounded-[2.5rem] shadow-2xl
                           overflow-hidden max-h-[85vh] flex flex-col"
              >
                {/* Header */}
                <div className="bg-slate-900 p-6 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    {childJoinStep !== 'view' && (
                      <button
                        onClick={() => { setChildJoinStep('view'); setChildJoinCode(''); setChildJoinError(''); }}
                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    )}
                    <DefaultAvatar name={selectedChild.name} size="sm" className="rounded-lg border-2 border-white/20" />
                    <div>
                      <h3 className="text-base font-black uppercase italic text-white leading-none">
                        {selectedChild.name}
                      </h3>
                      <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-0.5">
                        {childJoinStep === 'view' ? 'Profile' : childJoinStep === 'join' ? 'Join a Team' : 'All Done'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedChild(null)}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20
                               flex items-center justify-center text-white/60
                               hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 overflow-y-auto">
                  {childJoinStep === 'success' ? (
                    <div className="text-center py-6 space-y-3">
                      <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-7 h-7 text-green-500" />
                      </div>
                      <h4 className="text-sm font-black uppercase italic text-slate-900">Joined!</h4>
                      <p className="text-[11px] font-medium text-slate-500">
                        {selectedChild.name} has been added to <span className="font-bold text-slate-700">{childJoinedTeamName}</span>
                      </p>
                    </div>
                  ) : childJoinStep === 'join' ? (
                    <>
                      <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                        Enter the team access code to add {selectedChild.name} to a team.
                      </p>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                          Team Access Code
                        </label>
                        <input
                          type="text"
                          value={childJoinCode}
                          onChange={(e) => { setChildJoinCode(e.target.value.toUpperCase()); setChildJoinError(''); }}
                          placeholder="e.g. KRK-ABC"
                          className="w-full h-12 bg-slate-50 rounded-2xl px-4 text-[13px] font-black tracking-widest text-slate-900 border border-slate-100 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 text-center uppercase"
                        />
                      </div>
                      {childJoinError && (
                        <div className="bg-red-50 rounded-xl p-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                          <p className="text-[10px] font-bold text-red-600">{childJoinError}</p>
                        </div>
                      )}
                      <button
                        onClick={async () => {
                          if (!childJoinCode || childJoinCode.length < 4) {
                            setChildJoinError('Please enter a valid access code');
                            return;
                          }

                          const customTeam = StorageService.findTeamByCode(childJoinCode);
                          const { MOCK_TEAMS } = await import('../constants');
                          const mockTeam = MOCK_TEAMS.find((t: any) => t.joinCode?.toUpperCase() === childJoinCode.toUpperCase());
                          const fTeam = customTeam || mockTeam;

                          if (!fTeam) {
                            setChildJoinError('Invalid code. Check with the coach and try again.');
                            return;
                          }

                          // Add child to team
                          const children = JSON.parse(localStorage.getItem('gameday_children') || '[]');
                          const idx = children.findIndex((c: any) => c.id === selectedChild.id);
                          if (idx !== -1) {
                            if (!children[idx].teamIds) children[idx].teamIds = [];
                            if (!children[idx].teamIds.includes(fTeam.id)) {
                              children[idx].teamIds.push(fTeam.id);
                            }
                            localStorage.setItem('gameday_children', JSON.stringify(children));
                            setSelectedChild({ ...selectedChild, teamIds: children[idx].teamIds });

                            // Child appears in squad via gameday_children — no addTeamMember needed

                            // Add parent to team if not already
                            StorageService.addTeamToUser(user.id, fTeam.id);
                            const savedUser = JSON.parse(localStorage.getItem('gameday_user') || '{}');
                            const updatedTeamIds = [...new Set([...(savedUser.teamIds || []), fTeam.id])];
                            savedUser.teamIds = updatedTeamIds;
                            localStorage.setItem('gameday_user', JSON.stringify(savedUser));
                            localStorage.setItem(`gameday_role_${user.id}_${fTeam.id}`, 'parent');
                            localStorage.setItem(`gameday_child_${user.id}_${fTeam.id}`, selectedChild.id);

                            // Sync to Firestore
                            try {
                              StorageService.syncChildToFirestore(children[idx]).catch(console.error);
                              await StorageService.syncTeamToFirestore(fTeam);
                              await StorageService.syncTeamMembersToFirestore(fTeam.id, JSON.parse(localStorage.getItem(`gameday_team_members_${fTeam.id}`) || '[]'));

                              await updateDoc(doc(db, 'users', user.id), {
                                teamIds: updatedTeamIds,
                              });
                              onUpdateUser({ teamIds: updatedTeamIds });
                            } catch (e) {
                              console.warn('Firestore child team join failed:', e);
                            }

                            window.dispatchEvent(new Event('gameday_update'));
                            setChildJoinedTeamName(fTeam.name);
                            setChildJoinStep('success');
                            setTimeout(() => {
                              setChildJoinStep('view');
                              setChildJoinCode('');
                            }, 2500);
                          }
                        }}
                        disabled={!childJoinCode}
                        className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        Join Team
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Current teams */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                          {(selectedChild.teamIds || []).length > 0 ? 'Current Teams' : 'No Teams Yet'}
                        </span>
                        {(selectedChild.teamIds || []).map((tid: string) => {
                          const allTeams = JSON.parse(localStorage.getItem('gameday_custom_teams') || '[]');
                          const team = allTeams.find((t: any) => t.id === tid);
                          return team ? (
                            <div key={tid} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                              <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                {team.logo ? (
                                  <img src={team.logo} alt={team.name} className="w-full h-full object-contain p-0.5" />
                                ) : (
                                  <Users className="w-4 h-4 text-slate-300" />
                                )}
                              </div>
                              <span className="text-xs font-bold text-slate-700">{team.name}</span>
                            </div>
                          ) : null;
                        })}
                      </div>

                      {/* Join a Team button */}
                      <button
                        onClick={() => setChildJoinStep('join')}
                        className="w-full h-12 bg-slate-900 text-white rounded-2xl
                                   text-[11px] font-black uppercase tracking-widest
                                   hover:bg-slate-800 active:scale-[0.98] transition-all
                                   shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Join a Team
                      </button>

                      {/* Remove Child button */}
                      <button
                        onClick={() => {
                          setConfirmRemoveChild({ name: selectedChild.name, message: `They will be removed from all teams.` });
                          setConfirmRemoveChildCallback(() => async () => {
                            const childId = selectedChild.id;
                            const childTeamIds: string[] = selectedChild.teamIds || [];

                            // 1. Remove child from gameday_children
                            const children = JSON.parse(localStorage.getItem('gameday_children') || '[]');
                            const idx = children.findIndex((c: any) => c.id === childId);
                            if (idx !== -1) {
                              const child = children[idx];
                              child.parentIds = (child.parentIds || []).filter((id: string) => id !== user.id);
                              child.parentNames = (child.parentNames || []).filter((n: string) => n !== user.name);

                              if (child.parentIds.length === 0) {
                                children.splice(idx, 1);
                                try {
                                  const { deleteDoc: delDoc } = await import('firebase/firestore');
                                  await delDoc(doc(db, 'children', childId));
                                } catch (e) {
                                  console.warn('Failed to delete child from Firestore:', e);
                                }
                              } else {
                                children[idx] = child;
                                StorageService.syncChildToFirestore(child).catch(console.error);
                              }
                              localStorage.setItem('gameday_children', JSON.stringify(children));
                            }

                            // 2. Remove child from team member lists
                            childTeamIds.forEach((tid: string) => {
                              StorageService.removeTeamMember(tid, childId);
                              localStorage.removeItem(`gameday_child_${user.id}_${tid}`);
                            });

                            // 3. Remove parent's team membership ONLY if they're solely a parent
                            const savedUser = JSON.parse(localStorage.getItem('gameday_user') || '{}');
                            const teamsToRemove: string[] = [];
                            childTeamIds.forEach((tid: string) => {
                              const role = localStorage.getItem(`gameday_role_${user.id}_${tid}`);
                              if (role === 'parent') {
                                teamsToRemove.push(tid);
                                localStorage.removeItem(`gameday_role_${user.id}_${tid}`);
                              }
                            });

                            if (teamsToRemove.length > 0) {
                              savedUser.teamIds = (savedUser.teamIds || []).filter((id: string) => !teamsToRemove.includes(id));
                              localStorage.setItem('gameday_user', JSON.stringify(savedUser));
                              const userData = JSON.parse(localStorage.getItem(`gameday_user_${user.id}`) || '{}');
                              userData.teamIds = (userData.teamIds || []).filter((id: string) => !teamsToRemove.includes(id));
                              localStorage.setItem(`gameday_user_${user.id}`, JSON.stringify(userData));
                              onUpdateUser({ teamIds: savedUser.teamIds });
                            }

                            // 4. Remove child from Firestore user children array
                            try {
                              const { arrayRemove } = await import('firebase/firestore');
                              await updateDoc(doc(db, 'users', user.id), {
                                children: arrayRemove(childId),
                                ...(teamsToRemove.length > 0 ? { teamIds: savedUser.teamIds } : {}),
                              });
                            } catch (e) {
                              console.warn('Firestore child removal sync failed:', e);
                            }

                            window.dispatchEvent(new Event('gameday_update'));
                            setSelectedChild(null);
                          });
                        }}
                        className="w-full h-10 rounded-2xl border border-red-200 bg-white text-red-400
                                   text-[9px] font-black uppercase tracking-widest
                                   hover:bg-red-50 active:scale-[0.98] transition-all
                                   flex items-center justify-center gap-2"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        Remove Child
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Remove Child Modal */}
        <AnimatePresence>
          {showRemoveChildModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowRemoveChildModal(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                           z-[70] w-[92%] max-w-sm bg-white rounded-[2rem] shadow-2xl
                           overflow-hidden max-h-[85vh] flex flex-col"
              >
                {/* Header */}
                <div className="bg-slate-900 p-6 flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-base font-black uppercase italic text-white leading-none">Remove a Child</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Select a child to remove</p>
                  </div>
                  <button
                    onClick={() => setShowRemoveChildModal(false)}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Children list */}
                <div className="p-5 space-y-3 overflow-y-auto">
                  {childrenList.map((child: any) => (
                      <motion.div
                        key={child.id}
                        layout
                        initial={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl"
                      >
                        <DefaultAvatar name={child.name} size="md" className="rounded-xl border-2 border-white shadow-sm shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm truncate">{child.name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold">
                            {child.age ? `Age ${child.age}` : ''}{child.teamIds?.length ? ` · ${child.teamIds.length} team${child.teamIds.length !== 1 ? 's' : ''}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setConfirmRemoveChild({ name: child.name, message: '' });
                            setConfirmRemoveChildCallback(() => async () => {
                              // Immediately remove from UI state
                              setChildrenList(prev => prev.filter(c => c.id !== child.id));

                              const children = JSON.parse(localStorage.getItem('gameday_children') || '[]');
                              const idx = children.findIndex((c: any) => c.id === child.id);

                              if (idx !== -1) {
                                const c = children[idx];
                                c.parentIds = (c.parentIds || []).filter((id: string) => id !== user.id);
                                c.parentNames = (c.parentNames || []).filter((n: string) => n !== user.name);

                                if (c.parentIds.length === 0) {
                                  children.splice(idx, 1);
                                  try {
                                    const { deleteDoc: delDoc } = await import('firebase/firestore');
                                    await delDoc(doc(db, 'children', child.id));
                                  } catch (e) {
                                    console.warn('Failed to delete child from Firestore:', e);
                                  }
                                } else {
                                  children[idx] = c;
                                  StorageService.syncChildToFirestore(c).catch(console.error);
                                }

                                localStorage.setItem('gameday_children', JSON.stringify(children));

                                (child.teamIds || []).forEach((tid: string) => {
                                  localStorage.removeItem(`gameday_child_${user.id}_${tid}`);
                                });

                                try {
                                  const { arrayRemove } = await import('firebase/firestore');
                                  await updateDoc(doc(db, 'users', user.id), {
                                    children: arrayRemove(child.id)
                                  });
                                } catch (e) {
                                  console.warn('Failed to update user children in Firestore:', e);
                                }

                                window.dispatchEvent(new Event('gameday_update'));

                                const remaining = children.filter((c: any) => c.parentIds?.includes(user.id));
                                if (remaining.length === 0) {
                                  setShowRemoveChildModal(false);
                                }
                              }
                            });
                          }}
                          className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-400 hover:bg-red-100 active:scale-95 transition-all shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Remove Child Confirmation Modal */}
      <AnimatePresence>
        {confirmRemoveChild && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[90]"
              onClick={() => { setConfirmRemoveChild(null); setConfirmRemoveChildCallback(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[95] w-[88%] max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-6">
                <h3 className="text-white text-base font-black uppercase tracking-tight">Remove Child</h3>
                <p className="text-slate-400 text-xs mt-1">This action cannot be undone</p>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-6">
                  Remove <span className="font-bold text-slate-900">{confirmRemoveChild?.name}</span> from your profile?{confirmRemoveChild?.message ? ` ${confirmRemoveChild.message}` : ''}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setConfirmRemoveChild(null); setConfirmRemoveChildCallback(null); }}
                    className="flex-1 h-11 rounded-2xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 active:scale-[0.98] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConfirmRemoveChild(null);
                      if (confirmRemoveChildCallback) {
                        confirmRemoveChildCallback();
                        setConfirmRemoveChildCallback(null);
                      }
                    }}
                    className="flex-1 h-11 rounded-2xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-600 active:scale-[0.98] transition-all"
                  >
                    Remove
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
