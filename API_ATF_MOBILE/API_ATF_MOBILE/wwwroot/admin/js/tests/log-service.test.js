/**
 * Tests unitaires basiques pour log-service.js
 * Framework: Simple assertions (peut être migré vers Jest/Vitest si souhaité)
 */

import logService from '../log-service.js';

// Test runner simple
class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('🧪 Démarrage des tests log-service...\n');

        for (const test of this.tests) {
            try {
                await test.fn();
                this.passed++;
                console.log(`✅ ${test.name}`);
            } catch (error) {
                this.failed++;
                console.error(`❌ ${test.name}`);
                console.error(`   ${error.message}`);
            }
        }

        console.log(`\n📊 Résultats: ${this.passed} réussis, ${this.failed} échoués`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

// Tests
const runner = new TestRunner();

// Test 1: État initial
runner.test('État initial - Stop actif par défaut', () => {
    const state = logService.getState();
    assertEquals(state.isPlaying, false, 'Le mode Stop devrait être actif par défaut');
    console.log('   State:', state);
});

// Test 2: Buffer size configuration
runner.test('Configuration du buffer size', () => {
    logService.setBufferSize(15000);
    const state = logService.getState();
    assertEquals(state.bufferSize, 15000, 'La taille du buffer devrait être 15000');
    
    // Test minimum 5000
    logService.setBufferSize(1000);
    const state2 = logService.getState();
    assertEquals(state2.bufferSize, 5000, 'La taille minimale devrait être 5000');
    
    // Reset
    logService.setBufferSize(10000);
});

// Test 3: Normalisation des logs
runner.test('Normalisation des logs C# vers Event Viewer', () => {
    const csharpLog = {
        id: 'test-123',
        timestamp: '2025-10-02T14:22:11.123Z',
        level: 'Information',
        message: 'Test message',
        source: 'API',
        httpDetails: {
            method: 'GET',
            url: '/api/test',
            statusCode: 200,
            durationMs: 42
        },
        exception: null
    };

    const normalized = logService.normalizeLog(csharpLog);

    assertEquals(normalized.severity, 'info', 'Severity devrait être "info"');
    assertEquals(normalized.source, 'API', 'Source devrait être "API"');
    assert(normalized.http, 'HTTP details devraient exister');
    assertEquals(normalized.http.status, 200, 'Status devrait être 200');
    console.log('   Normalized:', normalized);
});

// Test 4: Filtrage par severity
runner.test('Filtrage par severity', () => {
    // Ajouter des logs de test
    const logs = [
        { id: '1', ts: new Date(), severity: 'info', source: 'API', message: 'Info log', meta: { hasError: false }, details: {} },
        { id: '2', ts: new Date(), severity: 'warn', source: 'API', message: 'Warning log', meta: { hasError: false }, details: {} },
        { id: '3', ts: new Date(), severity: 'error', source: 'API', message: 'Error log', meta: { hasError: true }, details: {} }
    ];

    logService.logs = logs;
    
    // Filtrer par severity=error
    logService.setFilter('severity', ['error']);
    
    const displayed = logService.getDisplayedLogs();
    assertEquals(displayed.length, 1, 'Devrait afficher 1 log');
    assertEquals(displayed[0].severity, 'error', 'Le log affiché devrait être de type error');
    
    // Reset
    logService.resetFilters();
    const displayedAfterReset = logService.getDisplayedLogs();
    assertEquals(displayedAfterReset.length, 3, 'Tous les logs devraient être affichés après reset');
});

// Test 5: Recherche plein texte
runner.test('Recherche plein texte', () => {
    const logs = [
        { id: '1', ts: new Date(), severity: 'info', source: 'API', message: 'User logged in', meta: { hasError: false }, details: {} },
        { id: '2', ts: new Date(), severity: 'error', source: 'API', message: 'Database connection failed', meta: { hasError: true }, details: {} }
    ];

    logService.logs = logs;
    logService.resetFilters();
    
    // Rechercher "database"
    logService.setFilter('searchText', 'database');
    
    const displayed = logService.getDisplayedLogs();
    assertEquals(displayed.length, 1, 'Devrait trouver 1 log');
    assert(displayed[0].message.toLowerCase().includes('database'), 'Le message devrait contenir "database"');
    
    // Reset
    logService.resetFilters();
});

// Test 6: Recherche Regex
runner.test('Recherche avec Regex', () => {
    const logs = [
        { id: '1', ts: new Date(), severity: 'info', source: 'API', message: 'GET /api/users → 200', meta: { hasError: false }, details: {} },
        { id: '2', ts: new Date(), severity: 'info', source: 'API', message: 'POST /api/users → 201', meta: { hasError: false }, details: {} },
        { id: '3', ts: new Date(), severity: 'error', source: 'API', message: 'GET /api/users → 500', meta: { hasError: true }, details: {} }
    ];

    logService.logs = logs;
    logService.resetFilters();
    
    // Rechercher avec regex: GET.*200
    logService.setFilter('useRegex', true);
    logService.setFilter('searchText', 'GET.*200');
    
    const displayed = logService.getDisplayedLogs();
    assertEquals(displayed.length, 1, 'Devrait trouver 1 log avec GET...200');
    
    // Reset
    logService.resetFilters();
    logService.setFilter('useRegex', false);
});

// Test 7: Facettes dynamiques
runner.test('Calcul des facettes dynamiques', () => {
    const logs = [
        { id: '1', ts: new Date(), severity: 'info', source: 'API', message: 'Log 1', meta: { hasError: false }, details: {}, http: { method: 'GET', status: 200 } },
        { id: '2', ts: new Date(), severity: 'info', source: 'System', message: 'Log 2', meta: { hasError: false }, details: {}, http: { method: 'POST', status: 201 } },
        { id: '3', ts: new Date(), severity: 'error', source: 'API', message: 'Log 3', meta: { hasError: true }, details: {}, http: { method: 'GET', status: 500 } }
    ];

    logService.logs = logs;
    logService.updateFacets();
    
    const state = logService.getState();
    const facets = state.facets;
    
    assertEquals(facets.severity.info, 2, 'Devrait avoir 2 logs info');
    assertEquals(facets.severity.error, 1, 'Devrait avoir 1 log error');
    assertEquals(facets.source.API, 2, 'Devrait avoir 2 logs de source API');
    assertEquals(facets.source.System, 1, 'Devrait avoir 1 log de source System');
    assertEquals(facets.method.GET, 2, 'Devrait avoir 2 méthodes GET');
    assertEquals(facets.method.POST, 1, 'Devrait avoir 1 méthode POST');
    
    console.log('   Facets:', facets);
});

// Test 8: Ring buffer FIFO
runner.test('Ring buffer FIFO (First In First Out)', () => {
    logService.setBufferSize(5);
    logService.logs = [];
    
    // Ajouter 10 logs
    for (let i = 1; i <= 10; i++) {
        logService.logs.push({
            id: `log-${i}`,
            ts: new Date(),
            severity: 'info',
            source: 'API',
            message: `Log ${i}`,
            meta: { hasError: false },
            details: {}
        });
        
        // Simuler la limitation du buffer
        if (logService.logs.length > 5) {
            logService.logs = logService.logs.slice(0, 5);
        }
    }
    
    assertEquals(logService.logs.length, 5, 'Le buffer devrait contenir 5 logs maximum');
    assertEquals(logService.logs[0].message, 'Log 10', 'Le premier log devrait être le plus récent (Log 10)');
    
    // Reset
    logService.setBufferSize(10000);
    logService.logs = [];
});

// Test 9: Export CSV format
runner.test('Export CSV - format valide', () => {
    const logs = [
        { 
            id: '1', 
            ts: '2025-10-02T14:22:11.123Z', 
            severity: 'info', 
            source: 'API', 
            message: 'Test "quoted" message, with comma', 
            meta: { hasError: false }, 
            details: {},
            http: { method: 'GET', url: '/api/test', status: 200, durationMs: 42 }
        }
    ];

    logService.logs = logs;
    logService.resetFilters();
    
    // Simuler l'export (sans téléchargement)
    const csv = ['Timestamp,Severity,Source,Message,Method,URL,Status,Duration(ms)'];
    const log = logs[0];
    const timestamp = new Date(log.ts).toISOString();
    const message = logService.escapeCsv(log.message);
    csv.push(`${timestamp},${log.severity},${log.source},${message},${log.http.method},${log.http.url},${log.http.status},${log.http.durationMs}`);
    
    const csvContent = csv.join('\n');
    
    assert(csvContent.includes('Test "quoted" message, with comma'), 'Le CSV devrait contenir le message échappé');
    console.log('   CSV Preview:', csvContent.split('\n')[1].substring(0, 100) + '...');
});

// Test 10: Sanitization dans api-client (simulé)
runner.test('Sanitization des données sensibles', () => {
    // Simuler la fonction sanitizeData
    const sensitizeData = (data) => {
        if (!data) return data;
        const sensitiveKeys = ['password', 'token', 'authorization', 'apiKey', 'secret'];
        const sanitized = JSON.parse(JSON.stringify(data));
        
        const sanitizeObject = (obj) => {
            for (const key in obj) {
                if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
                    obj[key] = '****';
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    sanitizeObject(obj[key]);
                }
            }
        };
        
        if (typeof sanitized === 'object') {
            sanitizeObject(sanitized);
        }
        
        return sanitized;
    };

    const data = {
        username: 'admin',
        password: 'SuperSecret123',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        apiKey: 'sk_live_1234567890',
        normalField: 'public data'
    };

    const sanitized = sensitizeData(data);

    assertEquals(sanitized.password, '****', 'Le password devrait être masqué');
    assertEquals(sanitized.token, '****', 'Le token devrait être masqué');
    assertEquals(sanitized.apiKey, '****', 'L\'apiKey devrait être masquée');
    assertEquals(sanitized.normalField, 'public data', 'Les champs normaux ne devraient pas être masqués');
    assertEquals(sanitized.username, 'admin', 'Le username devrait rester intact');
    
    console.log('   Sanitized:', sanitized);
});

// Exécuter les tests
runner.run();

