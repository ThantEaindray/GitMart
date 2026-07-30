// purchaseState.js
// In-memory sets that track which products and listings have been purchased
// within the current server process. Resets on server restart (demo data only).

const soldProductIds = new Set();
const soldListingIds = new Set();

// ── Private helper ────────────────────────────────────────────────────────

function getPurchasedIds(items) {
  return (items || []).reduce(
    (ids, item) => {
      const isOneOff = Boolean(item.isOneOff || item.listingId);
      const productId = item.productId ?? (!isOneOff ? item.id : null);
      const listingId = item.listingId ?? (isOneOff ? item.id : null);
      if (productId != null) ids.productIds.add(String(productId));
      if (listingId != null) ids.listingIds.add(String(listingId));
      return ids;
    },
    { productIds: new Set(), listingIds: new Set() },
  );
}

// ── Exports ───────────────────────────────────────────────────────────────

module.exports.markPurchasedItemsSold = (items = []) => {
  const { productIds, listingIds } = getPurchasedIds(items);
  productIds.forEach((id) => soldProductIds.add(id));
  listingIds.forEach((id) => soldListingIds.add(id));
};

module.exports.isProductSold = (id) => soldProductIds.has(String(id));

module.exports.isListingSold = (id) => soldListingIds.has(String(id));
