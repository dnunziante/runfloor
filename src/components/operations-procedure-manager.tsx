"use client";

import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Eye,
  FileEdit,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  deleteOperationsProcedure,
  deleteOperationsProcedureCategory,
  saveOperationsProcedure,
  saveOperationsProcedureCategory,
} from "@/app/operations/actions";
import {
  defaultOperationsProcedureCategories,
  type OperationsProcedureCategory,
  type OperationsProcedureRecord,
} from "@/lib/operations/data";
import type { OperationsPersistence } from "@/lib/operations/repository";

export function OperationsProcedureManager({
  initialProcedures = [],
  initialCategories = defaultOperationsProcedureCategories,
  persistence = "demo",
  initialError = "",
  canManage = true,
}: {
  initialProcedures?: OperationsProcedureRecord[];
  initialCategories?: OperationsProcedureCategory[];
  persistence?: OperationsPersistence;
  initialError?: string;
  canManage?: boolean;
}) {
  const [procedures, setProcedures] = useState(initialProcedures);
  const [categories, setCategories] = useState(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(initialCategories[0]?.id ?? "");
  const [owner, setOwner] = useState("");
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState("");
  const [status, setStatus] =
    useState<OperationsProcedureRecord["status"]>("Draft");
  const selected = procedures.find((item) => item.id === selectedId) ?? null;
  const category = categories.find((item) => item.id === selectedCategory);
  const orderedCategories = [...categories].sort((left, right) => {
    const leftIndex = defaultOperationsProcedureCategories.findIndex(
      (item) => item.name === left.name,
    );
    const rightIndex = defaultOperationsProcedureCategories.findIndex(
      (item) => item.name === right.name,
    );
    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
    if (leftIndex >= 0) return -1;
    if (rightIndex >= 0) return 1;
    return left.name.localeCompare(right.name);
  });
  const filtered = useMemo(
    () =>
      procedures.filter(
        (item) =>
          item.categoryId === selectedCategory &&
          `${item.title} ${item.summary} ${item.owner}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [procedures, selectedCategory, search],
  );
  const clear = () => {
    setEditingId(null);
    setTitle("");
    setCategoryId(selectedCategory ?? categories[0]?.id ?? "");
    setOwner("");
    setSummary("");
    setSteps("");
    setStatus("Draft");
  };
  const edit = (item: OperationsProcedureRecord) => {
    setSelectedId(item.id);
    setEditingId(item.id);
    setTitle(item.title);
    setCategoryId(item.categoryId);
    setOwner(item.owner);
    setSummary(item.summary);
    setSteps(item.steps.join("\n"));
    setStatus(item.status);
  };
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const category = categories.find((item) => item.id === categoryId);
    const stepList = steps
      .split(/\r?\n\s*\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (
      !category ||
      title.trim().length < 2 ||
      owner.trim().length < 2 ||
      summary.trim().length < 10 ||
      !stepList.length
    )
      return setError(
        "Add a title, category, owner, useful summary, and at least one step.",
      );
    const old = procedures.find((item) => item.id === editingId);
    let record: OperationsProcedureRecord = {
      id: old?.id ?? `new-${crypto.randomUUID()}`,
      title: title.trim(),
      categoryId: category.id,
      category: category.name,
      owner: owner.trim(),
      summary: summary.trim(),
      steps: stepList,
      status,
      version: old ? old.version + 1 : 1,
      updatedAt: new Date().toISOString(),
    };
    if (persistence === "supabase") {
      const result = await saveOperationsProcedure(record);
      if (result.error || !result.record)
        return setError(result.error ?? "Procedure could not be saved.");
      record = result.record;
    }
    setProcedures((items) => [
      record,
      ...items.filter((item) => item.id !== record.id),
    ]);
    setSelectedId(record.id);
    setEditingId(record.id);
    setError("");
    setMessage("Procedure saved.");
  }
  async function removeProcedure() {
    if (!selected || !confirm(`Delete “${selected.title}”?`)) return;
    if (persistence === "supabase") {
      const result = await deleteOperationsProcedure(selected.id);
      if (result.error) return setError(result.error);
    }
    setProcedures((items) => items.filter((item) => item.id !== selected.id));
    setSelectedId(null);
    clear();
    setMessage("Procedure deleted.");
  }
  async function changeCategory(item?: OperationsProcedureCategory) {
    const name = prompt(
      item ? "Rename category" : "New category name",
      item?.name ?? "",
    );
    if (!name?.trim()) return;
    if (persistence === "supabase") {
      const result = await saveOperationsProcedureCategory({
        id: item?.id,
        name,
      });
      if (result.error || !result.record)
        return setError(result.error ?? "Category could not be saved.");
      setCategories((items) =>
        item
          ? items.map((entry) =>
              entry.id === item.id ? result.record! : entry,
            )
          : [...items, result.record!],
      );
    } else {
      const result = item
        ? { ...item, name: name.trim() }
        : {
            id: `category-${crypto.randomUUID()}`,
            name: name.trim(),
            isDefault: false,
          };
      if (
        categories.some(
          (entry) =>
            entry.id !== item?.id &&
            entry.name.toLowerCase() === result.name.toLowerCase(),
        )
      )
        return setError("This category already exists.");
      setCategories((items) =>
        item
          ? items.map((entry) => (entry.id === item.id ? result : entry))
          : [...items, result],
      );
      setProcedures((items) =>
        item
          ? items.map((entry) =>
              entry.categoryId === item.id
                ? { ...entry, category: result.name }
                : entry,
            )
          : items,
      );
    }
    setMessage(item ? "Category renamed." : "Category created.");
  }
  async function removeCategory(item: OperationsProcedureCategory) {
    if (procedures.some((procedure) => procedure.categoryId === item.id))
      return setError(
        "Move the procedures in this category before deleting it.",
      );
    if (!confirm(`Delete “${item.name}”?`)) return;
    if (persistence === "supabase") {
      const result = await deleteOperationsProcedureCategory(item.id);
      if (result.error) return setError(result.error);
    }
    setCategories((items) => items.filter((entry) => entry.id !== item.id));
    if (selectedCategory === item.id) setSelectedCategory(null);
    setMessage("Category deleted.");
  }
  const editor =
    selected && !editingId ? (
      <>
        <h2>{selected.title}</h2>
        <p>{selected.summary}</p>
        <p>
          <strong>Category:</strong> {selected.category} ·{" "}
          <strong>Owner:</strong> {selected.owner}
        </p>
        <ol>
          {selected.steps.map((step, index) => (
          <li key={index} style={{ whiteSpace: "pre-wrap" }}>{step}</li>
          ))}
        </ol>
        {canManage && (
          <div className="button-row">
            <button
              className="btn btn-secondary"
              onClick={() => edit(selected)}
            >
              <FileEdit size={16} /> Edit
            </button>
            <button className="btn btn-danger" onClick={removeProcedure}>
              <Trash2 size={16} /> Delete
            </button>
          </div>
        )}
      </>
    ) : canManage ? (
      <form className="form-stack" onSubmit={save}>
        <h2>{editingId ? "Edit procedure" : "Create procedure"}</h2>
        <label>
          <span className="label">Procedure title</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <div className="grid grid-2">
          <label>
            <span className="label">Category</span>
            <select
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {orderedCategories.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Owner</span>
            <input
              className="input"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              required
            />
          </label>
        </div>
        <label>
          <span className="label">Purpose and scope</span>
          <textarea
            className="input"
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            required
          />
        </label>
        <label>
          <span className="label">Procedure steps</span>
          <textarea
            className="input"
            rows={7}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            required
          />
          <small className="field-help">One step per line.</small>
        </label>
        <label>
          <span className="label">Publishing status</span>
          <select
            className="input"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as OperationsProcedureRecord["status"])
            }
          >
            <option>Draft</option>
            <option>Published</option>
          </select>
        </label>
        <button className="btn btn-primary">
          <CheckCircle2 size={16} />{" "}
          {editingId ? "Save next version" : "Create procedure"}
        </button>
      </form>
    ) : (
      <>
        <Eye size={24} />
        <h2>Select a procedure</h2>
      </>
    );
  return (
    <div className="operations-procedure-workspace">
      <section>
        <div className="operations-procedure-toolbar">
          <label>
            <span className="label">Search procedures</span>
            <span className="operations-search-input">
              <Search size={16} />
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search procedures"
              />
            </span>
          </label>
          {canManage && (
            <button className="btn btn-primary" onClick={clear}>
              <Plus size={16} /> New procedure
            </button>
          )}
        </div>
        {error && (
          <p className="form-error operations-procedure-error">
            <AlertTriangle size={14} />
            {error}
          </p>
        )}
        {message && <p className="form-success">{message}</p>}
        <div className="section-heading">
          <div>
            <h2>Procedure Templates</h2>
            <p>Choose a category, then an individual procedure.</p>
          </div>
          {canManage && (
            <button
              className="btn btn-secondary"
              onClick={() => changeCategory()}
            >
              <Plus size={16} /> Add category
            </button>
          )}
        </div>
        <div className="operations-category-list">
          {orderedCategories.map((item) => {
            const count = procedures.filter(
              (procedure) => procedure.categoryId === item.id,
            ).length;
            return (
              <div
                className={`card operations-category-card ${selectedCategory === item.id ? "selected" : ""}`}
                key={item.id}
              >
                <button
                  onClick={() => {
                    setSelectedCategory(item.id);
                    setSelectedId(null);
                    clear();
                  }}
                >
                  <strong>{item.name}</strong>
                  <span>{count} procedures</span>
                </button>
                {canManage && !item.isDefault && (
                  <span>
                    <button
                      aria-label={`Rename ${item.name}`}
                      className="icon-button"
                      onClick={() => changeCategory(item)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      aria-label={`Delete ${item.name}`}
                      className="icon-button"
                      onClick={() => removeCategory(item)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {category && (
          <div className="section-heading operations-list-heading">
            <div>
              <h2>{category.name}</h2>
              <p>{filtered.length} procedures</p>
            </div>
            <button
              className="text-button"
              onClick={() => setSelectedCategory(null)}
            >
              All categories
            </button>
          </div>
        )}
        {selectedCategory &&
          (filtered.length ? (
            <div className="operations-procedure-cards">
              {filtered.map((item) => (
                <button
                  className={`card operations-procedure-card ${selectedId === item.id ? "selected" : ""}`}
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setEditingId(null);
                  }}
                >
                  <BookOpenCheck size={18} />
                  <h2>{item.title}</h2>
                  <p>{item.summary}</p>
                  <div className="operations-procedure-card-meta">
                    <span>{item.category}</span>
                    <span>{item.owner}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="card output empty">
              <h2>No procedures in this category</h2>
              <p>Create one or move an existing procedure here.</p>
            </div>
          ))}
      </section>
      <aside className="card operations-procedure-editor">{editor}</aside>
    </div>
  );
}
