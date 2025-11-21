const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const MEDIA_ROOT = path.join(__dirname, '../media');

// Supported video extensions
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];

function scanDirectory(dir, fileList = []) {
    if (!fs.existsSync(dir)) {
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
                // Use the immediate parent folder as the "Group" or "Series" name
                // If it's directly in root, group is "Uncategorized" or the file name
                const parentDir = path.dirname(relativePath);
                const group = parentDir === '.' ? 'Movies' : parentDir;

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

    // Sort each group naturally and look for images
    Object.keys(grouped).forEach(group => {
        grouped[group].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        // Check for cover image in the group's folder
        // We take the path of the first item, get its directory, and look for common image names
        if (grouped[group].length > 0) {
            const firstItemPath = grouped[group][0].path;
            const groupDir = path.dirname(firstItemPath);
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
            const imageNames = ['cover', 'poster', 'folder', 'image'];

            let foundImage = null;

            // Try to find a matching image
            for (const name of imageNames) {
                for (const ext of imageExtensions) {
                    const imagePath = path.join(groupDir, name + ext);
                    if (fs.existsSync(imagePath)) {
                        // Create relative path for URL
                        foundImage = path.relative(MEDIA_ROOT, imagePath).replace(/\\/g, '/');
                        break;
                    }
                }
                if (foundImage) break;
            }

            // If found, assign to all items in the group (or we could send it as group metadata)
            if (foundImage) {
                grouped[group].forEach(item => item.image = foundImage);
            }
        }
    });

    return grouped;
}

module.exports = { getMediaList, MEDIA_ROOT };
