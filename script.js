// script.js

// Constantes para los palos de la baraja española
const SUITS = {
    OROS: 'oros',
    COPAS: 'copas',
    ESPADAS: 'espadas',
    BASTOS: 'bastos'
};

// Mapping for suit abbreviations in filenames
const SUIT_ABBREVIATIONS = {
    [SUITS.OROS]: 'o',
    [SUITS.COPAS]: 'c',
    [SUITS.ESPADAS]: 'e',
    [SUITS.BASTOS]: 'b'
};

// Constantes para los rangos de las cartas especiales
const SPECIAL_RANKS = {
    SOTA: 10,
    CABALLO: 11, // Aunque no es especial en este juego, es parte de la baraja española
    REY: 12,
    SIETE: 7
};

class Card {
    constructor(suit, rank) {
        if (!Object.values(SUITS).includes(suit)) {
            throw new Error(`Palo inválido: ${suit}`);
        }
        if (rank < 1 || rank > 12) {
            throw new Error(`Rango inválido: ${rank}`);
        }

        this.suit = suit;
        this.rank = rank;
        this.specialType = this._getSpecialType(rank);
    }

    _getSpecialType(rank) {
        switch (rank) {
            case SPECIAL_RANKS.SOTA:
                return 'skip_turn';
            case SPECIAL_RANKS.REY:
                return 'change_suit';
            case SPECIAL_RANKS.SIETE:
                return 'draw_two';
            default:
                return null;
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
        this.lives = 0; // Se establecerán al iniciar el juego
        this.points = 0; // Puntos acumulados en la ronda actual
        this.isAI = isAI;
        this.difficulty = difficulty; // 'easy', 'medium', 'hard'
        this.eliminatedInRound = 0; // Track the round the player was eliminated in
    }

    addCard(card) {
        this.hand.push(card);
    }

    removeCard(cardToRemove) {
        this.hand = this.hand.filter(card => card !== cardToRemove);
    }

    hasCards() {
        return this.hand.length > 0;
    }

    calculateRoundPoints() {
        let roundPoints = 0;
        for (const card of this.hand) {
            switch (card.rank) {
                case 1: // As
                case SPECIAL_RANKS.SOTA: // 10
                case SPECIAL_RANKS.CABALLO: // 11
                    roundPoints += 11;
                    break;
                case SPECIAL_RANKS.SIETE: // 7
                case SPECIAL_RANKS.REY: // 12
                    roundPoints += 20;
                    break;
                default:
                    roundPoints += card.rank; // For 2, 3, 4, 5, 6
            }
        }
        this.points = roundPoints;
        return roundPoints;
    }

    loseLife() {
        this.lives--;
    }

    isEliminated() {
        return this.lives <= 0;
    }

    aiPlay(game) {
        const startElement = document.getElementById(`player-info-${this.name.replace(/\s+/g, '-')}`);
        const endElement = document.getElementById('discard-top-card');

        let playableCards = this.hand.filter(card => game.isValidMove(card));
        let cardToPlay = null;
        let chosenSuit = null;

        if (playableCards.length > 0) {
            // La IA tiene cartas para jugar, elige una.
            switch (this.difficulty) {
                case 'easy':
                    cardToPlay = playableCards[0];
                    break;
                case 'medium':
                    playableCards.sort((a, b) => a.rank - b.rank);
                    cardToPlay = playableCards[0];
                    break;
                case 'hard':
                    const specialCards = playableCards.filter(c => c.specialType);
                    if (specialCards.length > 0) {
                        cardToPlay = specialCards[0];
                    } else {
                        playableCards.sort((a, b) => b.rank - a.rank);
                        cardToPlay = playableCards[0];
                    }
                    break;
                default:
                    cardToPlay = playableCards[0];
            }

            if (cardToPlay.specialType === 'change_suit') {
                chosenSuit = this._getMostCommonSuitInHand() || Object.values(SUITS)[0];
            }

            animateCardFlight(cardToPlay, startElement, endElement, () => {
                const roundEnded = game.playCard(this, cardToPlay, chosenSuit);
                updateUI();
                if (!roundEnded) {
                    game.nextTurn();
                }
            });

        } else {
            // No hay cartas para jugar, la IA debe robar.
            logMessage(`${this.name} no tiene jugada y roba una carta.`);
            game.drawCards(this, 1);
            updateUI();

            // Vuelve a comprobar si puede jugar después de robar.
            playableCards = this.hand.filter(card => game.isValidMove(card));

            setTimeout(() => { // Delay para simular pensamiento después de robar
                if (playableCards.length > 0) {
                    // Juega la primera válida (simple)
                    cardToPlay = playableCards[0];
                    if (cardToPlay.specialType === 'change_suit') {
                        chosenSuit = this._getMostCommonSuitInHand() || Object.values(SUITS)[0];
                    }
                    
                    animateCardFlight(cardToPlay, startElement, endElement, () => {
                        const roundEnded = game.playCard(this, cardToPlay, chosenSuit);
                        updateUI();
                        if (!roundEnded) {
                            game.nextTurn();
                        }
                    });
                } else {
                    logMessage(`${this.name} sigue sin poder jugar y pasa el turno.`);
                    game.nextTurn();
                }
            }, 1000);
        }
    }

    _getMostCommonSuitInHand() {
        const suitCounts = {};
        for (const card of this.hand) {
            suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
        }
        let mostCommonSuit = null;
        let maxCount = 0;
        for (const suit in suitCounts) {
            if (suitCounts[suit] > maxCount) {
                maxCount = suitCounts[suit];
                mostCommonSuit = suit;
            }
        }
        return mostCommonSuit;
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        for (let i = 0; i < 2; i++) { // Añadir dos barajas completas
            for (const suit of Object.values(SUITS)) {
                for (let rank = 1; rank <= 12; rank++) {
                    if (rank === 8 || rank === 9) {
                        continue; // Skip ranks 8 and 9
                    }
                    this.cards.push(new Card(suit, rank));
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

    deal(count) {
        return this.cards.splice(0, count);
    }

    draw() {
        return this.cards.pop();
    }

    get size() {
        return this.cards.length;
    }
}

class Game {
    constructor(playerConfigs, startingLives = 5) {
        this.startingLives = startingLives;
        this.players = playerConfigs.map(config => new Player(config.name, config.isAI, config.difficulty));
        this.allPlayers = [...this.players]; // Store all initial players for final summary
        this.deck = new Deck();
        this.discardPile = [];
        this.currentRound = 0;
        this.activePlayerIndex = 0;
        this.currentSuit = null; // Palo actual en juego
        this.currentRank = null; // Rango actual en juego
        this.drawPenaltyCount = 0; // Contador para sietes acumulados
        this.gameStarted = false;
        this.firstRoundKingRuleActive = false;
    }

    startGame() {
        this.gameStarted = true;
        this.currentRound = 0;
        this.players.forEach(player => {
            player.lives = this.startingLives;
            player.hand = [];
            player.points = 0;
        });
        this.startNewRound();
    }

    async startNewRound() { // Make it async
        this.currentRound++;
        this.deck.reset();
        this.deck.shuffle();
        this.discardPile = [];
        this.players.forEach(player => {
            player.hand = this.deck.deal(4);
            player.points = 0;
        });

        this.activePlayerIndex = Math.floor(Math.random() * this.players.length);
        logMessage(`¡${this.getCurrentPlayer().name} comienza la ronda!`);

        // Animar la primera carta del mazo al descarte
        const firstCard = this.deck.draw();
        const startElement = document.getElementById('deck-pile');
        const endElement = document.getElementById('discard-top-card');

        animateCardFlight(firstCard, startElement, endElement, async () => { // Make callback async
            this.discardPile.push(firstCard);
            this.currentSuit = firstCard.suit;
            this.currentRank = firstCard.rank;
            updateUI(); // Mostrar la carta en el descarte permanentemente

            logMessage(`La primera carta en la pila de descarte es: ${firstCard.toString()}.`);

            // Aplicar efecto de la primera carta si es especial
            const firstPlayer = this.players[0];
            let turnAdvanced = false;
            switch (firstCard.specialType) {
                case 'skip_turn':
                    logMessage(`¡La primera carta es una Sota! ${firstPlayer.name} pierde su primer turno.`);
                    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
                    turnAdvanced = true;
                    break;
                case 'draw_two': // Siete
                    logMessage(`¡La primera carta es un 7! ${firstPlayer.name} está bajo amenaza de robar 2 cartas.`);
                    this.drawPenaltyCount = 2;
                    break;
                case 'change_suit': // Rey
                    logMessage(`¡La primera carta es un Rey! ${firstPlayer.name} debe elegir un nuevo palo.`);
                    if (this.currentRound === 1) {
                        this.firstRoundKingRuleActive = true;
                        logMessage(`¡Es la primera ronda y salió un Rey! El jugador actual puede jugar cualquier carta excepto otro Rey.`);
                    }
                    let chosenSuit = null;
                    if (firstPlayer.isAI) {
                        chosenSuit = firstPlayer._getMostCommonSuitInHand() || Object.values(SUITS)[0];
                        logMessage(`${firstPlayer.name} (IA) ha elegido ${chosenSuit}.`);
                    } else {
                        chosenSuit = await promptForSuitSelection(); // Use await for suit selection
                        if (chosenSuit) {
                            logMessage(`${firstPlayer.name} ha elegido ${chosenSuit}.`);
                        } else {
                            chosenSuit = firstCard.suit; // Fallback if selection is somehow cancelled
                            logMessage('No se eligió palo, se mantiene el original.');
                        }
                    }
                    this.currentSuit = chosenSuit;
                    break;
            }

            updateUI();

            // Handle penalty for the first player, if any. If they counter, the turn advances.
            const counterPlayed = this.handleDrawPenalty();

            // If no counter was played, start the turn for the current player
            if (!counterPlayed) {
                const currentPlayer = this.getCurrentPlayer();
                if (currentPlayer.isAI) {
                    setTimeout(() => currentPlayer.aiPlay(this), 1500);
                } else {
                    drawCardButton.disabled = this.hasPlayableCards(currentPlayer);
                }
            }
        });
    }

    endRound(winner) {
        let maxPoints = -1;
        let losers = [];
        const winnerName = winner.name;

        // Mensaje para el ganador
        if (!winner.isAI) {
            gameMessageElement.textContent = "🏆 Has ganado la ronda tirando tu última carta.";
        } else {
            gameMessageElement.textContent = `🏆 ${winnerName} ha ganado la ronda.`;
        }
        logMessage(`Ronda terminada. Ganador: ${winnerName}`);
        updateUI();

        // Calcular puntos para los demás jugadores
        this.players.forEach(player => {
            if (player !== winner) {
                const points = player.calculateRoundPoints();
                if (points > maxPoints) {
                    maxPoints = points;
                    losers = [player];
                } else if (points > 0 && points === maxPoints) {
                    losers.push(player);
                }
            }
        });

        if (losers.length === 0) {
             setTimeout(() => {
                this.startNewRound();
            }, 3000);
            return;
        }

        const loserNames = losers.map(l => l.name).join(', ');

        // Secuencia de mensajes con timeouts
        setTimeout(() => {
            gameMessageElement.textContent = `📊 Ronda finalizada. Ganador: ${winnerName}. Perdedor(es): ${loserNames}.`;
        }, 2500);

        losers.forEach((loser, index) => {
            const baseDelay = 4500 + (index * 5000);
            setTimeout(() => {
                loser.loseLife();
                let loserMsg = `❌ ${loser.name} pierde la ronda con ${maxPoints} puntos.`;
                if (!loser.isAI) {
                    loserMsg = `❌ Has perdido la ronda por ser el jugador con más puntos: ${maxPoints} puntos.`;
                }
                gameMessageElement.textContent = loserMsg;
                updatePlayersInfo();

                setTimeout(() => {
                    let lifeMsg = `❤️ ${loser.name} ha perdido una vida. Le quedan ${loser.lives} vidas.`;
                    if (!loser.isAI) {
                        lifeMsg = `❤️ Has perdido una vida. Te quedan ${loser.lives} vidas.`;
                    }
                    gameMessageElement.textContent = lifeMsg;

                    if (loser.isEliminated()) {
                        loser.eliminatedInRound = this.currentRound; // Set elimination round
                        setTimeout(() => {
                            gameMessageElement.textContent = `☠️ El jugador ${loser.name} ha sido eliminado de la partida.`;
                        }, 2000);
                    }
                }, 2500);

            }, baseDelay);
        });

        const totalDelay = 4500 + (losers.length * 5000);

        setTimeout(() => {
            let livesSummary = "Estado de vidas:\n";
            this.players.forEach(player => {
                livesSummary += `- ${player.name}: ${player.lives} vidas restantes ${player.isEliminated() ? '(Eliminado)' : ''}\n`;
            });
            gameMessageElement.textContent = livesSummary;
        }, totalDelay);

        setTimeout(() => {
            gameMessageElement.textContent = ''; // Clear the message before starting a new round or ending the game
            this.players = this.players.filter(player => !player.isEliminated());
            if (this.players.length <= 1) {
                this.endGame();
            } else {
                this.startNewRound();
            }
        }, totalDelay + 3000); // Add extra delay for the lives summary
    }

    endGame() {
        this.gameStarted = false;
        let finalMessage = "El juego ha terminado.";

        let winner = null;
        if (this.players.length === 1) {
            winner = this.players[0];
            finalMessage = `🎉 ¡${winner.name} ha ganado la partida! 🎉\n\n`;
        } else {
            finalMessage = "👑 ¡Empate! No hay un ganador claro. 👑\n\n";
        }

        // Sort all players for the final ranking
        const finalRanking = [...this.allPlayers].sort((a, b) => {
            // Winner (if any) comes first
            if (a === winner) return -1;
            if (b === winner) return 1;

            // Players not eliminated (still in this.players) come next
            const aStillInGame = this.players.includes(a);
            const bStillInGame = this.players.includes(b);

            if (aStillInGame && !bStillInGame) return -1;
            if (!aStillInGame && bStillInGame) return 1;

            // Then by elimination round (earlier elimination means lower rank)
            return b.eliminatedInRound - a.eliminatedInRound;
        });

        finalMessage += "--- Clasificación Final ---\n";
        finalRanking.forEach((player, index) => {
            let status = "";
            if (player === winner) {
                status = "Ganador";
            } else if (player.eliminatedInRound > 0) {
                status = `Eliminado en Ronda ${player.eliminatedInRound}`;
            } else {
                status = "No eliminado (Empate)"; // Should only happen in a multi-player tie
            }
            finalMessage += `${index + 1}. ${player.name} - ${status}\n`;
        });
        
        gameMessageElement.textContent = finalMessage;
        
        const playAgainButton = document.createElement('button');
        playAgainButton.textContent = 'Jugar de Nuevo';
        playAgainButton.addEventListener('click', () => {
            window.location.reload(); // La forma más simple de reiniciar
        });
        
        const actionButtons = document.getElementById('action-buttons');
        actionButtons.innerHTML = '';
        actionButtons.appendChild(playAgainButton);
    }

    handleDrawPenalty() {
        if (this.drawPenaltyCount > 0) {
            const currentPlayer = this.getCurrentPlayer();
            const counterSeven = currentPlayer.hand.find(card => card.rank === SPECIAL_RANKS.SIETE);
            let playerCounters = false;

            if (counterSeven) {
                if (currentPlayer.isAI) {
                    playerCounters = true; // AI always counters
                } else {
                    playerCounters = confirm(`${currentPlayer.name}, tienes un 7. ¿Quieres jugarlo para contraatacar y que el siguiente jugador robe ${this.drawPenaltyCount + 2} cartas?`);
                }

                if (playerCounters) {
                    logMessage(`${currentPlayer.name} contraataca con un ${counterSeven.toString()}!`);
                    const startElement = currentPlayer.isAI 
                        ? document.getElementById(`player-info-${currentPlayer.name.replace(/\s+/g, '-')}`) 
                        : document.querySelector(`.player-hand.current-player-hand .card-image[data-rank='7']`);
                    const endElement = document.getElementById('discard-top-card');
                    
                    animateCardFlight(counterSeven, startElement, endElement, () => {
                        this.playCard(currentPlayer, counterSeven, null, true); // Force play
                        updateUI();
                        this.nextTurn(); // Pass to the next player
                    });
                    return true; // Indicates a counter was played and turn is advancing
                }
            }

            // No counter-play
            logMessage(`${currentPlayer.name} no puede (o no quiere) contraatacar y roba ${this.drawPenaltyCount} cartas.`);
            this.drawCards(currentPlayer, this.drawPenaltyCount);
            this.drawPenaltyCount = 0;
            updateUI();

            // After drawing, if the player still has no playable cards, their turn ends.
            if (!this.hasPlayableCards(currentPlayer)) {
                logMessage(`${currentPlayer.name} no tiene jugada después de robar y pasa el turno.`);
                return true; // Indicate that the turn should end
            }
        }
        return false; // No penalty was active, no counter was played, or player can now play
    }

    nextTurn() {
        // 1. Determine the base next player and handle skips
        let nextPlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
        if (this.skipNextTurn) {
            this.skipNextTurn = false;
            let skippedPlayer = this.players[nextPlayerIndex];
            while (skippedPlayer.isEliminated()) {
                nextPlayerIndex = (nextPlayerIndex + 1) % this.players.length;
                skippedPlayer = this.players[nextPlayerIndex];
            }
            logMessage(`Turno de ${skippedPlayer.name} saltado por una Sota.`);
            nextPlayerIndex = (nextPlayerIndex + 1) % this.players.length;
        }

        // 2. Find the next non-eliminated player
        while (this.players[nextPlayerIndex].isEliminated()) {
            nextPlayerIndex = (nextPlayerIndex + 1) % this.players.length;
        }
        this.activePlayerIndex = nextPlayerIndex;
        
        const currentPlayer = this.getCurrentPlayer();
        logMessage(`Es el turno de ${currentPlayer.name}.`);
        updateUI();

        // 3. Handle draw penalty from 7s. If a counter is played, stop this turn.
        if (this.handleDrawPenalty()) {
            return;
        }

        // 4. If the current player is an AI, trigger its turn
        if (currentPlayer.isAI) {
            drawCardButton.disabled = true;
            setTimeout(() => {
                currentPlayer.aiPlay(this);
            }, 2000);
        } else {
            drawCardButton.disabled = this.hasPlayableCards(currentPlayer);
        }
    }

    getCurrentPlayer() {
        return this.players[this.activePlayerIndex];
    }

    getTopDiscardCard() {
        return this.discardPile[this.discardPile.length - 1];
    }

    isValidMove(card) {
        const topCard = this.getTopDiscardCard();

        // If a draw penalty is active, the only valid move is another 7
        if (this.drawPenaltyCount > 0) {
            return card.rank === SPECIAL_RANKS.SIETE;
        }

        // Special rule for first round if a King was the starting card
        if (this.firstRoundKingRuleActive && topCard.rank === SPECIAL_RANKS.REY) {
            return card.rank !== SPECIAL_RANKS.REY; // Can play any card except another King
        }

        // Rule: If the top card was a King, you can't play another King.
        // You must play a card of the suit chosen by the King's player.
        if (this.currentRank === SPECIAL_RANKS.REY) {
            // If the top card is a King, you cannot play another King.
            // You must play a card of the current suit (which was chosen by the previous King player).
            return card.rank !== SPECIAL_RANKS.REY && card.suit === this.currentSuit;
        }

        // General rule: match suit, rank, or play a King (to change suit)
        return card.suit === this.currentSuit || card.rank === this.currentRank || card.specialType === 'change_suit';
    }

    hasPlayableCards(player) {
        return player.hand.some(card => this.isValidMove(card));
    }

    playCard(player, card, chosenSuit = null, force = false) {
        if (!player.hand.includes(card)) {
            throw new Error('La carta no está en la mano del jugador.');
        }

        // Se aplican las reglas normales de movimiento, a menos que se fuerce la jugada (para contraatacar un 7)
        if (!this.isValidMove(card) && !force) {
            throw new Error('Movimiento inválido. La carta no coincide con el palo o el número de la carta superior.');
        }

        player.removeCard(card);
        this.discardPile.push(card);
        this.currentSuit = card.suit;
        this.currentRank = card.rank;

        logMessage(`${player.name} jugó ${card.toString()}`);

        // Aplicar efectos de cartas especiales
        switch (card.specialType) {
            case 'skip_turn':
                logMessage(`¡Sota! El siguiente jugador pierde su turno.`);
                this.skipNextTurn = true;
                break;
            case 'change_suit':
                if (!chosenSuit || !Object.values(SUITS).includes(chosenSuit)) {
                    throw new Error('Debes elegir un palo para el Rey.');
                }
                this.currentSuit = chosenSuit;
                logMessage(`¡Rey! El palo ha cambiado a ${chosenSuit}.`);
                break;
            case 'draw_two':
                this.drawPenaltyCount += 2;
                logMessage(`¡7! El siguiente jugador debe robar ${this.drawPenaltyCount} cartas.`);
                break;
        }

        // Reset the first round King rule after a card has been played under it
        if (this.firstRoundKingRuleActive) {
            this.firstRoundKingRuleActive = false;
            logMessage('La regla especial del Rey de la primera ronda ha sido desactivada.');
        }

        // Comprobar si el jugador se quedó sin cartas para terminar la ronda
        if (!player.hasCards()) {
            this.endRound(player); // La ronda ha terminado, pasar el ganador
            return true; 
        }
        return false; // La ronda continúa
    }

    drawCards(player, count = 1) {
        for (let i = 0; i < count; i++) {
            if (this.deck.size === 0) {
                const lastDiscardCard = this.discardPile.pop();
                if (this.discardPile.length > 0) {
                    this.deck.cards = this.discardPile;
                    this.deck.shuffle();
                    this.discardPile = [lastDiscardCard];
                    logMessage('Mazo agotado, barajando pila de descarte.');
                } else {
                    this.discardPile.push(lastDiscardCard);
                    logMessage('No hay más cartas para robar.');
                    break; // No more cards to draw
                }
            }
            const drawnCard = this.deck.draw();
            player.addCard(drawnCard);
            if (player.isAI) {
                logMessage(`${player.name} roba una carta.`);
            } else {
                logMessage(`${player.name} robó ${drawnCard.toString()}`);
            }
        }
        updateUI();
    }
}

// --- Lógica de Interfaz de Usuario (UI) ---

const gameInfoElement = document.getElementById('game-info');
const currentRoundElement = document.getElementById('current-round');
const currentPlayerNameElement = document.getElementById('current-player-name');
const gameMessageElement = document.getElementById('game-message');
const playersInfoElement = document.getElementById('players-info');
const deckSizeElement = document.getElementById('deck-size');
const discardTopCardElement = document.getElementById('discard-top-card');
const playerHandsElement = document.getElementById('player-hands');
const drawCardButton = document.getElementById('draw-card-button');
const startGameButton = document.getElementById('start-game-button');
const suitSelectionElement = document.getElementById('suit-selection');
const gameLogElement = document.getElementById('game-log');
const currentSuitValueElement = document.getElementById('current-suit-value');

const nameInputModal = document.getElementById('name-input-modal');
const playerNameInput = document.getElementById('player-name-input');
const confirmNameButton = document.getElementById('confirm-name-button');

const livesSelectionModal = document.getElementById('lives-selection-modal');
const livesButtons = livesSelectionModal.querySelectorAll('button');

let game; // Instancia del juego

const AI_NAMES = ["Sofía", "Mateo", "Valentina", "Santiago", "Isabella", "Leo", "Camila", "Thiago", "Lucía", "Daniel"];

function getRandomAINames(count) {
    const shuffled = AI_NAMES.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function logMessage(message) {
    if (gameLogElement) {
        const p = document.createElement('p');
        p.textContent = message;
        // Insert at the top, so it works with flex-direction: column-reverse
        gameLogElement.insertBefore(p, gameLogElement.firstChild);
    }
}

function animateCardFlight(card, startElement, endElement, callback) {
    const flyingCard = createVisualCardElement(card);
    flyingCard.classList.add('flying-card');
    document.body.appendChild(flyingCard);

    const startRect = startElement.getBoundingClientRect();
    const endRect = endElement.getBoundingClientRect();

    // Posición inicial (centro del elemento de origen)
    const startX = startRect.left + (startRect.width / 2) - (flyingCard.width / 2);
    const startY = startRect.top + (startRect.height / 2) - (flyingCard.height / 2);

    flyingCard.style.left = `${startX}px`;
    flyingCard.style.top = `${startY}px`;
    flyingCard.style.opacity = '1';

    // Pequeño retraso para asegurar que la posición inicial se aplique antes de la transición
    requestAnimationFrame(() => {
        setTimeout(() => {
            const endX = endRect.left + (endRect.width / 2) - (flyingCard.width / 2);
            const endY = endRect.top + (endRect.height / 2) - (flyingCard.height / 2);
            flyingCard.style.transform = `translate(${endX - startX}px, ${endY - startY}px)`;
        }, 20);
    });

    // Después de la animación
    setTimeout(() => {
        flyingCard.remove();
        if (callback) {
            callback();
        }
    }, 800); // Duración debe ser un poco menor que la transición en CSS para evitar parpadeo
}

function promptForSuitSelection() {
    return new Promise(resolve => {
        suitSelectionElement.classList.remove('hidden');
        const suitButtons = suitSelectionElement.querySelectorAll('button');

        const handleSuitSelection = (event) => {
            const chosenSuit = event.target.dataset.suit;
            suitSelectionElement.classList.add('hidden');
            suitButtons.forEach(button => button.removeEventListener('click', handleSuitSelection));
            resolve(chosenSuit);
        };

        suitButtons.forEach(button => {
            button.addEventListener('click', handleSuitSelection);
        });
    });
}

async function handlePlayCard(e, card) { // Make it async
    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.isAI) return;

    const startElement = e.target;
    const endElement = document.getElementById('discard-top-card');

    // Deshabilitar la mano del jugador para evitar múltiples jugadas durante la animación
    const playerHandElement = startElement.closest('.player-hand');
    if (playerHandElement) {
        playerHandElement.querySelectorAll('.card-image').forEach(c => c.classList.remove('playable'));
    }

    animateCardFlight(card, startElement, endElement, async () => { // Make callback async
        try {
            let chosenSuit = null;
            if (card.specialType === 'change_suit') {
                chosenSuit = await promptForSuitSelection(); // Use await for suit selection
                if (!chosenSuit) {
                    // If the player cancels (though promptForSuitSelection doesn't allow cancel directly),
                    // or if there's an issue, reactivate UI and return.
                    updateUI();
                    return;
                }
            }

            const roundEnded = game.playCard(currentPlayer, card, chosenSuit);
            updateUI(); // Actualiza la UI para que la carta desaparezca de la mano

            if (!roundEnded) {
                game.nextTurn();
            }
        } catch (error) {
            alert(error.message);
            updateUI(); // Reactivar la mano en caso de error
        }
    });
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

    // Special case for 7 of Oros
    if (card.rank === SPECIAL_RANKS.SIETE && card.suit === SUITS.OROS) {
        filename = '7 oros.png';
    }
    cardElement.src = `assets/cards/${filename}`;
    cardElement.alt = card.toString();
    return cardElement;
}

function updateUI() {
    if (!game) return; // No actualizar si el juego no ha sido inicializado

    currentRoundElement.textContent = game.currentRound;
    currentPlayerNameElement.textContent = game.getCurrentPlayer().name;
    deckSizeElement.textContent = `Cartas en mazo: ${game.deck.size}`;

    discardTopCardElement.src = ''; // Clear previous image
    discardTopCardElement.alt = ''; // Clear previous alt text

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

        // Special case for 7 of Oros
        if (topDiscardCard.rank === SPECIAL_RANKS.SIETE && topDiscardCard.suit === SUITS.OROS) {
            filename = '7 oros.png';
        }
        discardTopCardElement.src = `assets/cards/${filename}`;
        discardTopCardElement.alt = topDiscardCard.toString();
    }

    // Update current suit indicator
    if (currentSuitValueElement) {
        let suitText = 'N/A';
        if (game.currentSuit) {
            const suit = game.currentSuit;
            const suitName = suit.charAt(0).toUpperCase() + suit.slice(1);
            let suitEmoji = '';
            if (suit === SUITS.OROS) suitEmoji = '🪙';
            if (suit === SUITS.COPAS) suitEmoji = '🍷';
            if (suit === SUITS.ESPADAS) suitEmoji = '⚔️';
            if (suit === SUITS.BASTOS) suitEmoji = '🌿';
            suitText = `${suitName} ${suitEmoji}`;
        }
        currentSuitValueElement.innerHTML = suitText;
    }

    updatePlayerHands();
    updatePlayersInfo();
}

function updatePlayerHands() {
    playerHandsElement.innerHTML = ''; // Limpiar manos anteriores
    game.players.forEach(player => {
        const playerHandContainer = document.createElement('div');
        playerHandContainer.classList.add('player-hand');
        if (player === game.getCurrentPlayer()) {
            playerHandContainer.classList.add('current-player-hand');
        }

        const playerName = document.createElement('h3');
        playerName.textContent = player.name;
        playerHandContainer.appendChild(playerName);

        const handCardsContainer = document.createElement('div');
        handCardsContainer.classList.add('hand-cards');

                    player.hand.forEach(card => {
                        const cardElement = document.createElement('img');
                        cardElement.classList.add('card-image');
                        cardElement.dataset.suit = card.suit;
                        cardElement.dataset.rank = card.rank;
        
                        if (player.isAI) {
                            cardElement.classList.add('back');
                            cardElement.alt = `Carta de ${player.name}`;
                        } else {
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

                            // Special case for 7 of Oros
                            if (card.rank === SPECIAL_RANKS.SIETE && card.suit === SUITS.OROS) {
                                filename = '7 oros.png';
                            }
                            cardElement.src = `assets/cards/${filename}`;
                            cardElement.alt = card.toString();
                        }
        
                        // Una carta es jugable si es el turno del jugador humano y el movimiento es válido
                        const isPlayable = !game.getCurrentPlayer().isAI && player === game.getCurrentPlayer() && game.isValidMove(card);
                        if (isPlayable) {
                            cardElement.classList.add('playable');
                            cardElement.addEventListener('click', (e) => handlePlayCard(e, card));
                        }
                        handCardsContainer.appendChild(cardElement);
                    });        playerHandContainer.appendChild(handCardsContainer);
        playerHandsElement.appendChild(playerHandContainer);
    });
}

function updatePlayersInfo() {
    playersInfoElement.innerHTML = ''; // Limpiar información anterior
    game.players.forEach(player => {
        const playerInfoDiv = document.createElement('div');
        playerInfoDiv.classList.add('player-info');
        playerInfoDiv.id = `player-info-${player.name.replace(/\s+/g, '-')}`; // Crear un ID válido
        if (player === game.getCurrentPlayer()) {
            playerInfoDiv.classList.add('active-player');
        }
        playerInfoDiv.innerHTML = `
            <h4>${player.name}</h4>
            <p>Vidas: ${player.lives}</p>
            <p>Cartas: ${player.hand.length}</p>
        `;
        playersInfoElement.appendChild(playerInfoDiv);
    });
}

// Inicialización del juego y eventos
startGameButton.addEventListener('click', () => {
    // Show the name input modal
    nameInputModal.classList.remove('hidden');
    startGameButton.disabled = true; // Disable start button while modal is open
});

confirmNameButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert('Debes introducir un nombre para jugar.');
        return;
    }

    // Hide the name input modal
    nameInputModal.classList.add('hidden');
    
    // Show the lives selection modal
    livesSelectionModal.classList.remove('hidden');
});

livesButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        const lives = parseInt(event.target.dataset.lives, 10);

        // Hide the lives selection modal
        livesSelectionModal.classList.add('hidden');
        startGameButton.disabled = false; // Re-enable start button (though it will be hidden by startGame)

        const playerName = playerNameInput.value.trim(); // Get player name again
        const aiNames = getRandomAINames(3);
        const playerConfigs = [
            { name: playerName, isAI: false, difficulty: null },
            { name: aiNames[0], isAI: true, difficulty: 'easy' },
            { name: aiNames[1], isAI: true, difficulty: 'medium' },
            { name: aiNames[2], isAI: true, difficulty: 'hard' }
        ];
        game = new Game(playerConfigs, lives);
        game.startGame();
        startGameButton.style.display = 'none';
        updateUI();
    });
});

drawCardButton.addEventListener('click', () => {
    if (!game || !game.gameStarted) return;
    
    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.isAI) return;

    drawCardButton.disabled = true; // Deshabilitar para evitar clics múltiples
    
    // The drawCards function will log the specific card drawn
    game.drawCards(currentPlayer, 1); // Roba 1 carta

    // Después de robar, si sigue sin tener jugada, pasa el turno
    if (!game.hasPlayableCards(currentPlayer)) {
        logMessage(`${currentPlayer.name} no puede jugar y pasa el turno.`);
        setTimeout(() => game.nextTurn(), 1500); // Pasa el turno automáticamente
    } else {
        // Ahora puede jugar. El botón de robar permanece deshabilitado para forzarle a jugar.
        gameMessageElement.textContent = '¡Ahora tienes jugada!';
    }
});

// Inicializar UI al cargar la página
updateUI();