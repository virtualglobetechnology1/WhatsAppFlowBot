const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { TOKEN, PHONE_NUMBER_ID, APPOINTMENT_FLOW_ID, KYC_FLOW_ID, CHECK_STATUS_FLOW_ID } = require("../config");

async function sendText(to, text) {
    return sendMessage(to, {
        type: "text",
        text: { body: text }
    });
}

async function sendServicesMenu(to) {
    return sendMessage(to, {
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
    });
}

async function sendServiceNextMenu(to, serviceName) {
    return sendMessage(to, {
        type: "interactive",
        interactive: {
            type: "button",
            header: { type: "text", text: `✅ ${serviceName} Selected` },
            body: { text: "Now please choose an option 👇" },
            action: {
                buttons: [
                    { type: "reply", reply: { id: "fill_kyc", title: "Fill KYC" } },
                    { type: "reply", reply: { id: "check_status", title: "Check Status" } }
                ]
            }
        }
    });
}

async function sendAppointmentFlow(to) {
    return sendMessage(to, {
        type: "interactive",
        interactive: { /* flow JSON with APPOINTMENT_FLOW_ID */ }
    });
}

async function sendMessage(to, payload) {
    try {
        const fetch = (await import("node-fetch")).default;
        const response = await fetch(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
        });
        const result = await response.json();
        console.log("📤 Message sent:", result); // add this to see if API call works
        return result;
    } catch (err) {
        console.error("❌ Error sending message:", err);
    }
}
async function sendKycFlow(to) {
    console.log("🚀 Initiating KYC flow for:", to);
    interactive:
    return sendMessage(to, {
        type: "interactive",
        interactive: {
            type: "flow",
            header: {
                type: "text", text: "KYC Form"
            },
            body: { text: "Please provide your details.Your information will remain confidential.Let's get started! 👇" },
            action: {
                name: "flow",
                parameters: {
                    flow_message_version: "3",
                    flow_id: KYC_FLOW_ID,
                    flow_cta: "Open Form",
                    flow_action: "navigate",
                    flow_action_payload: JSON.stringify({
                        screen: "KYC_BASIC_DETAILS"
                    })
                }
            }
        }

    });
}

async function sendCheckStatusFlow(to) {
    console.log("🚀 Initiating Status Check flow for:", to);
    return sendMessage(to, {
        type: "interactive",
        interactive: {
            type: "flow",
            header: {
                type: "text", text: "🔍 Check Status"
            },
            body: {
                text: "Please enter your Reference Number to check your application status."
            },
            action: {
                name: "flow",
                parameters: {
                    flow_message_version: "3",
                    flow_id: CHECK_STATUS_FLOW_ID, // 👈 create this flow JSON in Meta dashboard
                    flow_cta: "Enter Reference Number",
                    flow_action: "navigate",
                    flow_action_payload: JSON.stringify({
                        screen: "STATUS_INPUT"
                    })
                }
            }
        }
    });
}

module.exports = { sendText, sendServicesMenu, sendServiceNextMenu, sendAppointmentFlow, sendKycFlow, sendCheckStatusFlow };
