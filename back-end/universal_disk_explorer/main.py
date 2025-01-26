import logging
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pathlib import Path
import json

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

# Allow requests from Tauri frontend (example: http://localhost:1420)
origins = [
    "http://localhost:1420",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

video_analyzer = VideoAnalyzer(config.FFMPEG_PATH, config.FFPROBE_PATH)
scanner = FileScanner(
    progress_file="./output/progress.json",
    result_file="./output/results.json",
    max_workers=2  # Optional: customize number of workers
)
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

@app.get("/scan/{path:path}")
async def scan_directory(
    path: str,
    background_tasks: BackgroundTasks,
    exclude_dirs: Optional[List[str]] = Query(default=None),
    include_hash: bool = Query(default=True),
    batch_size: int = Query(default=100, gt=0, le=1000),
    generate_video_screenshots: bool = Query(default=True)
):
    """
    Start scanning directory in the background with configurable options.
    
    Args:
        path: Directory path to scan
        exclude_dirs: Optional list of directory names to exclude
        include_hash: Whether to compute file hashes (can be slow for large files)
        batch_size: Number of files to process before writing results
        generate_video_screenshots: Whether to generate screenshots for video files
    """
    async def scan_task():
        results = []
        try:
            async for metadata in scanner.scan_directory(
                path,
                exclude_dirs=set(exclude_dirs) if exclude_dirs else {'.git', 'node_modules', 'venv'},
                exclude_patterns={'.DS_Store', '*.tmp', '*.log', 'thumbs.db'},                
                include_hash=include_hash,
                generate_video_screenshots=generate_video_screenshots
            ):
                results.append(metadata.dict())
                if len(results) >= batch_size:
                    scanner.write_results(results, append=True)
                    results = []
                    
            if results:  # Write any remaining results
                scanner.write_results(results, append=True)
                
        except Exception as e:
            logger.error(f"Scan failed: {str(e)}", exc_info=True)
            scanner._last_error = str(e)
            scanner.update_progress()
            
    background_tasks.add_task(scan_task)
    return {
        "message": "Scan started",
        "status_endpoint": "/progress",
        "results_endpoint": "/results"
    }

@app.get("/progress")
async def get_progress():
    """Return current progress."""
    return scanner.get_progress()

@app.get("/results")
async def get_results():
    """Return completed scan results."""
    result_file = Path(scanner.result_file)
    if result_file.exists():
        with open(result_file, 'r') as f:
            return json.load(f)
    return {"message": "No results available yet."}

@app.post("/files/delete")
async def delete_files(files: List[str], delete_permanently: bool = False):
    """Delete multiple files"""
    return await file_ops.delete_files(files, delete_permanently)

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