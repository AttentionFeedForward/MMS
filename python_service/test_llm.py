
import os
from openai import OpenAI

client = OpenAI(
    api_key="",
    base_url="https://jcpt-open.cscec.com/aijsxmywyapi/0510250001/v1.0/qwen_vl_max_public",
)

completion = client.chat.completions.create(
    model="qwen_vl_max_public",
    messages=[
        {
            "role": "system",
            "content": [
                {"type": "text", "text": "You are a helpful assistant."}
            ]
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241022/emyrja/dog_and_girl.jpeg"
                    }
                },
                {
                    "type": "text",
                    "text": "图中描绘的是什么景象?"
                }
            ]
        }
    ]
)

print(completion.model_dump_json())