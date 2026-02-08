import React from 'react';
import { Film } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const MediaCard = ({ group, items }) => {
    const coverImage = items.find(i => i.image)?.image || null;

    return (
        <motion.div
            whileHover={{ scale: 1.05, zIndex: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
            <Link
                to={`/details/${encodeURIComponent(group)}`}
                className="media-card group-card"
                style={{
                    cursor: 'pointer',
                    position: 'relative',
                    aspectRatio: '2/3',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    display: 'block',
                    textDecoration: 'none',
                    color: 'inherit',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    background: '#1a1a1a'
                }}
            >
                {coverImage ? (
                    <img
                        src={`/media/${coverImage}`}
                        alt={group}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
                        <Film size={48} style={{ marginBottom: '10px' }} />
                        <span style={{ fontSize: '0.8rem', textAlign: 'center', padding: '0 10px' }}>{group}</span>
                    </div>
                )}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, width: '100%',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.95))',
                    padding: '20px 12px 12px',
                }}>
                    <h3 style={{
                        margin: 0,
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>{group}</h3>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '4px'
                    }}>
                        <span style={{ fontSize: '0.75rem', color: '#aaa' }}>{items.length} ítems</span>
                        {/* Optional: Add badge if new or something */}
                    </div>
                </div>
            </Link>
        </motion.div>
    );
};

export default MediaCard;
