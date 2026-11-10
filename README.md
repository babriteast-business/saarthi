# SAARTHI

The first step of SAARTHI, a personal AI assistant: the console UI only. No server needed yet.

- **Core:** a chariot wheel after the Konark sun wheel (8 thick + 8 thin spokes, beaded rim) inside a live 24-hour IST dial.
  It changes with each state: standing by, listening (reacts to your mic), thinking (wheel turns, saffron bead orbits),
  speaking (saffron, rim ripples), error (red).
- **Talk:** hold Space or the mic button (speech-to-text works in Chrome and Edge). Replies are spoken aloud.
- **Type:** the box at the bottom. Press `/` to focus it, `Ctrl+K` for the command palette, `Esc` to stop.
- **Local skills until the brain is connected:** time, date, `remember …`, notes, system status, `open github`, `search …`.
  Opening sites and searching ask for approval first. Every action shows in Activity with a read / needs-approval / on-device label.
- **Display:** Full motion, Reduced or Still. Respects your system's reduced-motion setting.

Run locally: open `index.html`, or `python -m http.server 8000` in this folder and visit http://localhost:8000
(the mic needs http://localhost or https).

Next steps when you're ready: connect a brain (LLM), a server-side speech-to-text, calendar, and real tools.
