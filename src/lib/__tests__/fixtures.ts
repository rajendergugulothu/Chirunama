import type { Listing, Locality } from "../types";

// Hand-built view objects for unit tests that need no database. They match the seed data.

export const madikonda: Locality = {
  slug: "madikonda",
  citySlug: "tricity",
  name: { en: "Madikonda", te: "మడికొండ" },
  avgRentPerMonth: 8500,
  avgPlotPerSqyd: 14000,
};

export const hunterRoad: Locality = {
  slug: "hunter-road",
  citySlug: "tricity",
  name: { en: "Hunter Road", te: "హంటర్ రోడ్" },
  avgRentPerMonth: 10000,
  avgSalePerSqft: 4500,
};

export const plotTC1004: Listing = {
  code: "TC-1004",
  category: "PLOT",
  propertyType: "PLOT",
  localitySlug: "madikonda",
  localityName: { en: "Madikonda", te: "మడికొండ" },
  title: { en: "200 sq. yd plot in approved layout", te: "అనుమతి పొందిన లేఅవుట్‌లో 200 చ. గజాల ప్లాట్" },
  description: { en: "Near IT park, 33 ft road, clear title.", te: "IT పార్క్ దగ్గర, 33 అడుగుల రోడ్డు." },
  price: 2800000,
  areaSqyd: 200,
  details: { surveyNumber: "123/A", layoutName: "Sri Sai Enclave", roadWidthFt: 33, approvalStatus: "Approved" },
  listerType: "OWNER",
  ownerPhone: "919000000102",
  allowBrokerContact: true,
  status: "LIVE",
  badges: [
    { type: "OWNER_VERIFIED", checkedBy: "Moderation agent", checkedOn: "2026-09-15" },
    { type: "DOCUMENTS_CHECKED", checkedBy: "[advocate partner]", checkedOn: "2026-09-22" },
    { type: "SITE_VISITED", checkedBy: "Field executive", checkedOn: "2026-09-23" },
  ],
  documentsReceived: ["TITLE", "ENCUMBRANCE", "LAYOUT_APPROVAL"],
  photos: [],
  lastConfirmedAt: "2026-09-23",
};

export const shopTC1005: Listing = {
  code: "TC-1005",
  category: "COMMERCIAL",
  propertyType: "SHOP",
  localitySlug: "hunter-road",
  localityName: { en: "Hunter Road", te: "హంటర్ రోడ్" },
  title: { en: "Ground-floor shop on Hunter Road", te: "హంటర్ రోడ్‌లో గ్రౌండ్ ఫ్లోర్ షాప్" },
  description: { en: "18 ft frontage, suits retail or clinic.", te: "18 అడుగుల ముందుభాగం, రిటైల్ లేదా క్లినిక్‌కు అనుకూలం." },
  price: 25000,
  deposit: 100000,
  areaSqft: 400,
  details: { frontageFt: 18, usageType: "Retail" },
  listerType: "BROKER",
  brokerSlug: "ramesh-realty",
  ownerPhone: "919000000001",
  allowBrokerContact: true,
  status: "LIVE",
  badges: [{ type: "VERIFIED_BROKER", checkedBy: "Ops lead", checkedOn: "2026-09-10" }],
  photos: [],
  lastConfirmedAt: "2026-09-27",
};
