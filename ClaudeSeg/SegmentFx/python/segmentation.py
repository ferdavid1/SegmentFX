import sys
import cv2
import numpy as np
import os
from PIL import Image
# import torch
from concurrent.futures import ThreadPoolExecutor, as_completed

def process_batch(batch_frames, predictor, user_mask, input_box):
    predictor.set_image(np.stack(batch_frames))
    masks, _, _ = predictor.predict(
        point_coords=None,
        point_labels=None,
        box=np.tile(input_box[None, :], (len(batch_frames), 1)),
        multimask_output=False,
    )
    return np.logical_and(masks, user_mask > 0).astype(np.uint8) * 255


def load_model(manual=False):
    from mobile_sam import sam_model_registry, SamPredictor, SamAutomaticMaskGenerator
    model_type = "vit_t" # tiny model
    sam_checkpoint = "models/mobile_sam.pt"
    device = "cpu"
    # device = "cuda" if torch.cuda.is_available() else "cpu"

    if not manual:
        mobile_sam = sam_model_registry[model_type](checkpoint=sam_checkpoint)
        mobile_sam.to(device=device)
        mask_generator = SamAutomaticMaskGenerator(mobile_sam)
    else:
        mobile_sam = sam_model_registry[model_type](checkpoint=sam_checkpoint)
        mobile_sam.to(device=device)
        mask_generator = SamPredictor(mobile_sam)
    return mask_generator

def auto_segment(video_path, object_count):
    mask_generator = load_model()
    video = cv2.VideoCapture(video_path)
    
    frame_count = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = video.get(cv2.CAP_PROP_FPS)
    width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Create output directory
    output_dir = "segmentation_output"
    os.makedirs(output_dir, exist_ok=True)

    # Prepare mask storage
    all_masks = []
    mask_metadata = []

    for frame_num in range(frame_count):
        ret, frame = video.read()
        if not ret:
            break
        
        # Convert frame to RGB (MobileSAM expects RGB)
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Generate masks
        masks = mask_generator.generate(frame_rgb)
        
        # Process the top N masks based on object_count
        top_masks = sorted(masks, key=lambda x: x['area'], reverse=True)[:object_count]
        
        frame_masks = []
        for i, mask_data in enumerate(top_masks):
            mask = mask_data['segmentation'].astype(np.uint8) * 255
            frame_masks.append(mask)

            # Save individual mask as image
            mask_filename = f"mask_frame{frame_num:04d}_object{i:02d}.png"
            cv2.imwrite(os.path.join(output_dir, mask_filename), mask)

            # Store metadata
            mask_metadata.append({
                'frame': frame_num,
                'object_id': i,
                'filename': mask_filename,
                'bbox': mask_data['bbox'].tolist(),  # Convert numpy array to list
                'area': float(mask_data['area']),  # Convert numpy float to Python float
                'stability_score': float(mask_data['stability_score'])
            })
        
        all_masks.append(frame_masks)
        
        # Report progress
        if frame_num % 30 == 0:
            progress = (frame_num + 1) / frame_count * 100
            print(f"Progress: {progress:.2f}%")

    video.release()

    # Save metadata as JSON
    with open(os.path.join(output_dir, 'mask_metadata.json'), 'w') as f:
        json.dump(mask_metadata, f, indent=2)

    # Create a video of all masks combined
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(os.path.join(output_dir, 'combined_masks.mp4'), fourcc, fps, (width, height), isColor=False)

    for frame_masks in all_masks:
        combined_mask = np.zeros((height, width), dtype=np.uint8)
        for mask in frame_masks:
            combined_mask = np.maximum(combined_mask, mask)
        out.write(combined_mask)

    out.release()

    print(f"Segmentation complete. Output saved to {output_dir}")
    return output_dir

def manual_segment(video_path, mask_path, batch_size=32, skip_frames=2):
    predictor = load_model(manual=True)
    video = cv2.VideoCapture(video_path)
    frame_count = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    
    user_mask = np.array(Image.open(mask_path).convert('L'))
    rows, cols = np.where(user_mask > 0)
    top, left, bottom, right = np.min(rows), np.min(cols), np.max(rows), np.max(cols)
    input_box = np.array([left, top, right, bottom])

    all_masks = [None] * frame_count
    
    with ThreadPoolExecutor(max_workers=4) as executor:
        for start_frame in range(0, frame_count, batch_size * skip_frames):
            batch_frames = []
            batch_indices = []
            for i in range(start_frame, min(start_frame + batch_size * skip_frames, frame_count), skip_frames):
                video.set(cv2.CAP_PROP_POS_FRAMES, i)
                ret, frame = video.read()
                if not ret:
                    break
                batch_frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                batch_indices.append(i)

            if not batch_frames:
                break

            future = executor.submit(process_batch, batch_frames, predictor, user_mask, input_box)
            future_to_indices = (future, batch_indices)

            for future, indices in as_completed([future_to_indices]):
                batch_masks = future.result()
                for mask, index in zip(batch_masks, indices):
                    all_masks[index] = mask
                    # Interpolate for skipped frames
                    if skip_frames > 1 and index + skip_frames < frame_count:
                        next_mask = all_masks[index + skip_frames]
                        if next_mask is not None:
                            for j in range(1, skip_frames):
                                interp_mask = (mask * (skip_frames - j) + next_mask * j) / skip_frames
                                all_masks[index + j] = interp_mask.astype(np.uint8)

            # Report progress
            progress = (start_frame + len(batch_frames) * skip_frames) / frame_count * 100
            print(f"Progress: {progress:.2f}%")

    video.release()
    return [mask for mask in all_masks if mask is not None]

if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "auto":
        video_path = str(sys.argv[2])
        object_count = int(sys.argv[3])
        auto_segment(video_path, object_count)
    elif mode == "manual":
        video_path = str(sys.argv[2])
        mask_path = sys.argv[3]
        manual_segment(video_path, mask_path)
