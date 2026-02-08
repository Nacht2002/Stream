import React from 'react';
import { Search, X } from 'lucide-react';
import { useMedia } from '../context/MediaContext';
import { useLocation, useNavigate } from 'react-router-dom';

const SearchBar = () => {
    const { searchQuery, setSearchQuery } = useMedia();
    const location = useLocation();
    const navigate = useNavigate();

    const handleSearch = (e) => {
        setSearchQuery(e.target.value);
        // If we are not on the home page, maybe we should navigate there?
        // Or just let it filter in the background. 
        // For better UX, if user starts typing, we should probably be on Home.
        if (location.pathname !== '/' && e.target.value.length > 0) {
            navigate('/');
        }
    };

    return (
        <div className="search-container" style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '20px',
            padding: '4px 12px',
            width: '300px',
            transition: 'all 0.3s'
        }}>
            <Search size={18} color="#aaa" />
            <input
                type="text"
                placeholder="Buscar películas o series..."
                value={searchQuery}
                onChange={handleSearch}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    padding: '6px 10px',
                    fontSize: '0.9rem',
                    width: '100%',
                    outline: 'none'
                }}
            />
            {searchQuery && (
                <X
                    size={18}
                    color="#aaa"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSearchQuery('')}
                />
            )}
        </div>
    );
};

export default SearchBar;
