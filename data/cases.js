/* DeadShop — the cases of the shop.
 *
 * Five cases, one for every hero of the Deadlock, and every case has its
 * own collection — the way the cases of Counter-Strike keep their own.
 *
 * The rarities are the ones of Counter-Strike: the grey of the common, the
 * blue of the uncommon, the purple of the rare, the pink of the very rare,
 * the gold of the legendary and the red of the contraband. The hero himself
 * is the rarest thing in his case; his abilities and his stats are the
 * common ones.
 *
 * The art of an item is either the portrait of the hero or the icon of a
 * stat of the game — so every case is drawn with what the game files gave
 * us, and nothing has to be drawn by hand.
 */
window.DSCASES = {
  rarities: [
    { id: 'common', name: 'Common', color: '#9FB0B8', odds: 50 },
    { id: 'uncommon', name: 'Uncommon', color: '#4B9CD3', odds: 25 },
    { id: 'rare', name: 'Rare', color: '#8B5CF6', odds: 13 },
    { id: 'veryrare', name: 'Very rare', color: '#EC4899', odds: 7 },
    { id: 'legendary', name: 'Legendary', color: '#F5A524', odds: 4 },
    { id: 'contraband', name: 'Contraband', color: '#EF4444', odds: 1 }
  ],
  cases: [
    {
      id: 'shiv', name: 'Shiv', hero: 'shiv', slot: 'Spirit', cost: 40,
      tagline: 'The poison of the lane. He cuts first and bleeds you after.',
      items: [
        { id: 'shiv-01', name: 'Rusty Shiv', rarity: 'common', art: 'stat', icon: 'melee-damage', desc: 'A blade that has seen more walls than flesh.' },
        { id: 'shiv-02', name: 'Chipped Knife', rarity: 'common', art: 'stat', icon: 'damage', desc: 'Sharp enough, barely.' },
        { id: 'shiv-03', name: 'Toxic Blades', rarity: 'uncommon', art: 'stat', icon: 'damage-heart', desc: 'The wound opens later, and it does not close.' },
        { id: 'shiv-04', name: 'Bloodthirst', rarity: 'uncommon', art: 'stat', icon: 'health', desc: 'What he takes, he keeps.' },
        { id: 'shiv-05', name: 'Serrated Knives', rarity: 'rare', art: 'stat', icon: 'melee-damage', desc: 'The edge that decides the fight.' },
        { id: 'shiv-06', name: "Killer's Instinct", rarity: 'rare', art: 'stat', icon: 'healing', desc: 'He heals when the enemy falls.' },
        { id: 'shiv-07', name: 'Bullet Dance', rarity: 'veryrare', art: 'stat', icon: 'move-speed', desc: 'He moves like the bullet that hit him.' },
        { id: 'shiv-08', name: 'Bleed Resist', rarity: 'veryrare', art: 'stat', icon: 'debuff-reducer', desc: 'The poison does not bite twice.' },
        { id: 'shiv-09', name: 'Deadly Rhythm', rarity: 'legendary', art: 'stat', icon: 'tech-duration', desc: 'The beat of the blades, over and over.' },
        { id: 'shiv-10', name: 'Toxic Cloud', rarity: 'legendary', art: 'stat', icon: 'spirit-damage', desc: 'The air itself is on his side.' },
        { id: 'shiv-11', name: 'Killer Mark', rarity: 'contraband', art: 'stat', icon: 'bullet-lifesteal', desc: 'Written on the ones he has already killed.' },
        { id: 'shiv-12', name: 'Shiv himself', rarity: 'contraband', art: 'hero', desc: 'The hero of the lane. The rarest thing in his case.' }
      ]
    },
    {
      id: 'vindicta', name: 'Vindicta', hero: 'vindicta', slot: 'Spirit', cost: 50,
      tagline: 'The assassin of the back line. She comes from the dark.',
      items: [
        { id: 'vindicta-01', name: 'Rusty Stake', rarity: 'common', art: 'stat', icon: 'melee-damage', desc: 'Left in the ground by somebody else.' },
        { id: 'vindicta-02', name: 'Old Dagger', rarity: 'common', art: 'stat', icon: 'damage', desc: 'The first tool of every killer.' },
        { id: 'vindicta-03', name: 'Stake', rarity: 'uncommon', art: 'stat', icon: 'slowing-hex', desc: 'Pinned to the ground, pinned to the ground.' },
        { id: 'vindicta-04', name: 'Silent Step', rarity: 'uncommon', art: 'stat', icon: 'move-speed', desc: 'Nobody hears her coming.' },
        { id: 'vindicta-05', name: 'Flight', rarity: 'rare', art: 'stat', icon: 'move-speed-sprint', desc: 'The wings of a woman who hunts.' },
        { id: 'vindicta-06', name: 'Cascading Descent', rarity: 'rare', art: 'stat', icon: 'tech-cooldown', desc: 'She comes down again and again.' },
        { id: 'vindicta-07', name: 'Shadow Mark', rarity: 'veryrare', art: 'stat', icon: 'debuff-reducer', desc: 'Marked by her, seen by nobody.' },
        { id: 'vindicta-08', name: 'Ghostwalk', rarity: 'veryrare', art: 'stat', icon: 'status-revealed', desc: 'The edge of the vision of the enemy.' },
        { id: 'vindicta-09', name: 'Assassinate', rarity: 'legendary', art: 'stat', icon: 'damage', desc: 'One strike, one answer.' },
        { id: 'vindicta-10', name: 'Death Mark', rarity: 'legendary', art: 'stat', icon: 'crit-reduction', desc: 'The seal of the pit on the foreheads of the doomed.' },
        { id: 'vindicta-11', name: 'Crimson Contract', rarity: 'contraband', art: 'stat', icon: 'spirit-lifesteal', desc: 'Signed in blood, paid in souls.' },
        { id: 'vindicta-12', name: 'Vindicta herself', rarity: 'contraband', art: 'hero', desc: 'The hero of the shadows. The rarest thing in her case.' }
      ]
    },
    {
      id: 'viscous', name: 'Viscous', hero: 'viscous', slot: 'Spirit', cost: 60,
      tagline: 'The slime that thinks. He walls the lane and waits for you.',
      items: [
        { id: 'viscous-01', name: 'Goo Sample', rarity: 'common', art: 'stat', icon: 'spirit-damage', desc: 'A drop of him, in a jar.' },
        { id: 'viscous-02', name: 'Old Cube', rarity: 'common', art: 'stat', icon: 'max-charges', desc: 'It does not stand up any more.' },
        { id: 'viscous-03', name: 'Splatter', rarity: 'uncommon', art: 'stat', icon: 'spirit', desc: 'The first thing that hits you is the floor.' },
        { id: 'viscous-04', name: 'Puddle', rarity: 'uncommon', art: 'stat', icon: 'move-slow', desc: 'You walk through it. You do not walk fast.' },
        { id: 'viscous-05', name: 'The Cube', rarity: 'rare', art: 'stat', icon: 'tech-duration', desc: 'A wall of him, and it waits for you.' },
        { id: 'viscous-06', name: 'Gas Cloud', rarity: 'rare', art: 'stat', icon: 'tech-range', desc: 'The air around him turns to soup.' },
        { id: 'viscous-07', name: 'Puddle Punch', rarity: 'veryrare', art: 'stat', icon: 'damage', desc: 'He gathers the floor into a fist.' },
        { id: 'viscous-08', name: 'Goop Shield', rarity: 'veryrare', art: 'stat', icon: 'divine-barrier', desc: 'The slime takes the hit instead of you.' },
        { id: 'viscous-09', name: 'Viscous Ball', rarity: 'legendary', art: 'stat', icon: 'cooldown', desc: 'A ball of him, rolling down the lane.' },
        { id: 'viscous-10', name: 'Rejuvenating Aurora', rarity: 'legendary', art: 'stat', icon: 'healing', desc: 'The green light of the pit, over the team.' },
        { id: 'viscous-11', name: 'Living Wall', rarity: 'contraband', art: 'stat', icon: 'status-unstoppable', desc: 'He does not move. He does not have to.' },
        { id: 'viscous-12', name: 'Viscous himself', rarity: 'contraband', art: 'hero', desc: 'The hero of the slime. The rarest thing in his case.' }
      ]
    },
    {
      id: 'abrams', name: 'Abrams', hero: 'abrams', slot: 'Vitality', cost: 70,
      tagline: 'The wall of the lane. He does not dodge, and he does not move.',
      items: [
        { id: 'abrams-01', name: 'Rusty Plate', rarity: 'common', art: 'stat', icon: 'health', desc: 'Bent, but it held once.' },
        { id: 'abrams-02', name: 'Old Shield', rarity: 'common', art: 'stat', icon: 'bullet-armor', desc: 'Scored, not broken.' },
        { id: 'abrams-03', name: 'Sentry Gun', rarity: 'uncommon', art: 'stat', icon: 'fire-rate', desc: 'Two guns, one hero, no cover.' },
        { id: 'abrams-04', name: 'Heavy Slug', rarity: 'uncommon', art: 'stat', icon: 'melee-damage', desc: 'Slow to load, quick to end.' },
        { id: 'abrams-05', name: 'Shoulder Charge', rarity: 'rare', art: 'stat', icon: 'status-stun', desc: 'The hit that takes the turn away.' },
        { id: 'abrams-06', name: 'Kinetic Shield', rarity: 'rare', art: 'stat', icon: 'divine-barrier', desc: 'The barrier that comes up when he swings.' },
        { id: 'abrams-07', name: 'Infernal Resilience', rarity: 'veryrare', art: 'stat', icon: 'status-unstoppable', desc: 'He cannot be stopped while it burns.' },
        { id: 'abrams-08', name: 'Brute', rarity: 'veryrare', art: 'stat', icon: 'damage', desc: 'The size of him is the weapon.' },
        { id: 'abrams-09', name: 'Seismic Impact', rarity: 'legendary', art: 'stat', icon: 'damage-heart', desc: 'The ground gives in first.' },
        { id: 'abrams-10', name: 'Iron Will', rarity: 'legendary', art: 'stat', icon: 'spirit-armor', desc: 'The shot that does not get through.' },
        { id: 'abrams-11', name: 'Heavy Melee', rarity: 'contraband', art: 'stat', icon: 'clip-size', desc: 'The whole magazine of the fist.' },
        { id: 'abrams-12', name: 'Abrams himself', rarity: 'contraband', art: 'hero', desc: 'The hero of the wall. The rarest thing in his case.' }
      ]
    },
    {
      id: 'dynamo', name: 'Dynamo', hero: 'dynamo', slot: 'Spirit', cost: 80,
      tagline: 'The coil of the lane. He pulls the fight into himself.',
      items: [
        { id: 'dynamo-01', name: 'Spark Plug', rarity: 'common', art: 'stat', icon: 'tech-duration', desc: 'Old, and it still fires.' },
        { id: 'dynamo-02', name: 'Old Coil', rarity: 'common', art: 'stat', icon: 'cooldown', desc: 'Wound by hand, once.' },
        { id: 'dynamo-03', name: 'Kinetic Pulse', rarity: 'uncommon', art: 'stat', icon: 'spirit', desc: 'The pulse that comes off him in waves.' },
        { id: 'dynamo-04', name: 'Static Field', rarity: 'uncommon', art: 'stat', icon: 'tech-range', desc: 'The air around him stands up.' },
        { id: 'dynamo-05', name: 'Quantum Entanglement', rarity: 'rare', art: 'stat', icon: 'tech-cooldown', desc: 'Two of him, one of them busy.' },
        { id: 'dynamo-06', name: 'Arc Jump', rarity: 'rare', art: 'stat', icon: 'move-speed', desc: 'He leaves, and he is already there.' },
        { id: 'dynamo-07', name: 'Rejuvenating Aurora', rarity: 'veryrare', art: 'stat', icon: 'healing', desc: 'The green light of the pit, over the team.' },
        { id: 'dynamo-08', name: 'Phase Field', rarity: 'veryrare', art: 'stat', icon: 'status-revealed', desc: 'He is there. You cannot see where.' },
        { id: 'dynamo-09', name: 'Singularity', rarity: 'legendary', art: 'stat', icon: 'max-charges', desc: 'Everything goes into the coil.' },
        { id: 'dynamo-10', name: 'Magnet', rarity: 'legendary', art: 'stat', icon: 'springy-boots', desc: 'The boots that cannot stand still.' },
        { id: 'dynamo-11', name: 'Overcharged', rarity: 'contraband', art: 'stat', icon: 'spirit-damage', desc: 'The coil past what it was built for.' },
        { id: 'dynamo-12', name: 'Dynamo himself', rarity: 'contraband', art: 'hero', desc: 'The hero of the coil. The rarest thing in his case.' }
      ]
    }
  ]
};
