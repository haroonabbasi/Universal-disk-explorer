from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class FileMetadata(BaseModel):
    path: str
    name: str
    size: int
    created_time: datetime
    modified_time: datetime
    file_type: str
    mime_type: str
    hash: Optional[str] = None
    perceptual_hash: Optional[str] = None
    is_directory: bool
    video_screenshots: List[str]

class VideoMetadata(BaseModel):
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    bitrate: Optional[int] = None
    codec: Optional[str] = None
    fps: Optional[float] = None
    
class FileInfo(FileMetadata):
    video_metadata: Optional[VideoMetadata] = None

class ProgressModel(BaseModel):
    total_files: int
    processed_files: int
    progress_percentage: float
    status: str
    elapsed_time: Optional[str] = None
    estimated_time_remaining: Optional[str] = None
    files_per_second: Optional[float] = None
    error: Optional[str] = None

    # Ensure JSON serialization works correctly
    def model_dump(self, **kwargs):
        """Override model_dump to ensure compatibility with JSON serialization"""
        return super().model_dump(mode='json', **kwargs)