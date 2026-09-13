import Link from "next/link";
import { ArrowRight, ImagePlus, Layers3, PackagePlus, ShieldCheck } from "lucide-react";
import type { ProductFamilyDTO } from "@/lib/products/types";

export function ProductFamilyLibrary({ families, isRv = false }: { families: ProductFamilyDTO[]; isRv?: boolean }) {
  const addOnSlugs = new Set(["accessories", "warranties"]);
  const vehicleFamilies = families.filter((family) => !addOnSlugs.has(family.slug));
  const addOnFamilies = families.filter((family) => addOnSlugs.has(family.slug));

  return <div className={`form-stack ${isRv ? "rv-product-library" : ""}`}>
    <div className="product-family-grid">
      {vehicleFamilies.map((family) => <Link className="card product-family-card" href={`/products/families/${family.slug}`} key={family.id}>
      <div className={`product-family-cover ${family.imageUrl ? "has-image" : ""}`} style={family.imageUrl ? { backgroundImage: `url(${family.imageUrl})` } : undefined}>
        {!family.imageUrl && <div><ImagePlus size={34}/><span>Product family image</span></div>}
      </div>
      <div className="product-family-content">
        <div><span className="badge blue"><Layers3 size={13}/>{family.productCount} configuration{family.productCount === 1 ? "" : "s"}</span><h2>{family.name}</h2><p>{family.description}</p></div>
        <span className="product-family-link">View models <ArrowRight size={16}/></span>
      </div>
    </Link>)}
    </div>
    {addOnFamilies.length > 0 && <section className="product-addons-section" aria-labelledby="available-addons">
      <div><span className="eyebrow">At the time of purchase</span><h2 id="available-addons">Available add-ons</h2><p>Optional products and protection plans that can be added to a vehicle purchase.</p></div>
      <div className="product-addon-grid">{addOnFamilies.map((family) => {
        const isWarranty = family.slug === "warranties";
        const Icon = isWarranty ? ShieldCheck : PackagePlus;
        return <Link className="card product-addon-card" href={`/products/families/${family.slug}`} key={family.id}>
          <span className="metric-icon"><Icon size={20}/></span>
          <div><h3>{family.name}</h3><p>{family.description}</p><small>{family.productCount} available option{family.productCount === 1 ? "" : "s"}</small></div>
          <span className="product-family-link">View {isWarranty ? "warranties" : "accessories"} <ArrowRight size={16}/></span>
        </Link>;
      })}</div>
    </section>}
  </div>;
}
