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

                // If it's in a subdirectory
                if (parts.length > 1) {
                    const rootFolder = parts[0].toLowerCase();
                    const isGenericCategory = ['series', 'peliculas', 'movies', 'animation', 'anime'].includes(rootFolder);

                    if (isGenericCategory && parts.length >= 3) {
                        // Category/ShowName/Episode.mp4 -> Group: ShowName
                        // Category/ShowName/Season/Episode.mp4 -> Group: ShowName
                        group = parts[1];
                    } else if (isGenericCategory && parts.length === 2) {
                        // Category/Movie.mp4 -> Group: Movie (strip extension)
                        group = path.basename(parts[1], ext);
                    } else if (parts.length >= 2) {
                        // Anyother/Folder/File.mp4 -> Group: Folder
                        group = parts[parts.length - 2];
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
