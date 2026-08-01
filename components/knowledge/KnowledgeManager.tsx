"use client";

import { useEffect, useMemo, useState } from "react";

type KnowledgeEntry = {
  id: string;
  title: string;
  content: string;
  category: string;
  source: string;
  tags: string[];
  fileName?: string | null;
  fileType?: string | null;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeManagerProps = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
};

const CATEGORIES = [
  "Government schemes",
  "Education",
  "Healthcare",
  "Agriculture",
  "Economy",
  "Startups",
  "Laws and policies",
  "Other",
];

export default function KnowledgeManager({ user }: KnowledgeManagerProps) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [source, setSource] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshEntries() {
    const res = await fetch(`/api/knowledge?search=${encodeURIComponent(search)}`);
    const data = await res.json();
    setEntries(data.entries ?? []);
  }

  useEffect(() => {
    void refreshEntries();
  }, [search]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("category", category);
    formData.append("source", source);
    formData.append("tags", tags);
    formData.append("content", content);
    if (file) formData.append("file", file);
    if (editingId) formData.append("id", editingId);

    const res = await fetch("/api/knowledge", {
      method: editingId ? "PUT" : "POST",
      body: formData,
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      setMessage(editingId ? "Knowledge updated." : "Knowledge imported.");
      setTitle("");
      setCategory(CATEGORIES[0]);
      setSource("");
      setTags("");
      setContent("");
      setFile(null);
      setEditingId(null);
      await refreshEntries();
    } else {
      setMessage(data.error || "Unable to save knowledge entry.");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      await refreshEntries();
    }
  }

  function startEdit(entry: KnowledgeEntry) {
    setEditingId(entry.id);
    setTitle(entry.title);
    setCategory(entry.category || CATEGORIES[0]);
    setSource(entry.source);
    setTags(entry.tags.join(", "));
    setContent(entry.content);
    setFile(null);
  }

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries;
    const term = search.toLowerCase();
    return entries.filter((entry) =>
      [entry.title, entry.category, entry.source, entry.content, entry.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [entries, search]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-400">Knowledge Management</p>
          <h1 className="mt-3 text-3xl font-semibold">India Digital Brain knowledge sources</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Import documents, curate knowledge, and manage sources that power RAG responses for Indian public services and policy topics.
          </p>
          <p className="mt-3 text-sm text-slate-500">Signed in as {user.name ?? user.email}</p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" required />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>Source</span>
              <input value={source} onChange={(e) => setSource(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" required />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>Tags</span>
              <input value={tags} onChange={(e) => setTags(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="policy, health, finance" />
            </label>
          </div>

          <label className="mt-4 flex flex-col gap-2 text-sm">
            <span>Content</span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Paste or edit knowledge content" />
          </label>

          <label className="mt-4 flex flex-col gap-2 text-sm">
            <span>Import document (PDF, DOCX, TXT, CSV, Markdown)</span>
            <input type="file" accept=".pdf,.docx,.txt,.csv,.md,.markdown" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
          </label>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {loading ? "Saving..." : editingId ? "Update knowledge" : "Import knowledge"}
            </button>
            {editingId ? <button type="button" onClick={() => { setEditingId(null); setTitle(""); setCategory(CATEGORIES[0]); setSource(""); setTags(""); setContent(""); setFile(null); }} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Cancel</button> : null}
          </div>
          {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
        </form>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Knowledge sources</h2>
              <p className="text-sm text-slate-400">Search, update, or remove imported knowledge entries.</p>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search knowledge" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 sm:w-72" />
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Tags</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="align-top text-slate-300">
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-100">{entry.title}</div>
                      <div className="mt-1 max-w-xl text-xs text-slate-500 line-clamp-3">{entry.content}</div>
                    </td>
                    <td className="px-3 py-3">{entry.category}</td>
                    <td className="px-3 py-3">{entry.source}</td>
                    <td className="px-3 py-3">{entry.tags.join(", ")}</td>
                    <td className="px-3 py-3">{new Date(entry.updatedAt).toLocaleDateString()}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(entry)} className="rounded bg-slate-800 px-2 py-1 text-xs">Edit</button>
                        <button type="button" onClick={() => void handleDelete(entry.id)} className="rounded bg-red-600/80 px-2 py-1 text-xs">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
