import type { Metadata } from "next";
import SiteChrome from "./SiteChrome";

import "../public/css/normalize.css";
import "../public/css/webflow.css";
import "../public/css/naveeds-spectacular-site-2d50fd.webflow.css";

export const metadata: Metadata = {
  title: "N11 PICTURES",
  description: "Creating award-winning films and music videos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html 
      lang="en" 
      data-wf-page="67448431fea0f748c29a1db5" 
      data-wf-site="67448431fea0f748c29a1d66" 
    >
      <body style={{ margin: 0, padding: 0 }}>
        <SiteChrome />
        {children}
      </body>
    </html>
  )
}