import React, { useState, useMemo } from 'react';
import { useMedia } from '../context/MediaContext';
import FilterBar from '../components/FilterBar';
import HeroSection from '../components/HeroSection';
import MediaCard from '../components/MediaCard';
import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
    const { mediaGroups, loading, error, loadingStatus, searchQuery, watched } = useMedia();
    const [filter, setFilter] = useState('all');
    const navigate = useNavigate();

    const filteredGroups = useMemo(() => {
        if (!mediaGroups) return [];
        let groups = Object.entries(mediaGroups);

        // Filter by Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            groups = groups.filter(([group, items]) => {
                const groupMatches = group.toLowerCase().includes(query);
                const itemsMatch = items.some(item => item.name.toLowerCase().includes(query));
                return groupMatches || itemsMatch;
            });
        }

        // Filter by Category
        return groups.filter(([group, items]) => {
            if (filter === 'all') return true;
            const firstItem = items[0];
            if (!firstItem) return false;

            const pathLower = firstItem.id.toLowerCase();
            if (filter === 'series') {
                return pathLower.startsWith('series') || pathLower.includes('/series/');
            }
            if (filter === 'movies') {
                return pathLower.startsWith('movies') || pathLower.startsWith('peliculas') || pathLower.includes('/movies/') || pathLower.includes('/peliculas/');
            }
            return true;
        });
    }, [mediaGroups, filter, searchQuery]);

    // Recently Watched (Continue Watching) - deduplicated by group
    const recentlyWatched = useMemo(() => {
        if (!mediaGroups || !watched) return [];

        // 1. Get all items that are watched
        const watchedItems = Object.values(mediaGroups).flat().filter(item => {
            const status = watched[item.id];
            return status && (typeof status === 'object' ? status.status : status);
        });

        // 2. Group them and pick the latest one (by timestamp or library order)
        const groupsMap = {};
        watchedItems.forEach(item => {
            const watchedData = watched[item.id];
            const timestamp = typeof watchedData === 'object' ? watchedData.lastWatched : 0;

            if (!groupsMap[item.group]) {
                groupsMap[item.group] = { item, timestamp };
            } else {
                const current = groupsMap[item.group];
                // If timestamp is better, update. 
                // If timestamps are tied (e.g. both 0), pick the one that appears later in the alphabetical order (likely higher episode number)
                if (timestamp > current.timestamp) {
                    groupsMap[item.group] = { item, timestamp };
                } else if (timestamp === current.timestamp) {
                    if (item.name.localeCompare(current.item.name, undefined, { numeric: true }) > 0) {
                        groupsMap[item.group] = { item, timestamp };
                    }
                }
            }
        });

        // 3. Sort groups by timestamp and return items
        return Object.values(groupsMap)
            .sort((a, b) => b.timestamp - a.timestamp)
            .map(entry => entry.item)
            .slice(0, 10);
    }, [mediaGroups, watched]);

    // Pick a random item for the hero section
    const heroItem = useMemo(() => {
        const groups = Object.values(mediaGroups);
        if (groups.length === 0) return null;
        const groupsWithImages = groups.filter(items => items.some(i => i.image));
        const pool = groupsWithImages.length > 0 ? groupsWithImages : groups;
        const randomGroup = pool[Math.floor(Math.random() * pool.length)];
        return randomGroup[0];
    }, [mediaGroups]);

    if (loading) return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#fff', background: '#111', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2>Cargando biblioteca...</h2>
            <div style={{ textAlign: 'left', maxWidth: '600px', margin: '20px auto', fontFamily: 'monospace', background: '#000', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
                <pre style={{ whiteSpace: 'pre-wrap', color: '#0f0' }}>{loadingStatus}</pre>
            </div>
        </div>
    );

    if (error) return <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>Error: {error}</div>;

    return (
        <div className="home-page" style={{ paddingBottom: '5rem' }}>
            {!searchQuery && <HeroSection item={heroItem} />}

            <div className="content-wrap" style={{ padding: searchQuery ? '120px 3rem 0' : '0 3rem' }}>

                {/* Continue Watching Section */}
                {!searchQuery && recentlyWatched.length > 0 && (
                    <div className="continue-watching" style={{ marginBottom: '3rem' }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            Continuar viendo
                        </h2>
                        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '10px' }} className="no-scrollbar">
                            {recentlyWatched.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => navigate(`/watch/${encodeURIComponent(item.id)}`)}
                                    style={{
                                        minWidth: '240px',
                                        aspectRatio: '16/9',
                                        background: '#1a1a1a',
                                        borderRadius: '8px',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <img
                                        src={`/api/thumbnail?id=${encodeURIComponent(item.id)}`}
                                        alt={item.name}
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = item.image ? `/media/${item.image}` : `https://images.unsplash.com/photo-1594908900066-3f47337549d8?q=80&w=400&auto=format&fit=crop`;
                                        }}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
                                    />
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} onMouseEnter={e => e.target.style.opacity = 1} onMouseLeave={e => e.target.style.opacity = 0}>
                                        <Play fill="white" size={32} />
                                    </div>
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px', background: 'linear-gradient(transparent, black)' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#aaa' }}>{item.group}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem'
                }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0 }}>
                        {searchQuery ? `Resultados para "${searchQuery}"` : 'Explorar Catálogo'}
                    </h2>
                    <FilterBar filter={filter} setFilter={setFilter} />
                </div>

                {filteredGroups.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: '5rem', color: '#666' }}>
                        <h3>No se encontró contenido</h3>
                        <p>Prueba con otros términos de búsqueda o filtros.</p>
                    </div>
                ) : (
                    <div className="media-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '2rem'
                    }}>
                        {filteredGroups.map(([group, items]) => (
                            <MediaCard key={group} group={group} items={items} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Home;
