import {useCallback, useEffect, useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import type {Tag} from "../../types/capture";
import {Button} from "@/components/button";
import {Input} from "@/components/input";

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
            setError(`"${name}" already exists`);
            return;
        }
        setError(null);
        try {
            const tag = await invoke<Tag>("create_tag", {name});
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
            setError(`"${name}" already exists`);
            return;
        }
        setError(null);
        try {
            await invoke("rename_tag", {id: editingId, name});
            setTags((prev) =>
                prev
                    .map((t) => (t.id === editingId ? {...t, name} : t))
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
            setEditingId(null);
        } catch (err) {
            setError(String(err));
        }
    }

    async function handleDelete(id: string) {
        try {
            await invoke("delete_tag", {id});
            setTags((prev) => prev.filter((t) => t.id !== id));
            if (editingId === id) setEditingId(null);
        } catch (err) {
            setError(String(err));
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Loading tags...
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-5 pb-3 space-y-3 shrink-0">
                <h2 className="text-base font-semibold text-foreground">Tags</h2>

                {editingId ? (
                    <div className="flex items-center gap-2">
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
                        <Button onClick={handleRename}>
                            Rename
                        </Button>
                        <Button variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                            placeholder="New tag name..."
                            className="flex-1"
                        />
                        <Button onClick={handleCreate} disabled={!newName.trim()}>
                            Create tag
                        </Button>
                    </div>
                )}

                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}

                <p className="text-sm text-muted-foreground/60">
                    {tags.length} tag{tags.length !== 1 ? "s" : ""} · shared between captures and cards
                </p>
            </div>

            {/* Tag grid */}
            <div className="flex-1 overflow-y-auto scrollbar-visible px-5 pb-5">
                {tags.length === 0 ? (
                    <div className="flex flex-col items-center py-12 px-4 gap-2">
                        <span className="text-muted-foreground/30 text-2xl">#</span>
                        <p className="text-sm text-muted-foreground text-center">
                            Create your first tag to organize captures and cards
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
                        {tags.map((tag) => (
                            <div
                                key={tag.id}
                                className={`group relative flex items-center justify-center rounded-lg border bg-card px-3 py-3 text-center transition-colors hover:bg-accent/40 ${
                                    editingId === tag.id ? "border-primary ring-1 ring-primary" : "border-border"
                                }`}
                            >
                                <span className="text-base text-foreground font-medium">{tag.name}</span>
                                <div
                                    className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-6 w-6 p-0 text-muted-foreground text-xs"
                                        onClick={() => startEdit(tag)}
                                        title="Rename"
                                    >
                                        &#x270E;
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-6 w-6 p-0 text-destructive hover:text-destructive text-xs"
                                        onClick={() => handleDelete(tag.id)}
                                        title="Delete"
                                    >
                                        &times;
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
