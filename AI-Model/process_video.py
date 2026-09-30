import sys
import os
import argparse
import json
import cv2
from inference_engine import run_inference

def process_video(video_path, model_path, camera_id="CAM-IND-01", sample_rate_fps=1):
    if not os.path.exists(video_path):
        return {"success": False, "error": f"Video not found: {video_path}"}

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"success": False, "error": "Failed to open video file"}

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_interval = max(1, int(video_fps / sample_rate_fps))

    temp_dir = os.path.join(os.path.dirname(video_path), "video_temp_frames")
    os.makedirs(temp_dir, exist_ok=True)

    frame_idx = 0
    sampled_count = 0
    all_detections = []

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_interval == 0:
                sampled_count += 1
                temp_frame_path = os.path.join(temp_dir, f"frame_{sampled_count}.jpg")
                cv2.imwrite(temp_frame_path, frame)

                result = run_inference(temp_frame_path, model_path, min_conf=0.25, ocr_conf_floor=0.45)
                
                # Cleanup temp frame
                if os.path.exists(temp_frame_path):
                    os.remove(temp_frame_path)

                if result.get("success") and result.get("detections"):
                    for det in result["detections"]:
                        all_detections.append({
                            **det,
                            "frameNumber": frame_idx,
                            "videoTimestampSeconds": round(frame_idx / video_fps, 2),
                            "cameraId": camera_id
                        })

            frame_idx += 1

    finally:
        cap.release()
        if os.path.exists(temp_dir):
            try:
                os.rmdir(temp_dir)
            except:
                pass

    return {
        "success": True,
        "totalFrames": frame_idx,
        "sampledFrames": sampled_count,
        "detectionCount": len(all_detections),
        "detections": all_detections
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--model", default="models/custom_trained_model.pt")
    parser.add_argument("--camera", default="CAM-IND-01")
    parser.add_argument("--fps", type=float, default=1.0)
    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = args.model
    if not os.path.isabs(model_path):
        model_path = os.path.join(base_dir, model_path)

    res = process_video(os.path.abspath(args.video), model_path, args.camera, args.fps)
    print(json.dumps(res, indent=2))
