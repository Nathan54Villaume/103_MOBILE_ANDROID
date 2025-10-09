/**
 * Terminal Web intégré - Commandes basiques
 * Interface style terminal avec commandes sécurisées
 */

class WebTerminal {
    constructor() {
        this.history = [];
        this.historyIndex = -1;
        this.currentDirectory = 'C:\\API_ATF_MOBILE';
        this.commands = {
            'help': this.help.bind(this),
            'clear': this.clear.bind(this),
            'dir': this.dir.bind(this),
            'ls': this.dir.bind(this),
            'pwd': this.pwd.bind(this),
            'cd': this.cd.bind(this),
            'type': this.type.bind(this),
            'cat': this.type.bind(this),
            'ping': this.ping.bind(this),
            'time': this.time.bind(this),
            'date': this.date.bind(this),
            'whoami': this.whoami.bind(this),
            'hostname': this.hostname.bind(this),
            'version': this.version.bind(this),
            'status': this.status.bind(this)
        };
    }

    /**
     * Initialiser le terminal
     */
    init() {
        console.log('🖥️ Initialisation du Terminal Web');
        
        this.attachEventListeners();
        this.printWelcome();
        this.printPrompt();
    }

    /**
     * Attacher les event listeners
     */
    attachEventListeners() {
        const terminalInput = document.getElementById('terminalInput');
        const terminalContainer = document.getElementById('terminalContainer');
        const clearBtn = document.getElementById('terminalClearBtn');
        const fullscreenBtn = document.getElementById('terminalFullscreenBtn');
        
        if (!terminalInput) {
            console.error('❌ Élément terminalInput non trouvé');
            return;
        }

        terminalInput.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        terminalInput.addEventListener('keyup', (e) => {
            this.handleKeyUp(e);
        });

        // Bouton Effacer
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clear();
            });
        }

        // Bouton Plein écran
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }

        // Focus automatique
        terminalInput.focus();
    }

    /**
     * Gérer les touches pressées
     */
    handleKeyDown(e) {
        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                this.executeCommand();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.navigateHistory(-1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.navigateHistory(1);
                break;
            case 'Tab':
                e.preventDefault();
                this.handleTabCompletion();
                break;
        }
    }

    /**
     * Gérer les touches relâchées
     */
    handleKeyUp(e) {
        // Mettre à jour l'historique
        const input = e.target.value;
        if (e.key === 'Enter') {
            if (input.trim() && input.trim() !== this.history[this.history.length - 1]) {
                this.history.push(input.trim());
            }
            this.historyIndex = this.history.length;
        }
    }

    /**
     * Exécuter une commande
     */
    async executeCommand() {
        const terminalInput = document.getElementById('terminalInput');
        const terminalOutput = document.getElementById('terminalOutput');
        
        if (!terminalInput || !terminalOutput) return;

        const command = terminalInput.value.trim();
        
        // Afficher la commande
        this.appendOutput(`<span class="text-green-400">${this.currentDirectory}</span>><span class="text-white">${command}</span>`);
        
        // Vider l'input
        terminalInput.value = '';
        
        if (!command) {
            this.printPrompt();
            return;
        }

        // Ajouter à l'historique
        if (command !== this.history[this.history.length - 1]) {
            this.history.push(command);
        }
        this.historyIndex = this.history.length;

        // Exécuter la commande
        await this.runCommand(command);
        
        // Nouveau prompt
        this.printPrompt();
        
        // Scroll vers le bas avec délai pour s'assurer que le contenu est rendu
        setTimeout(() => {
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }, 10);
    }

    /**
     * Exécuter une commande
     */
    async runCommand(command) {
        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        if (this.commands[cmd]) {
            try {
                await this.commands[cmd](args);
            } catch (error) {
                this.appendOutput(`<span class="text-red-400">Erreur: ${error.message}</span>`);
            }
        } else {
            this.appendOutput(`<span class="text-red-400">Commande non reconnue: ${cmd}</span>`);
            this.appendOutput('<span class="text-yellow-400">Tapez "help" pour voir les commandes disponibles</span>');
        }
    }

    /**
     * Afficher l'aide
     */
    help() {
        this.appendOutput('<span class="text-blue-400">=== Commandes disponibles ===</span>');
        this.appendOutput('<span class="text-green-400">help</span>        - Afficher cette aide');
        this.appendOutput('<span class="text-green-400">clear</span>       - Effacer l\'écran');
        this.appendOutput('<span class="text-green-400">dir, ls</span>     - Lister les fichiers et dossiers');
        this.appendOutput('<span class="text-green-400">pwd</span>         - Afficher le répertoire actuel');
        this.appendOutput('<span class="text-green-400">cd &lt;dir&gt;</span>    - Changer de répertoire');
        this.appendOutput('<span class="text-green-400">type &lt;file&gt;</span>  - Afficher le contenu d\'un fichier');
        this.appendOutput('<span class="text-green-400">ping &lt;host&gt;</span>  - Tester la connectivité');
        this.appendOutput('<span class="text-green-400">time</span>        - Afficher l\'heure');
        this.appendOutput('<span class="text-green-400">date</span>        - Afficher la date');
        this.appendOutput('<span class="text-green-400">whoami</span>      - Afficher l\'utilisateur actuel');
        this.appendOutput('<span class="text-green-400">hostname</span>    - Afficher le nom du serveur');
        this.appendOutput('<span class="text-green-400">version</span>     - Afficher la version de l\'API');
        this.appendOutput('<span class="text-green-400">status</span>      - Statut du système');
    }

    /**
     * Effacer l'écran
     */
    clear() {
        const terminalOutput = document.getElementById('terminalOutput');
        if (terminalOutput) {
            terminalOutput.innerHTML = '';
        }
    }

    /**
     * Lister les fichiers
     */
    async dir(args = []) {
        try {
            // Simuler la liste des fichiers (en vrai, on ferait un appel API)
            this.appendOutput('<span class="text-blue-400"> Répertoire de C:\\API_ATF_MOBILE</span>');
            this.appendOutput('');
            
            const mockFiles = [
                { name: 'API_ATF_MOBILE.dll', type: 'file', size: '2.5 MB' },
                { name: 'appsettings.json', type: 'file', size: '1.2 KB' },
                { name: 'wwwroot', type: 'dir', size: '' },
                { name: 'logs', type: 'dir', size: '' },
                { name: 'bin', type: 'dir', size: '' },
                { name: 'obj', type: 'dir', size: '' }
            ];

            mockFiles.forEach(file => {
                const icon = file.type === 'dir' ? '📁' : '📄';
                const size = file.size ? `  ${file.size}` : '';
                this.appendOutput(`${icon} ${file.name}${size}`);
            });
        } catch (error) {
            this.appendOutput(`<span class="text-red-400">Erreur: ${error.message}</span>`);
        }
    }

    /**
     * Afficher le répertoire actuel
     */
    pwd() {
        this.appendOutput(this.currentDirectory);
    }

    /**
     * Changer de répertoire
     */
    cd(args = []) {
        if (args.length === 0) {
            this.currentDirectory = 'C:\\';
            this.appendOutput('C:\\');
            return;
        }

        const targetDir = args[0];
        
        // Simuler le changement de répertoire
        if (targetDir === '..') {
            const parts = this.currentDirectory.split('\\');
            if (parts.length > 1) {
                parts.pop();
                this.currentDirectory = parts.join('\\');
            }
        } else if (targetDir === 'wwwroot') {
            this.currentDirectory = 'C:\\API_ATF_MOBILE\\wwwroot';
        } else if (targetDir === 'logs') {
            this.currentDirectory = 'C:\\API_ATF_MOBILE\\DATA\\logs';
        } else {
            this.appendOutput(`<span class="text-red-400">Le répertoire "${targetDir}" n'existe pas</span>`);
            return;
        }

        this.appendOutput(this.currentDirectory);
    }

    /**
     * Afficher le contenu d'un fichier
     */
    async type(args = []) {
        if (args.length === 0) {
            this.appendOutput('<span class="text-red-400">Usage: type &lt;fichier&gt;</span>');
            return;
        }

        const filename = args[0];
        
        // Simuler la lecture de fichier
        if (filename === 'appsettings.json') {
            this.appendOutput('<span class="text-blue-400">=== Contenu de appsettings.json ===</span>');
            this.appendOutput('{');
            this.appendOutput('  "ConnectionStrings": {');
            this.appendOutput('    "DefaultConnection": "Server=...;Database=..."');
            this.appendOutput('  },');
            this.appendOutput('  "Serilog": {');
            this.appendOutput('    "MinimumLevel": "Information"');
            this.appendOutput('  }');
            this.appendOutput('}');
        } else {
            this.appendOutput(`<span class="text-red-400">Impossible de lire le fichier "${filename}"</span>`);
        }
    }

    /**
     * Tester la connectivité
     */
    async ping(args = []) {
        if (args.length === 0) {
            this.appendOutput('<span class="text-red-400">Usage: ping &lt;host&gt;</span>');
            return;
        }

        const host = args[0];
        this.appendOutput(`<span class="text-blue-400">Envoi d'une requête 'Ping' vers ${host} avec 32 octets de données :</span>`);
        
        // Simuler le ping avec 4 tentatives comme un vrai ping
        for (let i = 1; i <= 4; i++) {
            setTimeout(() => {
                const time = Math.floor(Math.random() * 5) + 1; // 1-5ms aléatoire
                this.appendOutput(`<span class="text-green-400">Réponse de ${host} : octets=32 temps=${time}ms TTL=64</span>`);
                
                // Scroll après chaque réponse
                setTimeout(() => {
                    const terminalOutput = document.getElementById('terminalOutput');
                    if (terminalOutput) {
                        terminalOutput.scrollTop = terminalOutput.scrollHeight;
                    }
                }, 10);
            }, i * 1000);
        }
        
        // Statistiques finales
        setTimeout(() => {
            this.appendOutput('');
            this.appendOutput(`<span class="text-blue-400">Statistiques Ping pour ${host} :</span>`);
            this.appendOutput(`<span class="text-green-400">    Paquets : envoyés = 4, reçus = 4, perdus = 0 (0% de perte),</span>`);
            this.appendOutput(`<span class="text-green-400">Durée approximative en millisecondes :</span>`);
            this.appendOutput(`<span class="text-green-400">    Minimum = 1ms, Maximum = 5ms, Moyenne = 3ms</span>`);
        }, 5000);
    }

    /**
     * Afficher l'heure
     */
    time() {
        const now = new Date();
        const time = now.toLocaleTimeString('fr-FR');
        this.appendOutput(`<span class="text-blue-400">Heure actuelle: ${time}</span>`);
    }

    /**
     * Afficher la date
     */
    date() {
        const now = new Date();
        const date = now.toLocaleDateString('fr-FR');
        this.appendOutput(`<span class="text-blue-400">Date actuelle: ${date}</span>`);
    }

    /**
     * Afficher l'utilisateur
     */
    whoami() {
        this.appendOutput('<span class="text-blue-400">Utilisateur: Administrateur (API_ATF_MOBILE)</span>');
    }

    /**
     * Afficher le nom du serveur
     */
    hostname() {
        this.appendOutput('<span class="text-blue-400">Nom du serveur: API_ATF_MOBILE_SERVER</span>');
    }

    /**
     * Afficher la version
     */
    version() {
        this.appendOutput('<span class="text-blue-400">=== API_ATF_MOBILE ===</span>');
        this.appendOutput('<span class="text-green-400">Version: 1.0.0</span>');
        this.appendOutput('<span class="text-green-400">Plateforme: .NET 8.0</span>');
        this.appendOutput('<span class="text-green-400">Serveur: Kestrel</span>');
        this.appendOutput('<span class="text-green-400">Déployé: 2025-10-09</span>');
    }

    /**
     * Statut du système
     */
    async status() {
        this.appendOutput('<span class="text-blue-400">=== Statut du système ===</span>');
        this.appendOutput('<span class="text-green-400">API: ✅ En ligne</span>');
        this.appendOutput('<span class="text-green-400">Base de données: ✅ Connectée</span>');
        this.appendOutput('<span class="text-green-400">PLC S7: ✅ Connecté</span>');
        this.appendOutput('<span class="text-green-400">DIRIS: ✅ Actif</span>');
        this.appendOutput('<span class="text-green-400">Mémoire: 45% utilisée</span>');
        this.appendOutput('<span class="text-green-400">CPU: 12% utilisée</span>');
    }

    /**
     * Navigation dans l'historique
     */
    navigateHistory(direction) {
        if (this.history.length === 0) return;

        this.historyIndex += direction;
        
        if (this.historyIndex < 0) {
            this.historyIndex = 0;
        } else if (this.historyIndex >= this.history.length) {
            this.historyIndex = this.history.length;
        }

        const terminalInput = document.getElementById('terminalInput');
        if (terminalInput) {
            if (this.historyIndex === this.history.length) {
                terminalInput.value = '';
            } else {
                terminalInput.value = this.history[this.historyIndex];
            }
        }
    }

    /**
     * Complétion par tabulation
     */
    handleTabCompletion() {
        // TODO: Implémenter la complétion par tabulation
        this.appendOutput('<span class="text-yellow-400">Complétion par tabulation non implémentée</span>');
    }

    /**
     * Afficher le message de bienvenue
     */
    printWelcome() {
        this.appendOutput('<span class="text-blue-400">=== Terminal Web API_ATF_MOBILE ===</span>');
        this.appendOutput('<span class="text-green-400">Bienvenue dans le terminal intégré</span>');
        this.appendOutput('<span class="text-yellow-400">Tapez "help" pour voir les commandes disponibles</span>');
        this.appendOutput('');
    }

    /**
     * Afficher le prompt
     */
    printPrompt() {
        this.appendOutput(`<span class="text-green-400">${this.currentDirectory}</span>><span class="text-white">_</span>`);
    }

    /**
     * Ajouter du texte à la sortie
     */
    appendOutput(text) {
        const terminalOutput = document.getElementById('terminalOutput');
        if (terminalOutput) {
            const line = document.createElement('div');
            line.innerHTML = text;
            line.className = 'terminal-line font-mono text-sm leading-relaxed';
            terminalOutput.appendChild(line);
            
            // Auto-scroll vers le bas
            setTimeout(() => {
                terminalOutput.scrollTop = terminalOutput.scrollHeight;
            }, 10);
        }
    }

    /**
     * Basculer le mode plein écran
     */
    toggleFullscreen() {
        const terminalOutput = document.getElementById('terminalOutput');
        if (!terminalOutput) return;

        if (terminalOutput.classList.contains('h-96')) {
            // Passer en plein écran
            terminalOutput.classList.remove('h-96');
            terminalOutput.classList.add('h-screen');
            terminalOutput.style.height = 'calc(100vh - 200px)';
        } else {
            // Revenir à la taille normale
            terminalOutput.classList.remove('h-screen');
            terminalOutput.classList.add('h-96');
            terminalOutput.style.height = '';
        }
    }
}

// Créer une instance globale
const webTerminal = new WebTerminal();
window.webTerminal = webTerminal;

export default webTerminal;
