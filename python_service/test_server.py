import requests
import os
import json

url = "http://localhost:8000/parse"
image_path = r"E:\Github_project\Material_search\public\uploads\海加-轻钢龙骨-产品合格证.png"

# Check if image exists
if not os.path.exists(image_path):
    print(f"Error: Image not found at {image_path}")
    # Try to find another png if this one is missing, or just warn
    # For now, let's assume the user's path is correct as they used it before.
else:
    print(f"Found image at {image_path}")

try:
    with open(image_path, 'rb') as f:
        files = {
            'file': ('test_image.png', f, 'image/png')
        }
        data = {
            'docType': 'CERTIFICATE'
        }

        print(f"Sending request to {url}...")
        response = requests.post(url, files=files, data=data)
        print(f"Status Code: {response.status_code}")
        try:
            print("Response JSON:")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        except:
            print("Response Text:")
            print(response.text)

except Exception as e:
    print(f"Request failed: {e}")
