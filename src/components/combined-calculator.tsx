"use client";

import { productPrice, productTitle } from "@/lib/products/presentation";
import { quoteReadiness } from "@/lib/quote-readiness";
import Link from "next/link";
import { defaultQuoteLabels, quoteFields, restoreQuoteLabels, type QuoteField, type QuoteLabels } from "@/lib/quote-field-labels";
import { Calculator, Check, CircleDollarSign, FileDown, Mail, Pencil, Printer, RotateCcw, Share2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { calculatePricing } from "@/lib/pricing-calculator";
import { calculateQuote, type QuoteInputs } from "@/lib/quote-calculator";
import type { ProductDTO } from "@/lib/products/types";
import type { OrganizationLocation } from "@/lib/locations";

const blankQuote: QuoteInputs = { vehiclePrice: 0, accessories: 0, docFees: 0, tradeIn: 0, discount: 0, salesTax: 0, extendedWarranties: 0, tagTitleDmvFee: 0, destination: 0, delivery: 0 };
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const terms = [24, 36, 48, 60, 72, 84];

export function CombinedCalculator({ vehicles, accessories, warranties, locations, isRv = false, isGolfCart = false }: { vehicles: ProductDTO[]; accessories: ProductDTO[]; warranties: ProductDTO[]; locations: OrganizationLocation[]; isRv?: boolean; isGolfCart?: boolean }) {
  const edited = useRef(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const [fieldLabels, setFieldLabels] = useState<QuoteLabels>({ ...defaultQuoteLabels });
  const [labelDraft, setLabelDraft] = useState<QuoteLabels | null>(null);
  const [labelError, setLabelError] = useState("");
  function closeLabelEditor(apply: boolean) {
    if (apply && labelDraft) {
      if (quoteFields.some(key => !labelDraft[key].trim())) { setLabelError("Enter a name for every field."); return; }
      edited.current = true;
      setFieldLabels(restoreQuoteLabels(labelDraft)); setConfirmed(false); setSaved(false);
    }
    setLabelDraft(null); setLabelError(""); requestAnimationFrame(() => editButton.current?.focus());
  }
  function fieldName(key: QuoteField) {
    return labelDraft ? <input autoFocus={key === "vehiclePrice"} className="cq-label-input" aria-label={`Name for ${defaultQuoteLabels[key]}`} maxLength={60} value={labelDraft[key]} onChange={event => { setLabelDraft({ ...labelDraft, [key]: event.target.value }); setLabelError(""); }}/>
      : <label htmlFor={`cq-${key}`}>{fieldLabels[key]}</label>;
  }
  const firstVehicle = vehicles[0];
  const [priceInput, setPriceInput] = useState(() => firstVehicle && productPrice(firstVehicle) != null ? String(productPrice(firstVehicle)) : "");
  const [confirmed, setConfirmed] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [storageKey, setStorageKey] = useState("");
  const [quote, setQuote] = useState<QuoteInputs>(() => ({ ...blankQuote, vehiclePrice: firstVehicle ? productPrice(firstVehicle) ?? 0 : 0 }));
  const [vehicleId, setVehicleId] = useState(firstVehicle?.id || "manual");
  const [accessoryIds, setAccessoryIds] = useState<string[]>([]);
  const [warrantyIds, setWarrantyIds] = useState<string[]>([]);
  const [locationId, setLocationId] = useState("manual");
  const [tradeDescription, setTradeDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [downPayment, setDownPayment] = useState(0);
  const [apr, setApr] = useState<number>(NaN);
  const [termMonths, setTermMonths] = useState(60);
  const [acquisitionCostRate, setAcquisitionCostRate] = useState(0);
  const [mode, setMode] = useState<"cash" | "finance">("cash");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const selectedLocation = locations.find((location) => location.id === locationId);
  const hasAutomaticTax = Boolean(selectedLocation && selectedLocation.salesTaxRate > 0);
  const baseResult = useMemo(() => calculateQuote(quote), [quote]);
  const tax = hasAutomaticTax && selectedLocation ? Math.round(baseResult.subtotal * selectedLocation.salesTaxRate) / 100 : quote.salesTax;
  const finalQuote = hasAutomaticTax ? { ...quote, salesTax: tax } : quote;
  const result = calculateQuote(finalQuote);
  const financing = calculatePricing({ totalFinanced: result.totalDelivered, downPayment, acquisitionCostRate, apr, termMonths });
  const selectedVehicle = vehicles.find((item) => item.id === vehicleId);
  const update = (key: keyof QuoteInputs, value: number) => setQuote((current) => ({ ...current, [key]: value }));
  const readiness = quoteReadiness(finalQuote, priceInput.trim() !== "", confirmed, mode === "finance" ? { downPayment, apr, acquisitionCostRate, termMonths } : undefined);
  const canShare = !readiness && Boolean(storageKey) && !labelDraft;
  const shownMoney = (value: number) => Number.isFinite(value) ? money(value) : "Not provided";
  useEffect(() => {
   let active = true;
   fetch("/api/auth/context").then(response => response.json()).then(viewer => {
    if (!active || !viewer.organizationId) return;
    const key = `runfloor-saved-quote:${viewer.organizationId}:${viewer.id}`;
    setStorageKey(key);
    try {
     const raw = localStorage.getItem(key); if (!raw) return;
     const saved = JSON.parse(raw);
     if (edited.current) return;
     if (saved.version !== 1 || !saved.quote || Object.keys(blankQuote).some(name => typeof saved.quote[name] !== "number" || !Number.isFinite(saved.quote[name]))) return;
     if (saved.vehicleId !== "manual" && !vehicles.some(item => item.id === saved.vehicleId)) return;
     setFieldLabels(restoreQuoteLabels(saved.fieldLabels)); setQuote(saved.quote); setPriceInput(String(saved.quote.vehiclePrice)); setVehicleId(saved.vehicleId);
     setAccessoryIds(saved.accessoryIds || []); setWarrantyIds(saved.warrantyIds || []);
     setLocationId(locations.some(item => item.id === saved.locationId) ? saved.locationId : "manual");
     setTradeDescription(saved.tradeDescription || ""); setNotes(saved.notes || "");
     setDownPayment(saved.downPayment ?? 0); setApr(saved.apr ?? NaN); setTermMonths(saved.termMonths || 60); setAcquisitionCostRate(saved.acquisitionCostRate ?? 0); setMode(saved.mode === "finance" ? "finance" : "cash");
    } catch { setSaveError("The saved browser quote could not be restored. Your current inputs have not been changed."); }
   }).catch(() => active && setSaveError("Workspace could not be verified. Refresh before saving a quote."));
   return () => { active = false; };
  }, [vehicles, locations]);

  function selectVehicle(id: string) { setVehicleId(id); const vehicle = vehicles.find((item) => item.id === id); const price = vehicle ? productPrice(vehicle) : null; setPriceInput(price == null ? "" : String(price)); update("vehiclePrice", price ?? 0); }
  function toggleProduct(id: string, kind: "accessory" | "warranty") {
    const selected = kind === "accessory" ? accessoryIds : warrantyIds;
    const products = kind === "accessory" ? accessories : warranties;
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    if (kind === "accessory") setAccessoryIds(next); else setWarrantyIds(next);
    update(kind === "accessory" ? "accessories" : "extendedWarranties", products.filter((item) => next.includes(item.id)).reduce((sum, item) => sum + (productPrice(item) ?? 0), 0));
  }
  function chooseLocation(id: string) { setLocationId(id); }
  function reset() { setFieldLabels({ ...defaultQuoteLabels }); setLabelDraft(null); setLabelError(""); edited.current = true; setPriceInput(firstVehicle && productPrice(firstVehicle) != null ? String(productPrice(firstVehicle)) : ""); setConfirmed(false); setSaveError(""); setQuote({ ...blankQuote, vehiclePrice: firstVehicle ? productPrice(firstVehicle) ?? 0 : 0 }); setVehicleId(firstVehicle?.id || "manual"); setAccessoryIds([]); setWarrantyIds([]); setLocationId("manual"); setTradeDescription(""); setNotes(""); setDownPayment(0); setApr(NaN); setTermMonths(60); setAcquisitionCostRate(0); setSaved(false); }
  const summary = `RunFloor estimate only\n${selectedVehicle ? productTitle(selectedVehicle) : "Custom vehicle"}\n${Object.entries(finalQuote).map(([key,value]) => `${({ ...fieldLabels, tradeIn:"Trade-in", extendedWarranties:"Warranties" } as Record<string,string>)[key]}: ${money(value)}`).join("\n")}${tradeDescription ? `\nTrade vehicle: ${tradeDescription}` : ""}\nTotal delivered: ${money(result.totalDelivered)}${mode === "finance" ? `\nDown payment: ${money(downPayment)}\nAcquisition rate: ${acquisitionCostRate}%\nAmount financed: ${money(financing.amountFinanced)}\nEstimated payment: ${money(financing.monthlyPayment)} for ${termMonths} months at ${apr.toFixed(2)}% APR` : ""}\nEstimate only. Final pricing, availability, lender approval and terms must be confirmed.${notes ? `\nNotes: ${notes}` : ""}`;
  async function saveQuote() {
   if (!canShare) return;
   try {
    localStorage.setItem(storageKey, JSON.stringify({ version:1, fieldLabels, quote:finalQuote, vehicleId, accessoryIds, warrantyIds, locationId, tradeDescription, notes, downPayment, apr, termMonths, acquisitionCostRate, mode }));
    setSaved(true); setSaveError("");
    try { if (navigator.clipboard) { await navigator.clipboard.writeText(summary); setCopied(true); } } catch { setCopied(false); }
   } catch { setSaved(false); setSaveError("Quote could not be saved in this browser. Your inputs are still here; enable browser storage and try again."); }
  }


  return <div onChangeCapture={() => { edited.current = true; setConfirmed(false); setSaved(false); }} className={`cq ${isRv ? "rv-cq" : ""} ${isGolfCart ? "golf-cart-cq" : ""}`}>
    <nav className="cq-actions print-hide" aria-label="Quote actions"><button disabled={!canShare} onClick={saveQuote}><FileDown/> {saved ? "Quote saved" : "Save quote"}</button><button disabled={!canShare} onClick={() => canShare && window.print()}><Printer/> Print / PDF</button><a aria-disabled={!canShare} onClick={event => { if (!canShare) event.preventDefault(); }} href={canShare ? `mailto:?subject=${encodeURIComponent("RunFloor quote")}&body=${encodeURIComponent(summary)}` : undefined}><Mail/> Send to customer</a><button className="primary" onClick={reset}><RotateCcw/> New quote</button></nav>
    <section className="cq-hero"><div><span>Quote &amp; financing</span><h1>{isRv ? <>Turn Dreams Into<br/><em>Road Trips.</em></> : isGolfCart ? <>Build Dreams<br/>On <em>Four Wheels.</em></> : <>Turn Interest Into Ownership.<br/><em>Premium Style. Real Performance.</em></>}</h1><p>{isGolfCart ? "Create a professional quote, estimate payments, and help customers get on the road in minutes." : "Calculate total price, estimate a monthly payment, and build a professional quote in one place."}</p><div><b><Calculator/> Deal estimate<small>Live calculations</small></b><b>{isGolfCart ? <CircleDollarSign/> : <FileDown/>} Review all fees<small>{isRv ? "Transparent pricing" : "Delivered price"}</small></b><b>{isGolfCart ? <ShieldCheck/> : <Share2/>} {isGolfCart ? "Finance ready" : "Confirm before sharing"}<small>{isGolfCart ? "Lender approval required" : "Print or email"}</small></b><b className="golf-cart-only"><Share2/> Share anywhere<small>Print, email or text</small></b></div></div>{isRv && <blockquote>Adventure.<br/>Finances.<br/>Family.<br/>All in One Place.</blockquote>}{isGolfCart && <blockquote>More Freedom.<br/>A Better Way<br/>To Get Around.</blockquote>}</section>
    {isGolfCart && <nav className="golf-cart-cq-steps" aria-label="Quote progress"><span className="active"><b>1</b>Select vehicle<small>Choose your model</small></span><span><b>2</b>Build &amp; customize<small>Add options</small></span><span><b>3</b>Pricing &amp; incentives<small>See your best price</small></span><span><b>4</b>Financing<small>Estimate payments</small></span><span><b>5</b>Review &amp; share<small>Send to customer</small></span></nav>}
    <div className="cq-layout">
      <div className="cq-left">
        <section className="cq-card cq-product-card"><header><span>1</span><div><h2>{isGolfCart ? "Select vehicle" : "Select product"}</h2><p>Choose a vehicle and configuration.</p></div></header>{isGolfCart && selectedVehicle?.imageUrl && <div className="golf-cart-cq-product-image" style={{backgroundImage:`url(${selectedVehicle.imageUrl})`}} role="img" aria-label={`${selectedVehicle.name} selected`}/>}<div className="cq-fields"><label>Vehicle<select value={vehicleId} onChange={(e) => selectVehicle(e.target.value)}><option value="manual">Custom price</option>{vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{productTitle(vehicle)} · {productPrice(vehicle) == null ? "Price not provided" : money(productPrice(vehicle)!)}</option>)}</select></label><label>Location<select value={locationId} onChange={(e) => chooseLocation(e.target.value)}><option value="manual">Manual fees</option>{locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label></div><Link href={selectedVehicle ? `/products/${selectedVehicle.slug}` : "/products"}>{selectedVehicle ? "View full product details →" : "Browse products →"}</Link>{isRv && <div className="rv-cq-product-art"><strong>Explore. Compare. Customize.</strong><small>Your next adventure starts here.</small></div>}</section>
        <section className="cq-card"><header><span>2</span><div><h2>Customize your build</h2><p>Add published accessories and warranties.</p></div><Link href="/products">View product catalog →</Link></header>{isRv && <div className="rv-cq-categories"><span>Exterior &amp; Towing<small>Hitches, racks, awnings</small></span><span>Interior &amp; Comfort<small>Appliances, furniture, tech</small></span><span>Off-Grid &amp; Power<small>Solar, batteries, generators</small></span><span>Protection<small>Warranties, service plans</small></span></div>}<div className="cq-addons">{accessories.length ? accessories.map((item) => <label key={item.id}><input type="checkbox" disabled={productPrice(item) == null} checked={accessoryIds.includes(item.id)} onChange={() => toggleProduct(item.id, "accessory")}/><span>{item.name}<small>{item.model}</small></span><strong>{productPrice(item) == null ? "Price not provided" : money(productPrice(item)!)}</strong></label>) : <p>No published accessories are available.</p>}</div><details><summary>Extended warranties ({warrantyIds.length} selected)</summary><div className="cq-addons">{warranties.length ? warranties.map((item) => <label key={item.id}><input type="checkbox" disabled={productPrice(item) == null} checked={warrantyIds.includes(item.id)} onChange={() => toggleProduct(item.id, "warranty")}/><span>{item.name}<small>{item.model}</small></span><strong>{productPrice(item) == null ? "Price not provided" : money(productPrice(item)!)}</strong></label>) : <p>No published warranties are available.</p>}</div></details></section>
        <section className="cq-card cq-trade-card"><header><span>3</span><div><h2>Trade-in <small>(optional)</small></h2><p>Apply a trade value to this deal.</p></div></header><div className="cq-fields"><label>Make / Model / Year<input value={tradeDescription} onChange={(e) => setTradeDescription(e.target.value)} placeholder={isRv ? "e.g. Grand Design 2022" : "e.g. Club Car 2022"}/></label><label>Trade-in value<input type="number" min="0" step="0.01" value={Number.isFinite(quote.tradeIn) ? quote.tradeIn : ""} onChange={(e) => update("tradeIn", e.target.value === "" ? NaN : Number(e.target.value))}/></label></div>{isRv && <div className="rv-cq-trade"><strong>Trade In. Upgrade.<br/>Hit the Road Sooner.</strong><small>Get more for your trade and put it toward your next adventure.</small></div>}</section>
      </div>
      <section className="cq-card cq-deal"><header><span>4</span><div><h2>Deal details</h2><p>Add fees, incentives, and finance terms.</p></div><div className="cq-field-actions print-hide"><button ref={editButton} type="button" hidden={Boolean(labelDraft)} aria-expanded={Boolean(labelDraft)} onClick={() => { setLabelDraft({ ...fieldLabels }); setLabelError(""); }}><Pencil aria-hidden="true"/> Edit fields</button>{labelDraft && <><button type="button" onClick={() => closeLabelEditor(false)}>Cancel</button><button type="button" className="primary" onClick={() => closeLabelEditor(true)}>Done</button></>}</div></header>
        {labelDraft && <p className="cq-label-help">Edit the field names shown on this quote. Updated names appear in the estimate, PDF, and email.</p>}
        {labelError && <p role="alert" className="form-error">{labelError}</p>}
        <div className="cq-money" onKeyDown={event => { if (labelDraft && event.key === "Escape") { event.preventDefault(); closeLabelEditor(false); } }}><div className="cq-money-field">{fieldName("vehiclePrice")} <input id="cq-vehiclePrice" aria-label={fieldLabels.vehiclePrice} type="number" min="0" step="0.01" placeholder="Price not provided" value={priceInput} onChange={(e) => { setPriceInput(e.target.value); update("vehiclePrice", Number(e.target.value)); }}/></div><div className="cq-money-field">{fieldName("accessories")} <input id="cq-accessories" aria-label={fieldLabels.accessories} type="number" min="0" step="0.01" value={Number.isFinite(quote.accessories) ? quote.accessories : ""} onChange={(e) => { update("accessories", e.target.value === "" ? NaN : Number(e.target.value)); setAccessoryIds([]); }}/></div><div className="cq-money-field">{fieldName("docFees")} <input id="cq-docFees" aria-label={fieldLabels.docFees} type="number" min="0" step="0.01" value={Number.isFinite(quote.docFees) ? quote.docFees : ""} onChange={(e) => update("docFees", e.target.value === "" ? NaN : Number(e.target.value))}/></div><div className="cq-money-field">{fieldName("delivery")} <input id="cq-delivery" aria-label={fieldLabels.delivery} type="number" min="0" step="0.01" value={Number.isFinite(quote.delivery) ? quote.delivery : ""} onChange={(e) => update("delivery", e.target.value === "" ? NaN : Number(e.target.value))}/></div><div className="cq-money-field">{fieldName("salesTax")} {hasAutomaticTax && selectedLocation ? <small>{selectedLocation.salesTaxRate.toFixed(3)}% auto</small> : <small>Manual</small>}<input id="cq-salesTax" aria-label={fieldLabels.salesTax} type="number" min="0" step="0.01" value={Number.isFinite(tax) ? tax : ""} disabled={hasAutomaticTax} onChange={(e) => update("salesTax", e.target.value === "" ? NaN : Number(e.target.value))}/></div><div className="cq-money-field">{fieldName("destination")} <input id="cq-destination" aria-label={fieldLabels.destination} type="number" min="0" step="0.01" value={Number.isFinite(quote.destination) ? quote.destination : ""} onChange={(e) => update("destination", e.target.value === "" ? NaN : Number(e.target.value))}/></div><div className="cq-money-field">{fieldName("tagTitleDmvFee")} <input id="cq-tagTitleDmvFee" aria-label={fieldLabels.tagTitleDmvFee} type="number" min="0" step="0.01" value={Number.isFinite(quote.tagTitleDmvFee) ? quote.tagTitleDmvFee : ""} onChange={(e) => update("tagTitleDmvFee", e.target.value === "" ? NaN : Number(e.target.value))}/></div><div className="cq-money-field">{fieldName("discount")} <input id="cq-discount" aria-label={fieldLabels.discount} type="number" min="0" step="0.01" value={Number.isFinite(quote.discount) ? quote.discount : ""} onChange={(e) => update("discount", e.target.value === "" ? NaN : Number(e.target.value))}/></div></div>
        <div className="cq-finance-fields"><label>Down payment<input type="number" min="0" value={Number.isFinite(downPayment) ? downPayment : ""} onChange={(e) => setDownPayment(e.target.value === "" ? NaN : Number(e.target.value))}/></label><label>APR<input type="number" min="0" step=".01" placeholder="Enter APR" value={Number.isFinite(apr) ? apr : ""} onChange={(e) => setApr(e.target.value === "" ? NaN : Number(e.target.value))}/></label><label>Loan term<select value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))}>{terms.map((term) => <option key={term} value={term}>{term} months</option>)}</select></label><label>Acquisition rate<input type="number" min="0" step=".01" value={Number.isFinite(acquisitionCostRate) ? acquisitionCostRate : ""} onChange={(e) => setAcquisitionCostRate(e.target.value === "" ? NaN : Number(e.target.value))}/></label></div>
        <label className="cq-notes">Notes (optional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add internal or customer notes…"/></label>
      </section>
      <aside className="cq-summary">{isRv && <div className="rv-cq-summary-art">Your Journey<br/>Starts Here.</div>}<div className="cq-mode"><button className={mode === "cash" ? "active" : ""} onClick={() => { edited.current = true; setMode("cash"); setConfirmed(false); setSaved(false); }}>Cash price</button><button className={mode === "finance" ? "active" : ""} onClick={() => { edited.current = true; setMode("finance"); setConfirmed(false); setSaved(false); }}>Financing</button></div><h2>Deal estimate</h2><p className="cq-estimate-identity"><strong>{selectedVehicle ? productTitle(selectedVehicle) : "Custom vehicle"}</strong><br/>{selectedLocation?.name || "Manual location fees"}</p><p role="status">{readiness || "Reviewed estimate. Final terms remain subject to confirmation."}</p><dl><div><dt>{fieldLabels.vehiclePrice}</dt><dd>{priceInput.trim() === "" ? "Price not provided" : shownMoney(finalQuote.vehiclePrice)}</dd></div><div><dt>{fieldLabels.accessories}</dt><dd>{shownMoney(finalQuote.accessories)}</dd></div><div><dt>Trade-in value{tradeDescription && <small> · {tradeDescription}</small>}</dt><dd>− {shownMoney(finalQuote.tradeIn)}</dd></div><div><dt>{fieldLabels.docFees}</dt><dd>{shownMoney(finalQuote.docFees)}</dd></div><div><dt>{fieldLabels.destination}</dt><dd>{shownMoney(finalQuote.destination)}</dd></div><div><dt>{fieldLabels.delivery}</dt><dd>{shownMoney(finalQuote.delivery)}</dd></div><div><dt>{fieldLabels.salesTax}</dt><dd>{shownMoney(finalQuote.salesTax)}</dd></div><div><dt>Warranty</dt><dd>{shownMoney(finalQuote.extendedWarranties)}</dd></div><div><dt>{fieldLabels.tagTitleDmvFee}</dt><dd>{shownMoney(finalQuote.tagTitleDmvFee)}</dd></div><div><dt>{fieldLabels.discount}</dt><dd>− {shownMoney(finalQuote.discount)}</dd></div></dl><div className="cq-total"><span>Total delivered</span><strong>{priceInput.trim() === "" ? "Price not provided" : shownMoney(result.totalDelivered)}</strong></div>{mode === "finance" && <div className="cq-payment"><Calculator/><small>Estimated monthly payment</small><strong>{Number.isFinite(apr) && priceInput !== "" ? money(financing.monthlyPayment) : "Terms incomplete"}</strong><span>for {termMonths} months at {Number.isFinite(apr) ? `${apr.toFixed(2)}% APR` : "APR not provided"}</span>{mode === "finance" && <><p>{shownMoney(financing.amountFinanced)} financed · {shownMoney(financing.estimatedInterest)} estimated interest</p><p>Down payment: {shownMoney(downPayment)} · Acquisition rate: {Number.isFinite(acquisitionCostRate) ? `${acquisitionCostRate}%` : "Not provided"}</p></>}</div>}{notes && <p className="cq-print-notes">Notes: {notes}</p>}<label className="cq-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/> I reviewed the vehicle price, taxes, fees, trade, discounts, and any financing terms. Zero fees mean none apply.</label>{saveError && <p role="alert" className="form-error">{saveError}</p>}<button disabled={!canShare} className="cq-save" onClick={saveQuote}>{saved ? <Check/> : <FileDown/>}{saved ? copied ? "Saved & copied" : "Saved in this browser" : "Save reviewed estimate"}</button><button className="cq-reset" onClick={reset}><RotateCcw/> Reset calculator</button><p className="cq-disclaimer">Estimate only. Confirm prices, taxes, fees, rates, terms, credit approval, availability, and final figures before presenting or accepting a quote.</p></aside>
    </div>
  </div>;
}
