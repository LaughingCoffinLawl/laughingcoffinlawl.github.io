# Metin2 Wiki ITA Scraper + DLE Game

Script Python per estrarre dati dal wiki italiano di Metin2, più un gioco DLE (Guess Game) ispirato a Wordle.

## 🚀 Deploy su GitHub Pages

Questo progetto è configurabile per GitHub Pages:

1. Crea un nuovo repository su GitHub
2. Carica tutti i file del progetto (assicurati che i file JSON siano nella root)
3. Vai su **Settings** → **Pages**
4. In **Source**, seleziona il branch (es. `main`) e la cartella `/root`
5. Salva e attendi qualche minuto
6. Il sito sarà disponibile su `https://tuo-username.github.io/nome-repo/`

**Nota:** I file JSON devono essere accessibili dal browser, quindi devono essere nella root del repository (o nella stessa cartella di `index.html`).

## 🎮 Gioco DLE - Metin2 Guess Game

### Modalità di gioco:

1. **🐉 Indovina il Mostro** (Wordle style)
   - Ti viene mostrata un'immagine di un mostro
   - Indovina il nome del mostro
   - Feedback con confronto attributi (livello, categoria)
   - Punteggio: +10 punti per ogni risposta corretta

2. **👤 Trova l'NPC sulla Mappa**
   - Ti viene mostrato un NPC e la sua immagine
   - Clicca sulla mappa dove si trova l'NPC
   - Sistema di punteggio basato sulla distanza:
     - < 50px: +15 punti (Perfetto!)
     - < 100px: +10 punti (Molto bene!)
     - < 200px: +5 punti (Buono!)
   - Usa le coordinate reali estratte dal wiki!

3. **🔍 Mostro Sfocato**
   - Immagine di un mostro sfocata
   - Usa lo slider per regolare la sfocatura
   - Indovina il nome del mostro
   - Punteggio: più è sfocato, più punti guadagni (max 15, min 1)

### Come giocare:

```bash
# Avvia il server locale
python play.py

# Apri il browser e visita:
http://localhost:8000
```

### Struttura del progetto

```
m2dle/
├── wiki_utils.py          # Modulo utility condivise
├── scrape_armi.py         # Scraper per le armi
├── scrape_armature.py     # Scraper per le armature
├── scrape_npc.py          # Scraper per gli NPC
├── scrape_mostri.py       # Scraper per i mostri (+ lista oggetti drop)
├── scrape_oggetti.py      # Scraper per gli oggetti (dai drop dei mostri)
├── scrape_mappe.py        # Scraper per le mappe (con triangolazione dati)
├── run_all.py             # Script runner principale
├── test_output.py         # Test per verificare i dati estratti
├── play.py                # Server locale per giocare al DLE
├── index.html             # Gioco DLE - Frontend
├── style.css              # Stile Metin2 per il gioco
├── app.js                 # Logica del gioco
├── mostri.json            # Dati mostri (per gioco)
├── npc.json               # Dati NPC (per gioco)
├── mappe.json             # Dati mappe (per gioco)
└── output/                # Cartella output (generata)
    ├── armi.json          # 152 armi
    ├── armature.json      # 108 armature
    ├── mostri.json        # 629+ mostri
    ├── npc.json           # 249 NPC
    ├── oggetti_drop.json  # Lista oggetti dai drop
    ├── oggetti.json       # Dettaglio oggetti
    ├── mappe.json         # 141 mappe
    └── images/mappe/      # Immagini mappe scaricate
```

## 🚀 Utilizzo

### Eseguire tutti gli scraper

```bash
python run_all.py
```

### Eseguire singoli scraper

```bash
python run_all.py armi         # Solo armi
python run_all.py armature     # Solo armature
python run_all.py npc          # Solo NPC
python run_all.py mostri       # Solo mostri (genera anche oggetti_drop.json)
python run_all.py oggetti      # Solo oggetti (richiede prima mostri)
python run_all.py mappe        # Solo mappe (richiede mostri e npc per triangolazione)
python run_all.py armi npc     # Armi e NPC
```

## 📊 Dati estratti

### Armi (`scrape_armi.py`)
- Pagina: `Armi`
- Struttura: tabelle dirette con valori +0/+9
- Estrae: nome, tipo, livello, attacco, attacco magico, velocità attacco (al +9)
- **152 armi** estratte

### Armature (`scrape_armature.py`)
- Pagina: `Armature`
- Struttura: tabelle dirette con valori +0/+9
- Estrae: nome, tipo, livello, difesa, difesa magica, velocità movimento (al +9)
- **108 armature** estratte

### NPC (`scrape_npc.py`)
- Pagina: `NPC`
- Struttura: card con nome+immagine → pagina dettaglio
- Estrae: nome, immagine, livello, funzione, posizione, missioni
- **249 NPC** estratti

### Mostri (`scrape_mostri.py`)
- Pagina: `Mostri:Info` → 42 categorie → sottopagine → pagine dettaglio
- Struttura: 3 livelli di profondità
  1. `Mostri:Info`: card categorie (Animali, Orchi, Demoni, ecc.)
  2. Ogni categoria: card mostri con nome, livello, rank, mappe spawn
  3. Ogni mostro: pagina dettaglio con statistiche e drop
- Estrae: nome, categoria, livello, HP, attacco, difesa, esperienza, drop
- **629+ mostri** estratti
- Genera anche `oggetti_drop.json` con la lista degli oggetti droppati

### Oggetti (`scrape_oggetti.py`)
- Parte dalla lista `oggetti_drop.json` generata da `scrape_mostri.py`
- Per ogni oggetto, scarica la pagina wiki ed estrae informazioni
- Per oggetti upgradabili, estrae i valori al +9

### Mappe (`scrape_mappe.py`)
- Usa la **categoria Mappe** (146 pagine) e il **wikitesto** (template `{{Mappe/Layout}}`)
- **Non** parsa HTML ma estrae i dati direttamente dal wikitesto via API
- **Triangola** con i dati già scrapati (mostri.json, npc.json) per arricchire le info
- Estrae per ogni mappa:
  - Regno, livello, dimensioni
  - Banner e minimappa (immagini scaricate localmente)
  - Mostri presenti (con livello e categoria dal lookup)
  - Boss presenti
  - Metin presenti
  - Giacimenti (minerali)
  - NPC presenti (con URL e immagine dal lookup)
  - Zone limitrofe e mappe successive
- **141 mappe** processate, 136 con template valido
- Statistiche: **1480 mostri**, **531 NPC**, **245 metin**, **210 boss**

## 🎨 Caratteristiche tecniche

### Scraper Mappe
- **Parsing del wikitesto** (template `{{Mappe/Layout}}`) invece dell'HTML - molto più affidabile
- **Triangolazione** con i dati già scrapati (mostri.json, npc.json) - evita di dover riaprire ogni pagina
- Coordinate NPC reali estratte dal wiki (es. `(552, 663)`)
- Immagini mappe scaricate automaticamente

### Gioco DLE
- **Frontend HTML/CSS/JS** puro (nessun framework)
- **Design ispirato a Metin2** con colori dorati, marroni e viola
- **3 modalità di gioco** diverse
- **Sistema di punteggio** con feedback visivo
- **Responsive** per mobile e desktop
- Dati caricati dai JSON generati dagli scraper

## 📝 Note

- I valori degli oggetti upgradabili (armi, armature) sono estratti al **+9**
- Le richieste hanno un delay di 0.5 secondi per non sovraccaricare il server
- I dati vengono salvati in formato JSON nella cartella `output/`
- Lo scraper mappe usa il wikitesto (non HTML) per maggiore affidabilità
- La triangolazione con i dati scrapati evita di dover riaprire ogni pagina
- Il gioco DLE usa le immagini reali del wiki per mostri e NPC
- **IMPORTANTE**: Per giocare, usa `python play.py` per avviare il server locale (non aprire direttamente index.html)

## 🔧 Requisiti

```bash
pip install requests beautifulsoup4 lxml
```

## 📄 Licenza

Progetto educativo - Dati estratti da https://it-wiki.metin2.gameforge.com