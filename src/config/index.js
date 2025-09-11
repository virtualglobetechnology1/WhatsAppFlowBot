// # Exports env variables, constants

const fs = require("fs");
const path = require("path");
require("dotenv").config();

const keysPath = path.join(__dirname, "keys");
const privateKey = fs.readFileSync(path.join(keysPath, "private_key.pem"), "utf8");
const publicKey = fs.readFileSync(path.join(keysPath, "public_key.pem"), "utf8");

module.exports = {
    PORT: process.env.PORT || 3000,
    TOKEN: process.env.TOKEN || "EAAUyalZBUsakBPfEpa6oiQ6cnLpvvaxpgZB2NZCq26J2Vmh7Hx9U0E8j8ydzz4innOuZAjJjZB1J0A2N5dwY2cN4LUsCGF6Krtb7jezKe2f7xNOG5ajl5MMPYREMpVrXQHxZCBPhifvNeVKC23M6yazP72Wv0HOwnK2YKU04GWGx6sKThZChuQOZAlv9Y0LmuM25kXUtaqWkJEmy5bzZAvzBnscXzcZCMkk6hyr2Tjfhz4nAYZD",
    PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID || "772137989315128",
    VERIFY_TOKEN: process.env.VERIFY_TOKEN || "my_secret_token",
    APPOINTMENT_FLOW_ID: process.env.APPOINTMENT_FLOW_ID || "1209029364594686",
    KYC_FLOW_ID: process.env.KYC_FLOW_ID || "1209029364594686",
    CHECK_STATUS_FLOW_ID: process.env.CHECK_STATUS_FLOW_ID || "1144368914259813",
    FLOW_NAME: process.env.FLOW_NAME || "EROC KYC FORM",
    privateKey,
    publicKey,
    FILES: {
        submissions: path.join(__dirname, "../data/submissions.json"),
        processedMessages: path.join(__dirname, "../data/processed_messages.json"),
    },
};
