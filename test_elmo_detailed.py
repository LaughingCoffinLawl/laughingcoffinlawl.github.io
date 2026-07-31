#!/usr/bin/env python3
"""
Script di debug per analizzare la struttura degli elmi.
"""

from wiki_utils import fetch_page, clean_text

item_name = "Elmo Tradizionale"
print(f"Scarico HTML per: {item_name}")
soup = fetch_page(item_name)

if soup:
    # Cerca la tabella
    for table in soup.find_all("table"):
        if "Item per Migliorare" in clean_text(table.get_text()):
            print("✓ Trovata tabella\n")
            
            rows = table.find_all("tr")
            
            # Cerca righe con materiali
            for i, row in enumerate(rows):
                cells = row.find_all(["th", "td"])
                if len(cells) > 0:
                    first_text = clean_text(cells[0].get_text())
                    row_text = " ".join([clean_text(c.get_text()) for c in cells])
                    
                    # Mostra righe che contengono "Materiale" o "Item"
                    if "Materiale" in first_text or "Item" in first_text:
                        print(f"\n=== Riga {i}: '{first_text}' ===")
                        for j, cell in enumerate(cells):
                            text = clean_text(cell.get_text())
                            imgs = cell.find_all("img")
                            if text or imgs:
                                img_names = [img.get("src", "").split("/")[-1] for img in imgs]
                                print(f"  Cella {j}: '{text[:30]}' {img_names}")
            break