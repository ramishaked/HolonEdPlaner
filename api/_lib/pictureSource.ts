/**
 * Where "התמונה החינוכית" (the school's tech-matriculation picture) lives.
 *
 * The page is the Holon tech dashboard's school view, a separate single-file app on
 * GitHub Pages. The Planner embeds it in an iframe with `?embed`, in which mode the
 * page never reads its data source itself: it waits for the Planner to hand it the
 * data (see api/_lib/picture.ts and src/components/PictureView.tsx).
 *
 * Shared by the browser and the server, like schoolIdentity.ts, so the two cannot
 * drift: the server reads the tab list from this page, the browser frames it.
 */
export const PICTURE_PAGE_URL = 'https://ramishaked.github.io/HolonTechDeshboard/';

/** The origin the embedded page posts its messages from. */
export const pictureOrigin = (pageUrl: string = PICTURE_PAGE_URL): string => new URL(pageUrl).origin;
