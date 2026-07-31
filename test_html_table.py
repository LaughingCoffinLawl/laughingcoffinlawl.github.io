#!/usr/bin/env python3
"""
Script di test per verificare la tabella HTML dei materiali di upgrade.
"""

from wiki_utils import fetch_page, clean_text
from bs4 import BeautifulSoup

# Test con la Spada
item_name = "Spada"

print(f"Scarico HTML per: {item_name}")
soup = fetch_page(item_name)

if soup:
    print(f"✓ HTML scaricato")
    
    # Cerca la tabella "Item per Migliorare"
    print("\nCerco tabella 'Item per Migliorare'...")
    
    # Cerca per testo
    for table in soup.find_all("table"):
        table_text = clean_text(table.get_text())
        if "Item per Migliorare" in table_text or "+0" in table_text and "+9" in table_text:
            print("✓ Trovata tabella di upgrade!")
            print("\nContenuto della tabella:")
            print(table_text[:1000])
            
            # Prova a estrarre le righe
            print("\nRighe della tabella:")
            rows = table.find_all("tr")
            for i, row in enumerate(rows[:15]):  # Prime 15 righe
                cells = row.find_all(["th", "td"])
                if cells:
                    row_data = [clean_text(c.get_text()) for c in cells]
                    print(f"  Riga {i}: {row_data}")
            break
    else:
        print("✗ Tabella non trovata")
        
        # Cerca sezioni con "Upgrade" o "Migliorare"
        print("\nCerco intestazioni 'Upgrade' o 'Migliorare'...")
        for heading in soup.find_all(["h2", "h3", "h4"]):
            text = clean_text(heading.get_text())
            if "upgrade" in text.lower() or "migliorare" in text.lower() or "item" in text.lower():
                print(f"  Trovato: {text}")
else:
    print("✗ Impossibile scaricare l'HTML")