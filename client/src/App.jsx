import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { MediaProvider } from './context/MediaContext';
import Home from './pages/Home';
import Details from './pages/Details';
import Player from './pages/Player';

import SearchBar from './components/SearchBar';

function App() {
    return (
        <MediaProvider>
            <Router>
                <div className="app">
                    <header>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                            <Link to="/" style={{ textDecoration: 'none' }}>
                                <div className="logo">STREAMWEB</div>
                            </Link>

                            <nav className="header-nav">
                                <Link to="/" className="nav-link">Inicio</Link>
                            </nav>
                        </div>
                        <SearchBar />
                    </header>

                    <main>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/details/:group" element={<Details />} />
                            <Route path="/watch/:id" element={<Player />} />
                        </Routes>
                    </main>
                </div>
            </Router>
        </MediaProvider>
    );
}

export default App;
