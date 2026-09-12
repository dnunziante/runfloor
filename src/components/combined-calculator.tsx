"use client";

import Link from "next/link";
import { Calculator, Check, FileDown, Mail, Printer, RotateCcw, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { calculatePricing } from "@/lib/pricing-calculator";
import { calculateQuote, type QuoteInputs } from "@/lib/quote-calculator";
import type { ProductDTO } from "@/lib/products/types";
import type { OrganizationLocation } from "@/lib/locations";

const blankQuote: QuoteInputs = { vehiclePrice: 0, accessories: 0, docFees: 0, tradeIn: 0, discount: 0, salesTax: 0, extendedWarranties: 0, tagTitleDmvFee: 0, destination: 0, delivery: 0 };
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const terms = [24, 36, 48, 60, 72, 84];

export function CombinedCalculator({ vehicles, accessories, warranties, locations }: { vehicles: ProductDTO[]; accessories: ProductDTO[]; warranties: ProductDTO[]; locations: OrganizationLocation[] }) {
  const firstVehicle = vehicles[0];
  const [quote, setQuote] = useState<QuoteInputs>(() => ({ ...blankQuote, vehiclePrice: firstVehicle?.price || 0 }));
  const [vehicleId, setVehicleId] = useState(firstVehicle?.id || "manual");
  const [accessoryIds, setAccessoryIds] = useState<string[]>([]);
  const [warrantyIds, setWarrantyIds] = useState<string[]>([]);
  const [locationId, setLocationId] = useState("manual");
  const [destinationType, setDestinationType] = useState<"tp" | "rr">("tp");
  const [tradeDescription, setTradeDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [downPayment, setDownPayment] = useState(0);
  const [apr, setApr] = useState(0);
  const [termMonths, setTermMonths] = useState(60);
  const [acquisitionCostRate, setAcquisitionCostRate] = useState(0);
  const [mode, setMode] = useState<"cash" | "finance">("cash");
  const [saved, setSaved] = useState(false);
  const selectedLocation = locations.find((location) => location.id === locationId);
  const hasAutomaticTax = Boolean(selectedLocation && selectedLocation.salesTaxRate > 0);
  const baseResult = useMemo(() => calculateQuote(quote), [quote]);
  const tax = hasAutomaticTax && selectedLocation ? Math.round(baseResult.subtotal * selectedLocation.salesTaxRate) / 100 : quote.salesTax;
  const finalQuote = hasAutomaticTax ? { ...quote, salesTax: tax } : quote;
  const result = calculateQuote(finalQuote);
  const financing = calculatePricing({ totalFinanced: result.totalDelivered, downPayment, acquisitionCostRate, apr, termMonths });
  const selectedVehicle = vehicles.find((item) => item.id === vehicleId);
  const update = (key: keyof QuoteInputs, value: number) => setQuote((current) => ({ ...current, [key]: Math.max(0, value || 0) }));

  function selectVehicle(id: string) { setVehicleId(id); const vehicle = vehicles.find((item) => item.id === id); if (vehicle) update("vehiclePrice", vehicle.price); }
  function toggleProduct(id: string, kind: "accessory" | "warranty") {
    const selected = kind === "accessory" ? accessoryIds : warrantyIds;
    const products = kind === "accessory" ? accessories : warranties;
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    if (kind === "accessory") setAccessoryIds(next); else setWarrantyIds(next);
    update(kind === "accessory" ? "accessories" : "extendedWarranties", products.filter((item) => next.includes(item.id)).reduce((sum, item) => sum + item.price, 0));
  }
  function chooseLocation(id: string) {
    setLocationId(id); const location = locations.find((item) => item.id === id);
    if (location) setQuote((current) => ({ ...current, destination: destinationType === "tp" ? location.tpDestinationFee : location.rrDestinationFee, delivery: location.deliveryFee }));
  }
  function reset() { setQuote({ ...blankQuote, vehiclePrice: firstVehicle?.price || 0 }); setVehicleId(firstVehicle?.id || "manual"); setAccessoryIds([]); setWarrantyIds([]); setLocationId("manual"); setDestinationType("tp"); setTradeDescription(""); setNotes(""); setDownPayment(0); setApr(0); setTermMonths(60); setAcquisitionCostRate(0); setSaved(false); }
  const summary = `${selectedVehicle?.name || "Custom vehicle"}\nTotal delivered: ${money(result.totalDelivered)}\nEstimated payment: ${money(financing.monthlyPayment)} for ${termMonths} months at ${apr.toFixed(2)}% APR${notes ? `\nNotes: ${notes}` : ""}`;
  async function saveQuote() { localStorage.setItem("runfloor-saved-quote", JSON.stringify({ quote: finalQuote, vehicleId, accessoryIds, warrantyIds, locationId, tradeDescription, notes, downPayment, apr, termMonths, acquisitionCostRate })); await navigator.clipboard?.writeText(summary).catch(() => undefined); setSaved(true); }

  return <div className="cq">
    <nav className="cq-actions print-hide" aria-label="Quote actions"><button onClick={saveQuote}><FileDown/> {saved ? "Quote saved" : "Save quote"}</button><button onClick={() => window.print()}><Printer/> Print / PDF</button><a href={`mailto:?subject=${encodeURIComponent("RunFloor quote")}&body=${encodeURIComponent(summary)}`}><Mail/> Send to customer</a><button className="primary" onClick={reset}><RotateCcw/> New quote</button></nav>
    <section className="cq-hero"><div><span>Quote &amp; financing</span><h1>Turn Interest Into Ownership.<br/><em>Premium Style. Real Performance.</em></h1><p>Calculate total price, estimate a monthly payment, and build a professional quote in one place.</p><div><b><Calculator/> Real payments<small>Live calculations</small></b><b><FileDown/> All fees included<small>Delivered price</small></b><b><Share2/> Ready to share<small>Print or email</small></b></div></div></section>
    <div className="cq-layout">
      <div className="cq-left">
        <section className="cq-card"><header><span>1</span><div><h2>Select product</h2><p>Choose a vehicle and configuration.</p></div></header><div className="cq-fields"><label>Vehicle<select value={vehicleId} onChange={(e) => selectVehicle(e.target.value)}><option value="manual">Custom price</option>{vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.name} · {vehicle.model || "Standard"} · {money(vehicle.price)}</option>)}</select></label><label>Location<select value={locationId} onChange={(e) => chooseLocation(e.target.value)}><option value="manual">Manual fees</option>{locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label></div><Link href="/products">View full product details →</Link></section>
        <section className="cq-card"><header><span>2</span><div><h2>Customize your build</h2><p>Add published accessories and warranties.</p></div><Link href="/products">View product catalog →</Link></header><div className="cq-addons">{accessories.length ? accessories.map((item) => <label key={item.id}><input type="checkbox" checked={accessoryIds.includes(item.id)} onChange={() => toggleProduct(item.id, "accessory")}/><span>{item.name}<small>{item.model}</small></span><strong>{money(item.price)}</strong></label>) : <p>No published accessories are available.</p>}</div><details><summary>Extended warranties ({warrantyIds.length} selected)</summary><div className="cq-addons">{warranties.length ? warranties.map((item) => <label key={item.id}><input type="checkbox" checked={warrantyIds.includes(item.id)} onChange={() => toggleProduct(item.id, "warranty")}/><span>{item.name}<small>{item.model}</small></span><strong>{money(item.price)}</strong></label>) : <p>No published warranties are available.</p>}</div></details></section>
        <section className="cq-card"><header><span>3</span><div><h2>Trade-in <small>(optional)</small></h2><p>Apply a trade value to this deal.</p></div></header><div className="cq-fields"><label>Make / Model / Year<input value={tradeDescription} onChange={(e) => setTradeDescription(e.target.value)} placeholder="e.g. Club Car 2022"/></label><label>Trade-in value<input type="number" min="0" value={quote.tradeIn} onChange={(e) => update("tradeIn", Number(e.target.value))}/></label></div></section>
      </div>
      <section className="cq-card cq-deal"><header><span>4</span><div><h2>Deal details</h2><p>Add fees, incentives, and finance terms.</p></div></header>
        <div className="cq-money"><label>Vehicle price<input type="number" min="0" value={quote.vehiclePrice} onChange={(e) => { update("vehiclePrice", Number(e.target.value)); setVehicleId("manual"); }}/></label><label>Accessories<input type="number" min="0" value={quote.accessories} onChange={(e) => { update("accessories", Number(e.target.value)); setAccessoryIds([]); }}/></label><label>Dealer fees<input type="number" min="0" value={quote.docFees} onChange={(e) => update("docFees", Number(e.target.value))}/></label><label>Delivery<input type="number" min="0" value={quote.delivery} onChange={(e) => update("delivery", Number(e.target.value))}/></label><label>Sales tax{hasAutomaticTax && selectedLocation ? <small>{selectedLocation.salesTaxRate.toFixed(3)}% auto</small> : <small>Manual</small>}<input type="number" min="0" step="0.01" value={tax} disabled={hasAutomaticTax} onChange={(e) => update("salesTax", Number(e.target.value))}/></label><label>Destination<select aria-label="Destination type" value={destinationType} onChange={(e) => { const type = e.target.value as "tp"|"rr"; setDestinationType(type); const location = locations.find((item) => item.id === locationId); if (location) update("destination", type === "tp" ? location.tpDestinationFee : location.rrDestinationFee); }}><option value="tp">TP</option><option value="rr">RR</option></select><input aria-label="Destination fee" type="number" min="0" value={quote.destination} onChange={(e) => update("destination", Number(e.target.value))}/></label><label>Tag / title / DMV<input type="number" min="0" value={quote.tagTitleDmvFee} onChange={(e) => update("tagTitleDmvFee", Number(e.target.value))}/></label><label>Discount<input type="number" min="0" value={quote.discount} onChange={(e) => update("discount", Number(e.target.value))}/></label></div>
        <div className="cq-finance-fields"><label>Down payment<input type="number" min="0" value={downPayment} onChange={(e) => setDownPayment(Number(e.target.value))}/></label><label>APR<input type="number" min="0" step=".01" value={apr} onChange={(e) => setApr(Number(e.target.value))}/></label><label>Loan term<select value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))}>{terms.map((term) => <option key={term} value={term}>{term} months</option>)}</select></label><label>Acquisition rate<input type="number" min="0" step=".01" value={acquisitionCostRate} onChange={(e) => setAcquisitionCostRate(Number(e.target.value))}/></label></div>
        <label className="cq-notes">Notes (optional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add internal or customer notes…"/></label>
      </section>
      <aside className="cq-summary"><div className="cq-mode"><button className={mode === "cash" ? "active" : ""} onClick={() => setMode("cash")}>Cash price</button><button className={mode === "finance" ? "active" : ""} onClick={() => setMode("finance")}>Financing</button></div><h2>Deal summary</h2><dl><div><dt>Vehicle price</dt><dd>{money(finalQuote.vehiclePrice)}</dd></div><div><dt>Accessories</dt><dd>{money(finalQuote.accessories)}</dd></div><div><dt>Trade-in value</dt><dd>− {money(finalQuote.tradeIn)}</dd></div><div><dt>Dealer fees</dt><dd>{money(finalQuote.docFees)}</dd></div><div><dt>Destination</dt><dd>{money(finalQuote.destination)}</dd></div><div><dt>Delivery</dt><dd>{money(finalQuote.delivery)}</dd></div><div><dt>Sales tax</dt><dd>{money(finalQuote.salesTax)}</dd></div><div><dt>Warranty</dt><dd>{money(finalQuote.extendedWarranties)}</dd></div><div><dt>Tag / title / DMV</dt><dd>{money(finalQuote.tagTitleDmvFee)}</dd></div><div><dt>Discount</dt><dd>− {money(finalQuote.discount)}</dd></div></dl><div className="cq-total"><span>Total delivered</span><strong>{money(result.totalDelivered)}</strong></div><div className="cq-payment"><Calculator/><small>Estimated monthly payment</small><strong>{money(financing.monthlyPayment)}</strong><span>for {termMonths} months at {apr.toFixed(2)}% APR</span>{mode === "finance" && <p>{money(financing.amountFinanced)} financed · {money(financing.estimatedInterest)} estimated interest</p>}</div><button className="cq-save" onClick={saveQuote}>{saved ? <Check/> : <FileDown/>}{saved ? "Quote saved & copied" : "Save & generate quote"}</button><button className="cq-reset" onClick={reset}><RotateCcw/> Reset calculator</button><p className="cq-disclaimer">Estimate only. Confirm prices, taxes, fees, rates, terms, credit approval, availability, and final figures before presenting or accepting a quote.</p></aside>
    </div>
  </div>;
}
