/**
 * Seeds the food database with 86 common foods (Chinese cooking focus)
 * organized by category, with accurate per-100g nutritional data from USDA.
 *
 * All food names are in Chinese; English names kept as aliases for search.
 *
 * Categories: 主食, 蔬菜, 水果, 肉类, 水产, 蛋奶, 豆类/坚果, 油脂/调味, 零食/饮品
 *
 * Usage:
 *   pnpm --filter health-mcp exec tsx scripts/seed-foods.ts
 *
 * Env:
 *   HEALTH_MCP_URL    base URL (default http://127.0.0.1:7777)
 *   HEALTH_MCP_TOKEN  bearer token
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE = (process.env.HEALTH_MCP_URL ?? 'http://127.0.0.1:7777').replace(/$/, '');
const TOKEN = process.env.HEALTH_MCP_TOKEN ?? null;

type FoodDef = {
  name: string;
  aliases: string[];
  category: string;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sat_fat?: number;
  sodium?: number;
  potassium?: number;
  calcium?: number;
  magnesium?: number;
  iron?: number;
  serving_grams?: number;
};

// ── 主食 (12) ──
const staples: FoodDef[] = [
  { name: '白米饭', aliases: ['米饭', '白米', 'White rice'], category: '主食', kcal: 130, protein: 2.7, carb: 28, fat: 0.3, fiber: 0.4, potassium: 35, sodium: 1, calcium: 3, iron: 0.2, magnesium: 12, serving_grams: 200 },
  { name: '白米（干）', aliases: ['生米'], category: '主食', kcal: 365, protein: 7.1, carb: 80, fat: 0.7, fiber: 1.3, potassium: 109, sodium: 5, calcium: 28, iron: 0.8, magnesium: 25, serving_grams: 50 },
  { name: '糙米饭', aliases: ['糙米', 'Brown rice'], category: '主食', kcal: 123, protein: 2.7, carb: 26, fat: 1.0, fiber: 1.6, potassium: 79, sodium: 1, calcium: 3, iron: 0.4, magnesium: 44, serving_grams: 200 },
  { name: '米粉', aliases: ['河粉', 'Rice noodles'], category: '主食', kcal: 110, protein: 1.8, carb: 24, fat: 0.3, fiber: 0.5, potassium: 17, sodium: 3, calcium: 3, iron: 0.1, magnesium: 5, serving_grams: 200 },
  { name: '面条', aliases: ['小麦面', 'Wheat noodles'], category: '主食', kcal: 138, protein: 4.5, carb: 25, fat: 2, fiber: 1.8, potassium: 44, sodium: 5, calcium: 10, iron: 1.1, magnesium: 13, serving_grams: 200 },
  { name: '粉丝', aliases: ['绿豆粉丝', '粉条', 'Glass noodles'], category: '主食', kcal: 340, protein: 0.2, carb: 85, fat: 0.1, fiber: 0.1, potassium: 18, sodium: 28, calcium: 14, iron: 0.5, magnesium: 2, serving_grams: 50 },
  { name: '酸面包', aliases: ['Sourdough bread'], category: '主食', kcal: 289, protein: 11, carb: 56, fat: 1.8, fiber: 2.5, potassium: 110, sodium: 490, calcium: 52, iron: 2.1, magnesium: 25, serving_grams: 50 },
  { name: '白面包', aliases: ['白吐司', 'White bread'], category: '主食', kcal: 265, protein: 9, carb: 49, fat: 3.2, fiber: 2.7, potassium: 100, sodium: 491, calcium: 107, iron: 3.6, magnesium: 25, serving_grams: 30 },
  { name: '燕麦片', aliases: ['燕麦', 'Rolled oats'], category: '主食', kcal: 380, protein: 13, carb: 67, fat: 7, fiber: 10, potassium: 352, sodium: 6, calcium: 54, iron: 4.3, magnesium: 138, serving_grams: 40 },
  { name: '淀粉', aliases: ['生粉'], category: '主食', kcal: 344, protein: 0.2, carb: 86, fat: 0.1, fiber: 0.1, potassium: 12, sodium: 8, calcium: 13, iron: 0.1, magnesium: 1, serving_grams: 15 },
  { name: '土豆', aliases: ['马铃薯', 'Potato'], category: '主食', kcal: 87, protein: 1.9, carb: 20, fat: 0.1, fiber: 1.8, potassium: 328, sodium: 4, calcium: 8, iron: 0.3, magnesium: 23, serving_grams: 150 },
  { name: '甜玉米', aliases: ['玉米', 'Sweet corn'], category: '主食', kcal: 96, protein: 3.4, carb: 21, fat: 1.5, fiber: 2.4, potassium: 218, sodium: 15, calcium: 2, iron: 0.5, magnesium: 37, serving_grams: 150 },
];

// ── 蔬菜 (24) ──
const vegetables: FoodDef[] = [
  { name: '冬瓜', aliases: ['Winter melon'], category: '蔬菜', kcal: 12, protein: 0.4, carb: 2.6, fat: 0.1, fiber: 0.3, sugar: 1.5, potassium: 57, sodium: 2, calcium: 19, iron: 0.2, magnesium: 8, serving_grams: 200 },
  { name: '黄瓜', aliases: ['Cucumber'], category: '蔬菜', kcal: 15, protein: 0.7, carb: 2.9, fat: 0.1, fiber: 0.5, sugar: 1.7, potassium: 102, sodium: 2, calcium: 16, iron: 0.3, magnesium: 13, serving_grams: 150 },
  { name: '生菜', aliases: ['Lettuce'], category: '蔬菜', kcal: 15, protein: 1.3, carb: 2.2, fat: 0.2, fiber: 1.3, sugar: 0.9, potassium: 100, sodium: 28, calcium: 36, iron: 0.9, magnesium: 13, serving_grams: 100 },
  { name: '大白菜', aliases: ['白菜', 'Chinese cabbage'], category: '蔬菜', kcal: 13, protein: 1.5, carb: 2.2, fat: 0.1, fiber: 0.7, sugar: 1.5, potassium: 130, sodium: 28, calcium: 50, iron: 0.7, magnesium: 13, serving_grams: 200 },
  { name: '菜心', aliases: ['菜薹', 'Choy sum'], category: '蔬菜', kcal: 15, protein: 1.6, carb: 2.2, fat: 0.2, fiber: 1.0, potassium: 180, sodium: 17, calcium: 100, iron: 0.8, magnesium: 17, serving_grams: 150 },
  { name: '丝瓜', aliases: ['Loofah'], category: '蔬菜', kcal: 17, protein: 1.0, carb: 3.2, fat: 0.1, fiber: 0.5, potassium: 115, sodium: 2, calcium: 30, iron: 0.4, magnesium: 11, serving_grams: 200 },
  { name: '西兰花', aliases: ['绿花菜', 'Broccoli'], category: '蔬菜', kcal: 34, protein: 2.8, carb: 4.3, fat: 0.4, fiber: 3.3, potassium: 316, sodium: 33, calcium: 47, iron: 0.7, magnesium: 21, serving_grams: 100 },
  { name: '菠菜', aliases: ['Spinach'], category: '蔬菜', kcal: 23, protein: 2.9, carb: 3.6, fat: 0.4, fiber: 2.2, potassium: 311, sodium: 79, calcium: 99, iron: 2.7, magnesium: 79, serving_grams: 100 },
  { name: '胡萝卜', aliases: ['红萝卜', 'Carrot'], category: '蔬菜', kcal: 41, protein: 0.9, carb: 8.2, fat: 0.2, fiber: 2.8, sugar: 4.7, potassium: 190, sodium: 57, calcium: 33, iron: 0.3, magnesium: 12, serving_grams: 80 },
  { name: '西红柿', aliases: ['番茄', 'Tomato'], category: '蔬菜', kcal: 18, protein: 0.9, carb: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6, potassium: 237, sodium: 5, calcium: 10, iron: 0.3, magnesium: 11, serving_grams: 150 },
  { name: '白萝卜', aliases: ['萝卜', 'Radish'], category: '蔬菜', kcal: 18, protein: 0.6, carb: 3.4, fat: 0.1, fiber: 1.6, potassium: 173, sodium: 5, calcium: 36, iron: 0.3, magnesium: 16, serving_grams: 200 },
  { name: '西葫芦', aliases: ['节瓜', 'Zucchini'], category: '蔬菜', kcal: 17, protein: 1.2, carb: 3.1, fat: 0.3, fiber: 1.0, potassium: 100, sodium: 8, calcium: 15, iron: 0.4, magnesium: 18, serving_grams: 200 },
  { name: '茄子', aliases: ['Eggplant'], category: '蔬菜', kcal: 25, protein: 1.0, carb: 5.9, fat: 0.2, fiber: 3.0, potassium: 142, sodium: 2, calcium: 9, iron: 0.2, magnesium: 14, serving_grams: 200 },
  { name: '青椒', aliases: ['灯笼椒', 'Bell pepper'], category: '蔬菜', kcal: 20, protein: 0.9, carb: 4.2, fat: 0.2, fiber: 1.4, sugar: 2.4, potassium: 162, sodium: 3, calcium: 7, iron: 0.3, magnesium: 10, serving_grams: 100 },
  { name: '小葱', aliases: ['葱', '大葱', 'Green onion'], category: '蔬菜', kcal: 32, protein: 1.8, carb: 6.5, fat: 0.3, fiber: 2.6, potassium: 216, sodium: 16, calcium: 72, iron: 1.5, magnesium: 19, serving_grams: 10 },
  { name: '大蒜', aliases: ['蒜', '蒜末', 'Garlic'], category: '蔬菜', kcal: 149, protein: 6.4, carb: 33, fat: 0.5, fiber: 2.1, potassium: 401, sodium: 17, calcium: 181, iron: 1.7, magnesium: 25, serving_grams: 5 },
  { name: '生姜', aliases: ['姜', 'Ginger'], category: '蔬菜', kcal: 80, protein: 1.8, carb: 18, fat: 0.8, fiber: 2.0, potassium: 415, sodium: 13, calcium: 16, iron: 1.5, magnesium: 43, serving_grams: 5 },
  { name: '芹菜', aliases: ['Celery'], category: '蔬菜', kcal: 14, protein: 0.9, carb: 3.0, fat: 0.2, fiber: 1.5, potassium: 260, sodium: 80, calcium: 40, iron: 0.8, magnesium: 11, serving_grams: 80 },
  { name: '莲藕', aliases: ['藕', 'Lotus root'], category: '蔬菜', kcal: 73, protein: 1.9, carb: 16, fat: 0.1, fiber: 1.2, potassium: 243, sodium: 38, calcium: 39, iron: 1.4, magnesium: 19, serving_grams: 150 },
  { name: '南瓜', aliases: ['Pumpkin'], category: '蔬菜', kcal: 26, protein: 1.0, carb: 5.3, fat: 0.1, fiber: 0.5, sugar: 2.8, potassium: 145, sodium: 1, calcium: 21, iron: 0.8, magnesium: 12, serving_grams: 150 },
  { name: '香菇', aliases: ['冬菇', 'Shiitake mushroom'], category: '蔬菜', kcal: 26, protein: 2.2, carb: 5.2, fat: 0.3, fiber: 3.1, potassium: 282, sodium: 4, calcium: 2, iron: 0.4, magnesium: 17, serving_grams: 50 },
  { name: '绿豆芽', aliases: ['豆芽', 'Bean sprouts'], category: '蔬菜', kcal: 18, protein: 2.1, carb: 2.9, fat: 0.1, fiber: 0.8, potassium: 68, sodium: 5, calcium: 13, iron: 0.5, magnesium: 17, serving_grams: 100 },
  { name: '苦瓜', aliases: ['凉瓜', 'Bitter melon'], category: '蔬菜', kcal: 19, protein: 1.0, carb: 3.7, fat: 0.2, fiber: 1.1, potassium: 256, sodium: 5, calcium: 14, iron: 0.4, magnesium: 17, serving_grams: 150 },
  { name: '芦笋', aliases: ['Asparagus'], category: '蔬菜', kcal: 20, protein: 2.2, carb: 3.9, fat: 0.1, fiber: 2.1, potassium: 202, sodium: 2, calcium: 24, iron: 1.1, magnesium: 14, serving_grams: 100 },
];

// ── 水果 (10) ──
const fruits: FoodDef[] = [
  { name: '苹果', aliases: ['Apple'], category: '水果', kcal: 52, protein: 0.3, carb: 14, fat: 0.2, fiber: 2.4, sugar: 10, potassium: 107, sodium: 1, calcium: 6, iron: 0.1, magnesium: 5, serving_grams: 200 },
  { name: '香蕉', aliases: ['Banana'], category: '水果', kcal: 89, protein: 1.1, carb: 23, fat: 0.3, fiber: 2.6, sugar: 12, potassium: 358, sodium: 1, calcium: 5, iron: 0.3, magnesium: 27, serving_grams: 120 },
  { name: '西瓜', aliases: ['Watermelon'], category: '水果', kcal: 30, protein: 0.6, carb: 7.6, fat: 0.2, fiber: 0.4, sugar: 6.2, potassium: 112, sodium: 1, calcium: 7, iron: 0.2, magnesium: 10, serving_grams: 200 },
  { name: '葡萄', aliases: ['Grape'], category: '水果', kcal: 69, protein: 0.7, carb: 18, fat: 0.2, fiber: 0.9, sugar: 15, potassium: 191, sodium: 2, calcium: 10, iron: 0.4, magnesium: 7, serving_grams: 100 },
  { name: '蓝莓', aliases: ['Blueberries'], category: '水果', kcal: 57, protein: 0.7, carb: 14, fat: 0.3, fiber: 2.4, sugar: 10, potassium: 77, sodium: 1, calcium: 6, iron: 0.3, magnesium: 6, serving_grams: 50 },
  { name: '雪梨', aliases: ['梨', 'Pear'], category: '水果', kcal: 57, protein: 0.4, carb: 15, fat: 0.1, fiber: 3.1, sugar: 9.8, potassium: 116, sodium: 1, calcium: 9, iron: 0.2, magnesium: 7, serving_grams: 200 },
  { name: '桃子', aliases: ['桃', 'Peach'], category: '水果', kcal: 39, protein: 0.9, carb: 10, fat: 0.3, fiber: 1.5, sugar: 8.4, potassium: 190, sodium: 0, calcium: 6, iron: 0.3, magnesium: 9, serving_grams: 150 },
  { name: '红枣', aliases: ['干红枣', 'Red dates'], category: '水果', kcal: 264, protein: 3.5, carb: 68, fat: 0.5, fiber: 6.7, potassium: 524, sodium: 62, calcium: 62, iron: 2.3, magnesium: 54, serving_grams: 15 },
  { name: '草莓', aliases: ['Strawberry'], category: '水果', kcal: 32, protein: 0.7, carb: 7.7, fat: 0.3, fiber: 2.0, sugar: 4.9, potassium: 153, sodium: 1, calcium: 16, iron: 0.4, magnesium: 13, serving_grams: 100 },
  { name: '橙子', aliases: ['橘子', 'Orange'], category: '水果', kcal: 47, protein: 0.9, carb: 12, fat: 0.1, fiber: 2.4, sugar: 9.4, potassium: 181, sodium: 0, calcium: 40, iron: 0.1, magnesium: 10, serving_grams: 150 },
];

// ── 肉类 (8) ──
const meats: FoodDef[] = [
  { name: '鸡胸肉', aliases: ['鸡胸', 'Chicken breast'], category: '肉类', kcal: 165, protein: 31, carb: 0, fat: 3.6, potassium: 256, sodium: 74, calcium: 15, iron: 1.0, magnesium: 29, serving_grams: 150 },
  { name: '鸡腿肉', aliases: ['鸡腿', 'Chicken thigh'], category: '肉类', kcal: 172, protein: 26, carb: 0, fat: 7.5, potassium: 232, sodium: 73, calcium: 12, iron: 1.3, magnesium: 23, serving_grams: 120 },
  { name: '猪瘦肉', aliases: ['瘦肉', '猪肉', 'Pork lean'], category: '肉类', kcal: 143, protein: 21, carb: 0, fat: 6.2, potassium: 305, sodium: 57, calcium: 6, iron: 1.5, magnesium: 23, serving_grams: 100 },
  { name: '猪排骨', aliases: ['排骨', 'Pork ribs'], category: '肉类', kcal: 264, protein: 18, carb: 0, fat: 21, potassium: 265, sodium: 65, calcium: 14, iron: 1.2, magnesium: 18, serving_grams: 150 },
  { name: '牛肉', aliases: ['瘦牛肉', 'Beef lean'], category: '肉类', kcal: 150, protein: 26, carb: 0, fat: 5, potassium: 284, sodium: 52, calcium: 7, iron: 2.6, magnesium: 21, serving_grams: 100 },
  { name: '羊肉', aliases: ['Lamb'], category: '肉类', kcal: 203, protein: 25, carb: 0, fat: 11, potassium: 232, sodium: 72, calcium: 12, iron: 2.0, magnesium: 20, serving_grams: 100 },
  { name: '鸡肝', aliases: ['Chicken liver'], category: '肉类', kcal: 136, protein: 19, carb: 0.7, fat: 6.3, potassium: 243, sodium: 108, calcium: 11, iron: 9.0, magnesium: 19, serving_grams: 50 },
  { name: '猪肝', aliases: ['Pork liver'], category: '肉类', kcal: 129, protein: 19, carb: 5, fat: 3.5, potassium: 235, sodium: 68, calcium: 6, iron: 22.6, magnesium: 18, serving_grams: 50 },
];

// ── 水产 (6) ──
const seafood: FoodDef[] = [
  { name: '草鱼', aliases: ['鲩鱼', 'Grass carp'], category: '水产', kcal: 113, protein: 17, carb: 0, fat: 5.2, potassium: 312, sodium: 46, calcium: 36, iron: 0.9, magnesium: 24, serving_grams: 150 },
  { name: '鲈鱼', aliases: ['海鲈鱼', 'Sea bass'], category: '水产', kcal: 97, protein: 18, carb: 0, fat: 2.7, potassium: 280, sodium: 50, calcium: 18, iron: 0.7, magnesium: 26, serving_grams: 150 },
  { name: '虾仁', aliases: ['虾', '基围虾', 'Shrimp'], category: '水产', kcal: 85, protein: 18, carb: 0.8, fat: 0.9, potassium: 215, sodium: 165, calcium: 62, iron: 1.5, magnesium: 30, serving_grams: 100 },
  { name: '三文鱼', aliases: ['鲑鱼', 'Salmon'], category: '水产', kcal: 208, protein: 20, carb: 0, fat: 13, potassium: 363, sodium: 59, calcium: 12, iron: 0.8, magnesium: 29, serving_grams: 120 },
  { name: '罗非鱼', aliases: ['非洲鲫', 'Tilapia'], category: '水产', kcal: 96, protein: 20, carb: 0, fat: 1.7, potassium: 302, sodium: 52, calcium: 10, iron: 0.6, magnesium: 34, serving_grams: 150 },
  { name: '鱿鱼', aliases: ['鲜鱿鱼', 'Squid'], category: '水产', kcal: 92, protein: 15, carb: 3.1, fat: 1.4, potassium: 246, sodium: 63, calcium: 16, iron: 0.9, magnesium: 24, serving_grams: 100 },
];

// ── 蛋奶 (6) ──
const eggsDairy: FoodDef[] = [
  { name: '鸡蛋', aliases: ['全蛋', 'Egg'], category: '蛋奶', kcal: 155, protein: 13, carb: 1.1, fat: 11, potassium: 126, sodium: 124, calcium: 56, iron: 1.8, magnesium: 12, serving_grams: 50 },
  { name: '鸡蛋白', aliases: ['蛋白', 'Egg white'], category: '蛋奶', kcal: 52, protein: 11, carb: 0.7, fat: 0.2, potassium: 163, sodium: 166, calcium: 7, iron: 0.2, magnesium: 11, serving_grams: 30 },
  { name: '全脂牛奶', aliases: ['牛奶', 'Whole milk'], category: '蛋奶', kcal: 61, protein: 3.2, carb: 4.8, fat: 3.3, potassium: 132, sodium: 43, calcium: 113, iron: 0.03, magnesium: 10, serving_grams: 250 },
  { name: '脱脂牛奶', aliases: ['Skim milk'], category: '蛋奶', kcal: 34, protein: 3.4, carb: 5.0, fat: 0.1, potassium: 156, sodium: 42, calcium: 122, iron: 0.05, magnesium: 11, serving_grams: 250 },
  { name: '酸奶', aliases: ['希腊酸奶', 'Greek yogurt'], category: '蛋奶', kcal: 73, protein: 10, carb: 4, fat: 2, potassium: 141, sodium: 35, calcium: 110, iron: 0.1, magnesium: 11, serving_grams: 150 },
  { name: '蛋黄', aliases: ['鸡蛋黄', 'Egg yolk'], category: '蛋奶', kcal: 322, protein: 16, carb: 3.6, fat: 27, potassium: 112, sodium: 48, calcium: 129, iron: 7.0, magnesium: 16, serving_grams: 17 },
];

// ── 豆类/坚果 (6) ──
const legumes: FoodDef[] = [
  { name: '嫩豆腐', aliases: ['内酯豆腐', 'Silken tofu'], category: '豆类/坚果', kcal: 55, protein: 5, carb: 2, fat: 3, potassium: 100, sodium: 7, calcium: 68, iron: 0.7, magnesium: 18, serving_grams: 200 },
  { name: '老豆腐', aliases: ['豆腐', 'Firm tofu'], category: '豆类/坚果', kcal: 76, protein: 8, carb: 1.9, fat: 4.2, potassium: 150, sodium: 10, calcium: 176, iron: 1.6, magnesium: 30, serving_grams: 150 },
  { name: '腐竹', aliases: ['豆腐皮', 'Dried yuba'], category: '豆类/坚果', kcal: 457, protein: 44, carb: 22, fat: 22, fiber: 1.0, potassium: 553, sodium: 110, calcium: 82, iron: 7.5, magnesium: 80, serving_grams: 20 },
  { name: '花生', aliases: ['炒花生', 'Peanut'], category: '豆类/坚果', kcal: 567, protein: 26, carb: 16, fat: 49, fiber: 8.5, potassium: 705, sodium: 18, calcium: 92, iron: 2.0, magnesium: 168, serving_grams: 20 },
  { name: '核桃', aliases: ['核桃仁', 'Walnut'], category: '豆类/坚果', kcal: 654, protein: 15, carb: 14, fat: 65, fiber: 6.7, potassium: 441, sodium: 2, calcium: 98, iron: 2.9, magnesium: 158, serving_grams: 15 },
  { name: '杏仁', aliases: ['巴旦木', 'Almond'], category: '豆类/坚果', kcal: 579, protein: 21, carb: 22, fat: 50, fiber: 12.5, potassium: 733, sodium: 1, calcium: 269, iron: 3.7, magnesium: 270, serving_grams: 15 },
];

// ── 油脂/调味 (9) ──
const condiments: FoodDef[] = [
  { name: '橄榄油', aliases: ['Olive oil'], category: '油脂/调味', kcal: 884, protein: 0, carb: 0, fat: 100, sat_fat: 14, potassium: 1, sodium: 2, calcium: 1, iron: 0.6, magnesium: 0, serving_grams: 10 },
  { name: '花生油', aliases: ['Peanut oil'], category: '油脂/调味', kcal: 884, protein: 0, carb: 0, fat: 100, sat_fat: 17, potassium: 0, sodium: 0, calcium: 0, iron: 0, magnesium: 0, serving_grams: 10 },
  { name: '芝麻油', aliases: ['香油', 'Sesame oil'], category: '油脂/调味', kcal: 884, protein: 0, carb: 0, fat: 100, sat_fat: 14, potassium: 1, sodium: 1, calcium: 0, iron: 0, magnesium: 0, serving_grams: 5 },
  { name: '酱油', aliases: ['生抽', '低钠酱油', 'Soy sauce'], category: '油脂/调味', kcal: 53, protein: 8.1, carb: 4.9, fat: 0.6, potassium: 210, sodium: 5637, calcium: 45, iron: 3.6, magnesium: 50, serving_grams: 10 },
  { name: '米醋', aliases: ['白醋', 'Rice vinegar'], category: '油脂/调味', kcal: 21, protein: 0.2, carb: 3.0, fat: 0.3, potassium: 35, sodium: 4, calcium: 9, iron: 0.3, magnesium: 5, serving_grams: 10 },
  { name: '蜂蜜', aliases: ['Honey'], category: '油脂/调味', kcal: 304, protein: 0.3, carb: 82, fat: 0, sugar: 82, potassium: 52, sodium: 4, calcium: 6, iron: 0.4, magnesium: 2, serving_grams: 10 },
  { name: '白糖', aliases: ['白砂糖', 'Sugar'], category: '油脂/调味', kcal: 387, protein: 0, carb: 100, fat: 0, potassium: 2, sodium: 1, calcium: 1, iron: 0.05, magnesium: 0, serving_grams: 10 },
  { name: '黄油', aliases: ['牛油', 'Butter'], category: '油脂/调味', kcal: 717, protein: 0.9, carb: 0.1, fat: 81, sat_fat: 51, potassium: 24, sodium: 11, calcium: 24, iron: 0.02, magnesium: 2, serving_grams: 10 },
  { name: '陈醋', aliases: ['香醋', 'Black vinegar'], category: '油脂/调味', kcal: 28, protein: 0.5, carb: 5.0, fat: 0.1, potassium: 50, sodium: 10, calcium: 15, iron: 0.5, magnesium: 8, serving_grams: 10 },
];

// ── 零食/饮品 (5) ──
const snacks: FoodDef[] = [
  { name: '黑巧克力', aliases: ['巧克力', 'Dark chocolate'], category: '零食/饮品', kcal: 546, protein: 5, carb: 60, fat: 31, fiber: 7, potassium: 715, sodium: 20, calcium: 73, iron: 12.0, magnesium: 228, serving_grams: 20 },
  { name: '薯片', aliases: ['Potato chips'], category: '零食/饮品', kcal: 536, protein: 7, carb: 53, fat: 33, fiber: 4.4, potassium: 1178, sodium: 525, calcium: 24, iron: 2.2, magnesium: 78, serving_grams: 30 },
  { name: '绿茶', aliases: ['绿茶水', 'Green tea'], category: '零食/饮品', kcal: 1, protein: 0, carb: 0, fat: 0, potassium: 9, sodium: 1, calcium: 0, iron: 0, magnesium: 1, serving_grams: 250 },
  { name: '豆浆', aliases: ['无糖豆浆', 'Soy milk'], category: '零食/饮品', kcal: 33, protein: 2.9, carb: 1.2, fat: 1.8, potassium: 86, sodium: 6, calcium: 27, iron: 0.5, magnesium: 15, serving_grams: 250 },
  { name: '椰子水', aliases: ['Coconut water'], category: '零食/饮品', kcal: 19, protein: 0.7, carb: 3.7, fat: 0.2, potassium: 250, sodium: 105, calcium: 24, iron: 0.3, magnesium: 25, serving_grams: 250 },
];

// ── All foods ──
const ALL_FOODS: FoodDef[] = [
  ...staples,
  ...vegetables,
  ...fruits,
  ...meats,
  ...seafood,
  ...eggsDairy,
  ...legumes,
  ...condiments,
  ...snacks,
];

// ── Import ──

const main = async () => {
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    requestInit: TOKEN ? { headers: { authorization: `Bearer ${TOKEN}` } } : undefined,
  });
  const client = new Client({ name: 'food-seeder', version: '0.0.0' });
  await client.connect(transport);

  const call = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const res = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean;
      content?: { text?: string }[];
    };
    const text = res.content?.[0]?.text;
    const data = text ? JSON.parse(text) : null;
    if (res.isError) throw new Error(`${name} → ${text}`);
    return data;
  };

  let created = 0;
  let skipped = 0;

  for (const f of ALL_FOODS) {
    // Check if food already exists by name
    const hits = (await call('search_food', {
      query: f.name,
      source: 'manual',
      limit: 20,
    })) as { id: string; name: string }[] | null;

    const existing = hits?.find(
      (h) => h.name === f.name,
    );
    if (existing) {
      skipped++;
      console.log(`  skip (exists): ${f.name}`);
      continue;
    }

    const nutrients: Record<string, number> = {
      kcal_per_100g: f.kcal,
      protein_g_per_100g: f.protein,
      carb_g_per_100g: f.carb,
      fat_g_per_100g: f.fat,
    };
    if (f.fiber != null) nutrients.fiber_g_per_100g = f.fiber;
    if (f.sugar != null) nutrients.sugar_g_per_100g = f.sugar;
    if (f.sat_fat != null) nutrients.sat_fat_g_per_100g = f.sat_fat;
    if (f.sodium != null) nutrients.sodium_mg_per_100g = f.sodium;
    if (f.potassium != null) nutrients.potassium_mg_per_100g = f.potassium;
    if (f.calcium != null) nutrients.calcium_mg_per_100g = f.calcium;
    if (f.magnesium != null) nutrients.magnesium_mg_per_100g = f.magnesium;
    if (f.iron != null) nutrients.iron_mg_per_100g = f.iron;

    const args: Record<string, unknown> = {
      name: f.name,
      nutrients_per_100g: nutrients,
      aliases: f.aliases,
      category: f.category,
    };
    if (f.serving_grams) args.serving_grams = f.serving_grams;

    await call('create_custom_food', args);
    created++;
    console.log(`  created: [${f.category}] ${f.name}`);
  }

  await client.close();
  console.log(`\nDone: ${created} created, ${skipped} skipped (${ALL_FOODS.length} total)`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
