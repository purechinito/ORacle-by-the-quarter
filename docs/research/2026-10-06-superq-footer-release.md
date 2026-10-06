# Super Q company footer

User approved the footer design based on https://www.superq.ph and requested implementation.

The shared workspace footer and standard Frappe `footer_powered.html` include now use the Ngosiok Marketing logo, Super Q ERP name, company tagline, website link and current copyright year. Styling follows the company website's charcoal/slate background, red accent and Inter typography. The logo is served from the ERP's own assets; Inter uses the existing Frappe font asset. Existing process notes remain on accounting review and migration pages.

## Release

- Implementation commit: `5693bf4`.
- Published to `https://erp.superq.ph` on 2026-10-06.
- Previous image: `superq-erp:6e767bf92e3dee49`.
- New image: `superq-erp:2ace75a3c34a430a`.
- Footer-only overlay preserved the existing sales-entry patch, credit logic and installation hooks.
- Database/files backup completed and uploaded to the existing private backup bucket before activation.
- Rollback configuration and affected build files: `/opt/superq-erp/backups/footer-release-20261006T061411Z` on the server. Keep this private; it contains deployment configuration.
- Backend, frontend, websocket, both workers and scheduler were recreated; website and application caches were cleared. Backend health passed.

## Verification

- TypeScript/Vite production build passed.
- Independent integration review checked installed-app template precedence and Frappe website CSS hooks.
- Published JavaScript, CSS, footer stylesheet and logo all returned HTTP 200 and matched local SHA-256 hashes.
- Live sales workspace, accounting review and migration pages display the new footer.
- Production `frappe.render_template` resolved the standard footer include to the new company markup and rendered the copyright year successfully.
- Desktop and 390px phone layouts verified visually; no horizontal overflow at phone width and logo loaded correctly.
- Link points to `https://www.superq.ph/` with an accessible new-tab label.
- Local evidence: `.runtime/superq-footer-live-desktop.png` and `.runtime/superq-footer-live-mobile.png` (not committed).

Scope is the footer. Native Desk branding, email templates and existing footer visibility rules on login/password pages are unchanged.
