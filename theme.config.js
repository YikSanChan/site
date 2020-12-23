const YEAR = new Date().getFullYear()

export default {
  footer: (
    <div>
      <section id="comments">
        <h4>
          <a href="">Comments</a>
        </h4>
        <script
          src="https://utteranc.es/client.js"
          repo="YikSanChan/yiksanchan.com"
          issue-term="pathname"
          label="comments"
          theme="github-light"
          crossorigin="anonymous"
          async
        />
      </section>
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
    </div>
  ),
}
