const path = require("path");
const { readJson, writeJson } = require("../utils/file.util");

const SUBMISSIONS_FILE = path.join(__dirname, "../../data/submissions.json");

// ✅ Save a new submission
function saveSubmission(user, formData) {
    try {
        let submissions = readJson(SUBMISSIONS_FILE);

        // Always fallback to array
        if (!Array.isArray(submissions)) {
            submissions = [];
        }

        submissions.push({
            user,
            formData,
            timestamp: new Date().toISOString(),
        });

        writeJson(SUBMISSIONS_FILE, submissions);
        console.log("💾 Submission saved for user:", user);
    } catch (error) {
        console.error("❌ Error saving submission:", error);
    }
}

// ✅ Fetch all submissions
function getAllSubmissions() {
    try {
        const submissions = readJson(SUBMISSIONS_FILE);
        return Array.isArray(submissions) ? submissions : [];
    } catch (error) {
        console.error("❌ Error reading submissions:", error);
        return [];
    }
}

module.exports = { saveSubmission, getAllSubmissions };
