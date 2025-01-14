import ffmpeg
from pathlib import Path
from typing import Optional, Dict
import asyncio

from ..models.schemas import VideoMetadata

class VideoAnalyzer:
    @staticmethod
    async def get_video_metadata(file_path: Path) -> Optional[VideoMetadata]:
        """Extract video metadata using ffmpeg"""
        try:
            probe = await asyncio.to_thread(
                ffmpeg.probe,
                str(file_path)
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
        """Determine if video is low quality based on metadata"""
        if not metadata:
            return False
            
        # These thresholds can be adjusted based on your needs
        return any([
            metadata.height and metadata.height < 720,
            metadata.bitrate and metadata.bitrate < 1_000_000,  # 1 Mbps
            metadata.fps and metadata.fps < 24
        ])
