#!/usr/bin/env python3
"""
Scraper per gli NPC del wiki italiano di Metin2.
La pagina NPC ha card con nome e immagine; ogni card linka alla pagina
del singolo NPC dove si trovano le informazioni dettagliate.
Usa il wikitesto per parsare {{NPC/Layout}}.
https://it-wiki.metin2.gameforge.com/index.php/NPC
"""

import time
import re
from wiki_utils import (
    fetch_page, fetch_wikitext, clean_text, parse_int,
    get_full_url, save_json, extract_cards, extract_infobox,
    page_title_from_url, parse_template, parse_wiki_links, DELAY
)


def extract_npc_detail(page_title):
    """
    Estrae le informazioni dettagliate dalla pagina di un singolo NPC.
    Usa il wikitesto per parsare il template {{NPC/Layout}}.
    Include: immagine, funzione, missioni (boolean), posizione mappe con coordinate.
    """
    info = {}
    wikitext = fetch_wikitext(page_title)
    if not wikitext:
        return info

    # Parse the {{NPC/Layout}} template
    template = parse_template(wikitext, "NPC/Layout")
    if not template:
        template = parse_template(wikitext, "Layout")

    if template:
        # Immagine
        img = template.get("Img", "").strip()
        if img:
            info["immagine"] = img

        # Funzione
        funzione = template.get("Funzione", "").strip()
        info["funzione"] = parse_wiki_links(funzione) if funzione else []

        # Missioni (boolean)
        missioni = template.get("Missioni", "").strip()
        info["ha_missioni"] = bool(missioni)
        if missioni:
            info["missioni"] = parse_wiki_links(missioni)

        # Vende / Mercante
        vende = template.get("Vende", "").strip()
        info["vende"] = parse_wiki_links(vende) if vende else []
        info["venditore"] = bool(vende)

        # Posizione: estrai mappe con coordinate
        # I parametri sono nomi di mappe (Joan, Pyungmoo, Yongan, etc.)
        # con valore (x, y) o (x1,y1), (x2,y2), (x3,y3) per posizioni multiple
        posizioni = {}
        for key, val in template.items():
            val_clean = val.strip()
            # Match single position: (x, y)
            single_match = re.match(r"^\((\d+)\s*,\s*(\d+)\)$", val_clean)
            if single_match:
                posizioni[key] = {
                    "x": int(single_match.group(1)),
                    "y": int(single_match.group(2)),
                }
            else:
                # Match multiple positions: (x1,y1), (x2,y2), ...
                multi_matches = re.findall(r"\((\d+)\s*,\s*(\d+)\)", val_clean)
                if multi_matches:
                    # Usa la prima posizione
                    posizioni[key] = {
                        "x": int(multi_matches[0][0]),
                        "y": int(multi_matches[0][1]),
                    }
        if posizioni:
            info["posizioni"] = posizioni

    # Fallback: estrai immagine da HTML se non trovata nel template
    if not info.get("immagine"):
        soup = fetch_page(page_title)
        if soup:
            for img in soup.find_all("img"):
                src = img.get("src", "")
                alt = img.get("alt", "")
                if "Render" in alt or "render" in alt:
                    info["immagine"] = get_full_url(src)
                    break
                elif alt and not info.get("immagine") and "Icona" not in src:
                    info["immagine"] = get_full_url(src)

    return info


def scrape_npc():
    """Funzione principale per scaricare tutti gli NPC."""
    print("Scarico NPC...")
    soup = fetch_page("NPC")
    if not soup:
        print("  [ERRORE] Impossibile scaricare la pagina NPC")
        return []

    # Estrai le card dalla pagina principale
    cards = extract_cards(soup)
    print(f"  trovate {len(cards)} card NPC")

    npcs = []
    for i, card in enumerate(cards):
        if i > 0 and i % 50 == 0:
            print(f"  [{i}/{len(cards)}] processati...")

        npc = {
            "nome": card["name"],
            "url": card["url"],
            "immagine_card": card["image"],
        }

        # Scarica la pagina di dettaglio (usando wikitesto)
        page_title = page_title_from_url(card["url"])
        if page_title:
            detail = extract_npc_detail(page_title)
            npc.update(detail)
            time.sleep(DELAY)

        npcs.append(npc)

    print(f"  totale: {len(npcs)} NPC")
    save_json(npcs, "npc.json")
    return npcs


if __name__ == "__main__":
    scrape_npc()