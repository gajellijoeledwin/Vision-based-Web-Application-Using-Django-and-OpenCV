export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  box_2d: number[]; // [ymin, xmin, ymax, xmax] 0-1000 scale
}

export interface AnalysisResult {
  objects: DetectedObject[];
  timestamp: string;
  summary: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  bio?: string;
  total_processed: number;
  total_detections: number;
  date_joined: string;
  token?: string; // For client-side session management
}

export interface AnalysisTask {
  id: string;
  file_name: string;
  file_type: 'image' | 'video';
  imageUrl: string; // Maps to 'file' in Django
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  result?: AnalysisResult; // Maps to 'detections' JSON
  detections_summary?: Record<string, number>;
  processing_time?: number; // Seconds
  heatmapUrl?: string; // Maps to 'heatmap'
  annotatedUrl?: string; // Maps to 'annotated_file'
  createdAt: Date;
  completedAt?: Date;
}

export interface ChartData {
  name: string;
  value: number;
}

export enum AppRoute {
  LOGIN = 'login',
  REGISTER = 'register',
  DASHBOARD = 'dashboard',
  ANALYSIS = 'analysis',
  STREAM = 'stream',
  HISTORY = 'history',
  REPORTS = 'reports',
}