const { getMediaList } = require('./server/scanner');
const path = require('path');

console.log("Testing scanner...");
try {
    const list = getMediaList();
    console.log("Media Groups found:", Object.keys(list));
    console.log("Sample Group:", Object.keys(list)[0], list[Object.keys(list)[0]] ? list[Object.keys(list)[0]][0] : 'Empty');
} catch (e) {
    console.error("Error scanning:", e);
}
