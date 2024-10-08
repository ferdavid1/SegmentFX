import cv2
import gc
import json
import multiprocessing
import numpy as np
import os
from PIL import Image
import queue
import sys
import time
import traceback
# import torch
from concurrent.futures import ThreadPoolExecutor, as_completed
import warnings

def manual_process_batch(batch_frames, predictor, user_mask, input_box):
    predictor.set_image(np.stack(batch_frames))
    masks, _, _ = predictor.predict(
        point_coords=None,
        point_labels=None,
        box=np.tile(input_box[None, :], (len(batch_frames), 1)),
        multimask_output=False,
    )
    return np.logical_and(masks, user_mask > 0).astype(np.uint8) * 255

def process_frame(process_id, task_queue, result_queue, object_count, resize_factor):
    print(f"Worker {process_id} starting")
    mask_generator = load_model()
    print(f"Worker {process_id} loaded model")
    while True:
        try:
            task = task_queue.get(timeout=60)
            if task is None:  # Signal to end the process
                print(f"Worker {process_id} received end signal")
                break
            frame_num, frame, original_size = task
            start_time = time.time()
            print(f"Worker {process_id} processing frame {frame_num}")
            try:
                # Resize frame for segmentation
                h, w = frame.shape[:2]
                small_frame = cv2.resize(frame, (int(w * resize_factor), int(h * resize_factor)))
                
                masks = mask_generator.generate(small_frame)
                top_masks = sorted(masks, key=lambda x: x['area'], reverse=True)[:object_count]
                
                # Resize masks back to original size
                for mask in top_masks:
                    mask['segmentation'] = cv2.resize(mask['segmentation'].astype(np.uint8), original_size) > 0
                    # Adjust bounding box
                    x1, y1, x2, y2 = mask['bbox']
                    mask['bbox'] = [
                        int(x1 / resize_factor),
                        int(y1 / resize_factor),
                        int(x2 / resize_factor),
                        int(y2 / resize_factor)
                    ]
                    mask['area'] = mask['area'] / (resize_factor ** 2)
                
                process_time = time.time() - start_time
                result_queue.put((frame_num, top_masks, process_time))
                print(f"Worker {process_id} completed frame {frame_num} in {process_time:.2f} seconds")
            except Exception as e:
                print(f"Worker {process_id} error processing frame {frame_num}: {str(e)}")
                traceback.print_exc()
                result_queue.put((frame_num, None, 0))
            gc.collect()
            
            # Periodic status update
            if frame_num % 10 == 0:
                memory_usage = psutil.Process().memory_info().rss / 1024 / 1024  # in MB
                print(f"Worker {process_id} status: Frame {frame_num}, Memory usage: {memory_usage:.2f} MB")
                
        except Exception as e:
            print(f"Error in worker process {process_id}: {str(e)}")
            traceback.print_exc()
    print(f"Worker {process_id} finishing")


def prepare_frames(video_path, max_frames=None):
    video = cv2.VideoCapture(video_path)
    frame_count = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = video.get(cv2.CAP_PROP_FPS)
    width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    frames = []
    for frame_num in range(frame_count):
        if max_frames is not None and frame_num >= max_frames:
            break
        ret, frame = video.read()
        if not ret:
            break
        frames.append((frame_num, cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), (width, height)))
    
    video.release()
    return frames, fps, (width, height)

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


def auto_segment(video_path, object_count, num_processes=None, max_frames=None, resize_factor=0.5):
    if num_processes is None:
        num_processes = max(1, multiprocessing.cpu_count() - 2)  # Leave two CPUs free

    start_time = time.time()
    
    print("Preparing frames...")
    frames, fps, original_size = prepare_frames(video_path, max_frames)
    print(f"Prepared {len(frames)} frames")

    output_dir = "segmentation_output"
    os.makedirs(output_dir, exist_ok=True)

    # Create queues for tasks and results
    task_queue = multiprocessing.Queue()
    result_queue = multiprocessing.Queue()

    # Start worker processes
    processes = []
    for i in range(num_processes):
        p = multiprocessing.Process(target=process_frame, args=(i, task_queue, result_queue, object_count, resize_factor))
        p.start()
        processes.append(p)

    # Add tasks to the queue
    for frame in frames:
        task_queue.put(frame)
    print(f"Added {len(frames)} frames to task queue")

    # Add end signals
    for _ in range(num_processes):
        task_queue.put(None)
    print("Added end signals to task queue")

    # Collect results
    results = []
    total_process_time = 0
    timeout_counter = 0
    while len(results) < len(frames):
        try:
            frame_num, frame_result, process_time = result_queue.get(timeout=600)  # Increased timeout to 10 minutes
            results.append((frame_num, frame_result))
            if frame_result is not None:
                total_process_time += process_time
            print(f"Received result for frame {frame_num}. Total frames processed: {len(results)}/{len(frames)}")
            timeout_counter = 0  # Reset timeout counter on successful receive
        except Exception as e:
            print(f"Error while collecting results: {str(e)}")
            traceback.print_exc()
            timeout_counter += 1
            if timeout_counter > 5:  # Break after 5 consecutive timeouts
                print("Too many consecutive timeouts. Breaking loop.")
                break

    # Wait for all processes to finish
    for p in processes:
        p.join(timeout=120)  # Increased timeout to 2 minutes
        if p.is_alive():
            print(f"Worker process {p.pid} did not finish in time. Terminating.")
            p.terminate()

    # Sort results by frame number
    results.sort(key=lambda x: x[0])

    # Process results
    all_masks = []
    mask_metadata = []
    frame_num = 0
    for batch_result in results:
        for frame_masks in batch_result:
            frame_mask_data = []
            for i, mask_data in enumerate(frame_masks):
                mask = mask_data['segmentation'].astype(np.uint8) * 255
                mask_filename = f"mask_frame{frame_num:04d}_object{i:02d}.png"
                cv2.imwrite(os.path.join(output_dir, mask_filename), mask)
                frame_mask_data.append(mask)
                mask_metadata.append({
                    'frame': frame_num,
                    'object_id': i,
                    'filename': mask_filename,
                    'bbox': mask_data['bbox'],
                    'area': float(mask_data['area']),
                    'stability_score': float(mask_data['stability_score'])
                })
            all_masks.append(frame_mask_data)

            if frame_num % 30 == 0:
                progress = (frame_num + 1) / frame_count * 100
                print(f"Processing progress: {progress:.2f}%")
            
            frame_num += 1

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

    end_time = time.time()
    total_time = end_time - start_time
    frames_processed = sum(len(batch) for batch in batches)
    frames_per_second = frames_processed / total_process_time if total_process_time > 0 else 0

    print(f"Segmentation complete. Output saved to {output_dir}")
    print(f"Total processing time: {total_time:.2f} seconds")
    print(f"Total segmentation time: {total_process_time:.2f} seconds")
    print(f"Frames processed: {frames_processed}")
    print(f"Frames per second (during segmentation): {frames_per_second:.2f}")
    
    return output_dir, total_time, frames_per_second


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

            future = executor.submit(manual_process_batch, batch_frames, predictor, user_mask, input_box)
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
