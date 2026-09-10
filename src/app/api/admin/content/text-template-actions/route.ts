import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

async function context() {
  const viewer = await getViewer();
  if (
    !viewer?.organizationId ||
    viewer.demo ||
    !["tenant_admin", "platform_owner"].includes(viewer.role)
  )
    return null;
  return { viewer, db: await createClient() };
}
const validIds = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter(
          (id): id is string =>
            typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id),
        )
        .slice(0, 500)
    : [];

export async function POST(request: Request) {
  const current = await context();
  if (!current)
    return NextResponse.json(
      { error: "Tenant administrator access is required." },
      { status: 403 },
    );
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const action = String(body?.action || ""),
    organizationId = current.viewer.organizationId,
    contentType = body?.contentType === "email_template" ? "email_template" : "text_template";
  if (action === "duplicate") {
    const id = validIds([body?.id])[0];
    if (!id)
      return NextResponse.json({ error: "Invalid template." }, { status: 400 });
    const { data } = await current.db
      .from("sales_content_items")
      .select("title,body,status,category,tags")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("content_type", contentType)
      .single();
    if (!data)
      return NextResponse.json(
        { error: "Template not found." },
        { status: 404 },
      );
    const { error } = await current.db
      .from("sales_content_items")
      .insert({
        ...data,
        title: `${data.title} Copy`.slice(0, 160),
        status: "draft",
        organization_id: organizationId,
        content_type: contentType,
        created_by: current.viewer.id,
        updated_at: new Date().toISOString(),
      });
    return error
      ? NextResponse.json(
          { error: "The template could not be duplicated." },
          { status: 422 },
        )
      : NextResponse.json({ success: true });
  }
  if (action.startsWith("category:")) {
    const categoryId =
      typeof body?.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id)
        ? body.id
        : "";
    const name = String(body?.name || "")
      .trim()
      .slice(0, 120);
    if (action === "category:add") {
      if (name.length < 2)
        return NextResponse.json(
          { error: "Enter a category name." },
          { status: 400 },
        );
      const { error } = await current.db
        .from("text_template_categories")
        .insert({
          organization_id: organizationId,
          name,
          position: Number(body?.position) || 999,
        });
      return error
        ? NextResponse.json(
            { error: "That category could not be added." },
            { status: 422 },
          )
        : NextResponse.json({ success: true });
    }
    if (!categoryId)
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    if (action === "category:rename") {
      if (name.length < 2)
        return NextResponse.json(
          { error: "Enter a category name." },
          { status: 400 },
        );
      const { data: old } = await current.db
        .from("text_template_categories")
        .select("name")
        .eq("id", categoryId)
        .eq("organization_id", organizationId)
        .single();
      if (!old)
        return NextResponse.json(
          { error: "Category not found." },
          { status: 404 },
        );
      const { error } = await current.db
        .from("text_template_categories")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", categoryId)
        .eq("organization_id", organizationId);
      if (!error)
        await current.db
          .from("sales_content_items")
          .update({ category: name, updated_at: new Date().toISOString() })
          .eq("organization_id", organizationId)
          .in("content_type", ["text_template", "email_template"])
          .eq("category", old.name);
      return error
        ? NextResponse.json(
            { error: "The category could not be renamed." },
            { status: 422 },
          )
        : NextResponse.json({ success: true });
    }
    const updates =
      action === "category:archive"
        ? { archived: true }
        : action === "category:restore"
          ? { archived: false }
          : action === "category:reorder"
            ? { position: Number(body?.position) || 0 }
            : null;
    if (!updates)
      return NextResponse.json(
        { error: "Unknown category action." },
        { status: 400 },
      );
    const { error } = await current.db
      .from("text_template_categories")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", categoryId)
      .eq("organization_id", organizationId);
    return error
      ? NextResponse.json(
          { error: "The category could not be updated." },
          { status: 422 },
        )
      : NextResponse.json({ success: true });
  }
  const ids = validIds(body?.ids);
  if (!ids.length)
    return NextResponse.json(
      { error: "Select at least one template." },
      { status: 400 },
    );
  let update: Record<string, unknown> | null = null;
  if (action === "publish") update = { status: "published" };
  if (action === "draft") update = { status: "draft" };
  if (action === "archive") update = { status: "archived" };
  if (action === "restore") update = { status: "draft" };
  if (action === "move")
    update = {
      category: String(body?.category || "")
        .trim()
        .slice(0, 120),
    };
  if (action === "tags") {
    const tags = String(body?.tags || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);
    const { data } = await current.db
      .from("sales_content_items")
      .select("id,tags")
      .eq("organization_id", organizationId)
      .eq("content_type", contentType)
      .in("id", ids);
    for (const item of data || [])
      await current.db
        .from("sales_content_items")
        .update({
          tags: Array.from(new Set([...(item.tags || []), ...tags])).slice(
            0,
            20,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("organization_id", organizationId);
    return NextResponse.json({ success: true });
  }
  if (!update)
    return NextResponse.json(
      { error: "Unknown template action." },
      { status: 400 },
    );
  const { error } = await current.db
    .from("sales_content_items")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("content_type", contentType)
    .in("id", ids);
  return error
    ? NextResponse.json(
        { error: "Templates could not be updated." },
        { status: 422 },
      )
    : NextResponse.json({ success: true });
}
