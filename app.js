// Metin2 DLE - Guess Game
// Carica dati dai JSON e gestisce le 3 modalità di gioco

// Dati globali
let mostriData = [];
let npcData = [];
let mappeData = [];
let armiData = [];
let difesaData = [];   // armature + elmi + scudi
let accessoriData = []; // bracciali + collane + orecchini + scarpe + cinture + guanti

// Stato gioco
let currentMode = 'monster';
let score = 0;
let targetMonster = null;
let currentNPC = null;
let currentMapData = null;
let npcAnswered = false;
let playerClickPos = null;
let attempts = [];
let maxAttempts = 6;

// Target per modalità equipaggiamento
let targetEquip = null;
let equipAttempts = [];

// Inizializzazione
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    startNewGame();
});

// Costruisci URL immagine completo
function getMonsterImage(monster) {
    // Prova prima immagine_card (URL completo)
    if (monster.immagine_card) {
        return monster.immagine_card;
    }
    // Altrimenti costruisci da immagine (nome file)
    if (monster.immagine) {
        // Se è già un URL completo, usalo
        if (monster.immagine.startsWith('http')) {
            return monster.immagine;
        }
        // Altrimenti costruisci il percorso
        return `https://it-wiki.metin2.gameforge.com/images/${monster.immagine}`;
    }
    return '';
}

// Carica tutti i dati JSON
async function loadData() {
    try {
        const [mostri, npc, mappe, armi, armature, elmi, scudi,
            bracciali, collane, orecchini, scarpe, cinture, guanti, metin] = await Promise.all([
                fetch('mostri.json').then(r => r.json()),
                fetch('npc.json').then(r => r.json()),
                fetch('mappe.json').then(r => r.json()),
                fetch('armi.json').then(r => r.json()),
                fetch('armature.json').then(r => r.json()),
                fetch('elmi.json').then(r => r.json()),
                fetch('scudi.json').then(r => r.json()),
                fetch('bracciali.json').then(r => r.json()),
                fetch('collane.json').then(r => r.json()),
                fetch('orecchini.json').then(r => r.json()),
                fetch('scarpe.json').then(r => r.json()),
                fetch('cinture.json').then(r => r.json()),
                fetch('guanti.json').then(r => r.json()),
                fetch('metin.json').then(r => r.json())
            ]);

        // Filtra solo mostri/NPC con immagini
        mostriData = mostri.filter(m => m.immagine_card || m.immagine);
        npcData = npc.filter(n => n.immagine_card || n.immagine);
        mappeData = mappe;

        // Equipaggiamento: filtra solo item con icona
        armiData = armi.filter(a => a.icona);
        difesaData = [
            ...armature.filter(a => a.icona),
            ...elmi.filter(e => e.icona),
            ...scudi.filter(s => s.icona)
        ];
        accessoriData = [
            ...bracciali.filter(b => b.icona),
            ...collane.filter(c => c.icona),
            ...orecchini.filter(o => o.icona),
            ...scarpe.filter(s => s.icona),
            ...cinture.filter(c => c.icona),
            ...guanti.filter(g => g.icona)
        ];

        // Metin: filtra solo con icona
        metinData = metin.filter(m => m.icona);

        console.log(`Caricati: ${mostriData.length} mostri, ${npcData.length} NPC, ${mappeData.length} mappe, ${armiData.length} armi, ${difesaData.length} difesa, ${accessoriData.length} accessori, ${metinData.length} metin`);
    } catch (error) {
        console.error('Errore caricamento dati:', error);
        alert('Impossibile caricare i dati del gioco. Assicurati che i file JSON siano presenti.');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Bottoni modalità
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            switchMode(mode);
        });
    });

    // Submit mostro
    document.getElementById('submit-monster').addEventListener('click', () => {
        checkMonsterGuess();
    });

    document.getElementById('monster-guess').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkMonsterGuess();
    });

    // Autocomplete per la ricerca (modalità mostro)
    const guessInput = document.getElementById('monster-guess');
    guessInput.addEventListener('input', (e) => {
        showSuggestions(e.target.value, 'suggestions', 'monster-guess', checkMonsterGuess);
    });

    guessInput.addEventListener('focus', (e) => {
        if (e.target.value) showSuggestions(e.target.value, 'suggestions', 'monster-guess', checkMonsterGuess);
    });

    // Chiudi suggerimenti quando si clicca fuori
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.guess-input-container')) {
            document.getElementById('suggestions').style.display = 'none';
            document.getElementById('blur-suggestions').style.display = 'none';
        }
    });

    // Submit blur
    document.getElementById('submit-blur').addEventListener('click', () => {
        checkBlurGuess();
    });

    document.getElementById('blur-guess').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkBlurGuess();
    });

    // Autocomplete per modalità blur (stessa funzione)
    const blurInput = document.getElementById('blur-guess');
    blurInput.addEventListener('input', (e) => {
        showSuggestions(e.target.value, 'blur-suggestions', 'blur-guess', checkBlurGuess);
    });

    blurInput.addEventListener('focus', (e) => {
        if (e.target.value) showSuggestions(e.target.value, 'blur-suggestions', 'blur-guess', checkBlurGuess);
    });

    // Click sulla mappa
    document.getElementById('map-image').addEventListener('click', (e) => {
        handleMapClick(e);
    });

    // Pulsanti modalità NPC
    document.getElementById('confirm-npc').addEventListener('click', () => {
        confirmNPCGuess();
    });

    document.getElementById('next-npc').addEventListener('click', () => {
        startNPCMode();
    });

    // === Modalità equipaggiamento (arma, difesa, accessori) ===
    const equipModes = [
        { mode: 'arma', data: armiData },
        { mode: 'difesa', data: difesaData },
        { mode: 'accessori', data: accessoriData }
    ];

    equipModes.forEach(({ mode, data }) => {
        const submitBtn = document.getElementById(`submit-${mode}`);
        const input = document.getElementById(`${mode}-guess`);

        submitBtn.addEventListener('click', () => {
            checkEquipGuess(mode, data);
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkEquipGuess(mode, data);
        });

        input.addEventListener('input', (e) => {
            showEquipSuggestions(e.target.value, `${mode}-suggestions`, `${mode}-guess`, () => checkEquipGuess(mode, data), data);
        });

        input.addEventListener('focus', (e) => {
            if (e.target.value) showEquipSuggestions(e.target.value, `${mode}-suggestions`, `${mode}-guess`, () => checkEquipGuess(mode, data), data);
        });
    });

    // Chiudi suggerimenti equipaggiamento quando si clicca fuori
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.guess-input-container')) {
            ['arma-suggestions', 'difesa-suggestions', 'accessori-suggestions'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }
    });

    // === Modalità Metin ===
    // Submit metin
    document.getElementById('submit-metin').addEventListener('click', () => {
        checkMetinGuess();
    });

    document.getElementById('metin-guess').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkMetinGuess();
    });

    // Autocomplete per metin
    const metinInput = document.getElementById('metin-guess');
    metinInput.addEventListener('input', (e) => {
        showMetinSuggestions(e.target.value, 'metin-suggestions', 'metin-guess', checkMetinGuess, metinData);
    });

    metinInput.addEventListener('focus', (e) => {
        if (e.target.value) showMetinSuggestions(e.target.value, 'metin-suggestions', 'metin-guess', checkMetinGuess, metinData);
    });

    // Submit blur metin
    document.getElementById('submit-blur-metin').addEventListener('click', () => {
        checkBlurMetinGuess();
    });

    document.getElementById('blur-metin-guess').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkBlurMetinGuess();
    });

    // Autocomplete per blur metin
    const blurMetinInput = document.getElementById('blur-metin-guess');
    blurMetinInput.addEventListener('input', (e) => {
        showMetinSuggestions(e.target.value, 'blur-metin-suggestions', 'blur-metin-guess', checkBlurMetinGuess, metinData);
    });

    blurMetinInput.addEventListener('focus', (e) => {
        if (e.target.value) showMetinSuggestions(e.target.value, 'blur-metin-suggestions', 'blur-metin-guess', checkBlurMetinGuess, metinData);
    });

    // Chiudi suggerimenti metin quando si clicca fuori
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.guess-input-container')) {
            ['metin-suggestions', 'blur-metin-suggestions'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }
    });
}

// Mostra suggerimenti con immagini e dati (funzione unica per mostro e blur)
function showSuggestions(query, suggestionsId, inputId, callback) {
    const suggestionsDiv = document.getElementById(suggestionsId);
    if (!query || query.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    const queryLower = query.toLowerCase();
    const matches = mostriData.filter(m =>
        m.nome.toLowerCase().includes(queryLower)
    ).slice(0, 8); // Mostra max 8 suggerimenti

    if (matches.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    suggestionsDiv.innerHTML = matches.map(m => {
        const imgSrc = getMonsterImage(m);
        const level = m.livello || m.livello_card || '-';
        const category = m.categoria || '-';
        const rank = m.rank_card || '-';

        return `
        <div class="suggestion-item" data-name="${m.nome}">
            <img src="${imgSrc}" alt="${m.nome}" class="suggestion-img">
            <div class="suggestion-info">
                <span class="suggestion-name">${m.nome}</span>
                <span class="suggestion-details">LIV ${level} · ${category} · RANK ${rank}</span>
            </div>
        </div>
    `;
    }).join('');

    suggestionsDiv.style.display = 'block';

    // Click su suggerimento
    suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById(inputId).value = item.dataset.name;
            suggestionsDiv.style.display = 'none';
            callback();
        });
    });
}

// Cambia modalità
function switchMode(mode) {
    currentMode = mode;

    // Aggiorna bottoni
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Aggiorna sezioni
    document.querySelectorAll('.game-mode').forEach(section => {
        section.classList.toggle('active', section.id === `${mode}-mode`);
    });

    startNewGame();
}

// Inizia nuova partita
function startNewGame() {
    if (currentMode === 'monster') {
        startMonsterMode();
    } else if (currentMode === 'npc') {
        startNPCMode();
    } else if (currentMode === 'blur') {
        startBlurMode();
    } else if (currentMode === 'arma') {
        startEquipMode('arma', armiData);
    } else if (currentMode === 'difesa') {
        startEquipMode('difesa', difesaData);
    } else if (currentMode === 'accessori') {
        startEquipMode('accessori', accessoriData);
    } else if (currentMode === 'metin') {
        startMetinMode();
    } else if (currentMode === 'blur-metin') {
        startBlurMetinMode();
    }
}

// ==================== MODALITÀ 1: INDOVINA IL MOSTRO (Wordle Style) ====================

function startMonsterMode() {
    // Scegli mostro segreto
    targetMonster = mostriData[Math.floor(Math.random() * mostriData.length)];
    attempts = [];

    // Reset UI
    document.getElementById('monster-guess').value = '';
    document.getElementById('monster-feedback').innerHTML = '';
    document.getElementById('attempts-grid').innerHTML = '';

    console.log('Mostro segreto:', targetMonster.nome); // Per debug
}

function checkMonsterGuess() {
    const guess = document.getElementById('monster-guess').value.trim();
    if (!guess) return;

    // Cerca il mostro nel database
    const guessedMonster = mostriData.find(m =>
        m.nome.toLowerCase() === guess.toLowerCase()
    );

    if (!guessedMonster) {
        alert('Mostro non trovato nel database!');
        return;
    }

    // Controlla se corretto
    const isCorrect = guessedMonster.nome === targetMonster.nome;

    // Confronta attributi
    const comparison = compareMonsters(targetMonster, guessedMonster);

    // Aggiungi tentativo
    attempts.push({
        guess: guessedMonster,
        comparison: comparison,
        isCorrect: isCorrect
    });

    // Mostra tentativo nella griglia
    addAttemptToGrid(guessedMonster, comparison, isCorrect);

    // Mostra feedback
    if (isCorrect) {
        score += 10;
        updateScore();
        document.getElementById('monster-feedback').innerHTML =
            '<div class="attempt correct">✅ Corretto! Era ' + targetMonster.nome + '! +10 punti</div>';
        setTimeout(startMonsterMode, 3000);
    } else {
        document.getElementById('monster-feedback').innerHTML =
            '<div class="attempt wrong">❌ Sbagliato! Prova ancora</div>';
    }

    // Reset input
    document.getElementById('monster-guess').value = '';
    document.getElementById('suggestions').style.display = 'none';
}

function addAttemptToGrid(monster, comparison, isCorrect) {
    const grid = document.getElementById('attempts-grid');

    const attemptDiv = document.createElement('div');
    attemptDiv.className = `attempt-row ${isCorrect ? 'correct' : 'wrong'}`;

    // Ottieni URL immagine completo
    const monsterImg = getMonsterImage(monster);

    // Crea i quadrati per ogni attributo
    const squares = [
        { type: 'image', value: monsterImg, label: '', isImage: true },
        { type: 'name', value: monster.nome, label: '' },
        { type: 'level', value: getLevelArrow(targetMonster, monster), label: 'LIV' },
        { type: 'category', value: monster.categoria || '-', label: 'CAT' },
        { type: 'rank', value: getRankArrow(targetMonster, monster), label: 'RANK' },
        { type: 'boss', value: monster.boss ? '✓' : '✗', label: 'BOSS' },
        { type: 'exp', value: getExpArrow(targetMonster, monster), label: 'EXP' },
        { type: 'stun', value: monster.stordimento ? '✓' : '✗', label: 'STUN' },
        { type: 'slow', value: monster.rallentamento ? '✓' : '✗', label: 'SLOW' },
        { type: 'fear', value: monster.paura ? '✓' : '✗', label: 'FEAR' },
        { type: 'aggro', value: monster.aggressivo ? '✓' : '✗', label: 'AGGR' },
    ];

    squares.forEach(sq => {
        const square = document.createElement('div');
        square.className = `attr-square ${sq.type}`;

        // Applica colore in base al confronto
        if (comparison[sq.type]) {
            square.classList.add(comparison[sq.type]);
        }

        const label = document.createElement('div');
        label.className = 'square-label';
        label.textContent = sq.label;

        const value = document.createElement('div');
        value.className = 'square-value';

        if (sq.isImage) {
            const img = document.createElement('img');
            img.src = sq.value;
            img.alt = monster.nome;
            value.appendChild(img);
        } else {
            value.textContent = sq.value;
        }

        square.appendChild(label);
        square.appendChild(value);
        attemptDiv.appendChild(square);
    });

    grid.appendChild(attemptDiv);
}

function getLevelArrow(target, guess) {
    const targetLevel = target.livello || target.livello_card || 0;
    const guessLevel = guess.livello || guess.livello_card || 0;
    if (!targetLevel || !guessLevel) return '-';
    if (guessLevel === targetLevel) return `${guessLevel} ✓`;
    if (guessLevel < targetLevel) return `${guessLevel} ↑`;  // target è più alto
    return `${guessLevel} ↓`;  // target è più basso
}

function getRankArrow(target, guess) {
    const targetRank = target.rank_card || 0;
    const guessRank = guess.rank_card || 0;
    if (!targetRank || !guessRank) return '-';
    if (guessRank === targetRank) return `${guessRank} ✓`;
    if (guessRank < targetRank) return `${guessRank} ↑`;  // target è più alto
    return `${guessRank} ↓`;  // target è più basso
}

function getExpArrow(target, guess) {
    const targetExp = target.esperienza || 0;
    const guessExp = guess.esperienza || 0;
    if (!targetExp || !guessExp) return '-';
    if (guessExp === targetExp) return `${guessExp} ✓`;
    if (guessExp < targetExp) return `${guessExp} ↑`;  // target è più alto
    return `${guessExp} ↓`;  // target è più basso
}

function compareMonsters(target, guess) {
    // Restituisce un oggetto con i colori per ogni attributo
    const result = {
        level: getColor(target.livello || target.livello_card || 0, guess.livello || guess.livello_card || 0, 5),
        category: target.categoria === guess.categoria ? 'correct' : 'wrong',
        rank: getColor(target.rank_card || 0, guess.rank_card || 0, 2),
        boss: target.boss === guess.boss ? 'correct' : 'wrong',
        exp: getColor(target.esperienza || 0, guess.esperienza || 0, 20),
        stun: target.stordimento === guess.stordimento ? 'correct' : 'wrong',
        slow: target.rallentamento === guess.rallentamento ? 'correct' : 'wrong',
        fear: target.paura === guess.paura ? 'correct' : 'wrong',
        aggro: target.aggressivo === guess.aggressivo ? 'correct' : 'wrong',
    };
    return result;
}

function getColor(targetVal, guessVal, tolerance) {
    if (!targetVal || !guessVal) return 'wrong';
    const diff = guessVal - targetVal;
    if (diff === 0) return 'correct';
    if (Math.abs(diff) <= tolerance) return 'partial';
    return 'wrong';
}

// ==================== MODALITÀ 2: TROVA L'NPC SULLA MAPPA ====================

// Helper: parse map dimensions from string like "1024x768"
function parseMapDimensions(dimStr) {
    if (!dimStr) return { width: 1024, height: 1024 };
    const parts = dimStr.toLowerCase().split('x');
    const w = parseInt(parts[0]);
    const h = parseInt(parts[1]);
    return {
        width: isNaN(w) ? 1024 : w,
        height: isNaN(h) ? 1024 : h
    };
}

// Helper: find NPC in npcData by name (case-insensitive)
function findNpcByName(name) {
    return npcData.find(n => n.nome.toLowerCase() === name.toLowerCase());
}

// Helper: get valid NPC+position pairs for a map (cross-reference mappe.json with npc.json)
// Also computes the coordinate space bounds (maxX, maxY) from all NPC positions
function getValidNpcPositionsForMap(mapData) {
    if (!mapData.npc || mapData.npc.length === 0) return { positions: [], maxX: 0, maxY: 0 };
    const result = [];
    let maxX = 0;
    let maxY = 0;
    for (const mapNpc of mapData.npc) {
        const fullNpc = findNpcByName(mapNpc.nome);
        if (!fullNpc || !fullNpc.posizioni) continue;
        const pos = fullNpc.posizioni[mapData.nome];
        if (!pos) continue;
        const x = parseInt(pos.x);
        const y = parseInt(pos.y);
        if (isNaN(x) || isNaN(y)) continue;
        result.push({
            npc: fullNpc,
            mapNpc: mapNpc,
            x: x,
            y: y
        });
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    // Ensure minimum bounds to avoid extreme scaling with few NPCs
    maxX = Math.max(maxX, 512);
    maxY = Math.max(maxY, 512);
    return { positions: result, maxX: maxX, maxY: maxY };
}

function startNPCMode() {
    // Reset state
    npcAnswered = false;
    playerClickPos = null;
    currentMapData = null;

    // Filtra mappe con minimappa e almeno un NPC con posizione valida
    const mappeValide = mappeData.filter(m => {
        if (!m.minimappa_url && !m.minimappa_locale) return false;
        if (!m.npc || m.npc.length === 0) return false;
        return getValidNpcPositionsForMap(m).positions.length > 0;
    });

    if (mappeValide.length === 0) {
        alert('Nessuna mappa con NPC e coordinate disponibili. Torna alla modalità Indovina il Mostro.');
        switchMode('monster');
        return;
    }

    // Scegli mappa casuale
    const mapData = mappeValide[Math.floor(Math.random() * mappeValide.length)];
    currentMapData = mapData;

    // Scegli NPC casuale con posizione valida
    const npcData = getValidNpcPositionsForMap(mapData);
    const chosen = npcData.positions[Math.floor(Math.random() * npcData.positions.length)];
    currentNPC = chosen.npc;

    // Salva coordinate NPC target (in game coordinate space)
    const npcX = chosen.x;
    const npcY = chosen.y;

    // Mostra immagine NPC
    const img = document.getElementById('npc-image');
    const npcImg = currentNPC.immagine_card || currentNPC.immagine || '';
    img.src = npcImg;
    img.alt = currentNPC.nome;

    document.getElementById('npc-name').textContent = currentNPC.nome;
    document.getElementById('npc-distance').textContent = 'Clicca sulla mappa dove si trova questo NPC';

    // Mostra mappa
    const mapImg = document.getElementById('map-image');
    const mapSrc = mapData.minimappa_url || mapData.minimappa_locale || '';
    mapImg.src = mapSrc;
    mapImg.dataset.mapName = mapData.nome;
    mapImg.dataset.npcX = String(npcX);
    mapImg.dataset.npcY = String(npcY);

    // Salva bounds dello spazio coordinate (ricavato dalle posizioni reali degli NPC)
    // Le coordinate di gioco possono superare le "dimensioni" dichiarate della mappa,
    // quindi usiamo i limiti reali osservati dalle posizioni degli NPC
    mapImg.dataset.coordMaxX = String(npcData.maxX);
    mapImg.dataset.coordMaxY = String(npcData.maxY);

    // Nascondi marker e linea
    document.getElementById('map-marker').style.display = 'none';
    document.getElementById('npc-marker').style.display = 'none';
    document.getElementById('map-line').style.display = 'none';

    // Reset pulsanti
    document.getElementById('confirm-npc').disabled = true;
    document.getElementById('confirm-npc').style.display = 'inline-block';
    document.getElementById('next-npc').style.display = 'none';

    // Reset feedback
    document.getElementById('npc-feedback').innerHTML = '';

    // Assicurati che la mappa sia cliccabile
    mapImg.style.pointerEvents = 'auto';
    mapImg.style.cursor = 'crosshair';
}

function handleMapClick(e) {
    if (npcAnswered) return;

    const mapImg = document.getElementById('map-image');

    // Verifica coordinate NPC valide
    const npcX = parseInt(mapImg.dataset.npcX);
    const npcY = parseInt(mapImg.dataset.npcY);

    if (isNaN(npcX) || isNaN(npcY)) {
        alert('Coordinate NPC non disponibili. Riprova.');
        return;
    }

    e.preventDefault();

    // Calcola posizione click (in pixel display)
    const rect = mapImg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Verifica che il click sia dentro l'immagine
    if (clickX < 0 || clickY < 0 || clickX > rect.width || clickY > rect.height) {
        return;
    }

    // Salva posizione click (display coordinates)
    playerClickPos = { x: clickX, y: clickY };

    // Mostra marker giocatore
    const marker = document.getElementById('map-marker');
    marker.style.left = `${clickX}px`;
    marker.style.top = `${clickY}px`;
    marker.style.display = 'block';

    // Abilita pulsante conferma
    document.getElementById('confirm-npc').disabled = false;

    // Aggiorna testo
    document.getElementById('npc-distance').textContent = 'Posizione selezionata. Clicca "Conferma" per verificare.';
}

function confirmNPCGuess() {
    if (npcAnswered || !playerClickPos) return;

    const mapImg = document.getElementById('map-image');
    const npcX = parseInt(mapImg.dataset.npcX);
    const npcY = parseInt(mapImg.dataset.npcY);
    const coordMaxX = parseInt(mapImg.dataset.coordMaxX);
    const coordMaxY = parseInt(mapImg.dataset.coordMaxY);

    // Posizione click in display coordinates
    const clickX = playerClickPos.x;
    const clickY = playerClickPos.y;

    // Dimensioni display dell'immagine
    const rect = mapImg.getBoundingClientRect();

    // Mappa: game coordinate space [0..coordMaxX] x [0..coordMaxY] → display [0..rect.width] x [0..rect.height]
    // Scala: display → game
    const scaleX = coordMaxX / rect.width;
    const scaleY = coordMaxY / rect.height;

    // Converti click da display a game coordinates
    const clickGameX = clickX * scaleX;
    const clickGameY = clickY * scaleY;

    // Calcola distanza in game coordinates
    const distance = Math.sqrt(
        Math.pow(clickGameX - npcX, 2) +
        Math.pow(clickGameY - npcY, 2)
    );

    // Converti posizione NPC da game a display coordinates (per marker)
    const npcDisplayX = npcX / scaleX;
    const npcDisplayY = npcY / scaleY;

    // Mostra marker NPC reale
    const npcMarker = document.getElementById('npc-marker');
    npcMarker.style.left = `${npcDisplayX}px`;
    npcMarker.style.top = `${npcDisplayY}px`;
    npcMarker.style.display = 'block';

    // Disegna linea tra click e NPC
    const lineSvg = document.getElementById('map-line');
    const lineElement = document.getElementById('map-line-element');
    lineElement.setAttribute('x1', clickX);
    lineElement.setAttribute('y1', clickY);
    lineElement.setAttribute('x2', npcDisplayX);
    lineElement.setAttribute('y2', npcDisplayY);
    lineSvg.style.display = 'block';

    // Calcola punteggio basato sulla distanza percentuale
    // Usa la diagonale dello spazio coordinate come riferimento
    const diag = Math.sqrt(coordMaxX * coordMaxX + coordMaxY * coordMaxY);
    const distancePercent = (distance / diag) * 100;

    let points = 0;
    let feedbackMsg = '';
    let feedbackClass = '';

    if (distancePercent < 3) {
        points = 100;
        feedbackMsg = `🎯 Perfetto! Distanza: ${Math.round(distance)} px | +${points} punti`;
        feedbackClass = 'correct';
    } else if (distancePercent < 7) {
        points = 75;
        feedbackMsg = `👌 Molto bene! Distanza: ${Math.round(distance)} px | +${points} punti`;
        feedbackClass = 'correct';
    } else if (distancePercent < 15) {
        points = 50;
        feedbackMsg = `👍 Buono! Distanza: ${Math.round(distance)} px | +${points} punti`;
        feedbackClass = 'correct';
    } else if (distancePercent < 30) {
        points = 25;
        feedbackMsg = `🤔 Non male. Distanza: ${Math.round(distance)} px | +${points} punti`;
        feedbackClass = 'wrong';
    } else {
        points = 0;
        feedbackMsg = `😢 Troppo lontano! Distanza: ${Math.round(distance)} px | +${points} punti`;
        feedbackClass = 'wrong';
    }

    score += points;
    updateScore();

    // Mostra feedback
    document.getElementById('npc-feedback').innerHTML =
        `<div class="attempt ${feedbackClass}">${feedbackMsg}</div>`;
    document.getElementById('npc-distance').textContent =
        `Distanza: ${Math.round(distance)} px (${distancePercent.toFixed(1)}% della mappa)`;

    // Cambia pulsanti: nascondi Conferma, mostra Prossimo
    document.getElementById('confirm-npc').style.display = 'none';
    document.getElementById('next-npc').style.display = 'inline-block';

    // Blocca ulteriori click sulla mappa
    npcAnswered = true;
    mapImg.style.cursor = 'default';
}

// ==================== MODALITÀ 3: MOSTRO SFOCATO ====================

let currentBlurLevel = 20;
const initialBlur = 20;
const blurDecrement = 3; // Riduce di 3px per ogni errore

function startBlurMode() {
    const randomMonster = mostriData[Math.floor(Math.random() * mostriData.length)];

    const img = document.getElementById('blur-image');
    img.src = randomMonster.immagine_card || randomMonster.immagine;
    img.alt = randomMonster.nome;

    // Reset blur level
    currentBlurLevel = initialBlur;
    img.style.filter = `blur(${currentBlurLevel}px)`;

    document.getElementById('blur-guess').value = '';
    document.getElementById('blur-feedback').innerHTML = '';
}

function checkBlurGuess() {
    const guess = document.getElementById('blur-guess').value.trim();
    if (!guess) return;

    const img = document.getElementById('blur-image');
    const targetName = img.alt;
    const isCorrect = guess.toLowerCase() === targetName.toLowerCase();

    const feedback = document.getElementById('blur-feedback');
    if (isCorrect) {
        const points = Math.max(1, 15 - Math.floor(currentBlurLevel / 2));
        score += points;
        updateScore();
        // Rimuovi il blur per mostrare il mostro
        img.style.filter = 'none';
        feedback.innerHTML = `<div class="attempt correct">✅ Corretto! Era ${targetName}! +${points} punti</div>`;
        setTimeout(startBlurMode, 2000);
    } else {
        // Riduci sfocatura
        currentBlurLevel = Math.max(0, currentBlurLevel - blurDecrement);
        img.style.filter = `blur(${currentBlurLevel}px)`;

        feedback.innerHTML = `<div class="attempt wrong">❌ Sbagliato! Sfocatura ridotta a ${currentBlurLevel}px</div>`;
    }

    document.getElementById('blur-guess').value = '';
}

// ==================== MODALITÀ 4,5,6: EQUIPAGGIAMENTO (Wordle Style) ====================

function startEquipMode(mode, data) {
    if (!data || data.length === 0) {
        alert(`Nessun dato disponibile per ${mode}. Riprova più tardi.`);
        return;
    }

    targetEquip = data[Math.floor(Math.random() * data.length)];
    equipAttempts = [];

    // Reset UI
    const grid = document.getElementById(`${mode}-attempts-grid`);
    const input = document.getElementById(`${mode}-guess`);
    const feedback = document.getElementById(`${mode}-feedback`);

    grid.innerHTML = '';
    input.value = '';
    feedback.innerHTML = '';

    console.log(`[${mode}] Target:`, targetEquip.nome);
}

function checkEquipGuess(mode, data) {
    const input = document.getElementById(`${mode}-guess`);
    const guess = input.value.trim();
    if (!guess) return;

    const guessedItem = data.find(item =>
        item.nome.toLowerCase() === guess.toLowerCase()
    );

    if (!guessedItem) {
        alert('Oggetto non trovato nel database!');
        return;
    }

    const isCorrect = guessedItem.nome === targetEquip.nome;
    const comparison = compareEquip(targetEquip, guessedItem);

    equipAttempts.push({ guess: guessedItem, comparison, isCorrect });

    addEquipAttemptToGrid(mode, guessedItem, comparison, isCorrect);

    const feedback = document.getElementById(`${mode}-feedback`);
    if (isCorrect) {
        const points = 10;
        score += points;
        updateScore();
        feedback.innerHTML = `<div class="attempt correct">✅ Corretto! Era ${targetEquip.nome}! +${points} punti</div>`;
        setTimeout(() => startEquipMode(mode, data), 3000);
    } else {
        feedback.innerHTML = `<div class="attempt wrong">❌ Sbagliato! Prova ancora</div>`;
    }

    input.value = '';
    document.getElementById(`${mode}-suggestions`).style.display = 'none';
}

function addEquipAttemptToGrid(mode, item, comparison, isCorrect) {
    const grid = document.getElementById(`${mode}-attempts-grid`);

    const attemptDiv = document.createElement('div');
    attemptDiv.className = `attempt-row ${isCorrect ? 'correct' : 'wrong'}`;

    const imgSrc = item.icona || '';

    const squares = [
        { type: 'image', value: imgSrc, label: '', isImage: true },
        { type: 'name', value: item.nome, label: '' },
        { type: 'level', value: getEquipLevelArrow(targetEquip, item), label: 'LIV' },
        { type: 'category', value: item.categoria || '-', label: 'CAT' },
        { type: 'type', value: item.tipo || '-', label: 'TIPO' },
        { type: 'attack', value: getEquipValueArrow(targetEquip, item, 'attacco'), label: 'ATK' },
        { type: 'magic_attack', value: getEquipValueArrow(targetEquip, item, 'attacco_magico'), label: 'MATK' },
        { type: 'defense', value: getEquipValueArrow(targetEquip, item, 'difesa'), label: 'DEF' },
        { type: 'magic_defense', value: getEquipValueArrow(targetEquip, item, 'difesa_magica'), label: 'MDEF' },
        { type: 'speed', value: getEquipValueArrow(targetEquip, item, 'velocita_attacco', 'velocita_movimento'), label: 'SPD' },
        { type: 'slots', value: item.slot !== undefined ? `${item.slot} ✓` : '-', label: 'SLOT' },
    ];

    squares.forEach(sq => {
        const square = document.createElement('div');
        square.className = `attr-square ${sq.type}`;

        if (comparison[sq.type]) {
            square.classList.add(comparison[sq.type]);
        }

        const label = document.createElement('div');
        label.className = 'square-label';
        label.textContent = sq.label;

        const value = document.createElement('div');
        value.className = 'square-value';

        if (sq.isImage) {
            if (sq.value) {
                const img = document.createElement('img');
                img.src = sq.value;
                img.alt = item.nome;
                value.appendChild(img);
            } else {
                value.textContent = '-';
            }
        } else {
            value.textContent = sq.value;
        }

        square.appendChild(label);
        square.appendChild(value);
        attemptDiv.appendChild(square);
    });

    grid.appendChild(attemptDiv);
}

function getEquipLevelArrow(target, guess) {
    const tLv = target.livello || 0;
    const gLv = guess.livello || 0;
    if (!tLv || !gLv) return '-';
    if (gLv === tLv) return `${gLv} ✓`;
    if (gLv < tLv) return `${gLv} ↑`;
    return `${gLv} ↓`;
}

function getEquipValueArrow(target, guess, ...fields) {
    const tVal = parseEquipValue(target, fields);
    const gVal = parseEquipValue(guess, fields);
    if (!tVal && !gVal) return '-';
    if (tVal === gVal) return `${gVal} ✓`;
    if (gVal < tVal) return `${gVal} ↑`;
    return `${gVal} ↓`;
}

function parseEquipValue(item, fields) {
    for (const f of fields) {
        if (item[f]) {
            const val = parseFloat(item[f].toString().replace(/[^\d.-]/g, ''));
            if (!isNaN(val)) return val;
        }
    }
    return null;
}

function compareEquip(target, guess) {
    const result = {
        level: getEquipColor(target.livello || 0, guess.livello || 0, 5),
        category: target.categoria === guess.categoria ? 'correct' : 'wrong',
        type: target.tipo === guess.tipo ? 'correct' : 'wrong',
        attack: getEquipColor(parseEquipValue(target, ['attacco']), parseEquipValue(guess, ['attacco']), 10),
        magic_attack: getEquipColor(parseEquipValue(target, ['attacco_magico']), parseEquipValue(guess, ['attacco_magico']), 10),
        defense: getEquipColor(parseEquipValue(target, ['difesa']), parseEquipValue(guess, ['difesa']), 10),
        magic_defense: getEquipColor(parseEquipValue(target, ['difesa_magica']), parseEquipValue(guess, ['difesa_magica']), 10),
        speed: getEquipColor(parseEquipValue(target, ['velocita_attacco', 'velocita_movimento']), parseEquipValue(guess, ['velocita_attacco', 'velocita_movimento']), 5),
        slots: target.slot === guess.slot ? 'correct' : 'wrong',
    };
    return result;
}

function getEquipColor(targetVal, guessVal, tolerance) {
    if (!targetVal && !guessVal) return 'wrong';
    if (targetVal === guessVal) return 'correct';
    if (Math.abs((guessVal || 0) - (targetVal || 0)) <= tolerance) return 'partial';
    return 'wrong';
}

// Suggerimenti per modalità equipaggiamento
function showEquipSuggestions(query, suggestionsId, inputId, callback, data) {
    const suggestionsDiv = document.getElementById(suggestionsId);
    if (!query || query.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    const queryLower = query.toLowerCase();
    const matches = data.filter(item =>
        item.nome.toLowerCase().includes(queryLower)
    ).slice(0, 8);

    if (matches.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    suggestionsDiv.innerHTML = matches.map(item => {
        const level = item.livello || '-';
        const type = item.tipo || '-';
        const category = item.categoria || '-';

        return `
        <div class="suggestion-item" data-name="${item.nome}">
            <img src="${item.icona || ''}" alt="${item.nome}" class="suggestion-img">
            <div class="suggestion-info">
                <span class="suggestion-name">${item.nome}</span>
                <span class="suggestion-details">LIV ${level} · ${type} · ${category}</span>
            </div>
        </div>
    `;
    }).join('');

    suggestionsDiv.style.display = 'block';

    suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById(inputId).value = item.dataset.name;
            suggestionsDiv.style.display = 'none';
            callback();
        });
    });
}

// ==================== MODALITÀ 7,8: METIN ====================

let metinData = [];
let targetMetin = null;
let metinAttempts = [];

function startMetinMode() {
    if (!metinData || metinData.length === 0) {
        alert('Nessun dato Metin disponibile. Riprova più tardi.');
        return;
    }

    targetMetin = metinData[Math.floor(Math.random() * metinData.length)];
    metinAttempts = [];

    const grid = document.getElementById('metin-attempts-grid');
    const input = document.getElementById('metin-guess');
    const feedback = document.getElementById('metin-feedback');

    grid.innerHTML = '';
    input.value = '';
    feedback.innerHTML = '';

    console.log('[Metin] Target:', targetMetin.nome);
}

function checkMetinGuess() {
    const guess = document.getElementById('metin-guess').value.trim();
    if (!guess) return;

    const guessedMetin = metinData.find(m =>
        m.nome.toLowerCase() === guess.toLowerCase()
    );

    if (!guessedMetin) {
        alert('Metin non trovato nel database!');
        return;
    }

    const isCorrect = guessedMetin.nome === targetMetin.nome;
    const comparison = compareMetin(targetMetin, guessedMetin);

    metinAttempts.push({ guess: guessedMetin, comparison, isCorrect });

    addMetinAttemptToGrid(guessedMetin, comparison, isCorrect);

    const feedback = document.getElementById('metin-feedback');
    if (isCorrect) {
        const points = 10;
        score += points;
        updateScore();
        feedback.innerHTML = `<div class="attempt correct">✅ Corretto! Era ${targetMetin.nome}! +${points} punti</div>`;
        setTimeout(startMetinMode, 3000);
    } else {
        feedback.innerHTML = `<div class="attempt wrong">❌ Sbagliato! Prova ancora</div>`;
    }

    document.getElementById('metin-guess').value = '';
    document.getElementById('metin-suggestions').style.display = 'none';
}

function addMetinAttemptToGrid(metin, comparison, isCorrect) {
    const grid = document.getElementById('metin-attempts-grid');

    const attemptDiv = document.createElement('div');
    attemptDiv.className = `attempt-row ${isCorrect ? 'correct' : 'wrong'}`;

    const imgSrc = metin.icona || '';

    const squares = [
        { type: 'image', value: imgSrc, label: '', isImage: true },
        { type: 'name', value: metin.nome, label: '' },
        { type: 'category', value: metin.categoria || '-', label: 'CAT' },
        { type: 'level', value: getMetinLevelArrow(targetMetin, metin), label: 'LIV' },
        { type: 'hp', value: getMetinValueArrow(targetMetin, metin, 'hp'), label: 'HP' },
    ];

    squares.forEach(sq => {
        const square = document.createElement('div');
        square.className = `attr-square ${sq.type}`;

        if (comparison[sq.type]) {
            square.classList.add(comparison[sq.type]);
        }

        const label = document.createElement('div');
        label.className = 'square-label';
        label.textContent = sq.label;

        const value = document.createElement('div');
        value.className = 'square-value';

        if (sq.isImage) {
            if (sq.value) {
                const img = document.createElement('img');
                img.src = sq.value;
                img.alt = metin.nome;
                value.appendChild(img);
            } else {
                value.textContent = '-';
            }
        } else {
            value.textContent = sq.value;
        }

        square.appendChild(label);
        square.appendChild(value);
        attemptDiv.appendChild(square);
    });

    grid.appendChild(attemptDiv);
}

function getMetinLevelArrow(target, guess) {
    const tLv = target.livello || 0;
    const gLv = guess.livello || 0;
    if (!tLv || !gLv) return '-';
    if (gLv === tLv) return `${gLv} ✓`;
    if (gLv < tLv) return `${gLv} ↑`;
    return `${gLv} ↓`;
}

function getMetinValueArrow(target, guess, field) {
    const tVal = target[field] || 0;
    const gVal = guess[field] || 0;
    if (!tVal && !gVal) return '-';
    if (gVal === tVal) return `${gVal} ✓`;
    if (gVal < tVal) return `${gVal} ↑`;
    return `${gVal} ↓`;
}

function compareMetin(target, guess) {
    const result = {
        category: target.categoria === guess.categoria ? 'correct' : 'wrong',
        level: getEquipColor(target.livello || 0, guess.livello || 0, 5),
        hp: getEquipColor(parseInt(target.hp) || 0, parseInt(guess.hp) || 0, 100),
    };
    return result;
}

// Metin Sfocato
let currentBlurMetinLevel = 20;
const initialBlurMetin = 20;
const blurMetinDecrement = 3;

function startBlurMetinMode() {
    if (!metinData || metinData.length === 0) {
        alert('Nessun dato Metin disponibile. Riprova più tardi.');
        return;
    }

    const randomMetin = metinData[Math.floor(Math.random() * metinData.length)];

    const img = document.getElementById('blur-metin-image');
    img.src = randomMetin.icona || randomMetin.url || '';
    img.alt = randomMetin.nome;

    currentBlurMetinLevel = initialBlurMetin;
    img.style.filter = `blur(${currentBlurMetinLevel}px)`;

    document.getElementById('blur-metin-guess').value = '';
    document.getElementById('blur-metin-feedback').innerHTML = '';
}

function checkBlurMetinGuess() {
    const guess = document.getElementById('blur-metin-guess').value.trim();
    if (!guess) return;

    const img = document.getElementById('blur-metin-image');
    const targetName = img.alt;
    const isCorrect = guess.toLowerCase() === targetName.toLowerCase();

    const feedback = document.getElementById('blur-metin-feedback');
    if (isCorrect) {
        const points = Math.max(1, 15 - Math.floor(currentBlurMetinLevel / 2));
        score += points;
        updateScore();
        img.style.filter = 'none';
        feedback.innerHTML = `<div class="attempt correct">✅ Corretto! Era ${targetName}! +${points} punti</div>`;
        setTimeout(startBlurMetinMode, 2000);
    } else {
        currentBlurMetinLevel = Math.max(0, currentBlurMetinLevel - blurMetinDecrement);
        img.style.filter = `blur(${currentBlurMetinLevel}px)`;
        feedback.innerHTML = `<div class="attempt wrong">❌ Sbagliato! Sfocatura ridotta a ${currentBlurMetinLevel}px</div>`;
    }

    document.getElementById('blur-metin-guess').value = '';
}

// Suggerimenti per Metin
function showMetinSuggestions(query, suggestionsId, inputId, callback, data) {
    const suggestionsDiv = document.getElementById(suggestionsId);
    if (!query || query.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    const queryLower = query.toLowerCase();
    const matches = data.filter(item =>
        item.nome.toLowerCase().includes(queryLower)
    ).slice(0, 8);

    if (matches.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    suggestionsDiv.innerHTML = matches.map(item => {
        const level = item.livello || '-';
        const category = item.categoria || '-';

        return `
        <div class="suggestion-item" data-name="${item.nome}">
            <img src="${item.icona || ''}" alt="${item.nome}" class="suggestion-img">
            <div class="suggestion-info">
                <span class="suggestion-name">${item.nome}</span>
                <span class="suggestion-details">LIV ${level} · ${category}</span>
            </div>
        </div>
    `;
    }).join('');

    suggestionsDiv.style.display = 'block';

    suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById(inputId).value = item.dataset.name;
            suggestionsDiv.style.display = 'none';
            callback();
        });
    });
}

// Aggiorna punteggio
function updateScore() {
    document.getElementById('score').textContent = `Punteggio: ${score}`;
}
