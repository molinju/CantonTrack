// src/api.js
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, ''); // p.ej. http://51.75.254.181:8081/api

async function get(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// tus endpoints reales:
export const api = {
    listMetrics: () => get('/stats'),                         // GET /api/stats
    latestOf: (metric) => get(`/stats/${metric}/latest`),     // GET /api/stats/{metric}/latest
    seriesOf: (metric, params={}) => {
        const qs = new URLSearchParams(params).toString();
        return get(`/stats/${metric}${qs ? `?${qs}` : ''}`);    // GET /api/stats/{metric}
    },
};
