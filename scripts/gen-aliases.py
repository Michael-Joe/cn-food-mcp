#!/usr/bin/env python3
"""生成 aliases.json（终版）：显式精确名优先，关键词兜底，去重排序限量，逐条校验存在性。"""
import json

SRC = "src/data/foods.json"
OUT = "src/data/aliases.json"
foods = json.load(open(SRC))
names = [f["name"] for f in foods]
nameset = set(names)
CAP = 6


def pick(kw=None, ex=None, exact=None, prefer=None):
    """优先取 exact/prefer 中存在的；否则关键词匹配后去重、排序、截断。"""
    out = []
    for n in (exact or []) + (prefer or []):
        if n in nameset and n not in out:
            out.append(n)
    if kw:
        cand = []
        seen = set()
        for n in names:
            if n in seen:
                continue
            if not any(k in n for k in kw):
                continue
            if ex and any(k in n for k in ex):
                continue
            seen.add(n)
            cand.append(n)
        cand.sort(key=lambda n: (n.count("("), len(n)))
        for n in cand:
            if n not in out:
                out.append(n)
    return out[:CAP]


# alias -> (kw, ex, exact, note)
S = {
    # ---- 肉类部位 ----
    "五花肉":     (None, None, ["猪肉(肋条肉)"], "即猪肋条肉，肥瘦相间"),
    "猪五花":     (None, None, ["猪肉(肋条肉)"], None),
    "牛腩":       (None, None, ["牛肉(腑肋)"], "即牛腹肋肉"),
    "牛腱":       (None, None, ["牛肉(后腱)", "牛肉(前腱)"], None),
    "牛腱子":     (None, None, ["牛肉(后腱)", "牛肉(前腱)"], None),
    "里脊":       (None, None, ["里脊(猪)"], None),
    "猪里脊":     (None, None, ["里脊(猪)"], None),
    "鸡胸肉":     (None, None, ["鸡胸脯肉"], None),
    "鸡胸":       (None, None, ["鸡胸脯肉"], None),
    "鸡腿肉":     (None, None, ["鸡腿"], None),
    "鸡翅":       (["鸡翅"], None, None, None),
    "鸡爪":       (["鸡爪", "凤爪"], None, None, None),
    "排骨":       (["排骨", "猪大排", "猪小排"], None, None, "猪肋排"),
    "猪排骨":     (["排骨", "猪大排", "猪小排"], None, None, None),
    "猪蹄":       (["猪蹄", "猪手"], None, None, None),
    "猪肘子":     (["肘"], ["羊", "牛"], None, None),
    "猪肝":       (None, None, ["猪肝"], None),
    "猪血":       (None, None, ["猪血"], None),
    "猪肚":       (None, None, ["猪肚"], None),
    "猪腰":       (None, None, ["猪腰子"], None),
    "猪心":       (None, None, ["猪心"], None),
    "猪耳":       (None, None, ["猪耳"], None),
    "猪舌":       (None, None, ["猪舌"], None),
    "猪大肠":     (["猪大肠", "猪小肠"], None, None, None),
    "肥牛":       (None, None, ["牛肉(肥)"], "脂肪含量高"),
    "羊肉":       (["羊肉", "羊("], None, None, None),
    "鸭肉":       (["鸭"], ["蛋", "掌", "肝", "血"], None, None),
    "叉烧":       (None, None, ["叉烧肉"], None),
    "腊肉":       (["腊肉", "培根"], None, None, None),
    "火腿":       (["火腿"], None, None, None),
    "香肠":       (["肠("], ["粉肠", "蛋清肠"], None, None),
    "肉松":       (["肉松"], None, None, None),
    "酱牛肉":     (None, None, ["酱牛肉"], None),

    # ---- 蛋奶豆 ----
    "牛奶":       (None, None, ["牛乳"], "成分表称「牛乳」"),
    "鲜奶":       (None, None, ["牛乳"], None),
    "奶粉":       (["牛乳粉"], ["婴儿"], None, None),
    "酸奶":       (None, None, ["牛乳(酸)"], None),
    "芝士":       (["干酪", "奶酪"], None, None, None),
    "豆腐脑":     (["豆腐脑"], None, None, None),
    "北豆腐":     (None, None, ["豆腐(北)"], "老豆腐，水分少蛋白高"),
    "南豆腐":     (None, None, ["豆腐(南)"], "嫩豆腐"),
    "老豆腐":     (None, None, ["豆腐(北)"], None),
    "嫩豆腐":     (["豆腐(南)", "豆腐(内酯"], None, None, None),
    "内酯豆腐":   (None, None, ["豆腐(内酯豆腐)"], None),
    "腐竹":       (["腐竹", "豆腐皮", "豆腐丝"], None, None, None),
    "千张":       (["豆腐干", "豆腐皮"], None, None, None),
    "香干":       (["香干", "酱油干"], None, None, None),
    "豆干":       (["豆腐干"], None, None, None),
    "腐乳":       (["腐乳", "酱豆腐"], None, None, None),
    "毛豆":       (None, None, ["毛豆(青豆)"], None),
    "黄豆":       (["黄豆", "大豆"], ["淀粉"], None, None),

    # ---- 主食 ----
    "白米饭":     (None, None, ["米饭(蒸,粳米)", "米饭(蒸,籼米)"], None),
    "米饭":       (None, None, ["米饭(蒸,粳米)", "米饭(蒸,籼米)"], None),
    "大米":       (None, None, ["稻米(粳)", "稻米(籼)"], None),
    "面条":       (["面条"], None, None, None),
    "挂面":       (["挂面"], None, None, None),
    "花卷":       (None, None, ["花卷"], None),
    "馒头":       (None, None, ["馒头(蒸,标准粉)", "馒头(蒸,富强粉)"], None),
    "米粉":       (["米粉"], ["豆米粉"], None, None),
    "年糕":       (["年糕"], None, None, None),
    "燕麦":       (["燕麦", "莜麦"], None, None, None),
    "玉米":       (["玉米"], ["淀粉", "油"], None, None),
    "红薯":       (["红薯", "甘薯"], None, None, None),
    "地瓜":       (["红薯", "甘薯"], None, None, None),
    "土豆":       (None, None, ["土豆"], "成分表称「土豆」或「马铃薯」"),
    "马铃薯":     (None, None, ["土豆"], None),
    "山药":       (["山药"], None, None, None),
    "芋头":       (["芋头"], None, None, None),
    "莲藕":       (["藕"], None, None, None),

    # ---- 蔬果 ----
    "番茄":       (["番茄", "西红柿"], None, None, "与西红柿同物异名"),
    "西红柿":     (["西红柿", "番茄"], None, None, None),
    "橙子":       (None, None, ["橙"], None),
    "橘子":       (["橘", "柑"], None, None, None),
    "猕猴桃":     (["猕猴桃", "奇异果"], None, None, None),
    "菠萝":       (["菠萝", "凤梨"], None, None, None),
    "青椒":       (None, None, ["柿子椒"], None),
    "柿子椒":     (None, None, ["柿子椒"], None),
    "卷心菜":     (["卷心菜", "甘蓝"], None, None, None),
    "圆白菜":     (["卷心菜", "甘蓝"], None, None, None),
    "大白菜":     (["白菜(大", "大白菜"], None, None, None),
    "菜花":       (["菜花"], ["西兰"], None, None),
    "西兰花":     (["西兰花"], None, None, None),
    "香菇":       (["香菇"], None, None, None),
    "平菇":       (["平菇"], None, None, None),
    "金针菇":     (["金针菇"], None, None, None),
    "木耳":       (["木耳"], None, None, None),
    "豆角":       (["四季豆", "豆角"], None, None, None),
    "四季豆":     (["四季豆", "豆角"], None, None, None),

    # ---- 油 / 调料 ----
    "大豆油":     (None, None, ["豆油"], None),
    "色拉油":     (None, None, ["豆油", "菜籽油"], None),
    "香油":       (["香油", "芝麻油"], None, None, None),
    "芝麻酱":     (["芝麻酱"], None, None, None),
    "花生酱":     (["花生酱"], None, None, None),
    "酱油":       (None, None, ["酱油"], None),
    "生抽":       (None, None, ["酱油"], "成分表未单列生抽"),
    "老抽":       (None, None, ["酱油"], "成分表未单列老抽"),
    "醋":         (["醋"], None, None, None),
    "食盐":       (["盐"], ["酱油", "味精"], None, None),
    "白糖":       (["白糖", "绵白糖"], None, None, None),
    "红糖":       (["红糖"], None, None, None),

    # ---- 水产 ----
    "虾":         (None, None, ["海虾", "河虾", "基围虾"], None),
    "基围虾":     (None, None, ["基围虾"], None),
    "三文鱼":     (["三文鱼", "鲑"], None, None, None),
    "带鱼":       (None, None, ["带鱼"], None),
    "鲫鱼":       (["鲫"], None, None, None),
    "草鱼":       (None, None, ["草鱼"], None),
    "鲈鱼":       (["鲈"], None, None, None),
    "鳕鱼":       (["鳕"], None, None, None),

    # ---- 坚果 ----
    "核桃":       (["核桃"], None, None, None),
    "花生":       (["花生"], ["酱"], None, None),
    "瓜子":       (["瓜子", "葵花子"], None, None, None),
    "杏仁":       (["杏仁"], None, None, None),

    # ---- 饮品 / 甜点 ----
    "可乐":       (["可乐"], None, None, None),
    "啤酒":       (["啤酒"], None, None, None),
    "白酒":       (["白酒", "二锅头"], None, None, None),
    "葡萄酒":     (["葡萄酒"], None, None, None),
    "冰淇淋":     (["冰淇淋"], None, None, None),
    "蛋糕":       (["蛋糕"], None, None, None),
    "巧克力":     (["巧克力"], None, None, None),
    "月饼":       (["月饼"], None, None, None),
}

# 确认无数据，显式告知 + 近似替代
ABSENT = {
    "饺子":     ["小麦粉(特二粉)"],
    "馄饨":     ["小麦粉(特二粉)"],
    "包子":     ["馒头"],
    "全麦面包": ["面包"],
    "烧鸡":     ["鸡胸脯肉", "鸡腿"],
    "河粉":     ["粉丝", "粉皮", "粉条"],
    "米线":     ["米粉", "粉皮", "粉丝"],
    "拉面":     ["面条", "挂面"],
    "腰果":     [],
    "开心果":   [],
    "咖啡":     [],
    "奶茶":     [],
    "拿铁":     ["牛乳"],
    "橄榄油":   ["菜籽油", "豆油", "花生油", "茶油"],
    "红烧肉":   ["猪肉(肋条肉)"],
    "回锅肉":   ["猪肉(肋条肉)"],
    "宫保鸡丁": ["鸡胸脯肉"],
    "鱼香肉丝": ["猪肉(瘦)"],
    "麻婆豆腐": ["豆腐(南)"],
    "番茄炒蛋": ["番茄", "鸡蛋(白皮)"],
    "盖浇饭":   ["米饭(蒸,粳米)"],
    "麻辣烫":   [],
    "汉堡":     ["面包"],
    "薯条":     ["油炸土豆片"],
}

aliases, absent, bad = {}, {}, []
for a, (kw, ex, exact, note) in S.items():
    t = pick(kw, ex, exact)
    if not t:
        bad.append(a)
        continue
    e = {"targets": t}
    if note:
        e["note"] = note
    aliases[a] = e

for a, near in ABSENT.items():
    absent[a] = {"reason": "《中国食物成分表》中无此条目",
                 "nearby": [n for n in near if n in nameset]}

print(f"别名 {len(aliases)} 条 | 确认缺失 {len(absent)} 条")
if bad:
    print("!! 仍未解析:", bad)
else:
    print("校验通过：所有别名目标均真实存在")

print("\n--- 修正后的抽查 ---")
for a in ["五花肉", "牛腩", "牛奶", "橙子", "土豆", "酱油", "鸡胸肉", "虾", "青椒", "猪肘子"]:
    print(f"  {a:<7} -> {'、'.join(aliases[a]['targets'])}")

json.dump({
    "version": "1.0.0",
    "updated": "2026-10-15",
    "note": "口语名到《中国食物成分表》标准名的映射。targets 与 nearby 均已校验存在于 foods.json。absent 表示成分表确实未收录该条目。",
    "aliases": aliases,
    "absent": absent,
}, open(OUT, "w"), ensure_ascii=False, indent=2)
print(f"\n已写入 {OUT}")
