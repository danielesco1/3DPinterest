// Local CLI launcher. Parses .env as data; never logs or saves credentials.
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const base = new URL("./", import.meta.url);
const envFile = fileURLToPath(new URL(".env", base));
if (existsSync(envFile)) loadEnvFile(envFile);
const env = { ...process.env };
env.WLT_API_KEY = env.WLT_API_KEY || env.WORLDLABS_API_KEY;
delete env.WORLDLABS_API_KEY;
const cli = fileURLToPath(new URL("work/tooling/node_modules/@worldlabsai/cli/dist/index.js", base));
const args = process.argv.slice(2);
if (args[0] === "--check-setup") {
  console.log(`Local CLI installed: ${existsSync(cli)}`);
  console.log(`API key available: ${Boolean(env.WLT_API_KEY?.trim())}`);
  console.log("No network request made.");
  process.exit(existsSync(cli) && env.WLT_API_KEY?.trim() ? 0 : 1);
}
if (!existsSync(cli)) { console.error("Install local CLI first; see LOCAL_SETUP.md."); process.exit(1); }
const result = spawnSync(process.execPath, [cli, ...args], { env, stdio: "inherit", shell: false });
if (result.error) { console.error("Could not start local CLI."); process.exit(1); }
process.exit(result.status ?? 1);
