# Local World Labs CLI

Run from this experiment folder. No global installation or saved CLI credentials required.

```sh
npm install --prefix work/tooling --no-audit --no-fund --ignore-scripts @worldlabsai/cli@0.6.0
node worldlabs-local.mjs --check-setup
node worldlabs-local.mjs --version
```

The launcher reads `.env` beside itself, and maps `WORLDLABS_API_KEY` to the CLI variable `WLT_API_KEY` only in the child process. Existing `WLT_API_KEY` takes priority. It does not edit `.env`, print the key, or execute `.env` as shell code.

Use `node worldlabs-local.mjs` instead of `worldlabs` in the experiment instructions. The setup check and version commands do not send API requests. Upload and task commands explicitly send data to World Labs and may incur costs. Do not run them until the input and intended request are approved.

`.env` and `work/` are ignored by Git. Never commit keys or put them in command arguments.
