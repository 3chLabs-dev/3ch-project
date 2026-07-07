const express = require("express");
const multer = require("multer");
const { z } = require("zod");
const { requireAuth } = require("../middlewares/auth");
const { scanOcrImageWithPython } = require("../services/ocrScanner");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const ocrPayloadSchema = z.object({
  language: z.string().trim().regex(/^[a-zA-Z0-9_+.-]+$/).default(process.env.OCR_LANGS || "kor+eng"),
  psm: z.coerce.number().int().min(3).max(13).default(6),
  maxSide: z.coerce.number().int().min(600).max(5000).default(2400),
});

router.post("/ocr/scan", requireAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "이미지 파일이 필요합니다." });
    }
    if (!String(req.file.mimetype || "").startsWith("image/")) {
      return res.status(400).json({ message: "이미지 파일만 업로드할 수 있습니다." });
    }

    const payload = ocrPayloadSchema.parse(req.body);
    const result = await scanOcrImageWithPython({
      imageBuffer: req.file.buffer,
      originalName: req.file.originalname,
      language: payload.language,
      psm: payload.psm,
      maxSide: payload.maxSide,
    });

    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "OCR 요청 형식이 올바르지 않습니다.", issues: error.issues });
    }
    if (error?.code === "PYTHON_ENGINE_UNAVAILABLE" || error?.code === "OCR_ENGINE_UNAVAILABLE") {
      return res.status(503).json({
        message: "OCR 엔진을 사용할 수 없습니다.",
        code: error.code,
        details: error.details ?? error.message,
      });
    }
    if (error?.code === "PYTHON_DEPENDENCY_MISSING") {
      return res.status(503).json({
        message: "Python OCR 필수 패키지가 설치되지 않았습니다.",
        code: error.code,
        details: error.details ?? error.message,
      });
    }
    if (error?.code === "PYTHON_TIMEOUT") {
      return res.status(504).json({ message: "OCR 이미지 분석 시간이 초과되었습니다.", code: error.code });
    }
    if (error?.code === "PYTHON_ENGINE_FAILED" || error?.code === "PYTHON_ENGINE_INVALID_RESPONSE") {
      return res.status(500).json({
        message: "Python OCR 엔진 처리 중 오류가 발생했습니다.",
        code: error.code,
        details: error.details ?? error.message,
      });
    }

    console.error("Error scanning OCR image:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
