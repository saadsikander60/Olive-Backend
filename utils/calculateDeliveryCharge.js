/**
 * Pakistan delivery charges for Olive.
 * Peshawar: PKR 200
 * Anywhere else: PKR 350
 */
export const calculateDeliveryCharge = (city = "") => {
  const normalized = String(city || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (normalized === "peshawar") {
    return 200;
  }

  return 350;
};
