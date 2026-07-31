#!/usr/bin/env python3
"""
Script di test per verificare l'estrazione dei materiali per un elmo.
"""

from scrape_upgrade_materials import extract_upgrade_materials_from_html

# Test con un elmo
item_name = "Elmo Tradizionale"

print(f"Test estrazione materiali per: {item_name}")
materials = extract_upgrade_materials_from_html(item_name)

if materials:
    print(f"✓ Materiali trovati: {len(materials)} livelli\n")
    for level, mat in sorted(materials.items()):
        print(f"  {level}: {mat['nome']} (x{mat['quantita']})")
else:
    print("✗ Nessun materiale trovato")
    print("\nProvo a scaricare l'HTML per analizzare...")
    
    from wiki_utils import fetch_page, clean_text
    soup = fetch_page(item_name)
    
    if soup:
        # Cerca la tabella
        for table in soup.find_all("table"):
            table_text = clean_text(table.get_text())
            if "Item per Migliorare" in table_text:
                print("✓ Trovata tabella 'Item per Migliorare'")
                
                # Mostra struttura
                rows = table.find_all("tr")
                print(f"  Righe totali: {len(rows)}")
                
                for i, row in enumerate(rows[:25]):
                    cells = row.find_all(["th", "td"])
                    first_text = clean_text(cells[0].get_text()) if cells else ""
                    row_text = " ".join([clean_text(c.get_text()) for c in cells[:5]])
                    print(f"  Riga {i}: '{first_text}' | {row_text[:80]}")
                break
        else:
            print("✗ Tabella non trovata")
    else:
        print("✗ Impossibile scaricare HTML")