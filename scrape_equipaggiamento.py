#!/usr/bin/env python3
"""
Scraper per l'equipaggiamento del wiki italiano di Metin2.
Estrae armi, armature, elmi, scudi, bracciali, collane, orecchini,
scarpe, cinture, guanti e stole con i valori al +9.

Categorie:
- Armi (già estratte da scrape_armi.py, qui aggiungiamo il campo categoria)
- Armature, Elmi, Scudi → gioco "Difesa"
- Bracciali, Collane, Orecchini, Scarpe, Cinture, Stole → gioco "Accessori"
"""

import re
import time
from wiki_utils import (
    fetch_page, clean_text, parse_int,
    get_full_url, save_json, extract_upgrade_table,
    extract_single_value_table, BASE_URL
)


def extract_equip_blocks(soup, categoria):
    """
    Estrae i blocchi equipaggiamento da una pagina wiki.
    Struttura simile alle armi/armature: header con tipo/livello, nome, icona, tabella upgrade.
    Aggiunge il campo 'categoria' a ogni item.
    """
    items = []
    for td in soup.find_all("td", style=lambda v: v and "border:1px solid #512410" in v):
        header_div = td.find("div", style=lambda v: v and "background:#1f0e02" in v)
        if not header_div:
            continue
        header_text = clean_text(header_div.get_text())
        level = None
        m = re.search(r"livello\s*(\d+)", header_text, re.IGNORECASE)
        if m:
            level = int(m.group(1))
        item_type = header_text.split(" da livello")[0].strip() if " da livello" in header_text else header_text

        name_link = td.find("b").find("a") if td.find("b") else None
        if not name_link:
            for a in td.find_all("a"):
                title = a.get("title", "")
                if title and title != "NPC" and "File:" not in a.get("href", ""):
                    name_link = a
                    break
        if not name_link:
            continue
        name = clean_text(name_link.get_text())
        url = get_full_url(name_link.get("href", ""))

        icon = ""
        for img in td.find_all("img"):
            src = img.get("src", "")
            if "Icona_" in src or "icona_" in src:
                icon = get_full_url(src)
                break

        price_text = ""
        for t in td.find_all("table"):
            text = t.get_text()
            if "Prezzo di vendita" in text:
                m = re.search(r"(\d[\d.]*)\s*Yang", text)
                if m:
                    price_text = m.group(1) + " Yang"
                elif "Non disponibile" in text:
                    price_text = "Non disponibile"
                break

        slots = 0
        for t in td.find_all("table"):
            text = t.get_text()
            if "Slot" in text and "Nessuno Slot" not in text:
                slot_imgs = t.find_all("img", alt=lambda a: a and "Slot Vuoto" in a)
                slots = len(slot_imgs)
                break
            elif "Nessuno Slot" in text:
                slots = 0
                break

        upgrade_values = extract_upgrade_table(td)
        if upgrade_values:
            values = upgrade_values
            upgrade_type = "upgrade"
        else:
            values = extract_single_value_table(td)
            upgrade_type = "unique"

        item = {
            "nome": name,
            "categoria": categoria,
            "tipo": item_type,
            "livello": level,
            "url": url,
            "icona": icon,
            "prezzo_vendita": price_text,
            "slot": slots,
            "tipo_upgrade": upgrade_type,
        }
        item.update(values)
        items.append(item)

    return items


def scrape_categoria(categoria, output_filename=None):
    """Scarica tutti gli item di una categoria dalla pagina wiki corrispondente."""
    print(f"Scarico {categoria}...")
    soup = fetch_page(categoria)
    if not soup:
        print(f"  [ERRORE] Impossibile scaricare la pagina {categoria}")
        return []

    items = extract_equip_blocks(soup, categoria)
    print(f"  trovati {len(items)} item")

    # Rimuovi duplicati
    seen = set()
    unique_items = []
    for item in items:
        key = item["nome"]
        if key not in seen:
            seen.add(key)
            unique_items.append(item)

    print(f"  {len(unique_items)} item unici")

    if output_filename:
        save_json(unique_items, output_filename)
    return unique_items


def scrape_all_equipaggiamento():
    """
    Scarica tutte le categorie di equipaggiamento e salva file separati.
    Ritorna un dict con tutti i dati per uso successivo.
    """
    categorie = {
        "Armi": "armi.json",
        "Armature": "armature.json",
        "Elmi": "elmi.json",
        "Scudi": "scudi.json",
        "Bracciali": "bracciali.json",
        "Collane": "collane.json",
        "Orecchini": "orecchini.json",
        "Scarpe": "scarpe.json",
        "Cinture": "cinture.json",
        "Guanti": "guanti.json",
        "Stole": "stole.json",
    }

    all_data = {}
    for categoria, filename in categorie.items():
        items = scrape_categoria(categoria, filename)
        all_data[categoria] = items
        time.sleep(1)  # Pausa tra le categorie

    return all_data


if __name__ == "__main__":
    scrape_all_equipaggiamento()