//  Express app entrypoint

const express = require("express");
const bodyParser = require("body-parser");

const webhookRoutes = require("./routes/webhook.routes");
const submissionRoutes = require("./routes/submission.routes");

const app = express();
app.use(bodyParser.json());

// Routes
app.use("/webhook", webhookRoutes);
app.use("/submissions", submissionRoutes);


module.exports = app;

