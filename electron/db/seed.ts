import type Database from 'better-sqlite3'

export function seedDemoData(db: Database.Database, userId: number): { categories: number; locations: number; items: number } {
  // ── Categories ───────────────────────────────────────────────────────────
  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (name, description, parent_id) VALUES (?, ?, ?)
  `)

  const catId = (name: string) =>
    (db.prepare('SELECT id FROM categories WHERE name = ?').get(name) as { id: number }).id

  insertCat.run('Fine Art', 'Paintings, sculptures, drawings and prints', null)
  insertCat.run('Decorative Arts', 'Ceramics, textiles, furniture and applied arts', null)
  insertCat.run('Archaeology', 'Archaeological finds and antiquities', null)
  insertCat.run('Natural History', 'Fossils, minerals and botanical specimens', null)
  insertCat.run('Photography & Media', 'Photographs, film and digital media', null)

  insertCat.run('Paintings', 'Oil, watercolour and acrylic works', catId('Fine Art'))
  insertCat.run('Sculptures', 'Three-dimensional artworks', catId('Fine Art'))
  insertCat.run('Drawings & Prints', 'Works on paper', catId('Fine Art'))
  insertCat.run('Ceramics & Pottery', 'Fired clay objects', catId('Decorative Arts'))
  insertCat.run('Textiles & Costumes', 'Woven, embroidered and sewn works', catId('Decorative Arts'))
  insertCat.run('Furniture', 'Decorative and functional furniture', catId('Decorative Arts'))
  insertCat.run('Classical Antiquities', 'Greek, Roman and Egyptian artefacts', catId('Archaeology'))
  insertCat.run('Pre-Columbian', 'Mesoamerican and South American artefacts', catId('Archaeology'))
  insertCat.run('Fossils & Minerals', 'Geological and palaeontological specimens', catId('Natural History'))

  const categories = (db.prepare('SELECT COUNT(*) as n FROM categories').get() as { n: number }).n

  // ── Locations ────────────────────────────────────────────────────────────
  const insertLoc = db.prepare(`
    INSERT OR IGNORE INTO locations (name, type, description) VALUES (?, ?, ?)
  `)

  insertLoc.run('Main Gallery', 'gallery', 'Ground-floor permanent collection gallery')
  insertLoc.run('East Wing Gallery', 'gallery', 'First-floor rotating exhibitions space')
  insertLoc.run('West Wing Gallery', 'gallery', 'Contemporary and modern art gallery')
  insertLoc.run('Archive Storage A', 'storage', 'Climate-controlled primary storage facility')
  insertLoc.run('Archive Storage B', 'storage', 'Secondary off-site storage facility')
  insertLoc.run('Conservation Lab', 'conservation', 'Active conservation and restoration laboratory')
  insertLoc.run('City Library Loan', 'loan', 'Long-term loan to the City Central Library')
  insertLoc.run('University Loan', 'loan', 'Academic loan to Westfield University')

  const locations = (db.prepare('SELECT COUNT(*) as n FROM locations').get() as { n: number }).n

  const locId = (name: string) =>
    (db.prepare('SELECT id FROM locations WHERE name = ?').get(name) as { id: number }).id

  // ── Items ─────────────────────────────────────────────────────────────────
  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO items
      (accession_number, title, description, category_id, location_id, status,
       acquisition_date, acquisition_method, donor_name, estimated_value,
       condition_rating, provenance, notes, image_paths, tags, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?)
  `)

  const add = (
    acc: string, title: string, desc: string,
    cat: string, loc: string,
    status: string, date: string, method: string,
    donor: string | null, value: number | null,
    condition: string, provenance: string, notes: string, tags: string[]
  ) => insertItem.run(
    acc, title, desc,
    catId(cat), locId(loc),
    status, date, method,
    donor, value,
    condition, provenance, notes,
    JSON.stringify(tags), userId, userId
  )

  // Paintings
  add('2018.001.001',
    'Coastal Sunrise', 'Oil on canvas depicting dawn over the North Sea with fishing vessels in the foreground.',
    'Paintings', 'Main Gallery',
    'display', '2018-03-15', 'purchase',
    null, 42000,
    'good', 'Acquired at Christie\'s London auction, March 2018. Previously in a private Scottish collection, c. 1920–2018.',
    'Reframed 2019. Minor in-painting to upper-left corner.',
    ['seascape', 'oil', '19th century', 'British'])

  add('2019.002.001',
    'Portrait of a Merchant', 'Formal portrait in oil, Dutch Golden Age style, sitter unidentified.',
    'Paintings', 'East Wing Gallery',
    'display', '2019-07-22', 'donation',
    'Estate of Sir Reginald Booth', 180000,
    'fair', 'Booth family collection since at least 1890. Likely Amsterdam origin, c. 1660–1680.',
    'Condition report 2022: varnish yellowing, small flake loss upper right. Scheduled for conservation 2025.',
    ['portrait', 'Dutch', 'oil', '17th century'])

  add('2020.003.001',
    'Abstract Composition No. 7', 'Large-format acrylic on canvas, geometric abstraction in earth tones.',
    'Paintings', 'West Wing Gallery',
    'display', '2020-01-10', 'purchase',
    null, 28500,
    'excellent', 'Purchased directly from the artist\'s studio, January 2020.',
    '',
    ['abstract', 'contemporary', 'acrylic', 'geometric'])

  add('2021.004.001',
    'Alpine Village in Winter', 'Watercolour on paper, Swiss Alps pastoral scene.',
    'Drawings & Prints', 'Archive Storage A',
    'storage', '2021-05-30', 'bequest',
    'Margaret Holloway', 9800,
    'good', 'Bequeathed by M. Holloway, 2021. Purchased by her in Zurich, 1962.',
    'Stored unframed in acid-free folder.',
    ['watercolour', 'landscape', 'Swiss', '20th century'])

  add('2022.005.001',
    'Study of Hands (after Dürer)', 'Graphite on cartridge paper, academic study.',
    'Drawings & Prints', 'Archive Storage A',
    'storage', '2022-09-14', 'transfer',
    null, 1200,
    'good', 'Transferred from Westfield University Art Department, 2022.',
    '',
    ['drawing', 'academic', 'graphite'])

  add('2023.006.001',
    'Landscape with Cattle', 'Oil on board, pastoral English countryside scene.',
    'Paintings', 'Conservation Lab',
    'conservation', '2023-02-01', 'purchase',
    null, 15000,
    'poor', 'Auction purchase, 2023. Previous ownership unknown pre-1970.',
    'Active treatment: canvas relining and varnish removal underway.',
    ['landscape', 'oil', 'Victorian', 'pastoral'])

  // Sculptures
  add('2015.007.001',
    'Reclining Figure', 'Cast bronze on marble plinth, modernist figurative work.',
    'Sculptures', 'Main Gallery',
    'display', '2015-11-20', 'purchase',
    null, 95000,
    'excellent', 'Foundry cast, edition 3/6. Purchased from Marlborough Gallery, London, 2015.',
    'Annual wax treatment applied.',
    ['bronze', 'modernist', 'figurative', '20th century'])

  add('2016.008.001',
    'Terracotta Warrior Fragment', 'Terracotta head fragment, Han dynasty style.',
    'Sculptures', 'Archive Storage A',
    'storage', '2016-04-08', 'donation',
    'Dr. Patricia Lau', 22000,
    'fair', 'Private collection, Hong Kong, pre-1970 export. Donated 2016.',
    'Missing left ear. Hairline crack repaired with reversible consolidant.',
    ['terracotta', 'Chinese', 'Han dynasty', 'ancient'])

  add('2017.009.001',
    'Garden Deity (Ganesh)', 'Carved sandstone, South Indian temple sculpture, 12th century.',
    'Sculptures', 'Main Gallery',
    'display', '2017-08-15', 'purchase',
    null, 310000,
    'good', 'Sotheby\'s New York, 2017. Documented collection since 1930, UK private.',
    'Ethical acquisition review completed. Certificate of lawful export filed.',
    ['sandstone', 'Hindu', 'medieval', 'South Indian', 'religious'])

  // Ceramics
  add('2014.010.001',
    'Blue and White Porcelain Vase', 'Ming dynasty style, underglaze blue decoration with dragon motif.',
    'Ceramics & Pottery', 'Main Gallery',
    'display', '2014-06-30', 'purchase',
    null, 54000,
    'excellent', 'Christie\'s Hong Kong, 2014. Private European collection since 1920s.',
    '',
    ['porcelain', 'Chinese', 'Ming', 'blue and white', 'dragon'])

  add('2018.011.001',
    'Arts & Crafts Earthenware Jug', 'Studio pottery, matte green glaze, maker\'s mark on base.',
    'Ceramics & Pottery', 'East Wing Gallery',
    'display', '2018-09-05', 'donation',
    'Friends of the Museum Fund', 3400,
    'good', 'English, c. 1900–1910. Donated by the Friends of the Museum Fund, 2018.',
    '',
    ['earthenware', 'Arts & Crafts', 'British', 'studio pottery'])

  add('2020.012.001',
    'Wedgwood Jasperware Plaque', 'Blue jasperware plaque with classical relief figures.',
    'Ceramics & Pottery', 'Archive Storage B',
    'storage', '2020-03-22', 'bequest',
    'James Thornton Estate', 2100,
    'fair', 'Staffordshire, c. 1790. Thornton bequest, 2020.',
    'Small chip to lower-right edge. Stored in padded box.',
    ['Wedgwood', 'jasperware', 'Georgian', 'classical'])

  // Textiles
  add('2013.013.001',
    'Silk Court Robe (Jifu)', 'Chinese imperial-style court robe, embroidered silk, Qing period.',
    'Textiles & Costumes', 'Archive Storage A',
    'storage', '2013-12-10', 'purchase',
    null, 78000,
    'good', 'Christie\'s London, 2013. English private collection since 1910.',
    'Stored flat in acid-free tissue. Annual humidity check.',
    ['silk', 'Chinese', 'Qing', 'embroidery', 'imperial', 'costume'])

  add('2019.014.001',
    'Victorian Mourning Dress', 'Black silk taffeta mourning dress, c. 1880, with jet jewellery.',
    'Textiles & Costumes', 'East Wing Gallery',
    'display', '2019-11-01', 'donation',
    'Harriet Pearce', 4500,
    'fair', 'Family provenance, donated 2019. Worn by donor\'s great-grandmother.',
    'Displayed on mannequin. Fragile seams noted.',
    ['Victorian', 'mourning', 'silk', 'costume', '19th century'])

  // Archaeology
  add('2010.015.001',
    'Roman Bronze Fibula', 'Decorated penannular brooch, 2nd–3rd century AD.',
    'Classical Antiquities', 'Main Gallery',
    'display', '2010-05-18', 'purchase',
    null, 8500,
    'good', 'Bonhams London, 2010. UK metal-detected find, reported under Portable Antiquities Scheme.',
    'PAS reference: WMID-3F4A12.',
    ['Roman', 'bronze', 'fibula', 'brooch', 'ancient'])

  add('2011.016.001',
    'Greek Attic Red-Figure Kylix', 'Wine cup with warrior scene, attributed to the Brygos Painter school.',
    'Classical Antiquities', 'Main Gallery',
    'display', '2011-02-14', 'purchase',
    null, 125000,
    'fair', 'European private collection documented since 1960. Sotheby\'s 2011.',
    'Repaired ancient break across bowl. Two small lacunae in-filled.',
    ['Greek', 'Attic', 'red-figure', 'kylix', 'ancient', 'pottery'])

  add('2022.017.001',
    'Aztec Stone Offering Bowl', 'Carved basalt ritual vessel, Postclassic period.',
    'Pre-Columbian', 'Archive Storage B',
    'storage', '2022-07-19', 'transfer',
    null, 35000,
    'good', 'Transferred from National University Department of Anthropology, 2022. Export documentation complete.',
    'Under review for potential repatriation discussion.',
    ['Aztec', 'stone', 'Mesoamerican', 'ritual', 'Postclassic'])

  // Natural History
  add('2008.018.001',
    'Ammonite Specimen (Titanites giganteus)', 'Polished cross-section, 150cm diameter. Jurassic period.',
    'Fossils & Minerals', 'Main Gallery',
    'display', '2008-09-01', 'purchase',
    null, 12000,
    'excellent', 'Quarry find, Dorset coast, 1998. Acquired from geological dealer, 2008.',
    'Display mount custom-fabricated 2009.',
    ['fossil', 'ammonite', 'Jurassic', 'geology'])

  add('2012.019.001',
    'Meteorite Fragment (Iron-Nickel)', '4.7 kg oriented meteorite, Widmanstätten pattern visible on cut face.',
    'Fossils & Minerals', 'Main Gallery',
    'display', '2012-04-22', 'donation',
    'Professor Alan Rowe', 28000,
    'excellent', 'Recovered Campo del Cielo, Argentina. Donated by Prof. A. Rowe, 2012.',
    'Certificate of authenticity filed. Kept in UV-protective case.',
    ['meteorite', 'iron', 'extraterrestrial', 'geology'])

  add('2021.020.001',
    'Herbarium Sheet – Orchid (Ophrys apifera)', 'Pressed and mounted bee orchid, collected 1887.',
    'Fossils & Minerals', 'Archive Storage A',
    'storage', '2021-03-09', 'transfer',
    null, 450,
    'fair', 'Royal Botanical Society collection, transferred 2021.',
    'Some fading to petals. Stored in archival plan chest.',
    ['herbarium', 'botanical', 'orchid', 'Victorian'])

  // Photography
  add('2016.021.001',
    'Daguerreotype Portrait (Unknown Couple)', '6th-plate daguerreotype in original leather case, c. 1850.',
    'Photography & Media', 'Archive Storage A',
    'storage', '2016-06-30', 'donation',
    'Antique Photographic Society', 1800,
    'good', 'Unknown sitters, British, c. 1850. Donated by the Antique Photographic Society, 2016.',
    'Case hinge replaced. Plate surface intact.',
    ['daguerreotype', 'Victorian', 'portrait', 'photography'])

  add('2019.022.001',
    'WWI Battlefield Photograph Album', '48 gelatin silver prints, Western Front, 1916–1918.',
    'Photography & Media', 'Archive Storage A',
    'storage', '2019-11-11', 'donation',
    'Wilfred Marsh Family', 3200,
    'fair', 'Donated by family of Private W. Marsh, 2019.',
    'Several pages show foxing. Digitisation scheduled.',
    ['WWI', 'military', 'gelatin silver', 'album', 'documentary'])

  add('2023.023.001',
    'City Panorama (Large Format Print)', 'Gelatin silver contact print, 60×120 cm, city skyline c. 1935.',
    'Photography & Media', 'City Library Loan',
    'loan', '2023-06-01', 'purchase',
    null, 6500,
    'good', 'Unknown photographer. Purchased at auction, 2023.',
    'On loan to City Library since June 2023. Loan agreement expires June 2026.',
    ['cityscape', 'photography', '1930s', 'panorama'])

  // Furniture
  add('2014.024.001',
    'Georgian Mahogany Secretaire', 'Fall-front writing desk with fitted interior, c. 1790.',
    'Furniture', 'East Wing Gallery',
    'display', '2014-10-10', 'purchase',
    null, 18500,
    'good', 'English, attributed to Gillows of Lancaster. Christie\'s London, 2014.',
    'Original brass fittings intact. Minor veneer repair to top.',
    ['Georgian', 'mahogany', 'furniture', '18th century', 'Gillows'])

  add('2020.025.001',
    'Art Deco Cocktail Cabinet', 'Lacquered walnut with chromium fittings and mirrored interior.',
    'Furniture', 'West Wing Gallery',
    'display', '2020-08-20', 'donation',
    'Modernist Society Bequest', 9200,
    'excellent', 'English, c. 1930. Modernist Society Bequest, 2020.',
    '',
    ['Art Deco', 'furniture', '1930s', 'walnut', 'chromium'])

  // On loan / at university
  add('2017.026.001',
    'Illuminated Manuscript Leaf (Book of Hours)', 'Vellum leaf with gilt and tempera miniature, Flemish, c. 1470.',
    'Drawings & Prints', 'University Loan',
    'loan', '2017-09-01', 'purchase',
    null, 62000,
    'good', 'Single leaf from dispersed Book of Hours. Sotheby\'s Paris, 2017.',
    'On academic loan to Westfield University since 2017. Reviewed annually.',
    ['manuscript', 'illuminated', 'Flemish', 'medieval', 'vellum'])

  // Deaccessioned
  add('2005.027.001',
    'Reproduction Roman Bust (Plaster)', 'Victorian plaster cast after original in the British Museum.',
    'Sculptures', 'Archive Storage B',
    'deaccessioned', '2005-01-01', 'transfer',
    null, 0,
    'poor', 'Teaching collection, origin unknown. Deaccessioned 2023.',
    'Deaccessioned: reproduction of no scholarly value. To be offered to local schools.',
    ['plaster', 'reproduction', 'Victorian', 'cast'])

  const items = (db.prepare('SELECT COUNT(*) as n FROM items WHERE accession_number LIKE \'20__.0__.__\'').get() as { n: number }).n

  return { categories, locations, items }
}
