import os
import torch
from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration
from PIL import Image
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

# Define paths
# Using absolute path as requested/implied by environment
MODEL_PATH = r"D:\AI_project\Material_search\python_service\Logics_Parsing"
IMAGE_PATH = r"D:\AI_project\Material_search\python_service\test\1.png"

def test_inference():
    print("="*50)
    print("Logics-Parsing Model Inference Test")
    print("="*50)

    # 1. Validation
    if not os.path.exists(MODEL_PATH):
        print(f"[Error] Model path not found: {MODEL_PATH}")
        return
    if not os.path.exists(IMAGE_PATH):
        print(f"[Error] Test image not found: {IMAGE_PATH}")
        return
        
    print(f"Model Path: {MODEL_PATH}")
    print(f"Image Path: {IMAGE_PATH}")

    try:
        # 2. Load Model & Processor
        print("\n[1/3] Loading model and processor...")
        # Note: Using Qwen2_5_VLForConditionalGeneration directly as it is available in transformers 4.57+
        model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            MODEL_PATH,
            torch_dtype="auto",
            device_map="auto",
            trust_remote_code=True
        )
        processor = AutoProcessor.from_pretrained(MODEL_PATH, trust_remote_code=True)
        print("Model loaded successfully.")

        # 3. Prepare Input
        print("\n[2/3] Processing input...")
        image = Image.open(IMAGE_PATH)
        
        prompt_text = "将图片/pdf内容转换成markdown格式输出"
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": prompt_text},
                ],
            }
        ]

        # Prepare text input
        text = processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        
        # Prepare model inputs
        # Try to import qwen_vl_utils for vision info processing if available
        try:
            from qwen_vl_utils import process_vision_info
            image_inputs, video_inputs = process_vision_info(messages)
            inputs = processor(
                text=[text],
                images=image_inputs,
                videos=video_inputs,
                padding=True,
                return_tensors="pt",
            )
        except ImportError:
            print("Notice: 'qwen_vl_utils' not found. Attempting direct processor usage.")
            # Fallback: pass image directly to processor
            # This works for some versions of transformers/models
            inputs = processor(
                text=[text],
                images=[image],
                padding=True,
                return_tensors="pt",
            )

        # Move inputs to device
        inputs = inputs.to(model.device)

        # 4. Generate
        print("\n[3/3] Generating response...")
        generated_ids = model.generate(**inputs, max_new_tokens=128)
        
        # Decode
        generated_ids_trimmed = [
            output_ids[len(input_ids):] for input_ids, output_ids in zip(inputs.input_ids, generated_ids)
        ]
        output_text = processor.batch_decode(
            generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=True
        )
        
        print("\n" + "="*20 + " RESULT " + "="*20)
        print(output_text[0])
        print("="*50)

    except ImportError as e:
        print(f"\n[Error] Import failed: {e}")
        print("Please ensure transformers and other dependencies are installed.")
    except Exception as e:
        print(f"\n[Error] An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_inference()
