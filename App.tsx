import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AnalysisTool from './components/AnalysisTool';
import LiveStream from './components/LiveStream';
import TaskHistory from './components/TaskHistory';
import Auth from './components/Auth';
import { AppRoute, AnalysisTask, User } from './types';
import { FileText, AlertTriangle } from 'lucide-react';
import { getCurrentUser, logout } from './services/authService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(AppRoute.DASHBOARD);
  const [tasks, setTasks] = useState<AnalysisTask[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialization
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
        setCurrentUser(user);
    }
    
    const stored = localStorage.getItem('vision_tasks');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            const hydrated = parsed.map((t: any) => ({
                ...t,
                createdAt: new Date(t.createdAt),
                completedAt: t.completedAt ? new Date(t.completedAt) : undefined
            }));
            setTasks(hydrated);
        } catch (e) {
            console.error("Failed to parse stored tasks", e);
        }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (currentUser) {
        localStorage.setItem('vision_user', JSON.stringify(currentUser));
    } else if (isLoaded) {
        localStorage.removeItem('vision_user');
    }
  }, [currentUser, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
        localStorage.setItem('vision_tasks', JSON.stringify(tasks));
    }
  }, [tasks, isLoaded]);

  const handleTaskCreate = (task: AnalysisTask) => {
    setTasks(prev => [task, ...prev]);
    // User stays on the current screen (Analysis) to view results immediately.
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
  };

  const renderContent = () => {
    switch (currentRoute) {
      case AppRoute.DASHBOARD:
        return <Dashboard tasks={tasks} />;
      case AppRoute.ANALYSIS:
        return <AnalysisTool onTaskCreate={handleTaskCreate} />;
      case AppRoute.STREAM:
        return <LiveStream />;
      case AppRoute.HISTORY:
        return <TaskHistory tasks={tasks} />;
      case AppRoute.REPORTS:
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <FileText size={40} className="text-slate-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Report Generation</h2>
                <p className="text-slate-400 max-w-md">
                    Select tasks from the dashboard or history to generate official PDF thesis reports containing confidence heatmaps and annotated imagery.
                </p>
                <button 
                    onClick={() => setCurrentRoute(AppRoute.HISTORY)}
                    className="mt-8 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium border border-slate-700 transition-colors"
                >
                    Go to Task Archive
                </button>
            </div>
        );
      default:
        return <div>Not Found</div>;
    }
  };

  // 1. Check for API Key
  if (!process.env.API_KEY) {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <div className="glass-panel max-w-md w-full p-8 rounded-xl text-center border-red-500/30">
                <AlertTriangle size={48} className="text-red-500 mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-white mb-2">Configuration Error</h1>
                <p className="text-slate-400 mb-6">
                    The environment variable <code className="bg-slate-900 px-2 py-1 rounded text-red-400">API_KEY</code> is missing. 
                    This application requires a Google Gemini API key to function.
                </p>
            </div>
        </div>
    )
  }

  // 2. Check Auth
  if (!currentUser) {
      return <Auth onLogin={setCurrentUser} />;
  }

  return (
    <Layout currentRoute={currentRoute} onNavigate={setCurrentRoute}>
      {renderContent()}
    </Layout>
  );
};

export default App;