import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number into a currency string.
 * @param amount The number to format.
 * @param currency The currency code (e.g., "USD").
 * @returns A formatted currency string.
 */
export function formatCurrency(amount: number, currency: string = "USD") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(amount);
}
