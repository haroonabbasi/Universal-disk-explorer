import os
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Set, AsyncGenerator, Dict, Any, Optional, Union
from concurrent.futures import ThreadPoolExecutor
import hashlib
import aiofiles
import magic
import json
import logging
import fnmatch
from ..models.schemas import FileMetadata, ProgressModel
from pydantic import BaseModel
from ..app_config import get_config
from .video import VideoAnalyzer

logger = logging.getLogger(__name__)

config = get_config()  # The same cached instance will be returned

class FileScanner:
    def __init__(
        self,
        progress_file: str,
        result_file: str,
        max_workers: Optional[int] = None,
        chunk_size: int = 8192,
        video_analyzer: Optional[VideoAnalyzer] = None
    ):
        self.max_workers = max_workers or min(4, os.cpu_count())
        self.executor = ThreadPoolExecutor(max_workers=self.max_workers)
        self.chunk_size = chunk_size
        self.total_files = 0
        self.processed_files = 0
        self.progress_file = Path(progress_file)
        self.result_file = Path(result_file)
        self._scan_start_time = None
        self._last_error = None
        self.video_analyzer = video_analyzer or VideoAnalyzer(config.FFMPEG_PATH, config.FFPROBE_PATH)
        
        # Initialize files
        self._initialize_files()

    def _initialize_files(self):
        """Initialize progress and result files if they don't exist."""
        # Create parent directories if they don't exist
        self.progress_file.parent.mkdir(parents=True, exist_ok=True)
        self.result_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Initialize progress file if it doesn't exist
        if not self.progress_file.exists():
            self.update_progress()
        
        # Initialize results file if it doesn't exist
        if not self.result_file.exists():
            self.result_file.write_text("[\n]")        
            self.result_file.write_text("[\n]")

    def _serialize_model(self, obj: Union[dict, BaseModel]) -> dict:
        """Serialize Pydantic models or dictionaries to JSON-compatible dict."""
        if isinstance(obj, BaseModel):
            return obj.model_dump(exclude_unset=True)
        return obj    

    async def compute_file_hash(self, path: Path) -> Optional[str]:
        """Compute MD5 hash of a file."""
        try:
            hash_md5 = hashlib.md5()
            async with aiofiles.open(path, 'rb') as f:
                while chunk := await f.read(self.chunk_size):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except (PermissionError, FileNotFoundError, OSError) as e:
            logger.error(f"Error computing hash for {path}: {str(e)}")
            return None

    async def get_file_metadata(self, path: Path, include_hash: bool = True, generate_video_screenshots: bool = True) -> Optional[FileMetadata]:
        """Get detailed file metadata."""
        try:
            stat = path.stat()
            mime = magic.Magic(mime=True)

            metadata = FileMetadata(
                path=str(path),
                name=path.name,
                size=stat.st_size,
                created_time=datetime.fromtimestamp(stat.st_ctime),
                modified_time=datetime.fromtimestamp(stat.st_mtime),
                file_type=path.suffix.lower(),
                mime_type=await asyncio.to_thread(mime.from_file, str(path)),
                is_directory=path.is_dir(),
                video_metadata=None
            )

            if not metadata.is_directory and include_hash:
                metadata.hash = await self.compute_file_hash(path)

            # Check if it's a video file
            video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv'}
            if metadata.file_type.lower() in video_extensions:
                metadata.video_metadata = await self.video_analyzer.get_video_metadata(
                    path, generate_screenshots=generate_video_screenshots
                )

            self.processed_files += 1
            self.update_progress()

            return metadata

        except (PermissionError, FileNotFoundError, OSError) as e:
            logger.error(f"Error getting metadata for {path}: {str(e)}")
            self.processed_files += 1
            self.update_progress()
            return None

    async def scan_directory(
        self,
        root_path: str,
        exclude_dirs: Set[str] = None,
        exclude_patterns: Set[str] = None,
        include_hash: bool = True,
        generate_video_screenshots: bool = True
    ) -> AsyncGenerator[dict, None]:
        """
        Recursively scan a directory and yield file metadata.
        
        Args:
            root_path: Directory to scan
            exclude_dirs: Set of directory names to exclude
            exclude_patterns: Set of file patterns to exclude (e.g., '*.tmp', '.DS_Store')
            include_hash: Whether to compute file hashes
            generate_video_screenshots: Whether to generate screenshots for video files
        
        Yields:
            Metadata of each file processed.
        """
        exclude_dirs = exclude_dirs or {'.git', 'node_modules', '__pycache__'}
        exclude_patterns = exclude_patterns or {'.DS_Store', '*.tmp', '*.log'}

        root = Path(root_path)
        
        if not root.exists():
            raise FileNotFoundError(f"Directory not found: {root_path}")
            
        if not root.is_dir():
            raise NotADirectoryError(f"Path is not a directory: {root_path}")

        self._scan_start_time = datetime.now()
        self._last_error = None

        # Initialize result file (assuming self.result_file is defined)
        if self.result_file.exists():
            self.result_file.unlink()
        self.result_file.write_text("[\n]")  # Initialize with empty JSON array

        try:
            # Collect files with error handling
            all_files = []
            for current_path, dirs, files in os.walk(root):
                # Skip excluded directories
                if any(excluded in Path(current_path).parts for excluded in exclude_dirs):
                    continue

                for file in files:
                    full_path = Path(current_path) / file
                    
                    # Skip files matching exclude patterns
                    if any(fnmatch.fnmatch(full_path.name, pattern) for pattern in exclude_patterns):
                        continue
                    
                    all_files.append(full_path)

            self.total_files = len(all_files)
            self.processed_files = 0
            self.update_progress()

            # Process files concurrently in chunks
            chunk_size = min(1000, max(100, self.total_files // 10))
            for i in range(0, len(all_files), chunk_size):
                chunk = all_files[i:i + chunk_size]
                tasks = [
                    self.get_file_metadata(path, include_hash, generate_video_screenshots)
                    for path in chunk
                ]
                chunk_results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for result in chunk_results:
                    if isinstance(result, Exception):
                        logger.error(f"Error processing file: {str(result)}")
                        continue
                    if result:
                        yield result
                        
        except Exception as e:
            self._last_error = str(e)
            logger.error(f"Scan failed: {str(e)}", exc_info=True)
            raise

    def update_progress(self) -> None:
        """Update the progress file with the current state."""
        progress = self.get_progress()
        try:
            # Ensure the directory exists
            Path(self.progress_file).parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.progress_file, 'w') as f:
                json.dump(progress, f, indent=2)
        except Exception as e:
            logger.error(f"Error updating progress file: {str(e)}")

    def write_results(self, results: list, append: bool = False) -> None:
        """Write scan results to the result file."""
        if not results:
            return

        try:
            if not self.result_file.exists():
                self.result_file.write_text("[\n]")

            # Convert all results to JSON-serializable dictionaries
            serialized_results = [self._serialize_model(result) for result in results]

            if append:
                content = self.result_file.read_text()
                if content.strip() == '':
                    content = '[\n]'
                    self.result_file.write_text(content)
                
                if content.rstrip().endswith(']'):
                    content = content.rstrip()[:-1]
                    if not content.rstrip().endswith('['):
                        content += ','
                    content += '\n'
                    self.result_file.write_text(content)
                
                with open(self.result_file, 'a') as f:
                    for idx, result in enumerate(serialized_results):
                        json.dump(result, f, default=str)  # use default=str for any remaining datetime objects
                        if idx < len(serialized_results) - 1:
                            f.write(',\n')
                    f.write('\n]')
            else:
                with open(self.result_file, 'w') as f:
                    f.write('[\n')
                    for idx, result in enumerate(serialized_results):
                        json.dump(result, f, default=str)  # use default=str for any remaining datetime objects
                        if idx < len(serialized_results) - 1:
                            f.write(',\n')
                        else:
                            f.write('\n]')
                            
        except Exception as e:
            logger.error(f"Error writing results: {str(e)}")
            self._last_error = f"Failed to write results: {str(e)}"

    def get_progress(self) -> Dict[str, Any]:
        """Get detailed scanning progress."""
        progress_percentage = round((self.processed_files / self.total_files * 100), 2) if self.total_files else 0
        status = "in_progress"

        # Initialize progress data
        progress_data = {
            "total_files": self.total_files,
            "processed_files": self.processed_files,
            "progress_percentage": progress_percentage,
            "status": status
        }

        # Add timing information if scan has started
        if self._scan_start_time:
            elapsed = datetime.now() - self._scan_start_time
            progress_data["elapsed_time"] = str(elapsed)
            
            if self.processed_files > 0:
                files_per_second = self.processed_files / elapsed.total_seconds()
                remaining_files = self.total_files - self.processed_files
                eta_seconds = remaining_files / files_per_second if files_per_second > 0 else 0
                progress_data["estimated_time_remaining"] = str(timedelta(seconds=int(eta_seconds)))
                progress_data["files_per_second"] = round(files_per_second, 2)

        # Handle error and completion statuses
        if self._last_error:
            progress_data["status"] = "error"
            progress_data["error"] = self._last_error
        elif self.processed_files >= self.total_files:
            progress_data["status"] = "complete"

        # Create ProgressModel and return its dictionary representation
        progress_model = ProgressModel(**progress_data)
        return progress_model.model_dump()
    
    async def search_directory_with_filters(
        self,
        root_path: str,
        result_file: Path,
        min_size: Optional[int] = None,
        max_size: Optional[int] = None,
        file_types: Optional[List[str]] = None,
        created_before: Optional[datetime] = None,
        modified_before: Optional[datetime] = None,
        low_quality_videos: bool = False,
        top_n: Optional[int] = None,
        include_duplicates: bool = False,
        preview_image: bool = True
    ):
        """
        Perform a background scan with filters and save results to a file.
        """
        # Initialize results list
        results = []

        # Scan the directory and apply filters
        async for metadata in self.scan_directory(root_path,None,None,False,preview_image):
            # Apply size filter
            if min_size is not None and metadata.size < min_size:
                continue
            if max_size is not None and metadata.size > max_size:
                continue

            # Apply file type filter
            if file_types and metadata.file_type.lower() not in file_types:
                continue

            # Apply creation/modification date filter
            if created_before and metadata.created_time > created_before:
                continue
            if modified_before and metadata.modified_time > modified_before:
                continue

            # Apply low-quality video filter
            if low_quality_videos and metadata.video_metadata and not metadata.video_metadata.is_low_quality:
                continue

            # Add to results
            results.append(metadata.dict())

        # Apply top N filter
        if top_n:
            results = sorted(results, key=lambda x: x["size"], reverse=True)[:top_n]

        # Apply duplicate filter (if needed)
        if include_duplicates:
            # Group files by hash
            hash_map = {}
            for file in results:
                if file["hash"] not in hash_map:
                    hash_map[file["hash"]] = []
                hash_map[file["hash"]].append(file)

            # Only include files with duplicates
            results = [file for files in hash_map.values() if len(files) > 1 for file in files]

        # Write results to the result file
        self.write_results(results, result_file)

    async def get_insights(self, root_path: str) -> dict:
        """
        Get disk usage insights for a directory.
        """
        total_size = 0
        file_count = 0
        file_type_count = {}
        largest_files = []
        oldest_files = []
        low_quality_videos = []

        async for metadata in self.scan_directory(root_path):
            total_size += metadata.size
            file_count += 1

            # Update file type count
            file_type = metadata.file_type.lower()
            file_type_count[file_type] = file_type_count.get(file_type, 0) + 1

            # Track largest files
            largest_files.append(metadata.dict())
            if len(largest_files) > 10:
                largest_files = sorted(largest_files, key=lambda x: x["size"], reverse=True)[:10]

            # Track oldest files
            oldest_files.append(metadata.dict())
            if len(oldest_files) > 10:
                oldest_files = sorted(oldest_files, key=lambda x: x["modified_time"])[:10]

            # Track low-quality videos
            if metadata.video_metadata and metadata.video_metadata.is_low_quality:
                low_quality_videos.append(metadata.dict())

        return {
            "total_size": total_size,
            "file_count": file_count,
            "file_type_count": file_type_count,
            "largest_files": sorted(largest_files, key=lambda x: x["size"], reverse=True)[:10],
            "oldest_files": sorted(oldest_files, key=lambda x: x["modified_time"])[:10],
            "low_quality_videos": low_quality_videos,
        }
    
    async def find_duplicates(self, root_path: str) -> dict:
        """
        Find duplicate files in a directory.
        """
        hash_map = {}

        async for metadata in self.scan_directory(root_path):
            if metadata.hash:
                if metadata.hash not in hash_map:
                    hash_map[metadata.hash] = []
                hash_map[metadata.hash].append(metadata.dict())

        # Filter out non-duplicates
        duplicates = {hash: files for hash, files in hash_map.items() if len(files) > 1}

        return duplicates
    
    async def find_aging_files(self, root_path: str, days: int, mode: str) -> List[dict]:
        """
        Find files that haven't been accessed/modified in a specified number of days.
        """
        aging_files = []
        cutoff_date = datetime.now() - timedelta(days=days)

        async for metadata in self.scan_directory(root_path):
            if mode == "accessed":
                last_used = metadata.accessed_time  # Note: You may need to add accessed_time to FileMetadata
            else:
                last_used = metadata.modified_time

            if last_used and last_used < cutoff_date:
                aging_files.append(metadata.dict())

        return aging_files    