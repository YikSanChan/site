const YEAR = new Date().getFullYear()

export default {
  footer: (
    <small style={{ display: "block", marginTop: "8rem" }}>
      <time>{YEAR}</time> © Yik San Chan.
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
