import type { Migration } from '../migrations.js';

// Rename all foods from English primary names to Chinese.
// The first alias of each food is the most common Chinese name.
const sql = `
UPDATE foods SET name = '白米饭' WHERE name = 'White rice, cooked';
UPDATE foods SET name = '白米（干）' WHERE name = 'White rice, dry';
UPDATE foods SET name = '糙米饭' WHERE name = 'Brown rice, cooked';
UPDATE foods SET name = '米粉' WHERE name = 'Rice noodles, cooked';
UPDATE foods SET name = '面条' WHERE name = 'Wheat noodles, cooked';
UPDATE foods SET name = '粉丝' WHERE name = 'Glass noodles, dry';
UPDATE foods SET name = '酸面包' WHERE name = 'Sourdough bread';
UPDATE foods SET name = '白面包' WHERE name = 'White bread';
UPDATE foods SET name = '燕麦片' WHERE name = 'Rolled oats, dry';
UPDATE foods SET name = '淀粉' WHERE name = 'Mung bean starch';
UPDATE foods SET name = '土豆' WHERE name = 'Potato, cooked';
UPDATE foods SET name = '甜玉米' WHERE name = 'Sweet corn';

UPDATE foods SET name = '冬瓜' WHERE name = 'Winter melon';
UPDATE foods SET name = '黄瓜' WHERE name = 'Cucumber';
UPDATE foods SET name = '生菜' WHERE name = 'Lettuce';
UPDATE foods SET name = '大白菜' WHERE name = 'Chinese cabbage';
UPDATE foods SET name = '菜心' WHERE name = 'Choy sum';
UPDATE foods SET name = '丝瓜' WHERE name = 'Loofah';
UPDATE foods SET name = '西兰花' WHERE name = 'Broccoli';
UPDATE foods SET name = '菠菜' WHERE name = 'Spinach, raw';
UPDATE foods SET name = '胡萝卜' WHERE name = 'Carrot';
UPDATE foods SET name = '西红柿' WHERE name = 'Tomato';
UPDATE foods SET name = '白萝卜' WHERE name = 'Radish, white';
UPDATE foods SET name = '西葫芦' WHERE name = 'Zucchini';
UPDATE foods SET name = '茄子' WHERE name = 'Eggplant';
UPDATE foods SET name = '青椒' WHERE name = 'Bell pepper';
UPDATE foods SET name = '小葱' WHERE name = 'Green onion';
UPDATE foods SET name = '大蒜' WHERE name = 'Garlic';
UPDATE foods SET name = '生姜' WHERE name = 'Ginger';
UPDATE foods SET name = '芹菜' WHERE name = 'Celery';
UPDATE foods SET name = '莲藕' WHERE name = 'Lotus root';
UPDATE foods SET name = '南瓜' WHERE name = 'Pumpkin';
UPDATE foods SET name = '香菇' WHERE name = 'Shiitake mushroom';
UPDATE foods SET name = '绿豆芽' WHERE name = 'Bean sprouts';
UPDATE foods SET name = '苦瓜' WHERE name = 'Bitter melon';
UPDATE foods SET name = '芦笋' WHERE name = 'Asparagus';

UPDATE foods SET name = '苹果' WHERE name = 'Apple';
UPDATE foods SET name = '香蕉' WHERE name = 'Banana';
UPDATE foods SET name = '西瓜' WHERE name = 'Watermelon';
UPDATE foods SET name = '葡萄' WHERE name = 'Grape';
UPDATE foods SET name = '蓝莓' WHERE name = 'Blueberries';
UPDATE foods SET name = '雪梨' WHERE name = 'Pear';
UPDATE foods SET name = '桃子' WHERE name = 'Peach';
UPDATE foods SET name = '红枣' WHERE name = 'Red dates, dried';
UPDATE foods SET name = '草莓' WHERE name = 'Strawberry';
UPDATE foods SET name = '橙子' WHERE name = 'Orange';

UPDATE foods SET name = '鸡胸肉' WHERE name = 'Chicken breast, grilled';
UPDATE foods SET name = '鸡腿肉' WHERE name = 'Chicken thigh, skinless';
UPDATE foods SET name = '猪瘦肉' WHERE name = 'Pork lean';
UPDATE foods SET name = '猪排骨' WHERE name = 'Pork ribs';
UPDATE foods SET name = '牛肉' WHERE name = 'Beef lean';
UPDATE foods SET name = '羊肉' WHERE name = 'Lamb';
UPDATE foods SET name = '鸡肝' WHERE name = 'Chicken liver';
UPDATE foods SET name = '猪肝' WHERE name = 'Pork liver';

UPDATE foods SET name = '草鱼' WHERE name = 'Grass carp';
UPDATE foods SET name = '鲈鱼' WHERE name = 'Sea bass';
UPDATE foods SET name = '虾仁' WHERE name = 'Shrimp';
UPDATE foods SET name = '三文鱼' WHERE name = 'Salmon fillet';
UPDATE foods SET name = '罗非鱼' WHERE name = 'Tilapia';
UPDATE foods SET name = '鱿鱼' WHERE name = 'Squid';

UPDATE foods SET name = '鸡蛋' WHERE name = 'Egg, whole';
UPDATE foods SET name = '鸡蛋白' WHERE name = 'Egg white';
UPDATE foods SET name = '全脂牛奶' WHERE name = 'Milk, whole';
UPDATE foods SET name = '脱脂牛奶' WHERE name = 'Milk, skim';
UPDATE foods SET name = '酸奶' WHERE name = 'Greek yogurt';
UPDATE foods SET name = '蛋黄' WHERE name = 'Egg yolk';

UPDATE foods SET name = '嫩豆腐' WHERE name = 'Silken tofu';
UPDATE foods SET name = '老豆腐' WHERE name = 'Firm tofu';
UPDATE foods SET name = '腐竹' WHERE name = 'Dried yuba';
UPDATE foods SET name = '花生' WHERE name = 'Peanut, roasted';
UPDATE foods SET name = '核桃' WHERE name = 'Walnut';
UPDATE foods SET name = '杏仁' WHERE name = 'Almond';

UPDATE foods SET name = '橄榄油' WHERE name = 'Olive oil';
UPDATE foods SET name = '花生油' WHERE name = 'Peanut oil';
UPDATE foods SET name = '芝麻油' WHERE name = 'Sesame oil';
UPDATE foods SET name = '酱油' WHERE name = 'Soy sauce, light';
UPDATE foods SET name = '米醋' WHERE name = 'Rice vinegar';
UPDATE foods SET name = '蜂蜜' WHERE name = 'Honey';
UPDATE foods SET name = '白糖' WHERE name = 'Sugar, white';
UPDATE foods SET name = '黄油' WHERE name = 'Butter';
UPDATE foods SET name = '陈醋' WHERE name = 'Black vinegar';

UPDATE foods SET name = '黑巧克力' WHERE name = 'Dark chocolate';
UPDATE foods SET name = '薯片' WHERE name = 'Potato chips';
UPDATE foods SET name = '绿茶' WHERE name = 'Green tea, brewed';
UPDATE foods SET name = '豆浆' WHERE name = 'Soy milk, unsweetened';
UPDATE foods SET name = '椰子水' WHERE name = 'Coconut water';
`;

export const migration0026: Migration = { id: '0026-foods-chinese-names', sql };
