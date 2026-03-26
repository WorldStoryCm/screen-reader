import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Tag } from "../../types/capture";

export default function TagsView() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    try {
      const list = await invoke<Tag[]>("list_tags");
      setTags(list);
    } catch (err) {
      console.error("Failed to load tags:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setError(`Tag "${name}" already exists`);
      return;
    }
    setError(null);
    try {
      const tag = await invoke<Tag>("create_tag", { name });
      setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
    } catch (err) {
      setError(String(err));
    }
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setError(null);
  }

  async function handleRename() {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) return;
    if (tags.some((t) => t.id !== editingId && t.name.toLowerCase() === name.toLowerCase())) {
      setError(`Tag "${name}" already exists`);
      return;
    }
    setError(null);
    try {
      await invoke("rename_tag", { id: editingId, name });
      setTags((prev) =>
        prev
          .map((t) => (t.id === editingId ? { ...t, name } : t))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await invoke("delete_tag", { id });
      setTags((prev) => prev.filter((t) => t.id !== id));
      if (editingId === id) setEditingId(null);
    } catch (err) {
      setError(String(err));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 className="text-sm font-semibold text-neutral-300">Tags</h2>

      {/* Create new tag */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New tag name..."
          className="flex-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-xs text-neutral-300"
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded font-medium transition-colors"
        >
          Add
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {/* Tag list */}
      <div className="border border-neutral-700 rounded divide-y divide-neutral-800">
        {tags.length === 0 ? (
          <div className="p-4 text-neutral-500 text-sm text-center">No tags yet</div>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 px-3 py-2 group"
            >
              {editingId === tag.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 px-2 py-0.5 bg-neutral-900 border border-neutral-600 rounded text-xs text-neutral-200"
                    autoFocus
                  />
                  <button
                    onClick={handleRename}
                    className="px-2 py-0.5 text-[16px] bg-green-700 hover:bg-green-600 rounded transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-2 py-0.5 text-[16px] bg-neutral-700 hover:bg-neutral-600 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-neutral-200">{tag.name}</span>
                  <button
                    onClick={() => startEdit(tag)}
                    className="px-2 py-0.5 text-[16px] bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded opacity-0 group-hover:opacity-100 transition-all"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="px-2 py-0.5 text-[16px] bg-red-900/50 hover:bg-red-800/50 text-red-400 rounded opacity-0 group-hover:opacity-100 transition-all"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <p className="text-[16px] text-neutral-600">
        {tags.length} tag{tags.length !== 1 ? "s" : ""}. Tags are shared between captures and cards.
      </p>
    </div>
  );
}
