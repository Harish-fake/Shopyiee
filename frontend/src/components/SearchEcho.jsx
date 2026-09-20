/**
 * Renders the "Results for …" line on the search results page.
 *
 * The search API returns the echoed term in a presentation-ready form and this
 * component inserts it as markup.  The server is responsible for making that
 * value safe to render; see docs/security-testing.md for how the two server
 * implementations differ.
 */
export default function SearchEcho({ html }) {
  return (
    <span
      className="search-echo"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html ?? '' }}
    />
  );
}
