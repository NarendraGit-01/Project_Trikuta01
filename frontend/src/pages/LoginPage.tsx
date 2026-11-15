import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { loginUser, AuthUser } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('దయచేసి వినియోగదారు పేరు మరియు పాస్‌వర్డ్ నమోదు చేయండి (Please enter username and password)');
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

  const handleQuickFill = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setErrorMessage(null);
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
            Devasthanam Staff & Administration Login
          </p>
        </div>

        {/* Login Form Body */}
        <div className="p-8">
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start space-x-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                యూజర్‌నేమ్ (Username)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. staff or admin"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/20 rounded-xl text-sm transition-all text-gray-900 outline-none"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                పాస్‌వర్డ్ (Password)
              </label>
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

          {/* Quick Pre-configured Credentials for Temple Staff */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-500 mb-2 font-medium">
              అధికారిక సిబ్బంది క్రెడెన్షియల్స్ (Staff Quick-Fill):
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('staff', 'staff123')}
                className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold transition-colors"
              >
                Staff (staff / staff123)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('admin', 'admin123')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-semibold transition-colors"
              >
                Admin (admin / admin123)
              </button>
            </div>
          </div>
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
