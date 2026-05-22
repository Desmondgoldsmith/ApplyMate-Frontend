import Link from 'next/link';

const cols = [
  {
    title: 'Product',
    links: [
      { href: '#features', label: 'Features' },
      { href: '#pricing', label: 'Pricing' },
      { href: '#', label: 'Changelog' },
      { href: '#', label: 'Roadmap' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '#', label: 'About' },
      { href: '#', label: 'Blog' },
      { href: '#', label: 'Careers' },
      { href: '#', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '#', label: 'Privacy Policy' },
      { href: '#', label: 'Terms of Service' },
      { href: '#', label: 'Cookie Policy' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[rgba(0,201,177,0.08)] px-4 py-16 sm:px-6 lg:px-[8%]">
      <div className="mx-auto grid max-w-[1200px] gap-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full bg-[#00C9B1]"
              style={{ boxShadow: '0 0 10px #00C9B1' }}
            />
            <span className="text-[16px] font-bold text-white">ApplyMate</span>
          </div>
          <p className="mt-4 max-w-[220px] text-[13px] leading-relaxed text-[rgba(255,255,255,0.35)]">
            AI-powered job applications
          </p>
        </div>

        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="text-[12px] font-bold uppercase tracking-[2px] text-[#00C9B1]">
              {c.title}
            </h3>
            <ul className="mt-5 space-y-3">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[13px] text-[rgba(255,255,255,0.35)] transition-colors duration-200 hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-14 flex max-w-[1200px] flex-col items-center justify-between gap-4 border-t border-[rgba(255,255,255,0.06)] pt-6 sm:flex-row">
        <p className="text-[12px] text-[rgba(255,255,255,0.2)]">
          © 2026 ApplyMate. All rights reserved.
        </p>
        <p className="text-[12px] text-[rgba(255,255,255,0.2)]">
          Made with ApplyMate ✦
        </p>
      </div>
    </footer>
  );
}
