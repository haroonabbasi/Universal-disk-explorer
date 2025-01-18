import ffmpeg
from pathlib import Path
from typing import Optional, Dict
import asyncio
import logging

from ..models.schemas import VideoMetadata

# Use the same logger name as defined in main.py
logger = logging.getLogger(__name__)

class VideoAnalyzer:
    def __init__(self, ffmpeg_path: Optional[str] = None):
        """
        Initialize VideoAnalyzer with optional custom ffmpeg path
        
        Args:
            ffmpeg_path (Optional[str]): Path to ffmpeg executable. If None, uses system default
        """
        logger.info(f"ffmpeg_path: {ffmpeg_path}")
        self.ffmpeg_path = ffmpeg_path

    async def get_video_metadata(self, file_path: Path) -> Optional[VideoMetadata]:
        """
        Extract video metadata using ffmpeg
        
        Args:
            file_path (Path): Path to video file
            
        Returns:
            Optional[VideoMetadata]: Video metadata if successful, None otherwise
        """
        try:
            probe_kwargs = {}
            if self.ffmpeg_path:
                probe_kwargs['cmd'] = self.ffmpeg_path

            probe = await asyncio.to_thread(
                ffmpeg.probe,
                str(file_path),
                **probe_kwargs
            )
            
            video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
            
            return VideoMetadata(
                width=int(video_info.get('width', 0)),
                height=int(video_info.get('height', 0)),
                duration=float(probe.get('format', {}).get('duration', 0)),
                bitrate=int(probe.get('format', {}).get('bit_rate', 0)),
                codec=video_info.get('codec_name'),
                fps=float(eval(video_info.get('r_frame_rate', '0/1')))
            )
        except Exception:
            return None

    @staticmethod
    def is_low_quality(metadata: VideoMetadata) -> bool:
        """
        Determine if video is low quality based on metadata
        
        Args:
            metadata (VideoMetadata): Video metadata to analyze
            
        Returns:
            bool: True if video is considered low quality, False otherwise
        """
        if not metadata:
            return False
            
        # These thresholds can be adjusted based on your needs
        return any([
            metadata.height and metadata.height < 720,
            metadata.bitrate and metadata.bitrate < 1_000_000,  # 1 Mbps
            metadata.fps and metadata.fps < 24
        ])