import React, { useEffect, useRef } from 'react';
import { AppRoute } from '../types';
import { LayoutDashboard, ScanEye, Radio, FileText, Menu, X, BrainCircuit, History, LogOut } from 'lucide-react';
import { getCurrentUser, logout } from '../services/authService';

interface LayoutProps {
  children: React.ReactNode;
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentRoute, onNavigate }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const user = getCurrentUser();
  const bgRef = useRef<HTMLDivElement>(null);

  // Parallax Background Effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (bgRef.current) {
        const x = (e.clientX / window.innerWidth) * 20;
        const y = (e.clientY / window.innerHeight) * 20;
        bgRef.current.style.transform = `translate(-${x}px, -${y}px)`;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const navItems = [
    { id: AppRoute.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: AppRoute.ANALYSIS, label: 'Vision Tasks', icon: ScanEye },
    { id: AppRoute.STREAM, label: 'Live Vision', icon: Radio },
    { id: AppRoute.HISTORY, label: 'Task History', icon: History },
    { id: AppRoute.REPORTS, label: 'Reports', icon: FileText },
  ];

  const handleLogout = () => {
      logout();
      window.location.reload();
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 font-sans overflow-hidden relative">
      {/* Dynamic Background Layers */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div ref={bgRef} className="absolute inset-[-50px] opacity-30 transition-transform duration-75 ease-out">
            <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-primary-600/20 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[20%] right-[10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px]"></div>
            <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[80px]"></div>
        </div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      </div>

      {/* Floating Sidebar */}
      <aside 
        className={`fixed inset-y-4 left-4 z-50 w-64 glass-panel rounded-2xl flex flex-col transition-transform duration-300 ease-out shadow-2xl ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-[120%]'
        } md:translate-x-0 md:static md:h-[calc(100vh-2rem)] md:my-4 md:ml-4`}
      >
        <div className="flex items-center justify-between h-20 px-6 shrink-0 relative">
            <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
            <div className="flex items-center gap-3 text-primary-400 group cursor-pointer">
                <div className="relative">
                    <BrainCircuit size={32} className="transition-transform group-hover:rotate-12" />
                    <div className="absolute inset-0 bg-primary-400 blur-lg opacity-40 animate-pulse"></div>
                </div>
                <div>
                    <span className="text-xl font-bold tracking-tight text-white block leading-none">VisionAI</span>
                    <span className="text-[10px] text-primary-400/70 font-mono tracking-widest">THESIS.v1</span>
                </div>
            </div>
            <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="md:hidden text-slate-400 hover:text-white"
            >
                <X size={24} />
            </button>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={`group relative flex items-center w-full gap-3 px-4 py-3.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                currentRoute === item.id
                  ? 'bg-gradient-to-r from-primary-600/20 to-primary-600/5 text-white shadow-lg shadow-primary-900/20 border border-primary-500/20'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white hover:translate-x-1'
              }`}
            >
              {currentRoute === item.id && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-500 rounded-r-full shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>
              )}
              <item.icon size={20} className={`transition-colors ${currentRoute === item.id ? 'text-primary-400' : 'text-slate-500 group-hover:text-white'}`} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 mt-auto">
            <div className="glass-panel-deep p-4 rounded-xl border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center font-bold text-sm text-white shadow-lg">
                    {user?.username.substring(0, 2).toUpperCase() || 'US'}
                    </div>
                    <div className="overflow-hidden">
                    <p className="text-sm font-bold text-white truncate">{user?.username || 'User'}</p>
                    <p className="text-[10px] text-emerald-400 truncate flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                        Online
                    </p>
                    </div>
                </div>
                <button 
                    onClick={handleLogout}
                    className="flex items-center justify-center w-full gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 bg-slate-800/50 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-all border border-slate-700 hover:border-red-500/30"
                >
                    <LogOut size={14} />
                    Sign Out
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative z-10">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4 md:hidden">
             <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="text-slate-400 hover:text-white p-2 bg-slate-800/50 rounded-lg"
             >
                <Menu size={24} />
             </button>
             <span className="font-bold text-white">VisionAI</span>
          </div>
          
          <div className="hidden md:block">
              <h2 className="text-slate-400 text-sm font-medium">
                  Welcome back, <span className="text-white">{user?.username}</span>
              </h2>
          </div>

          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 backdrop-blur rounded-full border border-slate-700/50">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] text-slate-300 font-mono uppercase tracking-wider">System Stable</span>
             </div>
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 pt-0 perspective-container">
          <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;