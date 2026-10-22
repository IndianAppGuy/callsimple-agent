<p align="center"><img src="assets/icon.png" width="80" alt="CallSimple"></p>

<h1 align="center">CallSimple for AI agents</h1>

<p align="center"><b>Give your AI agent a phone.</b> It calls, talks in Hindi or English, and tells you what they said.</p>

<p align="center">
<a href="https://skills.sh/IndianAppGuy/callsimple-agent"><img src="https://skills.sh/b/IndianAppGuy/callsimple-agent" alt="skills.sh"></a>
<a href="https://cursor.com/en/install-mcp?name=callsimple&config=eyJ1cmwiOiJodHRwczovL2NhbGxzaW1wbGUuYXBwL21jcCJ9"><img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Add CallSimple MCP to Cursor" height="20"></a>
</p>

You tell your agent *"call my plumber Raju and ask if he can come tomorrow at 11"*. It shows you the number, the message and the questions. You say yes. CallSimple rings Raju with an AI voice that says it is an AI assistant calling for you, asks in Hindi, and a minute later your agent tells you: *"Raju can come at 11:30, he'll charge ₹400."* Recording and transcript included.

- **Indian +91 numbers**, in Hindi, English, Marathi, Bengali, Gujarati, Punjabi, Tamil, Telugu, Kannada, Malayalam and Odia
- **Up to 8 questions** per call, answered one by one, plus a summary and the full transcript
- **You approve every call.** No cold sales, debt collection, threats or OTP/bank-detail requests (CallSimple refuses them)
- **2 free minutes** on sign-up, then packs from ₹499 for 16 minutes ([pricing](https://callsimple.app/pricing?ref=github))

## Install

Pick your agent. Every option uses the same skill ([`skills/callsimple/SKILL.md`](skills/callsimple/SKILL.md)) and the same hosted MCP server, `https://callsimple.app/mcp` (OAuth sign-in, no API key to copy).

| Agent | Install |
|---|---|
| **Any agent (skills.sh)** | `npx skills add IndianAppGuy/callsimple-agent` |
| **Claude Code** (plugin: skill + MCP) | `/plugin marketplace add IndianAppGuy/callsimple-agent` then `/plugin install callsimple@callsimple` |
| Claude Code (MCP only) | `claude mcp add --transport http callsimple https://callsimple.app/mcp` then `/mcp` to sign in |
| **Claude.ai / Claude Desktop** | Settings → Connectors → Add custom connector → `https://callsimple.app/mcp` ([guide](https://callsimple.app/claude?ref=github)) |
| **ChatGPT** | Settings → Apps → CallSimple ([guide](https://callsimple.app/chatgpt?ref=github)) |
| **Codex** | `npx skills add IndianAppGuy/callsimple-agent -a codex` and `codex mcp add callsimple --url https://callsimple.app/mcp && codex mcp login callsimple` |
| **Gemini CLI** | `gemini extensions install https://github.com/IndianAppGuy/callsimple-agent` |
| **Cursor** | [Add to Cursor](https://cursor.com/en/install-mcp?name=callsimple&config=eyJ1cmwiOiJodHRwczovL2NhbGxzaW1wbGUuYXBwL21jcCJ9) + `npx skills add IndianAppGuy/callsimple-agent -a cursor` |
| **OpenClaw** | `openclaw skills install @theindianappguy/callsimple` |
| **Hermes Agent** | `hermes skills install skills-sh/IndianAppGuy/callsimple-agent/callsimple` |
| **Any MCP client** | Streamable HTTP server `https://callsimple.app/mcp` (OAuth 2.1 + dynamic client registration) |
| **Shell / any agent with a terminal** | `npx -y github:IndianAppGuy/callsimple-agent login` |

No account yet? [Sign up at callsimple.app](https://callsimple.app/?ref=github). Sign-in is by phone and you get 2 free minutes.

## The CLI

For agents without MCP support (or if you prefer a shell), the skill falls back to a zero-dependency CLI that uses the same OAuth sign-in:

```bash
npx -y github:IndianAppGuy/callsimple-agent login        # opens your browser once
npx -y github:IndianAppGuy/callsimple-agent balance
npx -y github:IndianAppGuy/callsimple-agent call \
  --phone "+91 98765 43210" --name "Raju" --language hi-IN \
  --message "Sanskar's bathroom tap needs fixing tomorrow morning." \
  --question "Can you come tomorrow at 11?" --question "How much will it cost?" \
  --confirmed                                            # only after the human said yes
npx -y github:IndianAppGuy/callsimple-agent result <call_id> --wait
npx -y github:IndianAppGuy/callsimple-agent recent
```

Without `--confirmed`, `call` only prints the preview to show the human. Credentials live in `~/.config/callsimple/credentials.json` (mode 600). `CALLSIMPLE_TOKEN` overrides them.

## Tools

| Tool | What it does |
|---|---|
| `place_call` | Calls a +91 number, delivers `message`, asks up to 8 `questions` in `language` (default Hindi). Uses minutes. |
| `get_call_result` | Status, summary, the answer to each question, transcript, recording link. |
| `list_recent_calls` | Your latest calls with status and summary. |
| `get_balance` | Minutes left. |

## Try these prompts

1. *"Call my plumber Raju on 98xxxxxx10 in Hindi and ask if he can come tomorrow at 11 and what he'll charge."*
2. *"Ring Dr. Mehta's clinic on 80xxxxxx21 and book a dental cleaning for Saturday morning. Ask the fee."*
3. *"Confirm with the caterer by phone, in English, that 40 people are coming on Friday at 8pm, and ask when they'll arrive to set up."*
4. *"Remind my mom in Hindi to take her medicine at 9pm."*
5. *"Call the print shop and ask if the 50 banners are ready and when they can deliver."*

## Safety

CallSimple is for calls the person on the other end would expect or welcome. The skill and the server both enforce:

- The agent **must show the number, message and questions and get your clear yes** before every call.
- The AI always says it is an AI assistant calling on your behalf.
- **Refused:** sales or promotional pitches to people who did not ask, debt collection, threats or harassment, asking for OTPs, passwords, bank or card details, impersonating a real person, emergency numbers.
- **Limits:** +91 numbers only; personal calls 8am–10pm IST, business follow-ups 9am–9pm IST; at most 2 calls a day to the same number; calls up to 3 minutes.
- **Do Not Disturb:** if the person says on a call that they do not want these calls, their number is blocked for every CallSimple user.

[Privacy policy](https://callsimple.app/privacy) · [Terms](https://callsimple.app/terms) · [Support](https://callsimple.app/support)

## What's in this repo

```
skills/callsimple/SKILL.md      the skill (agentskills.io standard), used by every package below
skills/callsimple/agents/openai.yaml   Codex UI + MCP dependency
bin/callsimple.mjs              zero-dependency CLI (npx github:IndianAppGuy/callsimple-agent)
.claude-plugin/                 Claude Code plugin + marketplace (skill + MCP)
gemini-extension.json, GEMINI.md   Gemini CLI extension
plugin.json, mcp.json           Agent Plugins package (ChatGPT/Codex directory, Cursor)
server.json                     official MCP registry entry
```

MIT licensed. Made by [IndianAppGuy](https://github.com/IndianAppGuy).
