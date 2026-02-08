import React, { useState, useEffect } from 'react';
import { Play, ArrowLeft, Film, CheckCircle, ChevronDown, ChevronRight, SkipForward, Settings, MessageSquare, Music } from 'lucide-react';
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

    // Track Selection State
    const [audioTracks, setAudioTracks] = useState([]);
    const [subtitleTracks, setSubtitleTracks] = useState([]);
    const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
    const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(null);
    const [showTrackSelector, setShowTrackSelector] = useState(false);

    // State for View Navigation (Moved to top to fix Hook Error)
    const [view, setView] = useState('library'); // 'library', 'details', 'player'
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [selectedSubGroup, setSelectedSubGroup] = useState(null); // For nested series (Seasons/Arcs)

    const [showDebug, setShowDebug] = useState(false);

    const videoRef = React.useRef(null);
    const hlsRef = React.useRef(null);

    const [loadingStatus, setLoadingStatus] = useState('Initializing...');

    useEffect(() => {
        console.log("Fetching media...");
        setLoadingStatus('Starting fetch...');

        const timeoutFetch = (url, options = {}, timeout = 5000) => {
            return Promise.race([
                fetch(url, options),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timed out after ' + timeout + 'ms')), timeout)
                )
            ]);
        };

        const fetchMedia = timeoutFetch('/api/media')
            .then(res => {
                setLoadingStatus(prev => prev + '\nMedia: ' + res.status + ' ' + res.statusText);
                if (!res.ok) throw new Error('Failed to fetch media: ' + res.status);
                return res.text().then(text => {
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        throw new Error('Media JSON Parse Error: ' + text.substring(0, 50));
                    }
                });
            });

        const fetchWatched = timeoutFetch('/api/watched')
            .then(res => {
                setLoadingStatus(prev => prev + '\nWatched: ' + res.status + ' ' + res.statusText);
                if (!res.ok) throw new Error('Failed to fetch watched: ' + res.status);
                return res.json();
            });

        Promise.all([fetchMedia, fetchWatched])
            .then(([mediaData, watchedData]) => {
                console.log("Media Data Received:", mediaData);
                console.log("Watched Data Received:", watchedData);
                setMediaGroups(mediaData);
                setWatched(watchedData);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error loading data:", err);
                setLoadingStatus(prev => prev + '\nERROR: ' + err.message);
                setError('Failed to load data: ' + err.message);
                setLoading(false);
            });
    }, []);

    // Fetch metadata when video is selected
    useEffect(() => {
        if (selectedVideo) {
            // Reset tracks
            setAudioTracks([]);
            setSubtitleTracks([]);
            setSelectedAudioTrack(null);
            setSelectedSubtitleTrack(null);

            fetch(`/api/metadata?id=${encodeURIComponent(selectedVideo.id)}`)
                .then(res => res.json())
                .then(data => {
                    setAudioTracks(data.audio || []);
                    setSubtitleTracks(data.subtitles || []);
                    // Default to first audio if available (or let backend decide if null)
                    // We don't necessarily select one strictly unless user wants to change it
                })
                .catch(err => console.error("Failed to fetch metadata", err));
        }
    }, [selectedVideo]);

    // Effect to handle video playback when selectedVideo OR tracks change
    useEffect(() => {
        if (selectedVideo && videoRef.current) {
            const video = videoRef.current;

            // Retain playback position if just switching tracks (optional, but good UX)
            const currentTime = video.currentTime;
            // Also retain paused state?
            const wasPaused = video.paused;

            // Clean up previous HLS instance
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }

            // Construct URL with track params
            let url = `/api/stream?id=${encodeURIComponent(selectedVideo.id)}`;
            if (selectedAudioTrack !== null) url += `&audioStream=${selectedAudioTrack}`;
            if (selectedSubtitleTrack !== null) url += `&subtitleStream=${selectedSubtitleTrack}`;

            // Fetch stream info
            fetch(url)
                .then(res => res.json())
                .then(data => {
                    if (data.type === 'hls') {
                        if (Hls.isSupported()) {
                            const hls = new Hls();
                            hlsRef.current = hls;
                            hls.loadSource(data.url);
                            hls.attachMedia(video);
                            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                                // Restore time (only if we have played a bit, to avoid seeking on fresh start)
                                if (currentTime > 0) video.currentTime = currentTime;

                                if (!wasPaused) {
                                    video.play().catch(e => console.error("Auto-play failed", e));
                                }
                            });
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            // Native HLS support (Safari)
                            video.src = data.url;
                            video.addEventListener('loadedmetadata', () => {
                                if (currentTime > 0) video.currentTime = currentTime;
                                if (!wasPaused) {
                                    video.play().catch(e => console.error("Auto-play failed", e));
                                }
                            });
                        }
                    } else {
                        // Native playback (MP4)
                        video.src = data.url;
                        if (currentTime > 0) video.currentTime = currentTime;
                        if (!wasPaused) {
                            video.play().catch(e => console.error("Auto-play failed", e));
                        }
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
    }, [selectedVideo, selectedAudioTrack, selectedSubtitleTrack]);

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
        setShowTrackSelector(false);
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

    if (loading) return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#fff', background: '#111', height: '100vh' }}>
            <h2>Loading Library...</h2>
            <div style={{ textAlign: 'left', maxWidth: '600px', margin: '20px auto', fontFamily: 'monospace', background: '#222', padding: '15px' }}>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{loadingStatus}</pre>
                <p style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '20px' }}>If this takes more than 5 seconds, the server might be unreachable.</p>
            </div>
        </div>
    );
    if (error) return <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>Error: {error}</div>;



    const filteredGroups = Object.entries(mediaGroups).filter(([group, items]) => {
        if (filter === 'all') return true;
        // Check the first item to see if it belongs to Series or Movies based on its ID/Path
        // item.id is relative path like "Series/Show/..."
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
    }).reduce((acc, [group, items]) => {
        acc[group] = items;
        return acc;
    }, {});

    const handleGroupClick = (groupName) => {
        setSelectedGroup(groupName);
        setSelectedSubGroup(null); // Reset sub-group when opening a new group
        setView('details');
    };

    const handleBackToLibrary = () => {
        if (selectedSubGroup) {
            setSelectedSubGroup(null); // Go back to Group view (Season Grid)
        } else {
            setSelectedGroup(null);
            setView('library');
            setSelectedVideo(null);
        }
    };

    // When a video is selected (played), we are in 'player' "view" conceptually (overlay), 
    // but our current UI uses a conditional {selectedVideo ? ... : ...} which works fine.
    // We can keep selectedVideo as the trigger for the player overlay.

    return (
        <div className="app">
            {selectedVideo ? (
                // PLAYER VIEW (Overlay)
                <div className="player-overlay">
                    <button className="back-button" onClick={() => setSelectedVideo(null)}>
                        <ArrowLeft size={20} /> Back
                    </button>

                    {/* Track Selection Button */}
                    <button
                        className="tracks-button"
                        onClick={() => setShowTrackSelector(!showTrackSelector)}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '180px',
                            background: showTrackSelector ? '#e50914' : 'rgba(0, 0, 0, 0.7)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            color: 'white',
                            padding: '10px 15px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            zIndex: 20
                        }}
                    >
                        <Settings size={20} /> Tracks
                    </button>

                    {/* Show Track Selector Modal */}
                    {showTrackSelector && (
                        <div style={{
                            position: 'absolute',
                            top: '60px',
                            right: '50px',
                            background: 'rgba(0,0,0,0.95)',
                            padding: '20px',
                            borderRadius: '8px',
                            zIndex: 100,
                            minWidth: '250px',
                            color: 'white'
                        }}>
                            <h4 style={{ marginTop: 0, borderBottom: '1px solid #333', paddingBottom: '10px' }}>Audio</h4>
                            <div style={{ marginBottom: '20px' }}>
                                {audioTracks.length === 0 && <div style={{ opacity: 0.5 }}>No alternate tracks</div>}
                                {audioTracks.map((track, i) => (
                                    <div
                                        key={i}
                                        onClick={() => { setSelectedAudioTrack(track.index); setShowTrackSelector(false); }}
                                        style={{
                                            padding: '8px',
                                            cursor: 'pointer',
                                            background: selectedAudioTrack === track.index ? '#e50914' : 'transparent',
                                            borderRadius: '4px',
                                            display: 'flex', alignItems: 'center', gap: '8px'
                                        }}
                                    >
                                        <Music size={16} />
                                        {track.tags?.language || 'Unknown'} - {track.tags?.title || `Track ${i + 1}`}
                                        {selectedAudioTrack === track.index && <CheckCircle size={16} />}
                                    </div>
                                ))}
                            </div>

                            <h4 style={{ marginTop: 0, borderBottom: '1px solid #333', paddingBottom: '10px' }}>Subtitles</h4>
                            <div>
                                <div
                                    onClick={() => { setSelectedSubtitleTrack(null); setShowTrackSelector(false); }}
                                    style={{
                                        padding: '8px',
                                        cursor: 'pointer',
                                        background: selectedSubtitleTrack === null ? '#e50914' : 'transparent',
                                        borderRadius: '4px',
                                        display: 'flex', alignItems: 'center', gap: '8px'
                                    }}
                                >
                                    <MessageSquare size={16} /> Off
                                    {selectedSubtitleTrack === null && <CheckCircle size={16} />}
                                </div>
                                {subtitleTracks.map((track, i) => (
                                    <div
                                        key={i}
                                        onClick={() => { setSelectedSubtitleTrack(track.index); setShowTrackSelector(false); }}
                                        style={{
                                            padding: '8px',
                                            cursor: 'pointer',
                                            background: selectedSubtitleTrack === track.index ? '#e50914' : 'transparent',
                                            borderRadius: '4px',
                                            display: 'flex', alignItems: 'center', gap: '8px'
                                        }}
                                    >
                                        <MessageSquare size={16} />
                                        {track.tags?.language || 'Unknown'} - {track.tags?.title || `Track ${i + 1}`}
                                        {selectedSubtitleTrack === track.index && <CheckCircle size={16} />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="video-container">
                        <video
                            ref={videoRef}
                            controls
                            autoPlay
                            onEnded={handleVideoEnded}
                            style={{ width: '100%', height: '100%' }}
                        />
                    </div>

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
                            zIndex: 20,
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        Next Episode <SkipForward size={20} />
                    </button>
                </div>
            ) : (
                <div className="app-container">
                    <div className="filter-bar" style={{ padding: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
                        <button className={`filter-btn ${filter === 'series' ? 'active' : ''}`} onClick={() => setFilter('series')}>Series</button>
                        <button className={`filter-btn ${filter === 'movies' ? 'active' : ''}`} onClick={() => setFilter('movies')}>Movies</button>
                    </div>

                    {/* LIBRARY VIEW */}
                    {view === 'library' && (
                        Object.keys(filteredGroups).length === 0 ? (
                            <div style={{ textAlign: 'center', marginTop: '3rem', color: 'white' }}>
                                <h3>NO MEDIA FOUND</h3>
                                <p>Filter: {filter}</p>
                                <p>Total Groups: {Object.keys(mediaGroups).length}</p>
                            </div>
                        ) : (
                            <div className="media-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', padding: '20px' }}>
                                {Object.entries(filteredGroups).map(([group, items]) => {
                                    const coverImage = items.find(i => i.image)?.image || null;
                                    return (
                                        <div
                                            key={group}
                                            className="media-card group-card"
                                            onClick={() => handleGroupClick(group)}
                                            style={{
                                                cursor: 'pointer',
                                                position: 'relative',
                                                aspectRatio: '2/3',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                transition: 'transform 0.2s',
                                                transform: 'scale(1)'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            {coverImage ? (
                                                <img
                                                    src={`/media/${coverImage}`}
                                                    alt={group}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', background: '#222', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                                                    <Film size={40} style={{ marginBottom: '10px' }} />
                                                </div>
                                            )}
                                            <div style={{
                                                position: 'absolute', bottom: 0, left: 0, width: '100%',
                                                background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
                                                padding: '20px 10px 10px',
                                            }}>
                                                <h3 style={{ margin: 0, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group}</h3>
                                                <span style={{ fontSize: '0.8rem', color: '#aaa' }}>{items.length} items</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}

                    {/* DETAILS VIEW */}
                    {view === 'details' && selectedGroup && (
                        <div className="details-view" style={{ padding: '20px' }}>
                            <div className="details-header" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <button
                                    onClick={handleBackToLibrary}
                                    style={{
                                        background: 'transparent', border: 'none', color: 'white',
                                        display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '1rem'
                                    }}
                                >
                                    <ArrowLeft size={24} /> Back
                                </button>
                                <h1 style={{ margin: 0 }}>{selectedGroup}</h1>
                            </div>

                            <div className="episodes-container">
                                {(() => {
                                    const items = mediaGroups[selectedGroup] || [];

                                    // Group items by sub-folder
                                    const subGroups = items.reduce((acc, item) => {
                                        const parts = item.id.split('/');
                                        let subGroupName = 'General';
                                        if (parts.length > 3) subGroupName = parts[2];
                                        if (!acc[subGroupName]) acc[subGroupName] = [];
                                        acc[subGroupName].push(item);
                                        return acc;
                                    }, {});

                                    const sortedSubGroups = Object.keys(subGroups).sort();
                                    const hasMultipleSeasons = sortedSubGroups.length > 1 || (sortedSubGroups.length === 1 && sortedSubGroups[0] !== 'General');

                                    // RENDER LOGIC:
                                    // 1. If only "General", show episodes directly.
                                    // 2. If multiple seasons AND no sub-group selected, show SEASON GRID.
                                    // 3. If sub-group selected, show EPISODES for that sub-group.

                                    if (!hasMultipleSeasons) {
                                        // Case 1: Simple list
                                        return (
                                            <div className="episodes-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                                                {items.map(item => (
                                                    <div key={item.id} className="episode-item" onClick={() => handlePlay(item)} style={{ display: 'flex', gap: '10px', background: '#222', padding: '10px', borderRadius: '4px', cursor: 'pointer', alignItems: 'center' }}>
                                                        <div className="episode-thumbnail" style={{ width: '120px', height: '68px', flexShrink: 0, position: 'relative' }}>
                                                            <VideoPreview item={item} isWatched={watched[item.id]} />
                                                        </div>
                                                        <div className="episode-info" style={{ flex: 1, overflow: 'hidden' }}>
                                                            <h4 style={{ margin: '0 0 5px 0', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h4>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                {watched[item.id] && <span style={{ fontSize: '0.8rem', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> Watched</span>}
                                                            </div>
                                                        </div>
                                                        <button onClick={(e) => { e.stopPropagation(); updateWatchedStatus(item.id, !watched[item.id]); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px' }}>
                                                            <CheckCircle size={20} color={watched[item.id] ? "#4caf50" : "#444"} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }

                                    if (!selectedSubGroup) {
                                        // Case 2: Season Grid
                                        return (
                                            <div className="season-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                                                {sortedSubGroups.map(subGroup => {
                                                    // Find a cover image for this season (first item with image)
                                                    const seasonItems = subGroups[subGroup];
                                                    const coverImage = seasonItems.find(i => i.image)?.image || items.find(i => i.image)?.image || null;

                                                    return (
                                                        <div
                                                            key={subGroup}
                                                            className="season-card"
                                                            onClick={() => setSelectedSubGroup(subGroup)}
                                                            style={{ cursor: 'pointer', position: 'relative', aspectRatio: '2/3', borderRadius: '8px', overflow: 'hidden', transition: 'transform 0.2s', background: '#222' }}
                                                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                        >
                                                            {coverImage ? (
                                                                <img src={`/media/${coverImage}`} alt={subGroup} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                                                                    <Film size={40} style={{ marginBottom: '10px' }} />
                                                                </div>
                                                            )}
                                                            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', padding: '20px 10px 10px' }}>
                                                                <h3 style={{ margin: 0, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subGroup}</h3>
                                                                <span style={{ fontSize: '0.8rem', color: '#aaa' }}>{seasonItems.length} episodes</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    }

                                    // Case 3: Episodes for Selected Sub-Group
                                    return (
                                        <div>
                                            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#aaa', fontSize: '1.2rem' }}>{selectedSubGroup}</h2>
                                            <div className="episodes-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                                                {subGroups[selectedSubGroup].map(item => (
                                                    <div key={item.id} className="episode-item" onClick={() => handlePlay(item)} style={{ display: 'flex', gap: '10px', background: '#222', padding: '10px', borderRadius: '4px', cursor: 'pointer', alignItems: 'center' }}>
                                                        <div className="episode-thumbnail" style={{ width: '120px', height: '68px', flexShrink: 0, position: 'relative' }}>
                                                            <VideoPreview item={item} isWatched={watched[item.id]} />
                                                        </div>
                                                        <div className="episode-info" style={{ flex: 1, overflow: 'hidden' }}>
                                                            <h4 style={{ margin: '0 0 5px 0', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h4>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                {watched[item.id] && <span style={{ fontSize: '0.8rem', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> Watched</span>}
                                                            </div>
                                                        </div>
                                                        <button onClick={(e) => { e.stopPropagation(); updateWatchedStatus(item.id, !watched[item.id]); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px' }}>
                                                            <CheckCircle size={20} color={watched[item.id] ? "#4caf50" : "#444"} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default App;
