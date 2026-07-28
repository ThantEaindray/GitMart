---
name: Feature request
about: Let buyers view a seller's public profile and see aggregated reviews across all their listings
title: '[FEATURE] Public seller profile page with aggregated reviews'
labels: enhancement
assignees: ''
---

## Problem statement

Buyers currently have no way to evaluate a seller beyond a single listing. There is no publicly viewable seller profile, and reviews left on individual listings (added in #46) are siloed — you can only see them if you already know which listing to visit. This makes it hard to build trust with unfamiliar sellers.

## Proposed solution

**1. Public seller profile page** (`/html/seller.html?id=<userId>`)

Display a seller's public identity and track record:

- Username, member-since date, listing count
- Grid of their active listings (reuses the existing listings card component)
- Aggregated reviews section: all reviews left across every listing they own, with the listing title as context

**2. Clickable seller name on listing detail**

On `listing.html`, make the seller's name a link that navigates to their profile page. Buyers can discover a seller's profile naturally while browsing.

**3. New API endpoints**

| Method | Endpoint                     | Auth | Description                                                                  |
| ------ | ---------------------------- | ---- | ---------------------------------------------------------------------------- |
| GET    | `/api/users/:userId/public`  | none | Returns username, created_on, listing count                                  |
| GET    | `/api/users/:userId/reviews` | none | Returns all reviews across that seller's listings, joined with listing title |

The existing `GET /api/listings/owner/:ownerId` endpoint already returns the seller's active listings, so no new query is needed there.

## Acceptance criteria

- [ ] Navigating to `/html/seller.html?id=<userId>` shows the seller's username, join date, and active listings
- [ ] The page shows all reviews received on the seller's listings, grouped or sorted by listing title
- [ ] Clicking the seller name on a listing detail page navigates to their profile
- [ ] Unauthenticated users can view the profile (public, no token required)
- [ ] If the seller has no listings or no reviews, appropriate empty-state messages are shown
- [ ] At least 3 Playwright E2E tests cover the seller profile feature

## Alternatives considered

- Extending the existing `profile.html` — rejected because profile.html is the logged-in user's own account settings page; a separate `seller.html` keeps concerns clean
- Showing reviews inline on each listing card in the grid — too noisy; a dedicated section on the profile is cleaner

## Additional context

Depends on the listing reviews feature (#46). The aggregated reviews query will join `listing_reviews`, `listings`, and `users` tables.
