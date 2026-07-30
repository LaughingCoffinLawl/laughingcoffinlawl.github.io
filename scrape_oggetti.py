#!/usr/bin/env python3
"""
Scraper per gli Oggetti del wiki italiano di Metin2.
Non esiste una lista unificata di tutti gli oggetti di gioco,
quindi questo script parte dalla lista degli oggetti droppati dai mostri
(oggetti_drop.json generato da scrape_mostri.py) ed estrae informazioni
dettagliate da ogni pagina di oggetto.

Per gli oggetti upgradabili (es. armi, armature), estrae i valori al +9.
https://it-wiki.metin2.gameforge.com
"""

import re
import time
from wiki_utils import (
    fetch_page, clean_text, parse_int,
    get_full_url, save_json, load_json,
    extract_upgrade_table, extract_single_value_table,
    extract_infobox, page_title_from_url, DELAY
)


def extract_item_detail(soup):
    """
    Estrae le informazioni dettagliate dalla pagina di un singolo oggetto.
    Per gli oggetti upgradabili, estrae i valori al +9.
    """
    info = {}

    # Estrai da infobox generico
    infobox = extract_infobox(soup)
    info.update(infobox)

    # Cerca icona
    for img in soup.find_all("img"):
        src = img.get("src", "")
        alt = img.get("alt", "")
        if "Icona_" in src or "icona_" in src:
            info["icona"] = get_full_url(src)
            break

    # Cerca immagini render
    for img in soup.find_all("img"):
        src = img.get("src", "")
        alt = img.get("alt", "")
        if alt and "Render" in alt:
            info["immagine"] = get_full_url(src)
            break

    # Estrai valori da tabella upgrade (+9) o 'Up unico'
    upgrade_values = extract_upgrade_table(soup)
    if upgrade_values:
        info.update(upgrade_values)
        info["tipo_upgrade"] = "upgrade"
    else:
        single_values = extract_single_value_table(soup)
        if single_values:
            info.update(single_values)
            info["tipo_upgrade"] = "unique"

    # Cerca tabelle con informazioni generiche
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all(["th", "td"])
            if len(cells) >= 2:
                label = clean_text(cells[0].get_text()).rstrip(":").strip().lower()
                value = clean_text(cells[1].get_text())
                if label and value and len(label) < 50:
                    if "livello" in label and "livello" not in info:
                        info["livello"] = parse_int(value)
                    elif "prezzo" in label or "valore" in label:
                        if "prezzo" not in info:
                            info["prezzo"] = value
                    elif "stack" in label:
                        info["stack"] = parse_int(value)
                    elif "descrizione" in label:
                        info["descrizione"] = value
                    elif "tipo" in label and "tipo" not in info:
                        info["tipo"] = value
                    elif "categoria" in label:
                        info["categoria"] = value

    return info


def scrape_oggetti():
    """
    Funzione principale per scaricare le informazioni degli oggetti.
    Parte dalla lista oggetti_drop.json generata da scrape_mostri.py.
    """
    print("Scarico oggetti...")

    # Carica la lista degli oggetti dai drop
    drop_items = load_json("oggetti_drop.json")
    if not drop_items:
        print("  [ERRORE] File oggetti_drop.json non trovato.")
        print("  Esegui prima scrape_mostri.py per generare la lista degli oggetti.")
        return []

    print(f"  trovati {len(drop_items)} oggetti dalla lista drop")

    oggetti = []
    for i, item in enumerate(drop_items):
        if i > 0 and i % 50 == 0:
            print(f"  [{i}/{len(drop_items)}] processati...")

        oggetto = {
            "nome": item["nome"],
            "url": item["url"],
            "droppato_da": item.get("droppato_da", []),
        }

        # Scarica la pagina di dettaglio
        page_title = page_title_from_url(item["url"])
        if page_title:
            detail_soup = fetch_page(page_title)
            if detail_soup:
                detail = extract_item_detail(detail_soup)
                oggetto.update(detail)
            time.sleep(DELAY)

        oggetti.append(oggetto)

    print(f"  totale: {len(oggetti)} oggetti")
    save_json(oggetti, "oggetti.json")
    return oggetti


if __name__ == "__main__":
    scrape_oggetti()