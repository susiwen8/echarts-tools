# Release

`echarts-terminal` publishes to npm through the repo-root GitHub Actions workflow:

- `.github/workflows/publish-echarts-terminal.yml`

## One-time setup

1. Create an npm automation/granular token that can publish `echarts-terminal`.
2. Add it to the GitHub repository secrets as `NPM_TOKEN`.
3. Optional but recommended:
   - protect the `echarts-terminal-v*` tag pattern
   - add required reviewers or an environment before publish

## Publish a new version

From `echarts-terminal/`:

```bash
npm version patch --no-git-tag-version
```

Or replace `patch` with `minor` / `major`, then commit the version bump.

Create and push the release tag from the repo root:

```bash
VERSION=$(node -p "require('./echarts-terminal/package.json').version")
git tag -a "echarts-terminal-v$VERSION" -m "echarts-terminal v$VERSION"
git push origin main
git push origin "echarts-terminal-v$VERSION"
```

The workflow will:

1. install dependencies
2. verify the tag version matches `package.json`
3. run `npm run smoke:contract`
4. run `node test/node/npm-publish-contract.mjs`
5. run `npm pack --dry-run`
6. publish to npm

For public repositories the workflow uses `npm publish --provenance --access public`.

For private repositories the workflow falls back to `npm publish --access public`, because npm currently rejects GitHub Actions provenance bundles from private source repositories.

## Why this uses `NPM_TOKEN`

The npm docs currently recommend trusted publishing when possible, but `npm trust` requires the package to already exist on the npm registry. `echarts-terminal` is not published yet, so the first release still needs a publish token. After the package exists, you can migrate this workflow to npm trusted publishing if you want token-free releases.
