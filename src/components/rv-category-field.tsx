"use client";

import { useState } from "react";

const rvCategories = ["Class A", "Class B", "Class C", "Travel Trailers", "Fifth Wheels", "Toy Haulers", "Pop-Up Campers"] as const;

export function RvCategoryField({ name = "productCategory", value = "", label = "Category" }: { name?: string; value?: string; label?: string }) {
  const isStandardCategory = rvCategories.includes(value as (typeof rvCategories)[number]);
  const [selectedCategory, setSelectedCategory] = useState(value && !isStandardCategory ? "Other" : value);
  const [customCategory, setCustomCategory] = useState(value && !isStandardCategory ? value : "");

  return <div>
    <label className="label" htmlFor={name}>{label}</label>
    <select className="input" id={name} name={name} value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
      <option value="">Choose a category</option>
      {rvCategories.map((category) => <option value={category} key={category}>{category}</option>)}
      <option value="Other">Other</option>
    </select>
    {selectedCategory === "Other" ? <div style={{ marginTop: 8 }}><label className="label" htmlFor={`${name}Other`}>Enter Category</label><input className="input" id={`${name}Other`} name={`${name}Other`} value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} /></div> : null}
  </div>;
}
