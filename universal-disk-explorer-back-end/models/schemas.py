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

class VideoMetadata(BaseModel):
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    bitrate: Optional[int] = None
    codec: Optional[str] = None
    fps: Optional[float] = None
    
class FileInfo(FileMetadata):
    video_metadata: Optional[VideoMetadata] = None