---
name: Bug report
about: Something management UI no longer accessible at root URL
title: '[BUG] Root URL (/) no longer serves the Something management page'
labels: bug
assignees: ''
---

## Describe the bug

All 13 Playwright E2E tests in `something-management.spec.js` fail because they navigate to `http://localhost:3001` (the root URL) and expect to find the original Something management UI (heading "ST0526 CI/CD Project", a Name form, and a table with Id/Name/Action columns). The root URL no longer serves this page — it now serves the GitMart frontend instead.

## Steps to reproduce

1. Start the server: `npm start`
2. Navigate to `http://localhost:3001`
3. Observe that the Something management UI (heading, form, table) is not present

## Expected behaviour

`http://localhost:3001` should serve `public/index.html` containing the Something management UI so that the existing `something-management.spec.js` E2E tests continue to pass.

## Actual behaviour

The root URL serves different content (GitMart homepage or a blank page), causing all 13 Something management E2E tests to fail.

## Screenshots

<!-- Attach screenshot of what http://localhost:3001 currently shows -->

## Environment

- Browser: Chromium (Playwright)
- Test file: `e2e-tests/something-management.spec.js`
- Root cause: `public/index.html` has been replaced or removed during GitMart frontend development
