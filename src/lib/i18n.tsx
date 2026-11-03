import { createContext, Fragment, useContext, useState, type ReactNode } from 'react';
import { HI } from './hi';

export type Lang = 'en' | 'hi';

const DICT = {
  en: {
    'nav.home': 'Home',
    'nav.explore': 'Explore',
    'nav.workspace': 'My workspace',
    'nav.impact': 'Impact',
    'hero.eyebrow': 'Open Creche Network · a Digital Public Good',
    'hero.title': 'Safe, quality childcare — funded, run and verified on one open network',
    'hero.sub': 'Governments say where. Certified NGOs say how. CSR funders say what. Independent auditors verify the impact.',
    'hero.cta1': 'Browse creche opportunities',
    'hero.cta2': 'View impact',
    'hero.search': 'Try: rural creches in Keonjhar under ₹20 lakh',
    'role.state': 'State Government',
    'role.state.tag': 'Define where creches are needed',
    'role.nfp': 'Certified NGO / NFP',
    'role.nfp.tag': 'Get empanelled and bid to run them',
    'role.csr': 'CSR Funder',
    'role.csr.tag': 'Find and fund verified demand',
    'role.auditor': 'Independent Auditor',
    'role.auditor.tag': 'Verify utilisation and impact',
    'role.start': 'Start as',
    'how.title': 'How it works',
    'pick.role': 'I am a…',
    'login.eyebrow': 'Welcome',
    'login.title': 'Sign in to the network',
    'login.sub': 'Choose how you want to enter. You can switch roles any time.',
    'login.role': 'I want to enter as',
  },
  hi: {
    'nav.home': 'होम',
    'nav.explore': 'खोजें',
    'nav.workspace': 'मेरा कार्यक्षेत्र',
    'nav.impact': 'प्रभाव',
    'hero.eyebrow': 'ओपन क्रेच नेटवर्क · एक डिजिटल सार्वजनिक वस्तु',
    'hero.title': 'सुरक्षित, गुणवत्तापूर्ण शिशु-देखभाल — एक खुले नेटवर्क पर वित्तपोषित, संचालित और सत्यापित',
    'hero.sub': 'सरकार तय करती है कहाँ। प्रमाणित NGO तय करते हैं कैसे। CSR दाता तय करते हैं क्या। स्वतंत्र ऑडिटर प्रभाव सत्यापित करते हैं।',
    'hero.cta1': 'क्रेच अवसर देखें',
    'hero.cta2': 'प्रभाव देखें',
    'hero.search': 'आज़माएँ: Keonjhar में ₹20 लाख से कम ग्रामीण क्रेच',
    'role.state': 'राज्य सरकार',
    'role.state.tag': 'तय करें कि क्रेच कहाँ चाहिए',
    'role.nfp': 'प्रमाणित NGO / NFP',
    'role.nfp.tag': 'पैनल में आएँ और संचालन के लिए बोली लगाएँ',
    'role.csr': 'CSR दाता',
    'role.csr.tag': 'सत्यापित माँग खोजें और फंड करें',
    'role.auditor': 'स्वतंत्र ऑडिटर',
    'role.auditor.tag': 'उपयोग और प्रभाव सत्यापित करें',
    'role.start': 'शुरू करें:',
    'how.title': 'यह कैसे काम करता है',
    'pick.role': 'मैं हूँ…',
    'login.eyebrow': 'स्वागत है',
    'login.title': 'नेटवर्क में साइन इन करें',
    'login.sub': 'चुनें कि आप किस रूप में प्रवेश करना चाहते हैं। भूमिका कभी भी बदल सकते हैं।',
    'login.role': 'मैं प्रवेश करना चाहता/चाहती हूँ',
  },
} as const;

type Key = keyof (typeof DICT)['en'];

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
  /** translate an English phrase; {name} placeholders are filled from vars. Unknown phrases stay in English. */
  tr: (en: string, vars?: Record<string, string | number>) => string;
}

const fill = (s: string, vars?: Record<string, string | number>) => (vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : s);
/** current language, read by the plain tr() helper so any component can translate without a hook */
let LANG: Lang = 'en';

export function tr(en: string, vars?: Record<string, string | number>): string {
  return fill(LANG === 'hi' ? (HI[en] ?? en) : en, vars);
}

const Ctx = createContext<LangCtx>({ lang: 'en', setLang: () => {}, t: (k) => DICT.en[k], tr: (en, vars) => fill(en, vars) });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return localStorage.getItem('oc-lang') === 'hi' ? 'hi' : 'en';
    } catch {
      return 'en';
    }
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('oc-lang', l);
    } catch {
      /* ignore */
    }
  };
  LANG = lang;
  // remount the tree when the language flips so every string, not just the header, switches
  return <Ctx.Provider value={{ lang, setLang, t: (k) => DICT[lang][k], tr }}><Fragment key={lang}>{children}</Fragment></Ctx.Provider>;
}

export const useT = () => useContext(Ctx);
