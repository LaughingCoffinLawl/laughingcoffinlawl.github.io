#!/usr/bin/env python3
"""
Script principale per eseguire tutti gli scraper del wiki italiano di Metin2.
Uso:
  python run_all.py              # Esegue tutti gli scraper
  python run_all.py armi         # Esegue solo lo scraper delle armi
  python run_all.py mostri       # Esegue solo lo scraper dei mostri
  python run_all.py armi npc     # Esegue armi e NPC

Categorie disponibili:
  armi, armature, npc, mostri, oggetti, mappe, tutti
"""

import sys
import time


def main():
    args = sys.argv[1:]
    if not args:
        targets = ["tutti"]
    else:
        targets = [a.lower() for a in args]

    run_all = "tutti" in targets or "all" in targets

    print("=" * 60)
    print("  Metin2 Wiki ITA - Scraper")
    print("  https://it-wiki.metin2.gameforge.com")
    print("=" * 60)
    print()

    start_time = time.time()

    # Armi (non dipende da altri)
    if run_all or "armi" in targets:
        from scrape_armi import scrape_armi
        scrape_armi()
        print()

    # Armature (non dipende da altri)
    if run_all or "armature" in targets:
        from scrape_armature import scrape_armature
        scrape_armature()
        print()

    # NPC (non dipende da altri)
    if run_all or "npc" in targets:
        from scrape_npc import scrape_npc
        scrape_npc()
        print()

    # Mostri (genera anche oggetti_drop.json)
    if run_all or "mostri" in targets:
        from scrape_mostri import scrape_mostri
        scrape_mostri()
        print()

    # Oggetti (dipende da mostri)
    if run_all or "oggetti" in targets:
        from scrape_oggetti import scrape_oggetti
        scrape_oggetti()
        print()

    # Mappe (dipende da mostri e npc per triangolazione)
    if run_all or "mappe" in targets:
        from scrape_mappe import scrape_mappe
        scrape_mappe()
        print()

    elapsed = time.time() - start_time
    print("=" * 60)
    print(f"  Completato in {elapsed:.1f} secondi")
    print(f"  Dati salvati nella cartella output/")
    print("=" * 60)


if __name__ == "__main__":
    main()