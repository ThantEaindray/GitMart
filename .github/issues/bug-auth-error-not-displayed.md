---
name: Bug report
about: Auth error message not displayed on wrong credentials
title: '[BUG] Login error message (#warningCard) not shown on invalid credentials'
labels: bug
assignees: ''
---

## Describe the bug

When a user submits the login form with a wrong username or password, the `#warningCard` element does not become visible. The error from the server (404 User not found / 401 Wrong password) is not surfaced to the user in the expected warning element.

Discovered via E2E test: `Authentication › wrong credentials show an error message`

## Steps to reproduce

1. Go to `/html/login.html`
2. Enter a username that does not exist (e.g. `nobody`)
3. Enter any password (e.g. `wrongpass`)
4. Click the **Login** button
5. Observe whether `#warningCard` becomes visible

## Expected behaviour

`#warningCard` should lose its `d-none` class and display the server error message (e.g. "User not found.").

## Actual behaviour

`#warningCard` remains hidden (`d-none`). The user receives no visual feedback that login failed.

## Screenshots

<!-- Attach screenshot of the login form after submitting wrong credentials -->

## Environment

- Browser: Chromium (Playwright)
- Page: `/html/login.html`
- File to investigate: `public/js/loginUser.js` — check how the 404/401 response is handled and whether `#warningCard` `d-none` is removed
