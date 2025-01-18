import os
import asyncio
import hashlib
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Set, Optional
import magic
import aiofiles
from concurrent.futures import ThreadPoolExecutor

from ..models.schemas import FileMetadata, FileInfo

class FileScanner:
    def __init__(self, max_workers: Optional[int] = None):
        self.max_workers = max_workers or min(32, (os.cpu_count() or 1) + 4)
        self.executor = ThreadPoolExecutor(max_workers=self.max_workers)
        
    async def compute_file_hash(self, path: Path) -> Optional[str]:
        """Compute MD5 hash of a file"""
        try:
            hash_md5 = hashlib.md5()
            async with aiofiles.open(path, 'rb') as f:
                while chunk := await f.read(8192):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except (PermissionError, FileNotFoundError):
            return None

    async def get_file_metadata(self, path: Path) -> Optional[FileMetadata]:
        """Get detailed file metadata"""
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
            
            if not metadata.is_directory:
                metadata.hash = await self.compute_file_hash(path)
                
            return metadata
        except (PermissionError, FileNotFoundError):
            return None

    async def scan_directory(self, root_path: str, exclude_dirs: Set[str] = None) -> List[dict]:
        """Recursively scan directory and collect file metadata."""
        exclude_dirs = exclude_dirs or {'.git', 'node_modules', '__pycache__'}
        root = Path(root_path)
        results = []

        async def scan_recursive(current_path: Path):
            try:
                for entry in current_path.iterdir():  # Synchronous iteration
                    if entry.name.startswith('.'):
                        continue

                    if entry.is_dir() and entry.name not in exclude_dirs:
                        await scan_recursive(entry)  # Recursively scan directories
                    
                    if entry.is_file():  # Ensure it's a file before collecting metadata
                        metadata = await self.get_file_metadata(entry)
                        if metadata:
                            results.append(metadata)
            except (PermissionError, FileNotFoundError):
                pass

        await scan_recursive(root)
        return results

