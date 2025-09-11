// # Starts the server
const app = require("./app");
const { PORT, FILES } = require("./config");
const { initializeJsonFile } = require("./utils/file.util");

initializeJsonFile(FILES.submissions);
initializeJsonFile(FILES.processedMessages);

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
