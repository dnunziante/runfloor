import type { QuoteInputs } from "./quote-calculator.ts";
export function quoteReadiness(quote: QuoteInputs, priceProvided: boolean, confirmed: boolean, finance?: { downPayment: number; apr: number; acquisitionCostRate: number; termMonths: number }) {
 if (!priceProvided) return "Price not provided. Enter a verified vehicle price.";
 if (Object.values(quote).some(value => !Number.isFinite(value) || value < 0)) return "Enter valid, non-negative amounts in every deal field.";
 if (quote.vehiclePrice <= 0) return "A customer quote requires a vehicle price greater than zero.";
 if (quote.tradeIn + quote.discount > quote.vehiclePrice + quote.accessories + quote.docFees) return "Trade-in and discount exceed the subtotal. Review the deal amounts.";
 if (finance && (Object.values(finance).some(value => !Number.isFinite(value) || value < 0) || finance.termMonths < 1 || finance.apr > 100 || finance.acquisitionCostRate > 100)) return "Enter valid financing amounts, APR, acquisition rate, and loan term.";
 if (finance && finance.downPayment > (quote.vehiclePrice + quote.accessories + quote.docFees - quote.tradeIn - quote.discount + quote.salesTax + quote.extendedWarranties + quote.tagTitleDmvFee + quote.destination + quote.delivery) * (1 + finance.acquisitionCostRate / 100)) return "Down payment exceeds the deal amount including acquisition cost.";
 if (!confirmed) return "Review and confirm the price, taxes, fees, and any financing terms before saving or sharing.";
 return "";
}
