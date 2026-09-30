import cv2
import numpy as np
import os

os.makedirs("test_samples", exist_ok=True)

def create_vehicle_frame(filename, plate_text, is_blurry=False):
    # Create realistic frame with road/car mock
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    # Background road
    frame[0:240, :] = [45, 52, 54]
    frame[240:480, :] = [30, 35, 38]

    # Car body silhouette
    cv2.rectangle(frame, (140, 160), (500, 380), (80, 90, 110), -1)
    cv2.rectangle(frame, (180, 100), (460, 200), (60, 70, 85), -1)
    
    # Headlights
    cv2.circle(frame, (180, 280), 22, (200, 240, 255), -1)
    cv2.circle(frame, (460, 280), 22, (200, 240, 255), -1)

    if plate_text:
        # License plate patch
        x1, y1, x2, y2 = 250, 300, 390, 350
        cv2.rectangle(frame, (x1-2, y1-2), (x2+2, y2+2), (0, 0, 0), -1)
        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 255), -1)
        # Font text
        cv2.putText(frame, plate_text, (x1 + 10, y1 + 35), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 0), 2)
    
    if is_blurry:
        frame = cv2.GaussianBlur(frame, (51, 51), 0)

    filepath = os.path.join("test_samples", filename)
    cv2.imwrite(filepath, frame)
    print(f"Generated sample: {filepath}")

create_vehicle_frame("car_delhi.jpg", "DL01CA1234")
create_vehicle_frame("car_mumbai.jpg", "MH12AB1234")
create_vehicle_frame("car_up.jpg", "UP16CD5678")
create_vehicle_frame("road_blurry_empty.jpg", None, is_blurry=True)
print("Sample generation complete.")
