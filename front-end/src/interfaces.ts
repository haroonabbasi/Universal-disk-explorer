import { Moment } from 'moment';

export interface MenuItem {
  title: string;
  key: string;
  children?: any;
}

export interface ScanProgress {
  total_files: number;
  processed_files: number;
  progress_percentage: number;
  status: "scanning" | "complete" | "error";
  elapsed_time: string;
  estimated_time_remaining: string;
  files_per_second: number;
  error: string;
}

export interface VideoMetadata {
  width?: number;
  height?: number;
  duration?: number;
  bitrate?: number;
  codec?: string;
  fps?: number;
  file_size?: number; // File size in bytes
  is_low_quality?: boolean; // Flag to indicate low quality
  video_screenshots: string[]; // Screenshots for video files
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  created_time: string; // ISO string (e.g., "2024-02-01T12:00:00Z")
  modified_time: string; // ISO string
  file_type: string;
  mime_type: string;
  hash?: string;
  perceptual_hash?: string;
  is_directory: boolean;
  video_metadata?: VideoMetadata; // Optional video-specific metadata
  screenshots?: string[];
}

export interface Filters {
  topN: number | null;   
  minSize: number | null;           // in MB, later converted to bytes
  maxSize: number | null;           // in MB, later converted to bytes
  fileTypes: string[];              // an array of file type identifiers
  createdBefore: Moment | null;     // using Moment for date objects
  modifiedBefore: Moment | null;    // using Moment for date objects
  lowQualityVideos: boolean;        // a boolean flag
  previewImage: boolean;        // a boolean flag
}