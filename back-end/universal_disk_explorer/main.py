import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Optional
from pathlib import Path

from .app_config import get_config
from .core.scanner import FileScanner
from .core.video import VideoAnalyzer
from .core.file_ops import FileOperations
from .models.schemas import FileInfo, FileMetadata


config = get_config()  # The same cached instance will be returned
# print(config.app_name)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


app = FastAPI(title="Disk Explorer")
scanner = FileScanner()
video_analyzer = VideoAnalyzer(config.FFMPEG_PATH)
file_ops = FileOperations()


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)  # Log the error with traceback
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"}
    )

@app.get("/")
def read_root():
    return {"message": "Running..!"}

@app.get("/scan/{path:path}", response_model=List[FileInfo])
async def scan_directory(path: str, include_video_metadata: bool = False):
    """Scan directory and return file information"""
    try:
        files = await scanner.scan_directory(path)
        
        if include_video_metadata:
            for file in files:
                if file.mime_type.startswith('video/'):
                    video_meta = await video_analyzer.get_video_metadata(Path(file.path))
                    if video_meta:
                        file.video_metadata = video_meta
        
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/files/delete")
async def delete_files(files: List[str]):
    """Delete multiple files"""
    return await file_ops.delete_files(files)

@app.post("/files/move")
async def move_files(files: List[str], target_directory: str):
    """Move files to target directory"""
    return await file_ops.move_files(files, target_directory)

@app.post("/files/rename")
async def rename_file(file_path: str, new_name: str):
    """Rename a file"""
    try:
        return await file_ops.rename_file(file_path, new_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "healthy"}