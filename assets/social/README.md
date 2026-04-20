# Autonomous Organization social assets

Source SVGs in this folder follow `docs/AUTONOMOUS_ORGANIZATION_BRAND_SPEC_v0.2.md`:

- Inter Semi Bold for the primary mark and monogram.
- JetBrains Mono for operational metadata.
- Ink black `#111111`, off-white `#F4F1EA`, and one safety orange `#FE5000` accent.
- No gradients, fake codes, robot imagery, third-party marks, or generated external imagery.

Rendered PNGs are exported to `public/social/` with:

- `ao-logo-primary-1200x630.png` - primary mark on a transparent canvas.
- `ao-avatar-1080x1080.png` - square social avatar using the approved `AO` monogram.
- `ao-profile-banner-x-1500x500.png` - X profile banner.
- `ao-share-banner-1200x630.png` - social preview/share banner.

Run `node scripts/export-social-assets.mjs` after editing any source SVG.
Run `npm run export:social` from the repository root to regenerate both `assets/social/png/` and `public/social/`.

Font source for PNG export: Inter and JetBrains Mono files already present in the Prisma package dependency. Both typefaces are open-source and approved in the brand spec.
