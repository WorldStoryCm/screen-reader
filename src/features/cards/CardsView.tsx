import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { Card, CreateCardInput } from "../../types/card";
import { getCardLevel, LEVELS, LEVEL_LABELS, LEVEL_COLORS, LEVEL_ROMAN } from "../../types/card";
import type { Tag } from "../../types/capture";

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

  async function handleExport() {
    try {
      const filePath = await save({
        defaultPath: "cards.tsv",
        filters: [{ name: "TSV", extensions: ["tsv"] }],
      });
      if (!filePath) return;
      const count = await invoke<number>("export_cards_csv", { path: filePath });
      alert(`Exported ${count} cards to ${filePath}`);
    } catch (err) {
      console.error("Export failed:", err);
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

  if (loading) {
    return <div className="flex items-center justify-center h-full text-neutral-500 text-sm">Loading...</div>;
  }

  return (
    <div className="flex h-full">
      {/* Left: list */}
      <div className="w-1/2 border-r border-neutral-700 flex flex-col">
        {/* Toolbar */}
        <div className="p-2 border-b border-neutral-800 space-y-2 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards..."
              className="flex-1 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-neutral-300"
            />
            <button
              onClick={handleExport}
              className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded font-medium transition-colors"
            >
              Export
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded font-medium transition-colors"
            >
              + New
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto scrollbar-visible">
            <button
              onClick={() => { setFilterLevel(null); setFilterTag(null); }}
              className={`px-2 py-0.5 text-[14px] rounded whitespace-nowrap transition-colors shrink-0 ${
                !filterLevel && !filterTag ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400"
              }`}
            >
              All
            </button>
            {LEVELS.map((lv) => (
              <button
                key={lv}
                onClick={() => { setFilterLevel(String(lv)); setFilterTag(null); }}
                className={`px-2 py-0.5 text-[14px] rounded whitespace-nowrap transition-colors shrink-0 ${
                  filterLevel === String(lv) ? LEVEL_COLORS[lv] : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {LEVEL_ROMAN[lv]}
              </button>
            ))}
            {allTags.slice(0, 6).map((tag) => (
              <button
                key={tag.id}
                onClick={() => { setFilterTag(tag.name); setFilterLevel(null); }}
                className={`px-2 py-0.5 text-[14px] rounded whitespace-nowrap transition-colors shrink-0 ${
                  filterTag === tag.name ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>

        {/* Card list */}
        <div className="flex-1 overflow-y-auto">
          {cards.length === 0 ? (
            <div className="p-4 text-neutral-500 text-sm text-center">No cards yet</div>
          ) : (
            cards.map((card) => {
              const level = getCardLevel(card.status);
              return (
                <div
                  key={card.id}
                  onClick={() => setSelected(card)}
                  className={`p-3 border-b border-neutral-800 cursor-pointer transition-colors ${
                    selected?.id === card.id ? "bg-neutral-800" : "hover:bg-neutral-800/50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-neutral-200">{card.jp_text}</span>
                    <span className={`text-[14px] px-1.5 py-0.5 rounded font-medium ${LEVEL_COLORS[level]}`}>
                      {LEVEL_ROMAN[level]}
                    </span>
                  </div>
                  {card.reading && (
                    <p className="text-xs text-neutral-400 mt-0.5">{card.reading}</p>
                  )}
                  {card.meaning && (
                    <p className="text-xs text-neutral-500 mt-0.5">{card.meaning}</p>
                  )}
                  {card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {card.tags.map((t) => (
                        <span key={t} className="text-[10px] px-1 py-0 bg-blue-900/40 text-blue-300 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
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
          />
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
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
      <div className="flex flex-wrap gap-1 p-1 bg-neutral-800 border border-neutral-700 rounded min-h-[32px] items-center">
        {selected.map((tag) => (
          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 text-[11px] bg-blue-600 text-white rounded">
            {tag}
            <button type="button" onClick={() => remove(tag)} className="hover:text-red-300 text-[10px] leading-none">
              &times;
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? "Add tags..." : ""}
          className="flex-1 min-w-[60px] bg-transparent text-xs text-neutral-300 outline-none px-1 py-0.5"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-neutral-800 border border-neutral-700 rounded shadow-lg max-h-[120px] overflow-y-auto">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(tag.name)}
              className="w-full px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 text-left"
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
  const [meaning, setMeaning] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-semibold">New Card</h3>
      <div>
        <label className="block text-[14px] text-neutral-500 mb-0.5">Japanese</label>
        <input value={jpText} onChange={(e) => setJpText(e.target.value)}
          className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-200" />
      </div>
      <div>
        <label className="block text-[14px] text-neutral-500 mb-0.5">Reading</label>
        <input value={reading} onChange={(e) => setReading(e.target.value)}
          className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-200" />
      </div>
      <div>
        <label className="block text-[14px] text-neutral-500 mb-0.5">Meaning</label>
        <input value={meaning} onChange={(e) => setMeaning(e.target.value)}
          className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-200" />
      </div>
      <div>
        <label className="block text-[14px] text-neutral-500 mb-0.5">Note</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-xs text-neutral-300 resize-none" />
      </div>
      <div>
        <label className="block text-[14px] text-neutral-500 mb-1">Tags</label>
        <TagChipsInput selected={tags} allTags={allTags} onChange={setTags} />
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={() => onSave({ jp_text: jpText, reading, meaning, note: note || null, source_capture_id: initialCaptureId, source_text_fragment: null, tags })}
          disabled={!jpText.trim()}
          className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded font-medium transition-colors">
          Save
        </button>
        <button onClick={onCancel}
          className="px-4 py-1.5 text-xs bg-neutral-700 hover:bg-neutral-600 rounded transition-colors">
          Cancel
        </button>
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
}: {
  card: Card;
  allTags: Tag[];
  onLevelChange: (level: number) => void;
  onSave: (field: string, value: string) => void;
  onTagsChange: (tags: string[]) => void;
  onDelete: () => void;
}) {
  const level = getCardLevel(card.status);

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-neutral-200">{card.jp_text}</h3>
        <button onClick={onDelete}
          className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800/50 text-red-400 rounded transition-colors">
          Delete
        </button>
      </div>

      {/* Editable fields */}
      <EditableField label="Reading" value={card.reading} onSave={(v) => onSave("reading", v)} />
      <EditableField label="Meaning" value={card.meaning} onSave={(v) => onSave("meaning", v)} />
      <EditableField label="Note" value={card.note || ""} onSave={(v) => onSave("note", v)} multiline />

      {/* Level */}
      <div>
        <label className="block text-[14px] text-neutral-500 mb-1">Level</label>
        <div className="flex gap-1">
          {LEVELS.map((lv) => (
            <button key={lv} onClick={() => onLevelChange(lv)}
              className={`flex-1 py-1.5 text-[14px] rounded transition-colors ${
                level === lv ? LEVEL_COLORS[lv] : "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
              }`}
              title={LEVEL_LABELS[lv]}
            >
              {LEVEL_ROMAN[lv]}
            </button>
          ))}
        </div>
        <p className="text-[14px] text-neutral-600 mt-1">{LEVEL_LABELS[level]}</p>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-[14px] text-neutral-500 mb-1">Tags</label>
        <TagChipsInput selected={card.tags} allTags={allTags} onChange={onTagsChange} />
      </div>
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
    const cls = "w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-200";
    return (
      <div>
        <label className="block text-[14px] text-neutral-500 mb-0.5">{label}</label>
        {multiline ? (
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={handleSave} rows={2}
            className={cls + " resize-none text-xs"} autoFocus />
        ) : (
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className={cls} autoFocus />
        )}
      </div>
    );
  }

  return (
    <div onClick={() => { setDraft(value); setEditing(true); }} className="cursor-pointer group">
      <label className="block text-[14px] text-neutral-500 mb-0.5">{label}</label>
      <p className="text-sm text-neutral-300 group-hover:text-blue-400 transition-colors">
        {value || <span className="text-neutral-600 italic">Click to add</span>}
      </p>
    </div>
  );
}
