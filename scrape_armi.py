#!/usr/bin/env python3
"""
Scraper per le Armi del wiki italiano di Metin2.
Estrae tutte le armi dalla pagina 'Armi' con i valori al +9.
https://it-wiki.metin2.gameforge.com/index.php/Armi
"""

import re
import time
from wiki_utils import (
    fetch_page, fetch_raw_html, clean_text, parse_int,
    get_full_url, save_json, extract_upgrade_table,
    extract_single_value_table, BASE_URL
)


def extract_weapon_blocks(soup):
    """
    Estrae i blocchi arma dalla pagina 'Armi'.
    Ogni blocco è una tabella con:
    - Header: "Spada da livello X"
    - Sotto-tabella con nome, icona, prezzo, slot
    - Tabella upgrade +0/+9 oppure tabella 'Up unico'
    """
    weapons = []
    # I blocchi arma sono dentro <td> con border e contengono un div header
    for td in soup.find_all("td", style=lambda v: v and "border:1px solid #512410" in v):
        # Cerca l'header del blocco (es. "Spada da livello 1")
        header_div = td.find("div", style=lambda v: v and "background:#1f0e02" in v)
        if not header_div:
            continue
        header_text = clean_text(header_div.get_text())
        # Estrai il tipo e livello dall'header
        # Es: "Spada da livello 1", "Spadone da livello 30"
        level = None
        m = re.search(r"livello\s*(\d+)", header_text, re.IGNORECASE)
        if m:
            level = int(m.group(1))
        # Estrai il tipo dall'header
        weapon_type = header_text.split(" da livello")[0].strip() if " da livello" in header_text else header_text

        # Cerca il nome dell'arma (link in grassetto)
        name_link = td.find("b").find("a") if td.find("b") else None
        if not name_link:
            # Prova a cercare un link diretto
            for a in td.find_all("a"):
                title = a.get("title", "")
                if title and title != "NPC" and "File:" not in a.get("href", ""):
                    name_link = a
                    break
        if not name_link:
            continue
        name = clean_text(name_link.get_text())
        url = get_full_url(name_link.get("href", ""))

        # Cerca l'icona
        icon = ""
        for img in td.find_all("img"):
            src = img.get("src", "")
            if "Icona_" in src or "icona_" in src:
                icon = get_full_url(src)
                break

        # Cerca il prezzo di vendita
        price = None
        price_text = ""
        for t in td.find_all("table"):
            text = t.get_text()
            if "Prezzo di vendita" in text:
                m = re.search(r"(\d[\d.]*)\s*Yang", text)
                if m:
                    price = parse_int(m.group(1))
                    price_text = m.group(1) + " Yang"
                elif "Non disponibile" in text:
                    price_text = "Non disponibile"
                break

        # Cerca info slot
        slots = 0
        for t in td.find_all("table"):
            text = t.get_text()
            if "Slot" in text and "Nessuno Slot" not in text:
                # Conta le icone slot
                slot_imgs = t.find_all("img", alt=lambda a: a and "Slot Vuoto" in a)
                slots = len(slot_imgs)
                break
            elif "Nessuno Slot" in text:
                slots = 0
                break

        # Estrai i valori: prima prova tabella upgrade, poi tabella 'Up unico'
        upgrade_values = extract_upgrade_table(td)
        if upgrade_values:
            values = upgrade_values
            upgrade_type = "upgrade"
        else:
            values = extract_single_value_table(td)
            upgrade_type = "unique"

        weapon = {
            "nome": name,
            "tipo": weapon_type,
            "livello": level,
            "url": url,
            "icona": icon,
            "prezzo_vendita": price_text,
            "slot": slots,
            "tipo_upgrade": upgrade_type,
        }
        # Aggiungi i valori estratti
        weapon.update(values)
        weapons.append(weapon)

    return weapons


def scrape_armi():
    """Funzione principale per scaricare tutte le armi."""
    print("Scarico armi...")
    soup = fetch_page("Armi")
    if not soup:
        print("  [ERRORE] Impossibile scaricare la pagina Armi")
        return []

    weapons = extract_weapon_blocks(soup)
    print(f"  trovate {len(weapons)} armi")

    # Rimuovi duplicati (alcune armi possono apparire più volte)
    seen = set()
    unique_weapons = []
    for w in weapons:
        key = w["nome"]
        if key not in seen:
            seen.add(key)
            unique_weapons.append(w)

    print(f"  {len(unique_weapons)} armi uniche")
    save_json(unique_weapons, "armi.json")
    return unique_weapons


if __name__ == "__main__":
    scrape_armi()