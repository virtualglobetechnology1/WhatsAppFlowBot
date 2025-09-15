const { getAllSubmissions } = require("../services/submission.service");
const { decryptPayload, encryptResponse, signResponse } = require("../utils/crypto.util");
const { saveSubmission } = require("../services/submission.service");
const { privateKey } = require("../config");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const FormData = require("form-data");

const dummyAddress = path.join(__dirname, "../dummy/dummy.pdf");
const dummySignature = path.join(__dirname, "../dummy/dummy.jpg");
// External API endpoints
const TOKEN_URL = "https://uat-eroc.emahapwd.com/api/generate-token";
const STATUS_URL = "https://uat-eroc.emahapwd.com/api/get-application-status";
const SUBMIT_URL = "https://uat-eroc.emahapwd.com/api/add-registration-details";

// Credentials (keep in env variables in production!)
const CLIENT_ID = "df01cb12-99f2-4d4a-b4e2-314eec7dbd61";
const SECRET_KEY = "Yx1#Fp7@Vz9!Lm^Tc6Wq*Dr8Oo%Kb!g";

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
async function handleKycSubmission(req, res) {
    try {
        const body = req.body;
        console.log("📨 Incoming webhook:", JSON.stringify(body, null, 2));

        // Only process encrypted Flow data from WhatsApp
        if (body.encrypted_flow_data) {
            // 1️⃣ Decrypt flow payload
            const decrypted = decryptPayload(body);
            console.log("✅ Decrypted Flow Submission:", decrypted);

            // Extract fields from decrypted form
            const {
                firm_name,
                firm_start_date,
                pan_number,
                address_line_1,
                address_line_2,
                address_line_3,
                city,
                district,
                taluka,
                pincode,
                mobile_number,
                type,
                category,
                apply_for,
                email,
                confirm_email,
                password,
                confirm_password,
                alt_email,
                division,
                address_file, // assuming you get file path / base64
                signature_file
            } = decrypted || {};

            // 2️⃣ Generate token
            const tokenResp = await fetch(TOKEN_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientID: CLIENT_ID,
                    secretKey: SECRET_KEY,
                }),
            });
            const tokenData = await tokenResp.json();
            const token = tokenData?.token || tokenData;
            console.log("🔑 Token generated:", token);

            if (!token) throw new Error("Failed to fetch token");

            // 3️⃣ Prepare FormData for submission
            const form = new FormData();
            form.append("appCompanyName", firm_name || "Demo org");
            form.append("appFirmStartDate", firm_start_date || "01-01-2024");
            form.append("appPanNo", pan_number || "TESTP1234X");
            form.append("appAddressLine1", address_line_1 || "Addr 1");
            form.append("appAddressLine2", address_line_2 || "Addr 2");
            form.append("appAddressLine3", address_line_3 || "Addr 3");
            form.append("appCity", city || "Nagpur");
            form.append("appDistrict", district || "1");
            form.append("appTaluka", taluka || "1");
            form.append("appPincode", pincode || "440001");
            form.append("appMobileNo", mobile_number || "9876543210");
            form.append("appType", type || "Con");
            form.append("appCategory", category || "Civil");
            form.append("appApplyFor", apply_for || "New");
            form.append("appEmailId", email || "demo@gmail.com");
            form.append("appConfirmEmailId", confirm_email || "demo@gmail.com");
            form.append("appPassword", password || "Test@123");
            form.append("appConfirmPassword", confirm_password || "Test@123");
            form.append("appAlternateEmailId", alt_email || "alt@gmail.com");
            form.append("appDivision", division || "1");

            // Attach Address Proof
            if (address_file && fs.existsSync(address_file)) {
                form.append("appAddressFile", fs.createReadStream(address_file));
            } else if (fs.existsSync(dummyAddress)) {
                console.warn("⚠️ Address file missing, using dummy file");
                form.append("appAddressFile", fs.createReadStream(dummyAddress));
            }

            // Attach Signature Proof
            if (signature_file && fs.existsSync(signature_file)) {
                form.append("appSignatureFile", fs.createReadStream(signature_file));
            } else if (fs.existsSync(dummySignature)) {
                console.warn("⚠️ Signature file missing, using dummy file");
                form.append("appSignatureFile", fs.createReadStream(dummySignature));
            }

            // 4️⃣ Submit form to external API
            const submitResp = await fetch(SUBMIT_URL, {
                method: "POST",
                headers: {
                    Authorization: token,
                    ...form.getHeaders(),
                },
                body: form,
            });

            const submitData = await submitResp.json();
            console.log("📄 Submit response:", submitData);

            // Save submission locally (optional)
            const filePath = path.join(__dirname, "kyc_submissions.json");
            fs.appendFileSync(filePath, JSON.stringify(submitData, null, 2) + "\n");

            // from flow input
            // ✅ Extract id and message if available
            const responseId = submitData?.appId || submitData?.applicationId || null;
            const responseMessage = submitData?.message || submitData?.status || "KYC submitted successfully";
            // 5️⃣ Encrypt response back to WhatsApp
            const aesKey = crypto.privateDecrypt(
                {
                    key: privateKey,
                    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                    oaepHash: "sha256",
                },
                Buffer.from(body.encrypted_aes_key, "base64")
            );

            const initialVector = Buffer.from(body.initial_vector, "base64");

            const encryptedResponse = encryptResponse(
                JSON.stringify({
                    data: {
                        status: "active", id: responseId,
                        message: responseMessage,
                    }
                }),
                aesKey,
                initialVector
            );

            const signature = signResponse(encryptedResponse);

            res.set("X-WhatsApp-Signature", signature);
            res.type("text/plain");
            console.log("🔐 Encrypted response:", encryptedResponse);

            return res.send(encryptedResponse);
        }

        // If not WhatsApp Flow data, just ACK
        return res.sendStatus(200);
    } catch (err) {
        console.error("❌ handleKycSubmission error:", err);
        res.sendStatus(500);
    }
}



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
            console.log("🔍 Reference Number:", referenceNumber);
            console.log("🔍 Full Decrypted Data:", decrypted?.data?.reference_number);

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
