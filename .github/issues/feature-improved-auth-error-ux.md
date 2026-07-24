---
name: Feature request
about: Improve login error feedback with clear, persistent error messages
title: '[FEATURE] Improve auth error UX — persistent inline error messages on login failure'
labels: enhancement
assignees: ''
---

## Problem statement

When login fails (wrong password, user not found), the current implementation either shows nothing visible or relies on a toast notification that disappears after a few seconds. Users have no persistent feedback explaining why login failed or what to do next.

Related bug: `#warningCard` is not reliably shown on login failure (`[BUG] Login error message not shown on invalid credentials`).

## Proposed solution

- Show a persistent inline error message directly below the form (using `#warningCard`) whenever the server returns 4xx on login
- Include the specific reason: "User not found" vs "Incorrect password"
- Clear the error when the user starts typing again
- Add `aria-live="polite"` to `#warningCard` so screen readers announce the error

## Alternatives considered

- Toast notification: dismissed too quickly, not accessible
- Browser `alert()`: intrusive and blocks interaction

## Additional context

The `#warningCard` element already exists in `login.html` and has appropriate styling — it just needs to be correctly wired up in `loginUser.js` to handle 401/404 responses from `POST /api/login`.
