/**
 * Old URLs that moved. Next.js carries the original query string over to the destination, so
 * `/review?status=rejected` lands on `/training/review?status=rejected`.
 */
export const LEGACY_REDIRECTS = [{ source: "/review", destination: "/training/review", permanent: true }];
