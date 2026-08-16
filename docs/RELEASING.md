# Releasing

## First release

1. Run `npm run quality`.
2. Inspect `npm pack --dry-run --json` and install the tarball in a clean temporary project.
3. Authenticate interactively with `npm login`; never commit an npm token.
4. Publish `npm publish`.
5. Verify a clean install from the public registry.
6. Tag `v0.1.0` and create the matching GitHub release.

## Future releases

Trusted publishing uses `.github/workflows/release.yml`, GitHub-hosted Node 24, npm 11.5.1+, and OIDC. Configure npm's trusted publisher with:

- GitHub user: `zyadsherif`
- Repository: `receipt-verifier`
- Workflow: `release.yml`
- Allowed action: `npm publish`

Then create a reviewed version/changelog commit and push its matching `v*` tag. The workflow reruns quality checks before publishing with provenance.
