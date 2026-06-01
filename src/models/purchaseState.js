const soldProductIds = new Set();
const soldListingIds = new Set();

function getPurchasedIds(items = []) {
  return items.reduce(
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

function markPurchasedItemsSold(items) {
  const { productIds, listingIds } = getPurchasedIds(items);

  productIds.forEach((id) => soldProductIds.add(id));
  listingIds.forEach((id) => soldListingIds.add(id));
}

function isProductSold(id) {
  return soldProductIds.has(String(id));
}

function isListingSold(id) {
  return soldListingIds.has(String(id));
}

module.exports = {
  isListingSold,
  isProductSold,
  markPurchasedItemsSold,
};
