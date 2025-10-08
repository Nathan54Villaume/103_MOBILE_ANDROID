async function login() {
    const matricule = document.getElementById('matricule').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = '';

    // --- LISTE DES UTILISATEURS LOCAUX ---
    // Pour ajouter un utilisateur, copiez un bloc et modifiez les informations.
    const localUsers = [
        {
            Matricule: "livio.barale",
            Nom: "Livio Barale",
            MotDePasse: "samsam",
            Role: "SUPERVISEUR",
            Source: "LOCAL"
        },
        {
            Matricule: "sergio.suardini",
            Nom: "Sergio Suardini",
            MotDePasse: "samsam",
            Role: "SUPERVISEUR",
            Source: "LOCAL"
        },
        {
             Matricule: "maxime.moreau",
             Nom: "Maxime Moreau",
             MotDePasse: "samsam",
             Role: "CONSULTANT",
             Source: "LOCAL"
        },
        {
            Matricule: "david.laurrin",
            Nom: "David Laurrin",
            MotDePasse: "samsam",
            Role: "CONSULTANT",
            Source: "LOCAL"
        },
        {
            Matricule: "florian.thuret",
            Nom: "Florian Thuret",
            MotDePasse: "samsam",
            Role: "CONSULTANT",
            Source: "LOCAL"
        }
    ];

    // On cherche si les identifiants correspondent � un utilisateur local
    const foundUser = localUsers.find(user => user.Matricule.toLowerCase() === matricule.toLowerCase() && user.MotDePasse === password);

    if (foundUser) {
        // Si un utilisateur local est trouv�, on le connecte
        localStorage.setItem("user", JSON.stringify(foundUser));
        window.location.href = "supervision-poste-electrique_dev/index_dev.html";
        return; // On arr�te la fonction ici
    }
    // --- FIN DE LA GESTION LOCALE ---

    // Si aucun utilisateur local n'a �t� trouv�, on continue avec l'appel API
    try {
        const payload = {
            Username: matricule,
            Password: password
        };

        const response = await fetch('http://10.250.13.4:8088/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const msg = await response.text();
            throw new Error('Identifiants invalides\n' + msg);
        }

        const data = await response.json();
        localStorage.setItem("user", JSON.stringify(data));
        window.location.href = "supervision-poste-electrique_dev/index_dev.html";
    } catch (error) {
        errorDiv.textContent = error.message;
    }
}