const { getAllSubmissions } = require("../services/submission.service");
const { decryptPayload, encryptResponse, signResponse } = require("../utils/crypto.util");
const { saveSubmission } = require("../services/submission.service");
const { privateKey } = require("../config");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
// GET /submissions
function getSubmissions(req, res) {
    try {
        const submissions = getAllSubmissions();
        res.json(submissions);
    } catch (err) {
        console.error("❌ Error fetching submissions:", err.message);
        res.status(500).json({ error: "Failed to fetch submissions" });
    }
}
function handleKycSubmission(req, res) {
    try {
        const body = req.body;
        console.log("📨 Incoming webhook:", JSON.stringify(body, null, 2));

        // 1️⃣ Health Check / Flow Submission
        if (body.encrypted_flow_data) {
            const decrypted = decryptPayload(body);
            console.log("✅ Decrypted Flow Submission:", decrypted);

            if (decrypted) {
                saveSubmission("unknown_user", decrypted); // or use phone from context
            }

            // Decrypt AES key to encrypt response
            const aesKey = crypto.privateDecrypt(
                {
                    key: privateKey,
                    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                    oaepHash: "sha256"
                },
                Buffer.from(body.encrypted_aes_key, "base64")
            );

            const initialVector = Buffer.from(body.initial_vector, "base64");

            // ✅ Respond with Meta expected JSON
            const encryptedResponse = encryptResponse(
                JSON.stringify({ data: { status: "active" } }),
                aesKey,
                initialVector
            );

            // 🔑 Sign response (required by Meta)
            const signature = signResponse(encryptedResponse);

            res.set("X-WhatsApp-Signature", signature);
            res.type("text/plain");
            console.log("🔐 Encrypted response:", encryptedResponse);

            return res.send(encryptedResponse);
        }

        // 2️⃣ Regular KYC Submission Handling
        console.log("📥 KYC Submission received:", JSON.stringify(body, null, 2));

        if (body.entry) {
            body.entry.forEach(entry => {
                entry.changes.forEach(change => {
                    // Case 1: Flow completion event (FINAL submission)
                    if (change.value && change.value.statuses) {
                        change.value.statuses.forEach(status => {
                            if (status.event === "flow_completion") {
                                console.log("✅ Flow completed for:", status.id);

                                // Extract JSON
                                const kycData = status.flow_response_json;
                                console.log("📄 KYC Data JSON:", kycData);

                                // Save to file (or DB)
                                const filePath = path.join(__dirname, "kyc_submissions.json");
                                fs.appendFileSync(filePath, JSON.stringify(kycData, null, 2) + "\n");
                            }
                        });
                    }

                    // Case 2: Optional mid-step responses
                    if (change.value && change.value.messages) {
                        const msg = change.value.messages[0];
                        if (msg.type === "interactive" && msg.interactive.type === "flow") {
                            console.log("📥 Mid-step interactive data:", msg.interactive.response_json);
                        }
                    }
                });
            });
        }

        return res.sendStatus(200);
    } catch (err) {
        console.error("❌ handleKycSubmission error:", err);
        res.sendStatus(500);
    }
}

// External API endpoints
const TOKEN_URL = "https://uat-eroc.emahapwd.com/api/generate-token";
const STATUS_URL = "https://uat-eroc.emahapwd.com/api/get-application-status";

// Credentials (keep in env variables in production!)
const CLIENT_ID = "df01cb12-99f2-4d4a-b4e2-314eec7dbd61";
const SECRET_KEY = "Yx1#Fp7@Vz9!Lm^Tc6Wq*Dr8Oo%Kb!g";

async function fetchApplicationStatus(appId) {
    try {
        // Step 1: Generate token
        const tokenResp = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                clientID: CLIENT_ID,
                secretKey: SECRET_KEY
            })
        });

        const tokenData = await tokenResp.json();
        const token = tokenData?.token || tokenData; // adjust depending on API
        console.log("🔑 Token generated:", token);

        if (!token) throw new Error("Failed to fetch token");

        // Step 2: Get application status
        const statusResp = await fetch(STATUS_URL, {
            method: "POST",
            headers: {
                "Authorization": token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ appId })
        });

        const statusData = await statusResp.json();
        console.log("📄 Application status response:", statusData);

        return statusData;
    } catch (err) {
        console.error("❌ fetchApplicationStatus error:", err);
        return { error: "Failed to fetch status" };
    }
}

async function checkApplicationStatus(req, res) {
    try {
        const body = req.body;
        console.log("📨 Incoming Check Status webhook:", JSON.stringify(body, null, 2));

        // 1️⃣ Health Check / Flow Submission
        if (body.encrypted_flow_data) {
            const decrypted = decryptPayload(body);
            console.log("✅ Decrypted Flow Submission:", decrypted);

            const referenceNumber = decrypted?.reference_number; // from flow input
            let statusData = { status: "not found" };

            if (referenceNumber) {
                // Call external PHP API
                statusData = await fetchApplicationStatus(referenceNumber);
            }

            // Decrypt AES key
            const aesKey = crypto.privateDecrypt(
                {
                    key: privateKey,
                    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                    oaepHash: "sha256"
                },
                Buffer.from(body.encrypted_aes_key, "base64")
            );

            const initialVector = Buffer.from(body.initial_vector, "base64");

            // ✅ Encrypt the response to WhatsApp
            const encryptedResponse = encryptResponse(
                JSON.stringify({ data: statusData }),
                aesKey,
                initialVector
            );

            const signature = signResponse(encryptedResponse);

            res.set("X-WhatsApp-Signature", signature);
            res.type("text/plain");
            console.log("🔐 Encrypted response:", encryptedResponse);

            return res.send(encryptedResponse);
        }

        return res.sendStatus(200);
    } catch (err) {
        console.error("❌ checkApplicationStatus error:", err);
        res.sendStatus(500);
    }
}
module.exports = { getSubmissions, handleKycSubmission, checkApplicationStatus, fetchApplicationStatus };
