import React, { useState } from "react";
import { UserRole, User } from "../types";
import { Button } from "./ui/button";
import { Trophy, Users, User as UserIcon, LogIn, Building2, Mail, Lock, User as UserCircle, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Input } from "./ui/input";

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("player");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuthSuccess = async (uid: string) => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const user: User = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        roles: data.roles || {},
        teamIds: data.teamIds || [],
        avatar: data.avatar,
        clubId: data.clubId,
      };
      onLogin(user);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await handleAuthSuccess(credential.user.uid);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Invalid email or password");
      } else {
        setError("An error occurred during sign in");
      }
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setError("Please enter your name");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      
      const userData = {
        id: credential.user.uid,
        name,
        email,
        role: selectedRole,
        roles: {},
        teamIds: [],
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', credential.user.uid), userData);
      
      const user: User = {
        id: credential.user.uid,
        name,
        role: selectedRole,
        roles: {},
        teamIds: [],
        email,
      };
      onLogin(user);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Email already in use");
      } else if (err.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters");
      } else {
        setError("An error occurred during registration");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm z-10"
      >
        <div className="text-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-4 flex items-center justify-center"
          >
            <img
              src="https://firebasestorage.googleapis.com/v0/b/game-day-app-115a4.firebasestorage.app/o/AULT%20(2).png?alt=media&token=dc3c82da-4ac7-4a4e-b635-8a9ed6223e46"
              alt="Vaulte"
              className="h-48 w-auto object-contain"
            />
          </motion.div>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[8px] text-center">
            {mode === "signin" ? "Sign in to your account" : "Create your profile"}
          </p>
        </div>

        <form onSubmit={mode === "signin" ? handleSignIn : handleRegister} className="space-y-4">
          <AnimatePresence mode="wait">
            {mode === "register" && (
              <motion.div
                key="register-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="relative">
                  <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="FULL NAME"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-12 h-14 bg-white rounded-2xl border-slate-100 font-bold text-base placeholder:text-slate-300 uppercase tracking-widest focus:ring-primary/10"
                  />
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100">
                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex-1">Signing up as a Club Admin?</span>
                  <button
                    type="button"
                    onClick={() => setSelectedRole(selectedRole === 'club' ? 'player' : 'club')}
                    className={`w-10 h-6 rounded-full transition-all flex-shrink-0 ${
                      selectedRole === 'club' ? 'bg-primary' : 'bg-slate-200'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-all mx-1 ${
                      selectedRole === 'club' ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-12 h-14 bg-white rounded-2xl border-slate-100 font-medium text-base placeholder:text-slate-300 tracking-wide focus:ring-primary/10"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-12 h-14 bg-white rounded-2xl border-slate-100 font-medium text-base placeholder:text-slate-300 tracking-wide focus:ring-primary/10"
              required
            />
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center"
            >
              {error}
            </motion.p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-primary text-white font-bold tracking-wide text-sm shadow-xl shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {mode === "signin" ? (
                  <>Sign In <LogIn className="w-4 h-4" /></>
                ) : (
                  <>Create Account <ArrowRight className="w-4 h-4" /></>
                )}
              </span>
            )}
          </Button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "register" : "signin");
              setError(null);
            }}
            className="w-full py-2 text-[11px] font-semibold text-slate-400 tracking-wide hover:text-slate-600 transition-colors"
          >
            {mode === "signin" ? "No account? Create one here" : "Already have an account? Sign in"}
          </button>
        </form>

        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="w-8 h-1 bg-slate-100 rounded-full" />
        </div>
      </motion.div>
    </div>
  );
}
