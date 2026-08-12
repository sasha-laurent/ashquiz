// Les 50 États américains : code postal à deux lettres, nom (en français quand
// l'usage l'a francisé) et capitale — celle de l'État, pas sa plus grande ville :
// Albany et non New York, Sacramento et non Los Angeles.
//
// `alias` : orthographes alternatives acceptées à la correction, à commencer par
// le nom anglais quand il diffère (en plus de la tolérance automatique aux
// accents, tirets et fautes de frappe légères).
//
// `region` ne s'affiche nulle part : elle sert à choisir les leurres du mode
// carré quand le code à deux lettres n'en fournit pas assez (voir
// src/lib/quiz-states.js).
//
// Le district de Columbia n'y figure pas : ce n'est pas un État.

export const STATES = [
  { code: 'AK', name: 'Alaska', capital: 'Juneau', region: 'Pacifique' },
  { code: 'AL', name: 'Alabama', capital: 'Montgomery', region: 'Sud' },
  { code: 'AR', name: 'Arkansas', capital: 'Little Rock', region: 'Sud' },
  { code: 'AZ', name: 'Arizona', capital: 'Phoenix', region: 'Montagnes' },
  { code: 'CA', name: 'Californie', capital: 'Sacramento', region: 'Pacifique', alias: { name: ['California'] } },
  { code: 'CO', name: 'Colorado', capital: 'Denver', region: 'Montagnes' },
  { code: 'CT', name: 'Connecticut', capital: 'Hartford', region: 'Nouvelle-Angleterre' },
  { code: 'DE', name: 'Delaware', capital: 'Dover', region: 'Atlantique' },
  { code: 'FL', name: 'Floride', capital: 'Tallahassee', region: 'Sud', alias: { name: ['Florida'] } },
  { code: 'GA', name: 'Géorgie', capital: 'Atlanta', region: 'Sud', alias: { name: ['Georgia'] } },
  { code: 'HI', name: 'Hawaï', capital: 'Honolulu', region: 'Pacifique', alias: { name: ['Hawaii'] } },
  { code: 'IA', name: 'Iowa', capital: 'Des Moines', region: 'Plaines' },
  { code: 'ID', name: 'Idaho', capital: 'Boise', region: 'Montagnes' },
  { code: 'IL', name: 'Illinois', capital: 'Springfield', region: 'Grands Lacs' },
  { code: 'IN', name: 'Indiana', capital: 'Indianapolis', region: 'Grands Lacs' },
  { code: 'KS', name: 'Kansas', capital: 'Topeka', region: 'Plaines' },
  { code: 'KY', name: 'Kentucky', capital: 'Frankfort', region: 'Sud' },
  { code: 'LA', name: 'Louisiane', capital: 'Baton Rouge', region: 'Sud', alias: { name: ['Louisiana'] } },
  { code: 'MA', name: 'Massachusetts', capital: 'Boston', region: 'Nouvelle-Angleterre' },
  { code: 'MD', name: 'Maryland', capital: 'Annapolis', region: 'Atlantique' },
  { code: 'ME', name: 'Maine', capital: 'Augusta', region: 'Nouvelle-Angleterre' },
  { code: 'MI', name: 'Michigan', capital: 'Lansing', region: 'Grands Lacs' },
  { code: 'MN', name: 'Minnesota', capital: 'Saint Paul', region: 'Grands Lacs' },
  { code: 'MO', name: 'Missouri', capital: 'Jefferson City', region: 'Plaines' },
  { code: 'MS', name: 'Mississippi', capital: 'Jackson', region: 'Sud' },
  { code: 'MT', name: 'Montana', capital: 'Helena', region: 'Montagnes' },
  { code: 'NC', name: 'Caroline du Nord', capital: 'Raleigh', region: 'Atlantique', alias: { name: ['North Carolina'] } },
  { code: 'ND', name: 'Dakota du Nord', capital: 'Bismarck', region: 'Plaines', alias: { name: ['North Dakota'] } },
  { code: 'NE', name: 'Nebraska', capital: 'Lincoln', region: 'Plaines' },
  { code: 'NH', name: 'New Hampshire', capital: 'Concord', region: 'Nouvelle-Angleterre' },
  { code: 'NJ', name: 'New Jersey', capital: 'Trenton', region: 'Atlantique' },
  { code: 'NM', name: 'Nouveau-Mexique', capital: 'Santa Fe', region: 'Montagnes', alias: { name: ['New Mexico'] } },
  { code: 'NV', name: 'Nevada', capital: 'Carson City', region: 'Montagnes' },
  { code: 'NY', name: 'New York', capital: 'Albany', region: 'Atlantique', alias: { name: ['État de New York'] } },
  { code: 'OH', name: 'Ohio', capital: 'Columbus', region: 'Grands Lacs' },
  { code: 'OK', name: 'Oklahoma', capital: 'Oklahoma City', region: 'Sud' },
  { code: 'OR', name: 'Oregon', capital: 'Salem', region: 'Pacifique' },
  { code: 'PA', name: 'Pennsylvanie', capital: 'Harrisburg', region: 'Atlantique', alias: { name: ['Pennsylvania'] } },
  { code: 'RI', name: 'Rhode Island', capital: 'Providence', region: 'Nouvelle-Angleterre' },
  { code: 'SC', name: 'Caroline du Sud', capital: 'Columbia', region: 'Atlantique', alias: { name: ['South Carolina'] } },
  { code: 'SD', name: 'Dakota du Sud', capital: 'Pierre', region: 'Plaines', alias: { name: ['South Dakota'] } },
  { code: 'TN', name: 'Tennessee', capital: 'Nashville', region: 'Sud' },
  { code: 'TX', name: 'Texas', capital: 'Austin', region: 'Sud' },
  { code: 'UT', name: 'Utah', capital: 'Salt Lake City', region: 'Montagnes' },
  { code: 'VA', name: 'Virginie', capital: 'Richmond', region: 'Atlantique', alias: { name: ['Virginia'] } },
  { code: 'VT', name: 'Vermont', capital: 'Montpelier', region: 'Nouvelle-Angleterre' },
  { code: 'WA', name: 'Washington', capital: 'Olympia', region: 'Pacifique', alias: { name: ['État de Washington'] } },
  { code: 'WI', name: 'Wisconsin', capital: 'Madison', region: 'Grands Lacs' },
  { code: 'WV', name: 'Virginie-Occidentale', capital: 'Charleston', region: 'Atlantique', alias: { name: ['West Virginia', "Virginie de l'Ouest"] } },
  { code: 'WY', name: 'Wyoming', capital: 'Cheyenne', region: 'Montagnes' },
];

export const BY_CODE = new Map(STATES.map((state) => [state.code, state]));

/** Toutes les réponses acceptées pour un champ donné ('name' | 'capital'). */
export function accepted(state, field) {
  return [state[field], ...((state.alias && state.alias[field]) || [])];
}
