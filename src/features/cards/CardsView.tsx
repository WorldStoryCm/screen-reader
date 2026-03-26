import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { Card, CreateCardInput, CardSource } from "../../types/card";
import { getCardLevel, LEVELS, LEVEL_LABELS, LEVEL_COLORS, LEVEL_ROMAN, CATEGORIES } from "../../types/card";
import type { Tag } from "../../types/capture";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { Textarea } from "@/components/textarea";
import { Badge } from "@/components/badge";
import { ScrollArea } from "@/components/scroll-area";
import { Separator } from "@/components/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/dropdown-menu";

export default function CardsView() {
  const [cards, setCards] = useState<Card[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<Card | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCards = useCallback(async () => {
    try {
      const list = await invoke<Card[]>("list_cards", {
        limit: 200,
        offset: 0,
        statusFilter: filterLevel,
        tag: filterTag,
        search: search || null,
      });
      setCards(list);
    } catch (err) {
      console.error("Failed to load cards:", err);
    } finally {
      setLoading(false);
    }
  }, [filterTag, filterLevel, search]);

  useEffect(() => {
    invoke<Tag[]>("list_tags").then(setAllTags).catch(console.error);
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  async function handleCreate(input: CreateCardInput) {
    try {
      const card = await invoke<Card>("create_card", { input });
      setCards((prev) => [card, ...prev]);
      setShowCreate(false);
    } catch (err) {
      console.error("Failed to create card:", err);
    }
  }

  async function handleLevelChange(card: Card, newLevel: number) {
    await invoke("update_card", { id: card.id, status: String(newLevel) });
    const updated = { ...card, status: String(newLevel) };
    setCards((prev) => prev.map((c) => (c.id === card.id ? updated : c)));
    if (selected?.id === card.id) setSelected(updated);
  }

  async function handleDelete(id: string) {
    await invoke("delete_card", { id });
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  async function handleExportTsv() {
    try {
      const filePath = await save({
        defaultPath: "cards.tsv",
        filters: [{ name: "TSV", extensions: ["tsv"] }],
      });
      if (!filePath) return;
      const count = await invoke<number>("export_cards_csv", { path: filePath });
      alert(`Exported ${count} cards (TSV)`);
    } catch (err) {
      console.error("Export failed:", err);
    }
  }

  async function handleExportJson() {
    try {
      const filePath = await save({
        defaultPath: "vocabulary.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!filePath) return;
      const count = await invoke<number>("export_cards_json", { path: filePath });
      alert(`Exported ${count} cards (JSON)`);
    } catch (err) {
      console.error("Export failed:", err);
    }
  }

  async function handleImportJson(mode: string) {
    try {
      const filePath = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (!filePath) return;
      const result = await invoke<{ imported: number; skipped: number; updated: number; errors: string[] }>(
        "import_cards_json", { path: filePath, mode }
      );
      const parts = [];
      if (result.imported > 0) parts.push(`${result.imported} imported`);
      if (result.updated > 0) parts.push(`${result.updated} updated`);
      if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
      alert(parts.join(", ") || "No changes");
      if (result.imported > 0 || result.updated > 0) loadCards();
    } catch (err) {
      console.error("Import failed:", err);
    }
  }

  async function handleSaveEdit(card: Card, field: string, value: string) {
    await invoke("update_card", { id: card.id, [field]: value });
    const updated = { ...card, [field]: value };
    setCards((prev) => prev.map((c) => (c.id === card.id ? updated : c)));
    setSelected(updated);
  }

  async function handleTagsChange(card: Card, tags: string[]) {
    await invoke("update_card", { id: card.id, tags });
    const updated = { ...card, tags };
    setCards((prev) => prev.map((c) => (c.id === card.id ? updated : c)));
    setSelected(updated);
  }

  async function handleSourceAdd(card: Card, sourceType: string, sourceName: string) {
    try {
      const src = await invoke<CardSource>("add_card_source", {
        cardId: card.id, sourceType, sourceName,
      });
      const updated = { ...card, sources: [...card.sources, src] };
      setCards((prev) => prev.map((c) => (c.id === card.id ? updated : c)));
      setSelected(updated);
    } catch (err) {
      console.error("Failed to add source:", err);
    }
  }

  async function handleSourceRemove(card: Card, sourceId: string) {
    try {
      await invoke("remove_card_source", { cardId: card.id, sourceId });
      const updated = { ...card, sources: card.sources.filter((s) => s.source_id !== sourceId) };
      setCards((prev) => prev.map((c) => (c.id === card.id ? updated : c)));
      setSelected(updated);
    } catch (err) {
      console.error("Failed to remove source:", err);
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
    <div className="flex h-full">
      {/* Left: list */}
      <div className="w-1/2 min-w-0 border-r border-border flex flex-col">
        {/* Toolbar */}
        <div className="p-2 border-b border-border space-y-2 shrink-0">
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards..."
              className="flex-1"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportJson}>JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportTsv}>TSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">Import</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleImportJson("skip")}>Skip existing</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleImportJson("update")}>Update existing</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleImportJson("new")}>Import as new</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => setShowCreate(true)}>+ New</Button>
          </div>
          <div className="flex gap-1 items-center">
            <Button
              variant={!filterLevel && !filterTag ? "default" : "secondary"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => { setFilterLevel(null); setFilterTag(null); }}
            >
              All
            </Button>
            {LEVELS.map((lv) => (
              <Button
                key={lv}
                variant="secondary"
                size="sm"
                className={`h-7 px-2 text-xs ${filterLevel === String(lv) ? LEVEL_COLORS[lv] : ""}`}
                onClick={() => { setFilterLevel(String(lv)); setFilterTag(null); }}
              >
                {LEVEL_ROMAN[lv]}
              </Button>
            ))}
            {allTags.length > 0 && (
              <Select
                value={filterTag || ""}
                onValueChange={(val) => {
                  if (val === "__all__") { setFilterTag(null); }
                  else { setFilterTag(val); setFilterLevel(null); }
                }}
              >
                <SelectTrigger className={`h-7 w-auto min-w-[70px] text-xs ${filterTag ? "border-primary text-primary" : ""}`}>
                  <SelectValue placeholder="Tag..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All tags</SelectItem>
                  {allTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.name}>{tag.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Card list */}
        <ScrollArea className="flex-1">
          {cards.length === 0 ? (
            <div className="p-4 text-muted-foreground text-sm text-center">No cards yet</div>
          ) : (
            cards.map((card) => {
              const level = getCardLevel(card.status);
              return (
                <div
                  key={card.id}
                  onClick={() => setSelected(card)}
                  className={`p-3 border-b border-border cursor-pointer transition-colors ${
                    selected?.id === card.id ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-foreground">{card.jp_text}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LEVEL_COLORS[level]}`}>
                      {LEVEL_ROMAN[level]}
                    </span>
                  </div>
                  {card.reading && (
                    <p className="text-sm text-muted-foreground mt-0.5">{card.reading}</p>
                  )}
                  {card.translation && (
                    <p className="text-sm text-secondary-foreground mt-0.5">{card.translation}</p>
                  )}
                  {card.meaning && (
                    <p className="text-xs text-muted-foreground mt-0.5">{card.meaning}</p>
                  )}
                  {(card.category || card.tags.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {card.category && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded-full">{card.category}</span>
                      )}
                      {card.tags.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                  {card.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {card.sources.map((s) => (
                        <span key={s.source_id} className="text-[10px] px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 rounded-full">{s.source_name}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* Right: detail or create */}
      <div className="w-1/2 overflow-y-auto">
        {showCreate ? (
          <CardForm
            allTags={allTags}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        ) : selected ? (
          <CardDetail
            card={selected}
            allTags={allTags}
            onLevelChange={(lv) => handleLevelChange(selected, lv)}
            onSave={(field, value) => handleSaveEdit(selected, field, value)}
            onTagsChange={(tags) => handleTagsChange(selected, tags)}
            onDelete={() => handleDelete(selected.id)}
            onSourceAdd={(type, name) => handleSourceAdd(selected, type, name)}
            onSourceRemove={(id) => handleSourceRemove(selected, id)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a card or create a new one
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tag Chips Input with Typeahead ---
function TagChipsInput({
  selected,
  allTags,
  onChange,
}: {
  selected: string[];
  allTags: Tag[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = allTags.filter(
    (t) => !selected.includes(t.name) && t.name.toLowerCase().includes(input.toLowerCase())
  );

  function add(name: string) {
    onChange([...selected, name]);
    setInput("");
    inputRef.current?.focus();
  }

  function remove(name: string) {
    onChange(selected.filter((t) => t !== name));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !input && selected.length > 0) {
      remove(selected[selected.length - 1]);
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 p-1.5 bg-background border border-input rounded-md min-h-[36px] items-center focus-within:ring-1 focus-within:ring-ring">
        {selected.map((tag) => (
          <Badge key={tag} className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full ring-0">
            {tag}
            <button type="button" onClick={() => remove(tag)} className="ml-1 hover:text-destructive text-[10px] leading-none">
              &times;
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? "Add tags..." : ""}
          className="flex-1 min-w-[60px] bg-transparent text-sm text-foreground outline-none px-1 py-0.5 placeholder:text-muted-foreground"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-[120px] overflow-y-auto">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(tag.name)}
              className="w-full px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent text-left transition-colors"
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Card Form (create) ---
function CardForm({
  allTags,
  initialJp = "",
  initialCaptureId = null,
  onSave,
  onCancel,
}: {
  allTags: Tag[];
  initialJp?: string;
  initialCaptureId?: string | null;
  onSave: (input: CreateCardInput) => void;
  onCancel: () => void;
}) {
  const [jpText, setJpText] = useState(initialJp);
  const [reading, setReading] = useState("");
  const [translation, setTranslation] = useState("");
  const [meaning, setMeaning] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">New Card</h3>
      <Separator />
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">Japanese</Label>
        <Input value={jpText} onChange={(e) => setJpText(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">Reading</Label>
        <Input value={reading} onChange={(e) => setReading(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">Translation</Label>
        <Input value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder="Direct translation" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">Meaning</Label>
        <Input value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="Definition / explanation" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">Note</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="resize-none" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">Tags</Label>
        <TagChipsInput selected={tags} allTags={allTags} onChange={setTags} />
      </div>
      <Separator />
      <div className="flex gap-2">
        <Button
          onClick={() => onSave({
            jp_text: jpText, reading, meaning,
            translation: translation || null,
            note: note || null,
            category: (category && category !== "__none__") ? category : null,
            source_capture_id: initialCaptureId,
            source_text_fragment: null, tags,
          })}
          disabled={!jpText.trim()}
        >
          Save
        </Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// --- Card Detail (view/edit) ---
function CardDetail({
  card,
  allTags,
  onLevelChange,
  onSave,
  onTagsChange,
  onDelete,
  onSourceAdd,
  onSourceRemove,
}: {
  card: Card;
  allTags: Tag[];
  onLevelChange: (level: number) => void;
  onSave: (field: string, value: string) => void;
  onTagsChange: (tags: string[]) => void;
  onDelete: () => void;
  onSourceAdd: (sourceType: string, sourceName: string) => void;
  onSourceRemove: (sourceId: string) => void;
}) {
  const level = getCardLevel(card.status);

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-foreground">{card.jp_text}</h3>
        <Button variant="destructive" size="sm" onClick={onDelete}>Delete</Button>
      </div>

      <Separator />

      <EditableField label="Reading" value={card.reading} onSave={(v) => onSave("reading", v)} />
      <EditableField label="Translation" value={card.translation} onSave={(v) => onSave("translation", v)} />
      <EditableField label="Meaning" value={card.meaning} onSave={(v) => onSave("meaning", v)} />
      <EditableField label="Note" value={card.note || ""} onSave={(v) => onSave("note", v)} multiline />

      {/* Category */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">Category</Label>
        <Select
          value={card.category || "__none__"}
          onValueChange={(val) => onSave("category", val === "__none__" ? "" : val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Level */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">Level</Label>
        <div className="flex gap-1">
          {LEVELS.map((lv) => (
            <Button
              key={lv}
              variant="secondary"
              size="sm"
              className={`flex-1 ${level === lv ? LEVEL_COLORS[lv] : "text-muted-foreground"}`}
              onClick={() => onLevelChange(lv)}
              title={LEVEL_LABELS[lv]}
            >
              {LEVEL_ROMAN[lv]}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{LEVEL_LABELS[level]}</p>
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">Tags</Label>
        <TagChipsInput selected={card.tags} allTags={allTags} onChange={onTagsChange} />
      </div>

      {/* Sources */}
      <SourcesSection sources={card.sources} onAdd={onSourceAdd} onRemove={onSourceRemove} />
    </div>
  );
}

// --- Sources Section ---
function SourcesSection({
  sources,
  onAdd,
  onRemove,
}: {
  sources: CardSource[];
  onAdd: (sourceType: string, sourceName: string) => void;
  onRemove: (sourceId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState("game");
  const [newName, setNewName] = useState("");

  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">Sources</Label>
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {sources.map((s) => (
            <span key={s.source_id} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-emerald-900/40 text-emerald-300 rounded-full">
              <span className="text-[10px] text-emerald-500">{s.source_type}</span>
              {s.source_name}
              <button onClick={() => onRemove(s.source_id)} className="hover:text-destructive text-[10px] leading-none">&times;</button>
            </span>
          ))}
        </div>
      )}
      {adding ? (
        <div className="flex gap-1.5 items-center">
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="game">game</SelectItem>
              <SelectItem value="manual">manual</SelectItem>
              <SelectItem value="import">import</SelectItem>
              <SelectItem value="other">other</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Source name"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                onAdd(newType, newName.trim()); setNewName(""); setAdding(false);
              }
            }}
            autoFocus
          />
          <Button
            size="sm"
            className="bg-emerald-700 hover:bg-emerald-600 text-white"
            onClick={() => { if (newName.trim()) { onAdd(newType, newName.trim()); setNewName(""); setAdding(false); } }}
          >
            Add
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setAdding(true)}>
          + Add source
        </Button>
      )}
    </div>
  );
}

function EditableField({
  label,
  value,
  onSave,
  multiline = false,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function handleSave() {
    if (draft !== value) onSave(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <Label className="text-muted-foreground">{label}</Label>
        {multiline ? (
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={handleSave} rows={2}
            className="resize-none" autoFocus />
        ) : (
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus />
        )}
      </div>
    );
  }

  return (
    <div onClick={() => { setDraft(value); setEditing(true); }} className="cursor-pointer group space-y-1">
      <Label className="text-muted-foreground">{label}</Label>
      <p className="text-sm text-secondary-foreground group-hover:text-primary transition-colors">
        {value || <span className="text-muted-foreground italic">Click to add</span>}
      </p>
    </div>
  );
}
