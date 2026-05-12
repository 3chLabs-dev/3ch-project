const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const DEFAULT_TIMEOUT_MS = 30_000;

function resolvePythonCandidates() {
  if (process.env.OMR_PYTHON_BIN) {
    return [process.env.OMR_PYTHON_BIN];
  }
  return process.platform === "win32"
    ? ["python", "py"]
    : ["python3", "python"];
}

function resolveScannerScript() {
  return process.env.OMR_PYTHON_SCRIPT
    ? path.resolve(process.env.OMR_PYTHON_SCRIPT)
    : path.resolve(__dirname, "../../scripts/omr_scan.py");
}

function buildEngineError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

async function runPythonScannerWithBin({ pythonBin, imagePath, payloadPath, timeoutMs }) {
  const scriptPath = resolveScannerScript();

  await fs.access(scriptPath);

  return new Promise((resolve, reject) => {
    const args = [scriptPath, "--image", imagePath, "--payload", payloadPath];
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
      reject(buildEngineError("PYTHON_TIMEOUT", "Python OMR 엔진 응답 시간이 초과되었습니다."));
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
        reject(buildEngineError("PYTHON_ENGINE_UNAVAILABLE", "Python 실행 파일을 찾을 수 없습니다."));
        return;
      }
      reject(buildEngineError("PYTHON_ENGINE_FAILED", "Python OMR 엔진 실행에 실패했습니다.", error.message));
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        const details = (stderr || stdout || "").trim();
        if (details.toLowerCase().includes("pillow is required")) {
          reject(
            buildEngineError(
              "PYTHON_DEPENDENCY_MISSING",
              "Python OMR 필수 패키지가 설치되지 않았습니다.",
              details,
            ),
          );
          return;
        }
        reject(
          buildEngineError(
            "PYTHON_ENGINE_FAILED",
            "Python OMR 엔진이 이미지를 분석하지 못했습니다.",
            details,
          ),
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(buildEngineError("PYTHON_ENGINE_INVALID_RESPONSE", "Python OMR 응답을 해석하지 못했습니다.", error.message));
      }
    });
  });
}

async function runPythonScanner({ imagePath, payloadPath, timeoutMs }) {
  const candidates = resolvePythonCandidates();
  let lastError = null;

  for (const pythonBin of candidates) {
    try {
      return await runPythonScannerWithBin({ pythonBin, imagePath, payloadPath, timeoutMs });
    } catch (error) {
      lastError = error;
      if (error?.code !== "PYTHON_ENGINE_UNAVAILABLE") {
        throw error;
      }
    }
  }

  throw lastError || buildEngineError("PYTHON_ENGINE_UNAVAILABLE", "Python 실행 파일을 찾을 수 없습니다.");
}

async function scanOmrImageWithPython({ imageBuffer, originalName, payload }) {
  const timeoutMs = Number(process.env.OMR_SCANNER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "3ch-omr-"));
  const ext = path.extname(originalName || "").toLowerCase() || ".jpg";
  const imagePath = path.join(tempDir, `input${ext}`);
  const payloadPath = path.join(tempDir, "payload.json");

  try {
    await fs.writeFile(imagePath, imageBuffer);
    await fs.writeFile(payloadPath, JSON.stringify(payload), "utf8");
    return await runPythonScanner({ imagePath, payloadPath, timeoutMs });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  scanOmrImageWithPython,
};
