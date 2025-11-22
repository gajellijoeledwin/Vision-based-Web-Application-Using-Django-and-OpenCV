import React, { useRef, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { AnalysisTask } from '../types';
import { Activity, Box, CheckCircle, Clock, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface DashboardProps {
  tasks: AnalysisTask[];
}

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

// --- 3D Tilt Card Component ---
const TiltCard = ({ children, className = '' }: { children?: React.ReactNode, className?: string }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState('');
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = ((y - centerY) / centerY) * -5; // Max 5deg rotation
        const rotateY = ((x - centerX) / centerX) * 5;
        
        setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`);
    };

    const handleMouseLeave = () => {
        setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    };

    return (
        <div 
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`glass-panel rounded-xl transition-transform duration-200 ease-out will-change-transform ${className}`}
            style={{ transform }}
        >
            {children}
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ tasks }) => {
  // Time-based Trend Calculation (Same logic as before)
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const tasksLast24h = tasks.filter(t => new Date(t.createdAt) >= oneDayAgo).length;
  const tasksPrev24h = tasks.filter(t => {
      const d = new Date(t.createdAt);
      return d >= twoDaysAgo && d < oneDayAgo;
  }).length;

  let taskTrend = 0;
  if (tasksPrev24h === 0) {
      taskTrend = tasksLast24h > 0 ? 100 : 0;
  } else {
      taskTrend = Math.round(((tasksLast24h - tasksPrev24h) / tasksPrev24h) * 100);
  }

  let objectsLast24h = 0;
  let objectsPrev24h = 0;
  let totalObjectsDetected = 0;
  const objectCounts: Record<string, number> = {};

  tasks.forEach(task => {
    const taskDate = new Date(task.createdAt);
    const objCount = task.result ? task.result.objects.length : 0;
    
    if (task.result) {
      task.result.objects.forEach(obj => {
        const label = obj.label.toLowerCase();
        objectCounts[label] = (objectCounts[label] || 0) + 1;
        totalObjectsDetected++;
      });
    }
    if (taskDate >= oneDayAgo) {
        objectsLast24h += objCount;
    } else if (taskDate >= twoDaysAgo) {
        objectsPrev24h += objCount;
    }
  });

  let objectTrend = 0;
  if (objectsPrev24h === 0) {
      objectTrend = objectsLast24h > 0 ? 100 : 0;
  } else {
      objectTrend = Math.round(((objectsLast24h - objectsPrev24h) / objectsPrev24h) * 100);
  }

  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
  const pendingTasks = tasks.filter(t => t.status === 'PENDING' || t.status === 'PROCESSING').length;
  const totalTasks = tasks.length;

  const chartData = Object.entries(objectCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const StatsCard = ({ title, value, icon: Icon, color, trend }: any) => (
    <TiltCard className="p-6 relative overflow-hidden group h-full">
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:scale-110 ${color}`}>
        <Icon size={80} />
      </div>
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{title}</p>
            <div className="flex items-baseline gap-3">
                <h3 className="text-4xl font-black text-white tracking-tight">{value}</h3>
            </div>
        </div>
        
        {trend !== undefined && (
            <div className="mt-4 pt-4 border-t border-white/5">
                <div className={`flex items-center text-xs font-bold ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                    {trend > 0 ? <ArrowUpRight size={16} /> : trend < 0 ? <ArrowDownRight size={16} /> : <Minus size={16} />}
                    <span className="ml-1">{Math.abs(trend)}%</span>
                    <span className="text-slate-600 ml-2 font-normal">vs yesterday</span>
                </div>
            </div>
        )}
      </div>
    </TiltCard>
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-slate-400 mt-2 text-lg">Real-time overview of the vision processing engine.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total Processed" value={totalTasks} icon={Box} color="text-blue-500" trend={taskTrend} />
        <StatsCard title="Objects Detected" value={totalObjectsDetected} icon={Activity} color="text-purple-500" trend={objectTrend} />
        <StatsCard title="Completed Tasks" value={completedTasks} icon={CheckCircle} color="text-emerald-500" />
        <StatsCard title="Processing Queue" value={pendingTasks} icon={Clock} color="text-amber-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TiltCard className="p-8">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-primary-500 rounded-full"></span>
            Object Distribution
          </h3>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: '#334155', borderRadius: '8px', color: '#fff', backdropFilter: 'blur(8px)' }}
                    itemStyle={{ color: '#fff' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </TiltCard>

        <TiltCard className="p-8">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
            Top Detections
          </h3>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.03)'}}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: '#334155', borderRadius: '8px', color: '#fff', backdropFilter: 'blur(8px)' }}
                />
                <Bar dataKey="value" fill="#38bdf8" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TiltCard>
      </div>
      
      {/* Recent Activity Table */}
      <div className="glass-panel rounded-xl overflow-hidden border border-white/5">
        <div className="p-6 border-b border-white/5 bg-slate-900/50">
            <h3 className="text-lg font-bold text-white">Recent Analysis Tasks</h3>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-950 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                        <th className="px-6 py-4">Task ID</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Found</th>
                        <th className="px-6 py-4">Date</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {tasks.slice(0, 5).map((task) => (
                        <tr key={task.id} className="hover:bg-slate-800/30 transition-colors group">
                            <td className="px-6 py-4 font-mono text-xs text-primary-400/80 group-hover:text-primary-400">{task.id.substring(0, 8)}...</td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    task.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    task.status === 'PROCESSING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                    'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                        task.status === 'COMPLETED' ? 'bg-emerald-500' :
                                        task.status === 'PROCESSING' ? 'bg-amber-500 animate-pulse' : 'bg-slate-500'
                                    }`}></span>
                                    {task.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-white font-medium">
                                {task.result ? task.result.objects.length : '-'}
                            </td>
                            <td className="px-6 py-4">
                                {new Date(task.createdAt).toLocaleDateString()}
                            </td>
                        </tr>
                    ))}
                    {tasks.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-600 italic">
                                No analysis tasks found. Start by uploading an image.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;