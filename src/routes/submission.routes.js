const express = require("express");
const { getSubmissions, handleKycSubmission, checkApplicationStatus } = require("../controllers/submission.controller");

const router = express.Router();

// GET all submissions
router.get("/", getSubmissions);
router.post("/kyc", handleKycSubmission);
router.post("/status", checkApplicationStatus);

module.exports = router;
