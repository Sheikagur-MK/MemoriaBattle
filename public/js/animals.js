// ── ANIMALES ─────────────────────────────────────────────────────────────────
const ANIMALS_DATA = {
  leon:     { name: 'León',     emoji: '🦁', color: '#F4A460', desc: 'El rey de la sabana. Poderoso y majestuoso.' },
  gorila:   { name: 'Gorila',   emoji: '🦍', color: '#708090', desc: 'Fuerza bruta y gran inteligencia.' },
  oso:      { name: 'Oso',      emoji: '🐻', color: '#8B4513', desc: 'Gran resistencia en clima extremo.' },
  pinguino: { name: 'Pingüino', emoji: '🐧', color: '#2F4F4F', desc: 'Pequeño pero ágil en el agua.' },
  tiburon:  { name: 'Tiburón',  emoji: '🦈', color: '#5F9EA0', desc: 'El depredador perfecto del océano.' },
  orca:     { name: 'Orca',     emoji: '🐋', color: '#191970', desc: 'Inteligente y veloz cazador marino.' },
  elefante: { name: 'Elefante', emoji: '🐘', color: '#808080', desc: 'Memoria prodigiosa e imparable.' },
  girafa:   { name: 'Jirafa',   emoji: '🦒', color: '#DAA520', desc: 'La más alta de la sabana.' },
  perro:    { name: 'Perro',    emoji: '🐶', color: '#D2691E', desc: 'El mejor amigo, siempre leal.' },
  gato:     { name: 'Gato',     emoji: '🐱', color: '#BC8F8F', desc: 'Ágil e impredecible.' },
  hamster:  { name: 'Hámster',  emoji: '🐹', color: '#FFD39B', desc: 'Pequeño e increíblemente rápido.' },
  lobo:     { name: 'Lobo',     emoji: '🐺', color: '#778899', desc: 'Líder del manada, estratega nato.' }
};

// Skins disponibles (100 palmeras c/u)
const SKINS_DATA = [
  { id: 'default',   name: 'Default',      emoji: '⚪', price: 0,   desc: 'El look original' },
  { id: 'golden',    name: 'Dorado',       emoji: '🌟', price: 100, desc: 'Brilla como el oro' },
  { id: 'neon',      name: 'Neón',         emoji: '💜', price: 100, desc: 'Resplandece en la oscuridad' },
  { id: 'pixel',     name: 'Píxel',        emoji: '👾', price: 100, desc: 'Estilo retro 8-bit' },
  { id: 'fire',      name: 'Fuego',        emoji: '🔥', price: 100, desc: 'ábrasador' },
  { id: 'ice',       name: 'Hielo',        emoji: '❄️', price: 100, desc: 'Frío como el ártico' },
  { id: 'rainbow',   name: 'Arcoíris',     emoji: '🌈', price: 100, desc: 'Todos los colores' },
  { id: 'shadow',    name: 'Sombra',       emoji: '🌑', price: 100, desc: 'Misterioso y oscuro' },
  { id: 'cyber',     name: 'Cyber',        emoji: '🤖', price: 100, desc: 'Del futuro' },
  { id: 'tropical',  name: 'Tropical',     emoji: '🌺', price: 100, desc: 'Colores de la selva' },
  { id: 'galaxy',    name: 'Galaxia',      emoji: '🌌', price: 100, desc: 'Del universo' },
  { id: 'candy',     name: 'Dulce',        emoji: '🍭', price: 100, desc: 'Colorido y dulce' },
];

// Modifica el color del emoji según la skin
function getAnimalDisplay(animalKey, skin = 'default') {
  const a = ANIMALS_DATA[animalKey];
  if (!a) return { emoji: '🐾', name: 'Desconocido', color: '#888' };
  const skinData = SKINS_DATA.find(s => s.id === skin) || SKINS_DATA[0];
  return { ...a, skinEmoji: skinData.emoji, skinName: skinData.name };
}
