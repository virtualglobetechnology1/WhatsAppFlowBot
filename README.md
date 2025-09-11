project-root/
│── src/
│   ├── app.js                # Express app entrypoint
│   ├── server.js             # Starts the server
│   │
│   ├── config/               # Configuration files
│   │   ├── index.js          # Exports env variables, constants
│   │   ├── keys/             # Public/Private keys
│   │   │   ├── private_key.pem
│   │   │   └── public_key.pem
│   │
│   ├── routes/               # All route definitions
│   │   ├── webhook.routes.js
│   │   ├── flow.routes.js
│   │   └── submission.routes.js
│   │
│   ├── controllers/          # Controllers = handle req/res
│   │   ├── webhook.controller.js
│   │   ├── flow.controller.js
│   │   └── submission.controller.js
│   │
│   ├── services/             # Business logic (reusable)
│   │   ├── whatsapp.service.js
│   │   ├── flow.service.js
│   │   ├── submission.service.js
│   │   └── dedup.service.js
│   │
│   ├── utils/                # Helper utilities
│   │   ├── crypto.util.js    # RSA/AES decryption helpers
│   │   ├── file.util.js      # read/write JSON
│   │   └── logger.js         # wrapper for console.log
│   │
│   ├── data/                 # Local JSON "databases"
│   │   ├── submissions.json
│   │   └── processed_messages.json
│   │
│   └── middlewares/          # (Optional: for auth, logging etc.)
│
├── .env                      # Secrets (TOKEN, PHONE_NUMBER_ID, VERIFY_TOKEN)
├── package.json
├── package-lock.json
└── README.md
