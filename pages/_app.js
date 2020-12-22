import "nextra-theme-blog/style.css"
import Head from "next/head"
import Prism from 'prism-react-renderer/prism'

(typeof global !== "undefined" ? global : window).Prism = Prism
require('prismjs/components/prism-scala')

export default function Nextra({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="RSS"
          href="/rss.xml"
        />
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-3LVTK6B002"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-3LVTK6B002');
          `,
          }}
        />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
