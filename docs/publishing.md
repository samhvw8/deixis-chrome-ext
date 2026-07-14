# Publishing

How to publish Deixis to the Chrome Web Store from the command line via `wxt submit`.

## One-time setup

### 1. Credentials file

```sh
cp .env.submit.example .env.submit   # .env.submit is gitignored
```

Fill in the four values below, then run `npm run submit`.

### 2. Where each value comes from

| Variable | Source |
|----------|--------|
| `CHROME_EXTENSION_ID` | The item's ID in the [dashboard](https://chrome.google.com/webstore/devconsole) URL (a 32-char string). Create the item once by uploading a zip manually if it does not exist yet. |
| `CHROME_CLIENT_ID` / `CHROME_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create OAuth client ID → **Desktop app**. Also enable the **Chrome Web Store API** for the project. |
| `CHROME_REFRESH_TOKEN` | Generated once from the client ID/secret via the OAuth consent flow (see below). |

### 3. Get the refresh token

Follow Google's guide: [Chrome Web Store API — using OAuth](https://developer.chrome.com/docs/webstore/using-api). In short: authorize the scope `https://www.googleapis.com/auth/chromewebstore`, exchange the returned code for tokens, and copy the `refresh_token`.

## Publish a new version

```sh
npm run submit:dry   # verify credentials without releasing
npm run submit       # zip is already built; upload + submit for review
# or in one step:
npm run release      # wxt zip && wxt submit
```

Bump the version in `package.json` and `wxt.config.ts` first — the Chrome Web Store rejects re-uploads of an existing version number.

## CI (optional)

`.github/workflows/release.yml` runs the same flow on manual dispatch. Add the four `CHROME_*` values as repository secrets (Settings → Secrets and variables → Actions), then trigger **Release** from the Actions tab.

## Related

- [../CHANGELOG.md](../CHANGELOG.md) — version history
- [architecture.md](architecture.md) — how the extension is structured
