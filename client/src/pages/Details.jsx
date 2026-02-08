import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMedia } from '../context/MediaContext';
import { ArrowLeft, Film, CheckCircle } from 'lucide-react';
import VideoPreview from '../components/VideoPreview';
import { motion, AnimatePresence } from 'framer-motion';

const Details = () => {
    const { group } = useParams();
    const navigate = useNavigate();
    const { mediaGroups, watched, updateWatchedStatus } = useMedia();
    const [selectedSubGroup, setSelectedSubGroup] = useState(null);

    const groupName = decodeURIComponent(group);

    if (!mediaGroups || Object.keys(mediaGroups).length === 0) {
        return <div style={{ color: 'white', padding: '100px 3rem' }}>Cargando...</div>;
    }

    const items = mediaGroups[groupName];

    if (!items) {
        return <div style={{ color: 'white', padding: '100px 3rem' }}>Grupo no encontrado</div>;
    }

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

    const handlePlay = (item) => {
        navigate(`/watch/${encodeURIComponent(item.id)}`);
    };

    const handleBack = () => {
        if (selectedSubGroup) {
            setSelectedSubGroup(null);
        } else {
            navigate('/');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="details-view"
            style={{ padding: '100px 3rem 3rem' }}
        >
            <div className="details-header" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <button
                    onClick={handleBack}
                    className="back-button"
                    style={{ position: 'static' }}
                >
                    <ArrowLeft size={20} /> Volver
                </button>
                <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '800' }}>{groupName}</h1>
            </div>

            <div className="episodes-container">
                <AnimatePresence mode="wait">
                    {(!hasMultipleSeasons) ? (
                        <motion.div
                            key="simple-list"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="episodes-list"
                            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}
                        >
                            {items.map((item, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    key={item.id}
                                    className="episode-item"
                                    onClick={() => handlePlay(item)}
                                    style={{
                                        display: 'flex',
                                        gap: '1rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        alignItems: 'center',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                >
                                    <div className="episode-thumbnail" style={{ width: '140px', height: '80px', flexShrink: 0, position: 'relative', borderRadius: '4px', overflow: 'hidden' }}>
                                        <VideoPreview item={item} isWatched={watched[item.id]} />
                                    </div>
                                    <div className="episode-info" style={{ flex: 1, overflow: 'hidden' }}>
                                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h4>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            {watched[item.id] && <span style={{ fontSize: '0.8rem', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14} /> Visto</span>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); updateWatchedStatus(item.id, !watched[item.id]); }}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: watched[item.id] ? "#4caf50" : "#444" }}
                                    >
                                        <CheckCircle size={24} />
                                    </button>
                                </motion.div>
                            ))}
                        </motion.div>
                    ) : (
                        !selectedSubGroup ? (
                            <motion.div
                                key="season-grid"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="season-grid"
                                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '2rem' }}
                            >
                                {sortedSubGroups.map(subGroup => {
                                    const seasonItems = subGroups[subGroup];
                                    const coverImage = seasonItems.find(i => i.image)?.image || items.find(i => i.image)?.image || null;

                                    return (
                                        <motion.div
                                            key={subGroup}
                                            whileHover={{ scale: 1.05 }}
                                            onClick={() => setSelectedSubGroup(subGroup)}
                                            style={{ cursor: 'pointer', position: 'relative', aspectRatio: '2/3', borderRadius: '12px', overflow: 'hidden', background: '#1a1a1a' }}
                                        >
                                            {coverImage ? (
                                                <img src={`/media/${coverImage}`} alt={subGroup} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
                                                    <Film size={48} style={{ marginBottom: '10px' }} />
                                                </div>
                                            )}
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'linear-gradient(transparent, rgba(0,0,0,0.95))', padding: '30px 15px 15px' }}>
                                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>{subGroup}</h3>
                                                <span style={{ fontSize: '0.85rem', color: '#aaa' }}>{seasonItems.length} episodios</span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        ) : (
                            <motion.div
                                key={`episodes-${selectedSubGroup}`}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <h2 style={{ marginTop: 0, marginBottom: '2rem', color: 'var(--text-secondary)', fontSize: '1.5rem', fontWeight: '700' }}>{selectedSubGroup}</h2>
                                <div className="episodes-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                                    {subGroups[selectedSubGroup].map((item, idx) => (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            key={item.id}
                                            className="episode-item"
                                            onClick={() => handlePlay(item)}
                                            style={{
                                                display: 'flex',
                                                gap: '1rem',
                                                background: 'rgba(255,255,255,0.05)',
                                                padding: '12px',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                alignItems: 'center',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                        >
                                            <div className="episode-thumbnail" style={{ width: '140px', height: '80px', flexShrink: 0, position: 'relative', borderRadius: '4px', overflow: 'hidden' }}>
                                                <VideoPreview item={item} isWatched={watched[item.id]} />
                                            </div>
                                            <div className="episode-info" style={{ flex: 1, overflow: 'hidden' }}>
                                                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h4>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    {watched[item.id] && <span style={{ fontSize: '0.8rem', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14} /> Visto</span>}
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); updateWatchedStatus(item.id, !watched[item.id]); }}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: watched[item.id] ? "#4caf50" : "#444" }}
                                            >
                                                <CheckCircle size={24} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        )
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default Details;
