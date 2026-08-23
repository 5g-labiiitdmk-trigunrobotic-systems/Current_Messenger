// FILE PURPOSE: Expo's "dynamic config" file — evaluated alongside (and
// layered on top of) app.json at prebuild/bundle time. This project's
// static app.json stays the source of truth for everything else; this
// file only exists to stamp the actual git commit the config was
// evaluated against into extra.gitCommit, read on-device via
// expo-constants (see the Settings screen). Computed here — at
// prebuild/bundle time, from whatever's actually checked out on disk —
// rather than hand-maintained, so it can't itself go stale the way a
// manually-updated version string could; if this doesn't match
// origin/main's HEAD, the local checkout that fed a given build is the
// thing to check first, not this file.
const { execSync } = require('child_process');

// getGitCommit(): reads the short commit SHA (and whether the working
// tree is dirty) of this repo at config-evaluation time, so a build can
// always be traced back to the exact source it was produced from.
function getGitCommit() {
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
    const dirty = execSync('git status --porcelain', { cwd: __dirname }).toString().trim().length > 0;
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return 'unknown';
  }
}

// `config` here is app.json's already-loaded `expo` object (Expo's own
// documented dynamic-config pattern) — not re-read from disk, so there's
// no risk of this diverging from what app.json actually says.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    gitCommit: getGitCommit(),
  },
});
