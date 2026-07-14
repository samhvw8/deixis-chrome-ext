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

## Publish from your machine

```sh
bun run submit:dry   # verify credentials without releasing
bun run release      # wxt zip && wxt submit (build + submit for review)
```

Bump the version in **both** `package.json` and `wxt.config.ts` first — the Chrome Web Store rejects re-uploads of an existing version number.

## Auto-publish via CI/CD (recommended)

Pushing a version tag triggers `.github/workflows/release.yml`, which builds, verifies the tag matches the manifest version, submits to the store, and cuts a GitHub Release.

### One-time: add repository secrets

Settings → Secrets and variables → Actions → New repository secret, for each:

| Secret | Value |
|--------|-------|
| `CHROME_EXTENSION_ID` | same as `.env.submit` |
| `CHROME_CLIENT_ID` | same as `.env.submit` |
| `CHROME_CLIENT_SECRET` | same as `.env.submit` |
| `CHROME_REFRESH_TOKEN` | same as `.env.submit` |

### Release

```sh
# bump versions in package.json + wxt.config.ts, commit, then:
git tag v0.6.1
git push --follow-tags
```

The tag must be `vX.Y.Z` and match the manifest version, or the workflow fails the guard step before uploading anything.

`.github/workflows/ci.yml` also builds and zips on every push/PR to `main` as a shippability gate.

## Related

- [../CHANGELOG.md](../CHANGELOG.md) — version history
- [architecture.md](architecture.md) — how the extension is structured
