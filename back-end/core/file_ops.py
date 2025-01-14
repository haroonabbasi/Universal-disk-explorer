import os
import shutil
from pathlib import Path
from typing import List, Union
import aiofiles
import asyncio

class FileOperations:
    @staticmethod
    async def delete_files(files: List[Union[str, Path]]) -> Dict[str, str]:
        """Delete multiple files and return status"""
        results = {}
        for file_path in files:
            path = Path(file_path)
            try:
                if path.is_file():
                    await asyncio.to_thread(path.unlink)
                    results[str(path)] = "deleted"
                else:
                    results[str(path)] = "not a file"
            except Exception as e:
                results[str(path)] = f"error: {str(e)}"
        return results

    @staticmethod
    async def move_files(files: List[Union[str, Path]], target_dir: Union[str, Path]) -> Dict[str, str]:
        """Move multiple files to target directory"""
        target = Path(target_dir)
        if not target.exists():
            target.mkdir(parents=True)
            
        results = {}
        for file_path in files:
            path = Path(file_path)
            try:
                if path.is_file():
                    new_path = target / path.name
                    await asyncio.to_thread(shutil.move, str(path), str(new_path))
                    results[str(path)] = str(new_path)
                else:
                    results[str(path)] = "not a file"
            except Exception as e:
                results[str(path)] = f"error: {str(e)}"
        return results

    @staticmethod
    async def rename_file(file_path: Union[str, Path], new_name: str) -> str:
        """Rename a file"""
        path = Path(file_path)
        try:
            new_path = path.parent / new_name
            await asyncio.to_thread(path.rename, new_path)
            return str(new_path)
        except Exception as e:
            raise Exception(f"Failed to rename file: {str(e)}")