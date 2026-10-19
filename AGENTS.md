<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- ML runs in a browser Web Worker via Pyodide (src/lib/aqua/ai.worker.ts) — the user requires real Python ML inside the web, and the Worker runtime can't run Python.
- Telemetry storage is Google Sheets via Apps Script (GOOGLE_SHEETS_WEBAPP_URL); without it the app shows clearly labeled demo data.
