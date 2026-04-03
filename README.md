# 物料报审材料检索系统 (Material Submission System)

## 功能模块

1.  **检索库 (Retrieval Library)**:
    *   存储所有厂家、物料及通用证书（营业执照、ISO证书等）。
    *   支持 OCR 自动解析（提取有效期、厂家名）。
    *   支持多维度检索（国别、厂家、物料）。

2.  **档案库 (Project Archive)**:
    *   按项目建立档案。
    *   从检索库引用物料（自动继承通用证书）。
    *   上传项目专用资料（如：封样单）。

3.  **看板 (Dashboard)**:
    *   统计厂家、物料分布。
    *   统计各项目认样进度。

## 技术栈

*   **Framework**: Next.js 14
*   **Database**: SQLite (via Prisma)
*   **UI**: Ant Design + Tailwind CSS
*   **OCR**: Tesseract.js
*   **Charts**: Recharts

## 运行说明
1.  Node.js 前端环境设置:
    ```bash
    npm install
    ```
2.  Python 后端环境设置:
    - 创建并激活虚拟环境:
    ```
    # Windows
    python -m venv venv
    ./venv/Scripts/activate
    # Linux/macOS
    python3 -m venv venv
    source venv/bin/activate
    ```

    - 安装后端依赖:
    ```bash
    cd python_service
    pip install -r requirements.txt
    ```

3.  创建环境变量文件（不要提交到 GitHub）
    - 在项目根目录创建 `.env`
    - 你需要配置：
      - `JWT_SECRET`：JWT 密钥（用于登录）
      - `OPENAI_API_KEY`、`OPENAI_BASE_URL`：LLM/OCR 相关配置（代码在 `lib/llm.ts` 使用）
      - 邮件配置（用于到期提醒/通知）：
        - `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`EMAIL_FROM`

    说明：
    - SQLite 数据库在 `prisma/schema.prisma` 中已配置为 `file:./dev.db`（相对 `prisma/` 目录），一般本地不需要额外设置 `DATABASE_URL`。

4.  初始化数据库:
    ```bash
    npx prisma db push
    ```

5.  初始化内置账号（建议执行）:
    ```bash
    npx prisma db seed
    ```

    默认账号:
    - `admin` / `admin123`
    - `staff` / `staff123`

6.  初始化物料编码目录（可选，但如果你使用“物料编码智能搜索”需要执行）
    - 准备文件：`物料编码分级表.xlsx`
    - 脚本默认从项目根目录读取该文件；你也可以传入路径：
    ```bash
    npm run import:material-codes -- "物料编码分级表.xlsx"
    ```
7.  运行后端:
    ```bash
    python ./python_service/main.py
    ```  
8.  启动开发服务器:
    ```bash
    npm run dev
    ```
9.  访问: `http://localhost:3000`
