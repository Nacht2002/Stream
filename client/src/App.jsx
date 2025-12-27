import React, { useState, useEffect } from 'react';
import { Play, ArrowLeft, Film, CheckCircle, ChevronDown, ChevronRight, SkipForward } from 'lucide-react';
import Hls from 'hls.js';

const VideoPreview = ({ item, isWatched }) => {
    const [isHovering, setIsHovering] = useState(false);

    return (
        <div
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {isHovering ? (
                <video
                    src={`/api/stream?id=${encodeURIComponent(item.id)}`}
                    autoPlay
                    muted
                    loop
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                item.image ? (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        <img
                            src={`/media/${item.image}`}
                            alt={item.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isWatched ? 0.5 : 1 }}
                        />
                        <div className="media-card-content" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.7)' }}>
                            <div className="media-title">{item.name}</div>
                        </div>
                    </div>
                ) : (
                    <div className="media-card-content">
                        <Film size={40} color={isWatched ? "#4caf50" : "#e50914"} style={{ marginBottom: '10px' }} />
                        <div className="media-title">{item.name}</div>
                    </div>
                )
            )}
        </div>
    );
};

function App() {
    const [mediaGroups, setMediaGroups] = useState({});
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [watched, setWatched] = useState({});
    const [filter, setFilter] = useState('all');
    const videoRef = React.useRef(null);
    const hlsRef = React.useRef(null);

    useEffect(() => {
        Promise.all([
            fetch('/api/media').then(res => res.json()),
            fetch('/api/watched').then(res => res.json())
        ])
            .then(([mediaData, watchedData]) => {
                setMediaGroups(mediaData);
                setWatched(watchedData);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError('Failed to load data');
                setLoading(false);
            });
    }, []);

    // Effect to handle video playback when selectedVideo changes
    useEffect(() => {
        if (selectedVideo && videoRef.current) {
            const video = videoRef.current;

            // Clean up previous HLS instance
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }

            // Fetch stream info
            fetch(`/api/stream?id=${encodeURIComponent(selectedVideo.id)}`)
                .then(res => res.json())
                .then(data => {
                    if (data.type === 'hls') {
                        if (Hls.isSupported()) {
                            const hls = new Hls();
                            hlsRef.current = hls;
                            hls.loadSource(data.url);
                            hls.attachMedia(video);
                            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                                video.play().catch(e => console.error("Auto-play failed", e));
                            });
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            // Native HLS support (Safari)
                            video.src = data.url;
                            video.addEventListener('loadedmetadata', () => {
                                video.play().catch(e => console.error("Auto-play failed", e));
                            });
                        }
                    } else {
                        // Native playback (MP4)
                        video.src = data.url;
                        video.play().catch(e => console.error("Auto-play failed", e));
                    }
                })
                .catch(err => console.error("Error fetching stream info", err));
        }

        // Cleanup on unmount or video change
        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [selectedVideo]);

    const updateWatchedStatus = (id, status) => {
        const newWatched = { ...watched, [id]: status };
        setWatched(newWatched);

        fetch('/api/watched', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status })
        }).catch(err => console.error('Failed to sync watched status', err));
    };

    const handlePlay = (video) => {
        setSelectedVideo(video);
    };

    const handleBack = () => {
        setSelectedVideo(null);
    };

    const toggleGroup = (group) => {
        setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const handleNext = () => {
        if (!selectedVideo) return;

        updateWatchedStatus(selectedVideo.id, true);

        const groupItems = mediaGroups[selectedVideo.group];
        if (!groupItems) return;

        const currentIndex = groupItems.findIndex(item => item.id === selectedVideo.id);
        if (currentIndex !== -1 && currentIndex < groupItems.length - 1) {
            setSelectedVideo(groupItems[currentIndex + 1]);
        }
    };

    const handleVideoEnded = () => {
        if (selectedVideo) {
            updateWatchedStatus(selectedVideo.id, true);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading library...</div>;
    if (error) return <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>Error: {error}</div>;

    const filteredGroups = Object.entries(mediaGroups).filter(([group]) => {
        if (filter === 'all') return true;
        if (filter === 'series') return group.toLowerCase().includes('series') || group.toLowerCase().includes('serie');
        if (filter === 'movies') return group.toLowerCase().includes('movies') || group.toLowerCase().includes('pelicula');
        return true;
    }).reduce((acc, [group, items]) => {
        acc[group] = items;
        return acc;
    }, {});

    return (
        <div className="app">
            {selectedVideo ? (
                <div className="player-overlay">
                    <button className="back-button" onClick={handleBack}>
                        <ArrowLeft size={20} /> Back to Library
                    </button>

                    {selectedVideo && mediaGroups[selectedVideo.group] &&
                        mediaGroups[selectedVideo.group].findIndex(i => i.id === selectedVideo.id) < mediaGroups[selectedVideo.group].length - 1 && (
                            <button
                                className="next-button"
                                onClick={handleNext}
                                style={{
                                    position: 'absolute',
                                    top: '20px',
                                    right: '20px',
                                    background: 'rgba(229, 9, 20, 0.8)',
                                    border: 'none',
                                    color: 'white',
                                    padding: '10px 20px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    zIndex: 1001,
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                Next Episode <SkipForward size={20} />
                            </button>
                        )}

                    <video
                        ref={videoRef}
                        controls
                        onEnded={handleVideoEnded}
                        style={{ width: '100%', height: '100%' }}
                    />
                </div>
            ) : (
                <>
                    <header>
                        <div className="logo">STREAMER</div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => setFilter('all')}
                                style={{
                                    background: filter === 'all' ? 'var(--accent)' : 'transparent',
                                    border: '2px solid var(--accent)',
                                    color: 'white',
                                    padding: '0.5rem 1.5rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'all 0.3s'
                                }}
                            >
                                Todos
                            </button>
                            <button
                                onClick={() => setFilter('series')}
                                style={{
                                    background: filter === 'series' ? 'var(--accent)' : 'transparent',
                                    border: '2px solid var(--accent)',
                                    color: 'white',
                                    padding: '0.5rem 1.5rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'all 0.3s'
                                }}
                            >
                                Series
                            </button>
                            <button
                                onClick={() => setFilter('movies')}
                                style={{
                                    background: filter === 'movies' ? 'var(--accent)' : 'transparent',
                                    border: '2px solid var(--accent)',
                                    color: 'white',
                                    padding: '0.5rem 1.5rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'all 0.3s'
                                }}
                            >
                                Películas
                            </button>
                        </div>
                    </header>
                    <main>
                        {Object.keys(filteredGroups).length === 0 ? (
                            <div style={{ textAlign: 'center', marginTop: '3rem', color: '#666' }}>
                                <h3>No media found</h3>
                                <p>No hay contenido en esta categoría.</p>
                            </div>
                        ) : (
                            Object.entries(filteredGroups).map(([group, items]) => (
                                <div key={group} className="category-section">
                                    <div
                                        className="category-header"
                                        onClick={() => toggleGroup(group)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            marginTop: '2rem',
                                            marginBottom: '1rem'
                                        }}
                                    >
                                        {collapsedGroups[group] ? <ChevronRight color="#a0a0a0" /> : <ChevronDown color="#a0a0a0" />}
                                        <h2 className="category-title" style={{ margin: '0 0 0 10px', marginTop: 0, marginBottom: 0 }}>{group}</h2>
                                    </div>

                                    {!collapsedGroups[group] && (
                                        <div className="media-grid">
                                            {items.map(item => (
                                                <div
                                                    key={item.id}
                                                    className="media-card"
                                                    onClick={() => handlePlay(item)}
                                                >
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            top: '10px',
                                                            right: '10px',
                                                            zIndex: 20,
                                                            cursor: 'pointer',
                                                            background: 'rgba(0,0,0,0.5)',
                                                            borderRadius: '50%',
                                                            padding: '4px',
                                                            display: 'flex'
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateWatchedStatus(item.id, !watched[item.id]);
                                                        }}
                                                    >
                                                        <CheckCircle
                                                            size={24}
                                                            color={watched[item.id] ? "#4caf50" : "rgba(255,255,255,0.3)"}
                                                            fill={watched[item.id] ? "rgba(76, 175, 80, 0.2)" : "none"}
                                                        />
                                                    </div>
                                                    <VideoPreview item={item} isWatched={watched[item.id]} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </main>
                </>
            )}
        </div>
    );
}

export default App;
