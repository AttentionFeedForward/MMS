# from vllm import LLM, SamplingParams
# from vllm.model_executor.models.deepseek_ocr import NGramPerReqLogitsProcessor
# from PIL import Image

# # Create model instance
# llm = LLM(
#     model=r"E:\Github_project\Material_search\python_service\models\deepseek-ai\DeepSeek-OCR\model-00001-of-000001.safetensors",
#     enable_prefix_caching=False,
#     mm_processor_cache_gb=0,
#     logits_processors=[NGramPerReqLogitsProcessor]
# )

# # Prepare batched input with your image file
# image_1 = Image.open(r"E:\Github_project\Material_search\public\uploads\海加-轻钢龙骨-产品合格证.png").convert("RGB")

# prompt = "<image>\nFree OCR."

# model_input = [
#     {
#         "prompt": prompt,
#         "multi_modal_data": {"image": image_1}
#     }
# ]

# sampling_param = SamplingParams(
#             temperature=0.0,
#             max_tokens=8192,
#             # ngram logit processor args
#             extra_args=dict(
#                 ngram_size=30,
#                 window_size=90,
#                 whitelist_token_ids={128821, 128822},  # whitelist: <td>, </td>
#             ),
#             skip_special_tokens=False,
#         )
# # Generate output
# model_outputs = llm.generate(model_input, sampling_param)

# # Print output
# for output in model_outputs:
#     print(output.outputs[0].text)



from transformers import AutoModel, AutoTokenizer
import torch
import os
os.environ["CUDA_VISIBLE_DEVICES"] = '0'
model_name = r"D:\AI_project\Material_search\python_service\deepseek_ocr\deepseek-ai\DeepSeek-OCR"
os.environ["PYTORCH_ALLOC_CONF"] = "expandable_segments:True"

tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
model = AutoModel.from_pretrained(model_name, _attn_implementation='eager', trust_remote_code=True, use_safetensors=True)
model = model.eval().cuda().to(torch.bfloat16)

# prompt = "<image>\nFree OCR. "
prompt = "<image>\n<|grounding|>Convert the document to markdown. "
image_file = r"D:\AI_project\Material_search\python_service\test\page_111.jpg"
output_path = r"D:\AI_project\Material_search\python_service\output\page_111"

res = model.infer(tokenizer, prompt=prompt, image_file=image_file, output_path = output_path, base_size = 1024, image_size = 640, crop_mode=True, save_results = True, test_compress = True)
