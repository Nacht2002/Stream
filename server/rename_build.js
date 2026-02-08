const fs = require('fs');
const path = require('path');

const targetDir = 'g:\\StreamWeb\\Stream\\media\\Series\\KamenRiden\\Build';

if (!fs.existsSync(targetDir)) {
    console.error('Directory not found:', targetDir);
    process.exit(1);
}

const files = fs.readdirSync(targetDir);

files.forEach(file => {
    if (file === 'poster.webp') return;

    let number = null;

    // Pattern 1: BUILD_1.mp4
    const match1 = file.match(/BUILD_(\d+)/i);
    if (match1) {
        number = match1[1];
    } else {
        // Pattern 2: [Nekorider] KR Build 19.mp4
        const match2 = file.match(/Build\s+(\d+)/i);
        if (match2) {
            number = match2[1];
        }
    }

    if (number) {
        const ext = path.extname(file);
        const newName = `Kamen Rider Build ${number}${ext}`;

        // Skip if already named correctly
        if (file === newName) return;

        const oldPath = path.join(targetDir, file);
        const newPath = path.join(targetDir, newName);

        try {
            console.log(`Renaming: "${file}" -> "${newName}"`);
            fs.renameSync(oldPath, newPath);
        } catch (err) {
            console.error(`Failed to rename "${file}":`, err.message);
        }
    } else {
        console.warn(`Could not extract number from: "${file}"`);
    }
});

console.log('Renaming complete.');
