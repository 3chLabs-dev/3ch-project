const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const DEFAULT_TIMEOUT_MS = 30_000;

function resolvePythonCandidates() {
  if (process.env.OCR_PYTHON_BIN) return [process.env.OCR_PYTHON_BIN];
  if (process.env.OMR_PYTHON_BIN) return [process.env.OMR_PYTHON_BIN];
  return process.platform === "win32" ? ["python", "py"] : ["python3", "python"];
}

function resolveScannerScript() {
  return process.env.OCR_PYTHON_SCRIPT
    ? path.resolve(process.env.OCR_PYTHON_SCRIPT)
    : path.resolve(__dirname, "../../scripts/ocr_scan.py");
}

function buildEngineError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

async function runPythonOcrWithBin({ pythonBin, imagePath, language, psm, maxSide, timeoutMs }) {
  const scriptPath = resolveScannerScript();
  await fs.access(scriptPath);

  return new Promise((resolve, reject) => {
    const args = [
      scriptPath,
      "--image",
      imagePath,
      "--language",
      language,
      "--psm",
      String(psm),
      "--max-side",
      String(maxSide),
    ];
    if (process.env.OCR_TESSERACT_CMD) {
      args.push("--tesseract-cmd", process.env.OCR_TESSERACT_CMD);
    }

    const child = spawn(pythonBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(buildEngineError("PYTHON_TIMEOUT", "Python OCR engine timed out."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error.code === "ENOENT") {
        reject(buildEngineError("PYTHON_ENGINE_UNAVAILABLE", "Python executable was not found."));
        return;
      }
      reject(buildEngineError("PYTHON_ENGINE_FAILED", "Python OCR engine failed to start.", error.message));
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        const details = (stderr || stdout || "").trim();
        const lowerDetails = details.toLowerCase();
        if (lowerDetails.includes("pillow is required") || lowerDetails.includes("pytesseract is required")) {
          reject(buildEngineError("PYTHON_DEPENDENCY_MISSING", "Python OCR dependencies are not installed.", details));
          return;
        }
        if (lowerDetails.includes("tesseract executable was not found")) {
          reject(buildEngineError("OCR_ENGINE_UNAVAILABLE", "Tesseract executable was not found.", details));
          return;
        }
        reject(buildEngineError("PYTHON_ENGINE_FAILED", "Python OCR engine could not analyze the image.", details));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(buildEngineError("PYTHON_ENGINE_INVALID_RESPONSE", "Python OCR response could not be parsed.", error.message));
      }
    });
  });
}

async function runPythonOcr(options) {
  const candidates = resolvePythonCandidates();
  let lastError = null;

  for (const pythonBin of candidates) {
    try {
      return await runPythonOcrWithBin({ ...options, pythonBin });
    } catch (error) {
      lastError = error;
      if (error?.code !== "PYTHON_ENGINE_UNAVAILABLE") throw error;
    }
  }

  throw lastError || buildEngineError("PYTHON_ENGINE_UNAVAILABLE", "Python executable was not found.");
}

async function scanOcrImageWithPython({ imageBuffer, originalName, language, psm, maxSide }) {
  const timeoutMs = Number(process.env.OCR_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "3ch-ocr-"));
  const ext = path.extname(originalName || "").toLowerCase() || ".jpg";
  const imagePath = path.join(tempDir, `input${ext}`);

  try {
    await fs.writeFile(imagePath, imageBuffer);
    return await runPythonOcr({
      imagePath,
      language,
      psm,
      maxSide,
      timeoutMs,
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  scanOcrImageWithPython,
};
