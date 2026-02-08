import React, { useState } from 'react';
import { Film } from 'lucide-react';

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
                (item.image || true) ? (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        <img
                            src={item.image ? `/media/${item.image}` : `/api/thumbnail?id=${encodeURIComponent(item.id)}`}
                            alt={item.name}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://images.unsplash.com/photo-1594908900066-3f47337549d8?q=80&w=400&auto=format&fit=crop`;
                            }}
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

export default VideoPreview;
