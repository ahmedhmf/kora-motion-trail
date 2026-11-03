
from ultralytics import YOLO
import onnx

model = YOLO("yolo11n-seg.pt")

exported_path = model.export(
    format="onnx",
    imgsz=640,
    simplify=False
)

print(f"Exported model: {exported_path}")

onnx_model = onnx.load(str(exported_path))

print("\nONNX metadata:")
for item in onnx_model.metadata_props:
    print(f"{item.key}: {item.value}")

if not onnx_model.metadata_props:
    print("WARNING: No metadata found!")
