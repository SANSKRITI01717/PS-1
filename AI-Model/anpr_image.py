from ultralytics import YOLO
import cv2
from fast_plate_ocr import LicensePlateRecognizer
import mongo_connection as mc
import time
# import numpy as np

#loading models
print("Loading Model ...")
model = YOLO("/models/epoch2.pt")
model.to("cuda")
recognizer = LicensePlateRecognizer("cct-xs-v2-global-model")
print("Model loaded")

#Number Plate Detection + OCR reading
def ANPR(imgpath,id):
    camera_id = id
    image = cv2.imread(imgpath)
    print("Running inference")
    results = model.predict(source=image,conf=0.25)
    timestamp = time.time()
    print("Inferenced")

    for result in results:
        boxes = result.boxes.xyxy.cpu().numpy()
        # print(boxes)
        for box in boxes:
            x1,y1,x2,y2 = map(int,box)
            # print(x1,y1,x2,y2)
            cropped = image[y1:y2,x1:x2]
            # cv2.imshow("cropped",cropped)
            # cv2.waitKey(0)
            plate_text = recognizer.run(cropped, return_confidence=True)
            print(plate_text[0].plate)    
            print("avg confidence : " + str(plate_text[0].char_probs.mean()))
            data = {
                "plate": plate_text[0].plate,
                "time" : timestamp,
                "camera_id" : camera_id
            }
            # mc.insert_document(data=data)  # Uncomment this line to send DB request

#enter the path to your image
#the number 0 is the camera id to be sent to the database
ANPR("./images/img1.jpg",0)
