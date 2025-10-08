/**
 * Système de traduction i18n pour le dashboard projets
 * Gère les traductions français/italien avec support des attributs et contenu dynamique
 */

class I18nSystem {
  constructor() {
    this.messages = {
      fr: {
        "app.title": "Dashboard Projets 2025 — Nathan Villaume",
        "app.subtitle": "Synthèse interactive — ATS / ATR",
        "kpi.activeProjects": "Projets actifs",
        "kpi.deliveredResults": "Résultats livrés", 
        "kpi.skillsUsed": "Compétences mises en jeu 🔍",
        "filters.label": "Filtres :",
        "filters.all": "Tout",
        "status.label": "Statut :",
        "status.all": "Tous",
        "status.inProgress": "🟡 En cours",
        "status.completed": "🟢 Terminé",
        "btn.addProject": "Ajouter un projet",
        "btn.share": "Partager",
        "btn.close": "Fermer",
        "btn.view": "Voir",
        "btn.details": "Détails",
        "drawer.objective": "Objectif",
        "drawer.realization": "Réalisation",
        "drawer.results": "Résultats",
        "drawer.skills": "Compétences",
        "drawer.screenshots": "📸 Captures d'écran",
        "drawer.media": "Démos & médias",
        "card.objective": "🎯 Objectif",
        "card.realization": "Réalisation",
        "card.results": "Résultats",
        "footer.lastUpdate": "Dernière mise à jour",
        "footer.author": "Auteur",
        "skills.lexicon.title": "📚 Lexique des Compétences",
        "skills.lexicon.subtitle": "compétences techniques mobilisées",
        "skills.lexicon.description": "Ensemble des savoir-faire techniques mis en œuvre dans les projets 2025.",
        "skills.lexicon.clickHint": "🔍 Cliquez sur une compétence pour voir sa définition",
        "skills.lexicon.defaultDesc": "Compétence technique spécialisée.",
        // Système de commentaires
        "comments.title": "Commentaires",
        "comments.add": "Ajouter un commentaire",
        "comments.placeholder": "Écrivez votre commentaire...",
        "comments.send": "Envoyer",
        "comments.cancel": "Annuler",
        "comments.edit": "Modifier",
        "comments.delete": "Supprimer",
        "comments.reply": "Répondre",
        "comments.loading": "Chargement...",
        "comments.error": "Erreur lors du chargement",
        "comments.noComments": "Aucun commentaire pour le moment. Soyez le premier à commenter !",
        "comments.nameLabel": "Nom",
        "comments.messageLabel": "Message",
        "comments.charCount": "/ 2000 caractères",
        "comments.loadMore": "Voir plus",
        "comments.namePlaceholder": "Votre nom",
        "comments.messagePlaceholder": "Votre commentaire...",
        // Menu de partage
        "share.title": "Partager le dashboard",
        "share.teams": "Ouvrir Teams + Copier message",
        "share.outlook": "Ouvrir Outlook (application)",
        "share.copy": "Copier le lien",
        // Authentification
        "auth.title": "Authentification requise",
        "auth.message": "Veuillez entrer le mot de passe administrateur pour ajouter un projet.",
        "auth.password": "Mot de passe",
        "auth.login": "Se connecter",
        "auth.cancel": "Annuler",
        "auth.error": "Mot de passe incorrect",
        // Traductions des projets
        "project.suivi-produit-ats.title": "Suivi Produit – ATS",
        "project.suivi-produit-ats.objective": "Mettre en place une traçabilité complète des couronnes utilisées pour le treillis soudé, du scan en entrée machine jusqu'au produit fini.",
        "project.suivi-produit-ats.real_short": ["Scan étiquettes des couronnes d'ébauche", "Impression étiquettes roquette", "Base SQL stock roquette"],
        "project.suivi-produit-ats.real": ["Scan des étiquettes des couronne d'ébauche", "Impression d'étiquettes roquette (poids réel/théorique, lot, coulée…)", "Base SQL pour gestion de stock", "Intégration supervision/production"],
        "project.suivi-produit-ats.results_short": ["Traçabilité complète", "Réduction erreurs", "Conformité renforcée"],
        "project.suivi-produit-ats.results": ["Traçabilité complète bout-en-bout du scan d'entrée au produit fini", "Réduction significative des erreurs humaines de saisie", "Optimisation logistique et conformité aux exigences qualité"],
        "project.gestion-rfid-ats.title": "Gestion RFID – ATS",
        "project.gestion-rfid-ats.objective": "Chaque démarrage de machine est conditionné par la lecture du badge de pointage SAM, renforçant ainsi la sécurité et assurant une meilleure traçabilité.",
        "project.gestion-rfid-ats.real_short": ["Badge obligatoire", "Base SQL équipes", "Stats opérateurs"],
        "project.gestion-rfid-ats.real": ["RFID obligatoire au démarrage de chaque machine", "Badge chef requis en cas de casse-fil pour validation", "Base SQL de gestion d'équipes et personnels", "Statistiques complètes par opérateur et machine"],
        "project.gestion-rfid-ats.results_short": ["Sécurité renforcée", "Discipline accrue", "Traçabilité opérateurs"],
        "project.gestion-rfid-ats.results": ["Sécurité renforcée avec contrôle d'accès systématique", "Discipline accrue et responsabilisation des équipes", "Suivi précis de la productivité par opérateur et par poste"],
        "project.gestion-rfid-atr.title": "Gestion RFID – ATR",
        "project.gestion-rfid-atr.objective": "Déployer le même dispositif RFID sur l'unité ATR (projet en cours).",
        "project.gestion-rfid-atr.real_short": ["Contrôle démarrage machines", "Adaptation base SQL existante", "Traçabilité accrue"],
        "project.gestion-rfid-atr.real": ["Analyse des points de badgeage sur l'unité ATR", "Intégration avec base SQL existante", "Adaptation vues supervision et droits d'accès", "Traçabilité accrue"],
        "project.gestion-rfid-atr.results_short": ["POC en cours", "Sécurité cross-site", "Traçabilité étendue"],
        "project.gestion-rfid-atr.results": ["Projet en cours (POC + phase de cadrage)", "Sécurité renforcée sur les deux sites (ATS/ATR)", "Traçabilité cross-site unifiée", "Harmonisation des processus entre ATS et ATR"],
        "project.suivis-energies.title": "Suivis des Energies – ATS / ATR",
        "project.suivis-energies.objective": "Donner une vision temps réel des mesure énergétiques pour optimiser les coûts et détecter les anomalies facilement.",
        "project.suivis-energies.real_short": ["Pose compteurs énergie", "Collecte OPC → SQL", "Supervision web"],
        "project.suivis-energies.real": ["Pose de multiples compteurs d'énergie sur transformateurs et lignes", "Collecte automatique des données via OPC/IGS vers SQL Server", "Supervision ultra détaillée accessible depuis n'importe quel PC connecté au réseau Sam/Riva, simplement via une URL", "Tableaux de bord interactifs avec graphiques temps réel"],
        "project.suivis-energies.results_short": ["Vision temps réel", "Détection anomalies", "Optimisation coûts"],
        "project.suivis-energies.results": ["Pilotage précis de l'énergie avec historiques détaillés", "Détection précoce des dérives et anomalies de consommation", "Optimisation significative des coûts énergétiques", "Support décisionnel pour la direction avec KPIs énergétiques"],
        "project.app-changement-gamme.title": "Application « Changement de Gamme »",
        "project.app-changement-gamme.objective": "Concevoir une application mobile destinée à accompagner les équipes de production et de maintenance, afin d'optimiser leur efficacité et d'améliorer la coordination des changements de gammes.",
        "project.app-changement-gamme.real_short": ["Application Android", "API (Communication)", "Interface multi-devices"],
        "project.app-changement-gamme.real": ["Programmation native ANDROID en langage Kotlin", "API pour communication entre l'application et la base de données", "Navigation multi-écrans adaptée (téléphone / tablette / PC)", "Interface Web d'administration pour gestion de l'utilisation de la tablette", "Système de notifications et guidage étape par étape"],
        "project.app-changement-gamme.results_short": ["Gain de temps", "Organisation améliorée", "Traçabilité accrue"],
        "project.app-changement-gamme.results": ["Gain de temps significatif pour les équipes, avec une baisse des erreurs de saisie", "Organisation et structure des étapes de changement de gamme simplifiée", "Accès direct aux résultats et rapports de suivi en temps réel"],
        "project.suivis-soudures-atr.title": "Suivis des Soudures - ATR",
        "project.suivis-soudures-atr.objective": "Mettre en place un suivi et une traçabilité complète des soudures.",
        "project.suivis-soudures-atr.real_short": ["Table échange SAM/PLC", "Base SQL historique", "Affichage dynamique"],
        "project.suivis-soudures-atr.real": ["Mise en place d'une table d'échange standard entre le réseau SAM et les PLC des soudeuses", "Base SQL dédiée pour historiser toutes les infos de soudure (date, ligne, lot, coulée, soudeur, paramètres de soudage...)", "Affichage dynamique temps réel : liste des soudures + état des soudeuses", "Saisie de commentaires en direct pour l'équipe de maintenance", "Export des données pour analyses qualité"],
        "project.suivis-soudures-atr.results_short": ["Traçabilité soudures", "Visibilité État soudeuses", "Analyses qualité"],
        "project.suivis-soudures-atr.results": ["Traçabilité complète des soudures et recuits avec historique détaillé", "Visibilité accrue sur l'état des machines en temps réel", "Communication facilitée entre production et maintenance", "Exploitation des données pour analyses qualité et maintenance prédictive", "Conformité aux exigences de traçabilité industrielle"],
        "project.camera-etiquette-atr.title": "Détection d'étiquette par Caméra – ATR",
        "project.camera-etiquette-atr.objective": "Empêcher qu'une bobine soit stockée sans étiquette.",
        "project.camera-etiquette-atr.real_short": ["Caméra IFM LIGNE 7", "Détection étiquette", "Intégration Profinet"],
        "project.camera-etiquette-atr.real": ["Installation d'une caméra IFM Vision Assistant sur le bobinoir de la ligne 7", "Paramétrage précis de l'algorithme de détection d'étiquette (ROI, seuils, validation)", "Intégration complète de la caméra à l'automate Siemens en Profinet", "Programmation du trigger pour piloter la caméra au moment exact où l'étiquette est posée", "Suivi statistique détaillé des contrôles: nombre de détections, taux de réussite/échec, temps de cycle", "Interface opérateur pour visualisation en direct"],
        "project.camera-etiquette-atr.results_short": ["Zéro défaut étiquette", "Contrôle automatique", "Fiabilité 100%"],
        "project.camera-etiquette-atr.results": ["Suppression totale des risques d'expédition de bobines sans étiquette", "Contrôle automatisé ultra-rapide sans aucune surcharge pour l'opérateur", "Fiabilité renforcée du processus de production", "Réduction drastique des non-conformités client", "ROI rapide par élimination des reprises et retours"],
        // Légendes d'images
        "image.etiquette-roquette": "Étiquette roquette",
        "image.interface-supervision": "Interface supervision",
        "image.interface-rfid": "Interface RFID",
        "image.badge-operateur": "Badge opérateur",
        "image.interface-rfid-atr": "Interface RFID ATR",
        "image.tableau-bord-energetique": "Tableau de bord énergétique",
        "image.ecran-accueil": "Écran d'accueil",
        "image.liste-gammes": "Liste des Gammes",
        "image.validation-etapes": "Validation étapes",
        "image.interface-parametres": "Interface Paramètres",
        "image.supervision-soudures": "Supervision soudures",
        "image.historique-parametres": "Historique paramètres",
        "image.camera-detection": "Caméra de détection",
        // Zones des projets
        "area.ats-supervision-sql": "ATS · Supervision · SQL",
        "area.ats-rfid-securite": "ATS · RFID · Sécurité",
        "area.atr-rfid-securite": "ATR · RFID · Sécurité",
        "area.ats-atr-web-dataviz": "ATS · ATR · Web · DataViz",
        "area.android-api-ux": "Android · API · UX",
        "area.atr-supervision-qualite": "ATR · Supervision · Qualité",
        "area.atr-vision-automatisme": "ATR · Vision · Automatisme"
      },
      it: {
        "app.title": "Dashboard Progetti 2025 — Nathan Villaume",
        "app.subtitle": "Sintesi interattiva — ATS / ATR",
        "kpi.activeProjects": "Progetti attivi",
        "kpi.deliveredResults": "Risultati consegnati",
        "kpi.skillsUsed": "Competenze utilizzate 🔍",
        "filters.label": "Filtri :",
        "filters.all": "Tutto",
        "status.label": "Stato :",
        "status.all": "Tutti",
        "status.inProgress": "🟡 In corso",
        "status.completed": "🟢 Completato",
        "btn.addProject": "Aggiungi progetto",
        "btn.share": "Condividi",
        "btn.close": "Chiudi",
        "btn.view": "Visualizza",
        "btn.details": "Dettagli",
        "drawer.objective": "Obiettivo",
        "drawer.realization": "Realizzazione",
        "drawer.results": "Risultati",
        "drawer.skills": "Competenze",
        "drawer.screenshots": "📸 Screenshot",
        "drawer.media": "Demo & media",
        "card.objective": "🎯 Obiettivo",
        "card.realization": "Realizzazione",
        "card.results": "Risultati",
        "footer.lastUpdate": "Ultimo aggiornamento",
        "footer.author": "Autore",
        "skills.lexicon.title": "📚 Lessico delle Competenze",
        "skills.lexicon.subtitle": "competenze tecniche utilizzate",
        "skills.lexicon.description": "Insieme delle competenze tecniche utilizzate nei progetti 2025.",
        "skills.lexicon.clickHint": "🔍 Clicca su una competenza per vedere la sua definizione",
        "skills.lexicon.defaultDesc": "Competenza tecnica specializzata.",
        // Système de commentaires
        "comments.title": "Commenti",
        "comments.add": "Aggiungi un commento",
        "comments.placeholder": "Scrivi il tuo commento...",
        "comments.send": "Invia",
        "comments.cancel": "Annulla",
        "comments.edit": "Modifica",
        "comments.delete": "Elimina",
        "comments.reply": "Rispondi",
        "comments.loading": "Caricamento...",
        "comments.error": "Errore durante il caricamento",
        "comments.noComments": "Nessun commento al momento. Sii il primo a commentare !",
        "comments.nameLabel": "Nome",
        "comments.messageLabel": "Messaggio",
        "comments.charCount": "/ 2000 caratteri",
        "comments.loadMore": "Vedi di più",
        "comments.namePlaceholder": "Il tuo nome",
        "comments.messagePlaceholder": "Il tuo commento...",
        // Menu de partage
        "share.title": "Condividi la dashboard",
        "share.teams": "Apri Teams + Copia messaggio",
        "share.outlook": "Apri Outlook (applicazione)",
        "share.copy": "Copia il link",
        // Authentification
        "auth.title": "Autenticazione richiesta",
        "auth.message": "Inserisci la password amministratore per aggiungere un progetto.",
        "auth.password": "Password",
        "auth.login": "Accedi",
        "auth.cancel": "Annulla",
        "auth.error": "Password errata",
        // Traductions des projets en italien
        "project.suivi-produit-ats.title": "Tracciamento Prodotto – ATS",
        "project.suivi-produit-ats.objective": "Implementare una tracciabilità completa delle corone utilizzate per il traliccio saldato, dalla scansione in entrata macchina fino al prodotto finito.",
        "project.suivi-produit-ats.real_short": ["Scansione etichette corone grezze", "Stampa etichette rocchetta", "Base SQL stock rocchetta"],
        "project.suivi-produit-ats.real": ["Scansione delle etichette delle corone grezze", "Stampa di etichette rocchetta (peso reale/teorico, lotto, colata...)", "Base SQL per gestione stock", "Integrazione supervisione/produzione"],
        "project.suivi-produit-ats.results_short": ["Tracciabilità completa", "Riduzione errori", "Conformità rafforzata"],
        "project.suivi-produit-ats.results": ["Tracciabilità completa end-to-end dalla scansione di entrata al prodotto finito", "Riduzione significativa degli errori umani di inserimento", "Ottimizzazione logistica e conformità ai requisiti qualità"],
        "project.gestion-rfid-ats.title": "Gestione RFID – ATS",
        "project.gestion-rfid-ats.objective": "Ogni avvio di macchina è condizionato dalla lettura del badge di timbratura SAM, rafforzando così la sicurezza e garantendo una migliore tracciabilità.",
        "project.gestion-rfid-ats.real_short": ["Badge obbligatorio", "Base SQL squadre", "Statistiche operatori"],
        "project.gestion-rfid-ats.real": ["RFID obbligatorio all'avvio di ogni macchina", "Badge capo richiesto in caso di rottura filo per validazione", "Base SQL di gestione squadre e personale", "Statistiche complete per operatore e macchina"],
        "project.gestion-rfid-ats.results_short": ["Sicurezza rafforzata", "Disciplina maggiore", "Tracciabilità operatori"],
        "project.gestion-rfid-ats.results": ["Sicurezza rafforzata con controllo accessi sistematico", "Disciplina maggiore e responsabilizzazione delle squadre", "Monitoraggio preciso della produttività per operatore e per postazione"],
        "project.gestion-rfid-atr.title": "Gestione RFID – ATR",
        "project.gestion-rfid-atr.objective": "Implementare lo stesso dispositivo RFID sull'unità ATR (progetto in corso).",
        "project.gestion-rfid-atr.real_short": ["Controllo avvio macchine", "Adattamento base SQL esistente", "Tracciabilità aumentata"],
        "project.gestion-rfid-atr.real": ["Analisi dei punti di timbratura sull'unità ATR", "Integrazione con base SQL esistente", "Adattamento viste supervisione e diritti di accesso", "Tracciabilità aumentata"],
        "project.gestion-rfid-atr.results_short": ["POC in corso", "Sicurezza cross-site", "Tracciabilità estesa"],
        "project.gestion-rfid-atr.results": ["Progetto in corso (POC + fase di definizione)", "Sicurezza rafforzata sui due siti (ATS/ATR)", "Tracciabilità cross-site unificata", "Armonizzazione dei processi tra ATS e ATR"],
        "project.suivis-energies.title": "Monitoraggio Energie – ATS / ATR",
        "project.suivis-energies.objective": "Fornire una visione in tempo reale delle misurazioni energetiche per ottimizzare i costi e rilevare facilmente le anomalie.",
        "project.suivis-energies.real_short": ["Installazione contatori energia", "Raccolta OPC → SQL", "Supervisione web"],
        "project.suivis-energies.real": ["Installazione di multipli contatori di energia su trasformatori e linee", "Raccolta automatica dei dati via OPC/IGS verso SQL Server", "Supervisione ultra dettagliata accessibile da qualsiasi PC connesso alla rete Sam/Riva, semplicemente tramite un URL", "Dashboard interattivi con grafici tempo reale"],
        "project.suivis-energies.results_short": ["Visione tempo reale", "Rilevamento anomalie", "Ottimizzazione costi"],
        "project.suivis-energies.results": ["Pilotaggio preciso dell'energia con storici dettagliati", "Rilevamento precoce delle derive e anomalie di consumo", "Ottimizzazione significativa dei costi energetici", "Supporto decisionale per la direzione con KPI energetici"],
        "project.app-changement-gamme.title": "Applicazione « Cambio Gammes »",
        "project.app-changement-gamme.objective": "Progettare un'applicazione mobile destinata ad accompagnare i team di produzione e manutenzione, al fine di ottimizzare la loro efficienza e migliorare il coordinamento dei cambi gammes.",
        "project.app-changement-gamme.real_short": ["Applicazione Android", "API (Comunicazione)", "Interfaccia multi-dispositivi"],
        "project.app-changement-gamme.real": ["Programmazione nativa ANDROID in linguaggio Kotlin", "API per comunicazione tra l'applicazione e il database", "Navigazione multi-schermo adattata (telefono / tablet / PC)", "Interfaccia Web di amministrazione per gestione dell'utilizzo del tablet", "Sistema di notifiche e guida passo dopo passo"],
        "project.app-changement-gamme.results_short": ["Risparmio tempo", "Organizzazione migliorata", "Tracciabilità aumentata"],
        "project.app-changement-gamme.results": ["Risparmio di tempo significativo per i team, con una diminuzione degli errori di inserimento", "Organizzazione e struttura delle fasi di cambio gamme semplificata", "Accesso diretto ai risultati e rapporti di monitoraggio in tempo reale"],
        "project.suivis-soudures-atr.title": "Monitoraggio Saldature - ATR",
        "project.suivis-soudures-atr.objective": "Implementare un monitoraggio e una tracciabilità completa delle saldature.",
        "project.suivis-soudures-atr.real_short": ["Tabella scambio SAM/PLC", "Base SQL storico", "Visualizzazione dinamica"],
        "project.suivis-soudures-atr.real": ["Implementazione di una tabella di scambio standard tra la rete SAM e i PLC delle saldatrici", "Base SQL dedicata per storificare tutte le informazioni di saldatura (data, linea, lotto, colata, saldatore, parametri di saldatura...)", "Visualizzazione dinamica tempo reale: lista delle saldature + stato delle saldatrici", "Inserimento commenti in diretta per il team di manutenzione", "Export dei dati per analisi qualità"],
        "project.suivis-soudures-atr.results_short": ["Tracciabilità saldature", "Visibilità stato saldatrici", "Analisi qualità"],
        "project.suivis-soudures-atr.results": ["Tracciabilità completa delle saldature e ricotture con storico dettagliato", "Visibilità aumentata sullo stato delle macchine in tempo reale", "Comunicazione facilitata tra produzione e manutenzione", "Sfruttamento dei dati per analisi qualità e manutenzione predittiva", "Conformità ai requisiti di tracciabilità industriale"],
        "project.camera-etiquette-atr.title": "Rilevamento etichetta tramite Camera – ATR",
        "project.camera-etiquette-atr.objective": "Impedire che una bobina venga stoccata senza etichetta.",
        "project.camera-etiquette-atr.real_short": ["Camera IFM LINEA 7", "Rilevamento etichetta", "Integrazione Profinet"],
        "project.camera-etiquette-atr.real": ["Installazione di una camera IFM Vision Assistant sul bobinoio della linea 7", "Configurazione precisa dell'algoritmo di rilevamento etichetta (ROI, soglie, validazione)", "Integrazione completa della camera all'automata Siemens in Profinet", "Programmazione del trigger per pilotare la camera nel momento esatto in cui l'etichetta viene posizionata", "Monitoraggio statistico dettagliato dei controlli: numero di rilevamenti, tasso di successo/fallimento, tempo di ciclo", "Interfaccia operatore per visualizzazione in diretta"],
        "project.camera-etiquette-atr.results_short": ["Zero difetti etichetta", "Controllo automatico", "Affidabilità 100%"],
        "project.camera-etiquette-atr.results": ["Eliminazione totale dei rischi di spedizione bobine senza etichetta", "Controllo automatizzato ultra-rapido senza alcun sovraccarico per l'operatore", "Affidabilità rafforzata del processo di produzione", "Riduzione drastica delle non conformità cliente", "ROI rapido per eliminazione delle riprese e ritorni"],
        // Légendes d'images en italien
        "image.etiquette-roquette": "Etichetta rocchetta",
        "image.interface-supervision": "Interfaccia supervisione",
        "image.interface-rfid": "Interfaccia RFID",
        "image.badge-operateur": "Badge operatore",
        "image.interface-rfid-atr": "Interfaccia RFID ATR",
        "image.tableau-bord-energetique": "Dashboard energetico",
        "image.ecran-accueil": "Schermata di benvenuto",
        "image.liste-gammes": "Lista Gammes",
        "image.validation-etapes": "Validazione fasi",
        "image.interface-parametres": "Interfaccia Parametri",
        "image.supervision-soudures": "Supervisione saldature",
        "image.historique-parametres": "Storico parametri",
        "image.camera-detection": "Camera di rilevamento",
        // Zones des projets en italien
        "area.ats-supervision-sql": "ATS · Supervisione · SQL",
        "area.ats-rfid-securite": "ATS · RFID · Sicurezza",
        "area.atr-rfid-securite": "ATR · RFID · Sicurezza",
        "area.ats-atr-web-dataviz": "ATS · ATR · Web · DataViz",
        "area.android-api-ux": "Android · API · UX",
        "area.atr-supervision-qualite": "ATR · Supervisione · Qualità",
        "area.atr-vision-automatisme": "ATR · Visione · Automazione"
      }
    };

    this.state = { lang: "fr" };
    this.init();
  }

  init() {
    document.addEventListener("DOMContentLoaded", () => {
      const saved = localStorage.getItem("lang");
      const guessed = navigator.language?.toLowerCase().startsWith("it") ? "it" : "fr";
      this.state.lang = saved || guessed || "fr";

      document.body.addEventListener("click", (e) => {
        const btn = e.target.closest(".lang-btn");
        if (btn?.dataset?.lang) {
          this.setLang(btn.dataset.lang);
        }
      });

      this.applyI18n();
    });
  }

  applyI18n() {
    const root = document;
    const dict = this.messages[this.state.lang] || this.messages.fr;

    // Text nodes
    root.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (dict[key] != null) el.textContent = String(dict[key]);
    });

    // Attribute bindings (comma-separated)
    root.querySelectorAll("[data-i18n-attr]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const attrs = el.getAttribute("data-i18n-attr").split(",").map(s => s.trim());
      const val = dict[key];
      if (val != null) attrs.forEach(a => el.setAttribute(a, String(val)));
    });

    // Title tag if marked
    const titleEl = document.querySelector("title[data-i18n]");
    if (titleEl) {
      const key = titleEl.getAttribute("data-i18n");
      if (dict[key] != null) titleEl.textContent = String(dict[key]);
    }

    // Toggle pressed state on language buttons
    document.querySelectorAll(".lang-btn").forEach(btn => {
      btn.setAttribute("aria-pressed", btn.dataset.lang === this.state.lang ? "true" : "false");
    });

    // Update language switcher aria-labels
    const frBtn = document.querySelector('.lang-btn[data-lang="fr"]');
    const itBtn = document.querySelector('.lang-btn[data-lang="it"]');
    if (frBtn) frBtn.setAttribute('aria-label', this.state.lang === 'fr' ? 'Passer en Français (actuel)' : 'Passer en Français');
    if (itBtn) itBtn.setAttribute('aria-label', this.state.lang === 'it' ? 'Passare all\'Italiano (attuale)' : 'Passare all\'Italiano');
  }

  setLang(lang) {
    this.state.lang = (lang === "it") ? "it" : "fr";
    localStorage.setItem("lang", this.state.lang);
    window.requestAnimationFrame(() => this.applyI18n());
    
    // Update dynamic content
    if (window.updateDynamicContent) {
      window.updateDynamicContent();
    }
  }

  getLang() {
    return this.state.lang;
  }

  t(key, params) {
    const dict = this.messages[this.state.lang] || this.messages.fr;
    let text = dict[key] || key;
    if (params) {
      Object.keys(params).forEach(k => {
        text = text.replace(new RegExp(`{${k}}`, 'g'), params[k]);
      });
    }
    return text;
  }

  // Expose globally for backward compatibility
  exposeGlobally() {
    window.i18n = {
      setLang: (lang) => this.setLang(lang),
      getLang: () => this.getLang(),
      t: (key, params) => this.t(key, params),
      messages: this.messages
    };

    window.updateDynamicContent = () => {
      // This will be called when language changes to update dynamic content
      if (window.renderCards && window.DATA) {
        window.renderCards(window.DATA);
      }
      if (window.showAllSkills) {
        // Update skills lexicon if it's currently displayed
        const drawer = document.getElementById('drawer');
        if (!drawer.classList.contains('hidden') && document.getElementById('drawerTitle')?.textContent.includes('Lexique')) {
          window.showAllSkills();
        }
      }
      
      // Update comments system if it exists
      if (window.commentsComponent && window.currentProjectId) {
        // Reinitialize comments with new language
        window.commentsComponent.setEntity(window.currentProjectId);
      }
      
      // Apply translations to comments component if it exists
      if (window.commentsComponent) {
        window.commentsComponent.applyTranslations();
      }
    };
  }
}

// Auto-initialize and expose globally
const i18nSystem = new I18nSystem();
i18nSystem.exposeGlobally();
