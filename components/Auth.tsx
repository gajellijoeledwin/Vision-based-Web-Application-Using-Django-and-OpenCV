import React, { useState, useRef, useEffect } from 'react';
import { User, AppRoute } from '../types';
import { login, register } from '../services/authService';
import { BrainCircuit, Lock, Mail, User as UserIcon, Loader2, ArrowRight } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
  initialRoute?: AppRoute;
}

const Auth: React.FC<AuthProps> = ({ onLogin, initialRoute = AppRoute.LOGIN }) => {
  const [mode, setMode] = useState<AppRoute>(initialRoute);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  
  // 3D Parallax for Auth
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (!cardRef.current || !containerRef.current) return;
        
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;
        
        // Calculate rotation (max 10deg)
        const x = (clientX - innerWidth / 2) / innerWidth;
        const y = (clientY - innerHeight / 2) / innerHeight;
        
        cardRef.current.style.transform = `
            perspective(1000px) 
            rotateY(${x * 10}deg) 
            rotateX(${-y * 10}deg)
            translateZ(0)
        `;

        // Parallax background blobs
        const blobs = containerRef.current.querySelectorAll('.parallax-blob');
        blobs.forEach((blob: any, index) => {
            const speed = (index + 1) * 20;
            blob.style.transform = `translate(${-x * speed}px, ${-y * speed}px)`;
        });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
        let user;
        if (mode === AppRoute.LOGIN) {
            user = await login(formData.username, formData.password);
        } else {
            user = await register(formData);
        }
        onLogin(user);
    } catch (err) {
        setError('Authentication failed. Please try again.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen flex items-center justify-center bg-[#020617] p-6 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 pointer-events-none">
             <div className="parallax-blob absolute top-[-10%] left-[-10%] w-[700px] h-[700px] bg-primary-600/20 rounded-full blur-[120px] animate-pulse-slow"></div>
             <div className="parallax-blob absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-slow" style={{animationDelay: '1s'}}></div>
             <div className="parallax-blob absolute top-[40%] left-[40%] w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px]"></div>
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        </div>

        <div ref={cardRef} className="w-full max-w-md relative z-10 transition-transform duration-100 ease-out will-change-transform">
            <div className="glass-panel p-10 rounded-3xl shadow-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl">
                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-gradient-to-tr from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-500/30 transform hover:rotate-12 transition-transform duration-500">
                        <BrainCircuit size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">VisionAI</h1>
                    <p className="text-slate-400 mt-2">Final Year Thesis Platform</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {mode === AppRoute.REGISTER && (
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-400 transition-colors" size={20} />
                            <input 
                                type="email" 
                                placeholder="University Email"
                                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-white placeholder:text-slate-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all hover:bg-slate-950/80"
                                required
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                    )}
                    
                    <div className="relative group">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-400 transition-colors" size={20} />
                        <input 
                            type="text" 
                            placeholder="Username"
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-white placeholder:text-slate-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all hover:bg-slate-950/80"
                            required
                            value={formData.username}
                            onChange={e => setFormData({...formData, username: e.target.value})}
                        />
                    </div>

                    <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-400 transition-colors" size={20} />
                        <input 
                            type="password" 
                            placeholder="Password"
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-white placeholder:text-slate-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all hover:bg-slate-950/80"
                            required
                            value={formData.password}
                            onChange={e => setFormData({...formData, password: e.target.value})}
                        />
                    </div>

                    {error && (
                        <div className="text-red-400 text-xs text-center bg-red-500/10 p-3 rounded-lg border border-red-500/20 animate-pulse">
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary-900/20 flex items-center justify-center gap-2 mt-4 hover:shadow-primary-500/20 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={22} /> : (
                            <>
                                {mode === AppRoute.LOGIN ? 'Sign In' : 'Create Account'}
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-slate-500 text-sm">
                        {mode === AppRoute.LOGIN ? "Don't have an account? " : "Already have an account? "}
                        <button 
                            onClick={() => setMode(mode === AppRoute.LOGIN ? AppRoute.REGISTER : AppRoute.LOGIN)}
                            className="text-primary-400 hover:text-primary-300 font-bold hover:underline transition-all"
                        >
                            {mode === AppRoute.LOGIN ? 'Register' : 'Login'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Auth;