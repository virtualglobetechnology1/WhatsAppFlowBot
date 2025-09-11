const crypto = require("crypto");
const { privateKey } = require("../config");

function decryptPayload(body) {
    try {
        // 1️⃣ Decrypt AES key using RSA
        const decryptedAesKey = crypto.privateDecrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            Buffer.from(body.encrypted_aes_key, "base64")
        );
        console.log("🔑 AES key decrypted:", decryptedAesKey.toString("hex"), "length:", decryptedAesKey.length);

        // 2️⃣ AES-128-GCM (use 16-byte key)
        const encryptedFlowData = Buffer.from(body.encrypted_flow_data, "base64");
        const iv = Buffer.from(body.initial_vector, "base64");

        const decipher = crypto.createDecipheriv("aes-128-gcm", decryptedAesKey, iv);

        // 3️⃣ Extract auth tag (last 16 bytes)
        const authTag = encryptedFlowData.slice(encryptedFlowData.length - 16);
        const ciphertext = encryptedFlowData.slice(0, encryptedFlowData.length - 16);
        decipher.setAuthTag(authTag);

        // 4️⃣ Decrypt
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        const jsonData = JSON.parse(decrypted.toString("utf8"));
        console.log("📦 Decrypted payload:", jsonData);

        return jsonData;
    } catch (err) {
        console.error("❌ Decryption failed:", err.message);
        throw err;
    }
}
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
module.exports = { decryptPayload, encryptResponse, signResponse };
