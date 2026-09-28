import { lang } from "next/root-params";
import { notFound } from "next/navigation";

// Telugu-first. Telugu strings are drafts to be checked with local users before launch.

const en = {
  brand: "Chirunama",
  tagline: "Your next address, verified.",
  nav: { search: "Search", post: "Post a property", brokers: "For brokers" },
  switchTo: "తెలుగు",
  home: {
    heroTitle: "Buy, sell and rent property in the Tricity",
    heroBody: "Verified listings in Warangal, Hanamkonda and Kazipet. Contact owners and brokers directly on WhatsApp.",
    browse: "Browse by category",
    localities: "Popular localities",
    latest: "Latest listings",
  },
  categories: { RENTAL: "Rent", SALE: "Buy", PLOT: "Plots", COMMERCIAL: "Commercial" },
  filters: {
    title: "Filters",
    category: "Category",
    any: "Any",
    locality: "Locality",
    minPrice: "Min price (₹)",
    maxPrice: "Max price (₹)",
    bhk: "BHK",
    furnishing: "Furnishing",
    ownerOnly: "Owner only",
    verifiedOnly: "Verified only",
    apply: "Search",
    results: (n: number) => `${n} ${n === 1 ? "property" : "properties"}`,
    none: "No properties match these filters yet. Save this search to get a WhatsApp alert.",
  },
  furnishing: { UNFURNISHED: "Unfurnished", SEMI: "Semi-furnished", FULL: "Fully furnished" },
  lister: { OWNER: "Owner", BROKER: "Broker" },
  badges: {
    OWNER_VERIFIED: "Owner verified",
    VERIFIED_BROKER: "Verified Broker",
    DOCUMENTS_CHECKED: "Documents checked",
    SITE_VISITED: "Site visited",
  },
  badgeDetail: (by: string, on: string) => `Checked by ${by} on ${on}`,
  listing: {
    perMonth: "/ month",
    deposit: "Deposit",
    area: "Area",
    sqft: "sq. ft",
    sqyd: "sq. yd",
    availableFrom: "Available from",
    details: "Details",
    trust: "What was checked",
    noChecks: "Not verified yet. Visit in person and ask for documents before paying anything.",
    whatsapp: "WhatsApp",
    call: "Call",
    bookVisit: "Request a visit",
    listedBy: "Listed by",
    confirmed: "Confirmed available on",
    code: "Listing code",
    enquiry: (code: string) => `Hi, I saw ${code} on Chirunama. Is it still available?`,
  },
  broker: {
    experience: (n: number) => `${n} years experience`,
    serves: "Serves",
    languages: "Languages",
    rera: "RERA",
    responds: (m: number) => `Usually replies in ${m} min`,
    listings: "Live listings",
    share: "Share this profile",
    hello: (name: string) => `Hi ${name}, I found you on Chirunama.`,
  },
  locality: {
    avgRent: "Average rent",
    avgSale: "Average sale price",
    avgPlot: "Average plot price",
    perSqft: "/ sq. ft",
    perSqyd: "/ sq. yd",
    live: "Live listings",
    sample: "Sample figures for development, not market data.",
  },
  dashboard: {
    title: "Broker dashboard",
    sample: "Sample data. Sign-in comes later; this shows Ramesh Realty's view.",
    plan: "Plan",
    stats: { newLeads: "New leads", visits: "Visits booked", live: "Live listings", views: "Listing views" },
    pipeline: "Leads pipeline",
    stages: { NEW: "New", CONTACTED: "Contacted", VISIT_BOOKED: "Visit booked", CLOSED: "Closed" },
    sources: { INSTAGRAM: "Instagram", WHATSAPP: "WhatsApp", FACEBOOK: "Facebook", NEWSPAPER: "Newspaper", QR: "QR code", SITE: "Site" },
    visit: "Visit",
    empty: "No leads here",
    performance: "Listing performance",
    cols: { listing: "Listing", views: "Views", leads: "Leads", saves: "Saves", confirmed: "Confirmed" },
    daysAgo: (n: number) => (n === 0 ? "today" : `${n}d ago`),
    share: "Share your profile",
    shareHint: "Each link is tagged, so leads show where they came from.",
    classified: "Newspaper classified",
    copy: "Copy",
    copied: "Copied",
    reply: (name: string, code: string) => `Hi ${name}, thanks for your enquiry about ${code} on Chirunama. When would you like to visit?`,
  },
  footer: "Chirunama · Warangal · Hanamkonda · Kazipet",
};

type Dictionary = typeof en;

const te: Dictionary = {
  brand: "చిరునామా",
  tagline: "మీ తదుపరి చిరునామా, ధృవీకరించబడింది.",
  nav: { search: "వెతకండి", post: "ఆస్తి పోస్ట్ చేయండి", brokers: "బ్రోకర్ల కోసం" },
  switchTo: "English",
  home: {
    heroTitle: "ట్రైసిటీలో ఆస్తి కొనండి, అమ్మండి, అద్దెకు తీసుకోండి",
    heroBody: "వరంగల్, హనుమకొండ, కాజీపేటలో ధృవీకరించిన లిస్టింగ్‌లు. యజమానులు, బ్రోకర్లను నేరుగా WhatsAppలో సంప్రదించండి.",
    browse: "విభాగం వారీగా చూడండి",
    localities: "ప్రముఖ ప్రాంతాలు",
    latest: "తాజా లిస్టింగ్‌లు",
  },
  categories: { RENTAL: "అద్దె", SALE: "కొనుగోలు", PLOT: "ప్లాట్లు", COMMERCIAL: "వాణిజ్య" },
  filters: {
    title: "ఫిల్టర్లు",
    category: "విభాగం",
    any: "ఏదైనా",
    locality: "ప్రాంతం",
    minPrice: "కనీస ధర (₹)",
    maxPrice: "గరిష్ట ధర (₹)",
    bhk: "BHK",
    furnishing: "ఫర్నిషింగ్",
    ownerOnly: "యజమాని మాత్రమే",
    verifiedOnly: "ధృవీకరించినవి మాత్రమే",
    apply: "వెతకండి",
    results: (n: number) => `${n} ఆస్తులు`,
    none: "ఈ ఫిల్టర్లకు సరిపోయే ఆస్తులు ఇంకా లేవు. WhatsApp అలర్ట్ కోసం ఈ సెర్చ్‌ను సేవ్ చేయండి.",
  },
  furnishing: { UNFURNISHED: "ఫర్నిష్ చేయనిది", SEMI: "సెమీ ఫర్నిష్డ్", FULL: "పూర్తిగా ఫర్నిష్డ్" },
  lister: { OWNER: "యజమాని", BROKER: "బ్రోకర్" },
  badges: {
    OWNER_VERIFIED: "యజమాని ధృవీకరించబడింది",
    VERIFIED_BROKER: "ధృవీకరించిన బ్రోకర్",
    DOCUMENTS_CHECKED: "పత్రాలు తనిఖీ చేయబడ్డాయి",
    SITE_VISITED: "స్థలం సందర్శించబడింది",
  },
  badgeDetail: (by: string, on: string) => `${on}న ${by} తనిఖీ చేశారు`,
  listing: {
    perMonth: "/ నెల",
    deposit: "డిపాజిట్",
    area: "విస్తీర్ణం",
    sqft: "చ. అడుగులు",
    sqyd: "చ. గజాలు",
    availableFrom: "అందుబాటు తేదీ",
    details: "వివరాలు",
    trust: "ఏమి తనిఖీ చేశాం",
    noChecks: "ఇంకా ధృవీకరించలేదు. డబ్బు చెల్లించే ముందు స్వయంగా చూసి, పత్రాలు అడగండి.",
    whatsapp: "WhatsApp",
    call: "కాల్",
    bookVisit: "సందర్శన కోరండి",
    listedBy: "లిస్ట్ చేసినవారు",
    confirmed: "అందుబాటులో ఉందని నిర్ధారించిన తేదీ",
    code: "లిస్టింగ్ కోడ్",
    enquiry: (code: string) => `నమస్తే, చిరునామాలో ${code} చూశాను. ఇది ఇంకా అందుబాటులో ఉందా?`,
  },
  broker: {
    experience: (n: number) => `${n} సంవత్సరాల అనుభవం`,
    serves: "సేవలు అందించే ప్రాంతాలు",
    languages: "భాషలు",
    rera: "RERA",
    responds: (m: number) => `సాధారణంగా ${m} నిమిషాల్లో స్పందిస్తారు`,
    listings: "లైవ్ లిస్టింగ్‌లు",
    share: "ఈ ప్రొఫైల్‌ను షేర్ చేయండి",
    hello: (name: string) => `నమస్తే ${name}, చిరునామాలో మిమ్మల్ని చూశాను.`,
  },
  locality: {
    avgRent: "సగటు అద్దె",
    avgSale: "సగటు అమ్మకపు ధర",
    avgPlot: "సగటు ప్లాట్ ధర",
    perSqft: "/ చ. అడుగు",
    perSqyd: "/ చ. గజం",
    live: "లైవ్ లిస్టింగ్‌లు",
    sample: "డెవలప్‌మెంట్ కోసం నమూనా సంఖ్యలు, మార్కెట్ డేటా కాదు.",
  },
  dashboard: {
    title: "బ్రోకర్ డాష్‌బోర్డ్",
    sample: "నమూనా డేటా. సైన్-ఇన్ తర్వాత వస్తుంది; ఇది రమేష్ రియల్టీ వీక్షణ.",
    plan: "ప్లాన్",
    stats: { newLeads: "కొత్త లీడ్‌లు", visits: "బుక్ అయిన సందర్శనలు", live: "లైవ్ లిస్టింగ్‌లు", views: "లిస్టింగ్ వీక్షణలు" },
    pipeline: "లీడ్స్ పైప్‌లైన్",
    stages: { NEW: "కొత్తవి", CONTACTED: "సంప్రదించినవి", VISIT_BOOKED: "సందర్శన బుక్", CLOSED: "ముగిసినవి" },
    sources: { INSTAGRAM: "Instagram", WHATSAPP: "WhatsApp", FACEBOOK: "Facebook", NEWSPAPER: "వార్తాపత్రిక", QR: "QR కోడ్", SITE: "సైట్" },
    visit: "సందర్శన",
    empty: "లీడ్‌లు లేవు",
    performance: "లిస్టింగ్ పనితీరు",
    cols: { listing: "లిస్టింగ్", views: "వీక్షణలు", leads: "లీడ్‌లు", saves: "సేవ్‌లు", confirmed: "నిర్ధారణ" },
    daysAgo: (n: number) => (n === 0 ? "ఈరోజు" : `${n} రోజుల క్రితం`),
    share: "మీ ప్రొఫైల్ షేర్ చేయండి",
    shareHint: "ప్రతి లింక్‌కు ట్యాగ్ ఉంటుంది, కాబట్టి లీడ్ ఎక్కడి నుంచి వచ్చిందో తెలుస్తుంది.",
    classified: "వార్తాపత్రిక క్లాసిఫైడ్",
    copy: "కాపీ",
    copied: "కాపీ అయింది",
    reply: (name: string, code: string) => `నమస్తే ${name}, చిరునామాలో ${code} గురించి అడిగినందుకు ధన్యవాదాలు. ఎప్పుడు చూడటానికి వస్తారు?`,
  },
  footer: "చిరునామా · వరంగల్ · హనుమకొండ · కాజీపేట",
};

const dictionaries = { te, en };

export type Locale = keyof typeof dictionaries;
export const locales: Locale[] = ["te", "en"];
export const defaultLocale: Locale = "te";

export const hasLocale = (value: string): value is Locale => value in dictionaries;

export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!hasLocale(value)) notFound();
  return value;
}

export async function getDictionary() {
  return dictionaries[await getLocale()];
}
