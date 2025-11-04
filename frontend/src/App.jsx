import { Container, Navbar } from 'react-bootstrap';
import Dashboard from './components/Dashboard';

export default function App() {
    return (
        <>
            <Navbar bg="dark" data-bs-theme="dark">
                <Container>
                    <Navbar.Brand>CantonTrack</Navbar.Brand>
                </Container>
            </Navbar>
            <Dashboard />
        </>
    );
}