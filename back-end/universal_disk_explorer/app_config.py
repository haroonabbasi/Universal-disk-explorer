from pydantic_settings import BaseSettings
import os

print(f"app_config_path={os.getcwd()}")  # Ensure this points to the directory containing the .env file

class AppConfig(BaseSettings):
    APP_NAME: str = "universal-disk-explorer"
    DEBUG: bool = False
    FFMPEG_PATH: str
    FFPROBE_PATH: str

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


_config = None  # Private variable to hold the cached instance


def get_config():
    global _config
    if _config is None:
        try:
            _config = AppConfig()  # Create and cache the configuration
        except Exception as e:
            print(f"Error loading configuration: {e}")
            raise
    return _config
