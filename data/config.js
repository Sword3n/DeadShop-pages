/* Where the DeadShop server lives.
 *
 * Leave `server` empty when the server serves the site itself (the usual
 * case on the Windows laptop: one address, both the pages and the API).
 *
 * Put a full origin here when the site is published somewhere else — for
 * example the static copy on GitHub Pages talking to the laptop over a
 * tunnel. The address has to end without a slash.
 *
 *   window.DSCONFIG = { server: 'https://example.tunnel.link' };
 *
 * The file is tiny on purpose: it is the only file that changes when the
 * site moves, and the rest of the app never needs to know.
 */
window.DSCONFIG = {
  server: ''
};
