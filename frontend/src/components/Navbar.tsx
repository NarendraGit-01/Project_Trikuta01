import React from 'react';
import { Camera, FileText, Flame, Package, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeModel: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, activeModel }) => {
  const tabs = [
    { id: 'scan', label: 'Scan & OCR', telugu: 'రసీదు స్కాన్', icon: Camera },
    { id: 'receipts', label: 'Receipts', telugu: 'రసీదుల జాబితా', icon: FileText },
    { id: 'pooja', label: 'Sankalpam', telugu: 'పూజా సంకల్పం', icon: Flame },
    { id: 'dispatch', label: 'Dispatch', telugu: 'ప్రసాదం పంపిణీ', icon: Package },
    { id: 'gothrams', label: 'Gothrams (2,099)', telugu: 'గోత్రాలు', icon: BookOpen },
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

          {/* Model Status Badge */}
          <div className="flex items-center space-x-3">
            <div className="hidden lg:flex items-center space-x-2 bg-black/25 px-3 py-1.5 rounded-full border border-amber-400/30 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span className="text-amber-100 font-mono text-[11px]">{activeModel}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Connected" />
            </div>
            <div className="flex items-center space-x-1.5 bg-amber-900/60 px-2.5 py-1 rounded-md text-xs border border-amber-500/30">
              <span className="text-amber-200 font-medium">Staff</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
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
    </header>
  );
};
