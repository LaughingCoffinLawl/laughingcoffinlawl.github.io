#!/usr/bin/env python3
"""
Scraper per le Armature del wiki italiano di Metin2.
Estrae tutte le armature dalla pagina 'Armature' con i valori al +9.
https://it-wiki.metin2.gameforge.com/index.php/Armature
"""

import re
import time
from wiki_utils import (
    fetch_page, clean_text, parse_int,
    get_full_url, save_json, extract_upgrade_table,
    extract_single_value_table, BASE_URL
)


def extract_armor_blocks(soup):
    """
    Estrae i blocchi armatura dalla pagina 'Armature'.
    Struttura simile alle armi: header con tipo/livello, nome, icona, tabella upgrade.
    """
    armors = []
    for td in soup.find_all("td", style=lambda v: v and "border:1px solid #512410" in v):
        header_div = td.find("div", style=lambda v: v and "background:#1f0e02" in v)
        if not header_div:
            continue
        header_text = clean_text(header_div.get_text())
        level = None
        m = re.search(r"livello\s*(\d+)", header_text, re.IGNORECASE)
        if m:
            level = int(m.group(1))
        armor_type = header_text.split(" da livello")[0].strip() if " da livello" in header_text else header_text

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

        armor = {
            "nome": name,
            "tipo": armor_type,
            "livello": level,
            "url": url,
            "icona": icon,
            "prezzo_vendita": price_text,
            "slot": slots,
            "tipo_upgrade": upgrade_type,
        }
        armor.update(values)
        armors.append(armor)

    return armors


def scrape_armature():
    """Funzione principale per scaricare tutte le armature."""
    print("Scarico armature...")
    soup = fetch_page("Armature")
    if not soup:
        print("  [ERRORE] Impossibile scaricare la pagina Armature")
        return []

    armors = extract_armor_blocks(soup)
    print(f"  trovate {len(armors)} armature")

    seen = set()
    unique_armors = []
    for a in armors:
        key = a["nome"]
        if key not in seen:
            seen.add(key)
            unique_armors.append(a)

    print(f"  {len(unique_armors)} armature uniche")
    save_json(unique_armors, "armature.json")
    return unique_armors


if __name__ == "__main__":
    scrape_armature()