const YEAR = new Date().getFullYear()

export default {
  readMore: null,
  postFooter: (
    <iframe
      src="https://yiksanchan.substack.com/embed"
      width="100%"
      height="200"
      style={{ border: "1px solid #EEE", background: "white" }}
      frameBorder="0"
      scrolling="no"
    ></iframe>
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
