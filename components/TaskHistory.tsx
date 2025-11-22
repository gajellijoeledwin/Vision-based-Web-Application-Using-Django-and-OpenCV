import React, { useState, useMemo } from 'react';
import { AnalysisTask } from '../types';
import { generatePDFReport } from '../services/reportService';
import { Search, Filter, ChevronLeft, ChevronRight, Download, Eye, X, Calendar, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

interface TaskHistoryProps {
  tasks: AnalysisTask[];
}

type SortField = 'date' | 'status';
type SortDirection = 'asc' | 'desc';

const TaskHistory: React.FC<TaskHistoryProps> = ({ tasks }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const itemsPerPage = 10;

  // Filter and Sort Logic
  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks];

    // Filter by Status
    if (filterStatus !== 'ALL') {
      result = result.filter(task => task.status === filterStatus);
    }

    // Filter by Search Term (ID or Summary)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(task => 
        task.id.toLowerCase().includes(term) || 
        task.result?.summary.toLowerCase().includes(term) ||
        (task.result?.objects.some(obj => obj.label.toLowerCase().includes(term)))
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      }
      return sortDirection === 'asc' ? -comparison : comparison;
    });

    return result;
  }, [tasks, filterStatus, searchTerm, sortField, sortDirection]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedTasks.length / itemsPerPage);
  const currentTasks = filteredAndSortedTasks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleDownload = (task: AnalysisTask) => {
    if (task.status === 'COMPLETED' && task.result) {
        generatePDFReport(task);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Task History</h1>
          <p className="text-slate-400 mt-1">Archive of all processed vision tasks and metadata.</p>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search ID, objects, or summary..."
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-3 overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2">
            <Filter size={16} className="text-slate-400" />
            <select 
              className="bg-transparent text-sm text-white outline-none cursor-pointer"
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            >
              <option value="ALL" className="bg-slate-900">All Status</option>
              <option value="COMPLETED" className="bg-slate-900">Completed</option>
              <option value="PROCESSING" className="bg-slate-900">Processing</option>
              <option value="FAILED" className="bg-slate-900">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-900/80 text-slate-200 uppercase text-xs font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Media Preview</th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('date')}>
                   <div className="flex items-center gap-2">
                      Date Created
                      {sortField === 'date' && <span className="text-primary-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                   </div>
                </th>
                <th className="px-6 py-4">Task ID</th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-2">
                      Status
                      {sortField === 'status' && <span className="text-primary-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                   </div>
                </th>
                <th className="px-6 py-4">Analysis Summary</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {currentTasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    {task.imageUrl ? (
                        <div 
                            className="w-16 h-16 rounded-lg overflow-hidden border border-slate-700 cursor-pointer hover:border-primary-500 transition-all"
                            onClick={() => setPreviewImage(task.imageUrl)}
                        >
                            <img src={task.imageUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center text-xs text-slate-600 border border-slate-700">
                            No Media
                        </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                        <span className="text-white font-medium flex items-center gap-2">
                            <Calendar size={14} className="text-slate-500"/>
                            {new Date(task.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-slate-500 pl-6">
                            {new Date(task.createdAt).toLocaleTimeString()}
                        </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {task.id}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        task.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        task.status === 'PROCESSING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        task.status === 'FAILED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-slate-700 text-slate-300 border-slate-600'
                    }`}>
                        {task.status === 'COMPLETED' && <CheckCircle size={12} />}
                        {task.status === 'PROCESSING' && <Clock size={12} />}
                        {task.status === 'FAILED' && <AlertTriangle size={12} />}
                        {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    {task.result ? (
                        <div>
                            <p className="text-white text-xs line-clamp-2 mb-1">{task.result.summary}</p>
                            <div className="flex gap-1 flex-wrap">
                                {task.result.objects.slice(0, 3).map((o, i) => (
                                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">
                                        {o.label}
                                    </span>
                                ))}
                                {task.result.objects.length > 3 && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded border border-slate-700">
                                        +{task.result.objects.length - 3}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <span className="text-slate-600 text-xs italic">Processing or Metadata unavailable</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                        <button 
                            onClick={() => setPreviewImage(task.imageUrl)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            title="View Analysis"
                        >
                            <Eye size={18} />
                        </button>
                        <button 
                            onClick={() => handleDownload(task)}
                            className="p-2 text-primary-400 hover:text-primary-300 hover:bg-primary-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Download Report"
                            disabled={task.status !== 'COMPLETED'}
                        >
                            <Download size={18} />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {currentTasks.length === 0 && (
                <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        No records found matching your filters.
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredAndSortedTasks.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
                <div className="text-sm text-slate-500">
                    Showing <span className="text-white font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="text-white font-medium">{Math.min(currentPage * itemsPerPage, filteredAndSortedTasks.length)}</span> of <span className="text-white font-medium">{filteredAndSortedTasks.length}</span> results
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-slate-700 text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg border border-slate-700 text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 hover:text-white transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-4xl w-full bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
                    <h3 className="font-bold text-white">Media Preview</h3>
                    <button onClick={() => setPreviewImage(null)} className="text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-1 bg-black flex justify-center">
                    <img src={previewImage} alt="Preview" className="max-h-[80vh] object-contain" />
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default TaskHistory;