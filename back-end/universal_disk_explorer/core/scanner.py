import os
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import Set, AsyncGenerator, Dict, Any, Optional, Union
from concurrent.futures import ThreadPoolExecutor
import hashlib
import aiofiles
import magic
import json
import logging
from ..models.schemas import FileMetadata
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class FileScanner:
    def __init__(
        self,
        progress_file: str,
        result_file: str,
        max_workers: Optional[int] = None,
        chunk_size: int = 8192
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

    async def get_file_metadata(self, path: Path, include_hash: bool = True) -> Optional[FileMetadata]:
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
                is_directory=path.is_dir()
            )
            
            if not metadata.is_directory and include_hash:
                metadata.hash = await self.compute_file_hash(path)
            
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
        include_hash: bool = True
    ) -> AsyncGenerator[FileMetadata, None]:
        """
        Recursively scan directory and yield file metadata.
        
        Args:
            root_path: Directory to scan
            exclude_dirs: Set of directory names to exclude
            include_hash: Whether to compute file hashes
        """
        exclude_dirs = exclude_dirs or {'.git', 'node_modules', '__pycache__'}
        root = Path(root_path)
        
        if not root.exists():
            raise FileNotFoundError(f"Directory not found: {root_path}")
            
        if not root.is_dir():
            raise NotADirectoryError(f"Path is not a directory: {root_path}")

        self._scan_start_time = datetime.now()
        self._last_error = None
        
        # Initialize result file
        self.result_file.write_text("[\n]")
        
        # Clear previous results
        if self.result_file.exists():
            self.result_file.unlink()
            self.result_file.write_text("[\n]")  # Initialize with empty JSON array

        try:
            # Collect files with error handling
            all_files = []
            for current_path, dirs, files in os.walk(root):
                if any(excluded in Path(current_path).parts for excluded in exclude_dirs):
                    continue
                all_files.extend(Path(current_path) / file for file in files)

            self.total_files = len(all_files)
            self.processed_files = 0
            self.update_progress()

            # Process files concurrently in chunks
            chunk_size = min(1000, max(100, self.total_files // 10))
            for i in range(0, len(all_files), chunk_size):
                chunk = all_files[i:i + chunk_size]
                tasks = [
                    self.get_file_metadata(path, include_hash)
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
            self.progress_file.parent.mkdir(parents=True, exist_ok=True)
            
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
        progress = {
            "total_files": self.total_files,
            "processed_files": self.processed_files,
            "progress_percentage": round((self.processed_files / self.total_files * 100), 2) if self.total_files else 0,
            "status": "in_progress"
        }
        
        if self._scan_start_time:
            elapsed = datetime.now() - self._scan_start_time
            progress["elapsed_time"] = str(elapsed)
            
            if self.processed_files > 0:
                files_per_second = self.processed_files / elapsed.total_seconds()
                remaining_files = self.total_files - self.processed_files
                eta_seconds = remaining_files / files_per_second if files_per_second > 0 else 0
                progress["estimated_time_remaining"] = str(timedelta(seconds=int(eta_seconds)))
                progress["files_per_second"] = round(files_per_second, 2)

        if self._last_error:
            progress["status"] = "error"
            progress["error"] = self._last_error

        if self.processed_files >= self.total_files:
            progress["status"] = "complete"

        return progress