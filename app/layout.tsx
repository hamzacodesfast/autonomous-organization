import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://autonomousorganization.io"),
  title: "Autonomous Organization",
  description: "Issued goods and operational records.",
  icons: {
    icon: "/social/ao-avatar-1080x1080.png",
    apple: "/social/ao-avatar-1080x1080.png",
  },
  openGraph: {
    title: "Autonomous Organization",
    description: "Issued goods and operational records.",
    images: [
      {
        url: "/social/ao-share-banner-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Autonomous Organization Local No. 001",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Autonomous Organization",
    description: "Issued goods and operational records.",
    images: ["/social/ao-share-banner-1200x630.png"],
  },
};

const navItems = [
  { href: "/", label: "Current" },
  { href: "/locals/001", label: "Local 001" },
  { href: "/archive", label: "Archive" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/contact", label: "Contact" },
];

const footerItems = [
  { href: "/shipping", label: "Shipping" },
  { href: "/returns", label: "Returns" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="mark" href="/" aria-label="Autonomous Organization home">
            <span>AUTONOMOUS</span>
            <span>ORGANIZATION</span>
            <span>LOCAL NO. 001</span>
          </Link>
          <nav aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>The Organization maintains its members. The members maintain the Organization.</p>
          <nav aria-label="Policy navigation">
            {footerItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </footer>
      </body>
    </html>
  );
}
