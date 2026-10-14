# cn-food-mcp

MCP server for Chinese food nutrition data. Provides ~1725 foods with 25 nutrients per 100g.

> **This is a fork.** Upstream: [`ruffood/cn-food-mcp`](https://github.com/ruffood/cn-food-mcp).
> See [Changes in this fork](#changes-in-this-fork-v110) for what was modified.

## Usage

### Recommended: build locally

Building from source keeps the server fully self-contained — no dependency on the npm
registry staying online, and no dependency on the upstream repo staying reachable.

```bash
git clone https://github.com/Michael-Joe/cn-food-mcp.git
cd cn-food-mcp
npm install
npm run build          # produces dist/index.js + dist/data/*.json
```

Then reference the built entry point:

```json
{
  "mcpServers": {
    "cn-food": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/cn-food-mcp/dist/index.js"]
    }
  }
}
```

### Via npx (upstream package)

```json
{
  "mcpServers": {
    "cn-food": {
      "command": "npx",
      "args": ["-y", "cn-food-mcp"]
    }
  }
}
```

## Tools

### `list_nutrients`

List all available nutrient fields with Chinese/English names and units.

**Parameters:** none

```json
{
  "per_100g": true,
  "nutrients": [
    { "field": "energy", "name_cn": "能量", "name_en": "Energy", "unit": "kcal" },
    { "field": "protein", "name_cn": "蛋白质", "name_en": "Protein", "unit": "g" },
    { "field": "calcium", "name_cn": "钙", "name_en": "Calcium", "unit": "mg" },
    "... (25 nutrients total)"
  ]
}
```

### `search_food`

Search foods by name. Colloquial names are normalized automatically, and results are paginated.

**Parameters:**
- `query` (string) — Food name keyword, e.g. `鸡蛋`, `牛肉`, `五花肉`
- `limit` (number, optional) — Page size, default `20`, max `100`
- `offset` (number, optional) — Items to skip, default `0`

**Example:** `{ "query": "五花肉" }`

```json
{
  "query": "五花肉",
  "total": 1,
  "count": 1,
  "offset": 0,
  "limit": 20,
  "has_more": false,
  "matched_by": "alias",
  "alias_used": {
    "from": "五花肉",
    "standard_name": "五花肉",
    "to": ["猪肉(肋条肉)"],
    "note": "即猪肋条肉，肥瘦相间"
  },
  "foods": [
    { "id": 501, "name": "猪肉(肋条肉)", "energy_kcal": 568,
      "protein_g": 9.3, "fat_g": 59, "carbohydrate_g": 0 }
  ]
}
```

**Response fields:**
| Field | Meaning |
|---|---|
| `total` | Real number of matches (not truncated to the page) |
| `count` | Items in this page |
| `has_more` / `next_offset` | Pagination control |
| `matched_by` | `name` (direct match) / `alias` (resolved via alias table) / `none` (no match) |
| `alias_used` | Present when a colloquial name was mapped to a standard name |
| `hint` | Present when the food is not in the table; suggests nearby ingredients |

When nothing matches, `total` is `0` and `hint` explains why:

```json
{
  "query": "红烧肉",
  "total": 0,
  "count": 0,
  "matched_by": "none",
  "hint": "《中国食物成分表》未收录「红烧肉」。可用相近食材近似：猪肉(肋条肉)。若为成品菜或连锁饮品，请按可见食材拆解后逐项查询，或改用模型估算并明确标注为估算值。",
  "foods": []
}
```

### `resolve_food_name`

Resolve a colloquial name, slang term, or alias into a standard entry from the
Chinese Food Composition Table, with a nutrition summary.

**Parameters:**
- `name` (string) — e.g. `五花肉`, `牛奶`, `芝士`

**Example:** `{ "name": "牛腩" }`

```json
{
  "query": "牛腩",
  "matched_by": "alias",
  "alias_used": { "from": "牛腩", "standard_name": "牛腩", "to": ["牛肉(腑肋)"], "note": "即牛腹肋肉" },
  "count": 1,
  "foods": [{ "id": 470, "name": "牛肉(腑肋)", "energy_kcal": 123 }]
}
```

Returns `"missing": true` when the food genuinely is not in the table:

```json
{
  "query": "奶茶",
  "matched_by": "none",
  "missing": true,
  "hint": "《中国食物成分表》未收录「奶茶」。库中也没有合适的近似食材。...",
  "count": 0,
  "foods": []
}
```

### `get_nutrition`

Get full nutrition data for a food, by ID or by name.

**Parameters:**
- `food_id` (number, optional) — Food ID from `search_food`
- `food_name` (string, optional) — Standard or colloquial name; aliases are resolved

At least one of `food_id` / `food_name` is required. If a name matches several foods
and none is an exact match, the response is `{ "ambiguous": true, "candidates": [...] }`.

**Example:** `{ "food_name": "北豆腐" }`

```json
{
  "id": 286,
  "name": "豆腐(北)",
  "energy": 98,
  "protein": 12.2,
  "carbohydrate": 1.5,
  "fat": 4.8,
  "calcium": 138,
  "sodium": 7.3,
  "... (25 nutrients total)",
  "unit": 100
}
```

### `compare_foods`

Compare nutrition of 2-5 foods side by side.

**Parameters:**
- `food_ids` (number[]) — Array of 2-5 food IDs

**Example:** `{ "food_ids": [579, 580, 586] }`

```json
{
  "unit": 100,
  "foods": [
    { "id": 579, "name": "鸡蛋(白皮)", "energy": 138, "protein": 12.7, "fat": 9 },
    { "id": 580, "name": "鸡蛋(红皮)", "energy": 156, "protein": 12.8, "fat": 11.1 },
    { "id": 586, "name": "鸡蛋黄", "energy": 328, "protein": 15.2, "fat": 28.2 }
  ]
}
```

### `filter_by_nutrient`

Filter foods by nutrient range.

**Parameters:**
- `nutrient` (string) — One of: `energy`, `protein`, `carbohydrate`, `fat`, `water`, `fiber`, `ash`, `vitamin_a`, `carotene`, `retinol_equivalent`, `vitamin_b1`, `vitamin_b2`, `niacin`, `vitamin_c`, `vitamin_e`, `potassium`, `sodium`, `calcium`, `magnesium`, `iron`, `manganese`, `zinc`, `copper`, `phosphorus`, `selenium`
- `min` (number, optional) — Minimum value (inclusive)
- `max` (number, optional) — Maximum value (inclusive)
- `limit` (number, optional) — Page size, default `20`, max `100`
- `offset` (number, optional) — Items to skip, default `0`
- `sort` (`"asc"` | `"desc"`, optional) — Sort order, default `"desc"`

**Example:** `{ "nutrient": "protein", "min": 30, "sort": "desc", "limit": 3 }`

```json
{
  "nutrient": "protein",
  "total": 76,
  "count": 3,
  "offset": 0,
  "limit": 3,
  "has_more": true,
  "foods": [
    { "id": 875, "name": "骆驼掌", "protein": 72.8 },
    { "id": 899, "name": "曼氏无针乌贼", "protein": 65.3 },
    { "id": 959, "name": "墨鱼(干)", "protein": 65.3 }
  ]
}
```

### `list_aliases`

List the built-in alias table, plus the foods that are confirmed to be absent
(with suggested nearby substitutes).

**Parameters:**
- `filter` (string, optional) — Keyword filter, e.g. `肉`, `奶`

```json
{
  "alias_count": 120,
  "absent_count": 24,
  "note": "口语名到《中国食物成分表》标准名的映射。...",
  "updated": "2026-10-15",
  "aliases": {
    "五花肉": { "targets": ["猪肉(肋条肉)"], "note": "即猪肋条肉，肥瘦相间" }
  },
  "absent": {
    "奶茶": { "reason": "《中国食物成分表》中无此条目", "nearby": [] }
  }
}
```

## Changes in this fork (v1.1.0)

### 1. Fixed: `count` reported a truncated total

Upstream computed `count` *after* `slice(0, 20)`, so it always reported at most 20 —
a query for `鱼` returned `"count": 20` when there were actually **142** matches.
Any model reading that would state "there are 20 kinds of fish".

Now `total` is the real match count, `count` is the page size, and `limit` / `offset` /
`has_more` / `next_offset` provide real pagination. The same fix was applied to
`filter_by_nutrient`.

### 2. Added: colloquial-name alias layer

The underlying data uses Chinese Food Composition Table naming, which writes cut and
processing method into the name. This makes many everyday words searchable only if you
already know the standard name:

| You say | The table says |
|---|---|
| 五花肉 | `猪肉(肋条肉)` |
| 牛腩 | `牛肉(腑肋)` |
| 牛奶 | `牛乳` |
| 橙子 | `橙` |
| 鸡胸肉 | `鸡胸脯肉` |
| 北豆腐 | `豆腐(北)` |

`src/data/aliases.json` holds **120 verified mappings** plus **24 entries confirmed
absent** from the table. Every target name is validated against `foods.json` at build
time — mappings pointing at nonexistent foods are rejected rather than silently
returning nothing.

- `search_food` applies aliases automatically and reports `matched_by: "alias"`
- `resolve_food_name` does resolution explicitly
- `list_aliases` exposes the whole table

### 3. Added: explicit missing-food reporting

For foods genuinely absent from the table, instead of a bare empty list the server
returns a `hint` naming nearby usable substitutes:

| Query | Hint |
|---|---|
| 红烧肉 | 可用相近食材近似：猪肉(肋条肉) |
| 橄榄油 | 可用相近食材近似：菜籽油、豆油、花生油、茶油 |
| 薯条 | 可用相近食材近似：油炸土豆片 |
| 奶茶 | 库中也没有合适的近似食材 |

### 4. Added: relevance ranking on name search

Exact name matches sort first, then prefix matches, then the rest. Previously `土豆`
returned `淀粉(马铃薯粉)` before `土豆` itself (raw data-file order).

## Known data gaps

This dataset contains **raw ingredients and a few packaged items only**. The following
categories are entirely absent and cannot be worked around by keyword tuning:

- **Chinese prepared dishes** — 红烧肉, 宫保鸡丁, 番茄炒蛋, 盖浇饭, 麻辣烫, 回锅肉
- **Chain beverages** — 奶茶, 拿铁
- **Western fast food** — 汉堡, 薯条
- **Some staples** — 饺子, 馄饨, 河粉, 米线, 包子, 全麦面包, 咖啡, 腰果, 开心果

For photo-based meal estimation the correct split is:

```
① recognize + estimate portion   → VLM (not a lookup problem)
② colloquial name → standard name → aliases.json in this repo
③ authoritative values            → this server
④ prepared dishes / chain drinks  → separate data source, or model estimate
```

## License

MIT
