const { FILES } = require("../config");
const { readJson, writeJson } = require("../utils/file.util");

let processedMessages = new Set(readJson(FILES.processedMessages, []));
const dedupData = readJson("./data/dedup.json");
function isMessageProcessed(id) {
    return processedMessages.has(id);
}

function markMessageAsProcessed(id) {
    processedMessages.add(id);
    writeJson(FILES.processedMessages, Array.from(processedMessages));

    if (processedMessages.size % 100 === 0) {
        cleanupOldProcessedMessages();
    }
}

function cleanupOldProcessedMessages() {
    const messages = readJson(FILES.processedMessages, []);
    if (messages.length > 1000) {
        writeJson(FILES.processedMessages, messages.slice(-500));
        console.log("🧹 Cleaned up old processed messages");
    }
}

module.exports = { isMessageProcessed, markMessageAsProcessed };
