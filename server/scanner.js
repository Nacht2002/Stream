const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const MEDIA_ROOT = path.join(__dirname, '../media');

// Supported video extensions
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];

function scanDirectory(dir, fileList = []) {
    if (!fs.existsSync(dir)) {
        console.warn(`[Scanner] Directory not found: ${dir}`);
        return fileList;
    }

    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            scanDirectory(filePath, fileList);
        } else {
            const ext = path.extname(file).toLowerCase();
            if (VIDEO_EXTENSIONS.includes(ext)) {
                // Get relative path from MEDIA_ROOT for the ID/URL
                const relativePath = path.relative(MEDIA_ROOT, filePath);
                const parts = relativePath.split(path.sep);

                let group = 'Uncategorized';

                // If it's in a subdirectory
                if (parts.length > 1) {
                    // If it is in "Series" or "Peliculas" (or any root folder), we want the NEXT folder to be the group
                    // e.g. Series/MyShow/Season1/Ep1.mkv -> Group: MyShow
                    // e.g. Movies/MyMovie/Movie.mkv -> Group: MyMovie
                    // e.g. Series/MyShow/Ep1.mkv -> Group: MyShow

                    // The first part is usually the category (Series, Peliculas, etc.)
                    // The second part is the Show/Movie Name
                    if (parts.length >= 2) {
                        // Use the Category + Show Name as the unique key, but we might want just Show Name for display
                        // Let's use the folder name relative to root for uniqueness, e.g. "Series/MyShow"
                        // Or if we want to mix them, just "MyShow". 
                        // Let's stick to the immediate child of the root media folder as the "Group" if possible, 
                        // OR if it's deeper, the child of the category.

                        // Check if the root folder is a generic category
                        const rootFolder = parts[0].toLowerCase();
                        if ((rootFolder === 'series' || rootFolder === 'peliculas' || rootFolder === 'movies') && parts.length >= 2) {
                            // Group by the Show/Movie Name (2nd level)
                            group = parts[1];
                        } else {
                            // Otherwise just use the parent folder
                            group = parts[0];
                        }
                    } else {
                        group = parts[0];
                    }
                }

                fileList.push({
                    id: relativePath.replace(/\\/g, '/'), // Normalize slashes for URLs
                    name: file,
                    path: filePath,
                    group: group,
                    size: stat.size
                });
            }
        }
    });

    return fileList;
}

function getMediaList() {
    const rawList = scanDirectory(MEDIA_ROOT);

    // Group by folder
    const grouped = rawList.reduce((acc, item) => {
        if (!acc[item.group]) {
            acc[item.group] = [];
        }
        acc[item.group].push(item);
        return acc;
    }, {});

    // Sort each group naturally and look for images per directory
    Object.keys(grouped).forEach(group => {
        grouped[group].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        // Cache for directory -> image path to avoid repeated FS checks
        const dirImageCache = {};

        grouped[group].forEach(item => {
            const itemDir = path.dirname(item.path);

            // Check cache first
            if (dirImageCache[itemDir] !== undefined) {
                if (dirImageCache[itemDir]) item.image = dirImageCache[itemDir];
                return;
            }

            // Scan for image in this item's directory
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
            const imageNames = ['cover', 'poster', 'folder', 'image', 'default']; // Added default
            let foundImage = null;

            for (const name of imageNames) {
                for (const ext of imageExtensions) {
                    const imagePath = path.join(itemDir, name + ext);
                    if (fs.existsSync(imagePath)) {
                        foundImage = path.relative(MEDIA_ROOT, imagePath).replace(/\\/g, '/');
                        break;
                    }
                }
                if (foundImage) break;
            }

            // Store in cache and assign
            dirImageCache[itemDir] = foundImage;
            if (foundImage) item.image = foundImage;
        });
    });

    return grouped;
}

module.exports = { getMediaList, MEDIA_ROOT };
