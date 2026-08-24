"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, LoaderCircle, Plus, X } from "lucide-react";
import { createProduct, createProductFamily, deleteProduct, saveProductImagePaths, saveWarrantyDocumentPaths, type ProductActionState } from "@/app/admin/products/actions";
import { createClient } from "@/lib/supabase/client";
import type { ProductFamilyDTO } from "@/lib/products/types";

const initialState: ProductActionState = { error: "", success: "" };
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 5 * 1024 * 1024;
const maxImages = 8;
const maxWarrantyFiles = 5;
const maxWarrantyFileBytes = 10 * 1024 * 1024;
const warrantyTypes = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

type SelectedImage = { file: File; previewUrl: string };

export function AdminProductForm({ families, initialFamilyId = "" }: { families: ProductFamilyDTO[]; initialFamilyId?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const imagesRef = useRef<SelectedImage[]>([]);
  const [state, setState] = useState(initialState);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [warrantyFiles, setWarrantyFiles] = useState<File[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState(initialFamilyId);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [creatingFamily, setCreatingFamily] = useState(false);
  const [productType, setProductType] = useState<"our_product" | "competitor_product">("our_product");
  const router = useRouter();
  const selectedFamily = families.find((family) => family.id === selectedFamilyId);
  const isAddOn = selectedFamily?.slug === "accessories" || selectedFamily?.slug === "warranties";
  const isAccessory = selectedFamily?.slug === "accessories";
  const isWarranty = selectedFamily?.slug === "warranties";
  const itemLabel = selectedFamily?.slug === "warranties" ? "Warranty" : selectedFamily?.slug === "accessories" ? "Accessory" : "Model";

  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl)), []);

  function selectImages(files: FileList | null) {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    if (images.length + selected.length > maxImages) {
      setState({ error: `Choose no more than ${maxImages} images.`, success: "" });
      return;
    }
    const invalid = selected.find((file) => !allowedTypes.has(file.type) || file.size > maxImageBytes);
    if (invalid) {
      setState({ error: "Every image must be a JPG, PNG, or WebP file no larger than 5 MB.", success: "" });
      return;
    }
    setState(initialState);
    setImages((current) => [...current, ...selected.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
  }

  function removeImage(index: number) {
    setImages((current) => {
      URL.revokeObjectURL(current[index].previewUrl);
      return current.filter((_, imageIndex) => imageIndex !== index);
    });
  }

  async function addFamily() {
    setCreatingFamily(true);
    setState(initialState);
    const result = await createProductFamily(newFamilyName);
    if (result.error || !result.familyId) {
      setState({ error: result.error || "The product category could not be created.", success: "" });
      setCreatingFamily(false);
      return;
    }
    setSelectedFamilyId(result.familyId);
    setNewFamilyName("");
    setState({ error: "", success: result.success });
    setCreatingFamily(false);
    router.refresh();
  }

  function selectWarrantyFiles(files: FileList | null) {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    if (warrantyFiles.length + selected.length > maxWarrantyFiles) return setState({ error: `Choose no more than ${maxWarrantyFiles} warranty files.`, success: "" });
    if (selected.some((file) => !warrantyTypes.has(file.type) || file.size > maxWarrantyFileBytes)) return setState({ error: "Warranty files must be PDF, DOC, or DOCX files no larger than 10 MB.", success: "" });
    setState(initialState);
    setWarrantyFiles((current) => [...current, ...selected]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setState(initialState);
    const formData = new FormData(event.currentTarget);
    formData.delete("images");
    const result = await createProduct(initialState, formData);

    if (result.error || !result.productId || !result.organizationId) {
      setState(result);
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const uploadedPaths: string[] = [];
    const uploadedWarrantyPaths: string[] = [];

    try {
      for (const { file } of images) {
        const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
        const path = `${result.organizationId}/${result.productId}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        uploadedPaths.push(path);
      }

      if (uploadedPaths.length) await saveProductImagePaths(result.productId, uploadedPaths);
      for (const file of warrantyFiles) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
        const path = `${result.organizationId}/${result.productId}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("warranty-documents").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        uploadedWarrantyPaths.push(path);
      }
      if (uploadedWarrantyPaths.length) await saveWarrantyDocumentPaths(result.productId, uploadedWarrantyPaths);
      images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setImages([]);
      setWarrantyFiles([]);
      formRef.current?.reset();
      setSelectedFamilyId("");
      setState({ error: "", success: isAddOn ? `${String(formData.get("name"))} was saved.` : `${String(formData.get("name"))} and ${uploadedPaths.length} image${uploadedPaths.length === 1 ? "" : "s"} were saved.` });
    } catch (error) {
      if (uploadedPaths.length) await supabase.storage.from("product-images").remove(uploadedPaths);
      if (uploadedWarrantyPaths.length) await supabase.storage.from("warranty-documents").remove(uploadedWarrantyPaths);
      const deleteData = new FormData();
      deleteData.set("productId", result.productId);
      await deleteProduct(deleteData);
      const reason = error instanceof Error ? error.message : "Unknown storage error";
      setState({ error: `The files could not be uploaded: ${reason}. The incomplete item was not saved.`, success: "" });
    } finally {
      setSaving(false);
    }
  }

  return <form ref={formRef} className="card form-stack" onSubmit={handleSubmit}>
    <div><h2>Add product</h2><p style={{fontSize:12,marginBottom:0}}>New products and images belong only to the active organization.</p></div>
    <div className="grid grid-2"><label><span className="label">Product Type</span><select className="input" name="productType" value={productType} onChange={(event) => setProductType(event.target.value as "our_product" | "competitor_product")}><option value="our_product">Our Product</option><option value="competitor_product">Competitor Product</option></select></label><label><span className="label">Product category</span><select className="input" name="productCategory" defaultValue={productType === "competitor_product" ? "Competitor Vehicles" : "Golf Cart / LSV"}><option>Golf Cart / LSV</option><option>Accessories</option><option>Warranty</option><option>Competitor Vehicles</option></select></label></div>
    {productType === "our_product" ? <div><label className="label" htmlFor="familyId">Catalog family</label><select className="input" id="familyId" name="familyId" required value={selectedFamilyId} onChange={(event) => setSelectedFamilyId(event.target.value)}><option value="" disabled>Choose a product category</option>{families.map((family) => <option value={family.id} key={family.id}>{family.name}</option>)}</select><div style={{display:"flex",gap:8,marginTop:8}}><input className="input" value={newFamilyName} onChange={(event) => setNewFamilyName(event.target.value)} placeholder="New product category" maxLength={120}/><button className="btn btn-ghost" type="button" disabled={creatingFamily || newFamilyName.trim().length < 2} onClick={() => void addFamily()}>{creatingFamily ? "Creating…" : "Create category"}</button></div><small className="field-help">Create a category here, or choose Accessories or Warranties for the simplified add-on setup.</small></div> : <input type="hidden" name="familyId" value=""/>}
    <div className={isAddOn ? "" : "grid grid-2"}><div><label className="label" htmlFor="name">{itemLabel} name</label><input className="input" id="name" name="name" required placeholder={isAddOn ? `${itemLabel} name` : "Nexus"}/></div>{!isAddOn && <div><label className="label" htmlFor="model">Configuration</label><input className="input" id="model" name="model" placeholder="4 Passenger Forward"/></div>}</div>
    <div><label className="label" htmlFor="description">Description</label><textarea className="input" id="description" name="description" rows={3} required={isAddOn} placeholder={isAddOn ? `Describe this ${itemLabel.toLowerCase()}` : "Customer-ready positioning statement"}/></div>
    <div className={isAddOn ? "" : "grid grid-2"}><div><label className="label" htmlFor="price">{isAddOn ? "Price" : "Starting price"}</label><input className="input" id="price" name="price" type="number" min="0" step="0.01" required placeholder={isAddOn ? "0.00" : "15995"}/></div>{!isAddOn && <div><label className="label" htmlFor="status">Status</label><select className="input" id="status" name="status"><option value="draft">Draft</option><option value="published">Published</option></select></div>}</div>
    {isAddOn && <input type="hidden" name="status" value="published"/>}
    {!isAddOn && <><div className="grid grid-3"><div><label className="label" htmlFor="range">Frame</label><select className="input" id="range" name="range" defaultValue=""><option value="" disabled>Choose frame</option><option>Powder Coated Steel</option><option>Aluminum</option></select></div><div><label className="label" htmlFor="seats">Capacity</label><select className="input" id="seats" name="seats" defaultValue=""><option value="" disabled>Choose capacity</option><option>2 Passengers</option><option>4 Passenger</option><option>6 Passengers</option></select></div><div><label className="label" htmlFor="powertrain">Powertrain</label><select className="input" id="powertrain" name="powertrain" defaultValue=""><option value="" disabled>Choose powertrain</option><option>48V</option><option>72V</option></select></div></div>
    <div className="grid grid-2"><div><label className="label" htmlFor="dimensions">Dimensions</label><input className="input" id="dimensions" name="dimensions" placeholder="L × W × H"/></div><div><label className="label" htmlFor="runningDistance">Running distance</label><input className="input" id="runningDistance" name="runningDistance" placeholder="e.g. Up to 40 mi"/></div><div><label className="label" htmlFor="turningRadius">Turning radius</label><input className="input" id="turningRadius" name="turningRadius" placeholder="e.g. 11.5 ft"/></div><div><label className="label" htmlFor="maxLoadCapacity">Max load capacity</label><input className="input" id="maxLoadCapacity" name="maxLoadCapacity" placeholder="e.g. 1,000 lb"/></div></div>
    <div><label className="label" htmlFor="highlights">Highlights</label><input className="input" id="highlights" name="highlights" placeholder="72V lithium, Power steering, Touchscreen"/><small className="field-help">Separate features with commas.</small></div>
    <div>
      <label className="label" htmlFor="product-images">Product images <span className="optional-label">Optional · up to {maxImages}</span></label>
      <label className="product-image-picker" htmlFor="product-images"><span className="product-image-prompt"><ImagePlus size={24}/><strong>Choose product images</strong><small>Automatically centered and scaled · JPG, PNG, or WebP · 5 MB each</small></span></label>
      <input className="visually-hidden" id="product-images" name="images" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { selectImages(event.target.files); event.target.value = ""; }}/>
      {images.length > 0 && <div className="product-image-preview-grid">{images.map((image, index) => <div className="product-image-preview-item" key={`${image.file.name}-${image.previewUrl}`}><span className="product-image-preview" style={{backgroundImage:`url(${image.previewUrl})`}} role="img" aria-label={`Selected product image ${index + 1}`}/><button type="button" onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`}><X size={14}/></button>{index === 0 && <span className="primary-image-label">Primary</span>}</div>)}</div>}
      <small className="field-help">The first image is the primary image. Images keep their proportions and will not be stretched.</small>
    </div></>}
    {isAccessory && <div>
      <label className="label" htmlFor="product-images">Accessory pictures <span className="optional-label">Optional · up to {maxImages}</span></label>
      <label className="product-image-picker" htmlFor="product-images"><span className="product-image-prompt"><ImagePlus size={24}/><strong>Choose accessory pictures</strong><small>Automatically centered and scaled · JPG, PNG, or WebP · 5 MB each</small></span></label>
      <input className="visually-hidden" id="product-images" name="images" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { selectImages(event.target.files); event.target.value = ""; }}/>
      {images.length > 0 && <div className="product-image-preview-grid">{images.map((image, index) => <div className="product-image-preview-item" key={`${image.file.name}-${image.previewUrl}`}><span className="product-image-preview" style={{backgroundImage:`url(${image.previewUrl})`}} role="img" aria-label={`Selected accessory picture ${index + 1}`}/><button type="button" onClick={() => removeImage(index)} aria-label={`Remove picture ${index + 1}`}><X size={14}/></button>{index === 0 && <span className="primary-image-label">Primary</span>}</div>)}</div>}
    </div>}
    {isWarranty && <div>
      <label className="label" htmlFor="warranty-files">Warranty files <span className="optional-label">Optional · up to {maxWarrantyFiles}</span></label>
      <label className="product-image-picker" htmlFor="warranty-files"><span className="product-image-prompt"><FileText size={24}/><strong>Choose warranty files</strong><small>PDF, DOC, or DOCX · 10 MB each</small></span></label>
      <input className="visually-hidden" id="warranty-files" type="file" multiple accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { selectWarrantyFiles(event.target.files); event.target.value = ""; }}/>
      {warrantyFiles.length > 0 && <div className="form-stack">{warrantyFiles.map((file, index) => <div className="document-name" key={`${file.name}-${file.size}`}><FileText size={16}/><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span><button className="btn btn-ghost" type="button" onClick={() => setWarrantyFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`}><X size={14}/></button></div>)}</div>}
    </div>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}{state.success && <p className="form-success" role="status">{state.success}</p>}
    <button className="btn btn-primary" disabled={saving} type="submit">{saving ? <><LoaderCircle className="spin" size={16}/> Saving {isAddOn ? "add-on" : "product and images"}…</> : <><Plus size={16}/> Add {isAddOn ? itemLabel.toLowerCase() : "product"}</>}</button>
  </form>;
}
