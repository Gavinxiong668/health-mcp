import type { Migration } from '../migrations.js';

// Add `category` column to foods for organized browsing.
// Also backfill categories for existing foods based on name/alias patterns.
const sql = `
ALTER TABLE foods ADD COLUMN category TEXT;

-- Backfill categories for existing seeded foods
UPDATE foods SET category = '主食' WHERE
  name LIKE '%rice%' OR name LIKE '%noodle%' OR name LIKE '%oat%' OR name LIKE '%bread%'
  OR name LIKE '%starch%' OR name LIKE '%Glass nood%'
  OR aliases LIKE '%白米%' OR aliases LIKE '%米饭%' OR aliases LIKE '%米粉%'
  OR aliases LIKE '%面条%' OR aliases LIKE '%粉丝%' OR aliases LIKE '%粉条%'
  OR aliases LIKE '%燕麦%' OR aliases LIKE '%吐司%' OR aliases LIKE '%面包%'
  OR aliases LIKE '%淀粉%' OR aliases LIKE '%生粉%' OR aliases LIKE '%河粉%';

UPDATE foods SET category = '蔬菜' WHERE
  name LIKE '%melon%' OR name LIKE '%cucumber%' OR name LIKE '%lettuce%'
  OR name LIKE '%cabbage%' OR name LIKE '%Choy sum%' OR name LIKE '%Loofah%'
  OR name LIKE '%Broccoli%' OR name LIKE '%Spinach%' OR name LIKE '%Carrot%'
  OR name LIKE '%Tomato%' OR name LIKE '%Radish%' OR name LIKE '%Zucchini%'
  OR name LIKE '%Eggplant%' OR name LIKE '%pepper%' OR name LIKE '%onion%'
  OR name LIKE '%Garlic%' OR name LIKE '%Ginger%' OR name LIKE '%Celery%'
  OR name LIKE '%Lotus%' OR name LIKE '%Pumpkin%'
  OR aliases LIKE '%冬瓜%' OR aliases LIKE '%黄瓜%' OR aliases LIKE '%生菜%'
  OR aliases LIKE '%白菜%' OR aliases LIKE '%菜心%' OR aliases LIKE '%丝瓜%'
  OR aliases LIKE '%西兰花%' OR aliases LIKE '%菠菜%' OR aliases LIKE '%胡萝卜%'
  OR aliases LIKE '%西红柿%' OR aliases LIKE '%番茄%' OR aliases LIKE '%萝卜%'
  OR aliases LIKE '%西葫芦%' OR aliases LIKE '%茄子%' OR aliases LIKE '%青椒%'
  OR aliases LIKE '%葱%' OR aliases LIKE '%蒜%' OR aliases LIKE '%姜%'
  OR aliases LIKE '%芹菜%' OR aliases LIKE '%莲藕%' OR aliases LIKE '%藕%'
  OR aliases LIKE '%南瓜%';

UPDATE foods SET category = '肉类' WHERE
  name LIKE '%Chicken%' OR name LIKE '%Pork%' OR name LIKE '%Beef%' OR name LIKE '%Lamb%'
  OR aliases LIKE '%鸡胸%' OR aliases LIKE '%鸡腿%' OR aliases LIKE '%鸡肉%'
  OR aliases LIKE '%猪%' OR aliases LIKE '%排骨%' OR aliases LIKE '%牛肉%'
  OR aliases LIKE '%羊肉%' OR aliases LIKE '%瘦肉%';

UPDATE foods SET category = '水产' WHERE
  name LIKE '%carp%' OR name LIKE '%bass%' OR name LIKE '%Shrimp%' OR name LIKE '%Salmon%'
  OR aliases LIKE '%草鱼%' OR aliases LIKE '%鲈鱼%' OR aliases LIKE '%虾%'
  OR aliases LIKE '%三文鱼%' OR aliases LIKE '%鲑鱼%';

UPDATE foods SET category = '蛋奶' WHERE
  name LIKE '%Egg%' OR name LIKE '%Milk%' OR name LIKE '%yogurt%'
  OR aliases LIKE '%鸡蛋%' OR aliases LIKE '%蛋白%' OR aliases LIKE '%牛奶%'
  OR aliases LIKE '%酸奶%';

UPDATE foods SET category = '水果' WHERE
  name LIKE '%Apple%' OR name LIKE '%Banana%' OR name LIKE '%Watermelon%'
  OR name LIKE '%Grape%' OR name LIKE '%Blueberr%' OR name LIKE '%Pear%'
  OR name LIKE '%Peach%' OR name LIKE '%dates%'
  OR aliases LIKE '%苹果%' OR aliases LIKE '%香蕉%' OR aliases LIKE '%西瓜%'
  OR aliases LIKE '%葡萄%' OR aliases LIKE '%蓝莓%' OR aliases LIKE '%梨%'
  OR aliases LIKE '%桃%' OR aliases LIKE '%红枣%';

UPDATE foods SET category = '豆类/坚果' WHERE
  name LIKE '%tofu%' OR name LIKE '%yuba%'
  OR aliases LIKE '%豆腐%' OR aliases LIKE '%腐竹%';

UPDATE foods SET category = '油脂/调味' WHERE
  name LIKE '%oil%' OR name LIKE '%Soy sauce%' OR name LIKE '%vinegar%'
  OR name LIKE '%Honey%' OR name LIKE '%Sugar%'
  OR aliases LIKE '%橄榄油%' OR aliases LIKE '%花生油%' OR aliases LIKE '%香油%'
  OR aliases LIKE '%酱油%' OR aliases LIKE '%醋%' OR aliases LIKE '%蜂蜜%'
  OR aliases LIKE '%白糖%' OR aliases LIKE '%芝麻油%';
`;

export const migration0025: Migration = { id: '0025-food-category', sql };
