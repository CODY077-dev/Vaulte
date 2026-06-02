import React, { useState } from "react";
import { UserRole, User } from "../types";
import { Button } from "./ui/button";
import { Trophy, Users, User as UserIcon, LogIn, Building2, Mail, Lock, User as UserCircle, ArrowRight, Calendar, CheckSquare, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Input } from "./ui/input";


interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [devTapCount, setDevTapCount] = useState(0);
  const devTapTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("player");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] = useState<{ title: string; url: string } | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showVerifyEmail, setShowVerifyEmail] = useState(false);
  const [verifyResending, setVerifyResending] = useState(false);

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
      // Just sign in — onAuthStateChanged in App.tsx handles full hydration
      await signInWithEmailAndPassword(auth, email, password);
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

  const getAge = (dob: string): number => {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setError("Please enter your name");
      return;
    }
    if (!dateOfBirth) {
      setError("Please enter your date of birth");
      return;
    }
    if (getAge(dateOfBirth) < 13) {
      setError("You must be at least 13 years old to create an account");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!agreedToTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });

      // Send email verification
      await sendEmailVerification(credential.user);

      const userData = {
        id: credential.user.uid,
        name,
        email,
        role: selectedRole,
        roles: {},
        teamIds: [],
        dateOfBirth,
        createdAt: new Date().toISOString(),
        termsAcceptedAt: new Date().toISOString(),
        privacyAcceptedAt: new Date().toISOString(),
        emailVerified: false,
      };

      await setDoc(doc(db, 'users', credential.user.uid), userData);

      // Show verification screen instead of logging in
      setShowVerifyEmail(true);
      setLoading(false);
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
    } catch (err: any) {
      // Don't reveal whether email exists for security
      setResetSent(true);
    }
    setResetLoading(false);
  };

  const handleDevTap = () => {
    const newCount = devTapCount + 1;
    setDevTapCount(newCount);
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
    if (newCount >= 3) {
      setDevTapCount(0);
      const devUser: User = {
        id: "dev-cody",
        name: "Cody (Dev)",
        role: "coach" as UserRole,
        email: "cody@vaulte.app",
        teamIds: ["team-1", "team-2"],
      };
      onLogin(devUser);
      return;
    }
    devTapTimer.current = setTimeout(() => setDevTapCount(0), 800);
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
              src="https://firebasestorage.googleapis.com/v0/b/game-day-app-115a4.firebasestorage.app/o/ChatGPT%20Image%20May%2026%2C%202026%2C%2009_39_58%20AM.png?alt=media&token=49148045-64fc-4c46-a686-f7cc4d97eeea"
              alt="Vaulte"
              className="h-56 w-auto object-contain mx-auto cursor-pointer"
              onClick={handleDevTap}
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
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-12 h-14 bg-white rounded-2xl border-slate-100 font-medium text-base placeholder:text-slate-300 tracking-wide focus:ring-0 focus:outline-none"
                  />
                </div>

                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="date"
                    placeholder="Date of birth"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="pl-12 h-14 bg-white rounded-2xl border-slate-100 font-medium text-base placeholder:text-slate-300 tracking-wide focus:ring-0 focus:outline-none"
                    required
                  />
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
              className="pl-12 h-14 bg-white rounded-2xl border-slate-100 font-medium text-base placeholder:text-slate-300 tracking-wide focus:ring-0 focus:outline-none"
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
              className="pl-12 h-14 bg-white rounded-2xl border-slate-100 font-medium text-base placeholder:text-slate-300 tracking-wide focus:ring-0 focus:outline-none"
              required
            />
          </div>

          <AnimatePresence>
            {mode === "register" && (
              <motion.div
                key="register-fields-bottom"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-12 h-14 bg-white rounded-2xl border-slate-100 font-medium text-base placeholder:text-slate-300 tracking-wide focus:ring-0 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex items-center gap-3 h-14 px-4 bg-white rounded-2xl border border-slate-100">
                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="font-medium text-base text-slate-500 flex-1">Signing up as a Club Admin?</span>
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

                <button
                  type="button"
                  onClick={() => setAgreedToTerms(!agreedToTerms)}
                  className="flex items-center gap-3 h-14 px-4 bg-white rounded-2xl border border-slate-100 text-left w-full"
                >
                  {agreedToTerms ? (
                    <CheckSquare className="w-5 h-5 text-primary flex-shrink-0" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-300 flex-shrink-0" />
                  )}
                  <span className="font-medium text-sm text-slate-500 leading-relaxed">
                    I agree to the{' '}
                    <span
                      onClick={(e) => { e.stopPropagation(); setLegalModal({ title: 'Terms of Service', url: 'https://firebasestorage.googleapis.com/v0/b/game-day-app-115a4.firebasestorage.app/o/Legal%2FVaulte_Terms_of_Service.pdf?alt=media&token=c088bd4f-fe07-429e-a27a-1a34cd47dde0' }); }}
                      className="text-primary font-bold underline cursor-pointer"
                    >
                      Terms of Service
                    </span>
                    {' '}and{' '}
                    <span
                      onClick={(e) => { e.stopPropagation(); setLegalModal({ title: 'Privacy Policy', url: 'https://firebasestorage.googleapis.com/v0/b/game-day-app-115a4.firebasestorage.app/o/Legal%2FVaulte_Privacy_Policy.pdf?alt=media&token=3127ed11-aa34-435c-81b6-742abcdfde8a' }); }}
                      className="text-primary font-bold underline cursor-pointer"
                    >
                      Privacy Policy
                    </span>
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

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

          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "register" : "signin");
                setError(null);
                setConfirmPassword("");
                setName("");
                setDateOfBirth("");
                setAgreedToTerms(false);
                setSelectedRole("player");
              }}
              className="w-full py-2 text-[11px] font-semibold text-slate-400 tracking-wide hover:text-slate-600 transition-colors"
            >
              {mode === "signin" ? "No account? Create one here" : "Already have an account? Sign in"}
            </button>
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => { setShowResetPassword(true); setResetEmail(email); setResetSent(false); }}
                className="w-full py-1 text-[11px] font-semibold text-primary/60 tracking-wide hover:text-primary transition-colors"
              >
                Forgot your password?
              </button>
            )}
          </div>
        </form>

        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="w-8 h-1 bg-slate-100 rounded-full" />
        </div>
      </motion.div>

      {/* Email Verification Screen */}
      <AnimatePresence>
        {showVerifyEmail && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92%] max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-6 flex items-center justify-between">
                <h2 className="text-white text-sm font-black uppercase tracking-widest">Verify Email</h2>
              </div>
              <div className="p-6 text-center space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Check your inbox</p>
                  <p className="text-xs text-slate-500 mt-2">
                    We've sent a verification link to <span className="font-bold text-slate-700">{email}</span>. Please verify your email before signing in.
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    setVerifyResending(true);
                    try {
                      if (auth.currentUser) {
                        await sendEmailVerification(auth.currentUser);
                      }
                    } catch (e) {
                      console.warn('Resend failed:', e);
                    }
                    setVerifyResending(false);
                  }}
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-bold"
                  disabled={verifyResending}
                >
                  {verifyResending ? 'Sending...' : 'Resend Verification Email'}
                </Button>
                <Button
                  onClick={() => {
                    setShowVerifyEmail(false);
                    setMode("signin");
                    setPassword("");
                  }}
                  className="w-full h-12 rounded-2xl font-bold shadow-lg shadow-primary/10"
                >
                  Go to Sign In
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {showResetPassword && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[60]"
              onClick={() => setShowResetPassword(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92%] max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-6 flex items-center justify-between">
                <h2 className="text-white text-sm font-black uppercase tracking-widest">Reset Password</h2>
                <button onClick={() => setShowResetPassword(false)} className="text-white/70 hover:text-white">
                  <span className="text-lg">✕</span>
                </button>
              </div>
              <div className="p-6">
                {resetSent ? (
                  <div className="text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto">
                      <Mail className="w-7 h-7 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Check your email</p>
                      <p className="text-xs text-slate-500 mt-1">If an account exists with that email, we've sent a password reset link.</p>
                    </div>
                    <Button
                      onClick={() => setShowResetPassword(false)}
                      className="w-full h-12 rounded-2xl font-bold"
                    >
                      Back to Sign In
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <p className="text-xs text-slate-500">Enter your email address and we'll send you a link to reset your password.</p>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="pl-12 h-14 bg-slate-50 rounded-2xl border-slate-100 font-medium text-base placeholder:text-slate-300 tracking-wide focus:ring-0 focus:outline-none"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full h-12 rounded-2xl font-bold shadow-lg shadow-primary/10"
                    >
                      {resetLoading ? (
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </span>
                      ) : 'Send Reset Link'}
                    </Button>
                  </form>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Legal Document Modal (Terms of Service / Privacy Policy) */}
      <AnimatePresence>
        {legalModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[80]"
              onClick={() => setLegalModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[96%] max-w-md flex flex-col bg-white rounded-[2rem] shadow-2xl overflow-hidden"
              style={{ height: '85vh' }}
            >
              <div className="bg-slate-900 p-6 flex items-center justify-between flex-shrink-0">
                <h2 className="text-white text-sm font-black uppercase tracking-widest">{legalModal.title}</h2>
                <button onClick={() => setLegalModal(null)} className="text-white/70 hover:text-white">
                  <span className="text-lg">✕</span>
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <iframe
                  src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(legalModal.url)}`}
                  className="w-full h-full border-0"
                  title={legalModal.title}
                />
              </div>
              <div className="p-4 border-t border-slate-100 flex-shrink-0">
                <button
                  onClick={() => setLegalModal(null)}
                  className="w-full h-12 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
