#!/usr/bin/env python3
"""
Scraper per i materiali di upgrade degli oggetti.
Estrae dal wikitesto i campi Item6X (materiali per upgrade +6, +7, ecc.)
e salva un JSON con le ricette di upgrade.
"""

import re
import time
import json
import os
from wiki_utils import (
    fetch_wikitext, fetch_page, parse_template, clean_text, save_json, ensure_dir
)

OUTPUT_DIR = "output"


def parse_material_name(raw_text):
    """
    Estrae nome e quantità da un campo materiale.
    Formati possibili:
    - "2xIcona Pelle di Zampa d'Orso.png"
    - "Icona Nastro per Capelli Bianco+.png"
    - "Frammento Grigio"
    
    Ritorna: {"nome": "...", "quantita": N}
    """
    if not raw_text:
        return None
    
    text = clean_text(raw_text)
    if not text or text == "-":
        return None
    
    # Cerca pattern "Nx" all'inizio per la quantità
    quantity = 1
    m = re.match(r"^(\d+)x", text)
    if m:
        quantity = int(m.group(1))
        text = text[m.end():]
    
    # Rimuovi "Icona_" dal nome se presente
    text = re.sub(r"^Icona_", "", text)
    
    # Rimuovi estensione .png se presente
    text = re.sub(r"\.png$", "", text)
    
    # Rimuovi simboli + dal nome (es. "Nastro per Capelli Bianco+")
    text = text.rstrip("+")
    
    return {
        "nome": text.strip(),
        "quantita": quantity
    }


def extract_upgrade_materials_from_html(item_name):
    """
    Estrae i materiali di upgrade dalla tabella HTML "Item per Migliorare".
    La tabella ha questa struttura:
    - Riga header: +0, +1, ..., +9 (con cella vuota all'inizio)
    - Riga Yang: costi in yang
    - Riga "Item" o "Materiale per Miglioramento 1/2": materiali (con immagini)
    
    Ritorna: dict con materiali per ogni livello +N
    """
    from bs4 import BeautifulSoup
    soup = fetch_page(item_name)
    if not soup:
        return None

    # Cerca la tabella "Item per Migliorare"
    target_table = None
    for table in soup.find_all("table"):
        table_text = clean_text(table.get_text())
        if "Item per Migliorare" in table_text:
            target_table = table
            break

    if not target_table:
        return None

    # Trova le righe con i materiali
    rows = target_table.find_all("tr")
    material_rows = []
    header_row = None
    
    for row in rows:
        cells = row.find_all(["th", "td"])
        if len(cells) > 0:
            row_text = " ".join([clean_text(c.get_text()) for c in cells])
            if "+0" in row_text and "+9" in row_text:
                header_row = row
            elif ("Item" in row_text or "Materiale per Miglioramento" in row_text) and len(cells) > 10:
                material_rows.append(row)

    if not material_rows or not header_row:
        return None

    # La riga header ha +0, +1, ..., +9 a partire da una certa indice
    header_cells = header_row.find_all(["th", "td"])
    
    # Trova l'indice di partenza degli header (+0)
    header_start_idx = 0
    for i, cell in enumerate(header_cells):
        if clean_text(cell.get_text()) == "+0":
            header_start_idx = i
            break
    
    # Estrai materiali da tutte le righe di materiali
    materials = {}
    
    for item_row in material_rows:
        item_cells = item_row.find_all(["th", "td"])
        
        for i, cell in enumerate(item_cells):
            # Cerca immagini nella cella
            imgs = cell.find_all("img")
            if not imgs:
                continue
            
            # Estrai il nome dall'immagine
            img_src = imgs[0].get("src", "")
            if not img_src:
                continue
            
            # Estrai nome file immagine
            img_filename = img_src.split("/")[-1]
            
            # Cerca la quantità nel testo della cella (es. "1x", "2x")
            cell_text = clean_text(cell.get_text())
            quantity = 1
            m = re.match(r"^(\d+)x", cell_text)
            if m:
                quantity = int(m.group(1))
            
            # Estrai nome materiale dall'immagine
            material_name = img_filename
            material_name = re.sub(r"^Icona_", "", material_name)
            material_name = re.sub(r"\.png$", "", material_name)
            material_name = material_name.replace("%2B", "+")
            material_name = material_name.replace("%27", "'")
            material_name = material_name.replace("%28", "(")
            material_name = material_name.replace("%29", ")")
            
            # Trova il livello corrispondente dall'header
            header_idx = i - header_start_idx
            if 0 <= header_idx < len(header_cells):
                header_text = clean_text(header_cells[header_idx].get_text())
                if header_text.startswith("+"):
                    level = header_text
                    # Se già esiste un materiale per questo livello, concatenalo
                    if level in materials:
                        # Aggiungi come secondo materiale (per +7, +8, +9 che hanno 2 materiali)
                        materials[level]["nome2"] = material_name
                        materials[level]["quantita2"] = quantity
                    else:
                        materials[level] = {
                            "nome": material_name,
                            "quantita": quantity
                        }

    return materials if materials else None


def extract_upgrade_materials(item_name, categoria):
    """
    Estrae i materiali di upgrade da una pagina di oggetto.
    Usa prima l'HTML, poi fallback al wikitesto.
    """
    # Prova prima con HTML (più affidabile)
    materials = extract_upgrade_materials_from_html(item_name)
    if materials:
        return materials

    # Fallback: prova con wikitesto
    wikitext = fetch_wikitext(item_name)
    if not wikitext:
        return None

    # Prova a parsare il template della categoria
    template_name = f"{categoria}/Layout"
    params = parse_template(wikitext, template_name)
    
    # Se non trova il template specifico, prova template generici
    if not params:
        for generic_template in ["Armi/Layout", "Armatura/Layout", "Equipaggiamento/Layout"]:
            params = parse_template(wikitext, generic_template)
            if params:
                break

    if not params:
        return None

    # Estrai materiali per ogni livello di upgrade
    # Item60 = +0, Item61 = +1, ..., Item69 = +9
    materials = {}
    for level in range(0, 10):  # +0 a +9
        item_key = f"Item{level}"
        if item_key in params and params[item_key]:
            parsed = parse_material_name(params[item_key])
            if parsed and parsed["nome"]:
                materials[f"+{level}"] = parsed

    return materials if materials else None


def scrape_all_upgrade_materials():
    """
    Scarica i materiali di upgrade per tutti gli oggetti di tutte le categorie.
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

    all_materials = {}

    for categoria, filename in categorie.items():
        filepath = os.path.join(OUTPUT_DIR, filename)
        if not os.path.exists(filepath):
            print(f"[SKIP] File {filepath} non trovato")
            continue

        with open(filepath, "r", encoding="utf-8") as f:
            items = json.load(f)

        print(f"\nScarico materiali per {categoria}...")
        categoria_materials = {}

        for i, item in enumerate(items):
            nome = item.get("nome")
            if not nome:
                continue

            print(f"  [{i+1}/{len(items)}] {nome}...", end=" ")
            materials = extract_upgrade_materials(nome, categoria)
            
            if materials:
                categoria_materials[nome] = {
                    "materiali": materials,
                    "categoria": categoria,
                    "url": item.get("url", ""),
                }
                print(f"✓ ({len(materials)} livelli)")
            else:
                print("✗ (nessun materiale trovato)")

            time.sleep(0.3)  # Pausa per non sovraccaricare il server

        all_materials[categoria] = categoria_materials

    # Salva il risultato
    ensure_dir(OUTPUT_DIR)
    output_path = os.path.join(OUTPUT_DIR, "materiali_upgrade.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_materials, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Salvato in {output_path}")
    
    # Statistiche
    total_items = sum(len(cat) for cat in all_materials.values())
    print(f"  Totale oggetti con materiali: {total_items}")
    for cat, items in all_materials.items():
        print(f"    {cat}: {len(items)} oggetti")

    return all_materials


if __name__ == "__main__":
    scrape_all_upgrade_materials()