import { useEffect, useState } from 'react';
import { Container, Row, Col, Card, Spinner, Alert } from 'react-bootstrap';
import { api } from '../api';

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [items, setItems] = useState([]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { metrics } = await api.listMetrics(); // {count, metrics:[...] }
                const latest = await Promise.all(
                    metrics.map(async (m) => {
                        const r = await api.latestOf(m); // {metric, data:{captured_at,value}}
                        return { key: m, ...r.data };
                    })
                );
                if (mounted) { setItems(latest); setLoading(false); }
            } catch (e) {
                if (mounted) { setErr(e.message || 'Error'); setLoading(false); }
            }
        })();
        return () => { mounted = false; };
    }, []);

    if (loading) return <Container className="py-4"><Spinner animation="border" /> Cargando…</Container>;
    if (err)      return <Container className="py-4"><Alert variant="danger">Error: {err}</Alert></Container>;

    return (
        <Container className="py-4">
            <Row xs={1} md={2} lg={3} className="g-3">
                {items.map((m) => (
                    <Col key={m.key}>
                        <Card className="h-100">
                            <Card.Body>
                                <Card.Title>{m.key}</Card.Title>
                                <Card.Text className="display-6">{m.value ?? '—'}</Card.Text>
                                <small className="text-muted">
                                    {m.captured_at ? new Date(m.captured_at).toLocaleString() : 'sin fecha'}
                                </small>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>
        </Container>
    );
}
