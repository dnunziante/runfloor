"use client";

import {
  useActionState,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Copy,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Star,
  Tags,
  Upload,
  Users,
  Wrench,
  X,
} from "lucide-react";
import {
  saveSalesContent,
  type ContentActionState,
} from "@/app/admin/content/actions";
import { TextTemplateImporter } from "@/components/text-template-importer";

type Item = {
  id: string;
  title: string;
  body: string;
  status: "draft" | "published" | "archived";
  category: string;
  tags: string[];
  updatedAt: string;
};
type Category = {
  id: string;
  name: string;
  position: number;
  archived: boolean;
};
const initialState: ContentActionState = { error: "", success: "" };
const quickVariables = [
  "{{first_name}}",
  "{{last_name}}",
  "{{sales_rep}}",
  "{{store_name}}",
  "{{product}}",
  "{{phone}}",
];
const categoryIcons = [
  Star,
  Users,
  Send,
  CalendarDays,
  CircleDollarSign,
  Tags,
  Wrench,
];

export function TextTemplateManager({
  contentType,
  items,
  categories,
  canManage,
}: {
  contentType: "text_template" | "email_template";
  items: Item[];
  categories: Category[];
  canManage: boolean;
}) {
  const isEmail = contentType === "email_template";
  const router = useRouter(),
    messageRef = useRef<HTMLTextAreaElement>(null);
  const [selected, setSelected] = useState<Item | null>(null),
    [creating, setCreating] = useState(false),
    [checked, setChecked] = useState<string[]>([]),
    [menuId, setMenuId] = useState("");
  const [query, setQuery] = useState(""),
    deferredQuery = useDeferredValue(query),
    [category, setCategory] = useState("All Templates"),
    [tag, setTag] = useState("all"),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("updated"),
    [page, setPage] = useState(1);
  const [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [editorCategory, setEditorCategory] = useState("New Lead"),
    [editorStatus, setEditorStatus] = useState<Item["status"]>("draft"),
    [tags, setTags] = useState("");
  const [manageOpen, setManageOpen] = useState(false),
    [newCategory, setNewCategory] = useState(""),
    [categoryError, setCategoryError] = useState(""),
    [draggedCategoryId, setDraggedCategoryId] = useState(""),
    [busy, setBusy] = useState(false);
  const [state, action, pending] = useActionState(
    saveSalesContent,
    initialState,
  );
  const activeCategories = useMemo(
    () => categories.filter((item) => !item.archived),
    [categories],
  );
  const archivedCategories = useMemo(
    () => categories.filter((item) => item.archived),
    [categories],
  );
  const availableCategories = activeCategories.length
    ? activeCategories
    : [{ id: "", name: "General", position: 0, archived: false }];
  const allTags = useMemo(
    () => Array.from(new Set(items.flatMap((item) => item.tags))).sort(),
    [items],
  );
  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return items
      .filter(
        (item) =>
          (category === "All Templates" ||
            (item.category || "General") === category) &&
          (tag === "all" || item.tags.includes(tag)) &&
          (status === "all" || item.status === status) &&
          (!needle ||
            `${item.title} ${item.body} ${item.category} ${item.tags.join(" ")}`
              .toLowerCase()
              .includes(needle)),
      )
      .toSorted((a, b) =>
        sort === "oldest"
          ? a.updatedAt.localeCompare(b.updatedAt)
          : sort === "az"
            ? a.title.localeCompare(b.title)
            : sort === "za"
              ? b.title.localeCompare(a.title)
              : b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [items, category, tag, status, sort, deferredQuery]);
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    shown = filtered.slice((page - 1) * 10, page * 10);
  const editorOpen = creating || Boolean(selected),
    smsSegments = body.length
      ? Math.ceil(body.length / (/[^\x00-\x7f]/.test(body) ? 70 : 160))
      : 0;
  const categoryCount = (name: string) =>
    name === "All Templates"
      ? items.length
      : items.filter((item) => (item.category || "General") === name).length;
  const choose = (item: Item) => {
    setSelected(item);
    setCreating(false);
    setTitle(item.title);
    setBody(item.body);
    setEditorCategory(item.category || availableCategories[0].name);
    setEditorStatus(item.status);
    setTags(item.tags.join(", "));
    setMenuId("");
  };
  const beginNew = () => {
    setSelected(null);
    setCreating(true);
    setTitle("");
    setBody("");
    setEditorCategory(availableCategories[0].name);
    setEditorStatus("draft");
    setTags("");
  };
  const closeEditor = () => {
    setSelected(null);
    setCreating(false);
  };
  const refreshAction = async (payload: Record<string, unknown>) => {
    setBusy(true);
    const response = await fetch("/api/admin/content/text-template-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, contentType }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setCategoryError(data.error || "The action could not be completed.");
      return false;
    }
    setChecked([]);
    router.refresh();
    return true;
  };
  const bulk = async (actionName: string) => {
    let extra: Record<string, unknown> = {};
    if (actionName === "move") {
      const value = window.prompt(
        "Move selected templates to which category?",
        availableCategories[0].name,
      );
      if (!value) return;
      extra = { category: value };
    }
    if (actionName === "tags") {
      const value = window.prompt("Add tags (comma separated):");
      if (!value) return;
      extra = { tags: value };
    }
    await refreshAction({ action: actionName, ids: checked, ...extra });
  };
  const insertVariable = (value: string) => {
    const field = messageRef.current,
      start = field?.selectionStart ?? body.length,
      end = field?.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${value}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + value.length, start + value.length);
    });
  };
  const categoryAction = async (
    actionName: string,
    item?: Category,
    value?: string | number,
  ) => {
    setCategoryError("");
    const payload: Record<string, unknown> = {
      action: `category:${actionName}`,
      id: item?.id,
    };
    if (actionName === "add" || actionName === "rename") payload.name = value;
    if (actionName === "reorder") payload.position = value;
    if (await refreshAction(payload)) setNewCategory("");
  };

  return (
    <div className={`text-template-admin ${editorOpen ? "editor-open" : ""}`}>
      <div className="text-template-titlebar">
        <div>
          <span className="eyebrow">Sales content</span>
          <h1>{isEmail ? "Email Templates" : "Text Templates"}</h1>
          <p>
            Create, organize, and manage approved customer {isEmail ? "email " : ""}messaging.
          </p>
        </div>
        <div className="text-template-primary-actions">
          <TextTemplateImporter contentType={contentType} />
          <button className="btn btn-primary" onClick={beginNew} type="button">
            <Plus /> New template
          </button>
        </div>
      </div>
      <nav aria-label="Template categories" className="template-category-tabs">
        <button
          className={category === "All Templates" ? "active" : ""}
          onClick={() => {
            setCategory("All Templates");
            setPage(1);
          }}
          type="button"
        >
          <Upload /> All Templates <span>{items.length}</span>
        </button>
        {activeCategories.slice(0, 7).map((item, index) => {
          const Icon = categoryIcons[index % categoryIcons.length];
          return (
            <button
              className={category === item.name ? "active" : ""}
              key={item.id}
              onClick={() => {
                setCategory(item.name);
                setPage(1);
              }}
              type="button"
            >
              <Icon /> {item.name} <span>{categoryCount(item.name)}</span>
            </button>
          );
        })}
        {activeCategories.length > 7 && (
          <label className="template-more-categories">
            More <ChevronDown />
            <select
              aria-label="More categories"
              onChange={(event) => setCategory(event.target.value)}
              value={
                activeCategories.slice(7).some((item) => item.name === category)
                  ? category
                  : ""
              }
            >
              <option value="" disabled>
                Choose category
              </option>
              {activeCategories.slice(7).map((item) => (
                <option key={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        )}
      </nav>
      <section className="template-catalog" aria-label={`Saved ${isEmail ? "email" : "text"} templates`}>
        <div className="template-catalog-tools">
          <label>
            <Search />
            <input
              aria-label="Search templates"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search templates…"
              value={query}
            />
          </label>
          <select
            aria-label="Filter by tag"
            onChange={(event) => {
              setTag(event.target.value);
              setPage(1);
            }}
            value={tag}
          >
            <option value="all">All tags</option>
            {allTags.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            value={status}
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <select
            aria-label="Sort templates"
            onChange={(event) => setSort(event.target.value)}
            value={sort}
          >
            <option value="updated">Recently updated</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="az">Alphabetical A–Z</option>
            <option value="za">Alphabetical Z–A</option>
          </select>
          <button
            className="btn btn-secondary"
            onClick={() => setManageOpen(true)}
            type="button"
          >
            <Settings2 /> Manage categories
          </button>
        </div>
        {checked.length > 0 && (
          <div className="template-bulk-bar">
            <strong>{checked.length} selected</strong>
            <button onClick={() => bulk("publish")}>Publish</button>
            <button onClick={() => bulk("move")}>Move category</button>
            <button onClick={() => bulk("tags")}>Add tags</button>
            <button onClick={() => bulk("archive")}>Archive</button>
            {status === "archived" && (
              <button onClick={() => bulk("restore")}>Restore</button>
            )}
            <button onClick={() => setChecked([])}>Clear</button>
          </div>
        )}
        <div className="template-table-wrap">
          <table className="template-table">
            <thead>
              <tr>
                <th>
                  <input
                    aria-label="Select visible templates"
                    checked={
                      shown.length > 0 &&
                      shown.every((item) => checked.includes(item.id))
                    }
                    onChange={(event) =>
                      setChecked(
                        event.target.checked
                          ? Array.from(
                              new Set([
                                ...checked,
                                ...shown.map((item) => item.id),
                              ]),
                            )
                          : checked.filter(
                              (id) => !shown.some((item) => item.id === id),
                            ),
                      )
                    }
                    type="checkbox"
                  />
                </th>
                <th>Template name</th>
                <th>Category</th>
                <th>Tags</th>
                <th>{isEmail ? "Email preview" : "Message preview"}</th>
                <th>Status</th>
                <th>Updated</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr key={item.id} onClick={() => choose(item)}>
                  <td data-label="Select">
                    <input
                      aria-label={`Select ${item.title}`}
                      checked={checked.includes(item.id)}
                      onChange={(event) =>
                        setChecked((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id),
                        )
                      }
                      onClick={(event) => event.stopPropagation()}
                      type="checkbox"
                    />
                  </td>
                  <td data-label="Template">
                    <strong>{item.title}</strong>
                  </td>
                  <td data-label="Category">
                    <span className="category-pill">
                      {item.category || "General"}
                    </span>
                  </td>
                  <td data-label="Tags">
                    <div className="table-tag-list">
                      {item.tags.slice(0, 2).map((value) => (
                        <span key={value}>{value}</span>
                      ))}
                    </div>
                  </td>
                  <td data-label="Preview">
                    {item.body.length > 76
                      ? `${item.body.slice(0, 76)}…`
                      : item.body}
                  </td>
                  <td data-label="Status">
                    <span className={`status-pill ${item.status}`}>
                      <i />
                      {item.status}
                    </span>
                  </td>
                  <td data-label="Updated">
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                    }).format(new Date(item.updatedAt))}
                  </td>
                  <td>
                    <button
                      aria-label={`Actions for ${item.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuId((current) =>
                          current === item.id ? "" : item.id,
                        );
                      }}
                      type="button"
                    >
                      <MoreVertical />
                    </button>
                    {menuId === item.id && (
                      <div className="template-row-menu">
                        <button onClick={() => choose(item)}>Edit</button>
                        <button
                          onClick={() =>
                            refreshAction({ action: "duplicate", id: item.id })
                          }
                        >
                          <Copy /> Duplicate
                        </button>
                        <button
                          onClick={() => {
                            const value = window.prompt(
                              "Move to category:",
                              item.category,
                            );
                            if (value)
                              refreshAction({
                                action: "move",
                                ids: [item.id],
                                category: value,
                              });
                          }}
                        >
                          Move category
                        </button>
                        <button
                          onClick={() =>
                            refreshAction({
                              action:
                                item.status === "published"
                                  ? "draft"
                                  : "publish",
                              ids: [item.id],
                            })
                          }
                        >
                          {item.status === "published"
                            ? "Unpublish"
                            : "Publish"}
                        </button>
                        <button
                          onClick={() =>
                            refreshAction({
                              action:
                                item.status === "archived"
                                  ? "restore"
                                  : "archive",
                              ids: [item.id],
                            })
                          }
                        >
                          {item.status === "archived" ? (
                            <>
                              <RotateCcw /> Restore
                            </>
                          ) : (
                            <>
                              <Archive /> Archive
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && (
            <div className="template-empty">
              <Send />
              <h2>No matching templates</h2>
              <p>
                {items.length
                  ? "Adjust your search or filters."
                  : "Create a template or import an existing collection."}
              </p>
              <button
                className="btn btn-primary"
                onClick={beginNew}
                type="button"
              >
                <Plus /> New template
              </button>
            </div>
          )}
        </div>
        <footer className="template-pagination">
          <span>
            Showing {shown.length ? (page - 1) * 10 + 1 : 0}–
            {Math.min(page * 10, filtered.length)} of {filtered.length}{" "}
            templates
          </span>
          <div>
            <button
              aria-label="Previous page"
              disabled={page === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft />
            </button>
            <span>
              {page} / {pages}
            </span>
            <button
              aria-label="Next page"
              disabled={page === pages}
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
            >
              <ChevronRight />
            </button>
          </div>
        </footer>
      </section>
      {editorOpen && (
        <aside
          className="template-editor-drawer"
          aria-label={creating ? "New template" : "Edit template"}
        >
          <header>
            <h2>{creating ? "New Template" : "Edit Template"}</h2>
            <button
              aria-label="Close editor"
              onClick={closeEditor}
              type="button"
            >
              <X />
            </button>
          </header>
          {canManage ? (
            <form action={action}>
              <input name="id" type="hidden" value={selected?.id || ""} />
              <input name="contentType" type="hidden" value={contentType} />
              <input name="tags" type="hidden" value={tags} />
              <label>
                Template name <span>*</span>
                <input
                  maxLength={160}
                  minLength={2}
                  name="title"
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  value={title}
                />
              </label>
              <div className="template-editor-row">
                <label>
                  Category <span>*</span>
                  <select
                    name="category"
                    onChange={(event) => setEditorCategory(event.target.value)}
                    value={editorCategory}
                  >
                    {availableCategories.map((item) => (
                      <option key={item.id || item.name}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    onChange={(event) =>
                      setEditorStatus(event.target.value as Item["status"])
                    }
                    value={editorStatus}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
              </div>
              <div className="template-message-label">
                <strong>
                  {isEmail ? "Email body" : "Message"} <span>*</span>
                </strong>
                <span>
                  {body.length} characters
                  {!isEmail && ` · ${smsSegments} SMS segment${smsSegments === 1 ? "" : "s"}`}
                </span>
              </div>
              <textarea
                maxLength={12000}
                minLength={2}
                name="body"
                onChange={(event) => setBody(event.target.value)}
                ref={messageRef}
                required
                rows={9}
                value={body}
              />
              <div className="template-variables">
                <strong>Quick variables</strong>
                <div>
                  {quickVariables.map((variable) => (
                    <button
                      key={variable}
                      onClick={() => insertVariable(variable)}
                      type="button"
                    >
                      {variable}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                Tags
                <input
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="follow-up, lead, appointment"
                  value={tags}
                />
              </label>
              <div className={`template-sms-preview ${isEmail ? "email-preview" : ""}`}>
                <div className="template-phone-top">
                  {isEmail ? "Email preview" : "9:41"} <span>RunFloor</span>
                </div>
                <div className="template-message-bubble">
                  {body
                    .replaceAll("{{first_name}}", "John")
                    .replaceAll("{{last_name}}", "Smith")
                    .replaceAll("{{sales_rep}}", "Derrick")
                    .replaceAll("{{store_name}}", "BGC Dealerships")
                    .replaceAll("{{product}}", "your vehicle")
                    .replaceAll("{{phone}}", "our main line") ||
                    "Your message preview will appear here."}
                </div>
              </div>
              {state.error && (
                <p className="form-error" role="alert">
                  {state.error}
                </p>
              )}
              {state.success && (
                <p className="form-success" role="status">
                  {state.success}
                </p>
              )}
              <footer>
                <button
                  className="btn btn-ghost"
                  onClick={closeEditor}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={pending}
                  name="statusTarget"
                  type="submit"
                  value="draft"
                >
                  Save as draft
                </button>
                <button
                  className="btn btn-primary"
                  disabled={pending}
                  name="statusTarget"
                  type="submit"
                  value={editorStatus === "draft" ? "published" : editorStatus}
                >
                  {pending
                    ? "Saving…"
                    : selected
                      ? "Update template"
                      : "Publish template"}
                </button>
              </footer>
            </form>
          ) : (
            <p className="form-error">
              Sign in as a tenant administrator to manage shared templates.
            </p>
          )}
        </aside>
      )}
      {manageOpen && (
        <div className="template-import-backdrop">
          <section
            aria-label="Manage template categories"
            aria-modal="true"
            className="category-manager"
            role="dialog"
          >
            <header>
              <div>
                <span className="badge amber">Organization settings</span>
                <h2>Manage categories</h2>
                <p>
                  Rename, reorder, archive, or restore categories without
                  deleting templates.
                </p>
              </div>
              <button
                aria-label="Close category manager"
                onClick={() => setManageOpen(false)}
              >
                <X />
              </button>
            </header>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                categoryAction("add", undefined, newCategory);
              }}
            >
              <input
                aria-label="New category name"
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="New category name"
                value={newCategory}
              />
              <button className="btn btn-primary" disabled={busy}>
                Add category
              </button>
            </form>
            <div className="category-list">
              {activeCategories.map((item, index) => (
                <article
                  draggable
                  key={item.id}
                  onDragStart={() => setDraggedCategoryId(item.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    const source = activeCategories.find(
                      (categoryItem) => categoryItem.id === draggedCategoryId,
                    );
                    if (source && source.id !== item.id)
                      categoryAction("reorder", source, index * 10 - 5);
                    setDraggedCategoryId("");
                  }}
                >
                  <span className="category-drag">⋮⋮</span>
                  <strong>{item.name}</strong>
                  <button
                    onClick={() => {
                      const name = window.prompt("Rename category", item.name);
                      if (name) categoryAction("rename", item, name);
                    }}
                  >
                    Rename
                  </button>
                  <button onClick={() => categoryAction("archive", item)}>
                    Archive
                  </button>
                </article>
              ))}
            </div>
            {archivedCategories.length > 0 && (
              <>
                <h3>Archived</h3>
                <div className="category-list archived">
                  {archivedCategories.map((item) => (
                    <article key={item.id}>
                      <strong>{item.name}</strong>
                      <button onClick={() => categoryAction("restore", item)}>
                        Restore
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
            {categoryError && <p className="form-error">{categoryError}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
