import { formatPrice } from "./format";
import type { LeadSource, Listing, Locality } from "./types";

// Share kit: every link carries a source tag so the leads inbox can attribute each enquiry.
export function sharePath(path: string, source: LeadSource): string {
  return `${path}?src=${source.toLowerCase()}`;
}

// Print-ready Telugu newspaper classified. The listing code lets readers find it on the site.
export function classifiedText(listing: Listing, locality: Locality | undefined): string {
  const monthly = listing.category === "RENTAL" || listing.category === "COMMERCIAL";
  const price = `${formatPrice(listing.price, listing.category)}${monthly ? "/నెల" : ""}`;
  const area = listing.areaSqyd ? `${listing.areaSqyd} చ.గ.` : listing.areaSqft ? `${listing.areaSqft} చ.అ.` : "";
  const parts = [locality?.name.te, listing.title.te, area, price].filter(Boolean);
  return `${parts.join(", ")}. కోడ్ ${listing.code}. చిరునామాలో చూడండి, QR స్కాన్ చేయండి.`;
}
