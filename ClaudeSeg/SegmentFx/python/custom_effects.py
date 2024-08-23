import cv2
import numpy as np
import json
import sys
import os

def apply_glitch_effect(frame, intensity=0.5):
    # Split the frame into channels
    b, g, r = cv2.split(frame)
    
    # Apply random shifts to each channel
    rows, cols = frame.shape[:2]
    shift = int(intensity * cols / 10)  # Adjust shift based on intensity
    
    b = np.roll(b, shift, axis=1)
    r = np.roll(r, -shift, axis=1)
    
    # Merge the channels back
    glitched_frame = cv2.merge([b, g, r])
    
    return glitched_frame

def apply_pixelate_effect(frame, block_size=10):
    h, w = frame.shape[:2]
    
    # Resize down
    temp = cv2.resize(frame, (w // block_size, h // block_size), interpolation=cv2.INTER_LINEAR)
    
    # Resize up
    return cv2.resize(temp, (w, h), interpolation=cv2.INTER_NEAREST)

def process_video(input_path, effect_name, parameters, output_dir):
    cap = cv2.VideoCapture(input_path)
    
    # Get video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        if effect_name == "glitch":
            intensity = parameters.get("intensity", 0.5)
            processed_frame = apply_glitch_effect(frame, intensity)
        elif effect_name == "pixelate":
            block_size = parameters.get("block_size", 10)
            processed_frame = apply_pixelate_effect(frame, block_size)
        else:
            processed_frame = frame  # No effect applied
        
        # Save the processed frame
        output_path = os.path.join(output_dir, f"frame_{frame_count:06d}.png")
        cv2.imwrite(output_path, processed_frame)
        
        frame_count += 1
        
        # Print progress
        if frame_count % 10 == 0:
            print(f"Processed {frame_count}/{total_frames} frames")
    
    cap.release()
    
    return output_dir

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python custom_effects.py <input_video_path> <effect_name> <parameters_json>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    effect_name = sys.argv[2]
    parameters = json.loads(sys.argv[3])
    
    output_dir = os.path.join(os.path.dirname(input_path), f"{effect_name}_output")
    
    result = process_video(input_path, effect_name, parameters, output_dir)
    
    print(json.dumps({"output_path": result}))