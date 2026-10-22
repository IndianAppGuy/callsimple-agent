#!/usr/bin/env node
// CallSimple CLI: give any AI agent a phone. Zero dependencies, Node 18+.
// Talks to the same remote MCP server as the Claude/ChatGPT connectors
// (https://callsimple.app/mcp) using the same OAuth sign-in.

import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { exec } from "node:child_process";

const BASE = (process.env.CALLSIMPLE_URL || "https://callsimple.app").replace(/\/$/, "");
const DIR = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "callsimple");
const CREDS = join(DIR, "credentials.json");
const REF = process.env.CALLSIMPLE_REF || "cli";
const DONE = new Set(["completed", "no_answer", "busy", "refused", "failed"]);

const HELP = `CallSimple: your AI agent makes phone calls to Indian (+91) numbers in Hindi, English and 9 more languages.

Usage:
  callsimple login                     Sign in (opens your browser). First sign-up gets 2 free minutes.
  callsimple call --phone <num> --message <text> [--question <q>]... --confirmed
        [--name <recipient>] [--language hi-IN|en-IN|mr-IN|bn-IN|gu-IN|pa-IN|ta-IN|te-IN|kn-IN|ml-IN|od-IN]
        [--voice simran|priya|neha|kavya|shreya|aditya|rahul|rohan|kabir|varun]
        [--caller-name <your name>] [--known-contact]
  callsimple result <call_id> [--wait]  What they said (--wait polls until the call ends, up to 5 min)
  callsimple recent [--limit N]        Recent calls
  callsimple balance                   Minutes left
  callsimple logout

Options: --json prints raw JSON. Env: CALLSIMPLE_TOKEN (use an existing access token), CALLSIMPLE_URL.

--confirmed means the human has seen the number, message and questions and said yes. Never pass it otherwise.
Sign up / buy minutes: ${BASE}/?ref=${REF}`;

// ---------- args ----------
function parse(argv) {
  const out = { _: [], question: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const [k, inline] = a.slice(2).split(/=(.*)/s);
    const flag = ["confirmed", "known-contact", "wait", "json", "help", "no-browser"].includes(k);
    const v = flag ? true : inline ?? argv[++i];
    if (k === "question") out.question.push(v);
    else out[k] = v;
  }
  return out;
}

// ---------- credentials ----------
const load = () => { try { return JSON.parse(readFileSync(CREDS, "utf8")); } catch { return null; } };
const save = (c) => { mkdirSync(DIR, { recursive: true, mode: 0o700 }); writeFileSync(CREDS, JSON.stringify(c, null, 2), { mode: 0o600 }); };

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function post(path, body, form = false) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
    body: form ? new URLSearchParams(body) : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.error || `HTTP ${r.status} on ${path}`);
  return j;
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? 'start ""' : "xdg-open";
  exec(`${cmd} "${url}"`, () => {});
}

async function login(opts) {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = b64url(randomBytes(16));

  const server = createServer();
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  const redirect = `http://127.0.0.1:${server.address().port}/callback`;

  const client = await post("/oauth/register", { client_name: `CallSimple CLI (${REF})`, redirect_uris: [redirect] });
  const url = `${BASE}/oauth/authorize?` + new URLSearchParams({
    response_type: "code", client_id: client.client_id, redirect_uri: redirect,
    code_challenge: challenge, code_challenge_method: "S256", state, scope: "calls offline_access",
  });

  console.error(`Open this link to sign in to CallSimple (new accounts get 2 free minutes):\n\n  ${url}\n`);
  if (!opts["no-browser"]) openBrowser(url);

  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Sign-in timed out after 10 minutes.")), 600_000);
    server.on("request", (req, res) => {
      const q = new URL(req.url, redirect).searchParams;
      if (!req.url.startsWith("/callback")) { res.writeHead(404).end(); return; }
      const ok = q.get("code") && q.get("state") === state;
      res.writeHead(200, { "Content-Type": "text/html" }).end(
        `<body style="font:16px system-ui;padding:40px">${ok ? "CallSimple is connected. You can close this tab and go back to your agent." : "Sign-in failed: " + (q.get("error") || "state mismatch")}</body>`,
      );
      clearTimeout(timer);
      ok ? resolve(q.get("code")) : reject(new Error(q.get("error") || "state mismatch"));
    });
  }).finally(() => server.close());

  const t = await post("/oauth/token", {
    grant_type: "authorization_code", code, code_verifier: verifier, client_id: client.client_id, redirect_uri: redirect,
  }, true);
  save({ client_id: client.client_id, access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + t.expires_in * 1000 });
  console.log("Signed in. Try: callsimple balance");
}

async function refresh(c) {
  const t = await post("/oauth/token", { grant_type: "refresh_token", refresh_token: c.refresh_token, client_id: c.client_id }, true);
  const n = { ...c, access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + t.expires_in * 1000 };
  save(n);
  return n;
}

// ---------- MCP tools/call ----------
async function tool(name, args) {
  let c = process.env.CALLSIMPLE_TOKEN ? { access_token: process.env.CALLSIMPLE_TOKEN } : load();
  if (!c) throw new Error(`Not signed in. Run: callsimple login   (or sign up at ${BASE}/?ref=${REF})`);
  const send = (tok) => fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  let r = await send(c.access_token);
  if (r.status === 401 && c.refresh_token) { c = await refresh(c); r = await send(c.access_token); }
  if (r.status === 401) throw new Error("Session expired. Run: callsimple login");
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

function print(result, opts) {
  if (opts.json) console.log(JSON.stringify(result.structuredContent ?? result, null, 2));
  else console.log(result.content?.map((x) => x.text).join("\n"));
  if (result.isError) process.exitCode = 1;
}

// ---------- main ----------
const opts = parse(process.argv.slice(2));
const cmd = opts._[0];

try {
  if (!cmd || opts.help || cmd === "help") console.log(HELP);
  else if (cmd === "login") await login(opts);
  else if (cmd === "logout") { rmSync(CREDS, { force: true }); console.log("Signed out."); }
  else if (cmd === "balance") print(await tool("get_balance", {}), opts);
  else if (cmd === "recent") print(await tool("list_recent_calls", { limit: Number(opts.limit) || 5 }), opts);
  else if (cmd === "result") {
    const id = opts._[1];
    if (!id) throw new Error("Usage: callsimple result <call_id> [--wait]");
    let r = await tool("get_call_result", { call_id: id });
    const end = Date.now() + 5 * 60_000;
    while (opts.wait && Date.now() < end && !(DONE.has(r.structuredContent?.status) && (r.structuredContent?.summary || r.structuredContent?.status !== "completed"))) {
      await new Promise((s) => setTimeout(s, 10_000));
      r = await tool("get_call_result", { call_id: id });
    }
    print(r, opts);
  } else if (cmd === "call") {
    if (!opts.phone || !opts.message) throw new Error("Usage: callsimple call --phone <num> --message <text> [--question <q>]... --confirmed");
    if (!opts.confirmed) {
      console.error(`Not calling. Show the user this and get a clear yes, then re-run with --confirmed:\n
  Number:   ${opts.phone}${opts.name ? ` (${opts.name})` : ""}
  Language: ${opts.language || "hi-IN (Hindi)"}
  Message:  ${opts.message}
  Questions:${opts.question.length ? "\n" + opts.question.map((q, i) => `    ${i + 1}. ${q}`).join("\n") : " none"}`);
      process.exit(2);
    }
    const args = { phone: String(opts.phone), message: String(opts.message) };
    if (opts.question.length) args.questions = opts.question.map(String).slice(0, 8);
    if (opts.name) args.recipient_name = String(opts.name);
    if (opts.language) args.language = String(opts.language);
    if (opts.voice) args.voice = String(opts.voice);
    if (opts["caller-name"]) args.caller_name = String(opts["caller-name"]);
    if (opts["known-contact"]) args.known_contact = true;
    print(await tool("place_call", args), opts);
  } else throw new Error(`Unknown command "${cmd}". Run: callsimple help`);
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
