use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, State};

pub struct DbState {
    pub conn: Mutex<Connection>,
}

const DEFAULT_TAGS: &[&str] = &[
    "profile", "battle", "skill", "item", "shop", "quest",
    "dialogue", "menu", "map", "tutorial", "faction", "other",
];

pub fn init_db(app: &tauri::App) -> Result<DbState, Box<dyn std::error::Error>> {
    let app_data = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data)?;
    let db_path = app_data.join("db.sqlite");

    println!("Database path: {}", db_path.display());

    let conn = Connection::open(&db_path)?;
    run_migrations(&conn)?;
    migrate_add_card_columns(&conn);
    migrate_card_levels(&conn)?;
    seed_tags(&conn)?;

    Ok(DbState {
        conn: Mutex::new(conn),
    })
}

fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS captures (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            image_path TEXT NOT NULL,
            ocr_text TEXT NOT NULL DEFAULT '',
            normalized_text TEXT NOT NULL DEFAULT '',
            ocr_engine TEXT NOT NULL DEFAULT 'tesseract',
            preprocess_preset TEXT NOT NULL DEFAULT 'default_ui',
            width INTEGER NOT NULL DEFAULT 0,
            height INTEGER NOT NULL DEFAULT 0,
            tags_json TEXT,
            note TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            hash TEXT,
            confidence REAL NOT NULL DEFAULT 0.0
        );

        CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at);
        CREATE INDEX IF NOT EXISTS idx_captures_status ON captures(status);

        CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS capture_tags (
            capture_id TEXT NOT NULL REFERENCES captures(id),
            tag_id TEXT NOT NULL REFERENCES tags(id),
            PRIMARY KEY (capture_id, tag_id)
        );

        CREATE INDEX IF NOT EXISTS idx_capture_tags_capture ON capture_tags(capture_id);
        CREATE INDEX IF NOT EXISTS idx_capture_tags_tag ON capture_tags(tag_id);

        CREATE TABLE IF NOT EXISTS tokens (
            id TEXT PRIMARY KEY,
            capture_id TEXT NOT NULL REFERENCES captures(id),
            surface TEXT NOT NULL,
            start_idx INTEGER NOT NULL,
            end_idx INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tokens_capture ON tokens(capture_id);

        CREATE TABLE IF NOT EXISTS cards (
            id TEXT PRIMARY KEY,
            jp_text TEXT NOT NULL,
            reading TEXT NOT NULL DEFAULT '',
            meaning TEXT NOT NULL DEFAULT '',
            note TEXT,
            status TEXT NOT NULL DEFAULT 'new',
            source_capture_id TEXT REFERENCES captures(id),
            source_text_fragment TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
        CREATE INDEX IF NOT EXISTS idx_cards_jp_text ON cards(jp_text);

        CREATE TABLE IF NOT EXISTS card_tags (
            card_id TEXT NOT NULL REFERENCES cards(id),
            tag_id TEXT NOT NULL REFERENCES tags(id),
            PRIMARY KEY (card_id, tag_id)
        );

        CREATE INDEX IF NOT EXISTS idx_card_tags_card ON card_tags(card_id);

        CREATE TABLE IF NOT EXISTS sources (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL DEFAULT 'manual',
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS card_sources (
            card_id TEXT NOT NULL REFERENCES cards(id),
            source_id TEXT NOT NULL REFERENCES sources(id),
            context_text TEXT,
            screen_name TEXT,
            PRIMARY KEY (card_id, source_id)
        );

        CREATE INDEX IF NOT EXISTS idx_card_sources_card ON card_sources(card_id);
        CREATE INDEX IF NOT EXISTS idx_card_sources_source ON card_sources(source_id);
        CREATE INDEX IF NOT EXISTS idx_sources_name ON sources(name);

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        ",
    )?;
    Ok(())
}

fn migrate_add_card_columns(conn: &Connection) {
    let _ = conn.execute("ALTER TABLE cards ADD COLUMN translation TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE cards ADD COLUMN category TEXT", []);
}

fn migrate_card_levels(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Migrate text statuses to numeric levels: new→1, learning→3, known→5
    conn.execute_batch(
        "
        UPDATE cards SET status = '1' WHERE status = 'new';
        UPDATE cards SET status = '3' WHERE status = 'learning';
        UPDATE cards SET status = '5' WHERE status = 'known';
        ",
    )?;
    Ok(())
}

fn seed_tags(conn: &Connection) -> Result<(), rusqlite::Error> {
    let mut stmt = conn.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?1, ?2)")?;
    for name in DEFAULT_TAGS {
        let id = uuid::Uuid::new_v4().to_string();
        stmt.execute(params![id, name])?;
    }
    Ok(())
}

// --- Types ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Capture {
    pub id: String,
    pub created_at: String,
    pub image_path: String,
    pub ocr_text: String,
    pub normalized_text: String,
    pub ocr_engine: String,
    pub preprocess_preset: String,
    pub width: i32,
    pub height: i32,
    pub tags_json: Option<String>,
    pub note: Option<String>,
    pub status: String,
    pub confidence: f64,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveCaptureInput {
    pub image_path: String,
    pub ocr_text: String,
    pub normalized_text: String,
    pub preprocess_preset: String,
    pub confidence: f64,
}

// Helper to read a Capture from a row (13 columns from captures table)
fn capture_from_row(row: &rusqlite::Row) -> rusqlite::Result<Capture> {
    Ok(Capture {
        id: row.get(0)?,
        created_at: row.get(1)?,
        image_path: row.get(2)?,
        ocr_text: row.get(3)?,
        normalized_text: row.get(4)?,
        ocr_engine: row.get(5)?,
        preprocess_preset: row.get(6)?,
        width: row.get(7)?,
        height: row.get(8)?,
        tags_json: row.get(9)?,
        note: row.get(10)?,
        status: row.get(11)?,
        confidence: row.get(12)?,
        tags: Vec::new(), // filled in separately
    })
}

fn load_capture_tags(conn: &Connection, capture_id: &str) -> Vec<String> {
    let mut stmt = conn
        .prepare(
            "SELECT t.name FROM tags t
             JOIN capture_tags ct ON ct.tag_id = t.id
             WHERE ct.capture_id = ?1
             ORDER BY t.name",
        )
        .unwrap_or_else(|_| panic!("Failed to prepare tag query"));
    stmt.query_map(params![capture_id], |row| row.get::<_, String>(0))
        .unwrap_or_else(|_| panic!("Failed to query tags"))
        .filter_map(|r| r.ok())
        .collect()
}

// --- Tauri commands ---

#[tauri::command]
pub fn save_capture(
    state: State<DbState>,
    input: SaveCaptureInput,
) -> Result<Capture, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono_now();

    conn.execute(
        "INSERT INTO captures (id, created_at, image_path, ocr_text, normalized_text, preprocess_preset, confidence)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, now, input.image_path, input.ocr_text, input.normalized_text, input.preprocess_preset, input.confidence],
    )
    .map_err(|e| e.to_string())?;

    Ok(Capture {
        id,
        created_at: now,
        image_path: input.image_path,
        ocr_text: input.ocr_text,
        normalized_text: input.normalized_text,
        ocr_engine: "tesseract".to_string(),
        preprocess_preset: input.preprocess_preset,
        width: 0,
        height: 0,
        tags_json: None,
        note: None,
        status: "active".to_string(),
        confidence: input.confidence,
        tags: Vec::new(),
    })
}

#[tauri::command]
pub fn list_captures(
    state: State<DbState>,
    limit: Option<u32>,
    offset: Option<u32>,
    tag: Option<String>,
) -> Result<Vec<Capture>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let mut captures: Vec<Capture> = if let Some(ref tag_name) = tag {
        let sql = "SELECT c.id, c.created_at, c.image_path, c.ocr_text, c.normalized_text, c.ocr_engine,
                          c.preprocess_preset, c.width, c.height, c.tags_json, c.note, c.status, c.confidence
                   FROM captures c
                   JOIN capture_tags ct ON ct.capture_id = c.id
                   JOIN tags t ON t.id = ct.tag_id
                   WHERE c.status = 'active' AND t.name = ?1
                   ORDER BY c.created_at DESC
                   LIMIT ?2 OFFSET ?3";
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![tag_name, limit, offset], capture_from_row)
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    } else {
        let sql = "SELECT id, created_at, image_path, ocr_text, normalized_text, ocr_engine,
                          preprocess_preset, width, height, tags_json, note, status, confidence
                   FROM captures
                   WHERE status = 'active'
                   ORDER BY created_at DESC
                   LIMIT ?1 OFFSET ?2";
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![limit, offset], capture_from_row)
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    // Load tags for each capture
    for capture in &mut captures {
        capture.tags = load_capture_tags(&conn, &capture.id);
    }

    Ok(captures)
}

#[tauri::command]
pub fn get_capture(state: State<DbState>, id: String) -> Result<Capture, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let mut capture = conn
        .query_row(
            "SELECT id, created_at, image_path, ocr_text, normalized_text, ocr_engine,
                    preprocess_preset, width, height, tags_json, note, status, confidence
             FROM captures WHERE id = ?1",
            params![id],
            capture_from_row,
        )
        .map_err(|e| e.to_string())?;

    capture.tags = load_capture_tags(&conn, &capture.id);
    Ok(capture)
}

#[tauri::command]
pub fn delete_capture(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE captures SET status = 'deleted' WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_capture_tags(
    state: State<DbState>,
    capture_id: String,
    tag_names: Vec<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // Remove existing tags
    conn.execute(
        "DELETE FROM capture_tags WHERE capture_id = ?1",
        params![capture_id],
    )
    .map_err(|e| e.to_string())?;

    // Add new tags
    for name in &tag_names {
        let tag_id: Option<String> = conn
            .query_row(
                "SELECT id FROM tags WHERE name = ?1",
                params![name],
                |row| row.get(0),
            )
            .ok();

        let tag_id = match tag_id {
            Some(id) => id,
            None => {
                // Create new custom tag
                let id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO tags (id, name) VALUES (?1, ?2)",
                    params![id, name],
                )
                .map_err(|e| e.to_string())?;
                id
            }
        };

        conn.execute(
            "INSERT OR IGNORE INTO capture_tags (capture_id, tag_id) VALUES (?1, ?2)",
            params![capture_id, tag_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn update_capture_note(
    state: State<DbState>,
    capture_id: String,
    note: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE captures SET note = ?1 WHERE id = ?2",
        params![note, capture_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_capture_ocr(
    state: State<DbState>,
    capture_id: String,
    ocr_text: String,
    normalized_text: String,
    preprocess_preset: String,
    confidence: f64,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE captures SET ocr_text = ?1, normalized_text = ?2, preprocess_preset = ?3, confidence = ?4 WHERE id = ?5",
        params![ocr_text, normalized_text, preprocess_preset, confidence, capture_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_tags(state: State<DbState>) -> Result<Vec<Tag>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name FROM tags ORDER BY name")
        .map_err(|e| e.to_string())?;
    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(tags)
}

#[tauri::command]
pub fn create_tag(state: State<DbState>, name: String) -> Result<Tag, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO tags (id, name) VALUES (?1, ?2)",
        params![id, name],
    )
    .map_err(|e| e.to_string())?;
    Ok(Tag { id, name })
}

#[tauri::command]
pub fn rename_tag(state: State<DbState>, id: String, name: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tags SET name = ?1 WHERE id = ?2",
        params![name, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_tag(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM capture_tags WHERE tag_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM card_tags WHERE tag_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn find_card_by_text(state: State<DbState>, text: String) -> Result<Option<Card>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let sql = format!("SELECT {} FROM cards WHERE jp_text = ?1", CARD_COLUMNS);
    let result = conn.query_row(&sql, params![text], card_from_row);
    match result {
        Ok(mut card) => {
            load_card_extras(&conn, &mut card);
            Ok(Some(card))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn find_cards_by_texts(state: State<DbState>, texts: Vec<String>) -> Result<Vec<Card>, String> {
    if texts.is_empty() {
        return Ok(Vec::new());
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let placeholders: Vec<String> = (1..=texts.len()).map(|i| format!("?{}", i)).collect();
    let sql = format!(
        "SELECT {} FROM cards WHERE jp_text IN ({})",
        CARD_COLUMNS, placeholders.join(", ")
    );
    let params_ref: Vec<&dyn rusqlite::types::ToSql> =
        texts.iter().map(|t| t as &dyn rusqlite::types::ToSql).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params_ref.as_slice(), card_from_row)
        .map_err(|e| e.to_string())?;
    let mut cards: Vec<Card> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    for card in &mut cards {
        load_card_extras(&conn, card);
    }
    Ok(cards)
}

#[tauri::command]
pub fn get_setting(state: State<DbState>, key: String) -> Result<Option<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    );
    match result {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn set_setting(state: State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// --- Card types and commands ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Card {
    pub id: String,
    pub jp_text: String,
    pub reading: String,
    pub meaning: String,
    pub translation: String,
    pub note: Option<String>,
    pub status: String,
    pub category: Option<String>,
    pub source_capture_id: Option<String>,
    pub source_text_fragment: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
    pub sources: Vec<CardSource>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CardSource {
    pub source_id: String,
    pub source_type: String,
    pub source_name: String,
    pub context_text: Option<String>,
    pub screen_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Source {
    pub id: String,
    #[serde(rename = "type")]
    pub source_type: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCardInput {
    pub jp_text: String,
    pub reading: String,
    pub meaning: String,
    pub translation: Option<String>,
    pub note: Option<String>,
    pub category: Option<String>,
    pub source_capture_id: Option<String>,
    pub source_text_fragment: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VocabExport {
    pub version: u32,
    pub exported_at: String,
    pub entries: Vec<VocabEntryExport>,
    pub sources: Vec<SourceExport>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VocabEntryExport {
    pub original: String,
    #[serde(default)]
    pub reading: String,
    #[serde(default)]
    pub translation: String,
    #[serde(default)]
    pub meaning: String,
    pub notes: Option<String>,
    pub category: Option<String>,
    #[serde(default = "default_stage")]
    pub stage: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub sources: Vec<EntrySourceExport>,
}

fn default_stage() -> String { "I".to_string() }

#[derive(Debug, Serialize, Deserialize)]
pub struct SourceExport {
    #[serde(rename = "type")]
    pub source_type: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EntrySourceExport {
    #[serde(rename = "type")]
    pub source_type: String,
    pub name: String,
    pub context_text: Option<String>,
    pub screen_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported: u32,
    pub skipped: u32,
    pub updated: u32,
    pub errors: Vec<String>,
}

// Column order: id(0), jp_text(1), reading(2), meaning(3), translation(4), note(5),
//               status(6), category(7), source_capture_id(8), source_text_fragment(9),
//               created_at(10), updated_at(11)
const CARD_COLUMNS: &str = "id, jp_text, reading, meaning, translation, note, status, category, source_capture_id, source_text_fragment, created_at, updated_at";

fn card_from_row(row: &rusqlite::Row) -> rusqlite::Result<Card> {
    Ok(Card {
        id: row.get(0)?,
        jp_text: row.get(1)?,
        reading: row.get(2)?,
        meaning: row.get(3)?,
        translation: row.get(4)?,
        note: row.get(5)?,
        status: row.get(6)?,
        category: row.get(7)?,
        source_capture_id: row.get(8)?,
        source_text_fragment: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        tags: Vec::new(),
        sources: Vec::new(),
    })
}

fn load_card_tags(conn: &Connection, card_id: &str) -> Vec<String> {
    conn.prepare("SELECT t.name FROM tags t JOIN card_tags ct ON ct.tag_id = t.id WHERE ct.card_id = ?1 ORDER BY t.name")
        .and_then(|mut stmt| {
            stmt.query_map(params![card_id], |row| row.get::<_, String>(0))
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
        })
        .unwrap_or_default()
}

fn load_card_sources(conn: &Connection, card_id: &str) -> Vec<CardSource> {
    conn.prepare(
        "SELECT s.id, s.type, s.name, cs.context_text, cs.screen_name
         FROM sources s JOIN card_sources cs ON cs.source_id = s.id
         WHERE cs.card_id = ?1 ORDER BY s.name"
    )
    .and_then(|mut stmt| {
        stmt.query_map(params![card_id], |row| {
            Ok(CardSource {
                source_id: row.get(0)?,
                source_type: row.get(1)?,
                source_name: row.get(2)?,
                context_text: row.get(3)?,
                screen_name: row.get(4)?,
            })
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
    })
    .unwrap_or_default()
}

fn load_card_extras(conn: &Connection, card: &mut Card) {
    card.tags = load_card_tags(conn, &card.id);
    card.sources = load_card_sources(conn, &card.id);
}

fn get_or_create_tag(conn: &Connection, name: &str) -> Result<String, String> {
    if let Ok(id) = conn.query_row("SELECT id FROM tags WHERE name = ?1", params![name], |row| row.get::<_, String>(0)) {
        return Ok(id);
    }
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute("INSERT INTO tags (id, name) VALUES (?1, ?2)", params![id, name])
        .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn create_card(state: State<DbState>, input: CreateCardInput) -> Result<Card, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono_now();

    let translation = input.translation.unwrap_or_default();
    conn.execute(
        "INSERT INTO cards (id, jp_text, reading, meaning, translation, note, status, category, source_capture_id, source_text_fragment, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, '1', ?7, ?8, ?9, ?10, ?11)",
        params![id, input.jp_text, input.reading, input.meaning, translation, input.note, input.category, input.source_capture_id, input.source_text_fragment, now, now],
    ).map_err(|e| e.to_string())?;

    // Add tags
    for tag_name in &input.tags {
        let tag_id = get_or_create_tag(&conn, tag_name)?;
        conn.execute("INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?1, ?2)", params![id, tag_id])
            .map_err(|e| e.to_string())?;
    }

    Ok(Card {
        id,
        jp_text: input.jp_text,
        reading: input.reading,
        meaning: input.meaning,
        translation,
        note: input.note,
        status: "1".to_string(),
        category: input.category,
        source_capture_id: input.source_capture_id,
        source_text_fragment: input.source_text_fragment,
        created_at: now.clone(),
        updated_at: now,
        tags: input.tags,
        sources: Vec::new(),
    })
}

#[tauri::command]
pub fn update_card(
    state: State<DbState>,
    id: String,
    jp_text: Option<String>,
    reading: Option<String>,
    meaning: Option<String>,
    translation: Option<String>,
    note: Option<String>,
    status: Option<String>,
    category: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();

    if let Some(val) = jp_text {
        conn.execute("UPDATE cards SET jp_text = ?1, updated_at = ?2 WHERE id = ?3", params![val, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(val) = reading {
        conn.execute("UPDATE cards SET reading = ?1, updated_at = ?2 WHERE id = ?3", params![val, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(val) = meaning {
        conn.execute("UPDATE cards SET meaning = ?1, updated_at = ?2 WHERE id = ?3", params![val, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(val) = translation {
        conn.execute("UPDATE cards SET translation = ?1, updated_at = ?2 WHERE id = ?3", params![val, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(val) = note {
        conn.execute("UPDATE cards SET note = ?1, updated_at = ?2 WHERE id = ?3", params![val, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(val) = status {
        conn.execute("UPDATE cards SET status = ?1, updated_at = ?2 WHERE id = ?3", params![val, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(val) = category {
        conn.execute("UPDATE cards SET category = ?1, updated_at = ?2 WHERE id = ?3", params![val, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(tag_names) = tags {
        conn.execute("DELETE FROM card_tags WHERE card_id = ?1", params![id]).map_err(|e| e.to_string())?;
        for name in &tag_names {
            let tag_id = get_or_create_tag(&conn, name)?;
            conn.execute("INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?1, ?2)", params![id, tag_id]).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn list_cards(
    state: State<DbState>,
    limit: Option<u32>,
    offset: Option<u32>,
    status_filter: Option<String>,
    tag: Option<String>,
    search: Option<String>,
) -> Result<Vec<Card>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);

    let cols = CARD_COLUMNS.split(", ").map(|c| format!("c.{}", c)).collect::<Vec<_>>().join(", ");
    let mut sql = format!("SELECT {} FROM cards c", cols);
    let mut conditions = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref tag_name) = tag {
        sql.push_str(" JOIN card_tags ct ON ct.card_id = c.id JOIN tags t ON t.id = ct.tag_id");
        conditions.push(format!("t.name = ?{}", param_values.len() + 1));
        param_values.push(Box::new(tag_name.clone()));
    }
    if let Some(ref s) = status_filter {
        conditions.push(format!("c.status = ?{}", param_values.len() + 1));
        param_values.push(Box::new(s.clone()));
    }
    if let Some(ref q) = search {
        let pattern = format!("%{}%", q);
        let idx = param_values.len() + 1;
        conditions.push(format!("(c.jp_text LIKE ?{} OR c.reading LIKE ?{} OR c.meaning LIKE ?{} OR c.translation LIKE ?{})", idx, idx + 1, idx + 2, idx + 3));
        param_values.push(Box::new(pattern.clone()));
        param_values.push(Box::new(pattern.clone()));
        param_values.push(Box::new(pattern.clone()));
        param_values.push(Box::new(pattern));
    }

    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }

    let limit_idx = param_values.len() + 1;
    let offset_idx = param_values.len() + 2;
    sql.push_str(&format!(" ORDER BY c.created_at DESC LIMIT ?{} OFFSET ?{}", limit_idx, offset_idx));
    param_values.push(Box::new(limit));
    param_values.push(Box::new(offset));

    let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params_ref.as_slice(), card_from_row)
        .map_err(|e| e.to_string())?;
    let mut cards: Vec<Card> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    for card in &mut cards {
        load_card_extras(&conn, card);
    }

    Ok(cards)
}

#[tauri::command]
pub fn delete_card(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM card_tags WHERE card_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM card_sources WHERE card_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM cards WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn export_cards_csv(state: State<DbState>, path: String) -> Result<u32, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let sql = format!("SELECT {} FROM cards ORDER BY created_at DESC", CARD_COLUMNS);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], card_from_row)
        .map_err(|e| e.to_string())?;
    let mut cards: Vec<Card> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    for card in &mut cards {
        load_card_extras(&conn, card);
    }

    // Build TSV
    let mut csv = String::from("jp_text\treading\ttranslation\tmeaning\tcategory\ttags\tnote\tstatus\n");
    for card in &cards {
        let tags_str = card.tags.join(", ");
        let note_str = card.note.as_deref().unwrap_or("").replace('\t', " ").replace('\n', " ");
        let category_str = card.category.as_deref().unwrap_or("");
        csv.push_str(&format!(
            "{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}\n",
            card.jp_text.replace('\t', " "),
            card.reading.replace('\t', " "),
            card.translation.replace('\t', " "),
            card.meaning.replace('\t', " "),
            category_str,
            tags_str,
            note_str,
            card.status
        ));
    }

    let count = cards.len() as u32;
    std::fs::write(&path, csv).map_err(|e| format!("Failed to write CSV: {}", e))?;

    Ok(count)
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    let millis = duration.as_millis() % 1000;
    format!("{}.{:03}", secs, millis)
}

// --- Source commands ---

#[tauri::command]
pub fn list_sources(state: State<DbState>) -> Result<Vec<Source>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, type, name, created_at FROM sources ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(Source {
            id: row.get(0)?,
            source_type: row.get(1)?,
            name: row.get(2)?,
            created_at: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_source(state: State<DbState>, source_type: String, name: String) -> Result<Source, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono_now();
    conn.execute(
        "INSERT INTO sources (id, type, name, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, source_type, name, now],
    ).map_err(|e| e.to_string())?;
    Ok(Source { id, source_type, name, created_at: now })
}

fn get_or_create_source(conn: &Connection, source_type: &str, name: &str) -> Result<String, String> {
    if let Ok(id) = conn.query_row(
        "SELECT id FROM sources WHERE type = ?1 AND name = ?2",
        params![source_type, name],
        |row| row.get::<_, String>(0),
    ) {
        return Ok(id);
    }
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono_now();
    conn.execute(
        "INSERT INTO sources (id, type, name, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, source_type, name, now],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn add_card_source(
    state: State<DbState>,
    card_id: String,
    source_type: String,
    source_name: String,
    context_text: Option<String>,
    screen_name: Option<String>,
) -> Result<CardSource, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let source_id = get_or_create_source(&conn, &source_type, &source_name)?;
    conn.execute(
        "INSERT OR IGNORE INTO card_sources (card_id, source_id, context_text, screen_name) VALUES (?1, ?2, ?3, ?4)",
        params![card_id, source_id, context_text, screen_name],
    ).map_err(|e| e.to_string())?;
    Ok(CardSource { source_id, source_type, source_name, context_text, screen_name })
}

#[tauri::command]
pub fn remove_card_source(state: State<DbState>, card_id: String, source_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM card_sources WHERE card_id = ?1 AND source_id = ?2",
        params![card_id, source_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// --- JSON Export/Import ---

fn status_to_stage(status: &str) -> String {
    match status {
        "1" => "I", "2" => "II", "3" => "III", "4" => "IV", "5" => "V",
        _ => "I",
    }.to_string()
}

fn stage_to_status(stage: &str) -> String {
    match stage {
        "I" => "1", "II" => "2", "III" => "3", "IV" => "4", "V" => "5",
        _ => "1",
    }.to_string()
}

#[tauri::command]
pub fn export_cards_json(state: State<DbState>, path: String) -> Result<u32, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let sql = format!("SELECT {} FROM cards ORDER BY created_at DESC", CARD_COLUMNS);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], card_from_row).map_err(|e| e.to_string())?;
    let mut cards: Vec<Card> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    for card in &mut cards {
        load_card_extras(&conn, card);
    }

    // Collect all unique sources
    let mut all_sources: Vec<SourceExport> = Vec::new();
    let mut seen_sources = std::collections::HashSet::new();

    let entries: Vec<VocabEntryExport> = cards.iter().map(|card| {
        let entry_sources: Vec<EntrySourceExport> = card.sources.iter().map(|s| {
            let key = format!("{}:{}", s.source_type, s.source_name);
            if seen_sources.insert(key) {
                all_sources.push(SourceExport {
                    source_type: s.source_type.clone(),
                    name: s.source_name.clone(),
                });
            }
            EntrySourceExport {
                source_type: s.source_type.clone(),
                name: s.source_name.clone(),
                context_text: s.context_text.clone(),
                screen_name: s.screen_name.clone(),
            }
        }).collect();

        VocabEntryExport {
            original: card.jp_text.clone(),
            reading: card.reading.clone(),
            translation: card.translation.clone(),
            meaning: card.meaning.clone(),
            notes: card.note.clone(),
            category: card.category.clone(),
            stage: status_to_stage(&card.status),
            tags: card.tags.clone(),
            sources: entry_sources,
        }
    }).collect();

    let all_tags: Vec<String> = {
        let mut tags = std::collections::HashSet::new();
        for card in &cards {
            for t in &card.tags {
                tags.insert(t.clone());
            }
        }
        let mut v: Vec<String> = tags.into_iter().collect();
        v.sort();
        v
    };

    let export = VocabExport {
        version: 1,
        exported_at: chrono_now(),
        entries,
        sources: all_sources,
        tags: all_tags,
    };

    let json = serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?;
    let count = cards.len() as u32;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write JSON: {}", e))?;
    Ok(count)
}

#[tauri::command]
pub fn import_cards_json(state: State<DbState>, path: String, mode: String) -> Result<ImportResult, String> {
    let json_str = std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    let data: VocabExport = serde_json::from_str(&json_str).map_err(|e| format!("Invalid JSON: {}", e))?;

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut result = ImportResult { imported: 0, skipped: 0, updated: 0, errors: Vec::new() };

    for entry in &data.entries {
        let existing: Option<String> = conn.query_row(
            "SELECT id FROM cards WHERE jp_text = ?1",
            params![entry.original],
            |row| row.get(0),
        ).ok();

        match (existing, mode.as_str()) {
            (Some(_), "skip") => {
                result.skipped += 1;
            }
            (Some(existing_id), "update") => {
                let now = chrono_now();
                conn.execute(
                    "UPDATE cards SET reading = ?1, meaning = ?2, translation = ?3, note = ?4, category = ?5, status = ?6, updated_at = ?7 WHERE id = ?8",
                    params![entry.reading, entry.meaning, entry.translation, entry.notes, entry.category, stage_to_status(&entry.stage), now, existing_id],
                ).map_err(|e| e.to_string())?;

                // Update tags
                conn.execute("DELETE FROM card_tags WHERE card_id = ?1", params![existing_id]).map_err(|e| e.to_string())?;
                for tag_name in &entry.tags {
                    let tag_id = get_or_create_tag(&conn, tag_name)?;
                    conn.execute("INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?1, ?2)", params![existing_id, tag_id]).map_err(|e| e.to_string())?;
                }

                // Update sources
                conn.execute("DELETE FROM card_sources WHERE card_id = ?1", params![existing_id]).map_err(|e| e.to_string())?;
                for src in &entry.sources {
                    let source_id = get_or_create_source(&conn, &src.source_type, &src.name)?;
                    conn.execute(
                        "INSERT OR IGNORE INTO card_sources (card_id, source_id, context_text, screen_name) VALUES (?1, ?2, ?3, ?4)",
                        params![existing_id, source_id, src.context_text, src.screen_name],
                    ).map_err(|e| e.to_string())?;
                }

                result.updated += 1;
            }
            (existing, _) => {
                // "new" mode or no existing card
                if existing.is_some() && mode == "new" {
                    // import-as-new: create duplicate
                }
                let id = uuid::Uuid::new_v4().to_string();
                let now = chrono_now();
                conn.execute(
                    "INSERT INTO cards (id, jp_text, reading, meaning, translation, note, status, category, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![id, entry.original, entry.reading, entry.meaning, entry.translation, entry.notes, stage_to_status(&entry.stage), entry.category, now, now],
                ).map_err(|e| { result.errors.push(format!("Failed to import '{}': {}", entry.original, e)); e.to_string() })?;

                for tag_name in &entry.tags {
                    let tag_id = get_or_create_tag(&conn, tag_name)?;
                    let _ = conn.execute("INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?1, ?2)", params![id, tag_id]);
                }

                for src in &entry.sources {
                    let source_id = get_or_create_source(&conn, &src.source_type, &src.name)?;
                    let _ = conn.execute(
                        "INSERT OR IGNORE INTO card_sources (card_id, source_id, context_text, screen_name) VALUES (?1, ?2, ?3, ?4)",
                        params![id, source_id, src.context_text, src.screen_name],
                    );
                }

                result.imported += 1;
            }
        }
    }

    Ok(result)
}
