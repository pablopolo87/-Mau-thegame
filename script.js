// script.js
console.log('script.js loaded');

// --- CONSTANTES GLOBALES ---
const SUITS = { OROS: 'oros', COPAS: 'copas', ESPADAS: 'espadas', BASTOS: 'bastos' };
const SUIT_ABBREVIATIONS = { [SUITS.OROS]: 'o', [SUITS.COPAS]: 'c', [SUITS.ESPADAS]: 'e', [SUITS.BASTOS]: 'b' };
const SPECIAL_RANKS = { SOTA: 10, CABALLO: 11, REY: 12, SIETE: 7 };
const AI_NAMES = ["Sofía", "Mateo", "Valentina", "Santiago", "Isabella", "Leo", "Camila", "Thiago", "Lucía", "Daniel"];

// --- VARIABLES GLOBALES Y DE ESTADO ---
let game;
let selectedLives = 2;
let selectedAiPlayers = 1;
let selectedDifficulty = 'hard';
let withSevenOros = true;
let withMusic = false;
let useRandomAiNames = true;
let customAiNames = [];
let backgroundMusic;

// --- DECLARACIONES DE ELEMENTOS UI (se asignarán en DOMContentLoaded) ---
let gameInfoElement, currentRoundElement, currentPlayerNameElement, gameMessageElement, playersInfoElement, deckSizeElement, discardTopCardElement, drawCardButton, startGameButton, suitSelectionElement, humanPlayerHandAreaElement, nameInputModal, playerNameInput, confirmNameButton, livesSelectionModal, aiPlayerSelectionModal, aiDifficultySelectionModal, aiNameSelectionModal, aiNameForm, startGameFromNamesButton, randomNameSelectionModal, musicSelectionModal, showRulesButton, rulesModal, closeRulesButton, roundSummaryModal, roundSummaryTitle, roundSummaryContent, nextRoundButton, volumeSliderElement;



function logEvent(message) {
    if (gameLogElement) {
        const p = document.createElement('p');
        p.textContent = message;
        gameLogElement.insertBefore(p, gameLogElement.firstChild); // Insertar al principio

        // Limitar el número de registros a 10
        while (gameLogElement.children.length > 10) {
            gameLogElement.removeChild(gameLogElement.lastChild); // Eliminar el más antiguo (al final)
        }
    }
}
function logDebug(message) {
    console.log(`[DEBUG] ${message}`);
}

// --- FUNCIONES AUXILIARES DE UI ---

function getLivesEmojis(lives) {
    return '❤️'.repeat(Math.max(0, lives));
}

function createVisualCardElement(card) {
    const cardElement = document.createElement('img');
    cardElement.classList.add('card-image');
    cardElement.dataset.suit = card.suit;
    cardElement.dataset.rank = card.rank;

    let rankNameForFile;
    switch (card.rank) {
        case 1: rankNameForFile = '1'; break;
        case SPECIAL_RANKS.SOTA: rankNameForFile = 'sota'; break;
        case SPECIAL_RANKS.CABALLO: rankNameForFile = 'caballo'; break;
        case SPECIAL_RANKS.REY: rankNameForFile = 'rey'; break;
        default: rankNameForFile = card.rank.toString();
    }
    const suitAbbreviation = SUIT_ABBREVIATIONS[card.suit];
    let filename = `${rankNameForFile}${suitAbbreviation}.png`;

    if (withSevenOros && card.rank === SPECIAL_RANKS.SIETE && card.suit === SUITS.OROS) {
        filename = '7 oros.png';
    }
    cardElement.src = `assets/cards/${filename}`;
    cardElement.alt = card.toString();
    return cardElement;
}

function updateHumanPlayerHand() {
    humanPlayerHandAreaElement.innerHTML = '';
    const humanPlayer = game.players.find(p => !p.isAI);
    if (humanPlayer) {
        const handCardsContainer = document.createElement('div');
        handCardsContainer.classList.add('hand-cards');

        humanPlayer.hand.forEach(card => {
            const cardElement = createVisualCardElement(card);
            const isPlayable = !game.getCurrentPlayer().isAI && humanPlayer === game.getCurrentPlayer() && game.isValidMove(card);
            if (isPlayable) {
                cardElement.classList.add('playable');
                cardElement.addEventListener('click', (e) => handlePlayCard(e, card));
            }
            handCardsContainer.appendChild(cardElement);
        });
        humanPlayerHandAreaElement.appendChild(handCardsContainer);
    }
}

function updatePlayersInfo() {
    playersInfoElement.innerHTML = '';
    game.players.forEach((player, index) => {
        // No modificar la mano del jugador humano aquí, ya que se renderiza por separado
        if (!player.isAI) {
            // Aún así, necesitamos mostrar el panel del jugador humano con sus vidas
            const humanPlayerInfoDiv = document.createElement('div');
            humanPlayerInfoDiv.classList.add('player-card', 'human-player-card');
            humanPlayerInfoDiv.id = `player-info-${player.name.replace(/\s+/g, '-')}`;
            if (player === game.getCurrentPlayer()) {
                humanPlayerInfoDiv.classList.add('active');
            }
            humanPlayerInfoDiv.innerHTML = `
                <h4>${player.name} (Tú)</h4>
                <p>Vidas: ${getLivesEmojis(player.lives)}</p>
                <p>Cartas: <span class="card-count-total">${player.hand.length}</span></p>
            `;
            playersInfoElement.appendChild(humanPlayerInfoDiv);
            return;
        };

        const playerInfoDiv = document.createElement('div');
        playerInfoDiv.classList.add('player-card');
        playerInfoDiv.id = `player-info-${player.name.replace(/\s+/g, '-')}`;
        if (player === game.getCurrentPlayer()) {
            playerInfoDiv.classList.add('active');
        }

        const cardCount = player.hand.length;
        let handDisplay = '<div class="player-card-hand-info">';
        
        // Contenedor para las cartas apiladas
        handDisplay += '<div class="stacked-cards-container">';
        for (let i = 0; i < Math.min(cardCount, 5); i++) {
            handDisplay += `<img src="assets/cards/contraportada.png" class="stacked-card-back" style="left: ${i * 10}px; z-index: ${i};">`;
        }
        handDisplay += '</div>';
        
        // Mostrar siempre el recuento total de cartas
        handDisplay += `<span class="card-count-total">${cardCount}</span>`;
        handDisplay += '</div>';

        playerInfoDiv.innerHTML = `
            <h4>${player.name}</h4>
            <p>Vidas: ${getLivesEmojis(player.lives)}</p>
            ${handDisplay}
        `;
        playersInfoElement.appendChild(playerInfoDiv);
    });
}

function updateUI() {
    if (!game) return;

    currentRoundElement.textContent = game.currentRound;
    currentPlayerNameElement.textContent = game.getCurrentPlayer().name;
    deckSizeElement.textContent = `Cartas en mazo: ${game.deck.size}`;

    discardTopCardElement.src = '';
    discardTopCardElement.alt = '';

    const topDiscardCard = game.getTopDiscardCard();
    if (topDiscardCard) {
        let rankNameForFile;
        switch (topDiscardCard.rank) {
            case 1: rankNameForFile = '1'; break;
            case SPECIAL_RANKS.SOTA: rankNameForFile = 'sota'; break;
            case SPECIAL_RANKS.CABALLO: rankNameForFile = 'caballo'; break;
            case SPECIAL_RANKS.REY: rankNameForFile = 'rey'; break;
            default: rankNameForFile = topDiscardCard.rank.toString();
        }
        const suitAbbreviation = SUIT_ABBREVIATIONS[topDiscardCard.suit];
        let filename = `${rankNameForFile}${suitAbbreviation}.png`;

        if (withSevenOros && topDiscardCard.rank === SPECIAL_RANKS.SIETE && topDiscardCard.suit === SUITS.OROS) {
            filename = '7 oros.png';
        }
        discardTopCardElement.src = `assets/cards/${filename}`;
        discardTopCardElement.alt = topDiscardCard.toString();
    }



    if (currentSuitValueElement) {
        let suitText = 'N/A';
        if (game.currentSuit) {
            const suit = game.currentSuit;
            const suitName = suit.charAt(0).toUpperCase() + suit.slice(1);
            let suitEmoji = '';
            switch (suit) {
                case SUITS.OROS: suitEmoji = '💰'; break;
                case SUITS.COPAS: suitEmoji = '🍷'; break;
                case SUITS.ESPADAS: suitEmoji = '⚔️'; break;
                case SUITS.BASTOS: suitEmoji = '🌿'; break;
            }
            suitText = `${suitName} ${suitEmoji}`;
        }
        currentSuitValueElement.innerHTML = suitText;
    }

    updateHumanPlayerHand();
    updatePlayersInfo();
}

function animateCardFlight(card, startElement, endElement, callback) {
    const flyingCard = createVisualCardElement(card);
    flyingCard.classList.add('flying-card');
    document.body.appendChild(flyingCard);

    const startRect = startElement.getBoundingClientRect();
    const endRect = endElement.getBoundingClientRect();

    const startX = startRect.left + (startRect.width / 2) - (flyingCard.width / 2);
    const startY = startRect.top + (startRect.height / 2) - (flyingCard.height / 2);

    flyingCard.style.left = `${startX}px`;
    flyingCard.style.top = `${startY}px`;
    flyingCard.style.opacity = '1';

    requestAnimationFrame(() => {
        setTimeout(() => {
            const endX = endRect.left + (endRect.width / 2) - (flyingCard.width / 2);
            const endY = endRect.top + (endRect.height / 2) - (flyingCard.height / 2);
            flyingCard.style.transform = `translate(${endX - startX}px, ${endY - startY}px)`;
        }, 20);
    });

    setTimeout(() => {
        flyingCard.remove();
        if (callback) callback();
    }, 800);
}

function promptForSuitSelection(excludedSuit = null) {
    return new Promise(resolve => {
        suitSelectionElement.style.display = 'flex';
        const suitButtons = suitSelectionElement.querySelectorAll('button');

        suitButtons.forEach(button => {
            button.disabled = false;
            button.classList.remove('disabled-suit');
        });

        if (excludedSuit) {
            const excludedButton = Array.from(suitButtons).find(button => button.dataset.suit === excludedSuit);
            if (excludedButton) {
                excludedButton.disabled = true;
                excludedButton.classList.add('disabled-suit');
            }
        }

        const handleSuitSelection = (event) => {
            const chosenSuit = event.target.dataset.suit;
            if (chosenSuit === excludedSuit) {
                alert(`No puedes elegir el palo actual (${excludedSuit}). Por favor, elige otro.`);
                return;
            }
            suitSelectionElement.style.display = 'none';
            suitButtons.forEach(button => button.removeEventListener('click', handleSuitSelection));
            resolve(chosenSuit);
        };

        suitButtons.forEach(button => button.addEventListener('click', handleSuitSelection));
    });
}

async function handlePlayCard(e, card) {
    logDebug(`handlePlayCard() llamado con la carta: ${card.toString()}`);
    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.isAI) return;

    const startElement = e.target;
    const endElement = document.getElementById('discard-top-card');

    const playerHandElement = startElement.closest('.hand-cards');
    if (playerHandElement) {
        playerHandElement.querySelectorAll('.card-image').forEach(c => c.classList.remove('playable'));
    }

    animateCardFlight(card, startElement, endElement, async () => {
        logDebug(`Animación para ${card.toString()} completada.`);
        try {
            let chosenSuit = null;
            if (card.specialType === 'change_suit') {
                const previousSuit = game.currentSuit;
                logDebug(`Se jugó un Rey. Mostrando selección de palo (excluyendo ${previousSuit})`);
                chosenSuit = await promptForSuitSelection(previousSuit);
                logDebug(`Palo elegido: ${chosenSuit}`);
                if (!chosenSuit) {
                    updateUI();
                    return;
                }
            }

            const roundEnded = game.playCard(currentPlayer, card, chosenSuit);
            updateUI();

            if (!roundEnded) {
                game.nextTurn();
            }
        } catch (error) {
            console.error('ERROR en handlePlayCard:', error);
            alert(error.message);
            updateUI();
        }
    });
}

function getRandomAINames(count) {
    const shuffled = AI_NAMES.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}


// --- CLASES DE LA LÓGICA DEL JUEGO ---

class Card {
    constructor(suit, rank) {
        if (!Object.values(SUITS).includes(suit)) throw new Error(`Palo inválido: ${suit}`);
        if (rank < 1 || rank > 12) throw new Error(`Rango inválido: ${rank}`);
        this.suit = suit;
        this.rank = rank;
        this.specialType = this._getSpecialType(rank);
    }
    _getSpecialType(rank) {
        switch (rank) {
            case SPECIAL_RANKS.SOTA: return 'skip_turn';
            case SPECIAL_RANKS.REY: return 'change_suit';
            case SPECIAL_RANKS.SIETE: return 'draw_two';
            default: return null;
        }
    }
    toString() {
        let rankName;
        switch (this.rank) {
            case 1: rankName = 'As'; break;
            case SPECIAL_RANKS.SOTA: rankName = 'Sota'; break;
            case SPECIAL_RANKS.CABALLO: rankName = 'Caballo'; break;
            case SPECIAL_RANKS.REY: rankName = 'Rey'; break;
            default: rankName = this.rank;
        }
        return `${rankName} de ${this.suit}`;
    }
}

class Player {
    constructor(name, isAI = false, difficulty = null) {
        this.name = name;
        this.hand = [];
        this.lives = 0;
        this.points = 0;
        this.isAI = isAI;
        this.difficulty = difficulty;
        this.eliminatedInRound = 0;
    }
    addCard(card) { this.hand.push(card); }
    removeCard(cardToRemove) { this.hand = this.hand.filter(card => card !== cardToRemove); }
    hasCards() { return this.hand.length > 0; }
    calculateRoundPoints() {
        this.points = this.hand.reduce((sum, card) => {
            if ([1, 10, 11].includes(card.rank)) return sum + 11;
            if ([7, 12].includes(card.rank)) return sum + 20;
            return sum + card.rank;
        }, 0);
        return this.points;
    }
    loseLife() { this.lives--; }
    isEliminated() { return this.lives <= 0; }
    aiPlay(game) {
        logEvent(`IA ${this.name} está pensando...`);
        const startElement = document.getElementById(`player-info-${this.name.replace(/\s+/g, '-')}`);
        const endElement = document.getElementById('discard-top-card');
        let playableCards = this.hand.filter(card => game.isValidMove(card));
        let cardToPlay = null;
        let chosenSuit = null;

        if (playableCards.length > 0) {
            switch (this.difficulty) {
                case 'easy': cardToPlay = playableCards[0]; break;
                case 'medium': playableCards.sort((a, b) => a.rank - b.rank); cardToPlay = playableCards[0]; break;
                case 'hard':
                    const specialCards = playableCards.filter(c => c.specialType);
                    if (specialCards.length > 0) cardToPlay = specialCards[0];
                    else {
                        playableCards.sort((a, b) => b.rank - a.rank);
                        cardToPlay = playableCards[0];
                    }
                    break;
                default: cardToPlay = playableCards[0];
            }
            if (cardToPlay.specialType === 'change_suit') {
                chosenSuit = this._getMostCommonSuitInHand(game.currentSuit) || Object.values(SUITS).filter(s => s !== game.currentSuit)[0];
            }
            animateCardFlight(cardToPlay, startElement, endElement, () => {
                const roundEnded = game.playCard(this, cardToPlay, chosenSuit);
                updateUI();
                if (!roundEnded) game.nextTurn();
            });
        } else {
            logEvent(`${this.name} no tiene jugada y roba una carta.`);
            game.drawCards(this, 1);
            updateUI();
            playableCards = this.hand.filter(card => game.isValidMove(card));
            setTimeout(() => {
                if (playableCards.length > 0) {
                    cardToPlay = playableCards[0];
                    if (cardToPlay.specialType === 'change_suit') {
                        chosenSuit = this._getMostCommonSuitInHand(game.currentSuit) || Object.values(SUITS).filter(s => s !== game.currentSuit)[0];
                    }
                    animateCardFlight(cardToPlay, startElement, endElement, () => {
                        const roundEnded = game.playCard(this, cardToPlay, chosenSuit);
                        updateUI();
                        if (!roundEnded) game.nextTurn();
                    });
                } else {
                    logEvent(`${this.name} sigue sin poder jugar y pasa el turno.`);
                    game.nextTurn();
                }
            }, 1000);
        }
    }
    _getMostCommonSuitInHand(excludedSuit = null) {
        const suitCounts = {};
        this.hand.forEach(card => {
            if (card.suit !== excludedSuit) {
                suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
            }
        });
        return Object.keys(suitCounts).reduce((a, b) => suitCounts[a] > suitCounts[b] ? a : b, null);
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }
    reset() {
        this.cards = [];
        for (let i = 0; i < 2; i++) {
            for (const suit of Object.values(SUITS)) {
                for (let rank = 1; rank <= 12; rank++) {
                    if (rank !== 8 && rank !== 9) this.cards.push(new Card(suit, rank));
                }
            }
        }
    }
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    deal(count) { return this.cards.splice(0, count); }
    draw() { return this.cards.pop(); }
    get size() { return this.cards.length; }
}

class Game {
    constructor(playerConfigs, startingLives = 5) {
        logDebug('Creando nueva instancia de Game...');
        this.startingLives = startingLives;
        this.players = playerConfigs.map(config => new Player(config.name, config.isAI, config.difficulty));
        this.allPlayers = [...this.players];
        this.deck = new Deck();
        this.discardPile = [];
        this.currentRound = 0;
        this.activePlayerIndex = 0;
        this.currentSuit = null;
        this.currentRank = null;
        this.drawPenaltyCount = 0;
        this.gameStarted = false;
        this.firstRoundKingRuleActive = false;
        logDebug('Instancia de Game creada.');
    }

    startGame() {
        logDebug('startGame() llamado.');
        this.gameStarted = true;
        this.currentRound = 0;
        this.players.forEach(p => { p.lives = this.startingLives; p.hand = []; p.points = 0; });
        logEvent('Vidas de los jugadores y manos reiniciadas.');
        this.startNewRound();
    }

    async startNewRound() {
        logDebug(`startNewRound() llamado para la ronda ${this.currentRound + 1}`);
        this.currentRound++;
        this.deck.reset();
        this.deck.shuffle();
        this.discardPile = [];
        logEvent('Mazo reiniciado y barajado.');

        this.players.forEach(p => p.hand = this.deck.deal(4));
        logEvent('Cartas repartidas a los jugadores.');

        this.activePlayerIndex = Math.floor(Math.random() * this.players.length);
        logEvent(`¡${this.getCurrentPlayer().name} comienza la ronda!`);

        const firstCard = this.deck.draw();
        logDebug(`Primera carta extraída del mazo: ${firstCard.toString()}`);
        
        animateCardFlight(firstCard, document.getElementById('deck-pile'), document.getElementById('discard-top-card'), () => {
            logDebug('Animación de la primera carta completada.');
            this.discardPile.push(firstCard);
            this.currentSuit = firstCard.suit;
            this.currentRank = firstCard.rank;
            updateUI();
            logEvent(`La primera carta en la pila de descarte es: ${firstCard.toString()}.`);
            this.applyFirstCardEffectAndContinue();
        });
    }

    applyFirstCardEffectAndContinue() {
        const firstPlayer = this.getCurrentPlayer();
        const topCard = this.getTopDiscardCard();
        logDebug(`applyFirstCardEffectAndContinue() llamado con la carta superior: ${topCard.toString()}`);

        if (topCard) {
            switch (topCard.specialType) {
                case 'skip_turn':
                    logEvent(`¡La primera carta es una Sota! ${firstPlayer.name} pierde su primer turno.`);
                    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
                    break;
                case 'draw_two':
                    logEvent(`¡La primera carta es un 7! ${firstPlayer.name} está bajo amenaza de robar 2 cartas.`);
                    this.drawPenaltyCount = 2;
                    break;
                case 'change_suit':
                    logEvent(`¡La primera carta es un Rey! ${firstPlayer.name} no elige un nuevo palo, pero puede jugar cualquier carta excepto otro Rey.`);
                    this.firstRoundKingRuleActive = true;
                    break;
            }
        }
        updateUI();
        if (!this.handleDrawPenalty()) {
            const currentPlayer = this.getCurrentPlayer();
            logDebug(`No se jugó contraataque. El turno continúa para ${currentPlayer.name}`);
            if (currentPlayer.isAI) {
                setTimeout(() => currentPlayer.aiPlay(this), 1500);
            } else {
                drawCardButton.disabled = false; // Permitir siempre robar carta al jugador humano
            }
        }
    }

    endRound(winner) {
        logDebug(`Fin de la ronda. Ganador: ${winner.name}`);
        this.gameStarted = false; // Pausar el juego mientras se muestra el resumen
    
        let maxPoints = -1;
        let losers = [];
        const playerScores = [];
    
        // Construir una lista de todos los jugadores que estaban en la ronda
        const roundPlayers = this.allPlayers.filter(p => this.players.includes(p));

        // Calcular puntos para todos los que no ganaron
        roundPlayers.forEach(player => {
            if (player !== winner) {
                const points = player.calculateRoundPoints();
                playerScores.push({ name: player.name, points: points, lives: player.lives });
                if (points > maxPoints) {
                    maxPoints = points;
                    losers = [player];
                } else if (points > 0 && points === maxPoints) {
                    losers.push(player);
                }
            } else {
                // El ganador tiene 0 puntos para esta ronda
                playerScores.push({ name: player.name, points: 0, lives: player.lives });
            }
        });
    
        // Construir el contenido del resumen
        let summaryHTML = `<h3>🏆 Ganador de la Ronda: ${winner.name} 🏆</h3>`;
        summaryHTML += '<h4>Puntuaciones de la Ronda:</h4>';
        summaryHTML += '<ul>';
        playerScores.sort((a,b) => b.points - a.points).forEach(ps => {
            summaryHTML += `<li>${ps.name}: ${ps.points} puntos</li>`;
        });
        summaryHTML += '</ul>';
    
        if (losers.length > 0) {
            const loserNames = losers.map(l => l.name).join(', ');
            summaryHTML += `<h4>💔 Perdedor(es) con ${maxPoints} puntos: ${loserNames}</h4>`;
            losers.forEach(loser => {
                loser.loseLife();
                summaryHTML += `<p>${loser.name} pierde una vida. Vidas restantes: ${loser.lives}</p>`;
                if (loser.isEliminated()) {
                    loser.eliminatedInRound = this.currentRound;
                    summaryHTML += `<p><strong>☠️ ${loser.name} ha sido eliminado del juego.</strong></p>`;
                }
            });
        } else if (roundPlayers.length > 1){
            summaryHTML += '<p>Nadie pierde una vida esta ronda.</p>';
        }
    
        roundSummaryTitle.textContent = `Fin de la Ronda ${this.currentRound}`;
        roundSummaryContent.innerHTML = summaryHTML;
        roundSummaryModal.classList.remove('hidden');
    
        const continueGame = () => {
            roundSummaryModal.classList.add('hidden');
            
            // Filtrar jugadores eliminados del array principal de jugadores activos
            this.players = this.players.filter(p => !p.isEliminated());
    
            // Comprobar si el juego ha terminado
            if (this.players.length <= 1) {
                this.endGame();
            } else {
                this.gameStarted = true; // Reanudar el juego
                this.startNewRound();
            }
        };
    
        // Usar { once: true } para que el listener se elimine solo
        nextRoundButton.addEventListener('click', continueGame, { once: true });
    }
    
    endGame() {
        this.gameStarted = false;
        let winner = this.players.length === 1 ? this.players[0] : null;
    
        // Usar el modal de resumen para el final del juego
        roundSummaryTitle.textContent = "🎉 Fin del Juego 🎉";
    
        let summaryHTML = '';
        if (winner) {
            summaryHTML += `<h3>👑 ¡${winner.name} ha ganado la partida! 👑</h3>`;
        } else {
            summaryHTML += "<h3>👑 ¡Empate! No hay un ganador claro. 👑</h3>";
        }
    
        const finalRanking = [...this.allPlayers].sort((a, b) => {
            if (a === winner) return -1;
            if (b === winner) return 1;
            if (a.isEliminated() && !b.isEliminated()) return 1;
            if (!a.isEliminated() && b.isEliminated()) return -1;
            return b.eliminatedInRound - a.eliminatedInRound;
        });
    
        summaryHTML += '<h4>Clasificación Final:</h4>';
        summaryHTML += '<ol>';
        finalRanking.forEach(p => {
            const status = p.isEliminated() ? `(Eliminado en ronda ${p.eliminatedInRound})` : '(Superviviente)';
            summaryHTML += `<li>${p.name} ${p === winner ? '🏆' : status}</li>`;
        });
        summaryHTML += '</ol>';
    
        roundSummaryContent.innerHTML = summaryHTML;
        nextRoundButton.textContent = 'Jugar de Nuevo';
        roundSummaryModal.classList.remove('hidden');
    
        const playAgain = () => {
            window.location.reload();
        };
    
        // Limpiar cualquier listener anterior y añadir el nuevo
        const newNextRoundButton = nextRoundButton.cloneNode(true);
        nextRoundButton.parentNode.replaceChild(newNextRoundButton, nextRoundButton);
        nextRoundButton = newNextRoundButton;
        nextRoundButton.addEventListener('click', playAgain, { once: true });
    }

    handleDrawPenalty() {
        if (this.drawPenaltyCount > 0) {
            logDebug(`handleDrawPenalty() llamado. Penalización de robo: ${this.drawPenaltyCount}`);
            const currentPlayer = this.getCurrentPlayer();
            const counterSeven = currentPlayer.hand.find(card => card.rank === SPECIAL_RANKS.SIETE);
            let playerCounters = false;

            if (counterSeven) {
                if (currentPlayer.isAI) playerCounters = true;
                else playerCounters = confirm(`${currentPlayer.name}, tienes un 7. ¿Quieres jugarlo para contraatacar?`);
                
                if (playerCounters) {
                    logEvent(`${currentPlayer.name} contraataca con un ${counterSeven.toString()}!`);
                    animateCardFlight(counterSeven, document.getElementById(`player-info-${currentPlayer.name.replace(/\s+/g, '-')}`), document.getElementById('discard-top-card'), () => {
                        this.playCard(currentPlayer, counterSeven, null, true);
                        updateUI();
                        this.nextTurn();
                    });
                    return true;
                }
            }

            logEvent(`${currentPlayer.name} no puede (o no quiere) contraatacar y roba ${this.drawPenaltyCount} cartas.`);
            this.drawCards(currentPlayer, this.drawPenaltyCount);
            this.drawPenaltyCount = 0;
            updateUI();

            if (!currentPlayer.isAI && !this.hasPlayableCards(currentPlayer)) {
                logEvent(`${currentPlayer.name} no tiene jugada después de robar y pasa el turno.`);
                this.nextTurn();
                return true;
            }
        }
        return false;
    }

    nextTurn() {
        logDebug('nextTurn() llamado.');
        gameMessageElement.textContent = '';
        
        let nextPlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
        if (this.skipNextTurn) {
            this.skipNextTurn = false;
            let skippedPlayer = this.players[nextPlayerIndex];
            while (skippedPlayer.isEliminated()) nextPlayerIndex = (nextPlayerIndex + 1) % this.players.length;
            logEvent(`Turno de ${skippedPlayer.name} saltado por una Sota.`);
            nextPlayerIndex = (nextPlayerIndex + 1) % this.players.length;
        }

        while (this.players[nextPlayerIndex].isEliminated()) nextPlayerIndex = (nextPlayerIndex + 1) % this.players.length;
        this.activePlayerIndex = nextPlayerIndex;
        
        const currentPlayer = this.getCurrentPlayer();
        logEvent(`Es el turno de ${currentPlayer.name}.`);
        updateUI();

        if (this.handleDrawPenalty()) return;

        if (currentPlayer.isAI) {
            drawCardButton.disabled = true;
            setTimeout(() => currentPlayer.aiPlay(this), 2000);
        } else {
            drawCardButton.disabled = false; // Permitir siempre robar carta al jugador humano
        }
    }
    
    getCurrentPlayer() { return this.players[this.activePlayerIndex]; }
    getTopDiscardCard() { return this.discardPile[this.discardPile.length - 1]; }
    isValidMove(card) {
        const topCard = this.getTopDiscardCard();
        if (!topCard) return true; // No hay carta en el descarte, cualquier jugada es válida

        // Regla 1: Si hay penalización por robo, solo se puede jugar un 7
        if (this.drawPenaltyCount > 0) {
            return card.rank === SPECIAL_RANKS.SIETE;
        }

        // Regla 2: Regla especial del Rey en la primera ronda
        if (this.firstRoundKingRuleActive) {
            // Se puede jugar cualquier carta EXCEPTO otro Rey
            return card.rank !== SPECIAL_RANKS.REY;
        }

        // Regla 3: Regla general para jugar un Rey
        if (card.specialType === 'change_suit') { // Si la carta a jugar es un Rey
            // Es válido SÓLO si la carta superior NO es un Rey
            return topCard.rank !== SPECIAL_RANKS.REY;
        }

        // Regla 4: Regla general - coincidir palo o número
        return card.suit === this.currentSuit || card.rank === this.currentRank;
    }
    hasPlayableCards(player) { return player.hand.some(card => this.isValidMove(card)); }

    playCard(player, card, chosenSuit = null, force = false) {
        logDebug(`playCard() llamado por ${player.name} con ${card.toString()}. Forzado: ${force}`);
        if (!player.hand.includes(card)) throw new Error('La carta no está en la mano del jugador.');
        if (!this.isValidMove(card) && !force) throw new Error('Movimiento inválido.');

        const previousSuit = this.currentSuit;
        player.removeCard(card);
        this.discardPile.push(card);
        this.currentRank = card.rank;
        logEvent(`${player.name} jugó ${card.toString()}`);

        switch (card.specialType) {
            case 'skip_turn':
                logEvent(`¡Sota! El siguiente jugador pierde su turno.`);
                this.skipNextTurn = true;
                this.currentSuit = card.suit;
                break;
            case 'change_suit':
                if (!chosenSuit || !Object.values(SUITS).includes(chosenSuit)) throw new Error('Debes elegir un palo para el Rey.');
                if (chosenSuit === previousSuit) throw new Error(`No puedes elegir el palo actual (${previousSuit}).`);
                this.currentSuit = chosenSuit;
                gameMessageElement.textContent = `${player.name} cambió el palo a ${chosenSuit}.`;
                logEvent(`${player.name} cambió el palo a ${chosenSuit}.`);
                break;
            case 'draw_two':
                this.drawPenaltyCount += 2;
                logEvent(`¡7! El siguiente jugador debe robar ${this.drawPenaltyCount} cartas.`);
                this.currentSuit = card.suit;
                break;
            default:
                this.currentSuit = card.suit;
                break;
        }

        if (this.firstRoundKingRuleActive) this.firstRoundKingRuleActive = false;

        if (!player.hasCards()) {
            this.endRound(player);
            return true;
        }
        return false;
    }

    drawCards(player, count = 1) {
        logDebug(`drawCards() llamado para ${player.name}, ${count} carta(s).`);
        for (let i = 0; i < count; i++) {
            if (this.deck.size === 0) {
                const lastDiscard = this.discardPile.pop();
                if(this.discardPile.length > 0) {
                    this.deck.cards = this.discardPile;
                    this.deck.shuffle();
                    this.discardPile = [lastDiscard];
                    logEvent('Mazo agotado, barajando pila de descarte.');
                } else {
                    this.discardPile.push(lastDiscard);
                    logEvent('No hay más cartas para robar.');
                    break;
                }
            }
            const drawnCard = this.deck.draw();
            player.addCard(drawnCard);
            if(player.isAI){
                logEvent(`${player.name} roba una carta.`);
            } else {
                logEvent(`${player.name} robó ${drawnCard.toString()}`);
            }
        }
        updateUI();
    }
}


// --- INICIALIZACIÓN Y MANEJADORES DE EVENTOS ---

document.addEventListener('DOMContentLoaded', () => {
    logDebug('DOM Content Loaded! Initializing...');

    // Asignación de elementos
    gameInfoElement = document.getElementById('game-info');
    currentRoundElement = document.getElementById('current-round');
    currentPlayerNameElement = document.getElementById('current-player-name');
    gameMessageElement = document.getElementById('game-message');
    playersInfoElement = document.getElementById('players-info');
    deckSizeElement = document.getElementById('deck-size');
    discardTopCardElement = document.getElementById('discard-top-card');
    drawCardButton = document.getElementById('draw-card-button');
    startGameButton = document.getElementById('start-game-button');
    suitSelectionElement = document.getElementById('suit-selection');
    gameLogElement = document.getElementById('game-log');
    currentSuitValueElement = document.getElementById('current-suit-value');
    humanPlayerHandAreaElement = document.getElementById('human-player-hand-area');
    nameInputModal = document.getElementById('name-input-modal');
    playerNameInput = document.getElementById('player-name-input');
    confirmNameButton = document.getElementById('confirm-name-button');
    livesSelectionModal = document.getElementById('lives-selection-modal');
    aiPlayerSelectionModal = document.getElementById('ai-player-selection-modal');
    aiDifficultySelectionModal = document.getElementById('ai-difficulty-selection-modal');
    aiNameSelectionModal = document.getElementById('ai-name-selection-modal');
    aiNameForm = document.getElementById('ai-name-form');
    startGameFromNamesButton = document.getElementById('start-game-from-names-button');
    randomNameSelectionModal = document.getElementById('random-name-selection-modal');
    const randomNamesYesButton = document.getElementById('random-names-yes');
    const randomNamesNoButton = document.getElementById('random-names-no');
    musicSelectionModal = document.getElementById('music-selection-modal');
    const musicYesButton = document.getElementById('music-yes');
    const musicNoButton = document.getElementById('music-no'); // Corrected typo here
    volumeSliderElement = document.getElementById('volume-slider'); // Get reference to the slider
    
    // Inicializar el objeto de audio
    backgroundMusic = new Audio('assets/chill.mp3');
    backgroundMusic.loop = true; // Asegurarse de que la música se repita
    backgroundMusic.volume = parseFloat(volumeSliderElement.value); // Set initial volume
    
    showRulesButton = document.getElementById('show-rules-button');
    rulesModal = document.getElementById('rules-modal');
    closeRulesButton = document.getElementById('close-rules-button');
    const livesButtons = livesSelectionModal.querySelectorAll('button');
    const aiPlayerButtons = aiPlayerSelectionModal.querySelectorAll('button');
    const aiDifficultyButtons = aiDifficultySelectionModal.querySelectorAll('button');
    
    // Nuevos elementos para el modal de resumen de ronda
    roundSummaryModal = document.getElementById('round-summary-modal');
    roundSummaryTitle = document.getElementById('round-summary-title');
    roundSummaryContent = document.getElementById('round-summary-content');
    nextRoundButton = document.getElementById('next-round-button');
    
    // Manejadores de eventos del flujo de configuración
    startGameButton.addEventListener('click', () => {
        aiPlayerSelectionModal.style.display = 'flex';
        startGameButton.style.display = 'none';
        showRulesButton.style.display = 'none';
    });
    
    aiPlayerButtons.forEach(button => button.addEventListener('click', e => {
        selectedAiPlayers = parseInt(e.target.dataset.aiPlayers, 10);
        aiPlayerSelectionModal.style.display = 'none';
        randomNameSelectionModal.style.display = 'flex';
    }));
    
    randomNamesYesButton.addEventListener('click', () => {
        useRandomAiNames = true;
        randomNameSelectionModal.style.display = 'none';
        aiDifficultySelectionModal.style.display = 'flex';
    });
    
    randomNamesNoButton.addEventListener('click', () => {
        useRandomAiNames = false;
        randomNameSelectionModal.style.display = 'none';
        aiNameForm.innerHTML = '';
        for (let i = 0; i < selectedAiPlayers; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Nombre IA ${i + 1}`;
            input.id = `ai-name-${i}`;
            aiNameForm.appendChild(input);
        }
        aiNameSelectionModal.style.display = 'flex';
    });
    
    startGameFromNamesButton.addEventListener('click', () => {
        customAiNames = [];
        for (let i = 0; i < selectedAiPlayers; i++) {
            const input = document.getElementById(`ai-name-${i}`);
            const name = input.value.trim();
            if (!name) return alert(`Por favor, introduce un nombre para el jugador IA ${i + 1}.`);
            customAiNames.push(name);
        }
        aiNameSelectionModal.style.display = 'none';
        aiDifficultySelectionModal.style.display = 'flex';
    });
    
    aiDifficultyButtons.forEach(button => button.addEventListener('click', e => {
        selectedDifficulty = e.target.dataset.difficulty;
        aiDifficultySelectionModal.style.display = 'none';
        livesSelectionModal.style.display = 'flex';
    }));
    
    livesButtons.forEach(button => button.addEventListener('click', e => {
        selectedLives = parseInt(e.target.dataset.lives, 10);
        livesSelectionModal.style.display = 'none';
        musicSelectionModal.style.display = 'flex';
    }));
    
    musicYesButton.addEventListener('click', () => {
        withMusic = true;
        backgroundMusic.play().catch(e => console.error("Error al reproducir música:", e));
        musicSelectionModal.style.display = 'none';
        nameInputModal.style.display = 'flex';
    });
    
    musicNoButton.addEventListener('click', () => {
        withMusic = false;
        backgroundMusic.pause();
        musicSelectionModal.style.display = 'none';
        nameInputModal.style.display = 'flex';
    });
    
    // Event listener para el control de volumen
    volumeSliderElement.addEventListener('input', (event) => {
        backgroundMusic.volume = parseFloat(event.target.value);
    });
    
    confirmNameButton.addEventListener('click', () => {
        const playerName = playerNameInput.value.trim();
        if (!playerName) return alert('Debes introducir un nombre para jugar.');
        
        nameInputModal.style.display = 'none';
        
        const aiNames = useRandomAiNames ? getRandomAINames(selectedAiPlayers) : customAiNames;
        const playerConfigs = [{ name: playerName, isAI: false, difficulty: null }];
        aiNames.forEach(name => playerConfigs.push({ name, isAI: true, difficulty: selectedDifficulty }));
        
        logEvent('Configuración finalizada. Creando e iniciando el juego...');
        game = new Game(playerConfigs, selectedLives);
        game.startGame();
        updateUI();
    });
    drawCardButton.addEventListener('click', () => {
        if (!game || !game.gameStarted || game.getCurrentPlayer().isAI) return;
        
        drawCardButton.disabled = true;
        logDebug('Jugador humano roba una carta.');
        game.drawCards(game.getCurrentPlayer(), 1);

        if (game.hasPlayableCards(game.getCurrentPlayer())) {
            gameMessageElement.textContent = '¡Ahora tienes jugada! Juega una carta.';
        } else {
            logEvent(`${game.getCurrentPlayer().name} no puede jugar y pasa el turno.`);
            setTimeout(() => game.nextTurn(), 1500);
        }
        updateUI();
    });

    showRulesButton.addEventListener('click', () => { rulesModal.style.display = 'flex'; });
    closeRulesButton.addEventListener('click', () => { rulesModal.style.display = 'none'; });



    logDebug('Todos los detectores de eventos de la UI están configurados.');
});