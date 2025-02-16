import logging
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pathlib import Path
from datetime import datetime
import json

from .app_config import get_config
from .core.scanner import FileScanner
from .core.video import VideoAnalyzer
from .core.file_ops import FileOperations
from .models.schemas import FileMetadata


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
    generate_video_screenshots: bool = Query(default=False)
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
            # Generate a unique result file name for this scan
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            scanner.result_file = Path(f"./output/results-{timestamp}.json")
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
        "results_endpoint": f"/history/{scanner.result_file.name}"
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

@app.get("/search/{path:path}")
async def search_files(
    path: str,
    background_tasks: BackgroundTasks,
    min_size: Optional[int] = Query(default=None, description="Minimum file size in bytes"),
    max_size: Optional[int] = Query(default=None, description="Maximum file size in bytes"),
    file_types: Optional[str] = Query(default=None, description="Comma-separated list of file extensions (e.g., mp4,jpg,pdf)"),
    created_before: Optional[str] = Query(default=None, description="Find files created before this date (ISO format)"),
    modified_before: Optional[str] = Query(default=None, description="Find files modified before this date (ISO format)"),
    low_quality_videos: Optional[bool] = Query(default=False, description="Include only low-quality videos"),
    top_n: Optional[int] = Query(default=None, description="Return the top N largest files"),
    include_duplicates: Optional[bool] = Query(default=False, description="Include duplicate files (based on hash)"),
    preview_image: bool = Query(default=False, description="Include preview image of file")
):
    """
    Start a background search for files based on filters.
    """
    # Convert query parameters to appropriate types
    file_types_list = file_types.split(",") if file_types else None
    created_before_date = datetime.fromisoformat(created_before) if created_before else None
    modified_before_date = datetime.fromisoformat(modified_before) if modified_before else None

    # Generate a unique result file name for this search
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    scanner.result_file = Path(f"./output/search_results-{timestamp}.json")

    # Start the background task
    background_tasks.add_task(
        scanner.search_directory_with_filters,
        path,
        scanner.result_file,
        min_size=min_size,
        max_size=max_size,
        file_types=file_types_list,
        created_before=created_before_date,
        modified_before=modified_before_date,
        low_quality_videos=low_quality_videos,
        top_n=top_n,
        include_duplicates=include_duplicates,
        preview_image=preview_image
    )

    return {
        "message": "Search started",
        "status_endpoint": "/search/progress",
        "results_endpoint": f"/history/{scanner.result_file.name}"
    }

# New API endpoint to list all history files (both scan and search results)
@app.get("/history")
async def get_history():
    output_dir = Path("./output")
    if not output_dir.exists():
        return {"scans": [], "searches": []}
    
    # Get most recent 10 scan result files
    scan_files = sorted(
        list(output_dir.glob("results-*.json")),
        key=lambda f: f.stat().st_mtime,
        reverse=True
    )[:10]
    
    # Get most recent 10 search result files
    search_files = sorted(
        list(output_dir.glob("search_results-*.json")),
        key=lambda f: f.stat().st_mtime,
        reverse=True
    )[:10]
    
    history = {
        "scans": [f.name for f in scan_files],
        "searches": [f.name for f in search_files]
    }
    
    return history

# New API endpoint to fetch a specific history file by name
@app.get("/history/{filename}")
async def get_history_file(filename: str):
    file_path = Path("./output") / filename
    if file_path.exists():
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            return data
        except Exception as e:
            raise HTTPException(status_code=500, detail="Error reading file")
    else:
        raise HTTPException(status_code=404, detail="File not found")

@app.get("/insights/{path:path}")
async def get_insights(path: str):
    """
    Get disk usage insights for a directory.
    """
    try:
        insights = await scanner.get_insights(path)
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/duplicates/{path:path}")
async def get_duplicates(path: str):
    """
    Get duplicate files in a directory.
    """
    try:
        duplicates = await scanner.find_duplicates(path)
        return duplicates
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/aging/{path:path}")
async def get_aging_files(
    path: str,
    days: int = Query(default=365, description="Number of days since last access/modification"),
    mode: str = Query(default="modified", description="Mode: 'accessed' or 'modified'"),
):
    """
    Get files that haven't been accessed/modified in a specified number of days.
    """
    try:
        aging_files = await scanner.find_aging_files(path, days, mode)
        return aging_files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))    

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