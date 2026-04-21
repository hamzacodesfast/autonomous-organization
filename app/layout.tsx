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

function configuredValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.startsWith("PLACEHOLDER_")) {
    return null;
  }

  return trimmed;
}

function socialItems() {
  const xAccountId = configuredValue(process.env.X_ACCOUNT_ID);
  const instagramAccountId = configuredValue(process.env.INSTAGRAM_ACCOUNT_ID);
  const tiktokAccountId = configuredValue(process.env.TIKTOK_ACCOUNT_ID);
  const pumpfunProfileUrl = configuredValue(process.env.PUMPFUN_PROFILE_URL);

  return [
    xAccountId
      ? {
          href: `https://x.com/${xAccountId.replace(/^@/, "")}`,
          label: "X",
        }
      : null,
    instagramAccountId
      ? {
          href: `https://www.instagram.com/${instagramAccountId.replace(/^@/, "")}`,
          label: "Instagram",
        }
      : null,
    tiktokAccountId
      ? {
          href: `https://www.tiktok.com/@${tiktokAccountId.replace(/^@/, "")}`,
          label: "TikTok",
        }
      : null,
    pumpfunProfileUrl
      ? {
          href: pumpfunProfileUrl,
          label: "Pump.fun",
        }
      : null,
  ].filter((item): item is { href: string; label: string } => Boolean(item));
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const socialNavItems = socialItems();

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
          <div className="footer-links">
            <nav aria-label="Policy navigation">
              {footerItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            {socialNavItems.length > 0 ? (
              <nav aria-label="Social navigation">
                {socialNavItems.map((item) => (
                  <a key={item.href} href={item.href} target="_blank" rel="noreferrer">
                    {item.label}
                  </a>
                ))}
              </nav>
            ) : null}
          </div>
        </footer>
      </body>
    </html>
  );
}
