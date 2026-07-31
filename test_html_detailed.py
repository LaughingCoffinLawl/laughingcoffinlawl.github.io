#!/usr/bin/env python3
"""
Script di test per analizzare dettagliatamente la tabella HTML dei materiali.
"""

from wiki_utils import fetch_page, clean_text

# Test con la Spada
item_name = "Spada"

print(f"Scarico HTML per: {item_name}")
soup = fetch_page(item_name)

if soup:
    print(f"✓ HTML scaricato")
    
    # Cerca la tabella "Item per Migliorare"
    print("\nCerco tabella 'Item per Migliorare'...")
    
    target_table = None
    for table in soup.find_all("table"):
        table_text = clean_text(table.get_text())
        if "Item per Migliorare" in table_text:
            target_table = table
            break
    
    if target_table:
        print("✓ Trovata tabella!")
        
        # Analizza la struttura della tabella
        print("\n=== STRUTTURA COMPLETA TABELLA ===\n")
        
        rows = target_table.find_all("tr")
        for i, row in enumerate(rows):
            cells = row.find_all(["th", "td"])
            print(f"\n--- Riga {i} ({len(cells)} celle) ---")
            
            for j, cell in enumerate(cells):
                # Cerca immagini nella cella
                imgs = cell.find_all("img")
                img_info = []
                for img in imgs:
                    src = img.get("src", "")
                    alt = img.get("alt", "")
                    if src:
                        img_info.append(f"IMG:{src.split('/')[-1]}")
                
                text = clean_text(cell.get_text())
                if text or img_info:
                    print(f"  Cella {j}: '{text[:50]}' {img_info}")
    else:
        print("✗ Tabella non trovata")
else:
    print("✗ Impossibile scaricare l'HTML")