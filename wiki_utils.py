#!/usr/bin/env python3
"""
Modulo di utility condivise per gli scraper del wiki italiano di Metin2.
https://it-wiki.metin2.gameforge.com
"""

import os
import re
import time
import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, unquote

# Configurazione globale
BASE_URL = "https://it-wiki.metin2.gameforge.com"
API_URL = f"{BASE_URL}/api.php"
INDEX_URL = f"{BASE_URL}/index.php"
HEADERS = {
    "User-Agent": "Metin2WikiScraper/1.0 (educational purpose)"
}
OUTPUT_DIR = "output"
CACHE_DIR = "cache"
DELAY = 0.5  # secondi tra le richieste per non sovraccaricare il server


def ensure_dir(path):
    """Crea una directory se non esiste."""
    os.makedirs(path, exist_ok=True)


def fetch_page(page_title):
    """
    Scarica una pagina del wiki tramite l'API MediaWiki (action=parse).
    Ritorna un oggetto BeautifulSoup del contenuto parsato.
    """
    params = {
        "action": "parse",
        "page": page_title,
        "prop": "text",
        "format": "json",
        "formatversion": 2,
    }
    for attempt in range(3):
        try:
            r = requests.get(API_URL, params=params, headers=HEADERS, timeout=30)
            r.raise_for_status()
            data = r.json()
            if "error" in data:
                print(f"  [WARN] Pagina '{page_title}' non trovata o errore API: {data['error'].get('info','')}")
                return None
            html = data["parse"]["text"]
            return BeautifulSoup(html, "lxml")
        except Exception as e:
            print(f"  [WARN] Tentativo {attempt+1} fallito per '{page_title}': {e}")
            time.sleep(2)
    return None


def fetch_raw_html(page_title):
    """
    Scarica una pagina del wiki direttamente via URL (non API).
    Utile per pagine che richiedono il rendering completo del skin.
    """
    url = f"{INDEX_URL}/{page_title}"
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            r.raise_for_status()
            return BeautifulSoup(r.text, "lxml")
        except Exception as e:
            print(f"  [WARN] Tentativo {attempt+1} fallito per '{page_title}': {e}")
            time.sleep(2)
    return None


def fetch_category_members(category, limit=5000):
    """
    Elenca tutte le pagine appartenenti a una categoria via API.
    """
    members = []
    cmcontinue = None
    while True:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Categoria:{category}",
            "cmlimit": str(limit),
            "cmtype": "page",
            "format": "json",
            "formatversion": 2,
        }
        if cmcontinue:
            params["cmcontinue"] = cmcontinue
        r = requests.get(API_URL, params=params, headers=HEADERS, timeout=30)
        r.raise_for_status()
        data = r.json()
        for m in data.get("query", {}).get("categorymembers", []):
            members.append(m["title"])
        if "continue" in data:
            cmcontinue = data["continue"].get("cmcontinue")
        else:
            break
    return members


def clean_text(text):
    """Pulisce un testo da spazi multipli, caratteri speciali, ecc."""
    if not text:
        return ""
    text = text.replace("\xa0", " ").replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_int(text):
    """Estrae un intero da una stringa (gestisce punti come separatori migliaia)."""
    if not text:
        return None
    text = clean_text(text).replace(".", "").replace(",", "")
    m = re.search(r"-?\d+", text)
    return int(m.group()) if m else None


def parse_range(text):
    """
    Estrae un range (min, max) da stringhe tipo '76-78' o '76 - 78'.
    """
    if not text:
        return (None, None)
    text = clean_text(text)
    m = re.match(r"(\d+)\s*[-–]\s*(\d+)", text)
    if m:
        return (int(m.group(1)), int(m.group(2)))
    n = parse_int(text)
    return (n, n) if n is not None else (None, None)


def get_full_url(path):
    """Converte un path relativo in URL assoluto."""
    if not path:
        return ""
    if path.startswith("http"):
        return path
    return urljoin(BASE_URL + "/", path.lstrip("/"))


def save_json(data, filename):
    """Salva dati in formato JSON nella cartella output."""
    ensure_dir(OUTPUT_DIR)
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  -> salvato in {filepath}")
    return filepath


def load_json(filename):
    """Carica dati JSON dalla cartella output."""
    filepath = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def extract_cards(soup):
    """
    Estrae le 'card' dal contenuto wiki.
    Ogni card è un div con style che contiene una tabella con:
    - Riga 1: nome (in corsivo)
    - Riga 2: immagine (link)
    Ritorna lista di dict: {name, url, image}
    """
    cards = []
    # Le card sono div con display:inline-block che contengono tabelle
    for div in soup.find_all("div", style=lambda v: v and "display:inline-block" in v):
        table = div.find("table")
        if not table:
            continue
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        # Prima riga: nome
        name_cell = rows[0].find("td")
        if not name_cell:
            continue
        name = clean_text(name_cell.get_text())
        # Seconda riga: immagine con link
        link = None
        img = None
        if len(rows) > 1:
            a = rows[1].find("a")
            if a:
                link = a.get("href", "")
                img_tag = a.find("img")
                if img_tag:
                    img = img_tag.get("src", "")
        if name and link:
            cards.append({
                "name": name,
                "url": get_full_url(link),
                "image": get_full_url(img) if img else "",
            })
    return cards


def extract_card_with_level(soup):
    """
    Estrae card che includono anche livello e mappe di spawn.
    Usato per le sottopagine dei mostri (es. Animali).
    Formato card: 'Nome: livello (rank)'
    """
    cards = []
    for div in soup.find_all("div", style=lambda v: v and "display:inline-block" in v):
        table = div.find("table")
        if not table:
            continue
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        # Prima riga: "Nome: livello (rank)"
        name_cell = rows[0].find("td")
        if not name_cell:
            continue
        header = clean_text(name_cell.get_text())
        # Parse: "Bera: 33 (4)" o "Cinghiale Rosso Maledetto: 15(4)"
        m = re.match(r"(.+?):\s*(\d+)\s*\((\d+)\)", header)
        if m:
            name = clean_text(m.group(1))
            level = int(m.group(2))
            rank = int(m.group(3))
        else:
            name = header
            level = None
            rank = None
        # Seconda riga: immagine con link
        link = None
        img = None
        if len(rows) > 1:
            a = rows[1].find("a")
            if a:
                link = a.get("href", "")
                img_tag = a.find("img")
                if img_tag:
                    img = img_tag.get("src", "")
        # Terza/quarta riga: mappe di spawn
        spawn_maps = []
        for row in rows[2:]:
            cell = row.find("td")
            if cell:
                text = clean_text(cell.get_text())
                if text and text != "Mappa di Spawn":
                    # Estrai nomi mappe dai link
                    map_links = cell.find_all("a")
                    if map_links:
                        spawn_maps = [clean_text(a.get_text()) for a in map_links if clean_text(a.get_text())]
                    break
        if name and link:
            cards.append({
                "name": name,
                "level": level,
                "rank": rank,
                "url": get_full_url(link),
                "image": get_full_url(img) if img else "",
                "spawn_maps": spawn_maps,
            })
    return cards


def extract_upgrade_table(soup):
    """
    Estrae i valori da una tabella di upgrade (+0, +1, ..., +9).
    Ritorna un dict con i valori al +9 (o l'ultimo disponibile).
    """
    result = {}
    # Cerca tabelle con header +0, +1, ..., +9
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        if not rows:
            continue
        # La prima riga dovrebbe avere header +0, +1, ...
        header_cells = rows[0].find_all(["th", "td"])
        headers = [clean_text(c.get_text()) for c in header_cells]
        # Verifica che ci siano header +0, +1, ecc.
        upgrade_indices = []
        for i, h in enumerate(headers):
            if re.match(r"\+\d+", h):
                upgrade_indices.append(i)
        if not upgrade_indices:
            continue
        # Trova l'indice della colonna +9
        plus9_idx = None
        for i, h in enumerate(headers):
            if h == "+9":
                plus9_idx = i
                break
        # Se non c'è +9, usa l'ultimo
        if plus9_idx is None and upgrade_indices:
            plus9_idx = upgrade_indices[-1]
        if plus9_idx is None:
            continue
        # Estrai le righe dati
        for row in rows[1:]:
            cells = row.find_all(["th", "td"])
            if len(cells) <= plus9_idx:
                continue
            label = clean_text(cells[0].get_text())
            value = clean_text(cells[plus9_idx].get_text())
            if label and value and value != "-":
                # Normalizza le etichette
                label_lower = label.lower().rstrip(":").strip()
                if "attacco" in label_lower and "mag" not in label_lower and "vel" not in label_lower and "%" not in label:
                    result["attacco"] = value
                elif "attmag" in label_lower or ("attacco" in label_lower and "mag" in label_lower):
                    result["attacco_magico"] = value
                elif "velatk" in label_lower or ("velocità" in label_lower and "attacco" in label_lower):
                    result["velocita_attacco"] = value
                elif "difesa" in label_lower and "mag" not in label_lower:
                    result["difesa"] = value
                elif "difmag" in label_lower or ("difesa" in label_lower and "mag" in label_lower):
                    result["difesa_magica"] = value
                elif "velmov" in label_lower or ("velocità" in label_lower and "mov" in label_lower):
                    result["velocita_movimento"] = value
                elif "costo" in label_lower or "yang" in label_lower:
                    result["costo_yang"] = value
    return result


def extract_single_value_table(soup):
    """
    Estrae valori da una tabella con 'Up unico' (oggetti non upgradabili).
    """
    result = {}
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all(["th", "td"])
            if len(cells) >= 2:
                label = clean_text(cells[0].get_text())
                value = clean_text(cells[1].get_text())
                if label and value:
                    label_lower = label.lower().rstrip(":").strip()
                    if "livello" in label_lower:
                        result["livello"] = parse_int(value)
                    elif "attacco" in label_lower and "mag" not in label_lower and "vel" not in label_lower and "%" not in label:
                        result["attacco"] = value
                    elif "attmag" in label_lower or ("attacco" in label_lower and "mag" in label_lower):
                        result["attacco_magico"] = value
                    elif "velocità" in label_lower and "attacco" in label_lower:
                        result["velocita_attacco"] = value
                    elif "critico" in label_lower:
                        result["critico"] = value
                    elif "equipaggiabile" in label_lower:
                        result["classi"] = value
    return result


def extract_infobox(soup):
    """
    Estrae dati da un infobox/tabella di informazioni generico.
    Cerca tabelle con righe label: valore.
    """
    result = {}
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all(["th", "td"])
            if len(cells) >= 2:
                label = clean_text(cells[0].get_text()).rstrip(":").strip()
                value = clean_text(cells[1].get_text())
                if label and value and len(label) < 50:
                    result[label.lower().replace(" ", "_")] = value
    return result


def extract_drop_list(soup):
    """
    Estrae la lista dei drop da una pagina di un mostro.
    Cerca tabelle o liste con gli oggetti droppati.
    """
    drops = []
    # Cerca sezioni con "Drop" o "Oggetti"
    for heading in soup.find_all(["h2", "h3"]):
        text = clean_text(heading.get_text()).lower()
        if "drop" in text or "oggetti" in text or "loot" in text:
            # Trova la tabella o lista successiva
            sibling = heading.find_next_sibling()
            while sibling and sibling.name not in ["h2", "h3"]:
                if sibling.name == "table":
                    rows = sibling.find_all("tr")
                    for row in rows:
                        cells = row.find_all(["th", "td"])
                        if cells:
                            # Cerca link agli oggetti
                            links = row.find_all("a")
                            for link in links:
                                href = link.get("href", "")
                                name = clean_text(link.get_text())
                                if name and href and "/index.php/" in href and not href.startswith("#"):
                                    drops.append({
                                        "name": name,
                                        "url": get_full_url(href),
                                    })
                    break
                sibling = sibling.find_next_sibling()
    # Fallback: cerca tutte le tabelle con oggetti
    if not drops:
        for table in soup.find_all("table"):
            for link in table.find_all("a"):
                href = link.get("href", "")
                name = clean_text(link.get_text())
                if name and href and "/index.php/" in href and "File:" not in href:
                    # Evita link a mappe, mostri, ecc.
                    if name not in [d["name"] for d in drops]:
                        drops.append({
                            "name": name,
                            "url": get_full_url(href),
                        })
    return drops


def page_title_from_url(url):
    """Estrae il titolo della pagina dall'URL."""
    if not url:
        return ""
    # /index.php/Nome_Pagina
    m = re.search(r"/index\.php/(.+)$", url)
    if m:
        return unquote(m.group(1))
    return ""


def fetch_wikitext(page_title):
    """
    Scarica il wikitesto di una pagina (non l'HTML renderizzato).
    Utile per parsare template come {{NPC/Layout}} o {{Mostri/Layout}}.
    """
    params = {
        "action": "parse",
        "page": page_title,
        "prop": "wikitext",
        "format": "json",
        "formatversion": 2,
    }
    for attempt in range(3):
        try:
            r = requests.get(API_URL, params=params, headers=HEADERS, timeout=30)
            r.raise_for_status()
            data = r.json()
            if "error" in data:
                return None
            return data.get("parse", {}).get("wikitext", "")
        except Exception as e:
            print(f"  [WARN] Tentativo {attempt+1} fallito per wikitext '{page_title}': {e}")
            time.sleep(2)
    return None


def parse_template(wikitext, template_name):
    """
    Estrae i parametri di un template {{TemplateName|...}} dal wikitesto.
    Ritorna un dict con i parametri (chiave -> valore grezzo).
    """
    if not wikitext:
        return {}
    # Cerca {{TemplateName|...}} - gestisce template nidificati
    pattern = r"\{\{" + re.escape(template_name) + r"\s*\|(.*?)\}\}"
    match = re.search(pattern, wikitext, re.DOTALL)
    if not match:
        return {}
    content = match.group(1)
    params = {}
    # Splitta per | ma non dentro {{...}} o [[...]]
    depth = 0
    current_key = None
    current_val = []
    for char in content:
        if char == "{":
            depth += 1
            current_val.append(char)
        elif char == "}":
            depth -= 1
            current_val.append(char)
        elif char == "|" and depth == 0:
            # Fine del parametro corrente
            param_str = "".join(current_val).strip()
            if "=" in param_str:
                key, val = param_str.split("=", 1)
                params[key.strip()] = val.strip()
            current_val = []
        else:
            current_val.append(char)
    # Ultimo parametro
    param_str = "".join(current_val).strip()
    if "=" in param_str:
        key, val = param_str.split("=", 1)
        params[key.strip()] = val.strip()
    return params


def parse_wiki_links(text):
    """
    Estrae i nomi linkati da testo wiki tipo [[Nome]] o [[Nome|Testo]].
    Ritorna una lista di nomi.
    """
    if not text:
        return []
    links = re.findall(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", text)
    return [clean_text(l) for l in links if l]


def parse_status_resistances(text):
    """
    Converte una stringa di status resistance in booleani.
    Esempio: 'SRP' -> {stordimento: True, rallentamento: True, paura: True}
    'A' -> aggressivo: True
    """
    if not text:
        return {"stordimento": False, "rallentamento": False, "paura": False, "aggressivo": False}
    text = text.upper().strip()
    result = {
        "stordimento": "S" in text,
        "rallentamento": "R" in text,
        "paura": "P" in text,
        "aggressivo": "A" in text,
    }
    return result


