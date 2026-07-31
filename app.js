// Metin2 DLE - Guess Game
// Carica dati dai JSON e gestisce le 3 modalità di gioco

// Dati globali
let mostriData = [];
let npcData = [];
let mappeData = [];
let armiData = [];
let difesaData = [];
let accessoriData = [];
let upgradeMaterialsData = {};
let allEquipData = [];

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

let targetEquip = null;
let equipAttempts = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    startNewGame();
});

function getMonsterImage(monster) {
    if (monster.immagine_card) return monster.immagine_card;
    if (monster.immagine) {
        if (monster.immagine.startsWith('http')) return monster.immagine;
        return `https://it-wiki.metin2.gameforge.com/images/${monster.immagine}`;
    }
    return '';
}

async function loadData() {
    try {
        const [mostri, npc, mappe, armi, armature, elmi, scudi,
            bracciali, collane, orecchini, scarpe, cinture, guanti, metin, upgradeMaterials] = await Promise.all([
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
                fetch('metin.json').then(r => r.json()),
                fetch('output/materiali_upgrade.json').then(r => r.json()).catch(() => ({}))
            ]);

        mostriData = mostri.filter(m => m.immagine_card || m.immagine);
        npcData = npc.filter(n => n.immagine_card || n.immagine);
        mappeData = mappe;

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

        metinData = metin.filter(m => m.icona);

        // Carica dati upgrade
        upgradeMaterialsData = upgradeMaterials || {};
        allEquipData = [
            ...armiData,
            ...difesaData,
            ...accessoriData
        ];

        console.log(`Caricati: ${mostriData.length} mostri, ${npcData.length} NPC, ${mappeData.length} mappe, ${armiData.length} armi, ${difesaData.length} difesa, ${accessoriData.length} accessori, ${metinData.length} metin, ${Object.keys(upgradeMaterialsData).length} categorie upgrade`);
    } catch (error) {
        console.error('Errore caricamento dati:', error);
        alert('Impossibile caricare i dati del gioco.');
    }
}

function setupEventListeners() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    document.getElementById('submit-monster').addEventListener('click', checkMonsterGuess);
    document.getElementById('monster-guess').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkMonsterGuess();
    });

    const guessInput = document.getElementById('monster-guess');
    guessInput.addEventListener('input', (e) => showSuggestions(e.target.value, 'suggestions', 'monster-guess', checkMonsterGuess));
    guessInput.addEventListener('focus', (e) => {
        if (e.target.value) showSuggestions(e.target.value, 'suggestions', 'monster-guess', checkMonsterGuess);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.guess-input-container')) {
            document.getElementById('suggestions').style.display = 'none';
            document.getElementById('blur-suggestions').style.display = 'none';
        }
    });

    document.getElementById('submit-blur').addEventListener('click', checkBlurGuess);
    document.getElementById('blur-guess').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkBlurGuess();
    });

    const blurInput = document.getElementById('blur-guess');
    blurInput.addEventListener('input', (e) => showSuggestions(e.target.value, 'blur-suggestions', 'blur-guess', checkBlurGuess));
    blurInput.addEventListener('focus', (e) => {
        if (e.target.value) showSuggestions(e.target.value, 'blur-suggestions', 'blur-guess', checkBlurGuess);
    });

    document.getElementById('map-image').addEventListener('click', handleMapClick);
    document.getElementById('confirm-npc').addEventListener('click', confirmNPCGuess);
    document.getElementById('next-npc').addEventListener('click', startNPCMode);

    const equipModes = [
        { mode: 'arma', data: armiData },
        { mode: 'difesa', data: difesaData },
        { mode: 'accessori', data: accessoriData }
    ];

    equipModes.forEach(({ mode, data }) => {
        document.getElementById(`submit-${mode}`).addEventListener('click', () => checkEquipGuess(mode, data));
        document.getElementById(`${mode}-guess`).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkEquipGuess(mode, data);
        });
        document.getElementById(`${mode}-guess`).addEventListener('input', (e) => {
            showEquipSuggestions(e.target.value, `${mode}-suggestions`, `${mode}-guess`, () => checkEquipGuess(mode, data), data);
        });
        document.getElementById(`${mode}-guess`).addEventListener('focus', (e) => {
            if (e.target.value) showEquipSuggestions(e.target.value, `${mode}-suggestions`, `${mode}-guess`, () => checkEquipGuess(mode, data), data);
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.guess-input-container')) {
            ['arma-suggestions', 'difesa-suggestions', 'accessori-suggestions'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }
    });

    document.getElementById('submit-metin').addEventListener('click', checkMetinGuess);
    document.getElementById('metin-guess').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkMetinGuess();
    });

    const metinInput = document.getElementById('metin-guess');
    metinInput.addEventListener('input', (e) => showMetinSuggestions(e.target.value, 'metin-suggestions', 'metin-guess', checkMetinGuess, metinData));
    metinInput.addEventListener('focus', (e) => {
        if (e.target.value) showMetinSuggestions(e.target.value, 'metin-suggestions', 'metin-guess', checkMetinGuess, metinData);
    });

    document.getElementById('submit-blur-metin').addEventListener('click', checkBlurMetinGuess);
    document.getElementById('blur-metin-guess').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkBlurMetinGuess();
    });

    const blurMetinInput = document.getElementById('blur-metin-guess');
    blurMetinInput.addEventListener('input', (e) => showMetinSuggestions(e.target.value, 'blur-metin-suggestions', 'blur-metin-guess', checkBlurMetinGuess, getCampoApertoMetin()));
    blurMetinInput.addEventListener('focus', (e) => {
        if (e.target.value) showMetinSuggestions(e.target.value, 'blur-metin-suggestions', 'blur-metin-guess', checkBlurMetinGuess, getCampoApertoMetin());
    });

    document.getElementById('submit-upgrade').addEventListener('click', checkUpgradeGuess);
    document.getElementById('upgrade-guess').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkUpgradeGuess();
    });

    const upgradeInput = document.getElementById('upgrade-guess');
    upgradeInput.addEventListener('input', (e) => {
        showUpgradeSuggestions(e.target.value, 'upgrade-suggestions', 'upgrade-guess');
    });
    upgradeInput.addEventListener('focus', (e) => {
        if (e.target.value) showUpgradeSuggestions(e.target.value, 'upgrade-suggestions', 'upgrade-guess');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.guess-input-container')) {
            ['metin-suggestions', 'blur-metin-suggestions', 'upgrade-suggestions'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }
    });
}

function showSuggestions(query, suggestionsId, inputId, callback) {
    const suggestionsDiv = document.getElementById(suggestionsId);
    if (!query || query.length < 2) { suggestionsDiv.style.display = 'none'; return; }

    const matches = mostriData.filter(m => m.nome.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
    if (matches.length === 0) { suggestionsDiv.style.display = 'none'; return; }

    suggestionsDiv.innerHTML = matches.map(m => {
        const imgSrc = getMonsterImage(m);
        const level = m.livello || m.livello_card || '-';
        const category = m.categoria || '-';
        const grado = m.rank_card !== null && m.rank_card !== undefined ? String(m.rank_card) : (m.boss ? 'Boss' : '-');
        return `
        <div class="suggestion-item" data-name="${m.nome}">
            <img src="${imgSrc}" alt="${m.nome}" class="suggestion-img">
            <div class="suggestion-info">
                <span class="suggestion-name">${m.nome}</span>
                <span class="suggestion-details">LIV ${level} · ${category} · GRADO ${grado}</span>
            </div>
        </div>`;
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

function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    document.querySelectorAll('.game-mode').forEach(section => section.classList.toggle('active', section.id === `${mode}-mode`));
    startNewGame();
}

function startNewGame() {
    if (currentMode === 'monster') startMonsterMode();
    else if (currentMode === 'npc') startNPCMode();
    else if (currentMode === 'blur') startBlurMode();
    else if (currentMode === 'arma') startEquipMode('arma', armiData);
    else if (currentMode === 'difesa') startEquipMode('difesa', difesaData);
    else if (currentMode === 'accessori') startEquipMode('accessori', accessoriData);
    else if (currentMode === 'metin') startMetinMode();
    else if (currentMode === 'blur-metin') startBlurMetinMode();
    else if (currentMode === 'upgrade') startUpgradeMode();
}

// ==================== MODALITÀ 1: INDOVINA IL MOSTRO ====================

function startMonsterMode() {
    targetMonster = mostriData[Math.floor(Math.random() * mostriData.length)];
    attempts = [];
    document.getElementById('monster-guess').value = '';
    document.getElementById('monster-feedback').innerHTML = '';
    document.getElementById('attempts-grid').innerHTML = '';
    console.log('Mostro segreto:', targetMonster.nome);
}

function checkMonsterGuess() {
    const guess = document.getElementById('monster-guess').value.trim();
    if (!guess) return;

    const guessedMonster = mostriData.find(m => m.nome.toLowerCase() === guess.toLowerCase());
    if (!guessedMonster) { alert('Mostro non trovato!'); return; }

    const isCorrect = guessedMonster.nome === targetMonster.nome;
    const comparison = compareMonsters(targetMonster, guessedMonster);
    attempts.push({ guess: guessedMonster, comparison, isCorrect });
    addAttemptToGrid(guessedMonster, comparison, isCorrect);

    if (isCorrect) {
        score += 10;
        updateScore();
        document.getElementById('monster-feedback').innerHTML = `<div class="attempt correct">✅ Corretto! Era ${targetMonster.nome}! +10 punti</div>`;
        setTimeout(startMonsterMode, 3000);
    } else {
        document.getElementById('monster-feedback').innerHTML = '<div class="attempt wrong">❌ Sbagliato! Prova ancora</div>';
    }

    document.getElementById('monster-guess').value = '';
    document.getElementById('suggestions').style.display = 'none';
}

function addAttemptToGrid(monster, comparison, isCorrect) {
    const grid = document.getElementById('attempts-grid');
    const attemptDiv = document.createElement('div');
    attemptDiv.className = `attempt-row ${isCorrect ? 'correct' : 'wrong'}`;

    const getGrado = (m) => {
        if (m.rank_card !== null && m.rank_card !== undefined) return String(m.rank_card);
        return m.boss ? 'Boss' : '-';
    };

    const getElemento = (m) => {
        if (m.elemento && m.elemento.length > 0) return m.elemento.join(', ');
        return '-';
    };

    const squares = [
        { type: 'image', value: getMonsterImage(monster), label: '', isImage: true },
        { type: 'name', value: monster.nome, label: '' },
        { type: 'category', value: monster.categoria || '-', label: 'CAT' },
        { type: 'level', value: getLevelArrow(targetMonster, monster), label: 'LIV' },
        { type: 'grado', value: getGrado(monster), label: 'GRADO' },
        { type: 'boss', value: monster.boss ? '✓' : '✗', label: 'BOSS' },
        { type: 'stun', value: monster.stordimento ? '✓' : '✗', label: 'STUN' },
        { type: 'slow', value: monster.rallentamento ? '✓' : '✗', label: 'SLOW' },
        { type: 'fear', value: monster.paura ? '✓' : '✗', label: 'FEAR' },
        { type: 'aggro', value: monster.aggressivo ? '✓' : '✗', label: 'AGGR' },
        { type: 'elemento', value: getElemento(monster), label: 'ELEM' },
        { type: 'exp', value: getExpArrow(targetMonster, monster), label: 'EXP' },
    ];

    squares.forEach(sq => {
        const square = document.createElement('div');
        square.className = `attr-square ${sq.type}`;
        if (comparison[sq.type] && comparison[sq.type] !== 'none') square.classList.add(comparison[sq.type]);

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
    const tLv = target.livello || target.livello_card || 0;
    const gLv = guess.livello || guess.livello_card || 0;
    if (!tLv && !gLv) return '-';
    if (!tLv || !gLv) return `${gLv || 0} -`;
    if (gLv === tLv) return `${gLv} ✓`;
    if (gLv < tLv) return `${gLv} ↑`;
    return `${gLv} ↓`;
}

function getExpArrow(target, guess) {
    const tExp = target.esperienza || 0;
    const gExp = guess.esperienza || 0;
    if (!tExp && !gExp) return '-';
    if (!tExp || !gExp) return `${gExp || 0} -`;
    if (gExp === tExp) return `${gExp} ✓`;
    if (gExp < tExp) return `${gExp} ↑`;
    return `${gExp} ↓`;
}

function compareMonsters(target, guess) {
    const getGrado = (m) => {
        if (m.rank_card !== null && m.rank_card !== undefined) return String(m.rank_card);
        return m.boss ? 'Boss' : '-';
    };
    const getElemento = (m) => {
        if (m.elemento && m.elemento.length > 0) return m.elemento.join(', ');
        return '-';
    };

    return {
        category: target.categoria === guess.categoria ? 'correct' : 'wrong',
        level: getColor(target.livello || target.livello_card || 0, guess.livello || guess.livello_card || 0, 5),
        grado: getGrado(target) === getGrado(guess) ? 'correct' : 'wrong',
        boss: target.boss === guess.boss ? 'correct' : 'wrong',
        stun: target.stordimento === guess.stordimento ? 'correct' : 'wrong',
        slow: target.rallentamento === guess.rallentamento ? 'correct' : 'wrong',
        fear: target.paura === guess.paura ? 'correct' : 'wrong',
        aggro: target.aggressivo === guess.aggressivo ? 'correct' : 'wrong',
        elemento: getElemento(target) === getElemento(guess) ? 'correct' : 'wrong',
        exp: getColor(target.esperienza || 0, guess.esperienza || 0, 20),
    };
}

function getColor(targetVal, guessVal, tolerance) {
    if (!targetVal || !guessVal) return 'wrong';
    const diff = guessVal - targetVal;
    if (diff === 0) return 'correct';
    if (Math.abs(diff) <= tolerance) return 'partial';
    return 'wrong';
}

// ==================== MODALITÀ 2: TROVA L'NPC SULLA MAPPA ====================

function parseMapDimensions(dimStr) {
    if (!dimStr) return null;
    const normalized = dimStr.toLowerCase().replace(/×/g, 'x').replace(/\s+/g, '');
    const parts = normalized.split('x');
    const width = parseInt(parts[0]);
    const height = parseInt(parts[1]);
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) return null;
    return { width, height };
}

function findNpcByName(name) {
    return npcData.find(n => n.nome.toLowerCase() === name.toLowerCase());
}

function getValidNpcPositionsForMap(mapData) {
    if (!mapData.npc || mapData.npc.length === 0) return { positions: [], maxX: 0, maxY: 0 };
    const result = [];
    for (const mapNpc of mapData.npc) {
        const fullNpc = findNpcByName(mapNpc.nome);
        if (!fullNpc || !fullNpc.posizioni) continue;
        const pos = fullNpc.posizioni[mapData.nome];
        if (!pos) continue;
        const x = parseInt(pos.x), y = parseInt(pos.y);
        if (isNaN(x) || isNaN(y)) continue;
        result.push({ npc: fullNpc, mapNpc, x, y });
    }

    const dims = parseMapDimensions(mapData.dimensioni);
    let maxX, maxY;
    if (dims) {
        maxX = dims.width;
        maxY = dims.height;
    } else {
        // fallback solo se la mappa non ha 'dimensioni' valide
        maxX = Math.max(512, ...result.map(r => r.x));
        maxY = Math.max(512, ...result.map(r => r.y));
    }

    return { positions: result, maxX, maxY };
}

function startNPCMode() {
    npcAnswered = false;
    playerClickPos = null;
    currentMapData = null;

    // Filtra mappe che hanno url_mappa_pulita (mappe pulite dei villaggi principali)
    // e almeno un NPC con posizione valida
    const mappeValide = mappeData.filter(m => {
        if (!m.url_mappa_pulita) return false;
        if (!m.npc || m.npc.length === 0) return false;
        return getValidNpcPositionsForMap(m).positions.length > 0;
    });

    if (mappeValide.length === 0) {
        alert('Nessuna mappa pulita con NPC disponibile.');
        switchMode('monster');
        return;
    }

    const mapData = mappeValide[Math.floor(Math.random() * mappeValide.length)];
    currentMapData = mapData;
    const npcData = getValidNpcPositionsForMap(mapData);
    const chosen = npcData.positions[Math.floor(Math.random() * npcData.positions.length)];
    currentNPC = chosen.npc;
    const npcX = chosen.x, npcY = chosen.y;

    const img = document.getElementById('npc-image');
    img.src = currentNPC.immagine_card || currentNPC.immagine || '';
    img.alt = currentNPC.nome;
    document.getElementById('npc-name').textContent = currentNPC.nome;
    document.getElementById('npc-distance').textContent = 'Clicca sulla mappa dove si trova questo NPC';

    // Usa l'immagine della mappa pulita
    const mapImg = document.getElementById('map-image');
    mapImg.src = mapData.url_mappa_pulita || '';
    mapImg.dataset.mapName = mapData.nome;
    mapImg.dataset.npcX = String(npcX);
    mapImg.dataset.npcY = String(npcY);
    mapImg.dataset.coordMaxX = String(npcData.maxX);
    mapImg.dataset.coordMaxY = String(npcData.maxY);

    document.getElementById('map-marker').style.display = 'none';
    document.getElementById('npc-marker').style.display = 'none';
    document.getElementById('map-line').style.display = 'none';
    document.getElementById('confirm-npc').disabled = true;
    document.getElementById('confirm-npc').style.display = 'inline-block';
    document.getElementById('next-npc').style.display = 'none';
    document.getElementById('npc-feedback').innerHTML = '';
    mapImg.style.pointerEvents = 'auto';
    mapImg.style.cursor = 'crosshair';
}

function handleMapClick(e) {
    if (npcAnswered) return;
    const mapImg = document.getElementById('map-image');
    const npcX = parseInt(mapImg.dataset.npcX), npcY = parseInt(mapImg.dataset.npcY);
    if (isNaN(npcX) || isNaN(npcY)) { alert('Coordinate NPC non disponibili.'); return; }
    e.preventDefault();

    const rect = mapImg.getBoundingClientRect();
    const clickX = e.clientX - rect.left, clickY = e.clientY - rect.top;
    if (clickX < 0 || clickY < 0 || clickX > rect.width || clickY > rect.height) return;

    playerClickPos = { x: clickX, y: clickY };
    const marker = document.getElementById('map-marker');
    marker.style.left = `${clickX}px`;
    marker.style.top = `${clickY}px`;
    marker.style.display = 'block';
    document.getElementById('confirm-npc').disabled = false;
    document.getElementById('npc-distance').textContent = 'Posizione selezionata. Clicca "Conferma" per verificare.';
}

function confirmNPCGuess() {
    if (npcAnswered || !playerClickPos) return;
    const mapImg = document.getElementById('map-image');
    const npcX = parseInt(mapImg.dataset.npcX), npcY = parseInt(mapImg.dataset.npcY);
    const coordMaxX = parseInt(mapImg.dataset.coordMaxX), coordMaxY = parseInt(mapImg.dataset.coordMaxY);
    const clickX = playerClickPos.x, clickY = playerClickPos.y;
    const rect = mapImg.getBoundingClientRect();
    const scaleX = coordMaxX / rect.width, scaleY = coordMaxY / rect.height;
    const clickGameX = clickX * scaleX, clickGameY = clickY * scaleY;
    const distance = Math.sqrt(Math.pow(clickGameX - npcX, 2) + Math.pow(clickGameY - npcY, 2));
    const npcDisplayX = npcX / scaleX, npcDisplayY = npcY / scaleY;

    const npcMarker = document.getElementById('npc-marker');
    npcMarker.style.left = `${npcDisplayX}px`;
    npcMarker.style.top = `${npcDisplayY}px`;
    npcMarker.style.display = 'block';

    const lineSvg = document.getElementById('map-line');
    const lineElement = document.getElementById('map-line-element');
    lineElement.setAttribute('x1', clickX);
    lineElement.setAttribute('y1', clickY);
    lineElement.setAttribute('x2', npcDisplayX);
    lineElement.setAttribute('y2', npcDisplayY);
    lineSvg.style.display = 'block';

    const diag = Math.sqrt(coordMaxX * coordMaxX + coordMaxY * coordMaxY);
    const distancePercent = (distance / diag) * 100;
    let points = 0, feedbackMsg = '', feedbackClass = '';

    if (distancePercent < 3) { points = 100; feedbackMsg = `🎯 Perfetto! Distanza: ${Math.round(distance)} px | +${points} punti`; feedbackClass = 'correct'; }
    else if (distancePercent < 7) { points = 75; feedbackMsg = `👌 Molto bene! Distanza: ${Math.round(distance)} px | +${points} punti`; feedbackClass = 'correct'; }
    else if (distancePercent < 15) { points = 50; feedbackMsg = `👍 Buono! Distanza: ${Math.round(distance)} px | +${points} punti`; feedbackClass = 'correct'; }
    else if (distancePercent < 30) { points = 25; feedbackMsg = `🤔 Non male. Distanza: ${Math.round(distance)} px | +${points} punti`; feedbackClass = 'wrong'; }
    else { points = 0; feedbackMsg = `😢 Troppo lontano! Distanza: ${Math.round(distance)} px | +${points} punti`; feedbackClass = 'wrong'; }

    score += points;
    updateScore();
    document.getElementById('npc-feedback').innerHTML = `<div class="attempt ${feedbackClass}">${feedbackMsg}</div>`;
    document.getElementById('npc-distance').textContent = `Distanza: ${Math.round(distance)} px (${distancePercent.toFixed(1)}% della mappa)`;
    document.getElementById('confirm-npc').style.display = 'none';
    document.getElementById('next-npc').style.display = 'inline-block';
    npcAnswered = true;
    mapImg.style.cursor = 'default';
}

// ==================== MODALITÀ 3: MOSTRO SFOCATO ====================

let currentBlurLevel = 20;
const initialBlur = 20;
const blurDecrement = 3;

function startBlurMode() {
    const randomMonster = mostriData[Math.floor(Math.random() * mostriData.length)];
    const img = document.getElementById('blur-image');
    img.src = randomMonster.immagine_card || randomMonster.immagine;
    img.alt = randomMonster.nome;
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
        img.style.filter = 'none';
        feedback.innerHTML = `<div class="attempt correct">✅ Corretto! Era ${targetName}! +${points} punti</div>`;
        setTimeout(startBlurMode, 2000);
    } else {
        currentBlurLevel = Math.max(0, currentBlurLevel - blurDecrement);
        img.style.filter = `blur(${currentBlurLevel}px)`;
        feedback.innerHTML = `<div class="attempt wrong">❌ Sbagliato! Sfocatura ridotta a ${currentBlurLevel}px</div>`;
    }
    document.getElementById('blur-guess').value = '';
}

// ==================== MODALITÀ 4,5,6: EQUIPAGGIAMENTO ====================

function startEquipMode(mode, data) {
    if (!data || data.length === 0) { alert(`Nessun dato disponibile per ${mode}.`); return; }
    targetEquip = data[Math.floor(Math.random() * data.length)];
    equipAttempts = [];
    document.getElementById(`${mode}-attempts-grid`).innerHTML = '';
    document.getElementById(`${mode}-guess`).value = '';
    document.getElementById(`${mode}-feedback`).innerHTML = '';
    console.log(`[${mode}] Target:`, targetEquip.nome);
}

function checkEquipGuess(mode, data) {
    const input = document.getElementById(`${mode}-guess`);
    const guess = input.value.trim();
    if (!guess) return;
    const guessedItem = data.find(item => item.nome.toLowerCase() === guess.toLowerCase());
    if (!guessedItem) { alert('Oggetto non trovato!'); return; }

    const isCorrect = guessedItem.nome === targetEquip.nome;
    const comparison = compareEquip(targetEquip, guessedItem, mode);
    equipAttempts.push({ guess: guessedItem, comparison, isCorrect });
    addEquipAttemptToGrid(mode, guessedItem, comparison, isCorrect);

    const feedback = document.getElementById(`${mode}-feedback`);
    if (isCorrect) {
        score += 10;
        updateScore();
        feedback.innerHTML = `<div class="attempt correct">✅ Corretto! Era ${targetEquip.nome}! +10 punti</div>`;
        setTimeout(() => startEquipMode(mode, data), 3000);
    } else {
        feedback.innerHTML = '<div class="attempt wrong">❌ Sbagliato! Prova ancora</div>';
    }
    input.value = '';
    document.getElementById(`${mode}-suggestions`).style.display = 'none';
}

function addEquipAttemptToGrid(mode, item, comparison, isCorrect) {
    const grid = document.getElementById(`${mode}-attempts-grid`);
    const attemptDiv = document.createElement('div');
    attemptDiv.className = `attempt-row ${isCorrect ? 'correct' : 'wrong'}`;

    const getSlotDisplay = (item) => {
        if (item.slot === undefined) return '-';
        if (targetEquip.slot === item.slot) return `${item.slot} ✓`;
        return `${item.slot}`;
    };

    const getPrice = (item) => {
        if (!item.prezzo_vendita || item.prezzo_vendita === 'Non disponibile') return '0';
        return item.prezzo_vendita;
    };

    const getYang = (item) => {
        return item.costo_yang || '-';
    };

    let squares = [
        { type: 'image', value: item.icona || '', label: '', isImage: true },
        { type: 'name', value: item.nome, label: '' },
        { type: 'type', value: item.tipo || '-', label: 'TIPO' },
    ];

    if (mode === 'arma') {
        squares = squares.concat([
            { type: 'prezzo_vendita', value: getPrice(item), label: 'PREZZO' },
            { type: 'slot', value: getSlotDisplay(item), label: 'SLOT' },
            { type: 'attack', value: getEquipOriginalValue(targetEquip, item, 'attacco'), label: 'ATK' },
            { type: 'magic_attack', value: getEquipOriginalValue(targetEquip, item, 'attacco_magico'), label: 'MATK' },
            { type: 'speed', value: getEquipOriginalValue(targetEquip, item, 'velocita_attacco'), label: 'VEL' },
            { type: 'costo_yang', value: getYang(item), label: 'YANG' },
        ]);
    } else if (mode === 'difesa') {
        squares = squares.concat([
            { type: 'prezzo_vendita', value: getPrice(item), label: 'PREZZO' },
            { type: 'slot', value: getSlotDisplay(item), label: 'SLOT' },
            { type: 'defense', value: getEquipOriginalValue(targetEquip, item, 'difesa'), label: 'DEF' },
            { type: 'costo_yang', value: getYang(item), label: 'YANG' },
        ]);
    } else if (mode === 'accessori') {
        squares = squares.concat([
            { type: 'livello', value: getEquipLevelArrow(targetEquip, item), label: 'LIV' },
            { type: 'prezzo_vendita', value: getPrice(item), label: 'PREZZO' },
            { type: 'slot', value: getSlotDisplay(item), label: 'SLOT' },
            { type: 'costo_yang', value: getYang(item), label: 'YANG' },
        ]);
    }

    squares.forEach(sq => {
        const square = document.createElement('div');
        square.className = `attr-square ${sq.type}`;
        if (comparison[sq.type] && comparison[sq.type] !== 'none') square.classList.add(comparison[sq.type]);

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
    if (!tLv && !gLv) return '-';
    if (!tLv || !gLv) return `${gLv || 0} -`;
    if (gLv === tLv) return `${gLv} ✓`;
    if (gLv < tLv) return `${gLv} ↑`;
    return `${gLv} ↓`;
}

function getEquipOriginalValue(target, guess, field) {
    const tVal = target[field];
    const gVal = guess[field];
    if (!tVal && !gVal) return '-';
    if (!tVal || !gVal) return `${gVal || '-'} -`;

    const tNum = parseEquipValue(target, [field]);
    const gNum = parseEquipValue(guess, [field]);

    if (tNum === null && gNum === null) return gVal || '-';
    if (tNum === gNum) return `${gVal} ✓`;
    if (gNum < tNum) return `${gVal} ↑`;
    return `${gVal} ↓`;
}

function parseEquipValue(item, fields) {
    for (const f of fields) {
        if (item[f]) {
            const str = item[f].toString();
            const rangeMatch = str.match(/(\d+)\s*[-–]\s*(\d+)/);
            if (rangeMatch) {
                const low = parseFloat(rangeMatch[1]), high = parseFloat(rangeMatch[2]);
                if (!isNaN(low) && !isNaN(high)) return Math.round((low + high) / 2);
            }
            const val = parseFloat(str.replace(/[^\d.-]/g, ''));
            if (!isNaN(val)) return val;
        }
    }
    return null;
}

function parsePrice(price) {
    if (!price) return null;
    const str = price.toString().replace(/\./g, '').replace(/[^\d]/g, '');
    const val = parseInt(str);
    return isNaN(val) ? null : val;
}

function compareEquip(target, guess, mode) {
    const result = {
        type: target.tipo === guess.tipo ? 'correct' : 'wrong',
        prezzo_vendita: comparePrice(target.prezzo_vendita, guess.prezzo_vendita),
        slot: target.slot === guess.slot ? 'correct' : 'wrong',
        costo_yang: comparePrice(target.costo_yang, guess.costo_yang),
    };

    if (mode === 'arma') {
        result.attack = getEquipColor(parseEquipValue(target, ['attacco']), parseEquipValue(guess, ['attacco']), 10);
        result.magic_attack = getEquipColor(parseEquipValue(target, ['attacco_magico']), parseEquipValue(guess, ['attacco_magico']), 10);
        result.speed = getEquipColor(parseEquipValue(target, ['velocita_attacco']), parseEquipValue(guess, ['velocita_attacco']), 5);
    } else if (mode === 'difesa') {
        result.defense = getEquipColor(parseEquipValue(target, ['difesa']), parseEquipValue(guess, ['difesa']), 10);
    } else if (mode === 'accessori') {
        result.livello = getEquipColor(target.livello || 0, guess.livello || 0, 5);
    }

    return result;
}

function comparePrice(targetPrice, guessPrice) {
    const tVal = parsePrice(targetPrice);
    const gVal = parsePrice(guessPrice);
    if (tVal === null && gVal === null) return 'none';
    if (tVal === null || gVal === null) return 'wrong';
    if (tVal === gVal) return 'correct';
    if (Math.abs(tVal - gVal) <= 1000) return 'partial';
    return 'wrong';
}

function getEquipColor(targetVal, guessVal, tolerance) {
    if (targetVal === null && guessVal === null) return 'none';
    if (targetVal === undefined && guessVal === undefined) return 'none';
    if (targetVal === null || targetVal === undefined) return 'wrong';
    if (guessVal === null || guessVal === undefined) return 'wrong';
    if (targetVal === guessVal) return 'correct';
    if (Math.abs(guessVal - targetVal) <= tolerance) return 'partial';
    return 'wrong';
}

function showEquipSuggestions(query, suggestionsId, inputId, callback, data) {
    const suggestionsDiv = document.getElementById(suggestionsId);
    if (!query || query.length < 2) { suggestionsDiv.style.display = 'none'; return; }

    const matches = data.filter(item => item.nome.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
    if (matches.length === 0) { suggestionsDiv.style.display = 'none'; return; }

    suggestionsDiv.innerHTML = matches.map(item => {
        const level = item.livello || '-';
        const type = item.tipo || '-';
        return `
        <div class="suggestion-item" data-name="${item.nome}">
            <img src="${item.icona || ''}" alt="${item.nome}" class="suggestion-img">
            <div class="suggestion-info">
                <span class="suggestion-name">${item.nome}</span>
                <span class="suggestion-details">TIPO ${type} · LIV ${level}</span>
            </div>
        </div>`;
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

function getCampoApertoMetin() {
    return metinData.filter(m => m.categoria === 'Campo Aperto');
}

function startMetinMode() {
    if (!metinData || metinData.length === 0) { alert('Nessun dato Metin disponibile.'); return; }
    targetMetin = metinData[Math.floor(Math.random() * metinData.length)];
    metinAttempts = [];
    document.getElementById('metin-attempts-grid').innerHTML = '';
    document.getElementById('metin-guess').value = '';
    document.getElementById('metin-feedback').innerHTML = '';
    console.log('[Metin] Target:', targetMetin.nome);
}

function checkMetinGuess() {
    const guess = document.getElementById('metin-guess').value.trim();
    if (!guess) return;
    const guessedMetin = metinData.find(m => m.nome.toLowerCase() === guess.toLowerCase());
    if (!guessedMetin) { alert('Metin non trovato!'); return; }

    const isCorrect = guessedMetin.nome === targetMetin.nome;
    const comparison = compareMetin(targetMetin, guessedMetin);
    metinAttempts.push({ guess: guessedMetin, comparison, isCorrect });
    addMetinAttemptToGrid(guessedMetin, comparison, isCorrect);

    const feedback = document.getElementById('metin-feedback');
    if (isCorrect) {
        score += 10;
        updateScore();
        feedback.innerHTML = `<div class="attempt correct">✅ Corretto! Era ${targetMetin.nome}! +10 punti</div>`;
        setTimeout(startMetinMode, 3000);
    } else {
        feedback.innerHTML = '<div class="attempt wrong">❌ Sbagliato! Prova ancora</div>';
    }
    document.getElementById('metin-guess').value = '';
    document.getElementById('metin-suggestions').style.display = 'none';
}

function addMetinAttemptToGrid(metin, comparison, isCorrect) {
    const grid = document.getElementById('metin-attempts-grid');
    const attemptDiv = document.createElement('div');
    attemptDiv.className = `attempt-row ${isCorrect ? 'correct' : 'wrong'}`;

    const squares = [
        { type: 'image', value: metin.icona || '', label: '', isImage: true },
        { type: 'name', value: metin.nome, label: '' },
        { type: 'category', value: metin.categoria || '-', label: 'CAT' },
        { type: 'level', value: getMetinLevelArrow(targetMetin, metin), label: 'LIV' },
    ];

    squares.forEach(sq => {
        const square = document.createElement('div');
        square.className = `attr-square ${sq.type}`;
        if (comparison[sq.type] && comparison[sq.type] !== 'none') square.classList.add(comparison[sq.type]);

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
    if (!tLv && !gLv) return '-';
    if (!tLv || !gLv) return `${gLv || 0} -`;
    if (gLv === tLv) return `${gLv} ✓`;
    if (gLv < tLv) return `${gLv} ↑`;
    return `${gLv} ↓`;
}

function compareMetin(target, guess) {
    return {
        category: target.categoria === guess.categoria ? 'correct' : 'wrong',
        level: getEquipColor(target.livello || 0, guess.livello || 0, 5),
    };
}

// Metin Sfocato (solo Campo Aperto)
let currentBlurMetinLevel = 20;
const initialBlurMetin = 20;
const blurMetinDecrement = 3;

function startBlurMetinMode() {
    const campoApertoMetin = getCampoApertoMetin();
    if (!campoApertoMetin || campoApertoMetin.length === 0) { alert('Nessun Metin Campo Aperto disponibile.'); return; }

    const randomMetin = campoApertoMetin[Math.floor(Math.random() * campoApertoMetin.length)];
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

function showMetinSuggestions(query, suggestionsId, inputId, callback, data) {
    const suggestionsDiv = document.getElementById(suggestionsId);
    if (!query || query.length < 2) { suggestionsDiv.style.display = 'none'; return; }

    const matches = data.filter(item => item.nome.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
    if (matches.length === 0) { suggestionsDiv.style.display = 'none'; return; }

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
        </div>`;
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

function updateScore() {
    document.getElementById('score').textContent = `Punteggio: ${score}`;
}

// ==================== MODALITÀ 9: INDOVINA L'UPGRADE ====================

let currentUpgrade = null;
let upgradeAttempts = [];

function startUpgradeMode() {
    // Trova tutti gli oggetti che hanno materiali di upgrade
    const itemsWithMaterials = [];

    for (const [categoria, items] of Object.entries(upgradeMaterialsData)) {
        for (const [itemName, itemData] of Object.entries(items)) {
            if (itemData.materiali && Object.keys(itemData.materiali).length > 0) {
                // Trova l'oggetto completo nei dati
                const fullItem = allEquipData.find(e => e.nome === itemName);
                itemsWithMaterials.push({
                    nome: itemName,
                    categoria: categoria,
                    materiali: itemData.materiali,
                    url: itemData.url,
                    icona: fullItem ? fullItem.icona : '',
                    tipo: fullItem ? fullItem.tipo : '',
                    livello: fullItem ? fullItem.livello : null
                });
            }
        }
    }

    if (itemsWithMaterials.length === 0) {
        alert('Nessun dato di upgrade disponibile.');
        return;
    }

    // Scegli un oggetto casuale
    currentUpgrade = itemsWithMaterials[Math.floor(Math.random() * itemsWithMaterials.length)];
    upgradeAttempts = [];

    // Scegli un livello di upgrade casuale che ha materiali
    const levelsWithMaterials = Object.keys(currentUpgrade.materiali).filter(l => currentUpgrade.materiali[l]);
    const randomLevel = levelsWithMaterials[Math.floor(Math.random() * levelsWithMaterials.length)];
    currentUpgrade.targetLevel = randomLevel;

    // Mostra i materiali
    displayUpgradeMaterials(randomLevel);

    // Reset UI
    document.getElementById('upgrade-guess').value = '';
    document.getElementById('upgrade-feedback').innerHTML = '';
    document.getElementById('upgrade-suggestions').style.display = 'none';

    console.log('[Upgrade] Target:', currentUpgrade.nome, randomLevel);
}

function displayUpgradeMaterials(level) {
    const materialsList = document.getElementById('upgrade-materials-list');
    const material = currentUpgrade.materiali[level];

    if (!material) {
        materialsList.innerHTML = '<p>Nessun materiale per questo livello</p>';
        return;
    }

    let html = `<div class="material-item">
        <span class="material-name">${material.nome}</span>
        <span class="material-quantity">x${material.quantita}</span>
    </div>`;

    // Se c'è un secondo materiale (per +7, +8, +9)
    if (material.nome2) {
        html += `<div class="material-item">
            <span class="material-name">${material.nome2}</span>
            <span class="material-quantity">x${material.quantita2}</span>
        </div>`;
    }

    materialsList.innerHTML = html;
}

function checkUpgradeGuess() {
    const guess = document.getElementById('upgrade-guess').value.trim();
    if (!guess || !currentUpgrade) return;

    const guessedItem = allEquipData.find(item => item.nome.toLowerCase() === guess.toLowerCase());
    if (!guessedItem) {
        alert('Oggetto non trovato!');
        return;
    }

    const isCorrect = guessedItem.nome === currentUpgrade.nome;
    const selectedLevel = document.getElementById('upgrade-level').value;
    const isLevelCorrect = selectedLevel === currentUpgrade.targetLevel;

    // Calcola indizi
    const hints = {
        nomeCorretto: isCorrect,
        livelloCorretto: isLevelCorrect,
        categoriaCorretta: guessedItem.categoria === currentUpgrade.categoria,
        tipoCorretto: guessedItem.tipo === currentUpgrade.tipo,
        livelloOggettoCorretto: guessedItem.livello === currentUpgrade.livello
    };

    // Punteggio
    let points = 0;
    let feedbackMsg = '';

    if (isCorrect && isLevelCorrect) {
        points = 25;
        feedbackMsg = `✅ Perfetto! Era ${currentUpgrade.nome} ${currentUpgrade.targetLevel}! +${points} punti`;
        setTimeout(startUpgradeMode, 3000);
    } else if (isCorrect) {
        points = 10;
        feedbackMsg = `🟡 Oggetto corretto! Ma il livello è sbagliato. Era ${currentUpgrade.targetLevel}`;
    } else {
        feedbackMsg = '❌ Sbagliato! ';
        if (hints.categoriaCorretta) feedbackMsg += 'Categoria corretta. ';
        if (hints.tipoCorretto) feedbackMsg += 'Tipo corretto. ';
        if (hints.livelloOggettoCorretto) feedbackMsg += 'Livello corretto. ';
    }

    score += points;
    updateScore();

    const feedback = document.getElementById('upgrade-feedback');
    feedback.innerHTML = `<div class="attempt ${isCorrect && isLevelCorrect ? 'correct' : 'wrong'}">${feedbackMsg}</div>`;

    document.getElementById('upgrade-guess').value = '';
    document.getElementById('upgrade-suggestions').style.display = 'none';
}

function showUpgradeSuggestions(query, suggestionsId, inputId) {
    const suggestionsDiv = document.getElementById(suggestionsId);
    if (!query || query.length < 2) { suggestionsDiv.style.display = 'none'; return; }

    const matches = allEquipData.filter(item => item.nome.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
    if (matches.length === 0) { suggestionsDiv.style.display = 'none'; return; }

    suggestionsDiv.innerHTML = matches.map(item => {
        const level = item.livello || '-';
        const type = item.tipo || '-';
        const category = item.categoria || '-';
        return `
        <div class="suggestion-item" data-name="${item.nome}">
            <img src="${item.icona || ''}" alt="${item.nome}" class="suggestion-img">
            <div class="suggestion-info">
                <span class="suggestion-name">${item.nome}</span>
                <span class="suggestion-details">${category} · ${type} · LIV ${level}</span>
            </div>
        </div>`;
    }).join('');

    suggestionsDiv.style.display = 'block';
    suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById(inputId).value = item.dataset.name;
            suggestionsDiv.style.display = 'none';
            checkUpgradeGuess();
        });
    });
}
