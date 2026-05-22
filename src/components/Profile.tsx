import React, { useState, useRef, useEffect } from "react";
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
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
  UserMinus
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

  useEffect(() => {
    setEditName(user.name);
    setEditEmail(user.email || "");
    setEditPhone(user.phone || "");
  }, [user.name, user.email, user.phone]);

  const [notifications, setNotifications] = useState({
    push: true,
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

  const menuItems = [
    { icon: UserIcon, label: "Profile Info", color: "text-orange-500", bg: "bg-orange-50" },
    { icon: Bell, label: "Notifications", color: "text-blue-500", bg: "bg-blue-50" },
    { icon: Shield, label: "Privacy & Security", color: "text-purple-500", bg: "bg-purple-50" },
    { icon: CreditCard, label: "Subscription", color: "text-amber-500", bg: "bg-amber-50" },
    { icon: Settings, label: "App Settings", color: "text-slate-500", bg: "bg-slate-50" },
  ];

  const defaultStats = [
    { label: "Games", value: "12", icon: Activity },
    { label: "Teams", value: "3", icon: Users },
    { label: "Trophies", value: "5", icon: Trophy },
  ];

  const stats = user.role === "supporter" ? [] : defaultStats;

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
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
                  
                  {isViewingSelf && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="flex items-center gap-1 px-3 py-1 rounded-full border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors active:scale-95"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit Profile
                      </button>
                      
                      {(user.role !== 'coach' && user.role !== 'club') && (
                        <button
                          onClick={() => setShowChildModal(true)}
                          className="flex items-center gap-1 px-3 py-1 rounded-full border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors active:scale-95"
                        >
                          <Users className="w-3 h-3 text-primary" />
                          Link a Child
                        </button>
                      )}
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

        {/* Menu Section */}
        {isViewingSelf && (
          <div className="grid">
            <div className="px-6 mb-4">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Account Settings</h2>
            </div>
            <div className="">
              {menuItems.map((item, index) => (
                <div key={item.label}>
                  <Dialog open={activeSetting === item.label} onOpenChange={(open) => setActiveSetting(open ? item.label : null)}>
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
                    <DialogContent showCloseButton={false} className="sm:max-w-[400px] rounded-[2.5rem] border-none p-0 overflow-hidden bg-white">
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
                    
                    <div className="p-6 space-y-4">
                      {item.label === "Profile Info" && (
                        <div className="space-y-4">
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
  
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Phone Number</label>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                type="tel"
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value)}
                                placeholder="+1 (555) 000-0000"
                                className="w-full h-12 bg-slate-50 rounded-xl pl-12 pr-4 text-xs font-bold border-none focus:ring-2 focus:ring-primary/20 outline-none"
                              />
                            </div>
                          </div>
  
                          <p className="text-[8px] font-bold text-slate-400 px-1 leading-tight">
                            Changing your name will update it across all team rosters and official game sheets.
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
                                onClick={() => setNotifications(prev => ({ ...prev, [key]: !value }))}
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
                                    onClick={() => {
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
                                      
                                      // Success — in production this calls Firebase Auth
                                      // For now simulate success
                                      setPasswordSuccess(true);
                                      setTimeout(() => {
                                        setIsChangingPassword(false);
                                        setPasswordSuccess(false);
                                        setPasswordForm({ current: '', newPass: '', confirm: '' });
                                      }, 2000);
                                    }}
                                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 
                                               text-white rounded-2xl text-[11px] font-black 
                                               uppercase tracking-widest transition-all 
                                               active:scale-[0.98]"
                                  >
                                    Update Password
                                  </button>
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
                              phone: editPhone
                            });
                            StorageService.updateUserData(user.id, { 
                              name: editName,
                              email: editEmail,
                              phone: editPhone
                            });

                            try {
                              await updateDoc(doc(db, 'users', user.id), {
                                name: editName,
                                email: editEmail,
                                phone: editPhone
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
                          onClick={async () => {
                            if (!confirm(`Remove ${child.name} from your profile?`)) return;

                            // Immediately remove from UI state
                            setChildrenList(prev => prev.filter(c => c.id !== child.id));

                            const children = JSON.parse(localStorage.getItem('gameday_children') || '[]');
                            const idx = children.findIndex((c: any) => c.id === child.id);

                            if (idx !== -1) {
                              const c = children[idx];
                              // Remove this parent from the child's parentIds/parentNames
                              c.parentIds = (c.parentIds || []).filter((id: string) => id !== user.id);
                              c.parentNames = (c.parentNames || []).filter((n: string) => n !== user.name);

                              if (c.parentIds.length === 0) {
                                // No parents left — remove the child entirely
                                children.splice(idx, 1);
                                // Clean up Firestore
                                try {
                                  const { deleteDoc } = await import('firebase/firestore');
                                  await deleteDoc(doc(db, 'children', child.id));
                                } catch (e) {
                                  console.warn('Failed to delete child from Firestore:', e);
                                }
                              } else {
                                // Other parents remain — just update
                                children[idx] = c;
                                StorageService.syncChildToFirestore(c).catch(console.error);
                              }

                              localStorage.setItem('gameday_children', JSON.stringify(children));

                              // Remove child link keys for all teams
                              (child.teamIds || []).forEach((tid: string) => {
                                localStorage.removeItem(`gameday_child_${user.id}_${tid}`);
                              });

                              // Remove user from Firestore children array
                              try {
                                const { arrayRemove } = await import('firebase/firestore');
                                await updateDoc(doc(db, 'users', user.id), {
                                  children: arrayRemove(child.id)
                                });
                              } catch (e) {
                                console.warn('Failed to update user children in Firestore:', e);
                              }

                              window.dispatchEvent(new Event('gameday_update'));

                              // Close modal if no children left
                              const remaining = children.filter((c: any) => c.parentIds?.includes(user.id));
                              if (remaining.length === 0) {
                                setShowRemoveChildModal(false);
                              }
                            }
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
    </div>
  );
}
