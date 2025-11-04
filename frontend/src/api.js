import axios from 'axios';

// Si usas el proxy en vite.config.js, deja baseURL como vacío ('')
// Si prefieres llamadas directas, pon la URL de tu backend
export const api = axios.create({
    baseURL: '', // o 'https://cantontrack.ddev.site'
    timeout: 10000,
});
