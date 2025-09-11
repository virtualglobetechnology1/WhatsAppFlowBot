const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
// ✅ Use the new private key (PKCS#1 format)
const privateKey = fs.readFileSync("./private_key.pem", "utf8"); // Changed from private.pem
// ✅ Replace with your actual values
const TOKEN = "EAAUyalZBUsakBPb0voYWTvMAFmAiHzMswANZAoBU2sIZBa9PXjCCRuprYuVv2fROs654hmFeTTfAZAcKovZBGmPQCbIQLKCfHsEnxZAamva7GrvkSE1vZC4j0OI4YnMO3AqLx4ZA6AuO0TZC0ldBKyIMRmnOULc4ZBZAZBIQ6UamB1CFxovZBWLFzYibKzbCovIqQBJeesxQRf47r1vhojZAKGJv88R3gKwgw8364b5vcXraO2pwZDZD";
const PHONE_NUMBER_ID = "772137989315128";

// ✅ Published Flow values
const APPOINTMENT_FLOW_ID = "1455422395605577"; // Published Flow ID
const FLOW_NAME = "Appointment Form";           // Your published flow name

// ✅ File paths
const SUBMISSIONS_FILE = path.join(__dirname, "submissions.json");
const PROCESSED_MESSAGES_FILE = path.join(__dirname, "processed_messages.json");

app.use(bodyParser.json());

// ✅ Initialize JSON files if they don't exist
function initializeJsonFile(filePath, defaultValue = []) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
        console.log(`📁 Created ${path.basename(filePath)}`);
    }
}

initializeJsonFile(SUBMISSIONS_FILE);
initializeJsonFile(PROCESSED_MESSAGES_FILE);

// ✅ Load processed messages from JSON file
function loadProcessedMessages() {
    try {
        const data = fs.readFileSync(PROCESSED_MESSAGES_FILE, 'utf8');
        return new Set(JSON.parse(data));
    } catch (error) {
        console.error("❌ Error loading processed messages:", error);
        return new Set();
    }
}

// ✅ Save processed messages to JSON file
function saveProcessedMessages(messagesSet) {
    try {
        const messagesArray = Array.from(messagesSet);
        fs.writeFileSync(PROCESSED_MESSAGES_FILE, JSON.stringify(messagesArray, null, 2));
    } catch (error) {
        console.error("❌ Error saving processed messages:", error);
    }
}

// ✅ Clean up old processed messages (older than 24 hours)
function cleanupOldProcessedMessages() {
    try {
        const data = fs.readFileSync(PROCESSED_MESSAGES_FILE, 'utf8');
        const messagesArray = JSON.parse(data);

        // If you want to implement timestamp-based cleanup, you can store objects instead of just IDs
        // For now, we'll just limit the array size to prevent it from growing too large
        if (messagesArray.length > 1000) {
            const recentMessages = messagesArray.slice(-500); // Keep only last 500 messages
            fs.writeFileSync(PROCESSED_MESSAGES_FILE, JSON.stringify(recentMessages, null, 2));
            console.log("🧹 Cleaned up old processed messages");
        }
    } catch (error) {
        console.error("❌ Error cleaning up processed messages:", error);
    }
}

// Initialize processed messages
const processedMessages = loadProcessedMessages();

// ✅ Check if message is already processed
function isMessageProcessed(messageId) {
    return processedMessages.has(messageId);
}

// ✅ Mark message as processed
function markMessageAsProcessed(messageId) {
    processedMessages.add(messageId);
    saveProcessedMessages(processedMessages);

    // Clean up periodically (every 100 messages)
    if (processedMessages.size % 100 === 0) {
        cleanupOldProcessedMessages();
    }
}

// ✅ Webhook verification
app.get("/webhook", (req, res) => {
    const VERIFY_TOKEN = "my_secret_token"; // must match Meta Dashboard

    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// ✅ Handle incoming messages with proper error handling and deduplication
app.post("/webhook", async (req, res) => {
    try {
        let body = req.body;

        // Debug logging
        console.log("📨 Incoming webhook:", JSON.stringify(body, null, 2));

        if (body.object) {
            const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;

            if (messages && messages.length > 0) {
                const message = messages[0];
                const from = message.from;
                const messageId = message.id;

                // ✅ DEDUPLICATION: Check if message already processed
                if (isMessageProcessed(messageId)) {
                    console.log("⚠️  Duplicate message, skipping processing:", messageId);
                    res.sendStatus(200);
                    return;
                }

                // Case 1: User says "hi" or "hello" → show menu
                if (message.text?.body) {
                    const text = message.text.body.toLowerCase().trim();
                    if (text === "hi" || text === "hello") {
                        console.log("✅ Trigger matched:", text);
                        await sendServicesMenu(from);
                        // await sendAppointmentMenu(from);
                        markMessageAsProcessed(messageId);
                    }
                }

                else if (message.interactive?.type === "list_reply") {
                    const selectedId = message.interactive.list_reply.id;
                    const selectedTitle = message.interactive.list_reply.title;

                    console.log(`✅ User selected service: ${selectedTitle} (${selectedId})`);

                    // Save or log selected service (optional: persist in DB or JSON file)
                    await sendServiceNextMenu(from, selectedTitle);

                    markMessageAsProcessed(messageId);
                }

                // Case 3: User submits Flow (form submission)
                else if (message.interactive?.type === "nfm_reply") {
                    console.log("✅ Flow submission received:", JSON.stringify(message, null, 2));

                    const formData = message.interactive?.nfm_reply?.response_json;
                    saveSubmission(from, formData);
                    markMessageAsProcessed(messageId);
                    await sendText(from, "✅ Thank you! Your appointment request has been received.");
                }

                // Unknown message type
                else {
                    console.log("ℹ️  Unknown message type received");
                    markMessageAsProcessed(messageId); // Still mark as processed to prevent retries
                }

                res.sendStatus(200);
            } else {
                console.log("ℹ️  No messages in webhook");
                res.sendStatus(200);
            }
        } else {
            console.log("❌ Invalid webhook object");
            res.sendStatus(404);
        }
    } catch (error) {
        console.error("❌ Error in webhook processing:", error);
        res.sendStatus(200); // Always return 200 to prevent retries
    }
});



function decryptPayload(body) {
    try {
        console.log("🔐 Attempting to decrypt payload...");
        console.log("Encrypted AES Key (base64):", body.encrypted_aes_key);
        console.log("IV (base64):", body.initial_vector);

        // 1. Decrypt the AES key using RSA-OAEP with SHA-256
        const decryptedAesKey = crypto.privateDecrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            Buffer.from(body.encrypted_aes_key, "base64")
        );
        console.log("✅ AES key decrypted successfully.");
        console.log("Decrypted AES Key (hex):", decryptedAesKey.toString('hex'));

        // 2. Decrypt the flow data using AES-256-CBC
        const decipher = crypto.createDecipheriv(
            "aes-256-cbc",
            decryptedAesKey, // Use the decrypted key directly
            Buffer.from(body.initial_vector, "base64")
        );

        // 3. Handle the decryption
        let decrypted = decipher.update(Buffer.from(body.encrypted_flow_data, "base64"));
        decrypted = Buffer.concat([decrypted, decipher.final()]); // Finalize the decryption

        const decryptedString = decrypted.toString("utf8");
        console.log("✅ Flow data decrypted successfully.");
        console.log("Decrypted JSON:", decryptedString);

        return JSON.parse(decryptedString);

    } catch (err) {
        console.error("❌ Decryption failed at step:", err.message);
        // More detailed logging for common issues
        if (err.code === 'ERR_OSSL_RSA_OAEP_DECODING_ERROR') {
            console.error("This is almost always due to using the wrong private key.");
            console.error("1. Did you use the correct key generated with 'openssl genrsa'?");
            console.error("2. Did you upload the correct public_key.pem to Meta?");
            console.error("3. Did you restart your server after updating the key file?");
        }
        if (err.code === 'ERR_OSSL_BAD_DECRYPT') {
            console.error("AES decryption failed. Likely due to an incorrect key or IV.");
        }
        throw err; // Re-throw the error to be caught by the endpoint handler
    }
}

app.post("/flow/appointment", (req, res) => {
    try {
        console.log("Incoming body:", JSON.stringify(req.body, null, 2));
        // Case 1: Encrypted payload
        if (req.body.encrypted_flow_data && req.body.encrypted_aes_key && req.body.initial_vector) {
            const data = decryptPayload(req.body);
            console.log("✅ Decrypted flow data:", data);
            res.json({ status: "success" });
        }
        // Case 2: Plain JSON payload
        else {
            console.log("✅ Received plain flow data:", req.body);
            res.json({ status: "success" });
        }
    } catch (err) {
        console.error("❌ Flow processing failed:", err);
        res.status(400).json({ error: "Invalid payload" });
    }
});


// ✅ Save submission into a local JSON file
function saveSubmission(user, formData) {
    try {
        let submissions = [];

        if (fs.existsSync(SUBMISSIONS_FILE)) {
            const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf8');
            submissions = JSON.parse(data);
        }

        submissions.push({
            user,
            formData,
            timestamp: new Date().toISOString(),
        });

        fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));
        console.log("💾 Submission saved for user:", user);
    } catch (error) {
        console.error("❌ Error saving submission:", error);
    }
}

// ✅ Endpoint to fetch all submissions
app.get("/submissions", (req, res) => {
    try {
        if (fs.existsSync(SUBMISSIONS_FILE)) {
            const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error("❌ Error reading submissions:", error);
        res.status(500).json({ error: "Failed to read submissions" });
    }
});

// ✅ Send plain text
async function sendText(to, text) {
    try {
        const fetch = (await import("node-fetch")).default;

        const response = await fetch(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "text",
                text: { body: text },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("❌ Error sending text:", errorData);
        }
    } catch (err) {
        console.error("❌ Error in sendText:", err);
    }
}


// ✅ Show Services List
async function sendServicesMenu(to) {
    try {
        const fetch = (await import("node-fetch")).default;

        const response = await fetch(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "interactive",
                interactive: {
                    type: "list",
                    header: { type: "text", text: "📋 Available Services" },
                    body: { text: "Please select a service you want 👇" },
                    footer: { text: "Choose carefully from the list" },
                    action: {
                        button: "Select Service",
                        sections: [
                            {
                                title: "E-Permission",
                                rows: [
                                    { id: "service_8991", title: "E-Permission 8991", description: "NOC for channels (optical fibre, gas, water, etc.)" },
                                    { id: "service_8992", title: "E-Permission 8992", description: "NOC for digging roads for utilities" },
                                    { id: "service_8993", title: "E-Permission 8993", description: "NOC for approach road to petrol pump" },
                                    { id: "service_8994", title: "E-Permission 8994", description: "NOC for roadside building" }
                                ]
                            },
                            {
                                title: "E-ROC",
                                rows: [
                                    { id: "service_8996", title: "E-ROC 8996", description: "Contractor registration & renewal (class 4 & 4A)" },
                                    { id: "service_8997", title: "E-ROC 8997", description: "Contractor registration (class 5, 5A, 6) & unemployed engineers" },
                                    { id: "service_8998", title: "E-ROC 8998", description: "Contractor classification (class 7–9) & Labour Co-op Societies" }
                                ]
                            }
                        ]
                    }
                }
            }),
        });

        const result = await response.json();
        console.log("📋 Services Menu Response:", JSON.stringify(result, null, 2));

        if (!response.ok) {
            console.error("❌ Error sending services menu:", result);
        }
    } catch (err) {
        console.error("❌ Error in sendServicesMenu:", err);
    }
}
// ✅ Show KYC / Status Menu after service selection
async function sendServiceNextMenu(to, serviceName) {
    try {
        const fetch = (await import("node-fetch")).default;

        const response = await fetch(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "interactive",
                interactive: {
                    type: "button",
                    header: { type: "text", text: `✅ ${serviceName} Selected` },
                    body: { text: "Now please choose an option 👇" },
                    action: {
                        buttons: [
                            {
                                type: "reply",
                                reply: { id: "fill_kyc", title: "Fill KYC" },
                            },
                            {
                                type: "reply",
                                reply: { id: "check_status", title: "Check Status" },
                            },
                        ],
                    },
                },
            }),
        });

        const result = await response.json();
        console.log("📋 Next Menu Response:", JSON.stringify(result, null, 2));

        if (!response.ok) {
            console.error("❌ Error sending service next menu:", result);
        }
    } catch (err) {
        console.error("❌ Error in sendServiceNextMenu:", err);
    }
}


// ✅ Show "Book Appointment" button
async function sendAppointmentMenu(to) {
    try {
        const fetch = (await import("node-fetch")).default;

        const response = await fetch(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "interactive",
                interactive: {
                    type: "button",
                    body: { text: "🙏 Welcome! Please choose the service you want:" },
                    action: {
                        buttons: [
                            {
                                type: "reply",
                                reply: { id: "book_appointment", title: "📅 Book Appointment" },
                            },
                        ],
                    },
                },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("❌ Error sending appointment menu:", errorData);
        }
    } catch (err) {
        console.error("❌ Error in sendAppointmentMenu:", err);
    }
}

// ✅ Send WhatsApp Flow
async function sendAppointmentFlow(to) {
    try {
        const fetch = (await import("node-fetch")).default;

        const response = await fetch(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "interactive",
                interactive: {
                    type: "flow",
                    header: { type: "text", text: "📅 Appointment Booking" },
                    body: { text: "Please fill the form below 👇" },
                    action: {
                        name: "flow",
                        parameters: {
                            flow_message_version: "3",
                            flow_id: APPOINTMENT_FLOW_ID,
                            flow_cta: "Open Form",
                            flow_action: "navigate",
                            flow_action_payload: JSON.stringify({
                                screen: "DETAILS"
                            })
                        }
                    }
                }
            }),
        });

        const result = await response.json();
        console.log("Flow API response:", JSON.stringify(result, null, 2));

        if (!response.ok) {
            console.error("❌ Error sending appointment flow:", result);
        }
    } catch (err) {
        console.error("❌ Error in sendAppointmentFlow:", err);
    }
}

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Submissions file: ${SUBMISSIONS_FILE}`);
    console.log(`🔒 Processed messages file: ${PROCESSED_MESSAGES_FILE}`);
});