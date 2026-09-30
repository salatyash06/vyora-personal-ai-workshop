import sqlite3
from contextlib import contextmanager
from pathlib import Path


class Database:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        with self.connection() as con:
            con.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS conversations (
                    id INTEGER PRIMARY KEY, title TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
                );
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL REFERENCES conversations(id),
                    role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
                );
                CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id,id);
                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY, content TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
                );
                CREATE TABLE IF NOT EXISTS action_runs (
                    id INTEGER PRIMARY KEY, command TEXT NOT NULL, result TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
                );
            """)

    @contextmanager
    def connection(self):
        con = sqlite3.connect(self.path, timeout=10)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys=ON")
        try:
            with con:
                yield con
        finally:
            con.close()

    def conversations(self):
        with self.connection() as con:
            return [dict(r) for r in con.execute("SELECT * FROM conversations ORDER BY id DESC LIMIT 200")]

    def create_conversation(self):
        with self.connection() as con:
            cursor = con.execute("INSERT INTO conversations(title) VALUES (?)", ("New conversation",))
            return dict(con.execute("SELECT * FROM conversations WHERE id=?", (cursor.lastrowid,)).fetchone())

    def exists(self, conversation_id):
        with self.connection() as con:
            return con.execute("SELECT 1 FROM conversations WHERE id=?", (conversation_id,)).fetchone() is not None

    def messages(self, conversation_id, limit=200):
        with self.connection() as con:
            rows = con.execute("SELECT * FROM messages WHERE conversation_id=? ORDER BY id DESC LIMIT ?", (conversation_id, limit)).fetchall()
            return [dict(r) for r in reversed(rows)]

    def save_exchange(self, conversation_id, user_text, reply):
        with self.connection() as con:
            is_first = not con.execute("SELECT 1 FROM messages WHERE conversation_id=? LIMIT 1", (conversation_id,)).fetchone()
            con.executemany("INSERT INTO messages(conversation_id,role,content) VALUES (?,?,?)", [
                (conversation_id, "user", user_text), (conversation_id, "assistant", reply),
            ])
            if is_first:
                con.execute("UPDATE conversations SET title=? WHERE id=?", (user_text[:60], conversation_id))

    def add_note(self, content):
        with self.connection() as con:
            cursor = con.execute("INSERT INTO notes(content) VALUES (?)", (content,))
            return cursor.lastrowid

    def notes(self):
        with self.connection() as con:
            return [dict(r) for r in con.execute("SELECT * FROM notes ORDER BY id DESC LIMIT 200")]

    def log_action(self, command, result):
        with self.connection() as con:
            con.execute("INSERT INTO action_runs(command,result) VALUES (?,?)", (command, result))
