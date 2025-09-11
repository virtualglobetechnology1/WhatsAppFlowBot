const fs = require("fs");
const path = require("path");

// ✅ Ensure directory exists before using the file
function ensureDirExists(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📂 Created directory: ${dir}`);
    }
}

function initializeJsonFile(filePath, defaultValue = []) {
    ensureDirExists(filePath); // <-- important
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
        console.log(`📁 Created ${filePath}`);
    }
}

function readJson(filePath) {
    try {
        ensureDirExists(filePath); // <-- important
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ File not found: ${filePath}, creating new one.`);
            fs.writeFileSync(filePath, "[]", "utf8"); // default empty array
            return [];
        }

        const data = fs.readFileSync(filePath, "utf8").trim();

        if (!data) {
            console.warn(`⚠️ File empty: ${filePath}, using empty array.`);
            return [];
        }

        return JSON.parse(data);
    } catch (err) {
        console.error(`❌ Error reading file ${filePath}: ${err.message}`);
        return [];
    }
}

function writeJson(filePath, data) {
    try {
        ensureDirExists(filePath); // <-- important
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("❌ Error writing file:", err);
    }
}

module.exports = { initializeJsonFile, readJson, writeJson };
