import React from 'react';
import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HeroSection = ({ item }) => {
    const navigate = useNavigate();

    if (!item) return null;

    const handlePlay = () => {
        navigate(`/watch/${encodeURIComponent(item.id)}`);
    };

    return (
        <div className="hero-section" style={{
            height: '60vh',
            width: '100%',
            position: 'relative',
            background: `linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 60%), url(/media/${item.image}) center/cover no-repeat`,
            display: 'flex',
            alignItems: 'end',
            padding: '4rem 3rem',
            overflow: 'hidden',
            marginBottom: '2rem'
        }}>
            <div className="hero-content" style={{ zIndex: 1, maxWidth: '600px' }}>
                <h1 style={{ fontSize: '3.5rem', margin: '0 0 1rem 0', fontWeight: '800', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                    {item.group}
                </h1>
                <p style={{ fontSize: '1.1rem', color: '#ccc', marginBottom: '2rem', lineHeight: '1.5' }}>
                    Reproduce el contenido de {item.group} ahora mismo. Disfruta de la mejor calidad de streaming local.
                </p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={handlePlay}
                        style={{
                            background: '#e50914',
                            color: 'white',
                            border: 'none',
                            padding: '0.8rem 2rem',
                            borderRadius: '4px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#b20710'}
                        onMouseLeave={(e) => e.target.style.background = '#e50914'}
                    >
                        <Play fill='white' size={24} />Reproducir
                    </button>
                    <button
                        onClick={() => navigate(`/details/${encodeURIComponent(item.group)}`)}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            border: 'none',
                            padding: '0.8rem 2rem',
                            borderRadius: '4px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
                    >
                        Más información
                    </button>
                </div>
            </div>
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                height: '150px',
                background: 'linear-gradient(to top, var(--bg-color), transparent)'
            }}></div>
        </div>
    );
};

export default HeroSection;
