import { useEffect, useMemo, useState } from 'react';
import { Container, Row, Col, Card, Spinner } from 'react-bootstrap';
import axios from 'axios';

const API_BASE = ''; // con proxy. Si no usas proxy: 'https://cantontrack.ddev.site'
const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });

function usePrice(intervalMs = 30000) {
    const [price, setPrice] = useState(null);
    const [ts, setTs] = useState(null);
    const [error, setError] = useState(null);

    const pickPrice = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        if (typeof obj.price === 'number') return obj.price;
        if (typeof obj.price_usd === 'number') return obj.price_usd;
        if (typeof obj.usd === 'number') return obj.usd;
        for (const k of Object.keys(obj)) if (typeof obj[k] === 'number') return obj[k];
        return null;
    };

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/price/cc`, { timeout: 10000 });
                if (!mounted) return;
                setPrice(pickPrice(res.data));
                setTs(new Date().toISOString());
                setError(null);
            } catch (e) {
                if (!mounted) return;
                setError(e.message);
            }
        };
        load();
        const t = setInterval(load, intervalMs);
        return () => { mounted = false; clearInterval(t); };
    }, [intervalMs]);

    return { price, ts, error };
}

export default function Dashboard() {
    const [metrics, setMetrics] = useState([]);
    const [latest, setLatest] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { price, ts: priceTs, error: priceError } = usePrice(30000);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/stats`, { timeout: 10000 });
                const list = res.data?.metrics ?? [];
                if (!mounted) return;
                setMetrics(list);

                const calls = list.map(m =>
                    axios.get(`${API_BASE}/api/stats/${m}/latest`, { timeout: 10000 })
                        .then(r => [m, r.data?.data ?? null])
                        .catch(() => [m, null])
                );
                const results = await Promise.all(calls);
                if (!mounted) return;
                const map = {};
                for (const [m, d] of results) map[m] = d;
                setLatest(map);
                setError(null);
            } catch (e) {
                if (!mounted) return;
                setError(e.message);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const tiles = useMemo(() => metrics.map(m => {
        const d = latest[m];
        const val = (d && typeof d.value === 'number')
            ? fmt.format(d.value)
            : (d && d.value != null) ? String(d.value) : '—';
        const when = d?.captured_at ? new Date(d.captured_at).toLocaleString() : '—';

        return (
            <Col md={4} className="mb-3" key={m}>
                <Card className="h-100 shadow-sm">
                    <Card.Body>
                        <Card.Title className="text-truncate">{m}</Card.Title>
                        <div className="display-6 fw-semibold">{val}</div>
                        <div className="text-muted small mt-2">Updated: {when}</div>
                    </Card.Body>
                </Card>
            </Col>
        );
    }), [metrics, latest]);

    return (
        <Container className="mt-4">
            <Row className="mb-4">
                <Col md={4}>
                    <Card className="h-100 border-0 shadow">
                        <Card.Body>
                            <Card.Title>CC Price (real-time)</Card.Title>
                            <div className="display-5 fw-bold">
                                {price !== null ? `$${fmt.format(price)}` : '—'}
                            </div>
                            <div className="text-muted small mt-2">
                                {priceError ? `Error: ${priceError}` : priceTs ? `Updated: ${new Date(priceTs).toLocaleString()}` : '—'}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <h2 className="mb-3">Stored Metrics (latest values)</h2>

            {loading && (
                <div className="text-center my-5">
                    <Spinner animation="border" />
                    <div className="mt-2">Loading…</div>
                </div>
            )}

            {!loading && error && <div className="alert alert-danger">API error: {error}</div>}

            {!loading && !error && metrics.length === 0 && (
                <div className="text-muted">No metrics found</div>
            )}

            {!loading && !error && metrics.length > 0 && (
                <Row>{tiles}</Row>
            )}
        </Container>
    );
}
