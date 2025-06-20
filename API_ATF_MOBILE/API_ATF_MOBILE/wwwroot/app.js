
async function login() {
    const matricule = document.getElementById('matricule').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = '';

    try {
        const payload = {
            Matricule: matricule,
            MotDePasse: password
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
        window.location.href = "dashboard.html";
    } catch (error) {
        errorDiv.textContent = error.message;
    }
}
