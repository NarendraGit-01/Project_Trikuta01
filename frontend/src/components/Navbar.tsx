import React, { useState } from 'react';
import { Camera, FileText, Flame, Package, Folder, Sparkles, CheckCircle2, LogOut, User, KeyRound, X, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { AuthUser, changePassword } from '../services/api';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeModel: string;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  selectedYear: number | null;
  onSelectYear: (year: number | null) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  activeModel,
  currentUser,
  onLogout,
  selectedYear,
  onSelectYear,
}) => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState<string | null>(null);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError(null);
    setChangeSuccess(null);

    if (newPassword.length < 6) {
      setChangeError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const msg = await changePassword(currentPassword, newPassword);
      setChangeSuccess(msg);
      setTimeout(() => {
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setChangeSuccess(null);
      }, 2000);
    } catch (err: any) {
      setChangeError(err.message || 'Failed to update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };
  const tabs = [
    { id: 'books', label: 'Books', telugu: 'పుస్తకాలు', icon: Folder },
    { id: 'scan', label: 'Scan & OCR', telugu: 'రసీదు స్కాన్', icon: Camera },
    { id: 'receipts', label: 'Receipts', telugu: 'రసీదుల జాబితా', icon: FileText },
    { id: 'pooja', label: 'Sankalpam', telugu: 'పూజా సంకల్పం', icon: Flame },
    { id: 'dispatch', label: 'Dispatch', telugu: 'ప్రసాదం పంపిణీ', icon: Package },
  ];

  return (
    <header className="bg-gradient-to-r from-amber-800 via-amber-700 to-red-800 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Temple Crest & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab('scan')}>
            <div className="w-12 h-12 rounded-full bg-amber-100/20 border-2 border-amber-300 flex items-center justify-center shadow-inner text-amber-200">
              <span className="text-2xl font-bold font-serif">🕉️</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold tracking-tight text-white font-telugu">
                  శ్రీ త్రికోటేశ్వర స్వామి వారి దేవస్థానము
                </h1>
                <span className="text-xs bg-amber-400/20 border border-amber-300/40 text-amber-200 px-2 py-0.5 rounded-full font-mono font-medium">
                  కోటప్పకొండ
                </span>
              </div>
              <p className="text-xs text-amber-100/80 font-sans tracking-wide">
                Sri Trikoteswara Swamy Temple • Receipt OCR & Management System
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex flex-col items-center px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white/20 text-white shadow-sm border-b-2 border-amber-300 font-semibold'
                      : 'text-amber-100/90 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-1.5">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                  <span className="text-[10px] text-amber-200/80 font-telugu mt-0.5">{tab.telugu}</span>
                </button>
              );
            })}
          </nav>

          {/* Global Year Selector & Model & Auth */}
          <div className="flex items-center space-x-2.5">
            {/* Year Selector */}
            <div className="flex items-center space-x-1.5 bg-black/30 hover:bg-black/45 px-2.5 py-1.5 rounded-lg border border-amber-400/40 text-xs shadow-inner">
              <Calendar className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
              <span className="text-amber-200 font-semibold text-[11px] hidden xl:inline">సంవత్సరం:</span>
              <select
                value={selectedYear ?? ''}
                onChange={(e) => onSelectYear(e.target.value ? Number(e.target.value) : null)}
                className="bg-transparent text-amber-100 font-bold font-mono text-xs focus:outline-none cursor-pointer"
                title="Global Year Filter - filters all books, receipts, and scans"
              >
                <option value="" className="text-gray-900 bg-white">All Years (అన్నీ)</option>
                <option value="2027" className="text-gray-900 bg-white">2027</option>
                <option value="2026" className="text-gray-900 bg-white">2026</option>
                <option value="2025" className="text-gray-900 bg-white">2025</option>
                <option value="2024" className="text-gray-900 bg-white">2024</option>
              </select>
            </div>

            <div className="hidden lg:flex items-center space-x-2 bg-black/25 px-3 py-1.5 rounded-full border border-amber-400/30 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span className="text-amber-100 font-mono text-[11px]">{activeModel}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Connected" />
            </div>
            {currentUser ? (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1.5 bg-amber-900/70 px-2.5 py-1 rounded-lg text-xs border border-amber-500/40">
                  <User className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-amber-100 font-medium font-mono">
                    {currentUser.username}
                  </span>
                  <span className="text-[10px] bg-amber-400/20 text-amber-200 px-1 py-0.2 rounded font-bold uppercase">
                    {currentUser.role}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPasswordModal(true)}
                  title="Change Password (పాస్‌వర్డ్ మార్చండి)"
                  className="flex items-center space-x-1 px-2.5 py-1 bg-amber-900/60 hover:bg-amber-800 text-amber-200 hover:text-white rounded-lg text-xs border border-amber-500/40 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Password</span>
                </button>

                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    title="Log Out (నిష్క్రమించు)"
                    className="flex items-center space-x-1 px-2.5 py-1 bg-red-950/60 hover:bg-red-900 text-red-200 hover:text-white rounded-lg text-xs border border-red-500/30 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 bg-amber-900/60 px-2.5 py-1 rounded-md text-xs border border-amber-500/30">
                <span className="text-amber-200 font-medium">Staff</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-2 border-t border-amber-600/40 items-center">
          <div className="flex items-center space-x-1 bg-black/30 px-2 py-1 rounded-md text-xs border border-amber-400/40 flex-shrink-0">
            <Calendar className="w-3 h-3 text-amber-300" />
            <select
              value={selectedYear ?? ''}
              onChange={(e) => onSelectYear(e.target.value ? Number(e.target.value) : null)}
              className="bg-transparent text-amber-100 font-bold font-mono text-[11px] focus:outline-none"
            >
              <option value="" className="text-gray-900 bg-white">All</option>
              <option value="2027" className="text-gray-900 bg-white">2027</option>
              <option value="2026" className="text-gray-900 bg-white">2026</option>
              <option value="2025" className="text-gray-900 bg-white">2025</option>
              <option value="2024" className="text-gray-900 bg-white">2024</option>
            </select>
          </div>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs whitespace-nowrap ${
                  isActive ? 'bg-white/20 text-white font-bold' : 'text-amber-100 hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 text-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-amber-700" />
                <h3 className="text-base font-bold text-gray-900">పాస్‌వర్డ్ మార్చండి (Change Password)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {changeError && (
              <div className="mb-4 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{changeError}</span>
              </div>
            )}

            {changeSuccess && (
              <div className="mb-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{changeSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ప్రస్తుత పాస్‌వర్డ్ (Current Password)</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 outline-none focus:border-amber-600 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">కొత్త పాస్‌వర్డ్ (New Password)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 outline-none focus:border-amber-600 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">పాస్‌వర్డ్ నిర్ధారణ (Confirm New Password)</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 outline-none focus:border-amber-600 focus:bg-white"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow"
                >
                  {isChangingPassword ? 'Updating...' : 'పాస్‌వర్డ్ మార్చండి'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
