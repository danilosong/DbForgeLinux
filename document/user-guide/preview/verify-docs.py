#!/usr/bin/env python3
"""
TuxSQL User Guide Preview Validator
Verifies:
1. Identical file structure in en/ and pt-BR/
2. First line version marker
3. All relative markdown links resolve to existing files
4. Zero occurrences of forbidden terms (dbforge|devart, case-insensitive)
5. Clean markdown syntax without raw HTML tags
"""

import os
import re
import sys
from pathlib import Path

BASE_DIR = Path("/var/www/TuxSQL/document/user-guide/preview")
EN_DIR = BASE_DIR / "en"
PT_DIR = BASE_DIR / "pt-BR"

FORBIDDEN_REGEX = re.compile(r"dbforge|devart", re.IGNORECASE)
LINK_REGEX = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
HTML_TAG_REGEX = re.compile(r"<(/?(div|span|kbd|p|details|summary|table|tr|td|th|b|i|u|strong|em|a|img|h[1-6]|ul|ol|li))[^>]*>", re.IGNORECASE)

errors = []
warnings = []

print("=" * 80)
print(" Validando Prévia da Documentação TuxSQL (Preview User Guide)")
print("=" * 80)

if not EN_DIR.exists() or not PT_DIR.exists():
    print(f"ERRO CRÍTICO: Diretórios não encontrados: {EN_DIR} ou {PT_DIR}")
    sys.exit(1)

en_files = sorted([f.name for f in EN_DIR.glob("*.md")])
pt_files = sorted([f.name for f in PT_DIR.glob("*.md")])

print(f"\n1. Comparando lista de arquivos entre en/ e pt-BR/:")
print(f"   - en/ ({len(en_files)} arquivos): {en_files}")
print(f"   - pt-BR/ ({len(pt_files)} arquivos): {pt_files}")

if en_files != pt_files:
    diff_en = set(en_files) - set(pt_files)
    diff_pt = set(pt_files) - set(en_files)
    errors.append(f"Diferença entre pastas: apenas em en: {diff_en}, apenas em pt-BR: {diff_pt}")
else:
    print("   [OK] Ambas as pastas contêm exatamente os mesmos arquivos.")

all_paths = [EN_DIR / f for f in en_files] + [PT_DIR / f for f in pt_files]

print("\n2. Verificando conteúdo, cabeçalho de versão, links, termos e HTML:")

for file_path in all_paths:
    rel_path = file_path.relative_to(BASE_DIR)
    content = file_path.read_text(encoding="utf-8")
    lines = content.splitlines()

    # Checar primeira linha
    first_line = lines[0].strip() if lines else ""
    if file_path.parent.name == "en":
        expected_marker = "This page applies to version 0.1.0."
    else:
        expected_marker = "Esta página vale para a versão 0.1.0."

    if first_line != expected_marker:
        errors.append(f"[{rel_path}] Primeira linha incorreta. Esperado: '{expected_marker}', Encontrado: '{first_line}'")
    else:
        print(f"   [OK] {rel_path}: marcador de versão ok")

    # Checar termos proibidos
    matches = FORBIDDEN_REGEX.findall(content)
    if matches:
        errors.append(f"[{rel_path}] Contém termos proibidos: {set(matches)}")
    else:
        print(f"   [OK] {rel_path}: zero termos proibidos")

    # Checar HTML cru
    html_tags = HTML_TAG_REGEX.findall(content)
    if html_tags:
        errors.append(f"[{rel_path}] Contém tags HTML brutas: {[tag[0] for tag in html_tags]}")
    else:
        print(f"   [OK] {rel_path}: markdown limpo (sem HTML)")

    # Checar links relativos
    links = LINK_REGEX.findall(content)
    for text, url in links:
        # Se for link externo (http/https), ignorar checagem local
        if url.startswith("http://") or url.startswith("https://") or url.startswith("mailto:"):
            continue
        # Se contiver âncora interna (#), separar caminho do arquivo
        url_file = url.split("#")[0]
        if not url_file:
            continue
        target_path = file_path.parent / url_file
        if not target_path.exists():
            errors.append(f"[{rel_path}] Link relativo quebrado: '{url}' (alvo {target_path} não existe)")

print("\n" + "=" * 80)
if errors:
    print(f"FALHA: Foram encontrados {len(errors)} erros:")
    for err in errors:
        print(f"  [X] {err}")
    sys.exit(1)
else:
    print(f"SUCESSO TOTAL:")
    print(f"  - {len(en_files)} páginas em en/ e {len(pt_files)} páginas em pt-BR/ verificadas com sucesso.")
    print(f"  - 100% dos links relativos resolvem.")
    print(f"  - Zero ocorrências de termos proibidos.")
    print(f"  - Zero tags HTML brutas.")
    print("=" * 80)
    sys.exit(0)
