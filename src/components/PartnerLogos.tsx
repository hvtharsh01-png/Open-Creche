import { useState } from 'react';
import { cn } from './ui';

/**
 * Official logos are NOT bundled. Drop the permitted files into public/partners/ using these names and they appear
 * on the login page and in the footer. A logo whose file is missing is simply not shown.
 */
const LOGOS = [
  { name: 'mwcd', alt: 'Ministry of Women and Child Development' },
  { name: 'palna', alt: 'Palna scheme' },
] as const;

const EXTS = ['png', 'svg', 'jpg'] as const;

function Logo({ name, alt, onFound, className }: { name: string; alt: string; onFound: () => void; className?: string }) {
  const [i, setI] = useState(0);
  const [ok, setOk] = useState(false);
  if (i >= EXTS.length) return null;
  return (
    <img
      src={`/partners/${name}.${EXTS[i]}`}
      alt={alt}
      className={cn('w-auto object-contain', ok ? className : 'hidden')}
      onLoad={() => {
        setOk(true);
        onFound();
      }}
      onError={() => setI((n) => n + 1)}
    />
  );
}

export function PartnerLogos({ variant = 'light', className }: { variant?: 'light' | 'plain'; className?: string }) {
  const [found, setFound] = useState<Record<string, boolean>>({});
  const any = Object.values(found).some(Boolean);
  return (
    <div className={cn(!any && 'hidden', className)}>
      <div className={cn('mb-2 text-[10px] font-bold uppercase tracking-widest', variant === 'light' ? 'text-white/60' : 'text-muted')}>In partnership with</div>
      <div className={cn('flex flex-wrap items-center gap-4', variant === 'light' && 'rounded-2xl bg-white/90 p-3')}>
        {LOGOS.map((l) => (
          <Logo key={l.name} name={l.name} alt={l.alt} className="h-12" onFound={() => setFound((s) => (s[l.name] ? s : { ...s, [l.name]: true }))} />
        ))}
      </div>
    </div>
  );
}
