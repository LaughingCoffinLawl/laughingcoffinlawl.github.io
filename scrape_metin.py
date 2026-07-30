#!/usr/bin/env python3
"""
Scraper per le rocce Metin del wiki italiano di Metin2.
Estrae da tre pagine:
- Metin a Campo Aperto
- Metin Speciali
- Metin dei Dungeon

Ogni Metin avrà:
- nome, url, icona
- categoria (Campo Aperto, Speciali, Dungeon)
- livello, HP
- eventuali drop
"""

import re
import time
from wiki_utils import (
    fetch_page, fetch_wikitext, clean_text, parse_int,
    get_full_url, save_json, extract_cards, parse_template, BASE_URL
)


def extract_metin_details(soup, metin_name, url):
    """
    Estrae i dettagli di un singolo Metin dalla sua pagina.
    Usa il wikitesto per estrarre i dati dal template {{Metin/Layout}}.
    """
    details = {
        "nome": metin_name,
        "url": url,
        "categoria": "",  # Sarà impostato dal chiamante
        "livello": None,
        "hp": None,
        "drop": []
    }

    # Cerca icona dall'HTML
    for img in soup.find_all("img"):
        src = img.get("src", "")
        alt = img.get("alt", "")
        if "Icona_Metin" in src or "icona_metin" in src.lower() or "metin" in alt.lower():
            details["icona"] = get_full_url(src)
            break

    # Estrai dati dal wikitesto usando il template Metin/Layout
    wikitext = fetch_wikitext(metin_name)
    if wikitext:
        template = parse_template(wikitext, "Metin/Layout")
        if template:
            # Estrai livello
            if "Liv" in template:
                details["livello"] = parse_int(template["Liv"])
            # Estrai grado (rank)
            if "Grado" in template:
                details["grado"] = parse_int(template["Grado"])
            # Estrai HP se presente
            if "HP" in template:
                details["hp"] = parse_int(template["HP"])
            # Estrai drop
            if "Drop" in template:
                drop_text = template["Drop"]
                # Estrai link dal wikitesto
                links = re.findall(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]', drop_text)
                for link in links:
                    if link and not link.startswith("File:") and link not in [d["name"] for d in details["drop"]]:
                        details["drop"].append({
                            "name": link,
                            "url": get_full_url(f"/index.php/{link.replace(' ', '_')}"),
                        })

    return details


def scrape_metin_category(categoria, page_title):
    """
    Scarica tutti i Metin da una categoria (pagina wiki).
    """
    print(f"Scarico {categoria}...")
    soup = fetch_page(page_title)
    if not soup:
        print(f"  [ERRORE] Impossibile scaricare la pagina {page_title}")
        return []

    # Estrai le card dalla pagina
    cards = extract_cards(soup)
    print(f"  trovate {len(cards)} card")

    metin_list = []
    for card in cards:
        # Pulisci il nome: splitta per ":" e prendi la prima parte
        clean_name = card["name"].split(":")[0].strip()
        
        # Scarica dettagli dalla pagina del singolo Metin
        detail_soup = fetch_page(clean_name)
        if detail_soup:
            details = extract_metin_details(detail_soup, clean_name, card["url"])
            details["categoria"] = categoria
            details["icona"] = card.get("image", details.get("icona", ""))
            metin_list.append(details)
        time.sleep(0.5)  # Pausa tra le richieste

    print(f"  estratti {len(metin_list)} Metin")
    return metin_list


def scrape_all_metin():
    """
    Scarica tutti i Metin dalle tre categorie e salva file separati e combinato.
    """
    categorie = [
        ("Campo Aperto", "Metin_a_Campo_Aperto"),
        ("Speciali", "Metin_Speciali"),
        ("Dungeon", "Metin_dei_Dungeon"),
    ]

    all_metin = []
    for categoria, page_title in categorie:
        metin_list = scrape_metin_category(categoria, page_title)
        all_metin.extend(metin_list)
        time.sleep(1)  # Pausa tra le categorie

    # Rimuovi duplicati
    seen = set()
    unique_metin = []
    for m in all_metin:
        key = m["nome"]
        if key not in seen:
            seen.add(key)
            unique_metin.append(m)

    print(f"\nTotale Metin unici: {len(unique_metin)}")
    save_json(unique_metin, "metin.json")
    return unique_metin


if __name__ == "__main__":
    scrape_all_metin()