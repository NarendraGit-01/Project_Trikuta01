import React, { useState, useRef, useEffect } from 'react';
import { Camera, FileText, Flame, Package, Folder, Sparkles, LogOut, User, KeyRound, X, CheckCircle, AlertCircle } from 'lucide-react';
import { AuthUser, changePassword } from '../services/api';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeModel: string;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  activeModel,
  currentUser,
  onLogout,
}) => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Reordered: Scan & OCR is 1st, Receipts is 2nd, Books is 3rd
  const tabs = [
    { id: 'scan', label: 'Scan & OCR', telugu: 'రసీదు స్కాన్', icon: Camera },
    { id: 'receipts', label: 'Receipts', telugu: 'రసీదుల జాబితా', icon: FileText },
    { id: 'books', label: 'Books', telugu: 'పుస్తకాలు', icon: Folder },
    { id: 'pooja', label: 'Sankalpam', telugu: 'పూజా సంకల్పం', icon: Flame },
    { id: 'dispatch', label: 'Dispatch', telugu: 'ప్రసాదం పంపిణీ', icon: Package },
  ];

  return (
    <header className="bg-gradient-to-r from-amber-900 via-amber-800 to-red-900 text-white shadow-lg sticky top-0 z-50">
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* ── 1. Temple Crest & App Brand (Organized cleanly on left) ── */}
          <div
            className="flex items-center space-x-3 cursor-pointer flex-shrink-0 select-none group"
            onClick={() => onSelectTab('scan')}
            title="Sri Trikoteswara Swamy Temple OCR System"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-amber-100/15 border-2 border-amber-300 flex items-center justify-center shadow-inner text-amber-200 flex-shrink-0 group-hover:bg-amber-100/25 transition-colors">
              <span className="text-xl sm:text-2xl font-serif">🕉️</span>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-white font-telugu whitespace-nowrap leading-tight">
                  శ్రీ త్రికోటేశ్వర స్వామి వారి దేవస్థానము
                </h1>
                <span className="text-[10px] bg-amber-400/25 border border-amber-300/40 text-amber-200 px-2 py-0.5 rounded-full font-mono font-semibold whitespace-nowrap">
                  కోటప్పకొండ
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-amber-100/85 font-sans tracking-wide whitespace-nowrap leading-tight mt-0.5">
                Sri Trikoteswara Swamy Devasthanam • Receipt OCR System
              </p>
            </div>
          </div>

          {/* ── 2. Navigation Tabs (Scan 1st, Receipts 2nd, Books 3rd) ── */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5 flex-shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex flex-col items-center px-3.5 lg:px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white/20 text-white shadow-sm border-b-2 border-amber-300 font-semibold'
                      : 'text-amber-100/85 hover:bg-white/10 hover:text-white'
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

          {/* ── 3. Right Controls: Model indicator + User Profile Icon ── */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            {/* AI Model Badge */}
            <div className="hidden xl:flex items-center space-x-2 bg-black/25 px-3 py-1.5 rounded-full border border-amber-400/30 text-xs shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span className="text-amber-100 font-mono text-[11px]">{activeModel}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Connected" />
            </div>

            {/* User Icon with Dropdown Menu Popover */}
            {currentUser ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-10 h-10 rounded-full bg-amber-950/70 hover:bg-amber-900 border-2 border-amber-400/50 hover:border-amber-300 flex items-center justify-center text-amber-200 hover:text-white shadow-md transition-all focus:outline-none relative group"
                  title="Account Settings & Profile"
                >
                  <User className="w-5 h-5 text-amber-200 group-hover:scale-105 transition-transform" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-amber-900" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2.5 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 py-2.5 z-50 text-gray-900 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Signed in as</div>
                      <div className="font-semibold text-xs text-gray-900 truncate mt-0.5" title={currentUser.username}>
                        {currentUser.username}
                      </div>
                      <div className="inline-block mt-1 text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded uppercase">
                        {currentUser.role}
                      </div>
                    </div>
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowPasswordModal(true);
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-900 flex items-center space-x-2 transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                        <span>Change Password (పాస్‌వర్డ్ మార్చండి)</span>
                      </button>
                      {onLogout && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserMenu(false);
                            onLogout();
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2 transition-colors border-t border-gray-100 mt-1"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Log Out (నిష్క్రమించు)</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-amber-900/60 border border-amber-500/40 flex items-center justify-center text-amber-200 text-xs">
                <User className="w-4 h-4 text-amber-300" />
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-2 border-t border-amber-600/40">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${
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
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Current Password:</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">New Password:</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm New Password:</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {changeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{changeError}</span>
                </div>
              )}

              {changeSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-800">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{changeSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow transition-colors disabled:opacity-50"
                >
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
