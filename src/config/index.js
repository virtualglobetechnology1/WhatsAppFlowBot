// # Exports env variables, constants

const fs = require("fs");
const path = require("path");
require("dotenv").config();

const keysPath = path.join(__dirname, "keys");
const privateKey = fs.readFileSync(path.join(keysPath, "private_key.pem"), "utf8");
const publicKey = fs.readFileSync(path.join(keysPath, "public_key.pem"), "utf8");

module.exports = {
    PORT: process.env.PORT || 3000,
    TOKEN: process.env.TOKEN || "EAAVQ6ZBAhzTkBPedMHC8ZCN7wsNAKb5YaYoZCdbvPERpTUMPasIbbmaE8UPDRWBpXau7LZAqya2sD73JvZCu4ZAxN48fZBPhqPqsxSnQGKNqkaZBBpCNaHnFY5KHxMIaDgBorKhZCbUW3NA40cErj5aTfr8Vp7xZCnRBLM7bgnRt8Xx9ZAwmEFwPYdGX8bFdECVhBN7inhDDtW5TUs4RVZAzzEx5y5VcUAWKpT1ZBJQppk7KZC",
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
