/**
 * Proxy Server JavaScript pour contourner les problèmes CORS
 * Utilise le serveur Node.js intégré ou un serveur Python simple
 */

// Configuration du proxy
const PROXY_CONFIG = {
    target: 'http://localhost:8088',
    port: 3000,
    cors: true
};

// Fonction pour créer un proxy simple
function createProxyServer() {
    console.log('🚀 Démarrage du proxy CORS...');
    
    // Méthode 1: Utiliser le serveur actuel comme proxy
    if (window.location.origin.includes('localhost:8088')) {
        console.log('✅ Utilisation du serveur actuel comme proxy');
        return setupLocalProxy();
    }
    
    // Méthode 2: Utiliser un serveur proxy externe
    return setupExternalProxy();
}

// Proxy local (via le serveur actuel)
function setupLocalProxy() {
    const originalFetch = window.fetch;
    
    window.fetch = function(url, options = {}) {
        // Si c'est un appel à l'API Comments, utiliser le serveur local
        if (url.includes('/api/Comments')) {
            const fullUrl = url.startsWith('/') ? window.location.origin + url : url;
            console.log('🔄 Proxy local:', fullUrl);
            
            return originalFetch(fullUrl, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...options.headers
                },
                mode: 'cors'
            });
        }
        
        // Pour les autres URLs, utiliser fetch normal
        return originalFetch(url, options);
    };
    
    console.log('✅ Proxy local configuré');
    return true;
}

// Proxy externe (nécessite un serveur séparé)
function setupExternalProxy() {
    console.log('⚠️ Proxy externe non implémenté - utilisation du serveur local');
    return setupLocalProxy();
}

// Initialisation automatique
document.addEventListener('DOMContentLoaded', function() {
    createProxyServer();
});

// Export pour utilisation dans d'autres scripts
window.ProxyServer = {
    create: createProxyServer,
    setupLocal: setupLocalProxy,
    config: PROXY_CONFIG
};
