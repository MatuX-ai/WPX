"""Knowledge service runtime acceptance script."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("KNOWLEDGE_TEST_BASE", "http://localhost:3003")


def get(path: str) -> dict:
    with urllib.request.urlopen(BASE + path, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def post_multipart(path: str, fields: dict, files: dict) -> dict:
    boundary = "----wpxboundary7MA4YWxkTrZu0gW"
    body: list[bytes | str] = []

    for name, value in fields.items():
        body.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'
        )

    for name, (filename, content, content_type) in files.items():
        body.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\nContent-Type: {content_type}\r\n\r\n'
        )
        body.append(content)
        body.append("\r\n")

    body.append(f"--{boundary}--\r\n")

    data = b"".join(part.encode("utf-8") if isinstance(part, str) else part for part in body)
    request = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )

    with urllib.request.urlopen(request, timeout=300) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    print("=== health ===")
    health = get("/api/knowledge/health")
    print(json.dumps(health, ensure_ascii=False))
    if not health.get("chroma"):
        print("FAIL: chroma not available")
        return 1
    print("embedding_backend", health.get("embedding"))

    markdown = """# 资料库验收文档

这是一份用于验收资料库上传与向量化的测试文档。

## 要点
- 支持 Markdown 上传
- 内容会被切片并向量化
- 关键词：周报 需求文档 API
"""

    print("=== upload file ===")
    upload = post_multipart(
        "/api/knowledge/upload",
        {},
        {"file": ("acceptance-test.md", markdown.encode("utf-8"), "text/markdown")},
    )
    item = upload.get("item", {})
    print(
        "success",
        upload.get("success"),
        "chunks",
        item.get("chunkCount"),
        "id",
        item.get("id", "")[:8],
    )

    if not upload.get("success") or not item.get("chunkCount"):
        print("FAIL: upload did not produce chunks")
        return 1

    print("=== list ===")
    items = get("/api/knowledge/list").get("items", [])
    print("count", len(items), "first", items[0]["filename"] if items else None)
    if not items:
        print("FAIL: list empty after upload")
        return 1

    doc_id = item["id"]
    print("=== preview ===")
    preview = get(f"/api/knowledge/{doc_id}/preview")
    content = preview.get("content", "")
    print("content_ok", "验收" in content, "len", len(content))
    if "验收" not in content:
        print("FAIL: preview content missing expected text")
        return 1

    print("=== chroma data dir ===")
    from pathlib import Path

    chroma_dir = Path(__file__).resolve().parents[1] / "src" / "server" / "data" / "knowledge" / "chroma"
    print("exists", chroma_dir.exists(), "files", len(list(chroma_dir.rglob("*"))) if chroma_dir.exists() else 0)

    print("ALL_PASSED")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.URLError as exc:
        print("FAIL: could not reach knowledge-service:", exc)
        raise SystemExit(1) from exc
