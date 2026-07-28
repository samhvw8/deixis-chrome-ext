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

> **Set the OAuth consent screen to "In production" first.** While it is in **Testing** status, Google expires refresh tokens after 7 days regardless of what the token request asks for ([wxt#1462](https://github.com/wxt-dev/wxt/issues/1462)). The release job would then fail at its last step — after the tag is already pushed.

## Publish from your machine

```sh
bun run submit:dry   # verify credentials without releasing
bun run release      # wxt zip && wxt submit (build + submit for review)
```

Bump the version in `package.json` first — it is the single source of truth, and the Chrome Web Store rejects re-uploads of an existing version number. `wxt.config.ts` deliberately has no `version` field; WXT reads package.json.

`wxt submit` publishes **immediately and publicly** once review passes — it is not a draft. Set `CHROME_PUBLISH_TARGET=trustedTesters` for a pre-flight release.

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
npm version patch    # bumps package.json (the only version source) + tags
git push --follow-tags
```

The tag must be `vX.Y.Z` and match the manifest version, or the workflow fails the guard step before uploading anything.

The job submits with `CHROME_DEPLOY_PERCENTAGE: 10`, so a new version reaches 10% of users first. Raise it from the dashboard once it looks healthy.

If a release goes wrong, the dashboard's **Rollback** republishes the previous version under a new version number with no review, in about a minute. It also **discards any pending review submission** — so roll back *or* submit a fix, never both at once.

`.github/workflows/ci.yml` also builds and zips on every push/PR to `main` as a shippability gate.

## Related

- [../CHANGELOG.md](../CHANGELOG.md) — version history
- [architecture.md](architecture.md) — how the extension is structured
