import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle, Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { loginUser, resetPassword, AuthUser } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password Reset View State
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('narendra.r10109@gmail.com');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSuccessNotice, setResetSuccessNotice] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('దయచేసి యూజర్‌నేమ్ మరియు పాస్‌వర్డ్ నమోదు చేయండి (Please enter your username and password)');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const user = await loginUser(username.trim(), password);
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect username or password. దయచేసి వివరాలను సరిచూసుకోండి.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetSuccessNotice(null);

    if (!resetEmail.trim()) {
      setErrorMessage('Please enter your registered administrator email address.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match. దయచేసి రెండుసార్లు ఒకే పాస్‌వర్డ్ ఇవ్వండి.');
      return;
    }

    setIsLoading(true);
    try {
      const msg = await resetPassword(resetEmail.trim(), newPassword);
      setResetSuccessNotice(msg);
      setUsername(resetEmail.trim());
      setPassword(newPassword);
      setTimeout(() => {
        setIsResetMode(false);
        setResetSuccessNotice(null);
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Password reset failed. Please ensure the email is registered.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-red-700/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-amber-900/10 overflow-hidden relative z-10 animate-fade-in">
        {/* Header with Temple Branding */}
        <div className="bg-gradient-to-r from-amber-800 via-amber-700 to-red-800 p-8 text-center text-white relative">
          <div className="inline-flex w-16 h-16 rounded-full bg-amber-100/20 border-2 border-amber-300 items-center justify-center shadow-inner text-amber-200 mb-3">
            <span className="text-3xl font-serif">🕉️</span>
          </div>

          <h2 className="text-xl font-bold font-telugu text-white">
            శ్రీ త్రికోటేశ్వర స్వామి వారి దేవస్థానము
          </h2>
          <div className="inline-block mt-1 bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
            కోటప్పకొండ • Kotappakonda
          </div>
          <p className="text-xs text-amber-100/90 mt-2 font-medium">
            {isResetMode ? 'Password Reset Portal' : 'Devasthanam Management Portal'}
          </p>
        </div>

        {/* Card Body */}
        <div className="p-8">
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start space-x-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {resetSuccessNotice && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{resetSuccessNotice}</span>
            </div>
          )}

          {!isResetMode ? (
            /* ── Sign In Form ────────────────────────── */
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              {/* Username Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  యూజర్‌నేమ్ (Username / Email)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your registered username or email"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/20 rounded-xl text-sm transition-all text-gray-900 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    పాస్‌వర్డ్ (Password)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(true);
                      setErrorMessage(null);
                    }}
                    className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold transition-colors"
                  >
                    Forgot Password? (మర్చిపోయారా?)
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-300 focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/20 rounded-xl text-sm transition-all text-gray-900 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-800/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>లాగిన్ అవుతోంది (Authenticating)...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>లాగిన్ అవ్వండి (Sign In)</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ── Reset Password Form ─────────────────── */
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="text-xs text-gray-600 mb-2">
                Enter your registered administrator email to set a new password.
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  నమోదిత ఇమెయిల్ (Registered Email)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="e.g. narendra.r10109@gmail.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/20 rounded-xl text-sm transition-all text-gray-900 outline-none"
                    required
                  />
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  కొత్త పాస్‌వర్డ్ (New Password)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/20 rounded-xl text-sm transition-all text-gray-900 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  పాస్‌వర్డ్ నిర్ధారణ (Confirm New Password)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/20 rounded-xl text-sm transition-all text-gray-900 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Submit Reset */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-sm rounded-xl shadow transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <span>రీసెట్ అవుతోంది (Resetting)...</span>
                ) : (
                  <span>పాస్‌వర్డ్ మార్చండి (Update Password)</span>
                )}
              </button>

              {/* Return to Login */}
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setErrorMessage(null);
                }}
                className="w-full py-2 text-xs text-gray-600 hover:text-gray-900 font-semibold flex items-center justify-center space-x-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>తిరిగి లాగిన్ అవ్వండి (Back to Sign In)</span>
              </button>
            </form>
          )}
        </div>

        {/* Security Footer Note */}
        <div className="bg-slate-50 px-8 py-3.5 border-t border-gray-100 text-center text-[10px] text-gray-500 flex items-center justify-center space-x-1.5">
          <Lock className="w-3 h-3 text-amber-700" />
          <span>Protected Temple Portal • Authorized Access Only</span>
        </div>
      </div>
    </div>
  );
};
