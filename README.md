# jm-intake

Client intake form for John Mize Real Estate, served at **intake.johnmizerealestate.com**.

- `index.html`: the form (GitHub Pages serves this)
- `CNAME`: custom domain for GitHub Pages
- `apps-script/Code.gs`: the backend.  Paste it into Google Apps Script (it is not served by GitHub)

How it works: client submits → the form posts to the Apps Script web app → the script emails John, emails the client a copy, and adds a row to the Google Sheet.

Until `CONFIG.endpoint` in `index.html` is filled in, the form runs in **preview mode**: nothing is sent, and the thank-you screen shows both emails.

---

## Setup

### A. GitHub Pages (can do now)

1. Create a new public repo `johnmize/jm-intake` and upload these files (keep the `apps-script` folder; it's harmless).
2. Repo **Settings → Pages**: Source = *Deploy from a branch*, Branch = `main` / root.  Save.
3. At your DNS provider for johnmizerealestate.com, add:
   `CNAME   intake   johnmize.github.io`
4. Back in **Settings → Pages**, confirm the custom domain shows `intake.johnmizerealestate.com`, wait for the DNS check, then tick **Enforce HTTPS**.

The form now works in preview mode at the live address.

### B. Google backend (when the dedicated Gmail exists)

1. Signed in as the dedicated Gmail account, create a Google Sheet named **Intake Tracker**.
2. In the sheet: **Extensions → Apps Script**.  Delete the starter code and paste in all of `apps-script/Code.gs`.
3. Edit the `CONFIG` block at the top: `NOTIFY_TO` (where your copy goes) and `REPLY_TO` (where client replies go).  Save.
4. Choose `testSend` in the function dropdown and click **Run**.  Approve the permissions prompt (it will warn that the app is unverified, which is normal for your own script: *Advanced → Go to project*).  You should get a test email and see a row on the **Intake** tab.
5. **Deploy → New deployment → Select type: Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, then copy the **Web app URL** (ends in `/exec`).
6. In `index.html`, set `endpoint: "https://script.google.com/macros/s/.../exec"` and commit.

Done.  Submit a real test from your phone.

### Optional

- **Booking:** set `bookingUrl` in `index.html` to a Calendly or Microsoft Bookings link; a "Pick a time to meet" link appears on the thank-you screen.

---

## Maintenance notes

- **Changing questions:** edit `index.html`.  New questions automatically become new columns in the sheet (added on the right).  Renaming a question's `name` starts a new column; the old one stays for history.
- **Editing the script later:** after changing `Code.gs`, use **Deploy → Manage deployments → Edit → Version: New version**.  This keeps the same `/exec` URL.  A *New deployment* gives a new URL and you'd have to update `index.html`.
- **Email builders exist in two places:** `johnEmail` and `clientEmail` are in both `index.html` (for the preview) and `Code.gs` (for real sends).  Keep them identical.
- **Limits:** free Gmail can send about 100 emails a day through Apps Script.  Each submission uses 2.  The script also ignores anything past 20 submissions an hour, and a hidden honeypot field drops most bots.
- **Data:** answers live in your Gmail (sent mail) and the Google Sheet.  Nothing is stored by GitHub.
