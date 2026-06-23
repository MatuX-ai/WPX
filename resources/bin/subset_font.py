#!/usr/bin/env python3
"""WPX font subsetting wrapper (fonttools / pyftsubset).

Usage:
  python subset_font.py --input SOURCE.ttf --output SUBSET.ttf --text "文档文字"
  python subset_font.py --patch-copyright --input SUBSET.ttf --copyright "© WPX ..."

Packaged builds may ship subset-font.exe (py2exe) with the same CLI.
Requires: pip install fonttools
"""

from __future__ import annotations

import argparse
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Subset or patch a font file for WPX export')
    parser.add_argument('--input', required=True, help='Source or target .ttf/.otf path')
    parser.add_argument('--output', help='Output subset font path (subset mode)')
    parser.add_argument('--text', help='Characters to retain in the subset')
    parser.add_argument('--copyright', default='', help='Copyright notice for name table ID 0')
    parser.add_argument(
        '--patch-copyright',
        action='store_true',
        help='Only patch copyright metadata on an existing font file',
    )
    return parser.parse_args()


def apply_copyright(font, copyright_text: str) -> None:
    if not copyright_text:
        return

    name_table = font['name']
    for platform_id, encoding_id, language_id in (
        (3, 1, 0x409),
        (3, 1, 0x804),
        (1, 0, 0),
    ):
        name_table.setName(copyright_text, 0, platform_id, encoding_id, language_id)


def patch_copyright(input_path: str, copyright_text: str) -> int:
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        print('fonttools is not installed. Run: pip install fonttools', file=sys.stderr)
        return 2

    font = TTFont(input_path)
    apply_copyright(font, copyright_text)
    font.save(input_path)
    return 0


def subset_font(input_path: str, output_path: str, text: str, copyright_text: str) -> int:
    try:
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError:
        print('fonttools is not installed. Run: pip install fonttools', file=sys.stderr)
        return 2

    options = subset.Options()
    options.layout_features = ['*']
    options.text = text
    options.output_file = output_path

    font = TTFont(input_path)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    apply_copyright(font, copyright_text)
    font.save(output_path)

    return 0


def main() -> int:
    args = parse_args()

    if args.patch_copyright:
        return patch_copyright(args.input, args.copyright)

    if not args.output or not args.text:
        print('--output and --text are required unless --patch-copyright is used', file=sys.stderr)
        return 2

    return subset_font(args.input, args.output, args.text, args.copyright)


if __name__ == '__main__':
    raise SystemExit(main())
