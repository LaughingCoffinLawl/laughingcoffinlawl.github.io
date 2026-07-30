#!/usr/bin/env python3
"""
Scraper per i Mostri del wiki italiano di Metin2.
La struttura ha tre livelli:
1. Mostri:Info → card categorie (Animali, Orchi, Demoni, ecc.)
2. Ogni categoria → card mostri con nome, livello, rank, mappe spawn
3. Ogni mostro → pagina dettaglio con statistiche e drop

Dai mostri si arriva anche alla lista dei Drop degli Oggetti.
https://it-wiki.metin2.gameforge.com/index.php/Mostri:Info
"""

import re
import time
from wiki_utils import (
    fetch_page, fetch_wikitext, clean_text, parse_int, parse_range,
    get_full_url, save_json, extract_cards, extract_card_with_level,
    extract_infobox, extract_drop_list, page_title_from_url,
    parse_template, parse_wiki_links, parse_status_resistances, DELAY
)


def extract_monster_detail(page_title):
    """
    Estrae le informazioni dettagliate dalla pagina di un singolo mostro.
    Usa il wikitesto per parsare il template {{Mostri/Layout}}.
    Include: livello, grado, bonus, status resistances, elemento, exp, luogo, drop.
    """
    info = {}
    wikitext = fetch_wikitext(page_title)
    if not wikitext:
        return info

    # Parse the {{Mostri/Layout}} template
    template = parse_template(wikitext, "Mostri/Layout")
    if not template:
        # Try alternative template name
        template = parse_template(wikitext, "Layout")

    if template:
        # Immagine
        img = template.get("Img", "").strip()
        if img:
            info["immagine"] = img  # Nome file, convertire in URL se necessario

        # Livello
        liv = template.get("Liv", "").strip()
        info["livello"] = parse_int(liv) if liv else None

        # Grado (Boss, Elite, Normale, Mini Boss)
        grado = template.get("Grado", "").strip()
        info["grado"] = parse_wiki_links(grado) if grado else []
        info["boss"] = "Boss" in grado

        # Bonus (forte contro)
        bonus = template.get("Bonus", "").strip()
        info["bonus"] = parse_wiki_links(bonus) if bonus else []

        # Status resistances (SRP, A, etc.)
        interazioni_res = template.get("InterazioniRes", "").strip()
        interazioni_status = template.get("InterazioniStatus", "").strip()
        status = parse_status_resistances(interazioni_status)
        info.update(status)

        # Elemento
        elemento = template.get("Elemento", "").strip()
        info["elemento"] = parse_wiki_links(elemento) if elemento else []

        # EXP
        exp = template.get("EXP", "").strip()
        info["esperienza"] = parse_int(exp) if exp else None

        # Luogo (mappe di spawn)
        luogo = template.get("Luogo", "").strip()
        if luogo:
            info["mappe_spawn"] = parse_wiki_links(luogo)

        # Drop
        drop_text = template.get("Drop", "").strip()
        if drop_text:
            info["drop"] = parse_wiki_links(drop_text)

        # Sottocategoria
        sottocategoria = template.get("Sottocategoria", "").strip()
        if sottocategoria:
            info["sottocategoria"] = sottocategoria

    # Fallback: estrai immagine da HTML se non trovata nel template
    if not info.get("immagine"):
        soup = fetch_page(page_title)
        if soup:
            for img in soup.find_all("img"):
                src = img.get("src", "")
                alt = img.get("alt", "")
                if alt and ("Render" in alt or "render" in alt or alt.endswith(".png")):
                    if "Icona" not in src and "Slot" not in src and "File:" not in src:
                        info["immagine"] = get_full_url(src)
                        break

    return info

def scrape_mostri():
    """
    Funzione principale per scaricare tutti i mostri.
    1. Scarica Mostri:Info per ottenere le categorie
    2. Per ogni categoria, scarica la sottopagina con i mostri
    3. Per ogni mostro, scarica la pagina di dettaglio
    """
    print("Scarico mostri...")

    # Livello 1: pagina Mostri:Info con le categorie
    soup = fetch_page("Mostri:Info")
    if not soup:
        print("  [ERRORE] Impossibile scaricare la pagina Mostri:Info")
        return []

    categories = extract_cards(soup)
    print(f"  trovate {len(categories)} categorie mostri")

    all_monsters = []
    all_drops = {}  # dict per accumulare tutti gli oggetti droppati

    # Livello 2: per ogni categoria, scarica la sottopagina
    for cat_idx, category in enumerate(categories):
        cat_name = category["name"]
        cat_url = category["url"]
        print(f"  [{cat_idx+1}/{len(categories)}] Categoria: {cat_name}")

        page_title = page_title_from_url(cat_url)
        if not page_title:
            continue

        cat_soup = fetch_page(page_title)
        if not cat_soup:
            print(f"    [WARN] Impossibile scaricare la categoria '{cat_name}'")
            continue
        time.sleep(DELAY)

        # Estrai i mostri da questa categoria
        monsters = extract_card_with_level(cat_soup)
        print(f"    {len(monsters)} mostri in questa categoria")

        # Livello 3: per ogni mostro, scarica la pagina di dettaglio
        for m_idx, monster_card in enumerate(monsters):
            monster = {
                "nome": monster_card["name"],
                "categoria": cat_name,
                "livello_card": monster_card.get("level"),
                "rank_card": monster_card.get("rank"),
                "url": monster_card["url"],
                "immagine_card": monster_card.get("image", ""),
                "mappe_spawn": monster_card.get("spawn_maps", []),
            }

            # Scarica la pagina di dettaglio del mostro (usando wikitesto)
            m_page_title = page_title_from_url(monster_card["url"])
            if m_page_title:
                detail = extract_monster_detail(m_page_title)
                if detail:
                    # Non sovrascrivere il livello della card se già presente
                    if "livello" in detail and detail["livello"]:
                        monster["livello"] = detail["livello"]
                    else:
                        monster["livello"] = monster_card.get("level")
                    # Copia tutte le altre info
                    for k, v in detail.items():
                        if k != "livello":
                            monster[k] = v
                else:
                    monster["livello"] = monster_card.get("level")
                time.sleep(DELAY)
            else:
                monster["livello"] = monster_card.get("level")

            all_monsters.append(monster)

            # Accumula i drop per la lista oggetti
            if "drop" in monster:
                for drop_name in monster["drop"]:
                    if drop_name not in all_drops:
                        all_drops[drop_name] = {
                            "nome": drop_name,
                            "droppato_da": [],
                        }
                    all_drops[drop_name]["droppato_da"].append(monster["nome"])

    print(f"  totale: {len(all_monsters)} mostri")
    save_json(all_monsters, "mostri.json")

    # Salva anche la lista degli oggetti droppati
    drops_list = list(all_drops.values())
    print(f"  trovati {len(drops_list)} oggetti unici dai drop")
    save_json(drops_list, "oggetti_drop.json")

    return all_monsters


if __name__ == "__main__":
    scrape_mostri()