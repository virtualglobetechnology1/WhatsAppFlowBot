const crypto = require("crypto");
const { VERIFY_TOKEN, privateKey } = require("../config");
const { isMessageProcessed, markMessageAsProcessed } = require("../services/dedup.service");
const { sendServicesMenu, sendServiceNextMenu, sendText, sendKycFlow, sendCheckStatusFlow } = require("../services/whatsapp.service");
const { saveSubmission } = require("../services/submission.service");
const { decryptPayload } = require("../utils/crypto.util");
const { fetchApplicationStatus } = require("../controllers/submission.controller");


const userServiceMap = {};

function setUserService(user, serviceId) {
    userServiceMap[user] = serviceId;
}

function getUserService(user) {
    return userServiceMap[user];
}
// Helper: encrypt response for Meta Flow health check
function encryptResponse(data, aesKey, initialVector) {
    try {
        // Invert IV bytes for Meta response (XOR with 0xFF)
        const responseIv = Buffer.alloc(initialVector.length);
        for (let i = 0; i < initialVector.length; i++) {
            responseIv[i] = initialVector[i] ^ 0xFF;
        }

        const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, responseIv);

        // Encrypt the data
        let encrypted = cipher.update(data, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        // Get authentication tag
        const authTag = cipher.getAuthTag();

        // Combine encrypted data + auth tag
        const combined = Buffer.concat([encrypted, authTag]);

        return combined.toString('base64');

    } catch (error) {
        console.error("❌ Encryption error:", error);
        throw error;
    }
}

function signResponse(data) {
    // This should create a signature of the response body
    // using your private key or secret
    const hmac = crypto.createHmac('sha256', privateKey);
    hmac.update(data);
    return hmac.digest('base64');
}

exports.verifyWebhook = (req, res) => {
    console.log("🔍 Verifying webhook...");
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
};

exports.handleWebhook = async (req, res) => {
    try {
        const body = req.body;
        console.log("📨 Incoming webhook:", JSON.stringify(body, null, 2));

        // 1️⃣ Flow submission or Health Check
        if (body.encrypted_flow_data) {
            const decrypted = decryptPayload(body);
            saveSubmission("unknown_user", decrypted);

            // decrypt AES key again to encrypt response
            const aesKey = crypto.privateDecrypt(
                {
                    key: privateKey,
                    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                    oaepHash: "sha256"
                },
                Buffer.from(body.encrypted_aes_key, "base64")
            );

            const initialVector = Buffer.from(req.body.initial_vector, "base64");
            const encryptedResponse = encryptResponse(
                JSON.stringify({ data: { status: "active" } }), // Meta expects JSON
                aesKey,
                initialVector
            );

            const signature = signResponse(encryptedResponse);
            res.set("X-Signature", signature);
            res.set("Content-Type", "application/json");
            console.log("🔐 Encrypted response:", encryptedResponse);


            console.log("✅ Flow submission or Health Check processed.0", encryptResponse);
            // ✅ Correct JSON structure for Meta health check
            res.set("X-WhatsApp-Signature", signature);
            return res.type("text/plain").send(encryptedResponse);

        }


        const messages = req.body.entry?.[0]?.changes?.[0]?.value?.messages;
        if (!messages) return res.sendStatus(200);

        const message = messages[0];
        const from = message.from;
        const messageId = message.id;

        if (isMessageProcessed(messageId)) return res.sendStatus(200);

        if (message.text?.body) {
            const text = message.text.body.toLowerCase().trim();
            if (["hi", "hello"].includes(text)) {
                console.log(`👋 Greeting received from ${from}`);
                await sendServicesMenu(from);
                markMessageAsProcessed(messageId);
            }
        } else if (message.interactive?.type === "list_reply") {
            await sendServiceNextMenu(from, message.interactive.list_reply.title);
            markMessageAsProcessed(messageId);
        }
        else if (message.interactive?.type === "button_reply") {
            const buttonId = message.interactive.button_reply.id;

            if (buttonId === "fill_kyc") {
                // Trigger the KYC flow
                await sendKycFlow(from);
            } else if (buttonId === "check_status") {
                await sendCheckStatusFlow(from);
                // await sendText(from, "📌 Please provide your reference number to check status.");
            }

            markMessageAsProcessed(messageId);
        }
        else if (message.interactive?.type === "nfm_reply") {

            let responseData;
            try {
                responseData = JSON.parse(message.interactive?.nfm_reply?.response_json || "{}");
            } catch (e) {
                console.error("❌ Failed to parse response_json:", e);
                responseData = {};
            }

            console.log("📥 Flow reply JSON:", responseData);

            if (responseData.basic_details) {
                console.log("📝 Basic Details:", responseData.basic_details);
            }
            if (responseData.auth_details) {
                console.log("🔑 Auth Details:", responseData.auth_details);
            }
            // Case 1: Check Status Flow
            if (responseData?.reference_number) {
                const statusData = await fetchApplicationStatus(responseData.reference_number);

                let message = `📌 Status for Application ID *${responseData.reference_number}*:\n\n`;

                if (statusData.status) {
                    message += `${statusData.status}\n\n`;
                }
                if (statusData.certificateDownloadUrl) {
                    message += `🔗 Download Certificate: ${statusData.certificateDownloadUrl}`;
                }

                await sendText(from, message);
            }
            // Case 2: KYC Flow
            else {
                saveSubmission(from, responseData);
                await sendText(from, "✅ Thank you! Your KYC request has been received. Email Send! Please check your email id for Activation process!");
            }
            markMessageAsProcessed(messageId);
        } else {
            markMessageAsProcessed(messageId);
        }
        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Webhook error:", err);
        res.sendStatus(200);
    }
};
