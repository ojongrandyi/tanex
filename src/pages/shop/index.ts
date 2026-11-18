// The public shop pages, one lazy chunk (SHOP_SPEC §16): App.tsx imports this module only when a
// shop page opens. The gallery viewer is a further chunk, fetched on its first tap.
export { ShopPage } from './ShopPage';
export { ProductPage, ProductView } from './ProductPage';
