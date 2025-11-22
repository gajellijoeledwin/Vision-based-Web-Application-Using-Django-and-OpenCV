import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, X, Play, Image as ImageIcon, Loader2, ScanEye, CheckCircle2, AlertTriangle, ShieldCheck, Film, Flame, BoxSelect, ArrowLeft, Code, ListFilter, Maximize2 } from 'lucide-react';
import { AnalysisTask, AnalysisResult } from '../types';
import { analyzeImageWithGemini } from '../services/geminiService';
import HeatmapLayer from './HeatmapLayer';

interface AnalysisToolProps {
  onTaskCreate: (task: AnalysisTask) => void;
}

const AnalysisTool: React.FC<AnalysisToolProps> = ({ onTaskCreate }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null); 
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'boxes' | 'heatmap'>('boxes');
  
  const [confidenceFilter, setConfidenceFilter] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<'list' | 'json'>('list');
  
  const [naturalDims, setNaturalDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [showSuccess, setShowSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showResultView = !!result && !!capturedImage;

  const filteredObjects = useMemo(() => {
    if (!result) return [];
    return result.objects.filter(obj => obj.confidence >= confidenceFilter);
  }, [result, confidenceFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      setMediaType(isVideo ? 'video' : 'image');
      setFileName(file.name);
      setIsUploading(true);
      setUploadProgress(0);
      setResult(null);
      setCapturedImage(null);
      setError(null);
      setSelectedImage(null); 
      setShowSuccess(false);
      setNaturalDims({ width: 0, height: 0 });
      setConfidenceFilter(0);

      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 12;
        if (progress > 90) progress = 90;
        setUploadProgress(Math.round(progress));
      }, 150);

      const finalizeUpload = (url: string) => {
        setTimeout(() => {
            clearInterval(interval);
            setUploadProgress(100);
            
            setTimeout(() => {
                setSelectedImage(url);
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }, 600);
        }, 1000);
      };

      if (isVideo) {
        const url = URL.createObjectURL(file);
        finalizeUpload(url);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          finalizeUpload(base64);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleMediaLoad = (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
    const target = e.currentTarget;
    if (target instanceof HTMLImageElement) {
        setNaturalDims({ width: target.naturalWidth, height: target.naturalHeight });
    } else if (target instanceof HTMLVideoElement) {
        setNaturalDims({ width: target.videoWidth, height: target.videoHeight });
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setError(null);
    setShowSuccess(false);
    const startTime = performance.now();

    let imagePayload = selectedImage;
    
    if (mediaType === 'video' && videoRef.current) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                imagePayload = canvas.toDataURL('image/jpeg');
            }
        } catch (e) {
            console.error("Frame capture failed", e);
            setError("Failed to capture video frame.");
            setIsProcessing(false);
            return;
        }
    }

    const taskId = crypto.randomUUID();
    const pendingTask: AnalysisTask = {
      id: taskId,
      file_name: fileName,
      file_type: mediaType,
      imageUrl: imagePayload,
      status: 'PROCESSING',
      progress: 0,
      createdAt: new Date(),
    };
    
    try {
      const analysisResult = await analyzeImageWithGemini(imagePayload);
      const endTime = performance.now();
      const processingTime = (endTime - startTime) / 1000;

      setResult(analysisResult);
      setCapturedImage(imagePayload);
      
      const summary: Record<string, number> = {};
      analysisResult.objects.forEach(obj => {
        summary[obj.label] = (summary[obj.label] || 0) + 1;
      });

      const completedTask: AnalysisTask = {
        ...pendingTask,
        status: 'COMPLETED',
        progress: 100,
        result: analysisResult,
        detections_summary: summary,
        processing_time: processingTime,
        completedAt: new Date(),
      };
      
      onTaskCreate(completedTask);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);

    } catch (err: any) {
      setError("Analysis failed. " + (err.message || ""));
      const failedTask: AnalysisTask = {
        ...pendingTask,
        status: 'FAILED',
        completedAt: new Date(),
      };
      onTaskCreate(failedTask);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    if (result) {
        setResult(null);
        setCapturedImage(null);
        setError(null);
        setViewMode('boxes');
    } else {
        setSelectedImage(null);
        setError(null);
    }
  };

  const drawAnnotations = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container || !result || viewMode !== 'boxes') {
        if (canvas) {
             const ctx = canvas.getContext('2d');
             ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    filteredObjects.forEach((obj, idx) => {
      const [ymin, xmin, ymax, xmax] = obj.box_2d;
      
      const x = (xmin / 1000) * width;
      const y = (ymin / 1000) * height;
      const w = ((xmax - xmin) / 1000) * width;
      const h = ((ymax - ymin) / 1000) * height;

      const hue = (idx * 137) % 360;
      const color = `hsl(${hue}, 80%, 50%)`;
      const bgFill = `hsla(${hue}, 80%, 50%, 0.1)`;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.strokeRect(x, y, w, h);
      
      ctx.fillStyle = bgFill;
      ctx.fillRect(x, y, w, h);

      ctx.font = 'bold 12px "Inter", sans-serif';
      const text = `${obj.label} ${Math.round(obj.confidence * 100)}%`;
      const textMetrics = ctx.measureText(text);
      const padding = 6;
      
      const textWidth = textMetrics.width + padding * 2;
      const textHeight = 22;

      let labelY = y - textHeight;
      if (labelY < 0) labelY = y;
      let labelX = x;
      if (labelX + textWidth > width) labelX = width - textWidth;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(labelX, labelY, textWidth, textHeight, 4);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, labelX + padding, labelY + textHeight/2);
    });
  };

  useEffect(() => {
    drawAnnotations();
    window.addEventListener('resize', drawAnnotations);
    return () => window.removeEventListener('resize', drawAnnotations);
  }, [result, mediaType, viewMode, showResultView, confidenceFilter, filteredObjects]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-9rem)] relative">
      {/* Success Toast */}
      {showSuccess && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
             <div className="glass-panel bg-emerald-500/10 text-white px-6 py-3 rounded-full shadow-2xl flex items-center justify-center gap-3 font-bold border border-emerald-500/30 backdrop-blur-xl">
                <CheckCircle2 size={20} className="text-emerald-400" />
                <span>Analysis Complete & Saved</span>
             </div>
        </div>
      )}

      {/* Input/Preview Area */}
      <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
        {/* Main Display Panel */}
        <div className="flex-1 glass-panel-deep rounded-2xl p-6 flex items-center justify-center relative overflow-hidden group min-h-0 border border-slate-800 shadow-inner">
          
          {isUploading && (
            <div className="absolute inset-0 z-30 bg-slate-950 flex flex-col items-center justify-center animate-in fade-in duration-300">
                <div className="w-72 space-y-8 relative z-10 text-center">
                    <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                        <Loader2 size={48} className="text-primary-500 animate-spin" />
                        <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full animate-ping"></div>
                    </div>
                    <div className="space-y-2">
                         <h3 className="text-xl font-bold text-white tracking-tight">Analyzing Media</h3>
                         <p className="text-sm text-slate-400">Extracting frames & running YOLO inference...</p>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden w-full">
                         <div className="h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-200 ease-out" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                </div>
            </div>
          )}

          {!selectedImage && !isUploading ? (
            <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl hover:border-primary-500/50 hover:bg-slate-900/30 transition-all duration-300 group-hover:scale-[1.005] cursor-pointer"
                 onClick={() => fileInputRef.current?.click()}>
              <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6 text-slate-600 group-hover:text-primary-400 group-hover:bg-slate-800 shadow-xl transition-all transform group-hover:-translate-y-2">
                <div className="flex gap-0">
                    <ImageIcon size={36} className="-mr-2 z-10" />
                    <Film size={36} className="opacity-70" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Upload Media</h3>
              <p className="text-slate-400 mb-8 max-w-xs text-center text-sm leading-relaxed">
                  Drag & drop or select files for instant analysis. <br/>
                  <span className="text-xs opacity-50 mt-2 block uppercase tracking-wider">JPG • PNG • MP4 • AVI</span>
              </p>
              <button 
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="px-8 py-3.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-primary-500/25"
              >
                Select File
              </button>
            </div>
          ) : (selectedImage && (
            <div className="relative w-full h-full flex items-center justify-center animate-fadeIn">
              <div 
                ref={containerRef}
                className="inline-grid relative max-w-full max-h-full shadow-2xl rounded-lg overflow-hidden" 
                style={{ gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}
              >
                  {/* Layer 1: Media */}
                  <div className="col-start-1 row-start-1 flex items-center justify-center min-w-0 min-h-0 bg-black">
                    {showResultView ? (
                        <img 
                            ref={imageRef}
                            src={capturedImage!} 
                            key={capturedImage}
                            alt="Analysis Result" 
                            className="max-w-full max-h-[calc(100vh-18rem)] object-contain block"
                            onLoad={(e) => {
                                handleMediaLoad(e);
                                requestAnimationFrame(drawAnnotations);
                            }}
                        />
                    ) : (
                        mediaType === 'image' ? (
                            <img 
                                ref={imageRef}
                                src={selectedImage} 
                                alt="Input Source" 
                                className="max-w-full max-h-[calc(100vh-18rem)] object-contain block"
                                onLoad={handleMediaLoad}
                            />
                        ) : (
                            <video
                                ref={videoRef}
                                src={selectedImage}
                                controls
                                className="max-w-full max-h-[calc(100vh-18rem)] object-contain block"
                                crossOrigin="anonymous"
                                onLoadedMetadata={handleMediaLoad}
                            />
                        )
                    )}
                  </div>

                  {/* Layer 2: Overlays */}
                  {(viewMode === 'boxes' || (viewMode === 'heatmap' && result && naturalDims.width > 0)) && (
                      <div className="col-start-1 row-start-1 z-10 pointer-events-none w-full h-full">
                        <canvas 
                            ref={canvasRef} 
                            className={`w-full h-full transition-opacity duration-300 ${viewMode === 'boxes' ? 'opacity-100' : 'opacity-0'}`} 
                        />
                        {viewMode === 'heatmap' && result && naturalDims.width > 0 && (
                            <HeatmapLayer 
                                objects={filteredObjects} 
                                width={naturalDims.width} 
                                height={naturalDims.height} 
                            />
                        )}
                      </div>
                  )}
              </div>
              
              {!isProcessing && !isUploading && (
                <button 
                    onClick={handleReset}
                    className="absolute top-4 right-4 p-3 bg-black/50 hover:bg-red-500/80 text-white rounded-full backdrop-blur-md transition-all z-20 border border-white/10 group shadow-lg hover:scale-110"
                    title={result ? "Back to Input" : "Remove File"}
                >
                    {result ? <ArrowLeft size={20} /> : <X size={20} />}
                </button>
              )}
            </div>
          ))}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*,video/*" 
            className="hidden" 
          />
        </div>

        {/* Action Bar */}
        <div className="glass-panel p-4 rounded-2xl flex items-center justify-between shrink-0 shadow-lg">
            <div className="flex items-center gap-4">
                <div className="flex gap-1 bg-slate-950/50 p-1.5 rounded-xl border border-white/5">
                    <button
                        onClick={() => setViewMode('boxes')}
                        disabled={!result}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wide transition-all ${
                            viewMode === 'boxes' 
                            ? 'bg-slate-800 text-white shadow-md' 
                            : result ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50' : 'text-slate-700 cursor-not-allowed'
                        }`}
                    >
                        <BoxSelect size={16} /> Annotated
                    </button>
                    <button
                        onClick={() => setViewMode('heatmap')}
                        disabled={!result}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wide transition-all ${
                            viewMode === 'heatmap' 
                            ? 'bg-primary-600 text-white shadow-md' 
                            : result ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50' : 'text-slate-700 cursor-not-allowed'
                        }`}
                    >
                        <Flame size={16} /> Heatmap
                    </button>
                </div>
            </div>
            
            {!result && (
                <button
                    disabled={!selectedImage || isProcessing || isUploading}
                    onClick={handleAnalyze}
                    className={`flex items-center gap-3 px-8 py-3 rounded-xl font-bold transition-all shadow-xl ${
                        isProcessing 
                         ? 'bg-slate-800 border border-primary-500/30 text-primary-400 cursor-wait' 
                         : !selectedImage || isUploading
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                            : 'bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white hover:scale-105 hover:shadow-primary-500/25'
                    }`}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            <span>Processing...</span>
                        </>
                    ) : (
                        <>
                            <Play size={20} fill="currentColor" />
                            <span>Run Analysis</span>
                        </>
                    )}
                </button>
            )}
            
            {result && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-mono px-4 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    ANALYSIS COMPLETE
                </div>
            )}
        </div>
      </div>

      {/* Results Sidebar */}
      <div className="glass-panel rounded-2xl flex flex-col h-full overflow-hidden border border-white/5 shadow-2xl">
        {/* Header */}
        <div className="p-6 pb-0 border-b border-white/5 bg-slate-900/40">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <ScanEye className="text-primary-400" />
                Intelligence
            </h2>
            
            {result && (
                <div className="flex gap-6 mb-px">
                    <button 
                        onClick={() => setSidebarTab('list')}
                        className={`pb-4 text-sm font-bold uppercase tracking-wide transition-colors relative ${
                            sidebarTab === 'list' ? 'text-primary-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        Objects
                        {sidebarTab === 'list' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 rounded-t-full shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>}
                    </button>
                    <button 
                        onClick={() => setSidebarTab('json')}
                        className={`pb-4 text-sm font-bold uppercase tracking-wide transition-colors relative ${
                            sidebarTab === 'json' ? 'text-primary-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        JSON Data
                        {sidebarTab === 'json' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 rounded-t-full shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>}
                    </button>
                </div>
            )}
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-4 flex gap-3 items-start">
                    <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                    <div>{error}</div>
                </div>
            )}

            {result ? (
                <div className="space-y-6 animate-fadeIn">
                    {sidebarTab === 'list' ? (
                        <>
                            <div className="p-5 bg-slate-950/50 rounded-xl border border-slate-800 space-y-4">
                                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500">
                                    <span className="flex items-center gap-1.5"><ListFilter size={12}/> Confidence Filter</span>
                                    <span className="text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded">{Math.round(confidenceFilter * 100)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.05"
                                    value={confidenceFilter}
                                    onChange={(e) => setConfidenceFilter(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-primary-500 hover:accent-primary-400"
                                />
                            </div>

                            <div className="p-5 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-white/5 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                                <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <CheckCircle2 size={14}/> AI Summary
                                </h3>
                                <p className="text-sm text-slate-300 leading-relaxed">{result.summary}</p>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Detected Objects</h3>
                                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700">
                                        {filteredObjects.length} / {result.objects.length}
                                    </span>
                                </div>
                                
                                {filteredObjects.length === 0 ? (
                                    <div className="text-center py-12 text-slate-600 text-sm italic bg-slate-950/30 rounded-xl border border-dashed border-slate-800">
                                        No objects meet the threshold.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredObjects.map((obj, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-white/5 hover:bg-slate-800 hover:border-primary-500/30 transition-all group">
                                                <span className="font-medium text-slate-200 capitalize flex items-center gap-3">
                                                    <span className="w-2 h-2 rounded-full ring-2 ring-slate-900/50 shadow-sm" style={{ backgroundColor: `hsl(${(i * 137) % 360}, 70%, 50%)` }}></span>
                                                    {obj.label}
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-primary-500 group-hover:bg-primary-400 transition-colors shadow-[0_0_8px_rgba(14,165,233,0.5)]" 
                                                            style={{ width: `${obj.confidence * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-mono text-primary-400 w-8 text-right">
                                                        {Math.round(obj.confidence * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="relative group">
                            <pre className="text-[10px] font-mono text-slate-400 bg-slate-950 p-4 rounded-xl overflow-x-auto border border-slate-800 h-[500px] scrollbar-thin">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                            <div className="absolute top-3 right-3 opacity-50 group-hover:opacity-100 transition-opacity">
                                <Code size={16} className="text-slate-500"/>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-12 text-slate-500 flex flex-col items-center justify-center h-full">
                    <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center mb-6 border border-slate-800">
                        <ScanEye size={40} className="opacity-30" />
                    </div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Ready for Analysis</p>
                    <p className="text-xs mt-2 opacity-50 max-w-[180px]">Awaiting media input to start the CV pipeline.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisTool;