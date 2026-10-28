/* DeadShop — the heroes of the game and what answers them.
   The portraits come from the game files; the numbers come from the same
   snapshot as the shop. The letter in "w" is the weakness of the hero:
   the kind of damage that decides the fight against it.
     heal   - it keeps its team alive
     gun    - it kills with bullets
     bullet - it soaks bullets and walks through them
     spirit - it burns with spirit
     control- it is fast and cannot be held still
     melee  - it kills with its fists
     burst  - it deletes you before you can react
   The counter lists are built from the groups of the items, so they grow
   by themselves whenever the shop data is refreshed. */
window.DSH = {
  heroes: [
    { slug: 'abrams', name: 'Abrams', gun: 'Shotgun', hp: 800, w: 'bullet' },
    { slug: 'apollo', name: 'Apollo', gun: 'Spreadshot', hp: 770, w: 'gun' },
    { slug: 'baba', name: 'Baba', gun: 'Fists', hp: 780, w: 'melee' },
    { slug: 'bebop', name: 'Bebop', gun: 'Beam Weapon', hp: 880, w: 'heal' },
    { slug: 'billy', name: 'Billy', gun: 'Close Range', hp: 820, w: 'burst' },
    { slug: 'calico', name: 'Calico', gun: 'Spreadshot', hp: 730, w: 'gun' },
    { slug: 'celeste', name: 'Celeste', gun: 'Burst Fire', hp: 690, w: 'control' },
    { slug: 'deadman-danny', name: 'Deadman Danny', gun: 'None', hp: 730, w: 'gun' },
    { slug: 'drifter', name: 'Drifter', gun: 'Spreadshot', hp: 755, w: 'gun' },
    { slug: 'dynamo', name: 'Dynamo', gun: 'Pistol', hp: 880, w: 'bullet' },
    { slug: 'graves', name: 'Graves', gun: 'Pistol', hp: 730, w: 'gun' },
    { slug: 'grey-talon', name: 'Grey Talon', gun: 'Bow', hp: 780, w: 'control' },
    { slug: 'haze', name: 'Haze', gun: 'Rapid Fire', hp: 730, w: 'control' },
    { slug: 'holliday', name: 'Holliday', gun: 'Pistol', hp: 780, w: 'control' },
    { slug: 'infernus', name: 'Infernus', gun: 'Rapid Fire', hp: 830, w: 'gun' },
    { slug: 'ivy', name: 'Ivy', gun: 'Rapid Fire', hp: 755, w: 'spirit' },
    { slug: 'kelvin', name: 'Kelvin', gun: 'Heavy Hitter', hp: 880, w: 'heal' },
    { slug: 'lady-geist', name: 'Lady Geist', gun: 'Pistol', hp: 880, w: 'spirit' },
    { slug: 'lash', name: 'Lash', gun: 'Burst Fire', hp: 780, w: 'spirit' },
    { slug: 'mcginnis', name: 'McGinnis', gun: 'Heavy Artillery', hp: 780, w: 'gun' },
    { slug: 'mina', name: 'Mina', gun: 'Pistol', hp: 660, w: 'gun' },
    { slug: 'mirage', name: 'Mirage', gun: 'Pistol', hp: 730, w: 'spirit' },
    { slug: 'mo-and-krill', name: 'Mo & Krill', gun: 'Spreadshot', hp: 930, w: 'bullet' },
    { slug: 'nurse', name: 'Nurse Harrow', gun: 'None', hp: 730, w: 'heal' },
    { slug: 'paige', name: 'Paige', gun: 'Projectile', hp: 680, w: 'gun' },
    { slug: 'paradox', name: 'Paradox', gun: 'Burst Fire', hp: 730, w: 'control' },
    { slug: 'pocket', name: 'Pocket', gun: 'Spreadshot', hp: 780, w: 'gun' },
    { slug: 'rat-king', name: 'Rat King', gun: 'Spreadshot', hp: 800, w: 'gun' },
    { slug: 'rem', name: 'Rem', gun: 'None', hp: 680, w: 'heal' },
    { slug: 'seven', name: 'Seven', gun: 'Burst Fire', hp: 730, w: 'burst' },
    { slug: 'shiv', name: 'Shiv', gun: 'Spreadshot', hp: 830, w: 'melee' },
    { slug: 'silver', name: 'Silver', gun: 'Long Range', hp: 830, w: 'gun' },
    { slug: 'sinclair', name: 'Sinclair', gun: 'Burst Fire', hp: 730, w: 'control' },
    { slug: 'solomon', name: 'Solomon', gun: 'Projectile', hp: 780, w: 'gun' },
    { slug: 'the-doorman', name: 'The Doorman', gun: 'Pistol', hp: 755, w: 'control' },
    { slug: 'venator', name: 'Venator', gun: 'Crossbow', hp: 820, w: 'gun' },
    { slug: 'victor', name: 'Victor', gun: 'Pistol', hp: 800, w: 'burst' },
    { slug: 'vindicta', name: 'Vindicta', gun: 'Long Range', hp: 755, w: 'gun' },
    { slug: 'artist', name: 'Violet', gun: 'None', hp: 710, w: 'gun' },
    { slug: 'viscous', name: 'Viscous', gun: 'Projectile', hp: 780, w: 'melee' },
    { slug: 'vyper', name: 'Vyper', gun: 'Rapid Fire', hp: 780, w: 'burst' },
    { slug: 'warden', name: 'Warden', gun: 'Heavy Hitter', hp: 805, w: 'bullet' },
    { slug: 'wraith', name: 'Wraith', gun: 'Rapid Fire', hp: 730, w: 'gun' },
    { slug: 'yamato', name: 'Yamato', gun: 'Spreadshot', hp: 730, w: 'control' }
  ],

  /* The counter library. Every category is a set of item groups, so the
     lists follow the shop data instead of being written out by hand. */
  counters: [
    {
      id: 'heal', lead: 'healbane', title: 'Against healing',
      note: 'The enemy team heals faster than you can kill. Cut the healing off.',
      groups: ['Anti Healing', 'Debuffs']
    },
    {
      id: 'gun', lead: 'rusted-barrel', title: 'Against gun damage',
      note: 'Bullets are the commonest way to die. Stop the bullets first.',
      groups: ['Anti Gun', 'Additional Protection']
    },
    {
      id: 'bullet', lead: 'berserker', title: 'Against bullet tanks',
      note: 'Some heroes simply do not die to bullets. Take the percentages instead.',
      groups: ['Tanking Bullets', 'Bullet Protection', 'Additional Protection']
    },
    {
      id: 'spirit', lead: 'spirit-resilience', title: 'Against spirit damage',
      note: 'Spirit burns through health bars. Armour does not help against it.',
      groups: ['Spirit Protection', 'Magic Vulnerability', 'Misc Spirit']
    },
    {
      id: 'control', lead: 'slowing-hex', title: 'Against fast heroes',
      note: 'A hero that cannot move cannot shoot. Slow them, then kill them.',
      groups: ['Crown Control', 'Slowing Bullets', 'Slowing Magic', 'Movement and Agility']
    },
    {
      id: 'melee', lead: 'melee-lifesteal', title: 'Against melee heroes',
      note: 'They come to you. Answer them at their own range.',
      groups: ['Melee', 'Melee Spirit', 'Tanking Bullets']
    },
    {
      id: 'burst', lead: 'mystic-burst', title: 'Against high damage',
      note: 'Some heroes delete you in a second. Hit them before the burst lands.',
      groups: ['Burst Damage', 'Headshot Enthusiasts', 'Rate Of Fire']
    },
    {
      id: 'tempo', lead: 'superior-cooldown', title: 'Against ability spam',
      note: 'The cooldown is the weak point. Shorten it and their kit stops working.',
      groups: ['Cooldown', 'Charges', 'Duration']
    },
    {
      id: 'sustain', lead: 'bullet-lifesteal', title: 'Against lifesteal',
      note: 'They heal from what they hit. Take it back from them.',
      groups: ['Lifesteal', 'Healing', 'Revitalization']
    }
  ]
};
