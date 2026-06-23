"""CLI helper: rembg input_path output_path"""
from __future__ import annotations

import sys

from rembg import remove


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: rembg_runner.py <input> <output>", file=sys.stderr)
        sys.exit(2)

    input_path, output_path = sys.argv[1], sys.argv[2]
    with open(input_path, "rb") as handle:
        input_data = handle.read()

    output_data = remove(input_data)
    if not output_data:
        print("remove() returned empty result", file=sys.stderr)
        sys.exit(1)

    with open(output_path, "wb") as handle:
        handle.write(output_data)


if __name__ == "__main__":
    main()
