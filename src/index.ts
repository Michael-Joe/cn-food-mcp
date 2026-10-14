import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// Load food data
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "data", "foods.json");
const foods: Food[] = JSON.parse(readFileSync(dataPath, "utf-8"));

// Load colloquial-name aliases
const aliasPath = path.join(__dirname, "data", "aliases.json");
const aliasData = JSON.parse(readFileSync(aliasPath, "utf-8")) as AliasData;

interface AliasData {
  version: string;
  updated: string;
  note: string;
  aliases: Record<string, { targets: string[]; note?: string }>;
  absent: Record<string, { reason: string; nearby: string[] }>;
}

interface Food {
  id: number;
  name: string;
  energy: number | null;
  protein: number | null;
  carbohydrate: number | null;
  fat: number | null;
  water: number | null;
  fiber: number | null;
  ash: number | null;
  vitamin_a: number | null;
  carotene: number | null;
  retinol_equivalent: number | null;
  vitamin_b1: number | null;
  vitamin_b2: number | null;
  niacin: number | null;
  vitamin_c: number | null;
  vitamin_e: number | null;
  potassium: number | null;
  sodium: number | null;
  calcium: number | null;
  magnesium: number | null;
  iron: number | null;
  manganese: number | null;
  zinc: number | null;
  copper: number | null;
  phosphorus: number | null;
  selenium: number | null;
}

const NUTRIENT_KEYS = [
  "energy", "protein", "carbohydrate", "fat", "water", "fiber", "ash",
  "vitamin_a", "carotene", "retinol_equivalent",
  "vitamin_b1", "vitamin_b2", "niacin", "vitamin_c", "vitamin_e",
  "potassium", "sodium", "calcium", "magnesium",
  "iron", "manganese", "zinc", "copper", "phosphorus", "selenium",
] as const;

type NutrientKey = typeof NUTRIENT_KEYS[number];

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function summaryOf(food: Food) {
  return {
    id: food.id,
    name: food.name,
    energy_kcal: food.energy,
    protein_g: food.protein,
    fat_g: food.fat,
    carbohydrate_g: food.carbohydrate,
  };
}

// ---------- 别名解析 ----------

const ALIAS_KEYS = Object.keys(aliasData.aliases);
const ABSENT_KEYS = Object.keys(aliasData.absent);

/** 大小写不敏感地查别名表 */
function lookupAlias(q: string): string | null {
  const key = q.trim();
  if (!key) return null;
  if (aliasData.aliases[key] || aliasData.absent[key]) return key;
  const lower = key.toLowerCase();
  return (
    ALIAS_KEYS.find((k) => k.toLowerCase() === lower) ??
    ABSENT_KEYS.find((k) => k.toLowerCase() === lower) ??
    null
  );
}

/** 按标准名精确取值（同名可能是多条，如两个「土豆粉」） */
function byExactName(name: string): Food[] {
  return foods.filter((f) => f.name === name);
}

/** 直接按名称子串匹配，并按相关度排序：完全同名 > 以查询词开头 > 其余（同级保持原顺序） */
function bySubstring(q: string): Food[] {
  const lower = q.toLowerCase();
  const rank = (name: string) => {
    const n = name.toLowerCase();
    if (n === lower) return 3;
    if (n.startsWith(lower)) return 2;
    return 1;
  };
  return foods
    .filter((f) => f.name.toLowerCase().includes(lower))
    .slice()
    .sort((a, b) => rank(b.name) - rank(a.name));
}

/**
 * 综合检索：先直接匹配；无结果时走别名映射。
 * 返回结果池、别名使用记录、缺失提示。
 */
function searchPool(q: string): {
  pool: Food[];
  alias_used: Record<string, unknown> | null;
  hint: string | null;
  matched_by: "name" | "alias" | "none";
} {
  const direct = bySubstring(q);
  if (direct.length > 0) {
    return { pool: direct, alias_used: null, hint: null, matched_by: "name" };
  }

  const key = lookupAlias(q);
  if (!key) {
    return { pool: [], alias_used: null, hint: null, matched_by: "none" };
  }

  const entry = aliasData.aliases[key];
  if (entry) {
    const seen = new Set<number>();
    const pool: Food[] = [];
    for (const t of entry.targets) {
      for (const f of byExactName(t)) {
        if (!seen.has(f.id)) {
          seen.add(f.id);
          pool.push(f);
        }
      }
    }
    const alias_used: Record<string, unknown> = { from: q, standard_name: key, to: entry.targets };
    if (entry.note) alias_used.note = entry.note;
    return { pool, alias_used, hint: null, matched_by: "alias" };
  }

  const miss = aliasData.absent[key];
  const nearby = miss.nearby.length
    ? `可用相近食材近似：${miss.nearby.join("、")}。`
    : "库中也没有合适的近似食材。";
  const hint =
    `《中国食物成分表》未收录「${q}」。${nearby}` +
    `若为成品菜或连锁饮品，请按可见食材拆解后逐项查询，` +
    `或改用模型估算并明确标注为估算值。`;
  return { pool: [], alias_used: null, hint, matched_by: "none" };
}

// Create MCP server
const server = new McpServer({
  name: "cn-food-mcp",
  version: "1.1.0",
});

const NUTRIENT_UNITS: Record<NutrientKey, { name_cn: string; name_en: string; unit: string }> = {
  energy:              { name_cn: "能量",       name_en: "Energy",              unit: "kcal" },
  protein:             { name_cn: "蛋白质",     name_en: "Protein",             unit: "g" },
  carbohydrate:        { name_cn: "糖类",       name_en: "Carbohydrate",        unit: "g" },
  fat:                 { name_cn: "脂肪",       name_en: "Fat",                 unit: "g" },
  water:               { name_cn: "水分",       name_en: "Water",               unit: "g" },
  fiber:               { name_cn: "纤维",       name_en: "Fiber",               unit: "g" },
  ash:                 { name_cn: "灰份",       name_en: "Ash",                 unit: "g" },
  vitamin_a:           { name_cn: "维生素A",    name_en: "Vitamin A",           unit: "μg" },
  carotene:            { name_cn: "胡萝卜素",   name_en: "Carotene",            unit: "μg" },
  retinol_equivalent:  { name_cn: "视黄醇当量", name_en: "Retinol Equivalent",  unit: "μg" },
  vitamin_b1:          { name_cn: "维生素B1",   name_en: "Vitamin B1",          unit: "mg" },
  vitamin_b2:          { name_cn: "维生素B2",   name_en: "Vitamin B2",          unit: "mg" },
  niacin:              { name_cn: "烟酸",       name_en: "Niacin",              unit: "mg" },
  vitamin_c:           { name_cn: "维生素C",    name_en: "Vitamin C",           unit: "mg" },
  vitamin_e:           { name_cn: "维生素E",    name_en: "Vitamin E",           unit: "mg" },
  potassium:           { name_cn: "钾",         name_en: "Potassium",           unit: "mg" },
  sodium:              { name_cn: "钠",         name_en: "Sodium",              unit: "mg" },
  calcium:             { name_cn: "钙",         name_en: "Calcium",             unit: "mg" },
  magnesium:           { name_cn: "镁",         name_en: "Magnesium",           unit: "mg" },
  iron:                { name_cn: "铁",         name_en: "Iron",                unit: "mg" },
  manganese:           { name_cn: "锰",         name_en: "Manganese",           unit: "mg" },
  zinc:                { name_cn: "锌",         name_en: "Zinc",                unit: "mg" },
  copper:              { name_cn: "铜",         name_en: "Copper",              unit: "mg" },
  phosphorus:          { name_cn: "磷",         name_en: "Phosphorus",          unit: "mg" },
  selenium:            { name_cn: "硒",         name_en: "Selenium",            unit: "μg" },
};

// Tool 1: list_nutrients
server.tool(
  "list_nutrients",
  "列出所有可查询的营养素字段名、中英文名称和单位",
  {},
  async () => {
    const nutrients = NUTRIENT_KEYS.map((key) => ({
      field: key,
      ...NUTRIENT_UNITS[key],
    }));
    return json({ per_100g: true, nutrients });
  },
);

// Tool 2: search_food
server.tool(
  "search_food",
  "按名称搜索中国食物，返回匹配列表（ID、名称、主要营养素摘要）。" +
    "支持口语别名自动归一化（如「五花肉」→「猪肉(肋条肉)」、「牛奶」→「牛乳」、「橙子」→「橙」）；" +
    "支持分页。total 为真实命中总数，foods 为本页结果。",
  {
    query: z.string().describe("食物名称关键词，如「鸡蛋」「牛肉」「米饭」「五花肉」"),
    limit: z.number().int().min(1).max(100).default(20).describe("本页返回条数，默认 20，最大 100"),
    offset: z.number().int().min(0).default(0).describe("跳过条数，用于翻页，默认 0"),
  },
  async ({ query, limit, offset }) => {
    const { pool, alias_used, hint, matched_by } = searchPool(query);
    const page = pool.slice(offset, offset + limit);
    const result: Record<string, unknown> = {
      query,
      total: pool.length,
      count: page.length,
      offset,
      limit,
      has_more: offset + page.length < pool.length,
      matched_by,
    };
    if (offset + page.length < pool.length) {
      result.next_offset = offset + page.length;
    }
    if (alias_used) result.alias_used = alias_used;
    if (hint) result.hint = hint;
    result.foods = page.map(summaryOf);
    return json(result);
  },
);

// Tool 3: resolve_food_name —— 专门解决「口语名对不上标准名」
server.tool(
  "resolve_food_name",
  "把口语/俗称/别名解析成《中国食物成分表》里的标准条目，并返回该条目的营养摘要。" +
    "适用于直接搜索无结果的词（如「五花肉」「牛腩」「牛奶」「芝士」「北豆腐」）。" +
    "若成分表确实未收录（如「奶茶」「红烧肉」「饺子」），会返回 missing=true 与可用的近似食材。",
  { name: z.string().describe("口语名、俗称或别名，如「五花肉」「牛奶」「芝士」") },
  async ({ name }) => {
    const { pool, alias_used, hint, matched_by } = searchPool(name);
    const out: Record<string, unknown> = { query: name, matched_by };
    if (alias_used) out.alias_used = alias_used;
    if (hint) {
      out.missing = true;
      out.hint = hint;
    }
    out.count = Math.min(pool.length, 8);
    out.foods = pool.slice(0, 8).map(summaryOf);
    return json(out);
  },
);

// Tool 4: get_nutrition —— 支持 ID 或名称
server.tool(
  "get_nutrition",
  "获取某个食物的完整营养成分（每 100g）。可用 food_id（来自 search_food），" +
    "也可直接用 food_name 传标准名或口语别名（如「北豆腐」「五花肉」「牛奶」）。",
  {
    food_id: z.number().int().positive().optional().describe("食物 ID，来自 search_food"),
    food_name: z.string().optional().describe("食物名称，支持口语别名；与 food_id 至少提供一个"),
  },
  async ({ food_id, food_name }) => {
    let food: Food | undefined;

    if (food_id !== undefined) {
      food = foods.find((f) => f.id === food_id);
    } else if (food_name) {
      const { pool } = searchPool(food_name);
      const exact = pool.find((f) => f.name === food_name.trim());
      if (exact) {
        food = exact;
      } else if (pool.length === 1) {
        food = pool[0];
      } else if (pool.length > 1) {
        return json({
          ambiguous: true,
          message: `「${food_name}」匹配到 ${pool.length} 条，请用 food_id 指定，或从下列候选中选择。`,
          candidates: pool.slice(0, 10).map(summaryOf),
        });
      }
    } else {
      return json({ error: "请提供 food_id 或 food_name" });
    }

    if (!food) {
      return json({ error: `未找到食物：${food_id ?? food_name}` });
    }
    return json({ ...food, unit: 100 });
  },
);

// Tool 5: compare_foods
server.tool(
  "compare_foods",
  "对比多个食物的营养成分（每100g），提供2-5个食物ID",
  {
    food_ids: z.array(z.number().int().positive()).min(2).max(5).describe("食物ID数组"),
  },
  async ({ food_ids }) => {
    const found = food_ids.map((id) => foods.find((f) => f.id === id)).filter(Boolean) as Food[];

    if (found.length < 2) {
      return json({ error: "至少需要找到2个有效食物进行对比" });
    }

    return json({
      unit: 100,
      foods: found.map((f) => ({ ...f })),
    });
  },
);

// Tool 6: filter_by_nutrient
server.tool(
  "filter_by_nutrient",
  "按营养素范围筛选食物，如查找高蛋白、低脂肪的食物。total 为符合条件的总条数。",
  {
    nutrient: z.enum(NUTRIENT_KEYS as unknown as [string, ...string[]]).describe("营养素字段名"),
    min: z.number().optional().describe("最小值（含）"),
    max: z.number().optional().describe("最大值（含）"),
    limit: z.number().int().min(1).max(100).default(20).describe("返回数量上限，默认20"),
    offset: z.number().int().min(0).default(0).describe("跳过条数，默认 0"),
    sort: z.enum(["asc", "desc"]).default("desc").describe("排序方向，默认降序"),
  },
  async ({ nutrient, min, max, limit, offset, sort }) => {
    const key = nutrient as NutrientKey;
    const results = foods.filter((f) => {
      const val = f[key];
      if (val === null) return false;
      if (min !== undefined && val < min) return false;
      if (max !== undefined && val > max) return false;
      return true;
    });

    results.sort((a, b) => {
      const va = a[key] ?? 0;
      const vb = b[key] ?? 0;
      return sort === "desc" ? vb - va : va - vb;
    });

    const total = results.length;
    const page = results.slice(offset, offset + limit);

    return json({
      nutrient,
      total,
      count: page.length,
      offset,
      limit,
      has_more: offset + page.length < total,
      foods: page.map((f) => ({
        id: f.id,
        name: f.name,
        [nutrient]: f[key],
      })),
    });
  },
);

// Tool 7: list_aliases
server.tool(
  "list_aliases",
  "列出已内置的口语别名映射表，以及成分表中确认未收录的词（含可用的近似食材）。" +
    "想知道某个词能不能直接查时，先调这个工具最省事。",
  {
    filter: z.string().optional().describe("可选，按关键词过滤别名，如「肉」「奶」"),
  },
  async ({ filter }) => {
    const match = (s: string) => !filter || s.includes(filter);
    const aliases: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(aliasData.aliases)) {
      if (match(k) || v.targets.some(match)) aliases[k] = v;
    }
    const absent: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(aliasData.absent)) {
      if (match(k)) absent[k] = v;
    }
    return json({
      alias_count: Object.keys(aliases).length,
      absent_count: Object.keys(absent).length,
      note: aliasData.note,
      updated: aliasData.updated,
      aliases,
      absent,
    });
  },
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
