#!/usr/bin/env python3
"""
Script di test per la nuova funzione di estrazione da HTML.
"""

from scrape_upgrade_materials import extract_upgrade_materials_from_html

# Test con la Spada
item_name = "Spada"

print(f"Test estrazione materiali per: {item_name}")
materials = extract_upgrade_materials_from_html(item_name)

if materials:
    print(f"✓ Materiali trovati: {len(materials)} livelli\n")
    for level, mat in sorted(materials.items()):
        print(f"  {level}: {mat['nome']} (x{mat['quantita']})")
else:
    print("✗ Nessun materiale trovato")