import ffmpeg
import asyncio
import logging
import subprocess
from pathlib import Path
from typing import List, Optional


from ..models.schemas import VideoMetadata

# Use the same logger name as defined in main.py
logger = logging.getLogger(__name__)

class VideoAnalyzer:
    def __init__(self, ffmpeg_path: Optional[str] = None, ffprobe_path: Optional[str] = None):
        """
        Initialize VideoAnalyzer with optional custom ffmpeg path
        
        Args:
            ffmpeg_path (Optional[str]): Path to ffmpeg executable. If None, uses system default
        """
        logger.info(f"ffmpeg_path: {ffmpeg_path}")
        logger.info(f"ffprobe_path: {ffprobe_path}")
        self.ffmpeg_path = ffmpeg_path
        self.ffprobe_path = ffprobe_path
        self.screenshot_base_dir = Path("./output/video/screenshots")
        self.screenshot_base_dir.mkdir(parents=True, exist_ok=True)        

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
    
    async def _get_video_duration(self, video_path: str) -> float:
        """
        Get video duration safely using ffprobe.

        Args:
            video_path: Path to the video file

        Returns:
            Video duration in seconds
        """
        try:
            # Use self.ffprobe_path for the ffprobe command
            duration_cmd = [
                self.ffprobe_path,  # Use the ffprobe path specified in the class
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                str(video_path)
            ]
            
            duration_process = await asyncio.create_subprocess_exec(
                *duration_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await duration_process.communicate()
            
            # Try to parse duration
            duration_str = stdout.decode().strip()
            if duration_str:
                return float(duration_str)
            
            # Fallback logging
            if stderr:
                print(f"FFprobe stderr: {stderr.decode().strip()}")
            
            return 60.0  # Default to 1 minute if duration can't be determined

        except Exception as e:
            print(f"Error getting video duration: {e}")
            return 60.0  # Default to 1 minute

    async def generate_screenshots(self, video_path: str, num_screenshots: int = 3) -> List[str]:
        """
        Generate screenshots from a video file with improved error handling.
        
        Args:
            video_path: Path to the video file
            num_screenshots: Number of screenshots to generate
        
        Returns:
            List of paths to generated screenshots
        """
        try:
            video_path = Path(video_path)
            
            # Create a unique directory for this video's screenshots
            video_screenshot_dir = self.screenshot_base_dir / video_path.stem
            video_screenshot_dir.mkdir(parents=True, exist_ok=True)
            
            # Get video duration
            duration = await self._get_video_duration(str(video_path))
            
            # Generate screenshots at evenly spaced intervals
            screenshots = []
            for i in range(num_screenshots):
                # Ensure we don't try to screenshot beyond video length
                timestamp = min(duration * (i + 1) / (num_screenshots + 1), duration - 1)
                
                screenshot_path = video_screenshot_dir / f'screenshot_{i+1}.png'
                
                screenshot_cmd = [
                    self.ffmpeg_path,
                    '-ss', str(timestamp),
                    '-i', str(video_path),
                    '-frames:v', '1',
                    '-q:v', '2',  # High quality
                    str(screenshot_path)
                ]
                
                screenshot_process = await asyncio.create_subprocess_exec(
                    *screenshot_cmd,
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.PIPE
                )
                
                _, stderr = await screenshot_process.communicate()
                
                # Additional error logging
                if stderr:
                    print(f"Screenshot generation stderr: {stderr.decode().strip()}")
                
                if screenshot_path.exists():
                    screenshots.append(str(screenshot_path))
            
            return screenshots
        
        except Exception as e:
            print(f"Comprehensive error generating screenshots: {e}")
            return []