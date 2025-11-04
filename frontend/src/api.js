// src/api.js
const API_BASE =
    import.meta.env.VITE_API_URL?.replace(/\/$/, '') // p.ej. https://api.tu-dominio.com
    ?? `${window.location.origin}/api`;               // fallback: mismo host bajo /api

async function get(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// Ejemplos de endpoints (ajusta a tu API real)
export const api = {
    // última captura de todas las métricas
    latestAll: () => get('/metrics/latest'),
    // última captura de una métrica concreta ?key=
    latestByKey: (key) => get(`/metrics/latest?key=${encodeURIComponent(key)}`),
    // lista de métricas disponibles
    listMetrics: () => get('/metrics'),
};
