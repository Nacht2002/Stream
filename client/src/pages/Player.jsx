import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import {
    ArrowLeft, Settings, Music, MessageSquare, CheckCircle,
    SkipForward, Play, Pause, Volume2, VolumeX, Maximize,
    ChevronRight, ChevronLeft
} from 'lucide-react';
import { useMedia } from '../context/MediaContext';
import { motion, AnimatePresence } from 'framer-motion';

const Player = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { mediaGroups, watched, updateWatchedStatus } = useMedia();
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const containerRef = useRef(null);

    const videoId = decodeURIComponent(id);

    let selectedVideo = null;
    let groupItems = [];

    if (mediaGroups) {
        Object.values(mediaGroups).forEach(items => {
            const found = items.find(i => i.id === videoId);
            if (found) {
                selectedVideo = found;
                groupItems = items;
            }
        });
    }

    // State for controls
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isFullScreen, setIsFullScreen] = useState(false);

    // Tracks
    const [audioTracks, setAudioTracks] = useState([]);
    const [subtitleTracks, setSubtitleTracks] = useState([]);
    const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
    const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(null);
    const [showTrackSelector, setShowTrackSelector] = useState(false);

    // Metadata & Initial Setup
    useEffect(() => {
        if (selectedVideo) {
            setAudioTracks([]);
            setSubtitleTracks([]);

            // Mark as recently watched (started) if not already marked
            if (!watched[selectedVideo.id]) {
                updateWatchedStatus(selectedVideo.id, true);
            }

            fetch(`/api/metadata?id=${encodeURIComponent(selectedVideo.id)}`)
                .then(res => res.json())
                .then(data => {
                    setAudioTracks(data.audio || []);
                    setSubtitleTracks(data.subtitles || []);
                })
                .catch(err => console.error("Failed to fetch metadata", err));
        }
    }, [selectedVideo]);

    const saveProgress = () => {
        if (videoRef.current && videoRef.current.currentTime > 0 && selectedVideo) {
            updateWatchedStatus(selectedVideo.id, undefined, videoRef.current.currentTime);
        }
    };

    // HLS & Streaming Setup
    useEffect(() => {
        if (selectedVideo && videoRef.current) {
            const video = videoRef.current;

            // Resume progress logic
            const savedProgress = watched[selectedVideo.id]?.currentTime || 0;
            const wasPlaying = true;

            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }

            let url = `/api/stream?id=${encodeURIComponent(selectedVideo.id)}`;
            if (selectedAudioTrack !== null) url += `&audioStream=${selectedAudioTrack}`;
            if (selectedSubtitleTrack !== null) url += `&subtitleStream=${selectedSubtitleTrack}`;

            fetch(url)
                .then(res => res.json())
                .then(data => {
                    video.preload = "auto";
                    if (data.type === 'hls') {
                        if (Hls.isSupported()) {
                            const hls = new Hls({
                                enableWorker: true,
                                lowLatencyMode: true,
                                // Increase buffer to start loading immediately
                                startLevel: -1,
                                fragLoadingMaxRetry: 5
                            });
                            hlsRef.current = hls;
                            hls.loadSource(data.url);
                            hls.attachMedia(video);
                            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                                if (savedProgress > 5) video.currentTime = savedProgress - 2;

                                const playPromise = video.play();
                                if (playPromise !== undefined) {
                                    playPromise.catch(e => {
                                        console.warn("Autoplay block, trying muted...", e);
                                        video.muted = true;
                                        setIsMuted(true);
                                        video.play().catch(e => console.error("Final autoplay failure:", e));
                                    });
                                }
                            });
                        }
                    } else {
                        video.src = data.url;
                        video.load(); // Explicitly start loading
                        if (savedProgress > 5) video.currentTime = savedProgress - 2;

                        const playPromise = video.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(e => {
                                console.warn("Autoplay block, trying muted...", e);
                                video.muted = true;
                                setIsMuted(true);
                                video.play().catch(e => console.error("Final autoplay failure:", e));
                            });
                        }
                    }
                })
                .catch(err => console.error("Stream error", err));
        }
    }, [selectedVideo, selectedAudioTrack, selectedSubtitleTrack]);

    // Save progress periodically and on unmount
    useEffect(() => {
        if (!selectedVideo) return;

        const interval = setInterval(() => {
            if (isPlaying) saveProgress();
        }, 5000); // More frequent: 5 seconds

        const handleUnload = () => saveProgress();
        window.addEventListener('beforeunload', handleUnload);

        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', handleUnload);
            saveProgress(); // Final save on component unmount
        };
    }, [selectedVideo, isPlaying]);

    // Handle idle mouse
    useEffect(() => {
        let timeout;
        const resetIdle = () => {
            setShowControls(true);
            clearTimeout(timeout);
            if (isPlaying) {
                timeout = setTimeout(() => setShowControls(false), 3000);
            }
        };

        window.addEventListener('mousemove', resetIdle);
        window.addEventListener('mousedown', resetIdle);
        window.addEventListener('keydown', resetIdle);

        return () => {
            window.removeEventListener('mousemove', resetIdle);
            window.removeEventListener('mousedown', resetIdle);
            window.removeEventListener('keydown', resetIdle);
        };
    }, [isPlaying]);

    const togglePlay = () => {
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    const handleTimeUpdate = () => {
        setCurrentTime(videoRef.current.currentTime);
        setDuration(videoRef.current.duration);
    };

    const handleSeek = (e) => {
        const time = (e.target.value / 100) * duration;
        videoRef.current.currentTime = time;
        setCurrentTime(time);
        // Instant sync on manual seek for better UX
        updateWatchedStatus(selectedVideo.id, undefined, time);
    };

    const toggleMute = () => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        videoRef.current.muted = newMuted;
    };

    const handleVolumeChange = (e) => {
        const vol = parseFloat(e.target.value);
        setVolume(vol);
        videoRef.current.volume = vol;
        setIsMuted(vol === 0);
    };

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen();
            setIsFullScreen(true);
        } else {
            document.exitFullscreen();
            setIsFullScreen(false);
        }
    };

    const formatTime = (seconds) => {
        if (isNaN(seconds)) return "0:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleNext = () => {
        if (!selectedVideo || !groupItems) return;
        updateWatchedStatus(selectedVideo.id, true, 0); // Clear progress for finished episode
        const idx = groupItems.findIndex(i => i.id === selectedVideo.id);
        if (idx !== -1 && idx < groupItems.length - 1) {
            navigate(`/watch/${encodeURIComponent(groupItems[idx + 1].id)}`);
            setShowTrackSelector(false);
        }
    };

    if (!selectedVideo) return <div style={{ background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando...</div>;

    return (
        <div ref={containerRef} className="player-overlay" style={{ cursor: showControls ? 'default' : 'none' }}>
            <video
                ref={videoRef}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => updateWatchedStatus(selectedVideo.id, true, 0)}
                onClick={togglePlay}
                autoPlay
                style={{ width: '100%', height: '100%', outline: 'none' }}
            />

            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.8) 100%)',
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px'
                        }}
                    >
                        {/* Top Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <button className="back-button" onClick={() => navigate('/')}>
                                <ArrowLeft size={20} />
                            </button>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>{selectedVideo.group}</div>
                                <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{selectedVideo.name}</div>
                            </div>
                            <div style={{ width: '40px' }}></div> {/* Spacer */}
                        </div>

                        {/* Middle: Big Buttons (optional fade) */}

                        {/* Bottom Bar Container */}
                        <div style={{ width: '100%' }}>
                            {/* Seek Bar */}
                            <div style={{ position: 'relative', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <span style={{ fontSize: '0.85rem', width: '45px', textAlign: 'right' }}>{formatTime(currentTime)}</span>
                                <div style={{ flex: 1, position: 'relative', height: '6px', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={(currentTime / duration) * 100 || 0}
                                        onChange={handleSeek}
                                        style={{
                                            width: '100%',
                                            cursor: 'pointer',
                                            accentColor: 'var(--accent)',
                                            height: '4px',
                                            WebkitAppearance: 'none',
                                            background: '#333',
                                            borderRadius: '2px'
                                        }}
                                    />
                                </div>
                                <span style={{ fontSize: '0.85rem', width: '45px' }}>{formatTime(duration)}</span>
                            </div>

                            {/* Controls Bar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                                    <button onClick={togglePlay} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                                        {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" />}
                                    </button>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button onClick={toggleMute} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                                            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                                        </button>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={volume}
                                            onChange={handleVolumeChange}
                                            style={{ width: '80px', accentColor: 'white', cursor: 'pointer' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <button onClick={handleNext} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                                        Siguiente <SkipForward size={24} />
                                    </button>

                                    <button onClick={() => setShowTrackSelector(!showTrackSelector)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                                        <Settings size={24} />
                                    </button>

                                    <button onClick={toggleFullScreen} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                                        <Maximize size={24} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Track Selector Modal */}
            <AnimatePresence>
                {showTrackSelector && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowTrackSelector(false)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }}
                        />
                        <motion.div
                            initial={{ x: 300 }}
                            animate={{ x: 0 }}
                            exit={{ x: 300 }}
                            style={{
                                position: 'absolute', top: 0, right: 0, bottom: 0, width: '350px',
                                background: '#111', zIndex: 101, padding: '40px 30px',
                                borderLeft: '1px solid #222', display: 'flex', flexDirection: 'column'
                            }}
                        >
                            <h2 style={{ marginBottom: '30px' }}>Configuración</h2>

                            <div style={{ marginBottom: '30px' }}>
                                <h4 style={{ color: '#666', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px', marginBottom: '15px' }}>Audio</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {audioTracks.length === 0 && <div style={{ opacity: 0.5 }}>Única pista disponible</div>}
                                    {audioTracks.map((track, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { setSelectedAudioTrack(track.index); setShowTrackSelector(false); }}
                                            style={{
                                                background: selectedAudioTrack === track.index ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                                                border: 'none', color: 'white', padding: '12px 15px', borderRadius: '8px',
                                                textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px'
                                            }}
                                        >
                                            <Music size={16} />
                                            <span>{track.tags?.language || 'Desconocido'} - {track.tags?.title || `Track ${i + 1}`}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 style={{ color: '#666', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px', marginBottom: '15px' }}>Subtítulos</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <button
                                        onClick={() => { setSelectedSubtitleTrack(null); setShowTrackSelector(false); }}
                                        style={{
                                            background: selectedSubtitleTrack === null ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                                            border: 'none', color: 'white', padding: '12px 15px', borderRadius: '8px',
                                            textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px'
                                        }}
                                    >
                                        <MessageSquare size={16} /> Ninguno
                                    </button>
                                    {subtitleTracks.map((track, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { setSelectedSubtitleTrack(track.index); setShowTrackSelector(false); }}
                                            style={{
                                                background: selectedSubtitleTrack === track.index ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                                                border: 'none', color: 'white', padding: '12px 15px', borderRadius: '8px',
                                                textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px'
                                            }}
                                        >
                                            <MessageSquare size={16} />
                                            <span>{track.tags?.language || 'Desconocido'} - {track.tags?.title || `Track ${i + 1}`}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Player;
