#!/usr/bin/env python3
"""
Validador Automatizado de Contraste WCAG 2.1 — TuxSQL v2
Calcula a luminância relativa e a razão de contraste (W3C Recommendation).
Critérios:
  - Texto Normal: mínimo 4.5:1 (Nível AA) ou 7.0:1 (Nível AAA)
  - Texto Grande / Componentes de UI / Bordas de Controles: mínimo 3.0:1 (Nível AA)
Falha com código de saída 1 se qualquer par estiver abaixo do limiar estipulado.
"""

import sys

def rel_luminance(hex_code):
    hex_code = hex_code.lstrip("#")
    if len(hex_code) == 3:
        hex_code = "".join([c * 2 for c in hex_code])
    r, g, b = [int(hex_code[i:i+2], 16) / 255.0 for i in (0, 2, 4)]
    def adjust(channel):
        return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4
    return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b)

def calc_contrast(c1, c2):
    l1 = rel_luminance(c1)
    l2 = rel_luminance(c2)
    if l1 < l2:
        l1, l2 = l2, l1
    return (l1 + 0.05) / (l2 + 0.05)

# Pares de teste oficiais dos tokens e componentes do TuxSQL v2
PAIRS = [
    # ========================================================
    # 1. TOKENS GLOBAIS DE TEXTO E FUNDO (LIGHT MODE)
    # ========================================================
    ("Light: Texto Primário sobre Superfície Base", "#0f172a", "#ffffff", 4.5),
    ("Light: Texto Primário sobre Canvas da Aplicação", "#0f172a", "#f1f5f9", 4.5),
    ("Light: Texto Secundário sobre Superfície Base", "#334155", "#ffffff", 4.5),
    ("Light: Texto Secundário sobre Canvas", "#334155", "#f1f5f9", 4.5),
    ("Light: Texto Terciário sobre Superfície Base", "#475569", "#ffffff", 4.5),
    ("Light: Texto Terciário sobre Canvas", "#475569", "#f1f5f9", 4.5),
    ("Light: Texto Terciário sobre Hover de Lista/Tabela", "#475569", "#e2e8f0", 4.5),
    ("Light: Acento Teal como Texto sobre Superfície Base", "#0e7490", "#ffffff", 4.5),
    ("Light: Acento Âmbar como Texto sobre Superfície Base", "#92400e", "#ffffff", 4.5),
    ("Light: Borda de Controles/Inputs sobre Superfície Base", "#718096", "#ffffff", 3.0),
    ("Light: Borda de Controles/Inputs sobre Canvas", "#718096", "#f1f5f9", 3.0),
    ("Light: Anel Indicador de Foco sobre Superfície Base", "#0284c7", "#ffffff", 3.0),

    # ========================================================
    # 2. COMPONENTES E ESTADOS DA INTERFACE (LIGHT MODE)
    # ========================================================
    ("Light Botão Primário: Texto Branco sobre Fundo Teal (#0e7490)", "#ffffff", "#0e7490", 4.5),
    ("Light Botão Perigo: Texto Branco sobre Fundo Erro (#b91c1c)", "#ffffff", "#b91c1c", 4.5),
    ("Light Tab Ativa: Texto Primário sobre Superfície Base", "#0f172a", "#ffffff", 4.5),
    ("Light Tab Inativa: Texto Secundário sobre Barra de Abas Raised", "#334155", "#f8fafc", 4.5),
    ("Light Grade: Texto Primário sobre Linha Selecionada Active", "#0f172a", "#cbd5e1", 4.5),
    ("Light Input: Placeholder Terciário sobre Superfície Base", "#475569", "#ffffff", 4.5),
    ("Light Texto Desabilitado Informativo sobre Superfície", "#64748b", "#ffffff", 4.5),
    ("Light Banner Prod: Texto Prod sobre Fundo Tintado", "#991b1b", "#fef2f2", 4.5),
    ("Light Linha de Alerta Prod sobre Header Raised", "#dc2626", "#f8fafc", 3.0),
    ("Light Badge Dev: Texto sobre Fundo Tintado", "#5b21b6", "#f5f3ff", 4.5),
    ("Light Badge Test: Texto sobre Fundo Tintado", "#0369a1", "#f0f9ff", 4.5),
    ("Light Badge Sandbox: Texto sobre Fundo Tintado", "#065f46", "#ecfdf5", 4.5),
    ("Light Badge Prod: Texto sobre Fundo Tintado", "#991b1b", "#fef2f2", 4.5),
    ("Light Badge Dev: Borda sobre Canvas", "#8b5cf6", "#f1f5f9", 3.0),
    ("Light Badge Test: Borda sobre Canvas", "#0284c7", "#f1f5f9", 3.0),
    ("Light Badge Sandbox: Borda sobre Canvas", "#059669", "#f1f5f9", 3.0),
    ("Light Badge Prod: Borda sobre Canvas", "#dc2626", "#f1f5f9", 3.0),

    # ========================================================
    # 3. TOKENS GLOBAIS DE TEXTO E FUNDO (DARK MODE)
    # ========================================================
    ("Dark: Texto Primário sobre Superfície Base", "#f8fafc", "#131924", 4.5),
    ("Dark: Texto Primário sobre Canvas da Aplicação", "#f8fafc", "#0b0f17", 4.5),
    ("Dark: Texto Secundário sobre Superfície Base", "#cbd5e1", "#131924", 4.5),
    ("Dark: Texto Secundário sobre Painel Elevado (Raised)", "#cbd5e1", "#1a2234", 4.5),
    ("Dark: Texto Terciário sobre Superfície Base", "#94a3b8", "#131924", 4.5),
    ("Dark: Texto Terciário sobre Painel Elevado (Raised)", "#94a3b8", "#1a2234", 4.5),
    ("Dark: Texto Terciário sobre Hover de Lista/Tabela", "#94a3b8", "#232d42", 4.5),
    ("Dark: Acento Cyan como Texto sobre Superfície Base", "#38bdf8", "#131924", 4.5),
    ("Dark: Acento Âmbar como Texto sobre Superfície Base", "#fbbf24", "#131924", 4.5),
    ("Dark: Borda de Controles/Inputs sobre Superfície Base", "#64748b", "#131924", 3.0),
    ("Dark: Borda de Controles/Inputs sobre Painel Elevado", "#64748b", "#1a2234", 3.0),
    ("Dark: Anel Indicador de Foco sobre Superfície Base", "#38bdf8", "#131924", 3.0),

    # ========================================================
    # 4. COMPONENTES E ESTADOS DA INTERFACE (DARK MODE)
    # ========================================================
    ("Dark Botão Primário: Texto Escuro sobre Fundo Cyan (#38bdf8)", "#0b0f17", "#38bdf8", 4.5),
    ("Dark Botão Perigo: Texto Escuro sobre Fundo Erro (#f87171)", "#0b0f17", "#f87171", 4.5),
    ("Dark Tab Ativa: Texto Primário sobre Superfície Base", "#f8fafc", "#131924", 4.5),
    ("Dark Tab Inativa: Texto Secundário sobre Barra de Abas Raised", "#cbd5e1", "#1a2234", 4.5),
    ("Dark Grade: Texto Primário sobre Linha Selecionada Active", "#f8fafc", "#2d3a54", 4.5),
    ("Dark Input: Placeholder Terciário sobre Superfície Base", "#94a3b8", "#131924", 4.5),
    ("Dark Texto Desabilitado Informativo sobre Superfície", "#94a3b8", "#131924", 4.5),
    ("Dark Banner Prod: Texto Prod sobre Fundo Tintado", "#fecaca", "#450a0a", 4.5),
    ("Dark Linha de Alerta Prod sobre Header Raised", "#dc2626", "#1a2234", 3.0),
    ("Dark Badge Dev: Texto sobre Fundo Tintado", "#ddd6fe", "#2e1065", 4.5),
    ("Dark Badge Test: Texto sobre Fundo Tintado", "#bae6fd", "#082f49", 4.5),
    ("Dark Badge Sandbox: Texto sobre Fundo Tintado", "#a7f3d0", "#022c22", 4.5),
    ("Dark Badge Prod: Texto sobre Fundo Tintado", "#fecaca", "#450a0a", 4.5),
    ("Dark Badge Dev: Borda sobre Superfície Base", "#7c3aed", "#131924", 3.0),
    ("Dark Badge Test: Borda sobre Superfície Base", "#0284c7", "#131924", 3.0),
    ("Dark Badge Sandbox: Borda sobre Superfície Base", "#059669", "#131924", 3.0),
    ("Dark Badge Prod: Borda sobre Superfície Base", "#dc2626", "#131924", 3.0),
]

def main():
    print("=" * 90)
    print(" Verificação Rigorosa de Contraste WCAG 2.1 — Tokens e Componentes TuxSQL v2")
    print("=" * 90)
    
    failures = 0
    for desc, fg, bg, min_ratio in PAIRS:
        ratio = calc_contrast(fg, bg)
        passed = ratio >= min_ratio
        
        if ratio >= 7.0:
            level = "AAA (>=7.0)"
        elif ratio >= 4.5:
            level = "AA  (>=4.5)"
        elif ratio >= 3.0:
            level = "UI  (>=3.0)"
        else:
            level = "FALHA (<3.0)"
            
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {desc:<52} | {fg} / {bg} | {ratio:5.2f}:1 (min {min_ratio:3.1f}) | {level}")
        
        if not passed:
            failures += 1
            
    print("-" * 90)
    print(f"Total de pares avaliados: {len(PAIRS)} | Aprovados: {len(PAIRS) - failures} | Falhas: {failures}")
    print("=" * 90)
    
    if failures > 0:
        print(f"\nERRO: {failures} par(es) violam as diretrizes WCAG 2.1 AA.")
        sys.exit(1)
    else:
        print("\nSUCESSO: Todos os tokens e estados de componentes atendem ou superam WCAG 2.1 Nível AA e AAA!")
        sys.exit(0)

if __name__ == "__main__":
    main()
