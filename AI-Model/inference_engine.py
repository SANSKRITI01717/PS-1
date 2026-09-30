import sys
import os
import json
import argparse
import time
import re
import cv2
import numpy as np
import torch
from ultralytics import YOLO
from fast_plate_ocr import LicensePlateRecognizer

def fix_indian_plate(text):
    text = re.sub(r"[^A-Z0-9]", "", text.upper())
    length = len(text)
    if length not in (9, 10):
        return text

    char_to_num = {
        "O": "0", "Q": "0", "I": "1", "L": "1", "Z": "2",
        "S": "5", "B": "8", "G": "6", "A": "4",
    }
    num_to_char = {
        "0": "O", "1": "I", "2": "Z", "5": "S", "8": "B",
        "4": "A", "6": "G",
    }

    pattern = (
        ["char", "char", "num", "num", "char", "char", "num", "num", "num", "num"]
        if length == 10
        else ["char", "char", "num", "char", "char", "num", "num", "num", "num"]
    )

    return "".join(
        num_to_char.get(c, c) if p == "char" else char_to_num.get(c, c)
        for c, p in zip(text, pattern)
    )

def evaluate_sharpness(crop):
    if crop is None or crop.size == 0:
        return 0.0
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    norm = cv2.resize(gray, (128, 64), interpolation=cv2.INTER_AREA)
    return float(cv2.Laplacian(norm, cv2.CV_64F).var())

def enhance_crop(crop):
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    enhanced = clahe.apply(gray)
    enhanced = cv2.resize(enhanced, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

def run_inference(image_path, model_path, min_conf=0.25, ocr_conf_floor=0.45):
    t_start = time.perf_counter()
    
    if not os.path.exists(image_path):
        return {
            "success": False,
            "error": f"Image file not found: {image_path}",
            "detections": []
        }

    image = cv2.imread(image_path)
    if image is None:
        return {
            "success": False,
            "error": "Failed to decode image file",
            "detections": []
        }

    h, w, _ = image.shape

    # Load YOLO detector
    device = "cuda" if torch.cuda.is_available() else "cpu"
    try:
        model = YOLO(model_path)
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to load YOLO model from {model_path}: {str(e)}",
            "detections": []
        }

    # Load OCR engine
    try:
        recognizer = LicensePlateRecognizer("cct-xs-v2-global-model")
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to load OCR recognizer: {str(e)}",
            "detections": []
        }

    # Run YOLO detection
    results = model.predict(source=image, conf=min_conf, verbose=False, device=device)
    detections = []

    for result in results:
        boxes = result.boxes.xyxy.cpu().numpy()
        scores = result.boxes.conf.cpu().numpy() if result.boxes.conf is not None else [1.0] * len(boxes)

        for box, yolo_score in zip(boxes, scores):
            x1, y1, x2, y2 = map(int, box)
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(w, x2)
            y2 = min(h, y2)

            if x2 <= x1 or y2 <= y1:
                continue

            crop = image[y1:y2, x1:x2]
            sharpness = evaluate_sharpness(crop)

            # OCR processing
            processed = enhance_crop(crop)
            predictions = recognizer.run(processed, return_confidence=True)

            if predictions:
                pred = predictions[0]
                raw_plate = pred.plate.strip()
                avg_char_prob = float(pred.char_probs.mean()) if hasattr(pred, "char_probs") and pred.char_probs is not None else float(yolo_score)
                cleaned_plate = fix_indian_plate(raw_plate)

                if avg_char_prob >= ocr_conf_floor and len(cleaned_plate) >= 4:
                    detections.append({
                        "plateNumber": cleaned_plate,
                        "rawPlate": raw_plate,
                        "confidence": round(avg_char_prob, 4),
                        "yoloConfidence": round(float(yolo_score), 4),
                        "sharpness": round(sharpness, 1),
                        "bbox": {
                            "x1": x1,
                            "y1": y1,
                            "x2": x2,
                            "y2": y2,
                            "width": x2 - x1,
                            "height": y2 - y1
                        }
                    })

    t_elapsed = (time.perf_counter() - t_start) * 1000

    return {
        "success": True,
        "imageWidth": w,
        "imageHeight": h,
        "detections": detections,
        "detectionCount": len(detections),
        "inferenceTimeMs": round(t_elapsed, 2),
        "device": device
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ANPR / OCR Inference Pipeline")
    parser.add_argument("--image", required=True, help="Path to input image")
    parser.add_argument("--model", default="models/custom_trained_model.pt", help="Path to custom YOLO model")
    parser.add_argument("--conf", type=float, default=0.25, help="YOLO confidence threshold")
    parser.add_argument("--ocr_floor", type=float, default=0.45, help="OCR minimum confidence floor")

    args = parser.parse_args()

    # Resolve relative path if needed
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = args.model
    if not os.path.isabs(model_path):
        model_path = os.path.join(base_dir, model_path)

    image_path = os.path.abspath(args.image)

    res = run_inference(image_path, model_path, args.conf, args.ocr_floor)
    print(json.dumps(res, indent=2))
