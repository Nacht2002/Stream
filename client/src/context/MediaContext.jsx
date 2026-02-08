import React, { createContext, useState, useEffect, useContext } from 'react';

const MediaContext = createContext();

export const useMedia = () => useContext(MediaContext);

export const MediaProvider = ({ children }) => {
    const [mediaGroups, setMediaGroups] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [watched, setWatched] = useState({});
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

    const updateWatchedStatus = (id, status, currentTime) => {
        const timestamp = Date.now();
        setWatched(prev => ({
            ...prev,
            [id]: {
                status: status !== undefined ? status : (prev[id]?.status || false),
                lastWatched: timestamp,
                currentTime: currentTime !== undefined ? currentTime : (prev[id]?.currentTime || 0)
            }
        }));

        console.log(`Updating watched status for ${id}: status=${status}, time=${currentTime}`);

        fetch('/api/watched', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status, currentTime })
        }).catch(err => console.error('Failed to sync watched status', err));
    };

    const [searchQuery, setSearchQuery] = useState('');

    return (
        <MediaContext.Provider value={{
            mediaGroups,
            loading,
            error,
            watched,
            loadingStatus,
            searchQuery,
            setSearchQuery,
            updateWatchedStatus
        }}>
            {children}
        </MediaContext.Provider>
    );
};
