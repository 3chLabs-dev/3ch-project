const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_TIMEOUT_MS = 10_000;

function resolvePythonCandidates() {
  if (process.env.VISION_PYTHON_BIN) return [process.env.VISION_PYTHON_BIN];
  if (process.env.OMR_PYTHON_BIN) return [process.env.OMR_PYTHON_BIN];
  return process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
}

function runCropScript(pythonBin, inputPath, outputPath) {
  const scriptPath = path.resolve(__dirname, '../../scripts/vision_crop.py');

  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath, '--input', inputPath, '--output', outputPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Vision image crop timed out.'));
    }, DEFAULT_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr || 'Vision image crop failed.'));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error('Vision image crop returned invalid JSON.'));
      }
    });
  });
}

async function prepareLeagueVisionImage({ imageBuffer, mimeType }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), '3ch-vision-'));
  const inputPath = path.join(tempDir, 'input');
  const outputPath = path.join(tempDir, 'score-table.jpg');

  try {
    await fs.writeFile(inputPath, imageBuffer);
    let result = null;
    let lastError = null;
    for (const pythonBin of resolvePythonCandidates()) {
      try {
        result = await runCropScript(pythonBin, inputPath, outputPath);
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!result) throw lastError || new Error('Vision image crop is unavailable.');
    return {
      imageBuffer: await fs.readFile(outputPath),
      mimeType: 'image/jpeg',
      cropped: result.cropped,
    };
  } catch (error) {
    console.warn('Vision image preprocessing skipped:', error.message);
    return { imageBuffer, mimeType, cropped: false };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { prepareLeagueVisionImage };
