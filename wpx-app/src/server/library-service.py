"""
Library service — document analyze & save to user library root.

Endpoints:
  POST /api/library/analyze  — suggest path, tags, summary
  POST /api/library/save     — persist document under library root

Run: python src/server/library-service.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from fastapi import FastAPI, HTTPException, Query
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel, Field
except ImportError:
    print("缺少 FastAPI，请运行：pip install -r src/server/requirements.txt", file=sys.stderr)
    raise

PORT = int(os.environ.get("LIBRARY_SERVICE_PORT", "3004"))
LIBRARY_ROOT = Path(
    os.environ.get("LIBRARY_ROOT_DIR", str(Path(__file__).resolve().parent / "data" / "library" / "root"))
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "library"
MANIFEST_PATH = DATA_DIR / "manifest.json"
CORRECTIONS_PATH = DATA_DIR / "path-corrections.json"

DOCUMENT_EXTENSIONS = {".md", ".markdown", ".txt"}

TAG_KEYWORDS: list[tuple[str, str]] = [
    ("周报", "周报"),
    ("需求", "需求文档"),
    ("方案", "方案"),
    ("会议", "会议纪要"),
    ("总结", "总结"),
    ("计划", "计划"),
    ("报告", "报告"),
    ("教程", "教程"),
    ("笔记", "笔记"),
    ("api", "API"),
    ("设计", "设计"),
    ("测试", "测试"),
]

PATH_RULES: list[tuple[list[str], str]] = [
    (["周报", "weekly"], "工作/周报"),
    (["需求", "requirement", "prd"], "工作/需求文档"),
    (["会议", "纪要", "meeting"], "工作/会议纪要"),
    (["方案", "proposal", "设计"], "工作/方案"),
    (["总结", "复盘", "review"], "工作/总结"),
    (["计划", "plan", "roadmap"], "工作/计划"),
    (["教程", "guide", "how to"], "知识库/教程"),
    (["笔记", "note"], "知识库/笔记"),
    (["api", "接口", "endpoint"], "技术/API"),
    (["测试", "test", "qa"], "技术/测试"),
]

app = FastAPI(title="WPX Library Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PathCorrection(BaseModel):
    suggestedPath: str = ""
    chosenPath: str = ""
    title: str = ""
    tags: list[str] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    content: str
    title: str = ""
    pathCorrections: list[PathCorrection] = Field(default_factory=list)


class SaveRequest(BaseModel):
    title: str
    content: str
    path: str
    tags: list[str] = Field(default_factory=list)
    summary: str = ""
    suggestedPath: str = ""


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LIBRARY_ROOT.mkdir(parents=True, exist_ok=True)


def load_json(path: Path, default: Any) -> Any:
    ensure_dirs()
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def save_json(path: Path, data: Any) -> None:
    ensure_dirs()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def normalize_path(path: str) -> str:
    cleaned = re.sub(r"[\\/]+", "/", str(path or "").strip())
    cleaned = cleaned.strip("/")
    parts = [part for part in cleaned.split("/") if part and part not in (".", "..")]
    return "/".join(parts)


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*]', "_", str(name or "").strip())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or "未命名文档"


def tokenize(text: str) -> set[str]:
    lowered = text.lower()
    tokens = set(re.findall(r"[\u4e00-\u9fff]{2,}|[a-zA-Z]{3,}", lowered))
    tokens.update(word for word in lowered.split() if len(word) >= 2)
    return tokens


def extract_title(content: str, fallback: str = "") -> str:
    for line in content.splitlines():
        match = re.match(r"^#\s+(.+)$", line.strip())
        if match:
            return match.group(1).strip()
    return fallback.strip() or "未命名文档"


def extract_summary(content: str, max_len: int = 160) -> str:
    lines = []
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        stripped = re.sub(r"[*_`>\[\]()!]", "", stripped).strip()
        if stripped:
            lines.append(stripped)
        if len("".join(lines)) >= max_len:
            break

    text = " ".join(lines).strip()
    if not text:
        text = re.sub(r"\s+", " ", content).strip()

    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def extract_tags(content: str, title: str) -> list[str]:
    haystack = f"{title}\n{content}".lower()
    tags: list[str] = []

    for keyword, tag in TAG_KEYWORDS:
        if keyword.lower() in haystack and tag not in tags:
            tags.append(tag)

    if not tags:
        tokens = tokenize(haystack)
        for token in list(tokens)[:3]:
            if len(token) >= 2:
                tags.append(token[:12])

    return tags[:6]


def score_correction(content: str, title: str, correction: PathCorrection) -> float:
    score = 0.0
    content_tokens = tokenize(f"{title}\n{content}")
    title_tokens = tokenize(title)
    corr_title_tokens = tokenize(correction.title)

    overlap = len(content_tokens & corr_title_tokens)
    score += overlap * 2

    if correction.tags:
        tag_tokens = tokenize(" ".join(correction.tags))
        score += len(content_tokens & tag_tokens) * 1.5

    suggested = normalize_path(correction.suggestedPath)
    if suggested and suggested in normalize_path(extract_path_from_content(content)):
        score += 1

    title_overlap = len(title_tokens & corr_title_tokens)
    score += title_overlap * 3

    return score


def extract_path_from_content(content: str) -> str:
    return content[:500]


def suggest_path(content: str, title: str, corrections: list[PathCorrection]) -> str:
    if corrections:
        ranked = sorted(
            corrections,
            key=lambda item: score_correction(content, title, item),
            reverse=True,
        )
        best = ranked[0]
        if score_correction(content, title, best) >= 2:
            return normalize_path(best.chosenPath)

    haystack = f"{title}\n{content}".lower()
    for keywords, path in PATH_RULES:
        if any(keyword in haystack for keyword in keywords):
            return path

    server_corrections = load_json(CORRECTIONS_PATH, [])
    if server_corrections:
        ranked = sorted(
            server_corrections,
            key=lambda item: score_correction(content, title, PathCorrection(**item)),
            reverse=True,
        )
        best = ranked[0]
        if score_correction(content, title, PathCorrection(**best)) >= 2:
            return normalize_path(best.get("chosenPath", ""))

    if "技术" in haystack or "代码" in haystack or "api" in haystack:
        return "技术/文档"
    if "工作" in haystack or "项目" in haystack:
        return "工作/文档"

    return "未分类"


def record_path_correction(suggested_path: str, chosen_path: str, title: str, tags: list[str]) -> None:
    suggested = normalize_path(suggested_path)
    chosen = normalize_path(chosen_path)
    if not suggested or not chosen or suggested == chosen:
        return

    corrections = load_json(CORRECTIONS_PATH, [])
    corrections.insert(
        0,
        {
            "id": str(uuid.uuid4()),
            "suggestedPath": suggested,
            "chosenPath": chosen,
            "title": title,
            "tags": tags,
            "recordedAt": utc_now_iso(),
        },
    )
    corrections = corrections[:500]
    save_json(CORRECTIONS_PATH, corrections)


def append_manifest(entry: dict[str, Any]) -> None:
    manifest = load_json(MANIFEST_PATH, [])
    manifest.insert(0, entry)
    save_json(MANIFEST_PATH, manifest[:1000])


def parse_frontmatter(raw: str) -> tuple[dict[str, Any], str]:
    text = raw.lstrip("\ufeff")
    if not text.startswith("---"):
        return {}, text

    match = re.match(r"^---\s*\n(.*?)\n---\s*\n?", text, re.DOTALL)
    if not match:
        return {}, text

    meta: dict[str, Any] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key == "tags":
            try:
                meta[key] = json.loads(value.replace("'", '"'))
            except json.JSONDecodeError:
                inner = value.strip("[]")
                meta[key] = [
                    part.strip().strip('"').strip("'")
                    for part in inner.split(",")
                    if part.strip()
                ]
        else:
            meta[key] = value

    body = text[match.end():]
    return meta, body


def is_document_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in DOCUMENT_EXTENSIONS


def resolve_library_file(relative_path: str) -> Path:
    normalized = normalize_path(relative_path.replace("\\", "/"))
    if not normalized:
        raise HTTPException(status_code=400, detail="文档路径无效")

    candidate = (LIBRARY_ROOT / normalized).resolve()
    root = LIBRARY_ROOT.resolve()

    if not str(candidate).startswith(str(root)):
        raise HTTPException(status_code=400, detail="文档路径无效")

    if not candidate.exists() or not is_document_file(candidate):
        raise HTTPException(status_code=404, detail="文档不存在")

    return candidate


def read_document_record(file_path: Path) -> dict[str, Any]:
    raw = file_path.read_text(encoding="utf-8")
    meta, body = parse_frontmatter(raw)
    relative_path = str(file_path.relative_to(LIBRARY_ROOT)).replace("\\", "/")
    folder_path = normalize_path(str(Path(relative_path).parent).replace("\\", "/"))
    if folder_path == ".":
        folder_path = ""

    title = str(meta.get("title") or file_path.stem)
    tags = meta.get("tags") if isinstance(meta.get("tags"), list) else []
    tags = [str(tag) for tag in tags]

    return {
        "id": relative_path,
        "title": title,
        "name": file_path.name,
        "relativePath": relative_path,
        "path": folder_path,
        "tags": tags,
        "summary": str(meta.get("summary") or extract_summary(body)),
        "content": body,
        "savedAt": meta.get("savedAt"),
    }


def list_documents() -> list[dict[str, Any]]:
    ensure_dirs()
    if not LIBRARY_ROOT.exists():
        return []

    docs: list[dict[str, Any]] = []
    for file_path in sorted(LIBRARY_ROOT.rglob("*")):
        if not is_document_file(file_path):
            continue
        docs.append(read_document_record(file_path))
    return docs


def build_tree_node(name: str, path: str, children: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "name": name,
        "type": "folder",
        "path": path,
        "children": children,
    }


def build_directory_tree(docs: list[dict[str, Any]]) -> dict[str, Any]:
    root: dict[str, Any] = {"name": "", "type": "folder", "path": "", "children": []}
    folder_map: dict[str, dict[str, Any]] = {"": root}

    folder_paths: set[str] = set()
    for doc in docs:
        folder_paths.add(doc["path"])
        parts = [part for part in doc["path"].split("/") if part]
        for index in range(len(parts)):
            folder_paths.add("/".join(parts[: index + 1]))

    for folder_path in sorted(folder_paths, key=lambda value: (value.count("/"), value)):
        if folder_path in folder_map:
            continue
        parts = folder_path.split("/")
        parent_path = "/".join(parts[:-1])
        parent = folder_map.get(parent_path, root)
        node = build_tree_node(parts[-1], folder_path, [])
        parent["children"].append(node)
        folder_map[folder_path] = node

    for doc in docs:
        folder = folder_map.get(doc["path"], root)
        folder["children"].append(
            {
                "name": doc["name"],
                "type": "file",
                "title": doc["title"],
                "relativePath": doc["relativePath"],
                "path": doc["path"],
                "tags": doc["tags"],
                "summary": doc["summary"],
                "savedAt": doc["savedAt"],
            }
        )

    def sort_children(node: dict[str, Any]) -> None:
        node["children"].sort(
            key=lambda item: (0 if item["type"] == "folder" else 1, item["name"].lower()),
        )
        for child in node["children"]:
            if child["type"] == "folder":
                sort_children(child)

    sort_children(root)
    return root


def build_tag_cloud(docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counter: dict[str, int] = {}
    for doc in docs:
        for tag in doc.get("tags", []):
            label = str(tag).strip()
            if not label:
                continue
            counter[label] = counter.get(label, 0) + 1

    return [
        {"tag": tag, "count": count}
        for tag, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    ]


def make_snippet(text: str, query: str, radius: int = 60) -> str:
    lowered = text.lower()
    index = lowered.find(query.lower())
    if index < 0:
        compact = re.sub(r"\s+", " ", text).strip()
        return compact[:120] + ("…" if len(compact) > 120 else "")

    start = max(0, index - radius)
    end = min(len(text), index + len(query) + radius)
    snippet = text[start:end].strip()
    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet += "…"
    return snippet


def search_documents(query: str) -> list[dict[str, Any]]:
    keyword = query.strip()
    if not keyword:
        return []

    needle = keyword.lower()
    results: list[dict[str, Any]] = []

    for doc in list_documents():
        title = doc["title"].lower()
        tag_text = " ".join(doc["tags"]).lower()
        body = doc["content"].lower()

        score = 0
        if needle in title:
            score += 5
        if needle in tag_text:
            score += 3
        if needle in body:
            score += 1

        if score <= 0:
            continue

        results.append(
            {
                "title": doc["title"],
                "relativePath": doc["relativePath"],
                "path": doc["path"],
                "tags": doc["tags"],
                "summary": doc["summary"],
                "snippet": make_snippet(doc["content"], keyword),
                "score": score,
            }
        )

    results.sort(key=lambda item: (-item["score"], item["title"].lower()))
    return results


@app.get("/api/library/health")
async def health():
    ensure_dirs()
    return {
        "status": "ok",
        "libraryRoot": str(LIBRARY_ROOT),
        "documents": len(list_documents()),
    }


@app.post("/api/library/analyze")
async def analyze_document(body: AnalyzeRequest):
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="文档内容不能为空")

    title = extract_title(content, body.title)
    path = suggest_path(content, title, body.pathCorrections)
    tags = extract_tags(content, title)
    summary = extract_summary(content)

    return {
        "title": title,
        "path": path,
        "tags": tags,
        "summary": summary,
    }


@app.post("/api/library/save")
async def save_document(body: SaveRequest):
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="文档内容不能为空")

    title = sanitize_filename(body.title or extract_title(content))
    path = normalize_path(body.path)
    if not path:
        raise HTTPException(status_code=400, detail="分类路径不能为空")

    ensure_dirs()
    target_dir = LIBRARY_ROOT / Path(*path.split("/"))
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{title}.md"
    file_path = target_dir / filename

    if file_path.exists():
        stem = file_path.stem
        suffix = file_path.suffix
        file_path = target_dir / f"{stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}{suffix}"

    safe_summary = body.summary.replace('"', "'").replace("\n", " ").strip()
    frontmatter = [
        "---",
        f'title: "{title}"',
        f"path: {path}",
        f"tags: [{', '.join(json.dumps(tag, ensure_ascii=False) for tag in body.tags)}]",
        f'summary: "{safe_summary}"',
        f"savedAt: {utc_now_iso()}",
        "---",
        "",
    ]

    file_path.write_text("\n".join(frontmatter) + content + "\n", encoding="utf-8")

    suggested_path = normalize_path(body.suggestedPath)
    if suggested_path and suggested_path != path:
        record_path_correction(suggested_path, path, title, body.tags)

    relative_path = str(file_path.relative_to(LIBRARY_ROOT)).replace("\\", "/")
    entry = {
        "id": str(uuid.uuid4()),
        "title": title,
        "path": path,
        "tags": body.tags,
        "summary": body.summary,
        "relativePath": relative_path,
        "savedAt": utc_now_iso(),
    }
    append_manifest(entry)

    return {
        "success": True,
        "item": entry,
        "filePath": str(file_path),
    }


@app.get("/api/library/tree")
async def library_tree():
    docs = list_documents()
    return {
        "root": str(LIBRARY_ROOT),
        "tree": build_directory_tree(docs),
        "tags": build_tag_cloud(docs),
        "total": len(docs),
    }


@app.get("/api/library/search")
async def library_search(q: str = Query(default="", min_length=0)):
    keyword = q.strip()
    if not keyword:
        return {"query": "", "items": []}

    items = search_documents(keyword)
    return {"query": keyword, "items": items}


@app.get("/api/library/document")
async def library_document(relativePath: str = Query(..., min_length=1)):
    file_path = resolve_library_file(relativePath)
    record = read_document_record(file_path)
    return {
        "title": record["title"],
        "relativePath": record["relativePath"],
        "path": record["path"],
        "tags": record["tags"],
        "summary": record["summary"],
        "content": record["content"],
        "savedAt": record["savedAt"],
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc: HTTPException):
    detail = exc.detail
    message = "; ".join(str(item) for item in detail) if isinstance(detail, list) else str(detail)
    return JSONResponse(status_code=exc.status_code, content={"error": message, "detail": detail})


if __name__ == "__main__":
    import uvicorn

    ensure_dirs()
    print(f"[library-service] 运行于 http://localhost:{PORT}")
    print(f"[library-service] 文库根目录: {LIBRARY_ROOT}")
    print("[library-service] POST /api/library/analyze")
    print("[library-service] POST /api/library/save")
    print("[library-service] GET  /api/library/tree")
    print("[library-service] GET  /api/library/search")
    print("[library-service] GET  /api/library/document")

    uvicorn.run(app, host="0.0.0.0", port=PORT)
