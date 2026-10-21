import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await build({
  stdin: { contents: 'export { generateProgramRoundMatches, applyProgramTournamentAdvancement } from "./src/utils/programMatchGenerator"; export { generateProgramBlocks } from "./src/features/league/algorithms/generateProgramBlocks";', resolveDir: root, loader: "ts" },
  outfile: path.resolve(root, "../3ch-api/src/shared/leagueProgramEngine.cjs"),
  bundle: true, platform: "node", format: "cjs", target: "node20",
  banner: { js: "// Generated from the actual league algorithms. Rebuild: node 3ch-web/scripts/buildTournamentEngine.mjs" },
});
