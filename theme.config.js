const YEAR = new Date().getFullYear()

export default {
  postFooter: (
    <div
      id="cusdis_thread"
      data-host="https://yiksanchan-cusdis.vercel.app"
      data-app-id="4701644f-ed94-41d5-9c2b-4a2a630dec30"
      data-page-id="{{ PAGE_ID }}"
      data-page-url="{{ PAGE_URL }}"
      data-page-title="{{ PAGE_TITLE }}"
    />
  ),
  footer: (
    <small style={{ display: "block", marginTop: "8rem" }}>
      <time>{YEAR}</time> © Yik San Chan. Built with{" "}
      <a href="https://vercel.com/">Vercel</a> and{" "}
      <a href="https://nextra.vercel.app/">Nextra</a>.
      <style
        dangerouslySetInnerHTML={{
          __html: `
      @media screen and (max-width: 480px) {
        article { 
          padding-top: 2rem;
          padding-bottom: 4rem;
        }
      }`,
        }}
      />
    </small>
  ),
}
