import express from "express";
import multer from "multer";
import {
  addExpense,
  getExpenses,
  getFinancialSummary,
  getExpenseInsights,
  scanReceiptAndProcess,
  scanMultipleReceipts,
  deleteAllExpenses,
  deleteAllReceived,
} from "../controllers/expenseController.js";
import Expense from "../models/Expense.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const SCAN_EXTENSIONS = [
  "jpg", "jpeg", "png", "webp", "gif",
  "pdf",
  "xlsx", "xls", "csv",
  "docx", "doc", "rtf", "txt",
];

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname?.split(".").pop()?.toLowerCase() || "";
    if (SCAN_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type (.${ext}). Allowed: ${SCAN_EXTENSIONS.join(", ")}`));
    }
  },
});

const prepareFileForScan = (req, file) => {
  req.file = file;
  req.body = req.body || {};
  req.body.mimeType = file.mimetype;
  req.body.scannedDocumentName = file.originalname;
  req.body.imageBuffer = file.buffer.toString("base64");
  req.body.fileBuffer = file.buffer;
};

const handleMulterError = (err, res) => {
  const msg = err?.message || "File upload failed.";
  return res.status(400).json({ success: false, msg, message: msg });
};

// Single file scan (backward compatible)
router.post("/scan", verifyToken, (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) return handleMulterError(err, res);
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file && req.body?.imageBuffer) {
      const buffer = Buffer.from(req.body.imageBuffer, "base64");
      const fileName =
        req.body.scannedDocumentName ||
        `upload.${(req.body.mimeType || "application/octet-stream").split("/").pop()}`;
      req.file = {
        buffer,
        mimetype: req.body.mimeType || "application/octet-stream",
        originalname: fileName,
        size: buffer.length,
      };
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        msg: "No file uploaded or payload data provided.",
        message: "No file uploaded or payload data provided.",
      });
    }

    prepareFileForScan(req, req.file);
    return scanReceiptAndProcess(req, res, next);
  } catch (err) {
    console.error("Universal Scanner Architecture Crash:", err);
    const message = err.message?.includes("Unsupported file type")
      ? err.message
      : "Pipeline error resolving file layout rules parameters.";
    return res.status(500).json({ success: false, message, msg: message });
  }
});

// Multi-file batch scan
router.post("/scan/batch", verifyToken, (req, res, next) => {
  upload.array("files", 10)(req, res, (err) => {
    if (err) return handleMulterError(err, res);
    next();
  });
}, scanMultipleReceipts);

router.delete("/all", verifyToken, deleteAllExpenses);
router.delete("/received/all", verifyToken, deleteAllReceived);

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Session validation expired or User ID missing." });
    }

    const deletedExpense = await Expense.findOneAndDelete({ _id: expenseId, userId });
    if (!deletedExpense) {
      return res.status(404).json({ success: false, msg: "Expense record not found in system logs." });
    }
    return res.status(200).json({ success: true, msg: "Expense log successfully deleted!" });
  } catch (err) {
    console.error("Delete Route Architecture Error:", err);
    return res.status(500).json({ success: false, msg: "Database exception occurred." });
  }
});

router.get("/:userId/summary", verifyToken, getFinancialSummary);
router.get("/:userId/insights", verifyToken, getExpenseInsights);
router.get("/:userId", verifyToken, getExpenses);
router.post("/", verifyToken, addExpense);
router.post("/add", verifyToken, addExpense);

export default router;
