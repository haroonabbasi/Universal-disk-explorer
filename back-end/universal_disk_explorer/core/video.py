import ffmpeg
import asyncio
import logging
import subprocess
from pathlib import Path
from typing import List, Optional, Dict
import random

from .local_video_quality_analyzer import LocalVideoQualityAnalyzer
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
        self.ffmpeg_path = ffmpeg_path
        self.ffprobe_path = ffprobe_path
        self.screenshot_base_dir = Path("./output/video/screenshots")
        self.screenshot_base_dir.mkdir(parents=True, exist_ok=True)        

    async def get_video_metadata(self, file_path: Path, generate_screenshots: bool = True) -> Optional[VideoMetadata]:
        """
        Extract video metadata using ffmpeg and generate screenshots if required.

        Args:
            file_path (Path): Path to video file.
            generate_screenshots (bool): Whether to generate screenshots.

        Returns:
            Optional[VideoMetadata]: Video metadata if successful, None otherwise.
        """
        try:
            probe_kwargs = {}
            if self.ffprobe_path:
                probe_kwargs['cmd'] = self.ffprobe_path
            probe = await asyncio.to_thread(
                ffmpeg.probe,
                str(file_path),
                **probe_kwargs
            )
            video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
            format_info = probe.get('format', {})

            # Extract metadata with fallbacks
            video_metadata = VideoMetadata(
                width=int(video_info.get('width', 0)) or None,
                height=int(video_info.get('height', 0)) or None,
                duration=float(format_info.get('duration', 0)) or None,
                bitrate=int(format_info.get('bit_rate', 0)) or None,
                codec=video_info.get('codec_name', 'unknown') or None,
                fps=float(eval(video_info.get('r_frame_rate', '0/1'))) or None,
                file_size=int(format_info.get('size', 0)) or None
            )

            # Check if video is low quality
            video_metadata.is_low_quality = self.is_low_quality(video_metadata)
            
            analyzer = LocalVideoQualityAnalyzer(sample_interval=2, roi_coverage=0.4)
            result = analyzer.analyze_video(str(file_path))
            print(f"Quality: {result.category} ({result.score:.1f}/100)")
            video_metadata.video_qauality_result = result

            # Generate screenshots if required
            if generate_screenshots:
                try:
                    screenshots = await self.generate_screenshots(str(file_path))
                    video_metadata.video_screenshots = screenshots
                except Exception as e:
                    logger.error(f"Failed to generate screenshots for {file_path}: {e}")
                    video_metadata.video_screenshots = []
            return video_metadata
        except Exception as e:
            logger.error(f"Error extracting metadata for {file_path}: {e}")
            return None

    @staticmethod
    def is_low_quality(metadata: VideoMetadata, thresholds: Optional[Dict] = None) -> bool:
        """
        Determine if video is low quality based on metadata.

        Args:
            metadata (VideoMetadata): Video metadata to analyze.
            thresholds (Optional[Dict]): Custom thresholds for quality checks.

        Returns:
            bool: True if video is considered low quality, False otherwise.
        """
        if not metadata:
            return False

        # Default thresholds (can be overridden by the caller)
        default_thresholds = {
            "height": 480,  # Minimum height for acceptable quality
            "bitrate": {
                240: 300_000,  # 300 kbps for 240p
                360: 500_000,  # 500 kbps for 360p
                480: 800_000,  # 800 kbps for 480p
                720: 1_500_000,  # 1.5 Mbps for 720p
                1080: 3_000_000,  # 3 Mbps for 1080p
            },
            "min_bitrate": 500_000,  # Minimum bitrate for any video
            "fps": 24,  # Minimum frames per second
            "bytes_per_second": 100_000,  # ~800 kbps (file size / duration check)
            "modern_codecs": {'h264', 'h265', 'vp9'},  # Modern codecs
            "aspect_ratio_range": (0.5, 2.5),  # Wider range to accommodate vertical videos
            "quality_score_threshold": 40,  # Minimum quality score (0-100)
        }

        # Use custom thresholds if provided, otherwise use defaults
        thresholds = thresholds or default_thresholds

        # Initialize quality score (0-100)
        quality_score = 100

        # Resolution check
        if metadata.height and metadata.height < thresholds["height"]:
            quality_score -= 20  # Penalize for low resolution

        # Bitrate check
        if metadata.bitrate:
            # Minimum bitrate check
            if metadata.bitrate < thresholds["min_bitrate"]:
                quality_score -= 30  # Heavy penalty for very low bitrate
            else:
                # Resolution-specific bitrate check
                expected_bitrate = thresholds["bitrate"].get(metadata.height, thresholds["bitrate"][480])
                if metadata.bitrate < expected_bitrate:
                    quality_score -= 20  # Penalize for low bitrate

        # FPS check
        if metadata.fps and metadata.fps < thresholds["fps"]:
            quality_score -= 10  # Penalize for low FPS

        # File size vs. duration
        if metadata.duration and metadata.file_size:
            bytes_per_second = metadata.file_size / metadata.duration
            if bytes_per_second < thresholds["bytes_per_second"]:
                quality_score -= 20  # Penalize for low bytes per second

        # Codec check
        if metadata.codec and metadata.codec.lower() not in thresholds["modern_codecs"]:
            quality_score -= 10  # Penalize for outdated codec

        # Aspect ratio check
        if metadata.width and metadata.height:
            aspect_ratio = metadata.width / metadata.height
            min_ar, max_ar = thresholds["aspect_ratio_range"]
            if aspect_ratio < min_ar or aspect_ratio > max_ar:
                quality_score -= 5  # Penalize for unusual aspect ratio

        # Determine if video is low quality based on quality score
        return quality_score < thresholds["quality_score_threshold"]
    
    async def _get_video_duration(self, video_path: str) -> float:
        """
        Get the duration of a video in seconds using ffprobe.
        """
        cmd = [
            self.ffprobe_path,  # Use ffprobe instead of ffmpeg
            '-v', 'error',       # Suppress unnecessary output
            '-show_entries', 'format=duration',  # Extract only duration
            '-of', 'default=noprint_wrappers=1:nokey=1',  # Format output
            str(video_path)
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if stderr:
            print(f"Error getting duration for {video_path}: {stderr.decode().strip()}")

        try:
            return float(stdout.decode().strip())  # Convert to float
        except ValueError:
            raise ValueError("Could not determine video duration.")

    async def generate_screenshots(self, video_path: str, num_screenshots: int = 3) -> List[str]:
        """
        Generate screenshots at random timestamps from a video file.

        Args:
            video_path: Path to the video file
            num_screenshots: Number of screenshots to generate

        Returns:
            List of paths to generated screenshots. If a screenshot already exists,
            its path is returned rather than regenerating the image.
        """
        try:
            video_path = Path(video_path)

            # Create a unique directory for this video's screenshots
            video_screenshot_dir = self.screenshot_base_dir / video_path.stem
            video_screenshot_dir.mkdir(parents=True, exist_ok=True)

            # Get video duration
            duration = await self._get_video_duration(str(video_path))

            if duration <= 1:
                raise ValueError(f"Video duration ({duration}s) is too short to generate screenshots.")

            screenshots = []
            for i in range(num_screenshots):
                # Determine the screenshot file path
                screenshot_path = video_screenshot_dir / f'screenshot_{i+1}.png'

                # Check if the screenshot already exists. If so, use it and skip generation.
                if screenshot_path.exists():
                    logger.info(f"Screenshot already exists: {screenshot_path}. Skipping generation.")
                    screenshots.append(str(screenshot_path.resolve()))
                    continue

                # Generate a random timestamp between 1s and (duration - 1s)
                timestamp = random.uniform(1, max(1, duration - 1))

                screenshot_cmd = [
                    self.ffmpeg_path,
                    '-ss', str(timestamp),  # Seek to random time (before input for faster seeking)
                    '-i', str(video_path),
                    '-frames:v', '1',
                    '-update', '1',  # Ensure a single image is written
                    '-q:v', '2',     # High quality
                    # Removed '-y' flag to prevent overwriting, since we're checking existence
                    str(screenshot_path)
                ]

                screenshot_process = await asyncio.create_subprocess_exec(
                    *screenshot_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )

                _, stderr = await screenshot_process.communicate()

                if screenshot_process.returncode != 0:
                    logger.error(f"Screenshot generation failed for {screenshot_path}: {stderr.decode().strip()}")
                else:
                    logger.info(f"Screenshot generated: {screenshot_path}")

                # After attempting generation, add the screenshot path if it exists.
                if screenshot_path.exists():
                    screenshots.append(str(screenshot_path.resolve()))
                else:
                    logger.error(f"Screenshot not created: {screenshot_path}")

            return screenshots

        except Exception as e:
            logger.error(f"Error generating screenshots: {e}")
            return []

    # async def generate_screenshots(self, video_path: str, num_screenshots: int = 3) -> List[str]:
    #     """
    #     Generate screenshots at random timestamps from a video file.

    #     Args:
    #         video_path: Path to the video file
    #         num_screenshots: Number of screenshots to generate

    #     Returns:
    #         List of paths to generated screenshots
    #     """
    #     try:
    #         video_path = Path(video_path)

    #         # Create a unique directory for this video's screenshots
    #         video_screenshot_dir = self.screenshot_base_dir / video_path.stem
    #         video_screenshot_dir.mkdir(parents=True, exist_ok=True)

    #         # Get video duration
    #         duration = await self._get_video_duration(str(video_path))

    #         if duration <= 1:
    #             raise ValueError(f"Video duration ({duration}s) is too short to generate screenshots.")

    #         screenshots = []
    #         for i in range(num_screenshots):
    #             # Generate a random timestamp between 1s and (duration - 1s)
    #             timestamp = random.uniform(1, max(1, duration - 1))

    #             screenshot_path = video_screenshot_dir / f'screenshot_{i+1}.png'

    #             screenshot_cmd = [
    #                 self.ffmpeg_path,
    #                 '-ss', str(timestamp),  # Seek to random time (before input for faster seeking)
    #                 '-i', str(video_path),
    #                 '-frames:v', '1',
    #                 '-update', '1',  # Ensure a single image is written
    #                 '-q:v', '2',  # High quality
    #                 '-y',  # Overwrite if exists
    #                 str(screenshot_path)
    #             ]

    #             screenshot_process = await asyncio.create_subprocess_exec(
    #                 *screenshot_cmd,
    #                 stdout=subprocess.PIPE,
    #                 stderr=subprocess.PIPE
    #             )

    #             _, stderr = await screenshot_process.communicate()

    #             if screenshot_process.returncode != 0:
    #                 logger.error(f"Screenshot generation failed for {screenshot_path}: {stderr.decode().strip()}")
    #             else:
    #                 logger.info(f"Screenshot generated: {screenshot_path}")

    #             if screenshot_path.exists():
    #                 screenshots.append(str(screenshot_path.resolve()))  # Convert to absolute path
    #             else:
    #                 logger.error(f"Screenshot not created: {screenshot_path}")

    #         return screenshots

    #     except Exception as e:
    #         logger.error(f"Error generating screenshots: {e}")
    #         return []