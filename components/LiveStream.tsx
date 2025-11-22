import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Play, Square, RefreshCw, Video, Activity, Zap, Eye, EyeOff, AlertTriangle, WifiOff, Settings2, Gauge, Layers } from 'lucide-react';
import { analyzeVideoFrameWithGemini } from '../services/geminiService';
import { DetectedObject } from '../types';

const LiveStream: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<any>(null);
  const animationFrameRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(Date.now());

  // State
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(undefined);
  const [latency, setLatency] = useState<number>(0);
  const [inferenceFps, setInferenceFps] = useState<number>(0);
  const [errorCount, setErrorCount] = useState(0);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  
  // Controls
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.4);
  const [showLabels, setShowLabels] = useState(true);
  const [performanceMode, setPerformanceMode] = useState<'speed' | 'accuracy'>('speed');

  // Refs for loop control to avoid closure staleness
  const isScanningRef = useRef(isScanning);
  const detectedObjectsRef = useRef(detectedObjects);
  const performanceModeRef = useRef(performanceMode);
  
  useEffect(() => {
    isScanningRef.current = isScanning;
    if (!isScanning) {
        setSystemMessage(null);
        setErrorCount(0);
        setIsProcessing(false);
        setLatency(0);
        setInferenceFps(0);
    }
  }, [isScanning]);

  useEffect(() => {
    detectedObjectsRef.current = detectedObjects;
    if (detectedObjects.length > 0) {
        lastDetectionTimeRef.current = Date.now();
    }
  }, [detectedObjects]);

  useEffect(() => {
    performanceModeRef.current = performanceMode;
  }, [performanceMode]);

  // Load available cameras
  const handleDevices = useCallback((mediaDevices: MediaDeviceInfo[]) => {
    setDevices(mediaDevices.filter(({ kind }) => kind === 'videoinput'));
  }, [setDevices]);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices);
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [handleDevices]);

  // Analysis Loop
  const runAnalysisLoop = async () => {
    if (!isScanningRef.current || !isMountedRef.current) return;

    // Check if webcam is ready
    if (!webcamRef.current || !webcamRef.current.video || webcamRef.current.video.readyState !== 4) {
        timeoutRef.current = setTimeout(runAnalysisLoop, 200); // Fast retry if not ready
        return;
    }

    const startTime = performance.now();
    setIsProcessing(true);

    try {
        const currentMode = performanceModeRef.current;
        // CRITICAL OPTIMIZATION: 
        // 'speed' mode: 320px width, 0.5 quality (Payload ~15KB) -> Ultra fast
        // 'accuracy' mode: 640px width, 0.6 quality (Payload ~50KB) -> More detail
        const captureWidth = currentMode === 'speed' ? 320 : 640;
        const quality = currentMode === 'speed' ? 0.5 : 0.6;

        const imageSrc = webcamRef.current.getScreenshot({ width: captureWidth, quality: quality });
        
        if (imageSrc) {
            // Add timeout to API call to ensure robustness
            // Using the specialized VIDEO function (no summary) for speed
            const apiCall = analyzeVideoFrameWithGemini(imageSrc);
            const timeoutPromise = new Promise<{objects: DetectedObject[]}>((_, reject) => 
                setTimeout(() => reject(new Error("Request Timeout")), 6000)
            );

            const result = await Promise.race([apiCall, timeoutPromise]);
            
            if (isMountedRef.current && isScanningRef.current) {
                // Only update if we got objects, otherwise keep previous (or let TTL handle fade out)
                // This prevents flickering if a single frame fails
                if (result.objects.length > 0 || errorCount > 0) {
                    setDetectedObjects(result.objects);
                }

                const endTime = performance.now();
                const currentLatency = Math.round(endTime - startTime);
                setLatency(currentLatency);
                setErrorCount(0); // Reset errors on success
                setSystemMessage(null);
                
                // Update FPS
                frameCountRef.current += 1;
                const now = Date.now();
                if (now - lastFpsUpdateRef.current > 1000) {
                    setInferenceFps(frameCountRef.current);
                    frameCountRef.current = 0;
                    lastFpsUpdateRef.current = now;
                }

                // Auto-Downgrade Logic for Robustness
                if (currentLatency > 2500 && currentMode === 'accuracy') {
                    setPerformanceMode('speed');
                    setSystemMessage("Network slow. Switched to Turbo Mode.");
                    setTimeout(() => setSystemMessage(null), 3000);
                }
            }
        }
    } catch (error: any) {
        // Silent console error to avoid flooding
        // console.error("Analysis loop error:", error); 
        if (isMountedRef.current && isScanningRef.current) {
            setErrorCount(prev => prev + 1);
            
            // Robust recovery instead of hard stop
            if (errorCount > 4) { 
                setSystemMessage("Connection unstable. Retrying...");
            }
        }
    } finally {
        if (isMountedRef.current) {
            setIsProcessing(false);
            
            // Adaptive Polling
            const currentMode = performanceModeRef.current;
            // If speed mode, we can poll faster, but keep a floor to prevent CPU hogs
            let delay = currentMode === 'speed' ? 30 : 100;
            
            // Dynamic backoff
            if (latency > 1000) delay = 200; 
            if (errorCount > 0) delay = Math.min(500 * errorCount, 3000); // Exponential backoff up to 3s

            if (isScanningRef.current) {
                timeoutRef.current = setTimeout(runAnalysisLoop, delay);
            }
        }
    }
  };

  const toggleScanning = () => {
    if (isScanning) {
        setIsScanning(false);
        setDetectedObjects([]);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    } else {
        setIsScanning(true);
        setErrorCount(0);
        setSystemMessage(null);
        setLatency(0);
        setInferenceFps(0);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = Date.now();
        setTimeout(runAnalysisLoop, 100);
    }
  };

  // Animation Loop (Decoupled from detection loop for smooth HUD)
  const draw = () => {
    if (!canvasRef.current || !webcamRef.current?.video || !containerRef.current) return;

    const canvas = canvasRef.current;
    const video = webcamRef.current.video;

    if (video.readyState !== 4) return;

    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw HUD Scan Line (Only when scanning)
    if (isScanningRef.current) {
        const time = Date.now() / 1500;
        const scanY = (Math.sin(time) * 0.5 + 0.5) * canvas.height;
        
        const gradient = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.5, 'rgba(56, 189, 248, 0.15)');
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, scanY - 20, canvas.width, 40);
    }

    // 2. Draw Objects with TTL (Time To Live) Check
    const timeSinceLastDetection = Date.now() - lastDetectionTimeRef.current;
    // Fade out old detections after 1.5 seconds to prevent ghosting (reduced from 2s)
    const opacity = Math.max(0, 1 - (timeSinceLastDetection / 1500));

    if (opacity > 0) {
        const objects = detectedObjectsRef.current;
        objects.forEach((obj, idx) => {
            if (obj.confidence < confidenceThreshold) return;

            const [ymin, xmin, ymax, xmax] = obj.box_2d;
            
            // Normalize to current canvas size
            const x = (xmin / 1000) * canvas.width;
            const y = (ymin / 1000) * canvas.height;
            const w = ((xmax - xmin) / 1000) * canvas.width;
            const h = ((ymax - ymin) / 1000) * canvas.height;

            const hue = (idx * 137) % 360;
            const color = `hsla(${hue}, 80%, 60%, ${opacity})`;
            const colorOpac = `hsla(${hue}, 80%, 60%, ${0.15 * opacity})`;
            const textColor = `rgba(0,0,0, ${opacity})`;

            // Box
            ctx.lineWidth = 2;
            ctx.strokeStyle = color;
            ctx.lineJoin = 'round';
            
            // Brackets style box
            const bracketLen = Math.min(w, h) * 0.2;
            ctx.beginPath();
            ctx.moveTo(x, y + bracketLen); ctx.lineTo(x, y); ctx.lineTo(x + bracketLen, y);
            ctx.moveTo(x + w - bracketLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + bracketLen);
            ctx.moveTo(x + w, y + h - bracketLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - bracketLen, y + h);
            ctx.moveTo(x + bracketLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - bracketLen);
            ctx.stroke();

            // Fill
            ctx.fillStyle = colorOpac;
            ctx.fillRect(x, y, w, h);
            
            // Label
            if (showLabels) {
                ctx.font = 'bold 12px "Inter", sans-serif';
                const labelText = `${obj.label.toUpperCase()} ${Math.round(obj.confidence * 100)}%`;
                const tm = ctx.measureText(labelText);
                
                let ly = y - 22; 
                if (ly < 0) ly = y + h + 8;

                // Label Background
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.roundRect(x, ly, tm.width + 12, 22, 4);
                ctx.fill();
                
                // Label Text
                ctx.fillStyle = textColor;
                ctx.textBaseline = 'middle';
                ctx.fillText(labelText, x + 6, ly + 12);
            }
        });
    }

    animationFrameRef.current = requestAnimationFrame(draw);
  };

  // Start Animation Loop
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(draw);
    return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [confidenceThreshold, showLabels]); // Dependencies that affect drawing

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-6">
      {/* Header & Controls */}
      <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-primary-400 shadow-lg shadow-slate-900/50 relative">
                <Video size={24} />
                {isScanning && (
                    <span className="absolute top-0 right-0 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                )}
            </div>
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Live Vision
                    {performanceMode === 'speed' && <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-[10px] font-mono border border-yellow-500/30">TURBO MODE</span>}
                </h2>
                <p className="text-sm text-slate-400">Real-time inference engine</p>
            </div>
        </div>

        {systemMessage && (
             <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs font-bold flex items-center gap-2 animate-pulse">
                <WifiOff size={14} />
                {systemMessage}
             </div>
        )}

        <div className="flex items-center gap-4 md:gap-6">
            {/* Filters Panel */}
            <div className="hidden md:flex items-center gap-4 border-r border-slate-700 pr-6">
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 w-32">
                        <span>Confidence</span>
                        <span className="text-primary-400">{Math.round(confidenceThreshold * 100)}%</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" max="100" step="5"
                        value={confidenceThreshold * 100} 
                        onChange={(e) => setConfidenceThreshold(Number(e.target.value) / 100)}
                        className="w-32 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-primary-500 hover:accent-primary-400"
                    />
                </div>
                
                <button 
                    onClick={() => setShowLabels(!showLabels)}
                    className={`p-2 rounded-lg transition-all border ${
                        showLabels 
                        ? 'bg-slate-700 text-white border-slate-600' 
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                    title="Toggle Labels"
                >
                    {showLabels ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>

                <button 
                    onClick={() => setPerformanceMode(prev => prev === 'speed' ? 'accuracy' : 'speed')}
                    className={`p-2 rounded-lg transition-all border ${
                        performanceMode === 'speed' 
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' 
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                    title={performanceMode === 'speed' ? 'Turbo Mode (Faster, Less Detailed)' : 'High Accuracy (Slower)'}
                >
                    <Gauge size={18} />
                </button>
            </div>

            {/* Camera Select */}
            <div className="relative group">
                <select 
                    className="appearance-none bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg pl-9 pr-8 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer hover:bg-slate-800 transition-colors min-w-[160px]"
                    onChange={(e) => setActiveDeviceId(e.target.value)}
                    value={activeDeviceId}
                >
                    {devices.map((device, key) => (
                        <option key={key} value={device.deviceId}>
                           {device.label ? device.label.substring(0, 20) + (device.label.length > 20 ? '...' : '') : `Camera ${key + 1}`}
                        </option>
                    ))}
                </select>
                <Camera size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <Settings2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none opacity-50" />
            </div>

            <button
                onClick={toggleScanning}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg ${
                    isScanning 
                    ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20' 
                    : 'bg-primary-600 text-white hover:bg-primary-500 shadow-primary-900/20'
                }`}
            >
                {isScanning ? (
                    <>
                        <Square size={18} fill="currentColor" />
                        <span>Stop</span>
                    </>
                ) : (
                    <>
                        <Play size={18} fill="currentColor" />
                        <span>Start</span>
                    </>
                )}
            </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div ref={containerRef} className="flex-1 relative rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl min-h-0 flex items-center justify-center">
        {/* Camera Feed */}
        <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ 
                deviceId: activeDeviceId,
                width: { ideal: 1280 }, // Viewport resolution (high)
                height: { ideal: 720 },
                facingMode: "environment"
            }}
            className="max-w-full max-h-full object-contain"
            onUserMediaError={(err) => setSystemMessage("Camera Access Denied")}
        />
        
        {/* AR Overlay - Managed by requestAnimationFrame loop */}
        <canvas 
            ref={canvasRef}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
        />

        {/* Processing Indicator */}
        {isScanning && isProcessing && (
            <div className="absolute top-4 right-4 z-20">
                 <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md border border-primary-500/30 rounded-full text-[10px] font-bold tracking-wider text-primary-400 uppercase shadow-lg animate-pulse">
                    <RefreshCw size={12} className="animate-spin" />
                    Analyzing
                 </div>
            </div>
        )}

        {/* HUD Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20 flex items-end justify-between pointer-events-none">
            <div className="flex flex-col gap-2">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Activity size={14} /> Telemetry
                </h3>
                <div className="flex gap-3 font-mono text-xs">
                    <div className={`bg-slate-900/80 backdrop-blur px-3 py-2 rounded border border-slate-800 shadow-lg ${latency > 1000 ? 'text-amber-400 border-amber-500/30' : 'text-emerald-400'}`}>
                        <span className="text-slate-500 block text-[9px] mb-0.5">LATENCY</span>
                        {latency > 0 ? `${latency}ms` : '--'}
                    </div>
                    <div className="bg-slate-900/80 backdrop-blur px-3 py-2 rounded border border-slate-800 shadow-lg text-blue-400">
                         <span className="text-slate-500 block text-[9px] mb-0.5">INF. FPS</span>
                         {inferenceFps}
                    </div>
                    <div className="bg-slate-900/80 backdrop-blur px-3 py-2 rounded border border-slate-800 shadow-lg text-purple-400">
                         <span className="text-slate-500 block text-[9px] mb-0.5">OBJECTS</span>
                         {detectedObjects.filter(o => o.confidence >= confidenceThreshold).length}
                    </div>
                </div>
            </div>
        </div>

        {/* Start Prompt Overlay */}
        {!isScanning && !systemMessage && (
            <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/70 backdrop-blur-[2px]">
                <div className="text-center p-8 bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl max-w-sm mx-4">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-primary-500 shadow-lg shadow-primary-500/10">
                        <Zap size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Live Vision Engine</h3>
                    <p className="text-slate-400 mb-8 text-sm leading-relaxed">
                        Initialize the real-time inference stream. 
                        <br/>
                        <span className="text-xs opacity-60 mt-2 block">Turbo Mode Enabled (Low Latency)</span>
                    </p>
                    <button 
                        onClick={toggleScanning}
                        className="w-full py-3.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-900/20 hover:scale-[1.02]"
                    >
                        <Play size={18} fill="currentColor" />
                        Start Stream
                    </button>
                </div>
            </div>
        )}
        
        {/* Error Overlay */}
        {systemMessage && !isScanning && (
             <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/80 backdrop-blur-[4px]">
                <div className="text-center p-8 bg-slate-900 border border-red-500/30 rounded-2xl max-w-sm mx-4">
                    <AlertTriangle size={40} className="text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">System Paused</h3>
                    <p className="text-red-200 mb-6 text-sm">{systemMessage}</p>
                    <button 
                        onClick={() => toggleScanning()}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors border border-slate-700"
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default LiveStream;