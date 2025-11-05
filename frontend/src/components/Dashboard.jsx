// src/components/Dashboard.jsx
import { useEffect, useState, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, Button, Badge } from 'react-bootstrap';
import { api } from '../api';

function formatNumber(n) {
    if (n === null || n === undefined) return '—';
    // formatea con separadores y hasta 2 decimales cuando haga falta
    const abs = Math.abs(n);
    const opts = abs >= 1000 ? { maximumFractionDigits: 2 } : { maximumFractionDigits: 6 };
    return new Intl.NumberFormat(undefined, opts).format(n);
}

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [items, setItems] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            const { metrics } = await api.listMetrics(); // { count, metrics: [] }
            if (!metrics || metrics.length === 0) {
                setItems([]);
                setLoading(false);
                return;
            }
            const latest = await Promise.all(
                metrics.map(async (m) => {
                    try {
                        const r = await api.latestOf(m); // { metric, data: { captured_at, value } }
                        return { key: m, ...(r?.data || { captured_at: null, value: null }) };
                    } catch {
                        return { key: m, captured_at: null, value: null, _error: true };
                    }
                })
            );
            // Orden: primero las que tienen fecha más reciente
            latest.sort((a, b) => new Date(b.captured_at || 0) - new Date(a.captured_at || 0));
            setItems(latest);
        } catch (e) {
            setErr(e?.message || 'Error loading metrics');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <Container className="py-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h2 className="m-0">Metrics (latest)</h2>
                <div className="d-flex gap-2">
                    <Button variant="secondary" onClick={load} disabled={loading}>
                        {loading ? 'Actualizando…' : 'Refresh'}
                    </Button>
                    <Badge bg="dark">
                        {items.length} metrics
                    </Badge>
                </div>
            </div>

            {loading && (
                <div className="d-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" />
                    <span>Loading…</span>
                </div>
            )}

            {err && !loading && (
                <Alert variant="danger" className="mt-2">Error: {err}</Alert>
            )}

            {!loading && !err && items.length === 0 && (
                <Alert variant="warning" className="mt-2">Not metrics available.</Alert>
            )}

            <Row xs={1} md={2} lg={3} className="g-3 mt-1">
                {items.map((m) => (
                    <Col key={m.key}>
                        <Card className="h-100">
                            <Card.Body>
                                <div className="d-flex justify-content-between align-items-start">
                                    <Card.Title className="mb-0">{m.key}</Card.Title>
                                    {m._error && <Badge bg="danger">ERR</Badge>}
                                </div>
                                <div className="display-6 mt-2">{formatNumber(m.value)}</div>
                                <div className="text-muted mt-2" style={{ fontSize: '0.9rem' }}>
                                    {m.captured_at
                                        ? new Date(m.captured_at).toLocaleString()
                                        : 'no date'}
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>
        </Container>
    );
}
