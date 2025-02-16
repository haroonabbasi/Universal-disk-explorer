import cv2
import numpy as np
from tqdm import tqdm
import logging
from ..models.schemas import VideoQualityDetails,VideoQualityResult

# Configure a logger for this module
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Adjust the log level as needed

class LocalVideoQualityAnalyzer:
    """
    Analyzes the quality of a local video file by sampling frames at a given interval,
    extracting a region of interest (ROI) from each frame, and calculating metrics such as:
    
        - Blur (sharpness)
        - Contrast
        - Edge density
        - Temporal stability (frame-to-frame difference)
    
    The aggregated metrics are normalized and combined using specified weights to yield an overall
    quality score (0-100) and a quality category (High, Medium, or Low Quality).
    
    Attributes:
        sample_interval (int): Interval in seconds at which frames are sampled.
        roi_coverage (float): Fraction (0-1) of the frame to use as the ROI (centered).
    """
    
    def __init__(self, sample_interval=1, roi_coverage=0.3):
        """
        Initializes the analyzer with the given sample interval and ROI coverage.
        
        Args:
            sample_interval (int, optional): Time interval in seconds to sample frames. Defaults to 1.
            roi_coverage (float, optional): Fraction of the frame used as ROI. Defaults to 0.3.
        """
        self.sample_interval = sample_interval
        self.roi_coverage = roi_coverage
        self.metric_weights = {
            'blur': 0.4, 
            'contrast': 0.3,
            'edge_density': 0.2,
            'temporal': 0.1
        }

    def _get_roi(self, frame):
        """
        Extracts a centered Region Of Interest (ROI) from the frame based on the roi_coverage.
        
        Args:
            frame (np.ndarray): Input video frame.
        
        Returns:
            np.ndarray: Cropped region of interest.
        """
        h, w = frame.shape[:2]
        y1 = int(h * (0.5 - self.roi_coverage/2))
        y2 = int(h * (0.5 + self.roi_coverage/2))
        x1 = int(w * (0.5 - self.roi_coverage/2))
        x2 = int(w * (0.5 + self.roi_coverage/2))
        roi = frame[y1:y2, x1:x2]
        logger.debug(f"Extracted ROI with shape: {roi.shape}")
        return roi

    def _calculate_blur(self, frame):
        """
        Calculates the blur metric of a frame using the variance of the Laplacian.
        
        Args:
            frame (np.ndarray): ROI frame.
        
        Returns:
            float: Blur metric value.
        """
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            blur_value = cv2.Laplacian(gray, cv2.CV_64F).var()
            logger.debug(f"Calculated blur: {blur_value}")
            return blur_value
        except Exception as e:
            logger.error(f"Error calculating blur: {e}")
            return 0

    def _calculate_contrast(self, frame):
        """
        Calculates the contrast metric of a frame by converting it to LAB color space.
        
        Args:
            frame (np.ndarray): ROI frame.
        
        Returns:
            float: Contrast metric value.
        """
        try:
            lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
            contrast_value = lab[:, :, 0].std()
            logger.debug(f"Calculated contrast: {contrast_value}")
            return contrast_value
        except Exception as e:
            logger.error(f"Error calculating contrast: {e}")
            return 0

    def _calculate_edge_density(self, frame):
        """
        Calculates the edge density metric of a frame using the Canny edge detector.
        
        Args:
            frame (np.ndarray): ROI frame.
        
        Returns:
            float: Edge density value.
        """
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 100, 200)
            edge_density = np.count_nonzero(edges) / (gray.shape[0] * gray.shape[1])
            logger.debug(f"Calculated edge density: {edge_density}")
            return edge_density
        except Exception as e:
            logger.error(f"Error calculating edge density: {e}")
            return 0

    def analyze_video(self, file_path) -> VideoQualityResult:
        """
        Analyzes the given video file and returns the quality result as a Pydantic model.
        
        The analysis involves sampling frames at the specified interval, calculating various
        quality metrics on a central ROI, aggregating these metrics, and computing an overall
        quality score and category.
        
        Args:
            file_path (str): Path to the video file.
        
        Returns:
            VideoQualityResult: The overall quality result including detailed metrics.
        
        Raises:
            ValueError: If the video file cannot be opened.
        """
        logger.info(f"Starting analysis for video: {file_path}")
        cap = cv2.VideoCapture(file_path)
        if not cap.isOpened():
            error_msg = f"Could not open video file {file_path}"
            logger.error(error_msg)
            raise ValueError(error_msg)

        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        logger.debug(f"Video FPS: {fps}, Total frames: {total_frames}")
        sample_step = max(1, int(fps * self.sample_interval))
        logger.debug(f"Sampling every {sample_step} frames")

        metrics = []
        prev_frame = None

        for frame_idx in tqdm(range(0, total_frames, sample_step), desc="Processing frames"):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                logger.warning(f"Frame {frame_idx} could not be read, stopping iteration.")
                break

            try:
                roi = self._get_roi(frame)
            except Exception as e:
                logger.error(f"Error extracting ROI for frame {frame_idx}: {e}")
                continue

            current_metrics = {}
            current_metrics['blur'] = self._calculate_blur(roi)
            current_metrics['contrast'] = self._calculate_contrast(roi)
            current_metrics['edge_density'] = self._calculate_edge_density(roi)
            current_metrics['temporal'] = 0

            if prev_frame is not None:
                try:
                    temporal_diff = cv2.absdiff(prev_frame, roi).mean()
                    current_metrics['temporal'] = temporal_diff
                except Exception as e:
                    logger.error(f"Error calculating temporal difference at frame {frame_idx}: {e}")
                    current_metrics['temporal'] = 0

            logger.debug(f"Metrics for frame {frame_idx}: {current_metrics}")
            metrics.append(current_metrics)
            prev_frame = roi.copy()

        cap.release()

        if not metrics:
            logger.error("No metrics were collected; returning default quality result.")
            default_details = VideoQualityDetails(blur=0, contrast=0, edge_density=0, temporal=0)
            return VideoQualityResult(score=0, category='Unknown', details=default_details)

        try:
            aggregated = self._aggregate_metrics(metrics)
            logger.info(f"Finished analysis for video: {file_path}")
        except Exception as e:
            logger.error(f"Error aggregating metrics: {e}")
            aggregated = {
                'score': 0,
                'category': 'Unknown',
                'details': {'blur': 0, 'contrast': 0, 'edge_density': 0, 'temporal': 0}
            }

        # Build the Pydantic model from aggregated results
        details = VideoQualityDetails(**aggregated['details'])
        result_model = VideoQualityResult(score=aggregated['score'],
                                          category=aggregated['category'],
                                          details=details)
        return result_model

    def _aggregate_metrics(self, metrics):
        """
        Aggregates the metrics collected from sampled frames, normalizes them, and computes
        an overall quality score.
        
        Normalization factors are applied to each metric, and a weighted sum is used to compute
        the quality score. The score is then used to classify the video quality.
        
        Args:
            metrics (list): List of dictionaries containing metrics for each sampled frame.
        
        Returns:
            dict: Aggregated result with 'score', 'category', and 'details'.
        """
        logger.debug("Aggregating metrics from all frames.")
        # Normalization factors (adjust based on your content)
        blur_norm = 300    # Higher = sharper
        contrast_norm = 50  # Higher = better contrast
        edge_norm = 0.2     # Higher = more edges
        temporal_norm = 30  # Lower = more stable

        try:
            agg = {
                'blur': np.mean([m['blur'] for m in metrics]) / blur_norm,
                'contrast': np.mean([m['contrast'] for m in metrics]) / contrast_norm,
                'edge_density': np.mean([m['edge_density'] for m in metrics]) / edge_norm,
                'temporal': 1 - (np.mean([m['temporal'] for m in metrics]) / temporal_norm)
            }
            logger.debug(f"Aggregated metrics: {agg}")
        except Exception as e:
            logger.error(f"Error during metrics aggregation: {e}")
            agg = {'blur': 0, 'contrast': 0, 'edge_density': 0, 'temporal': 0}

        quality_score = sum(
            self.metric_weights[k] * min(agg[k] if k in agg else 0, 1.0) 
            for k in ['blur', 'contrast', 'edge_density', 'temporal']
        ) * 100

        result = {
            'score': quality_score,
            'category': self._classify(quality_score),
            'details': agg
        }
        logger.debug(f"Final analysis result: {result}")
        return result

    def _classify(self, score):
        """
        Classifies the video quality based on the quality score.
        
        Args:
            score (float): Aggregated quality score.
        
        Returns:
            str: Quality category as a string.
        """
        if score >= 75:
            return "High Quality"
        elif score >= 55:
            return "Medium Quality"
        else:
            return "Low Quality"
