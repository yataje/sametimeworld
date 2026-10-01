#!/usr/bin/env python3
import json, sqlite3, sys, pathlib

if len(sys.argv) != 3:
    raise SystemExit("usage: rebuild-sqlite.py <recovered-data.json> <sametimeworld.db>")

src=pathlib.Path(sys.argv[1])
dst=pathlib.Path(sys.argv[2])
data=json.loads(src.read_text(encoding="utf-8"))
events=data.get("events") or []
if not events:
    raise SystemExit("no events")

dst.parent.mkdir(parents=True, exist_ok=True)
if dst.exists():
    dst.unlink()

con=sqlite3.connect(dst)
cur=con.cursor()
cur.execute("""
CREATE TABLE events(
 id INTEGER PRIMARY KEY,
 날짜 TEXT NOT NULL,
 대륙 TEXT NOT NULL,
 중요도 INTEGER CHECK(중요도 BETWEEN 1 AND 5),
 국가 TEXT,
 카테고리 TEXT,
 내용 TEXT NOT NULL,
 설명 TEXT,
 대상 TEXT,
 장소 TEXT,
 원문날짜 TEXT,
 검증상태 TEXT,
 지역 TEXT NOT NULL DEFAULT '',
 위도 REAL,
 경도 REAL,
 위치정밀도 TEXT
)
""")
rows=[]
for e in events:
    rows.append((
        int(e.get("id")),
        str(e.get("date") or ""),
        str(e.get("region") or ""),
        int(e.get("importance") or 0),
        str(e.get("country") or ""),
        str(e.get("category") or ""),
        str(e.get("title") or ""),
        str(e.get("description") or ""),
        str(e.get("subject") or ""),
        str(e.get("place") or ""),
        str(e.get("original_date") or ""),
        str(e.get("verification") or ""),
        str(e.get("map_region") or e.get("locality") or ""),
        float(e["latitude"]) if e.get("latitude") is not None else None,
        float(e["longitude"]) if e.get("longitude") is not None else None,
        str(e.get("location_precision") or "")
    ))
cur.executemany("""
INSERT INTO events
(id,날짜,대륙,중요도,국가,카테고리,내용,설명,대상,장소,원문날짜,검증상태,지역,위도,경도,위치정밀도)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
""",rows)
cur.execute("CREATE INDEX idx_events_date ON events(날짜)")
cur.execute("CREATE INDEX idx_events_region ON events(대륙)")
cur.execute("CREATE INDEX idx_events_country ON events(국가)")
cur.execute("CREATE INDEX idx_events_map_region ON events(지역)")
cur.execute("CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL)")
cur.executemany("INSERT INTO metadata(key,value) VALUES (?,?)",[
    ("recovered_from","GitHub public packet"),
    ("event_count",str(len(events))),
    ("schema_version","recovered-v1"),
])
con.commit()
count=cur.execute("SELECT COUNT(*) FROM events").fetchone()[0]
coords=cur.execute("SELECT COUNT(*) FROM events WHERE 위도 IS NOT NULL AND 경도 IS NOT NULL").fetchone()[0]
print(json.dumps({"events":count,"with_coordinates":coords,"db":str(dst)},ensure_ascii=False))
con.close()
