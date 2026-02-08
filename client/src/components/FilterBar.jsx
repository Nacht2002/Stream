import React from 'react';

const FilterBar = ({ filter, setFilter }) => {
    return (
        <div className="filter-bar" style={{ padding: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            <button className={`filter-btn ${filter === 'series' ? 'active' : ''}`} onClick={() => setFilter('series')}>Series</button>
            <button className={`filter-btn ${filter === 'movies' ? 'active' : ''}`} onClick={() => setFilter('movies')}>Movies</button>
        </div>
    );
};

export default FilterBar;
