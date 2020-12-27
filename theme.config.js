const YEAR = new Date().getFullYear()

export default {
  footer: (
    <small style={{ display: "block", marginTop: "8rem" }}>
      <time>{YEAR}</time> © Yik San Chan. Built with <a href="https://vercel.com/">Vercel</a> and <a href="https://nextra.vercel.app/">Nextra</a>.
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
