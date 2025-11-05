// filepath: frontend/src/components/MetricsCharts.jsx
import { useEffect, useState } from 'react';
import { Card, Spinner, Alert, Row, Col, Button } from 'react-bootstrap';
import { api } from '../api';

function Sparkline({ points = [], color = '#40FB50', width = 300, height = 80 }) {
    if (!points || points.length === 0) {
        return (
            <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>
                No data
            </div>
        );
    }
    const vals = points.map(p => (p && typeof p.value === 'number' ? p.value : NaN)).filter(v => !Number.isNaN(v));
    if (vals.length === 0) return <div style={{ width, height, color: '#bbb' }}>No numeric data</div>;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = 6;
    const w = Math.max(40, width - pad * 2);
    const h = Math.max(20, height - pad * 2);
    const stepX = vals.length > 1 ? w / (vals.length - 1) : w;
    const scaleY = (v) => {
        if (max === min) return pad + h / 2; // flat line
        return pad + (1 - (v - min) / (max - min)) * h;
    };
    const pointsStr = vals.map((v, i) => `${pad + i * stepX},${scaleY(v)}`).join(' ');

    // small area path (optional)
    const areaPath = (() => {
        const top = vals.map((v, i) => `${pad + i * stepX},${scaleY(v)}`).join(' L ');
        return `M ${pad},${pad + h} L ${top} L ${pad + (vals.length - 1) * stepX},${pad + h} Z`;
    })();

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <path d={areaPath} fill={color} opacity={0.06} />
            <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pointsStr} />
        </svg>
    );
}

export default function MetricsCharts({ metrics = [], limit = 100 }) {
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState(null);
    const [seriesMap, setSeriesMap] = useState({});

    useEffect(() => {
        if (!metrics || metrics.length === 0) {
            setSeriesMap({});
            return;
        }
        let cancelled = false;
        async function loadAll() {
            setLoading(true);
            setErr(null);
            try {
                const results = await Promise.all(metrics.map(async (m) => {
                    try {
                        const r = await api.seriesOf(m, { limit }); // espera { metric, data: [...] }
                        return { key: m, data: r?.data || [] };
                    } catch (e) {
                        return { key: m, data: [], _error: true };
                    }
                }));
                if (cancelled) return;
                const map = {};
                results.forEach(r => { map[r.key] = r; });
                setSeriesMap(map);
            } catch (e) {
                if (!cancelled) setErr(e?.message || 'Error loading series');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadAll();
        return () => { cancelled = true; };
    }, [metrics, limit]);

    if (!metrics || metrics.length === 0) return null;

    return (
        <div className="mt-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
                <h3 className="m-0">Metrics (history)</h3>
                <div>
                    <small className="text-muted">Showing up to {limit} points per metric</small>
                </div>
            </div>

            {loading && (
                <div className="d-flex align-items-center gap-2 mb-2">
                    <Spinner animation="border" size="sm" />
                    <span>Loading series…</span>
                </div>
            )}

            {err && <Alert variant="danger">{err}</Alert>}

            <Row xs={1} md={2} lg={3} className="g-3">
                {metrics.map((key) => {
                    const item = seriesMap[key] || { data: [] };
                    return (
                        <Col key={key}>
                            <Card className="h-100">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <Card.Title className="mb-0">{key}</Card.Title>
                                        {item._error && <small className="text-danger">error</small>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <Sparkline points={item.data} width={260} height={80} />
                                        <div style={{ minWidth: 100 }}>
                                            <div className="fw-semibold" style={{ fontSize: '1.25rem' }}>
                                                {item.data && item.data.length > 0 ? (
                                                    new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(item.data[item.data.length - 1].value)
                                                ) : '—'}
                                            </div>
                                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                                {item.data && item.data.length > 0 ? new Date(item.data[item.data.length - 1].captured_at).toLocaleString() : 'no date'}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#bbb', marginTop: 6 }}>
                                                {item.data ? `${item.data.length} pts` : ''}
                                            </div>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </div>
    );
}

