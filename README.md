# FlyerMaker

A minimal in-browser image layering prototype built with **Vite + TypeScript**.

---

## Super-simple setup (copy/paste)

### 1) Install Node.js

You need Node.js **20+**.

Check what you have:

```bash
node -v
npm -v
```

If `node` is missing or very old, install/update Node.js first.

---

### 2) Install dependencies

From the project folder:

```bash
npm install
```

Wait until it finishes.

---

### 3) Run the app locally (dev mode)

```bash
npm run dev
```

Vite prints a local URL (usually `http://localhost:5173`).
Open that URL in your browser.

To stop the server, press:

```text
Ctrl + C
```

---

## Build a production bundle

```bash
npm run build
```

If successful, files are generated in the `dist/` folder.

---

## Serve the production build locally

After building:

```bash
npm run preview
```

Open the URL shown in terminal (usually `http://localhost:4173`).

---

## One-command quick check

If you only want to verify everything compiles:

```bash
npm run build
```

---

## Common issues

### "npm: command not found"
Install Node.js (it includes npm), then re-open terminal.

### "Port already in use"
Run dev server on a different port:

```bash
npm run dev -- --port 5174
```

### URL image import fails
Some remote sites block cross-origin image loading (CORS). Try:
- importing from local file instead, or
- using a different image host that allows CORS.
