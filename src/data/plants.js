// Plantes, fleurs et arbres : nom français, nom scientifique et famille
// botanique.
//
// Chaque entrée porte :
//
// - `code` — identifiant stable, et **nom du fichier image** (`data/plantes/<code>.jpg`).
//   Il est volontairement neutre : le drapeau d'un pays peut s'appeler `fr.png`
//   parce que le code ISO ne se lit pas dans l'onglet réseau comme une réponse,
//   mais `chene-pedoncule.jpg` livrerait la solution avant la question. Les
//   codes sont donc numérotés dans l'ordre d'ajout — jamais renumérotés, ils
//   servent de clé aux statistiques déjà enregistrées.
// - `name` — le **nom français** attendu, et `alias.name` les autres noms
//   d'usage acceptés (« Coudrier » pour le noisetier, « Dent-de-lion » pour le
//   pissenlit).
// - `latin` — le nom scientifique. Il ne s'affiche qu'à la correction, mais
//   c'est lui qui sert de clé à `npm run build:plants` : l'outil retrouve
//   l'espèce sur Wikidata par son nom de taxon, pas par un identifiant `Q…` à
//   recopier à la main.
// - `family` — la **famille** attendue, en français, et `familyLatin` sa forme
//   scientifique, toujours acceptée elle aussi : « Rosacées » ou « Rosaceae ».
//   `alias.family` ajoute les familles d'avant la classification APG, encore
//   dans tous les manuels : « Acéracées » pour l'érable, « Composées » pour les
//   astéracées, « Labiées » pour les lamiacées.
// - `commons` — facultatif : le fichier image à utiliser, quand celui que trouve
//   l'outil ne convient pas. Il ne choisit que deux fois sur cent de travers,
//   mais de la pire façon — une planche d'herbier ou une gravure du XIXe porte
//   le nom latin **imprimé dessus**, donc la réponse.
//
// Les familles retenues sont celles d'**APG IV**, celle de Wikidata : le tilleul
// est chez les malvacées et non les tiliacées, le muguet chez les asparagacées
// et non les liliacées. Les anciennes familles restent acceptées à la correction
// — les reconnaître fausses serait défendable en botanique, décourageant dans un
// quiz. `npm run build:plants` compare chaque `familyLatin` à la famille que
// Wikidata donne à l'espèce et signale les écarts : la liste ne dérive donc pas
// en silence.
//
// Le corpus mêle arbres, fleurs et plantes communes, et **plusieurs espèces par
// famille** : c'est ce qui rend la seconde sous-réponse apprenable. Une même
// série n'en pose jamais deux de la même famille (voir `src/lib/quiz-plants.js`).

export const PLANTS = [
  { code: 'p001', name: 'Ail des ours', latin: 'Allium ursinum', family: 'Amaryllidacées', familyLatin: 'Amaryllidaceae', alias: { family: ['Alliacées', 'Liliacées'] } },
  { code: 'p002', name: 'Ajonc d’Europe', latin: 'Ulex europaeus', family: 'Fabacées', familyLatin: 'Fabaceae', alias: { name: ['Ajonc'], family: ['Légumineuses', 'Papilionacées'] } },
  { code: 'p003', name: 'Anémone des bois', latin: 'Anemone nemorosa', family: 'Renonculacées', familyLatin: 'Ranunculaceae', alias: { name: ['Anémone sylvie', 'Sylvie', 'Anémone'] } },
  { code: 'p004', name: 'Aubépine', latin: 'Crataegus monogyna', family: 'Rosacées', familyLatin: 'Rosaceae', alias: { name: ['Aubépine monogyne', 'Épine blanche'] } },
  { code: 'p005', name: 'Aulne glutineux', latin: 'Alnus glutinosa', family: 'Bétulacées', familyLatin: 'Betulaceae', alias: { name: ['Aulne', 'Aune'] } },
  { code: 'p006', name: 'Basilic', latin: 'Ocimum basilicum', family: 'Lamiacées', familyLatin: 'Lamiaceae', alias: { name: ['Basilic commun'], family: ['Labiées'] } },
  { code: 'p007', name: 'Belladone', latin: 'Atropa bella-donna', family: 'Solanacées', familyLatin: 'Solanaceae', alias: { name: ['Belladone officinale'] } },
  { code: 'p008', name: 'Blé tendre', latin: 'Triticum aestivum', family: 'Poacées', familyLatin: 'Poaceae', alias: { name: ['Blé', 'Froment'], family: ['Graminées'] } },
  { code: 'p009', name: 'Bleuet', latin: 'Centaurea cyanus', family: 'Astéracées', familyLatin: 'Asteraceae', alias: { name: ['Bleuet des champs', 'Barbeau'], family: ['Composées'] } },
  { code: 'p010', name: 'Bouleau verruqueux', latin: 'Betula pendula', family: 'Bétulacées', familyLatin: 'Betulaceae', alias: { name: ['Bouleau', 'Bouleau blanc'] } },
  { code: 'p011', name: 'Bouton d’or', latin: 'Ranunculus acris', family: 'Renonculacées', familyLatin: 'Ranunculaceae', alias: { name: ['Renoncule âcre', 'Renoncule'] } },
  { code: 'p012', name: 'Buis', latin: 'Buxus sempervirens', family: 'Buxacées', familyLatin: 'Buxaceae', alias: { name: ['Buis commun', 'Buis toujours vert'] } },
  { code: 'p013', name: 'Callune', latin: 'Calluna vulgaris', family: 'Éricacées', familyLatin: 'Ericaceae', alias: { name: ['Bruyère commune', 'Fausse bruyère', 'Bruyère'] } },
  { code: 'p014', name: 'Capselle bourse-à-pasteur', latin: 'Capsella bursa-pastoris', family: 'Brassicacées', familyLatin: 'Brassicaceae', alias: { name: ['Bourse-à-pasteur', 'Capselle'], family: ['Crucifères'] } },
  { code: 'p015', name: 'Carotte sauvage', latin: 'Daucus carota', family: 'Apiacées', familyLatin: 'Apiaceae', alias: { name: ['Carotte'], family: ['Ombellifères'] } },
  { code: 'p016', name: 'Cèdre du Liban', latin: 'Cedrus libani', family: 'Pinacées', familyLatin: 'Pinaceae', alias: { name: ['Cèdre'], family: ['Abiétacées'] } },
  { code: 'p017', name: 'Charme', latin: 'Carpinus betulus', family: 'Bétulacées', familyLatin: 'Betulaceae', alias: { name: ['Charme commun', 'Charmille'] } },
  { code: 'p018', name: 'Châtaignier', latin: 'Castanea sativa', family: 'Fagacées', familyLatin: 'Fagaceae', alias: { name: ['Châtaignier commun'] } },
  { code: 'p019', name: 'Chêne pédonculé', latin: 'Quercus robur', family: 'Fagacées', familyLatin: 'Fagaceae', alias: { name: ['Chêne'] } },
  { code: 'p020', name: 'Chèvrefeuille des bois', latin: 'Lonicera periclymenum', family: 'Caprifoliacées', familyLatin: 'Caprifoliaceae', alias: { name: ['Chèvrefeuille'] } },
  { code: 'p021', name: 'Chou', latin: 'Brassica oleracea', family: 'Brassicacées', familyLatin: 'Brassicaceae', alias: { name: ['Chou commun', 'Chou cultivé'], family: ['Crucifères'] } },
  { code: 'p022', name: 'Cirse commun', latin: 'Cirsium vulgare', family: 'Astéracées', familyLatin: 'Asteraceae', alias: { name: ['Chardon', 'Chardon lancéolé', 'Cirse vulgaire'], family: ['Composées'] } },
  { code: 'p023', name: 'Consoude officinale', latin: 'Symphytum officinale', family: 'Boraginacées', familyLatin: 'Boraginaceae', alias: { name: ['Grande consoude', 'Consoude'] } },
  { code: 'p024', name: 'Coquelicot', latin: 'Papaver rhoeas', family: 'Papavéracées', familyLatin: 'Papaveraceae', alias: { name: ['Pavot coquelicot'] } },
  { code: 'p025', name: 'Cyprès de Provence', latin: 'Cupressus sempervirens', family: 'Cupressacées', familyLatin: 'Cupressaceae', alias: { name: ['Cyprès', 'Cyprès toujours vert'] } },
  { code: 'p026', name: 'Digitale pourpre', latin: 'Digitalis purpurea', family: 'Plantaginacées', familyLatin: 'Plantaginaceae', alias: { name: ['Digitale', 'Gantelée'], family: ['Scrofulariacées'] } },
  { code: 'p027', name: 'Églantier', latin: 'Rosa canina', family: 'Rosacées', familyLatin: 'Rosaceae', alias: { name: ['Rosier des chiens', 'Rosier sauvage', 'Églantine'] } },
  { code: 'p028', name: 'Épicéa commun', latin: 'Picea abies', family: 'Pinacées', familyLatin: 'Pinaceae', alias: { name: ['Épicéa', 'Sapin rouge'], family: ['Abiétacées'] } },
  { code: 'p029', name: 'Érable sycomore', latin: 'Acer pseudoplatanus', family: 'Sapindacées', familyLatin: 'Sapindaceae', alias: { name: ['Érable', 'Sycomore'], family: ['Acéracées'] } },
  { code: 'p030', name: 'Eucalyptus globuleux', latin: 'Eucalyptus globulus', family: 'Myrtacées', familyLatin: 'Myrtaceae', alias: { name: ['Eucalyptus', 'Gommier bleu'] } },
  { code: 'p031', name: 'Figuier', latin: 'Ficus carica', family: 'Moracées', familyLatin: 'Moraceae', alias: { name: ['Figuier commun'] } },
  { code: 'p032', name: 'Figuier de Barbarie', latin: 'Opuntia ficus-indica', family: 'Cactacées', familyLatin: 'Cactaceae', alias: { name: ['Opuntia', 'Nopal'] } },
  { code: 'p033', name: 'Fougère aigle', latin: 'Pteridium aquilinum', family: 'Dennstaedtiacées', familyLatin: 'Dennstaedtiaceae', alias: { name: ['Grande fougère', 'Fougère impériale'] } },
  { code: 'p034', name: 'Frêne commun', latin: 'Fraxinus excelsior', family: 'Oléacées', familyLatin: 'Oleaceae', alias: { name: ['Frêne', 'Frêne élevé'] } },
  { code: 'p035', name: 'Gaillet gratteron', latin: 'Galium aparine', family: 'Rubiacées', familyLatin: 'Rubiaceae', alias: { name: ['Gratteron', 'Gaillet'] } },
  { code: 'p036', name: 'Genêt à balais', latin: 'Cytisus scoparius', family: 'Fabacées', familyLatin: 'Fabaceae', alias: { name: ['Genêt'], family: ['Légumineuses', 'Papilionacées'] } },
  { code: 'p037', name: 'Genévrier commun', latin: 'Juniperus communis', family: 'Cupressacées', familyLatin: 'Cupressaceae', alias: { name: ['Genévrier', 'Genièvre'] } },
  { code: 'p038', name: 'Gentiane jaune', latin: 'Gentiana lutea', family: 'Gentianacées', familyLatin: 'Gentianaceae', alias: { name: ['Grande gentiane', 'Gentiane'] } },
  { code: 'p039', name: 'Ginkgo', latin: 'Ginkgo biloba', family: 'Ginkgoacées', familyLatin: 'Ginkgoaceae', alias: { name: ['Ginkgo biloba', 'Arbre aux quarante écus'] } },
  { code: 'p040', name: 'Glycine de Chine', latin: 'Wisteria sinensis', family: 'Fabacées', familyLatin: 'Fabaceae', alias: { name: ['Glycine'], family: ['Légumineuses', 'Papilionacées'] } },
  { code: 'p041', name: 'Grande ciguë', latin: 'Conium maculatum', family: 'Apiacées', familyLatin: 'Apiaceae', alias: { name: ['Ciguë', 'Ciguë tachetée'], family: ['Ombellifères'] } },
  { code: 'p042', name: 'Gui', latin: 'Viscum album', family: 'Santalacées', familyLatin: 'Santalaceae', alias: { name: ['Gui blanc'], family: ['Loranthacées', 'Viscacées'] } },
  { code: 'p043', name: 'Herbe à Robert', latin: 'Geranium robertianum', family: 'Géraniacées', familyLatin: 'Geraniaceae', alias: { name: ['Géranium herbe à Robert', 'Géranium Robert'] } },
  { code: 'p044', name: 'Hêtre commun', latin: 'Fagus sylvatica', family: 'Fagacées', familyLatin: 'Fagaceae', alias: { name: ['Hêtre', 'Fayard'] } },
  { code: 'p045', name: 'Houx', latin: 'Ilex aquifolium', family: 'Aquifoliacées', familyLatin: 'Aquifoliaceae', commons: 'Ilex aquifolium L. JdP.jpg', alias: { name: ['Houx commun'] } },
  { code: 'p046', name: 'If commun', latin: 'Taxus baccata', family: 'Taxacées', familyLatin: 'Taxaceae', alias: { name: ['If'] } },
  { code: 'p047', name: 'Iris des marais', latin: 'Iris pseudacorus', family: 'Iridacées', familyLatin: 'Iridaceae', alias: { name: ['Iris jaune', 'Iris'] } },
  { code: 'p048', name: 'Jonquille', latin: 'Narcissus pseudonarcissus', family: 'Amaryllidacées', familyLatin: 'Amaryllidaceae', alias: { name: ['Narcisse jaune', 'Narcisse trompette', 'Narcisse'] } },
  { code: 'p049', name: 'Lavande vraie', latin: 'Lavandula angustifolia', family: 'Lamiacées', familyLatin: 'Lamiaceae', alias: { name: ['Lavande', 'Lavande officinale'], family: ['Labiées'] } },
  { code: 'p050', name: 'Lierre grimpant', latin: 'Hedera helix', family: 'Araliacées', familyLatin: 'Araliaceae', alias: { name: ['Lierre'] } },
  { code: 'p051', name: 'Lilas', latin: 'Syringa vulgaris', family: 'Oléacées', familyLatin: 'Oleaceae', alias: { name: ['Lilas commun'] } },
  { code: 'p052', name: 'Lis blanc', latin: 'Lilium candidum', family: 'Liliacées', familyLatin: 'Liliaceae', alias: { name: ['Lys blanc', 'Lis de la Madone', 'Lys', 'Lis'] } },
  { code: 'p053', name: 'Liseron des champs', latin: 'Convolvulus arvensis', family: 'Convolvulacées', familyLatin: 'Convolvulaceae', alias: { name: ['Liseron'] } },
  { code: 'p054', name: 'Maïs', latin: 'Zea mays', family: 'Poacées', familyLatin: 'Poaceae', alias: { family: ['Graminées'] } },
  { code: 'p055', name: 'Marguerite', latin: 'Leucanthemum vulgare', family: 'Astéracées', familyLatin: 'Asteraceae', alias: { name: ['Grande marguerite', 'Marguerite commune'], family: ['Composées'] } },
  { code: 'p056', name: 'Marronnier d’Inde', latin: 'Aesculus hippocastanum', family: 'Sapindacées', familyLatin: 'Sapindaceae', alias: { name: ['Marronnier'], family: ['Hippocastanacées'] } },
  { code: 'p057', name: 'Mauve sylvestre', latin: 'Malva sylvestris', family: 'Malvacées', familyLatin: 'Malvaceae', alias: { name: ['Grande mauve', 'Mauve'] } },
  { code: 'p058', name: 'Mélèze d’Europe', latin: 'Larix decidua', family: 'Pinacées', familyLatin: 'Pinaceae', alias: { name: ['Mélèze'], family: ['Abiétacées'] } },
  { code: 'p059', name: 'Merisier', latin: 'Prunus avium', family: 'Rosacées', familyLatin: 'Rosaceae', alias: { name: ['Cerisier des oiseaux', 'Cerisier sauvage', 'Cerisier'] } },
  { code: 'p060', name: 'Millepertuis perforé', latin: 'Hypericum perforatum', family: 'Hypéricacées', familyLatin: 'Hypericaceae', alias: { name: ['Millepertuis', 'Herbe de la Saint-Jean'], family: ['Clusiacées', 'Guttifères'] } },
  { code: 'p061', name: 'Muflier', latin: 'Antirrhinum majus', family: 'Plantaginacées', familyLatin: 'Plantaginaceae', alias: { name: ['Gueule-de-loup', 'Muflier des jardins'], family: ['Scrofulariacées'] } },
  { code: 'p062', name: 'Muguet', latin: 'Convallaria majalis', family: 'Asparagacées', familyLatin: 'Asparagaceae', alias: { name: ['Muguet de mai'], family: ['Liliacées', 'Convallariacées', 'Ruscacées'] } },
  { code: 'p063', name: 'Myosotis des bois', latin: 'Myosotis sylvatica', family: 'Boraginacées', familyLatin: 'Boraginaceae', alias: { name: ['Myosotis', 'Ne-m’oubliez-pas'] } },
  { code: 'p064', name: 'Myrtille', latin: 'Vaccinium myrtillus', family: 'Éricacées', familyLatin: 'Ericaceae', alias: { name: ['Myrtillier', 'Airelle myrtille'] } },
  { code: 'p065', name: 'Nénuphar blanc', latin: 'Nymphaea alba', family: 'Nymphéacées', familyLatin: 'Nymphaeaceae', alias: { name: ['Nénuphar', 'Lys d’eau', 'Nymphéa'] } },
  { code: 'p066', name: 'Noisetier', latin: 'Corylus avellana', family: 'Bétulacées', familyLatin: 'Betulaceae', alias: { name: ['Coudrier', 'Noisetier commun'], family: ['Corylacées'] } },
  { code: 'p067', name: 'Noyer commun', latin: 'Juglans regia', family: 'Juglandacées', familyLatin: 'Juglandaceae', alias: { name: ['Noyer'] } },
  { code: 'p068', name: 'Olivier', latin: 'Olea europaea', family: 'Oléacées', familyLatin: 'Oleaceae', alias: { name: ['Olivier d’Europe'] } },
  { code: 'p069', name: 'Orchis mâle', latin: 'Orchis mascula', family: 'Orchidacées', familyLatin: 'Orchidaceae', alias: { name: ['Orchis', 'Orchidée'] } },
  { code: 'p070', name: 'Orme champêtre', latin: 'Ulmus minor', family: 'Ulmacées', familyLatin: 'Ulmaceae', alias: { name: ['Orme'] } },
  { code: 'p071', name: 'Orpin âcre', latin: 'Sedum acre', family: 'Crassulacées', familyLatin: 'Crassulaceae', alias: { name: ['Orpin brûlant', 'Poivre de muraille', 'Orpin'] } },
  { code: 'p072', name: 'Ortie dioïque', latin: 'Urtica dioica', family: 'Urticacées', familyLatin: 'Urticaceae', alias: { name: ['Grande ortie', 'Ortie'] } },
  { code: 'p073', name: 'Oseille commune', latin: 'Rumex acetosa', family: 'Polygonacées', familyLatin: 'Polygonaceae', alias: { name: ['Grande oseille', 'Oseille'] } },
  { code: 'p074', name: 'Palmier dattier', latin: 'Phoenix dactylifera', family: 'Arécacées', familyLatin: 'Arecaceae', alias: { name: ['Dattier'], family: ['Palmiers', 'Palmacées'] } },
  { code: 'p075', name: 'Pâquerette', latin: 'Bellis perennis', family: 'Astéracées', familyLatin: 'Asteraceae', alias: { name: ['Pâquerette vivace'], family: ['Composées'] } },
  { code: 'p076', name: 'Perce-neige', latin: 'Galanthus nivalis', family: 'Amaryllidacées', familyLatin: 'Amaryllidaceae', alias: { name: ['Galanthe', 'Galanthus'] } },
  { code: 'p077', name: 'Persil', latin: 'Petroselinum crispum', family: 'Apiacées', familyLatin: 'Apiaceae', alias: { name: ['Persil commun', 'Persil cultivé'], family: ['Ombellifères'] } },
  { code: 'p078', name: 'Peuplier tremble', latin: 'Populus tremula', family: 'Salicacées', familyLatin: 'Salicaceae', alias: { name: ['Tremble', 'Peuplier'] } },
  { code: 'p079', name: 'Pin sylvestre', latin: 'Pinus sylvestris', family: 'Pinacées', familyLatin: 'Pinaceae', alias: { name: ['Pin'], family: ['Abiétacées'] } },
  { code: 'p080', name: 'Pissenlit', latin: 'Taraxacum officinale', family: 'Astéracées', familyLatin: 'Asteraceae', alias: { name: ['Dent-de-lion', 'Pissenlit officinal'], family: ['Composées'] } },
  { code: 'p081', name: 'Pivoine officinale', latin: 'Paeonia officinalis', family: 'Péoniacées', familyLatin: 'Paeoniaceae', alias: { name: ['Pivoine'], family: ['Pivoinacées'] } },
  { code: 'p082', name: 'Plantain lancéolé', latin: 'Plantago lanceolata', family: 'Plantaginacées', familyLatin: 'Plantaginaceae', alias: { name: ['Plantain'] } },
  { code: 'p083', name: 'Platane d’Orient', latin: 'Platanus orientalis', family: 'Platanacées', familyLatin: 'Platanaceae', alias: { name: ['Platane'] } },
  { code: 'p084', name: 'Pomme de terre', latin: 'Solanum tuberosum', family: 'Solanacées', familyLatin: 'Solanaceae', alias: { name: ['Patate'] } },
  { code: 'p085', name: 'Pommier', latin: 'Malus domestica', family: 'Rosacées', familyLatin: 'Rosaceae', alias: { name: ['Pommier commun', 'Pommier domestique'] } },
  { code: 'p086', name: 'Prêle des champs', latin: 'Equisetum arvense', family: 'Équisétacées', familyLatin: 'Equisetaceae', alias: { name: ['Prêle', 'Queue-de-rat'] } },
  { code: 'p087', name: 'Primevère officinale', latin: 'Primula veris', family: 'Primulacées', familyLatin: 'Primulaceae', alias: { name: ['Coucou', 'Primevère'] } },
  { code: 'p088', name: 'Rhododendron ferrugineux', latin: 'Rhododendron ferrugineum', family: 'Éricacées', familyLatin: 'Ericaceae', alias: { name: ['Rhododendron', 'Rose des Alpes'] } },
  { code: 'p089', name: 'Riz', latin: 'Oryza sativa', family: 'Poacées', familyLatin: 'Poaceae', alias: { name: ['Riz asiatique', 'Riz cultivé'], family: ['Graminées'] } },
  { code: 'p090', name: 'Robinier faux-acacia', latin: 'Robinia pseudoacacia', family: 'Fabacées', familyLatin: 'Fabaceae', alias: { name: ['Robinier', 'Faux acacia', 'Acacia'], family: ['Légumineuses', 'Papilionacées'] } },
  { code: 'p091', name: 'Romarin', latin: 'Salvia rosmarinus', family: 'Lamiacées', familyLatin: 'Lamiaceae', alias: { name: ['Romarin officinal'], family: ['Labiées'] } },
  { code: 'p092', name: 'Roseau commun', latin: 'Phragmites australis', family: 'Poacées', familyLatin: 'Poaceae', alias: { name: ['Roseau', 'Phragmite'], family: ['Graminées'] } },
  { code: 'p093', name: 'Sapin pectiné', latin: 'Abies alba', family: 'Pinacées', familyLatin: 'Pinaceae', alias: { name: ['Sapin blanc', 'Sapin'], family: ['Abiétacées'] } },
  { code: 'p094', name: 'Saule pleureur', latin: 'Salix babylonica', family: 'Salicacées', familyLatin: 'Salicaceae', alias: { name: ['Saule'] } },
  { code: 'p095', name: 'Séquoia géant', latin: 'Sequoiadendron giganteum', family: 'Cupressacées', familyLatin: 'Cupressaceae', alias: { name: ['Séquoia', 'Wellingtonia'], family: ['Taxodiacées'] } },
  { code: 'p096', name: 'Sorbier des oiseleurs', latin: 'Sorbus aucuparia', family: 'Rosacées', familyLatin: 'Rosaceae', alias: { name: ['Sorbier'] } },
  { code: 'p097', name: 'Thym commun', latin: 'Thymus vulgaris', family: 'Lamiacées', familyLatin: 'Lamiaceae', alias: { name: ['Thym', 'Farigoule'], family: ['Labiées'] } },
  { code: 'p098', name: 'Tilleul à grandes feuilles', latin: 'Tilia platyphyllos', family: 'Malvacées', familyLatin: 'Malvaceae', alias: { name: ['Tilleul'], family: ['Tiliacées'] } },
  { code: 'p099', name: 'Tomate', latin: 'Solanum lycopersicum', family: 'Solanacées', familyLatin: 'Solanaceae', alias: { name: ['Tomate cultivée'] } },
  { code: 'p100', name: 'Tournesol', latin: 'Helianthus annuus', family: 'Astéracées', familyLatin: 'Asteraceae', alias: { name: ['Soleil', 'Hélianthe'], family: ['Composées'] } },
  { code: 'p101', name: 'Trèfle des prés', latin: 'Trifolium pratense', family: 'Fabacées', familyLatin: 'Fabaceae', alias: { name: ['Trèfle violet', 'Trèfle'], family: ['Légumineuses', 'Papilionacées'] } },
  { code: 'p102', name: 'Tulipe', latin: 'Tulipa gesneriana', family: 'Liliacées', familyLatin: 'Liliaceae', alias: { name: ['Tulipe des jardins', 'Tulipe de Gesner'] } },
  { code: 'p103', name: 'Vigne', latin: 'Vitis vinifera', family: 'Vitacées', familyLatin: 'Vitaceae', commons: "Edle Weinrebe, 'Vitis vinifera' subsp. 'vinifera.jpg", alias: { name: ['Vigne cultivée', 'Vigne européenne'], family: ['Ampélidacées'] } },
  { code: 'p104', name: 'Violette odorante', latin: 'Viola odorata', family: 'Violacées', familyLatin: 'Violaceae', alias: { name: ['Violette'] } },
];

export const BY_CODE = new Map(PLANTS.map((plant) => [plant.code, plant]));

/**
 * Toutes les réponses acceptées pour un champ donné ('name' | 'family').
 * La forme scientifique d'une famille est toujours acceptée : personne ne doit
 * perdre un point pour avoir écrit « Rosaceae » plutôt que « Rosacées ».
 */
export function accepted(plant, field) {
  const others = plant.alias?.[field] ?? [];
  if (field === 'family') return [plant.family, plant.familyLatin, ...others];
  return [plant[field], ...others];
}

/** Les familles représentées dans le corpus, sans doublon et ordonnées. */
export const FAMILIES = [...new Set(PLANTS.map((plant) => plant.family))].sort((a, b) =>
  a.localeCompare(b, 'fr'),
);
