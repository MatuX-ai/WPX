"""
POST /api/remove-bg — 使用 rembg 去除图片背景，返回 PNG。
启动：python src/server/remove-bg-service.py
依赖：pip install -r src/server/requirements.txt
"""

from __future__ import annotations

import os
import sys

try:
    from fastapi import FastAPI, File, HTTPException, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse, Response
except ImportError:
    print("缺少 FastAPI，请运行：pip install -r src/server/requirements.txt", file=sys.stderr)
    raise

try:
    from rembg import remove as rembg_remove
except ImportError:
    rembg_remove = None

PORT = int(os.environ.get("REMOVE_BG_SERVICE_PORT", "3002"))
MAX_UPLOAD_BYTES = int(os.environ.get("REMOVE_BG_MAX_BYTES", str(20 * 1024 * 1024)))

app = FastAPI(title="WPX Remove Background Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def rembg_available() -> bool:
    return rembg_remove is not None


@app.get("/api/remove-bg/health")
async def health():
    return {
        "status": "ok",
        "rembg": rembg_available(),
    }


@app.post("/api/remove-bg")
async def remove_bg(file: UploadFile = File(...)):
    if not rembg_available():
        return JSONResponse(
            status_code=503,
            content={
                "error": "rembg 未安装",
                "message": "请运行：pip install -r src/server/requirements.txt",
            },
        )

    content_type = (file.content_type or "").lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="请上传图片文件")

    input_data = await file.read()
    if not input_data:
        raise HTTPException(status_code=400, detail="图片文件为空")

    if len(input_data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"图片过大，最大支持 {MAX_UPLOAD_BYTES // (1024 * 1024)}MB",
        )

    try:
        output_data = rembg_remove(input_data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"去背景失败：{exc}") from exc

    if not output_data:
        raise HTTPException(status_code=500, detail="去背景失败：未生成结果")

    return Response(content=output_data, media_type="image/png")


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, list):
        message = "; ".join(str(item) for item in detail)
    else:
        message = str(detail)

    return JSONResponse(
        status_code=exc.status_code,
        content={"error": message, "detail": detail},
    )


if __name__ == "__main__":
    import uvicorn

    if not rembg_available():
        print("[remove-bg-service] 警告：未检测到 rembg，/api/remove-bg 将返回 503")
        print("[remove-bg-service] 请运行：pip install -r src/server/requirements.txt")

    print(f"[remove-bg-service] 运行于 http://localhost:{PORT}")
    print("[remove-bg-service] POST /api/remove-bg  (multipart: file)")

    uvicorn.run(app, host="0.0.0.0", port=PORT)
