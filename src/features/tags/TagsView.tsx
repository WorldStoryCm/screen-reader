import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Tag } from "../../types/capture";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

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
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Tags</h2>

      {/* Create new tag */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New tag name..."
          className="flex-1"
        />
        <Button
          onClick={handleCreate}
          disabled={!newName.trim()}
        >
          Add
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Tag list */}
      <div className="border border-border rounded-md divide-y divide-border">
        {tags.length === 0 ? (
          <div className="p-4 text-muted-foreground text-sm text-center">No tags yet</div>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 px-3 py-2 group"
            >
              {editingId === tag.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1"
                    autoFocus
                  />
                  <Button size="sm" className="bg-emerald-700 hover:bg-emerald-600 text-white" onClick={handleRename}>
                    Save
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-foreground">{tag.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                    onClick={() => startEdit(tag)}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => handleDelete(tag.id)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {tags.length} tag{tags.length !== 1 ? "s" : ""}. Tags are shared between captures and cards.
      </p>
    </div>
  );
}
