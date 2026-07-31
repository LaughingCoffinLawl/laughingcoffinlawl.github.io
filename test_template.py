#!/usr/bin/env python3
"""
Script di test per verificare il parsing dei template del wiki.
"""

from wiki_utils import fetch_wikitext, parse_template, clean_text

# Test con la Spada
item_name = "Spada"
categoria = "Armi"

print(f"Scarico wikitesto per: {item_name}")
wikitext = fetch_wikitext(item_name)

if wikitext:
    print(f"✓ Wikitext scaricato ({len(wikitext)} caratteri)")
    print("\nPrime 500 caratteri:")
    print(wikitext[:500])
    print("\n" + "="*50)
    
    # Prova a parsare il template
    template_name = f"{categoria}/Layout"
    print(f"\nProvo a parsare template: {template_name}")
    params = parse_template(wikitext, template_name)
    
    if params:
        print(f"✓ Template trovato con {len(params)} parametri")
        print("\nTutti i parametri:")
        for key, value in params.items():
            print(f"  {key} = {value}")
        
        # Cerca campi Item6X
        print("\nCampi Item6X trovati:")
        for key in sorted(params.keys()):
            if key.startswith("Item6"):
                print(f"  {key} = {params[key]}")
    else:
        print(f"✗ Template {template_name} non trovato")
        
        # Prova template alternativi
        for alt_template in ["Armi/Layout", "Armatura/Layout", "Equipaggiamento/Layout"]:
            print(f"\nProvo template alternativo: {alt_template}")
            params = parse_template(wikitext, alt_template)
            if params:
                print(f"✓ Template {alt_template} trovato!")
                print(f"  Parametri: {list(params.keys())[:10]}...")
                break
else:
    print("✗ Impossibile scaricare il wikitesto")