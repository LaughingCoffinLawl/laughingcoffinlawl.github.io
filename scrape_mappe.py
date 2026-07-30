#!/usr/bin/env python3
"""
Scraper per le mappe del wiki italiano di Metin2.
Usa il wikitesto (template Mappe/Layout) per estrarre i dati,
poi triangola con i dati già scrapati (mostri.json, npc.json).
https://it-wiki.metin2.gameforge.com/index.php/Categoria:Mappe
"""

import re
import time
import os
import json
import requests
from wiki_utils import (
    clean_text, get_full_url, save_json, load_json,
    fetch_category_members, ensure_dir, DELAY
)

IT_BASE_URL = "https://it-wiki.metin2.gameforge.com"
IT_API_URL = f"{IT_BASE_URL}/api.php"
IT_INDEX_URL = f"{IT_BASE_URL}/index.php"
IT_HEADERS = {
    "User-Agent": "Metin2WikiScraper/1.0 (educational purpose)"
}

IMAGES_DIR = "output/images/mappe"


def fetch_wikitext(page_title):
    """Ottiene il wikitesto di una pagina via API."""
    params = {
        "action": "parse",
        "page": page_title,
        "prop": "wikitext",
        "format": "json",
        "formatversion": 2,
    }
    for attempt in range(3):
        try:
            r = requests.get(IT_API_URL, params=params, headers=IT_HEADERS, timeout=30)
            r.raise_for_status()
            data = r.json()
            if "error" in data:
                return None
            return data["parse"]["wikitext"]
        except Exception as e:
            print(f"  [WARN] Tentativo {attempt+1} fallito per '{page_title}': {e}")
            time.sleep(2)
    return None


def parse_wikilinks(text):
    """Estrae i nomi delle pagine da wikilink [[Nome]]."""
    if not text:
        return []
    # Trova tutti i [[Nome]] o [[Nome|Alias]]
    links = re.findall(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]', text)
    return [clean_text(l) for l in links if clean_text(l)]


def parse_mob_section(text):
    """
    Parsa la sezione Mob del template.
    Formato:
    *'''[[Categoria]]:''' [[Mostro1]] • [[Mostro2]]
    *'''[[Categoria2]]:''' [[Mostro3]] • [[Mostro4]]
    """
    mobs = []
    if not text:
        return mobs
    # Trova le righe con mostri
    for line in text.split('\n'):
        line = line.strip()
        if not line or line.startswith('|') or line.startswith('}}'):
            continue
        # Estrai tutti i wikilink dalla riga
        links = parse_wikilinks(line)
        for link in links:
            # Salta le categorie (es. "Eid", "Selvaggi")
            if link in ["Eid", "Selvaggi", "Animali", "Demoni", "Orchi", "Giganti",
                        "Ragni", "Troll", "Ciclopi", "Appestati", "Esoterici",
                        "Manticore", "Ogre", "Setaou", "Tritoni", "Kappa",
                        "Corrotti", "Serpens", "Gnoll", "Lemuri", "Myr",
                        "Ochao", "Rane", "Scimmie", "Alberi", "En-Tai",
                        "Amazzoni, Ladri e Assassini", "Mostri del Deserto",
                        "Mostri del Fuoco", "Mostri del Ghiaccio",
                        "Mostri Elementali", "Mostri da Evento",
                        "Mostri di Halloween", "Mostri dell'Idra",
                        "Mostri dello Zodiaco", "Mostri Boreali",
                        "Altromondo (mostri)", "Mostri Ombra di Luna",
                        "Mostri delle Guerre tra Gilde",
                        "Mostri dell'Inferna Sung Mahi",
                        "Esercito di Sung Mahi"]:
                continue
            mobs.append(link)
    return mobs


def parse_template(wikitext):
    """
    Parsa il template {{Mappe/Layout}} dal wikitesto.
    Ritorna un dict con tutti i campi.
    """
    result = {
        "regno": "",
        "livello": "",
        "immagine": "",
        "info": "",
        "zone_limitrofe": [],
        "mappe_successive": [],
        "giacimenti": [],
        "metin": [],
        "npc": [],
        "mob": [],
        "boss": [],
        "minimappa": "",
        "dimensioni": "",
    }

    if not wikitext:
        return result

    # Estrai il template Mappe/Layout
    m = re.search(r'\{\{Mappe/Layout\n(.*?)\n\}\}', wikitext, re.DOTALL)
    if not m:
        return result

    template_content = m.group(1)

    # Parsa i campi uno per uno
    # Campo: Regno
    m = re.search(r'\|\s*Regno\s*=\s*(.+?)(?:\n\||\n$)', template_content)
    if m:
        result["regno"] = clean_text(m.group(1))

    # Campo: Livello
    m = re.search(r'\|\s*Livello\s*=\s*(.+?)(?:\n\||\n$)', template_content)
    if m:
        result["livello"] = clean_text(m.group(1))

    # Campo: Img (banner)
    m = re.search(r'\|\s*Img\s*=\s*(.+?)(?:\n\||\n$)', template_content)
    if m:
        result["immagine"] = clean_text(m.group(1))

    # Campo: Info
    m = re.search(r'\|\s*Info\s*=\s*(.+?)(?:\n\||\n$)', template_content, re.DOTALL)
    if m:
        result["info"] = clean_text(m.group(1))

    # Campo: Zone limitrofe
    m = re.search(r'\|\s*Zone\s*limitrofe\s*=\s*(.+?)(?:\n\||\n$)', template_content)
    if m:
        result["zone_limitrofe"] = parse_wikilinks(m.group(1))

    # Campo: MappeSuccessive
    m = re.search(r'\|\s*MappeSuccessive\s*=\s*(.+?)(?:\n\||\n$)', template_content)
    if m:
        result["mappe_successive"] = parse_wikilinks(m.group(1))

    # Campo: Giacimenti
    m = re.search(r'\|\s*Giacimenti\s*=\s*(.+?)(?:\n\||\n$)', template_content, re.DOTALL)
    if m:
        result["giacimenti"] = parse_wikilinks(m.group(1))

    # Campo: Metin
    m = re.search(r'\|\s*Metin\s*=\s*(.+?)(?:\n\||\n$)', template_content, re.DOTALL)
    if m:
        result["metin"] = parse_wikilinks(m.group(1))

    # Campo: NPC
    m = re.search(r'\|\s*NPC\s*=\s*(.+?)(?:\n\||\n$)', template_content, re.DOTALL)
    if m:
        result["npc"] = parse_wikilinks(m.group(1))

    # Campo: Mob
    m = re.search(r'\|\s*Mob\s*=\s*(.+?)(?:\n\||\n$)', template_content, re.DOTALL)
    if m:
        result["mob"] = parse_mob_section(m.group(1))

    # Campo: Boss
    m = re.search(r'\|\s*Boss\s*=\s*(.+?)(?:\n\||\n$)', template_content, re.DOTALL)
    if m:
        result["boss"] = parse_wikilinks(m.group(1))

    # Campo: Minimappa
    m = re.search(r'\|\s*Minimappa\s*=\s*(.+?)(?:\n\||\n$)', template_content)
    if m:
        result["minimappa"] = clean_text(m.group(1))

    # Campo: Dimensioni
    m = re.search(r'\|\s*Dimensioni\s*=\s*(.+?)(?:\n\||\n$)', template_content)
    if m:
        result["dimensioni"] = clean_text(m.group(1))

    return result


def build_lookup_tables():
    """
    Costruisce tabelle di lookup dai dati già scrapati
    per triangolare nomi -> URL e info aggiuntive.
    """
    # Carica mostri
    mostri_lookup = {}
    mostri_data = load_json("mostri.json")
    if mostri_data:
        for m in mostri_data:
            nome = m.get("nome", "")
            if nome:
                mostri_lookup[nome.lower()] = {
                    "nome": nome,
                    "url": m.get("url", ""),
                    "livello": m.get("livello") or m.get("livello_card"),
                    "categoria": m.get("categoria", ""),
                    "immagine": m.get("immagine", "") or m.get("immagine_card", ""),
                }

    # Carica NPC
    npc_lookup = {}
    npc_data = load_json("npc.json")
    if npc_data:
        for n in npc_data:
            nome = n.get("nome", "")
            if nome:
                npc_lookup[nome.lower()] = {
                    "nome": nome,
                    "url": n.get("url", ""),
                    "immagine": n.get("immagine", "") or n.get("immagine_card", ""),
                }

    return mostri_lookup, npc_lookup


def download_image(url, filename):
    """Scarica un'immagine e la salva."""
    if not url:
        return False
    ensure_dir(IMAGES_DIR)
    filepath = os.path.join(IMAGES_DIR, filename)
    if os.path.exists(filepath):
        return True
    try:
        r = requests.get(url, headers=IT_HEADERS, timeout=30)
        r.raise_for_status()
        with open(filepath, "wb") as f:
            f.write(r.content)
        return True
    except Exception as e:
        print(f"    [WARN] Impossibile scaricare {url}: {e}")
        return False


def get_image_url(filename):
    """Ottiene l'URL completo di un'immagine dal wiki."""
    if not filename:
        return ""
    # L'URL delle immagini segue il pattern
    # /images/.../Nome_File.png
    # Dobbiamo usare l'API per ottenere l'URL
    params = {
        "action": "query",
        "titles": f"File:{filename}",
        "prop": "imageinfo",
        "iiprop": "url",
        "format": "json",
        "formatversion": 2,
    }
    try:
        r = requests.get(IT_API_URL, params=params, headers=IT_HEADERS, timeout=30)
        r.raise_for_status()
        data = r.json()
        pages = data.get("query", {}).get("pages", [])
        if pages:
            info = pages[0].get("imageinfo", [])
            if info:
                return info[0].get("url", "")
    except:
        pass
    return f"{IT_INDEX_URL}/Speciale:FilePath/{filename}"


def scrape_mappe():
    """Funzione principale per scaricare tutte le mappe."""
    print("Scarico mappe...")

    # Costruisci lookup tables dai dati già scrapati
    mostri_lookup, npc_lookup = build_lookup_tables()
    print(f"  Lookup: {len(mostri_lookup)} mostri, {len(npc_lookup)} NPC")

    # Ottieni la lista delle mappe dalla categoria
    map_titles = fetch_category_members("Mappe")
    print(f"  trovate {len(map_titles)} mappe nella categoria")

    # Filtra pagine non-mappe
    exclude = ["Elenco delle Mappe", "Villo 1", "Villo 2", "Zona Gilde", "Terra delle Gilde"]
    map_titles = [m for m in map_titles if m not in exclude]

    all_maps = []
    for i, page_title in enumerate(map_titles):
        print(f"  [{i+1}/{len(map_titles)}] {page_title}...")

        # Ottieni wikitesto
        wikitext = fetch_wikitext(page_title)
        if not wikitext:
            print(f"    [WARN] Nessun wikitesto per {page_title}")
            all_maps.append({
                "nome": page_title.replace("_", " "),
                "url": f"{IT_INDEX_URL}/{page_title}",
                "errore": "Nessun wikitesto"
            })
            continue

        # Parsa il template
        data = parse_template(wikitext)
        data["nome"] = page_title.replace("_", " ")
        data["url"] = f"{IT_INDEX_URL}/{page_title}"

        # Triangola mostri con lookup
        mobs_with_info = []
        for mob_name in data["mob"]:
            lookup = mostri_lookup.get(mob_name.lower(), {})
            mobs_with_info.append({
                "nome": mob_name,
                "url": lookup.get("url", f"{IT_INDEX_URL}/{mob_name.replace(' ', '_')}"),
                "livello": lookup.get("livello"),
                "categoria": lookup.get("categoria"),
                "immagine": lookup.get("immagine", ""),
            })
        data["mob"] = mobs_with_info

        # Triangola boss con lookup
        bosses_with_info = []
        for boss_name in data["boss"]:
            lookup = mostri_lookup.get(boss_name.lower(), {})
            bosses_with_info.append({
                "nome": boss_name,
                "url": lookup.get("url", f"{IT_INDEX_URL}/{boss_name.replace(' ', '_')}"),
                "livello": lookup.get("livello"),
                "categoria": lookup.get("categoria"),
                "immagine": lookup.get("immagine", ""),
            })
        data["boss"] = bosses_with_info

        # Triangola NPC con lookup
        npcs_with_info = []
        for npc_name in data["npc"]:
            lookup = npc_lookup.get(npc_name.lower(), {})
            npcs_with_info.append({
                "nome": npc_name,
                "url": lookup.get("url", f"{IT_INDEX_URL}/{npc_name.replace(' ', '_')}"),
                "immagine": lookup.get("immagine", ""),
            })
        data["npc"] = npcs_with_info

        # Triangola metin con lookup (cerca in mostri)
        metin_with_info = []
        for metin_name in data["metin"]:
            lookup = mostri_lookup.get(metin_name.lower(), {})
            metin_with_info.append({
                "nome": metin_name,
                "url": lookup.get("url", f"{IT_INDEX_URL}/{metin_name.replace(' ', '_')}"),
            })
        data["metin"] = metin_with_info

        # Scarica immagini
        if data["immagine"]:
            img_url = get_image_url(data["immagine"])
            safe_name = page_title.replace("/", "_").replace(" ", "_")
            if img_url and download_image(img_url, f"{safe_name}_banner.png"):
                data["immagine_locale"] = f"images/mappe/{safe_name}_banner.png"
                data["immagine_url"] = img_url

        if data["minimappa"]:
            img_url = get_image_url(data["minimappa"])
            safe_name = page_title.replace("/", "_").replace(" ", "_")
            if img_url and download_image(img_url, f"{safe_name}_map.jpg"):
                data["minimappa_locale"] = f"images/mappe/{safe_name}_map.jpg"
                data["minimappa_url"] = img_url

        all_maps.append(data)
        time.sleep(DELAY)

    print(f"  totale: {len(all_maps)} mappe")
    save_json(all_maps, "mappe.json")

    # Riepilogo
    total_npc = sum(len(m["npc"]) for m in all_maps if "npc" in m)
    total_mob = sum(len(m["mob"]) for m in all_maps if "mob" in m)
    total_metin = sum(len(m["metin"]) for m in all_maps if "metin" in m)
    print(f"  NPC: {total_npc}")
    print(f"  Mostri: {total_mob}")
    print(f"  Metin: {total_metin}")

    return all_maps


if __name__ == "__main__":
    scrape_mappe()