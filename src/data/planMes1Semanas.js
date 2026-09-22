/**
 * Menús semanales Mes 1 tonificación (texto del plan TMV).
 * Semanas 3–4 reutilizan estas plantillas con otros tips (ver planMes1.js).
 */

const slot = (o1, o2) => [o1, o2]

export const PLAN_MES1_WEEK_A = [
  {
    desayuno: slot(
      'Tortilla con huevos + espinaca o tomate + queso descremado + ½ fruta',
      'Tostadas con palta + queso firme descremado + tomate + chorrito de oliva',
    ),
    media_manana: slot(
      'Yogur natural con frutos rojos y nueces',
      '1 fruta + puñado de frutos secos',
    ),
    almuerzo: slot(
      'Pechuga de pollo a la plancha + ensalada lechuga, pepino y tomate + ¼ plato arroz integral + 1 cdta aceite de oliva',
      'Huevos + quinua ¼ plato + vegetales salteados + 1 cdta aceite de oliva',
    ),
    merienda: slot(
      'Yogur descremado + frutos secos + ½ fruta',
      'Tostadas integrales + queso untable descremado + ½ fruta',
    ),
    cena: slot(
      'Pollo al horno o plancha + hortalizas A y B + aceite de oliva',
      'Pescado (merluza o lomitos de atún) + hortalizas A y B + aceite de oliva',
    ),
  },
  {
    desayuno: slot(
      'Tostadas integrales + palta + tomate + huevos revueltos',
      'Yogur descremado + avena instantánea o cereales sin azúcar + frutos rojos + trozo queso firme',
    ),
    media_manana: slot('Fruta + puñado chico cereales sin azúcar', 'Puñado frutos secos + fruta'),
    almuerzo: slot(
      'Carne al horno + hortalizas A y B + ¼ plato legumbres + ½ plato hortalizas A y B',
      '2–3 tacos integrales de pollo con palta y hortalizas A y B (cebolla, morrón, zanahoria cocidas 15 min) + 1 cdta oliva',
    ),
    merienda: slot(
      'Tostada integral + queso firme + mermelada light + almendras + ½ fruta',
      'Batido proteína vegetal + ½ fruta + nueces',
    ),
    cena: slot('Carne magra + hortalizas A y B', 'Pescado al horno + hortalizas A y B'),
  },
  {
    desayuno: slot(
      'Tostada integral + palta + queso descremado + jamón natural + tomate',
      'Tostadas de arroz + queso firme + mermelada light + ½ fruta',
    ),
    media_manana: slot('Fruta', 'Yogur descremado'),
    almuerzo: slot(
      'Carne al horno + lechuga y tomate + ¼ plato quinua + limón y oliva',
      'Huevo + ¼ plato arroz integral + ½ plato hortalizas A y B + 10 almendras o 5 nueces',
    ),
    merienda: slot(
      'Yogur griego o natural + puñado cereales + ½ fruta',
      '1 fruta + frutos secos + trozo queso descremado',
    ),
    cena: slot(
      'Pescado + espárragos u hortalizas A y B + ½ plato batata o papa al horno',
      'Pechuga de pollo + ¼ plato arroz integral + ½ plato hortalizas A y B',
    ),
  },
  {
    desayuno: slot('Yogur + 1 fruta + almendras', 'Huevos revueltos + ½ fruta + nueces'),
    media_manana: slot('1 fruta + puñado nueces', 'Fruta + puñado cereal + 5 nueces o almendras'),
    almuerzo: slot('Pechuga pollo al horno + hortalizas A y B', 'Carne al horno + hortalizas A y B'),
    merienda: slot('Omelette queso, jamón y tomate', 'Tostada integral + mantequilla de maní + queso firme en trozos'),
    cena: slot(
      'Pescado al horno + ¼ plato arroz integral + hortalizas A y B con oliva',
      'Pechuga pollo al horno + ¼ plato arroz integral + hortalizas A y B con oliva',
    ),
  },
  {
    desayuno: slot(
      'Tostadas integrales + palta + huevos revueltos',
      'Panqueques avena (avena, huevo, vainilla, coco, ½ banana)',
    ),
    media_manana: slot('Barrita cereal sin azúcar + frutos secos', 'Yogur descremado + frutos secos'),
    almuerzo: slot(
      'Omelette queso descremado + hortalizas A y B + aceite oliva',
      'Wok hortalizas A y B + queso descremado + frutos secos + huevos',
    ),
    merienda: slot(
      'Tortilla avena (huevos, ½ taza avena, vainilla) + fruta + nueces',
      'Tostadas queso firme, palta y huevo',
    ),
    cena: slot(
      'Lomo salteado cebolla y tomate + ½ plato hortalizas A y B + oliva',
      'Wok hortalizas A y B + ¼ legumbres o cereales + huevo duro + oliva',
    ),
  },
  {
    desayuno: slot(
      'Fruta + huevos revueltos + almendras',
      'Avena + yogur descremado + ½ fruta + nueces o almendras',
    ),
    media_manana: slot('1 fruta', 'Puñado cereales sin azúcar + almendras'),
    almuerzo: slot(
      'Pescado + ¼ quinua o arroz integral + ½ plato hortalizas A y B',
      '2 tacos cerdo magro + verduras salteadas (cebolla, morrón, zanahoria 15 min)',
    ),
    merienda: slot('1 fruta + nueces + queso descremado', 'Huevo a la plancha + 1 fruta'),
    cena: slot(
      'Milanesa carne al horno + ensalada espinaca, tomate y champiñones',
      'Pollo al horno + ¼ arroz integral + ½ hortalizas A y B',
    ),
  },
  {
    desayuno: slot(
      'Tostadas integrales + queso descremado + tomate + palta',
      'Avena con yogur + frutos rojos + nueces o almendras',
    ),
    media_manana: slot('Barrita cereal sin azúcar o proteica', 'Yogur firme descremado + frutos secos'),
    almuerzo: slot(
      'Omelette queso descremado + ¼ hortalizas C + ½ hortalizas A y B',
      'Pechuga pollo + ¼ arroz integral + ½ hortalizas A y B',
    ),
    merienda: slot(
      'Panqueques avena (avena, huevo, vainilla, coco, ½ plátano)',
      'Batido proteína + fruta + nueces',
    ),
    cena: slot(
      'Pescado al horno + ensalada espinaca, tomate y champiñones',
      'Carne magra + ½ plato hortalizas A y B',
    ),
  },
]

export const PLAN_MES1_WEEK_B = [
  {
    desayuno: slot(
      'Tostadas integrales palta + tomate + huevos revueltos',
      'Tostadas palta + tomate + queso descremado firme',
    ),
    media_manana: slot('1 fruta', '½ fruta + 5 medias nueces'),
    almuerzo: slot(
      'Pollo + ¼ arroz integral + ensalada hortalizas A y B con oliva',
      'Wok hortalizas A y B + carne o pollo al horno + ½ hortalizas C',
    ),
    merienda: slot(
      'Tortilla avena + fruta + nueces',
      'Trozos queso descremado + 1 fruta + almendras',
    ),
    cena: slot(
      'Lomo salteado cebolla y tomate + ½ hortalizas A y B',
      'Pollo salteado + hortalizas A y B plancha u horno',
    ),
  },
  {
    desayuno: slot(
      'Yogur descremado + cereales sin azúcar + ½ fruta',
      'Revuelto huevo + sándwich integral queso firme y jamón natural',
    ),
    media_manana: slot('1 fruta', 'Fruta pequeña + puñado cereal'),
    almuerzo: slot('Pechuga pollo + ½ hortalizas A y B con oliva', 'Pescado natural + ½ hortalizas A y B con oliva'),
    merienda: slot(
      'Omelette queso + jamón + tomate + ½ fruta',
      'Tostada integral + mantequilla maní + banana + huevo revuelto aparte',
    ),
    cena: slot(
      'Pescado al horno + ¼ arroz integral + hortalizas A y B',
      'Carne al horno + ¼ legumbres + hortalizas A y B',
    ),
  },
  {
    desayuno: slot(
      'Panqueques avena (avena, huevo, vainilla, coco, ½ banana)',
      'Tostadas arroz + queso firme + mermelada light + ½ fruta',
    ),
    media_manana: slot('1 fruta', 'Yogur descremado'),
    almuerzo: slot(
      'Ensalada pollo o huevo duro + lechuga, tomate, zanahoria',
      'Milanesa pollo o carne + ensalada hortalizas A y B',
    ),
    merienda: slot(
      'Yogur griego o descremado + cereales + ½ fruta',
      'Tostadas integrales + queso descremado + mermelada light',
    ),
    cena: slot('Pescado al horno + ½ hortalizas A y B', 'Pechuga pollo + ½ hortalizas A y B'),
  },
  {
    desayuno: slot(
      'Tostadas integrales palta, tomate y huevos revueltos',
      'Yogur + avena o cereales + frutos rojos o ½ fruta + nueces/almendras',
    ),
    media_manana: slot('Fruta + puñado cereales sin azúcar', 'Frutos secos + fruta'),
    almuerzo: slot(
      'Omelette queso + jamón + ¼ arroz + hortalizas A y B con oliva',
      'Pollo o carne + hortalizas A y B + ½ papas con oliva',
    ),
    merienda: slot(
      'Tostada integral + queso firme + almendras + ½ fruta',
      'Batido proteína + ½ fruta',
    ),
    cena: slot('Carne magra + hortalizas A y B', 'Pescado al horno + hortalizas A y B'),
  },
  {
    desayuno: slot(
      'Omelette huevos + queso descremado + jamón + ½ fruta',
      'Tostadas integrales + queso descremado + palta + ½ fruta',
    ),
    media_manana: slot('Yogur descremado sin endulzar', '1 fruta'),
    almuerzo: slot(
      'Pechuga pollo plancha con queso derretido + ensalada lechuga, cebolla y tomate',
      'Huevo + quinua ¼ + hortalizas A y B salteadas (morrón, zanahoria, cebolla)',
    ),
    merienda: slot(
      'Yogur + avena + frutos secos + ½ fruta',
      'Tostadas integrales + queso firme + palta + ½ fruta',
    ),
    cena: slot(
      'Pechuga pollo + hortalizas A y B asadas u horno/wok',
      'Pescado merluza/atún + hortalizas mixtas (brócoli, zanahoria, morrón, champiñones)',
    ),
  },
  {
    desayuno: slot('Fruta + huevos revueltos + almendras', 'Avena + yogur descremado + ½ fruta'),
    media_manana: slot('1 fruta', 'Cereales sin azúcar + nueces'),
    almuerzo: slot(
      'Pescado + ¼ quinua o arroz integral + ½ hortalizas A y B',
      'Omelette queso descremado + ¼ legumbres + ½ hortalizas A y B',
    ),
    merienda: slot('Fruta + frutos secos + queso descremado', 'Omelette queso y tomate'),
    cena: slot(
      'Milanesa carne al horno + ensalada espinaca, tomate y champiñones',
      'Pollo al horno + ¼ arroz integral + ½ hortalizas A y B',
    ),
  },
  {
    desayuno: slot(
      'Tostadas integrales + queso untable + tomate + palta',
      'Avena con leche de almendras + frutos rojos + nueces o almendras',
    ),
    media_manana: slot('Barrita cereal sin azúcar o proteica', 'Yogur firme descremado'),
    almuerzo: slot(
      'Ensalada arroz integral, lentejas, zanahoria, huevo duro, limón y oliva',
      'Pollo con verduras a elección y oliva',
    ),
    merienda: slot(
      'Panqueques avena (avena, huevo, vainilla, coco, ½ banana)',
      'Tostadas integrales + queso firme + huevo',
    ),
    cena: slot(
      'Milanesa pollo al horno + ensalada espinaca, tomate y champiñones',
      'Carne magra + ½ hortalizas A y B',
    ),
  },
]

export const PLAN_MES1_SLOTS = [
  { id: 'desayuno', label: 'Desayuno', momentoComida: 'Desayuno', horaRef: '07:30' },
  { id: 'media_manana', label: 'Media mañana', momentoComida: 'Snack', horaRef: '10:30' },
  { id: 'almuerzo', label: 'Almuerzo', momentoComida: 'Almuerzo', horaRef: '13:00' },
  { id: 'merienda', label: 'Merienda', momentoComida: 'Merienda', horaRef: '17:00' },
  { id: 'cena', label: 'Cena', momentoComida: 'Cena', horaRef: '21:00' },
]
