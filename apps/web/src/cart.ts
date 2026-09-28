export function invalidateCartTotals(cart: any) {
  return cart ? { ...cart, subtotal: null, tax: null, total: null } : null;
}
export function addPartToCart(cart: any, lines: any[], part: any) {
  return {
    cart: invalidateCartTotals(cart),
    lines: lines.some((x) => x.partId === part.id)
      ? lines.map((x) => (x.partId === part.id ? { ...x, qty: x.qty + 1 } : x))
      : [
          ...lines,
          {
            partId: part.id,
            qty: 1,
            price: part.price,
            sku: part.sku,
            name: part.name,
          },
        ],
  };
}
