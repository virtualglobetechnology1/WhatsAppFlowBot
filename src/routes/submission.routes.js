const express = require("express");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const { getSubmissions, handleKycSubmission, checkApplicationStatus, ehandleKycSubmission } = require("../controllers/submission.controller");

const router = express.Router();

// GET all submissions
router.get("/", getSubmissions);
router.post("/kyc", upload.fields([
    { name: "appAddressFile", maxCount: 1 },
    { name: "appSignatureFile", maxCount: 1 }
]), handleKycSubmission);
// router.post("/epermissionkyc", ehandleKycSubmission);
router.post("/status", checkApplicationStatus);

module.exports = router;
