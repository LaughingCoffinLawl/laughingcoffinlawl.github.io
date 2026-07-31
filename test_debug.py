#!/usr/bin/env python3
"""
Script di debug per capire la struttura della tabella.
"""

from wiki_utils import fetch_page, clean_text

item_name = "Spada"
print(f"Scarico HTML per: {item_name}")
soup = fetch_page(item_name)

if soup:
    # Cerca la tabella
    target_table = None
    for table in soup.find_all("table"):
        if "Item per Migliorare" in clean_text(table.get_text()):
            target_table = table
            break
    
    if target_table:
        rows = target_table.find_all("tr")
        
        # Trova riga header e item
        header_row = None
        item_row = None
        
        for row in rows:
            cells = row.find_all(["th", "td"])
            if len(cells) > 0:
                # Cerca in tutte le celle, non solo la prima
                row_text = " ".join([clean_text(c.get_text()) for c in cells])
                if "+0" in row_text and "+9" in row_text:
                    header_row = row
                elif "Item" in row_text and len(cells) > 10:  # La riga Item ha molte celle
                    item_row = row
        
        if header_row and item_row:
            print("✓ Trovate entrambe le righe\n")
            
            header_cells = header_row.find_all(["th", "td"])
            item_cells = item_row.find_all(["th", "td"])
            
            print("HEADER ROW:")
            for i, cell in enumerate(header_cells):
                text = clean_text(cell.get_text())
                if text:
                    print(f"  Cella {i}: '{text}'")
            
            print("\nITEM ROW:")
            for i, cell in enumerate(item_cells):
                text = clean_text(cell.get_text())
                imgs = cell.find_all("img")
                if text or imgs:
                    img_names = [img.get("src", "").split("/")[-1] for img in imgs]
                    print(f"  Cella {i}: '{text}' {img_names}")
            
            # Prova a mappare header -> item
            print("\nMAPPING:")
            for i, h_cell in enumerate(header_cells):
                h_text = clean_text(h_cell.get_text())
                if h_text.startswith("+"):
                    if i < len(item_cells):
                        i_cell = item_cells[i]
                        imgs = i_cell.find_all("img")
                        text = clean_text(i_cell.get_text())
                        if imgs:
                            img_name = imgs[0].get("src", "").split("/")[-1]
                            print(f"  {h_text} -> Cella {i}: '{text}' IMG:{img_name}")
                        else:
                            print(f"  {h_text} -> Cella {i}: '{text}' (no img)")
        else:
            print("✗ Non trovo le righe")
    else:
        print("✗ Tabella non trovata")