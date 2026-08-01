// Curated library of common PLA filament colors used for nearest-color matching.
// Hex values are approximate real-world spool colors (Bambu Lab Basic + generic PLA).
// `brand` is informational; matching only uses `hex`.
export const FILAMENT_LIBRARY = [
  // Whites / neutrals
  { name: 'Jade White',      hex: '#FFFFFF', brand: 'Bambu' },
  { name: 'Bone White',      hex: '#F0EEE4', brand: 'Generic' },
  { name: 'Beige',           hex: '#F7E6DE', brand: 'Generic' },
  { name: 'Silver',          hex: '#A6A9AA', brand: 'Bambu' },
  { name: 'Light Gray',      hex: '#D1D3D5', brand: 'Generic' },
  { name: 'Gray',            hex: '#8E9089', brand: 'Bambu' },
  { name: 'Dark Gray',       hex: '#545454', brand: 'Generic' },
  { name: 'Black',           hex: '#161616', brand: 'Bambu' },

  // Yellows / oranges
  { name: 'Yellow',          hex: '#F4EE2A', brand: 'Bambu' },
  { name: 'Gold',            hex: '#E4BD68', brand: 'Bambu' },
  { name: 'Sunflower',       hex: '#FDB833', brand: 'Generic' },
  { name: 'Orange',          hex: '#FF6A13', brand: 'Bambu' },
  { name: 'Pumpkin Orange',  hex: '#FF9016', brand: 'Generic' },

  // Reds / pinks
  { name: 'Red',             hex: '#C12E1F', brand: 'Bambu' },
  { name: 'Scarlet Red',     hex: '#DE4343', brand: 'Generic' },
  { name: 'Maroon',          hex: '#7C1C24', brand: 'Generic' },
  { name: 'Magenta',         hex: '#EC008C', brand: 'Bambu' },
  { name: 'Pink',            hex: '#F55A74', brand: 'Bambu' },
  { name: 'Hot Pink',        hex: '#F5547C', brand: 'Generic' },

  // Purples
  { name: 'Purple',          hex: '#8040BF', brand: 'Bambu' },
  { name: 'Indigo',          hex: '#4B3F8F', brand: 'Generic' },
  { name: 'Lavender',        hex: '#B9A6E0', brand: 'Generic' },

  // Blues / cyans
  { name: 'Blue',            hex: '#0A2989', brand: 'Bambu' },
  { name: 'Cobalt Blue',     hex: '#0056B8', brand: 'Generic' },
  { name: 'Cyan',            hex: '#0086D6', brand: 'Bambu' },
  { name: 'Sky Blue',        hex: '#56B4E9', brand: 'Generic' },
  { name: 'Turquoise',       hex: '#00B1B7', brand: 'Generic' },
  { name: 'Blue Gray',       hex: '#5B6579', brand: 'Bambu' },

  // Greens
  { name: 'Green',           hex: '#00AE42', brand: 'Bambu' },
  { name: 'Bambu Green',     hex: '#3F8E43', brand: 'Bambu' },
  { name: 'Grass Green',     hex: '#61C680', brand: 'Generic' },
  { name: 'Lime',            hex: '#BECF00', brand: 'Generic' },
  { name: 'Forest Green',    hex: '#1D5C34', brand: 'Generic' },

  // Browns / earth
  { name: 'Brown',           hex: '#9D432C', brand: 'Bambu' },
  { name: 'Cocoa Brown',     hex: '#6B4423', brand: 'Generic' },
  { name: 'Dark Brown',      hex: '#4D3324', brand: 'Generic' },
  { name: 'Tan',             hex: '#C8A165', brand: 'Generic' },
];
