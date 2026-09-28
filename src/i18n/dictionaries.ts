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
