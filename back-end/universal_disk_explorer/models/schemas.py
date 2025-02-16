from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime


class VideoQualityDetails(BaseModel):
    """
    Pydantic model representing the detailed metrics of video quality.
    
    Attributes:
        blur (float): Normalized blur metric.
        contrast (float): Normalized contrast metric.
        edge_density (float): Normalized edge density metric.
        temporal (float): Normalized temporal stability metric.
    """
    blur: float
    contrast: float
    edge_density: float
    temporal: float

class VideoQualityResult(BaseModel):
    """
    Pydantic model representing the overall video quality result.
    
    Attributes:
        score (float): Aggregated quality score (0-100).
        category (str): Quality category (e.g., High Quality, Medium Quality, Low Quality).
        details (VideoQualityDetails): Detailed metrics used to calculate the quality.
    """
    score: float
    category: str
    details: VideoQualityDetails

class VideoMetadata(BaseModel):
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    bitrate: Optional[int] = None
    codec: Optional[str] = None
    fps: Optional[float] = None
    file_size: Optional[int] = None  # File size in bytes
    is_low_quality: Optional[bool] = None  # Flag to indicate low quality
    video_screenshots: List[str] = []  # Screenshots for video files
    video_qauality_result: Optional[VideoQualityResult] = None  # Video-specific metadata

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
    video_metadata: Optional[VideoMetadata] = None  # Video-specific metadata

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
    