/**
 * Island dialogue, part B: the tavern yard (Sir Aldous, Mirren, the two goblins, Mother Marrow at her cauldron behind
 * it), Goldgrin by the spawn road, Grumble's mushroom tavern, Grub on the village street, Old Moss on the stream bank
 * and the rose garden (Sir Corvin and Elowen). Pure data for the Mind (src/game/Mind.ts); nothing here may import
 * three.js or the DOM.
 *
 * The 'rose' side quest: none → active (Corvin asks the hero to speak for him) → worthy (set by the quest graph once
 * three bosses are slain: a Cond cannot count bosses) → done (Elowen says yes).
 */
import type { DialogueBook, NpcDialogue } from './types';

// Mother Marrow: every deed is an ingredient, and the pot is never full.
const COOK: NpcDialogue = {
  persona: {
    id: 'cook', district: 'island', knows: ['sunken', 'galaxy'], rumourDelay: 150, tone: 'grim',
    gag: 'Everything you do is weighed as an ingredient; the pot smells you coming.',
    about: "A skeleton witch in a chef's hat who stirs a green cauldron on the shore behind the tavern and buys whatever the fog drops, by weight.",
  },
  lines: [
    { id: 'cook.greet.first', slot: 'greet', text: 'Stand downwind. The pot can smell a new one.', when: { metMax: 0 }, once: true },
    { id: 'cook.greet.again', slot: 'greet', text: 'Again. Empty-handed, or only mostly?', when: { metMin: 1, metMax: 2 } },
    { id: 'cook.greet.regular', slot: 'greet', text: 'You again. The pot has started expecting you. That is not a compliment.', when: { metMin: 3 } },
    { id: 'cook.greet.knight', slot: 'greet', text: 'Sir Aldric. Your cup is purple and my pot is green. Keep them apart.', when: { hero: 'knight', metMin: 1 } },
    { id: 'cook.greet.wizard', slot: 'greet', text: 'A floating wizard. Good. Nothing of yours drips in the pot.', when: { hero: 'wizard', metMin: 1 } },

    { id: 'cook.react.golem', slot: 'react', text: 'You broke a crystal golem in the dunes. The core thickens a stew. Bring it; I pay by the weight, not the glitter.', when: { event: 'kill', enemy: 'crystalgolem' } },
    { id: 'cook.react.croc', slot: 'react', text: 'A crocodile at the river mouth. Mire hide goes two ways: stewed, or sold to me and stewed.', when: { event: 'kill', enemy: 'croc' } },
    { id: 'cook.react.cyclops', slot: 'react', text: 'The Cyclops that waded the eye. An eye that size does not fit the pot. I measured, years ago, with a spoon.', when: { event: 'kill', enemy: 'cyclops' } },
    { id: 'cook.react.warden', slot: 'react', text: 'The Antlered Warden, in the rain. Antler boils to glue. The King wants it back; the King is not the one with a pot.', when: { event: 'kill', enemy: 'warden' } },
    { id: 'cook.react.skeleton', slot: 'react', text: 'The campfire three. I knew them. Their kettle was never on anything. Bring the bone; it still has a warm side.', when: { event: 'kill', enemy: 'skeleton' } },
    { id: 'cook.react.boss', slot: 'react', text: '{lastBoss}. The pot heard before I did. It went quiet, which for the pot is a toast.', when: { event: 'kill', boss: true } },
    { id: 'cook.react.hurt', slot: 'react', text: 'You are bleeding into my sand. Rot salve, thirty shards. It smells like the pot and works like the pot.', when: { event: 'hurt' } },
    { id: 'cook.react.down', slot: 'react', text: 'You lay down out there, I hear. Thirty shards of salve would have been cheaper than the lying down.', when: { event: 'down' } },
    { id: 'cook.react.swim', slot: 'react', text: 'You swam past the cauldron. Whatever you swallowed out there, it was not soup.', when: { event: 'feat', feat: 'swim' } },
    { id: 'cook.react.sip', slot: 'react', text: 'Sipping on my shore. Purple. I would ask what is in it, but I never ask the pot either.', when: { event: 'feat', feat: 'sip' } },
    { id: 'cook.react.chest', slot: 'react', text: 'You opened a chest. If there was a spoon in it, the spoon is mine.', when: { event: 'feat', feat: 'chest' } },
    { id: 'cook.react.wizard', slot: 'react', text: 'The wizard again, hovering. The last thing that hovered over my pot was steam, and I ate that.', when: { event: 'hero', hero: 'wizard' } },
    { id: 'cook.react.archer', slot: 'react', text: 'The archer. She rode her bow over the water. Fish do not look up; that is their one mercy.', when: { event: 'hero', hero: 'archer' } },
    { id: 'cook.react.fishguard', slot: 'react', text: 'They say you cut down a Fishguard under the lake. Fish in armour. I never get those; the armour is the best part.', when: { event: 'kill', enemy: 'fish-guard' } },
    { id: 'cook.react.ghoul', slot: 'react', text: 'Word down the shore: you spilled a ghoul in the kingdom. Styrofoam does not render. I have tried.', when: { event: 'kill', enemy: 'styro-ghoul' } },
    { id: 'cook.react.ale', slot: 'react', text: "The rowers' beer, brewed under a bench. I brew under the sky, and I am the one people cross the road for.", when: { flag: 'ale' } },

    {
      id: 'cook.topic.pot', slot: 'topic', text: "What is in the pot? The sea. A castle's worth of guests, once. Whatever you sell me. Stir it widdershins or it stirs you.",
      choices: [{ label: 'What do you buy?', to: 'cook.topic.buy' }, { label: 'Leave it.', action: 'close' }],
    },
    { id: 'cook.topic.buy', slot: 'topic', text: 'Anything the fog drops. Fangs, hides, cores, horns. The pot is not fussy. I am, about the price.' },
    { id: 'cook.topic.castle', slot: 'topic', text: 'A castle stood on a rock out there. I cooked for them once; they did not come back for seconds. You cannot see it from here. Take my word; it is all I give.' },
    { id: 'cook.topic.salve', slot: 'topic', text: 'Rot salve. Nine hundred of blood back for thirty shards. It smells like the pot. It works like the pot. Those are the same sentence.' },

    { id: 'cook.bye.sand', slot: 'bye', text: 'Mind the sand. It is mostly bones.' },
    { id: 'cook.bye.busy', slot: 'bye', text: 'Go. The pot and I were in the middle of something.' },
    { id: 'cook.bye.spine', slot: 'bye', text: 'Bring me something with a spine next time.' },

    { id: 'cook.bark.stir', slot: 'bark', text: 'Stir, stir.' },
    { id: 'cook.bark.downwind', slot: 'bark', text: 'Downwind, if you please.' },
    { id: 'cook.bark.name', slot: 'bark', text: 'Something in the pot just said your name.', when: { event: 'kill' } },
    { id: 'cook.bark.soup', slot: 'bark', text: 'The sea is only soup nobody tends.' },
    { id: 'cook.bark.hurt', slot: 'bark', text: 'That is seasoning, where you are bleeding.', when: { event: 'hurt' } },
  ],
};

// Sir Aldous: he invoices the world; every event has a rate, and the chair is undefeated.
const ALDOUS: NpcDialogue = {
  persona: {
    id: 'aldous', district: 'island', knows: ['vale', 'galaxy'], rumourDelay: 120, tone: 'warm',
    gag: 'Everything that happens gets a rate; he never leaves the chair.',
    about: 'A knight in the tavern yard with a cold cup, a greatsword and a price for everything, who walks any road for a hundred and twenty shards.',
  },
  lines: [
    { id: 'aldous.greet.first', slot: 'greet', text: 'Sit. The ale is cold, the moon is patient, my rate is a hundred and twenty. One of those is negotiable, and it is not the rate.', when: { metMax: 0 }, once: true },
    { id: 'aldous.greet.again', slot: 'greet', text: 'Back again. Road still there? Good. Same rate for the same road.', when: { metMin: 1, metMax: 2 } },
    { id: 'aldous.greet.regular', slot: 'greet', text: '{met} times now. I should charge you for the chair. I will not. Yet.', when: { metMin: 3 } },
    { id: 'aldous.greet.knight', slot: 'greet', text: 'Another knight with a cup. Keep it. I do not share and I do not judge. Mostly the second one.', when: { hero: 'knight' } },
    { id: 'aldous.greet.archer', slot: 'greet', text: 'The archer. You eat mushrooms off the ground, and I am the one with the questionable habits.', when: { hero: 'archer', metMin: 1 } },

    { id: 'aldous.react.golem', slot: 'react', text: 'A crystal golem in the dunes behind us. Heavy work. I would have charged extra for the sand.', when: { event: 'kill', enemy: 'crystalgolem' } },
    { id: 'aldous.react.cyclops', slot: 'react', text: 'The Cyclops in the eye. I watched it wade past for a year and never once sent it an invoice.', when: { event: 'kill', enemy: 'cyclops' } },
    { id: 'aldous.react.croc', slot: 'react', text: 'Crocodiles at the river mouth. Four shards a tooth, if anyone paid for teeth. Nobody does; I have asked.', when: { event: 'kill', enemy: 'croc' } },
    { id: 'aldous.react.wyrm', slot: 'react', text: 'The Moon Wyrm, off the tower. Fliers are extra. Everyone forgets fliers are extra.', when: { event: 'kill', enemy: 'wyrm' } },
    { id: 'aldous.react.boss', slot: 'react', text: "{lastBoss}, dead. That goes on nobody's bill but yours, and I respect a free job as a rare thing.", when: { event: 'kill', boss: true } },
    { id: 'aldous.react.hurt', slot: 'react', text: 'You are bleeding on the yard. Hire me and you bleed less. Or buy the dew and bleed quietly.', when: { event: 'hurt' } },
    { id: 'aldous.react.down', slot: 'react', text: 'You went down out there. I was here, in the chair, drawing a wage from no one. Think about that.', when: { event: 'down' } },
    { id: 'aldous.react.limp', slot: 'react', text: 'Hooded one, you are limping. Bows are for standing far away. Stand further.', when: { event: 'hurt', hero: 'archer', hurtWithin: 20 } },
    { id: 'aldous.react.sip', slot: 'react', text: 'You sip, I sip. Two knights sipping on a yard. We could rent ourselves out as a painting.', when: { event: 'feat', feat: 'sip' } },
    { id: 'aldous.react.cape', slot: 'react', text: 'Off the cape, over the yard, back down. I do not fly. I invoice people who do.', when: { event: 'feat', feat: 'fly', hero: 'knight' } },
    { id: 'aldous.react.bow', slot: 'react', text: 'Riding the bow again. If it snaps mid-air I am not catching you; it is not in the rate.', when: { event: 'feat', feat: 'fly', hero: 'archer' } },
    { id: 'aldous.react.crit', slot: 'react', text: 'That was a good hit. I felt it from here. The ale did not spill, so it was not that good.', when: { event: 'feat', feat: 'crit' } },
    { id: 'aldous.react.wizard', slot: 'react', text: 'A wizard, floating. I guard roads. What do I do with a man who does not touch them?', when: { event: 'hero', hero: 'wizard' } },
    { id: 'aldous.react.mailknight', slot: 'react', text: 'They say you unhorsed a chain-mail knight on Bucket Street. The kingdom guards a street for free. It shows.', when: { event: 'kill', enemy: 'mail-knight' } },
    { id: 'aldous.react.bucket', slot: 'react', text: 'They say you kicked a bucket in the kingdom. A bucket with teeth. Sounds like a job someone should have paid for.', when: { event: 'kill', enemy: 'bucket' } },
    { id: 'aldous.react.hired', slot: 'react', text: 'You hired someone. Not me. I note it; I do not mind it; I remember it.', when: { flag: 'hired' } },

    { id: 'aldous.topic.rate', slot: 'topic', text: 'A hundred and twenty buys a sword that does not care, fourteen hundred of blood spent on your behalf, and quiet. The fog takes the careless. I am paid.' },
    { id: 'aldous.topic.roads', slot: 'topic', text: 'I have guarded worse roads than yours for less. The road to the head, the road to the frog, the road under the lake. That last one I guard from the chair.' },
    { id: 'aldous.topic.vigil', slot: 'topic', text: 'The Vigil kneels next door and never drinks. I sit here and never kneel. The tavern needs both of us, and only one of us gets paid.' },
    { id: 'aldous.topic.cup', slot: 'topic', text: 'Your cup. Purple. Mine is ale, honest and cold. We can still work together; I am very open-minded for a fee.', when: { hero: 'knight' } },

    { id: 'aldous.bye.road', slot: 'bye', text: 'Go on. The road is still there; I checked.' },
    { id: 'aldous.bye.cup', slot: 'bye', text: 'Leave the cup. A joke. Bring the cup.' },
    { id: 'aldous.bye.golems', slot: 'bye', text: 'Mind the golems in the dunes. Glass, not sand.' },

    { id: 'aldous.bark.rate', slot: 'bark', text: 'Rate is a hundred and twenty.' },
    { id: 'aldous.bark.ale', slot: 'bark', text: 'Cold ale. Patient moon.' },
    { id: 'aldous.bark.kill', slot: 'bark', text: 'Unpaid work. I felt that from here.', when: { event: 'kill' } },
    { id: 'aldous.bark.sit', slot: 'bark', text: 'Sit, or hire me. Either way, sit.' },
    { id: 'aldous.bark.hurt', slot: 'bark', text: 'That would have cost you less with me.', when: { event: 'hurt' } },
  ],
};

// Mirren: everything in threes, and every ruin was a kingdom; buy before it is one again.
const MIRREN: NpcDialogue = {
  persona: {
    id: 'mirren', district: 'island', knows: ['galaxy', 'graveyard', 'dream'], rumourDelay: 180, tone: 'sleepy',
    gag: 'Counts in threes; the ruin is always a little closer.',
    about: 'The wizard of the long night, sat at the tavern yard with a cup and a satchel of dew, charms and star charts, selling to a world expected to end.',
  },
  lines: [
    { id: 'mirren.greet.first', slot: 'greet', text: 'Dew heals. Charms sharpen. Charts remember. Sit, and tell me which one you are missing.', when: { metMax: 0 }, once: true },
    { id: 'mirren.greet.again', slot: 'greet', text: 'Back. The ruin is a little closer than last time. The prices are the same; I am sentimental.', when: { metMin: 1, metMax: 2 } },
    { id: 'mirren.greet.regular', slot: 'greet', text: 'You keep coming back. Either the dew works or the company does. I do not sell the company.', when: { metMin: 3 } },
    { id: 'mirren.greet.wizard', slot: 'greet', text: 'Orlan. The Blue Mountain. I have never seen it, which is how I know it is real. The fake ones are always in view.', when: { hero: 'wizard' } },
    { id: 'mirren.greet.knight', slot: 'greet', text: 'The knight. A cup in one hand, a sword in the other, and you came to buy a third thing. Ambition.', when: { hero: 'knight', metMin: 1 } },

    { id: 'mirren.react.golem', slot: 'react', text: 'A crystal golem, in the dunes. It was a kingdom once. Everything here was. Buy something before you are too.', when: { event: 'kill', enemy: 'crystalgolem' } },
    { id: 'mirren.react.cyclops', slot: 'react', text: 'The Cyclops that waded the eye is dead. The eye will open wider now. It always does when it is lonely.', when: { event: 'kill', enemy: 'cyclops' } },
    { id: 'mirren.react.shade', slot: 'react', text: 'The Horned Shade, in the cathedral. Astral. It will come back as a draught, and draughts are free.', when: { event: 'kill', enemy: 'shade' } },
    { id: 'mirren.react.skeleton', slot: 'react', text: 'The campfire three. A hundred years round a kettle with nothing in it. You ended the meeting.', when: { event: 'kill', enemy: 'skeleton' } },
    { id: 'mirren.react.boss', slot: 'react', text: '{lastBoss}. The stars noticed. They did not care, but they noticed; that is the most they do for anyone.', when: { event: 'kill', boss: true } },
    { id: 'mirren.react.hurt', slot: 'react', text: 'You are hurt. Dew heals. Six hundred. Thirty-five shards. Three facts; pick the one you can afford.', when: { event: 'hurt' } },
    { id: 'mirren.react.down', slot: 'react', text: 'You fell out there. Dew does not work on the lying down. Drink it standing; drink it sooner.', when: { event: 'down' } },
    { id: 'mirren.react.level', slot: 'react', text: 'Stronger. Good. Strength is a ruin that has not happened yet. Charms sharpen it anyway.', when: { event: 'feat', feat: 'levelup' } },
    { id: 'mirren.react.chest', slot: 'react', text: 'A chest. Whatever was in it was in a kingdom once, then in a chest, now in you. Things move downhill.', when: { event: 'feat', feat: 'chest' } },
    { id: 'mirren.react.skyeye', slot: 'react', text: 'You shot a sky eye. They are not eyes. They are not in the sky. Other than that, well shot.', when: { event: 'feat', feat: 'skyeye' } },
    { id: 'mirren.react.wizard', slot: 'react', text: 'A wizard who floats. I sit. Between us, the two ways to avoid the ground, and mine comes with a chair.', when: { event: 'hero', hero: 'wizard' } },
    { id: 'mirren.react.archer', slot: 'react', text: 'The archer. She rode in on a bow. I sell charms, not bows. Mine do not need you to hold on.', when: { event: 'hero', hero: 'archer' } },
    { id: 'mirren.react.ghoul', slot: 'react', text: 'The stars say you dropped a Styro-Ghoul in the kingdom. They say it in purple. I am paraphrasing.', when: { event: 'kill', enemy: 'styro-ghoul' } },
    { id: 'mirren.react.grave', slot: 'react', text: 'Word from the Alley of Graves: risen things, put back. They do not stay. Nothing in an alley stays.', when: { event: 'kill', enemy: 'grave-skeleton' } },
    { id: 'mirren.react.prism', slot: 'react', text: "The Prism Wizard, dead in a frog's dream. I did not know you could die in there. Now I must re-price the charts.", when: { event: 'kill', enemy: 'trip-wizard' } },
    { id: 'mirren.react.licked', slot: 'react', text: 'You licked the frog. Your pupils are the size of the moon. Do not buy anything from me tonight. I have ethics, mostly.', when: { flag: 'licked' } },

    { id: 'mirren.topic.wares', slot: 'topic', text: 'Dew for the blood, charms for the blade, charts for the map. The sword is for people who have run out of the other three.' },
    { id: 'mirren.topic.stars', slot: 'topic', text: 'The stars are not above us. They are behind the fog, the fog is behind the ruins, the ruins are behind the next kingdom. A chart knows the order.' },
    { id: 'mirren.topic.ruin', slot: 'topic', text: 'Every ruin here was a kingdom. The arches, the nave, the castle on the plateau. The tavern is not a ruin yet. I sit here to watch the yet.' },
    { id: 'mirren.topic.chart', slot: 'topic', text: 'Pim draws the charts at his telescope; I sell them. He gets the sky, I get the shards, you get where the great ones sleep. A fair deal, which is rare.' },

    { id: 'mirren.bye.night', slot: 'bye', text: 'Go. The night is long; it is in my title.' },
    { id: 'mirren.bye.back', slot: 'bye', text: 'Buy on the way back. There is always a way back, until there is not.' },
    { id: 'mirren.bye.stars', slot: 'bye', text: 'The stars will keep. They are behind something.' },

    { id: 'mirren.bark.three', slot: 'bark', text: 'Dew. Charms. Charts.' },
    { id: 'mirren.bark.ruin', slot: 'bark', text: 'The ruin is closer.' },
    { id: 'mirren.bark.kill', slot: 'bark', text: 'A kingdom, once. Now a sale.', when: { event: 'kill' } },
    { id: 'mirren.bark.sit', slot: 'bark', text: 'Sit. The night is long.' },
    { id: 'mirren.bark.hurt', slot: 'bark', text: 'Dew heals. Thirty-five.', when: { event: 'hurt' } },
  ],
};

// Snik: everything is his, including your kills. The one manic voice on the island; he may shout.
const SNIK: NpcDialogue = {
  persona: {
    id: 'gob-a', district: 'island', knows: ['vale', 'galaxy'], rumourDelay: 90, tone: 'manic',
    gag: 'Claims every deed, cup, chair and moon as his own.',
    about: 'A goblin at the tavern yard with a cup he did not pay for, who claims every deed within earshot as his own.',
  },
  lines: [
    { id: 'gob-a.greet.first', slot: 'greet', text: 'Grk. Mine. The cup, the chair, the moon. You? Not yet.', when: { metMax: 0 }, once: true },
    { id: 'gob-a.greet.again', slot: 'greet', text: "You again! Snik remembers. Snik remembers everything that is Snik's. You are on the list now.", when: { metMin: 1, metMax: 2 } },
    { id: 'gob-a.greet.regular', slot: 'greet', text: 'Back, back. Sit. Not that chair. All chairs mine. Sit on the ground; ground is also mine, is fine.', when: { metMin: 3 } },
    { id: 'gob-a.greet.knight', slot: 'greet', text: 'Knight with cup! Purple cup! Snik had purple cup once. Was this one. Give it back.', when: { hero: 'knight' } },
    { id: 'gob-a.greet.archer', slot: 'greet', text: 'Bow girl! Eats mushrooms! Snik eats mushrooms too, when nobody looks, which is never. Vrak always looks.', when: { hero: 'archer' } },

    { id: 'gob-a.react.golem', slot: 'react', text: "You broke glass man in the sand! Snik's glass man. Snik was going to break him Tuesday.", when: { event: 'kill', enemy: 'crystalgolem' } },
    { id: 'gob-a.react.cyclops', slot: 'react', text: 'Big eye in the pond, dead! Snik did that. Snik was here, but Snik did that. In spirit.', when: { event: 'kill', enemy: 'cyclops' } },
    { id: 'gob-a.react.croc', slot: 'react', text: "Crocodile at the river! Snik's crocodile. Was going to be boots. Now is your boots. Thief.", when: { event: 'kill', enemy: 'croc' } },
    { id: 'gob-a.react.skeleton', slot: 'react', text: "Bone men at the fire. They owed Snik a kettle. Now kettle is nobody's. Which is Snik's.", when: { event: 'kill', enemy: 'skeleton' } },
    { id: 'gob-a.react.boss', slot: 'react', text: "{lastBoss}! Dead! Snik's kill, your sword. Is a partnership. Snik takes sixty.", when: { event: 'kill', boss: true } },
    { id: 'gob-a.react.hurt', slot: 'react', text: "Ha! Blood! Not Snik's blood. Snik's blood stays in. Is the secret.", when: { event: 'hurt' } },
    { id: 'gob-a.react.down', slot: 'react', text: 'You fell down out there! Snik saw. Snik laughed. Then Snik felt bad, a little, then laughed.', when: { event: 'down' } },
    { id: 'gob-a.react.sip', slot: 'react', text: 'Sip, sip! One for you, one for Snik? No? Then why two cups? Snik counts cups.', when: { event: 'feat', feat: 'sip' } },
    { id: 'gob-a.react.chest', slot: 'react', text: "Chest! You opened Snik's chest! Everything in a box is Snik's. Is the rule of boxes.", when: { event: 'feat', feat: 'chest' } },
    { id: 'gob-a.react.crit', slot: 'react', text: 'Big hit! Snik taught you that. By watching. From the chair.', when: { event: 'feat', feat: 'crit' } },
    { id: 'gob-a.react.ale', slot: 'react', text: "You drank the rowers' beer! Under the bench! Snik tried, Snik fell in the river. River is also mine now.", when: { event: 'feat', feat: 'ale' } },
    { id: 'gob-a.react.bounce', slot: 'react', text: "You bounced on the mushroom! Snik's mushroom! Snik bounces at night, in secret. Is a private thing.", when: { event: 'feat', feat: 'bounce' } },
    { id: 'gob-a.react.wizard', slot: 'react', text: "Floaty man! Floats over Snik's ground! Ground still mine. Air? Air is mine too, decided just now.", when: { event: 'hero', hero: 'wizard' } },
    { id: 'gob-a.react.knight', slot: 'react', text: 'Cup knight again. Every time, the cup is fuller. Snik has questions and no refills.', when: { event: 'hero', hero: 'knight' } },
    { id: 'gob-a.react.mailknight', slot: 'react', text: "Cousin past the portal says you beat a mail knight on the bucket street! Mail is Snik's. All mail. Even the knight kind.", when: { event: 'kill', enemy: 'mail-knight' } },
    { id: 'gob-a.react.bucket', slot: 'react', text: 'Buckets with teeth, in the kingdom! You kicked one! Snik had a bucket. No teeth. Yours has teeth? Trade.', when: { event: 'kill', enemy: 'bucket' } },

    { id: 'gob-a.topic.arrangement', slot: 'topic', text: 'Knight pays, goblin drinks. Good arrangement. You pay too? No? Then you are also goblin. Welcome.' },
    { id: 'gob-a.topic.vrak', slot: 'topic', text: "Vrak? Vrak hiccups. Three winters. Snik tried fright, Snik tried water, Snik tried upside down. Vrak is Snik's. The hiccups are not." },
    { id: 'gob-a.topic.mine', slot: 'topic', text: 'What is mine? Cup, chair, table, yard, moon, the big fish in the pond, the sad king past the portal. Not the pot. Pot is hers. Snik is not stupid.' },

    { id: 'gob-a.bye.cup', slot: 'bye', text: 'Go! Leave the cup. Just the cup. And the chair.' },
    { id: 'gob-a.bye.next', slot: 'bye', text: "Bye bye. Whatever you kill next is Snik's." },
    { id: 'gob-a.bye.shards', slot: 'bye', text: 'Come back with shards. Shards are mine; you can carry them.' },

    { id: 'gob-a.bark.mine', slot: 'bark', text: 'Mine!' },
    { id: 'gob-a.bark.grk', slot: 'bark', text: 'Grk.' },
    { id: 'gob-a.bark.pays', slot: 'bark', text: 'Knight pays. Snik drinks.' },
    { id: 'gob-a.bark.chair', slot: 'bark', text: 'Not your chair.' },
    { id: 'gob-a.bark.saw', slot: 'bark', text: "Snik saw that! Snik's!", when: { event: 'kill' } },
    { id: 'gob-a.bark.blood', slot: 'bark', text: "Blood! Not Snik's!", when: { event: 'hurt' } },
  ],
};

// Vrak: hiccups only. The count grows with every visit; he never says a word.
const VRAK: NpcDialogue = {
  persona: {
    id: 'gob-b', district: 'island', knows: ['galaxy'], rumourDelay: 240, tone: 'sleepy',
    gag: 'Only hiccups; the count grows every visit, and once he almost says a word.',
    about: 'The other tavern goblin, who has hiccupped for three winters and says nothing else.',
  },
  lines: [
    { id: 'gob-b.greet.one', slot: 'greet', text: '...hic.', when: { metMax: 0 } },
    { id: 'gob-b.greet.two', slot: 'greet', text: '...hic. ...hic.', when: { metMin: 1, metMax: 2 } },
    { id: 'gob-b.greet.four', slot: 'greet', text: 'hic. hic. ...hic. hic.', when: { metMin: 3, metMax: 5 } },
    { id: 'gob-b.greet.seven', slot: 'greet', text: 'hic hic hic. ...hic. hic hic. hic.', when: { metMin: 6, metMax: 9 } },
    { id: 'gob-b.greet.many', slot: 'greet', text: 'hic hic hic hic hic hic hic. ...hic. hic. hic hic hic. ...hic.', when: { metMin: 10 } },

    { id: 'gob-b.react.golem', slot: 'react', text: 'hic. ...hic?', when: { event: 'kill', enemy: 'crystalgolem' } },
    { id: 'gob-b.react.cyclops', slot: 'react', text: '...HIC.', when: { event: 'kill', enemy: 'cyclops' } },
    { id: 'gob-b.react.croc', slot: 'react', text: 'hic-hic.', when: { event: 'kill', enemy: 'croc' } },
    { id: 'gob-b.react.skeleton', slot: 'react', text: '...hic. hic.', when: { event: 'kill', enemy: 'skeleton' } },
    { id: 'gob-b.react.boss', slot: 'react', text: '...HIC. ...hic.', when: { event: 'kill', boss: true } },
    { id: 'gob-b.react.hurt', slot: 'react', text: 'h-hic.', when: { event: 'hurt' } },
    { id: 'gob-b.react.down', slot: 'react', text: '...hic. ... ...hic.', when: { event: 'down' } },
    { id: 'gob-b.react.sip', slot: 'react', text: '...hic?', when: { event: 'feat', feat: 'sip' } },
    { id: 'gob-b.react.crit', slot: 'react', text: 'hic. hic.', when: { event: 'feat', feat: 'crit' } },
    { id: 'gob-b.react.wizard', slot: 'react', text: '...hic. ...hic. hic.', when: { event: 'hero', hero: 'wizard' } },
    { id: 'gob-b.react.archer', slot: 'react', text: 'hic. ...hic.', when: { event: 'hero', hero: 'archer' } },
    { id: 'gob-b.react.ghoul', slot: 'react', text: '...hic. hic. ...hic.', when: { event: 'kill', enemy: 'styro-ghoul' } },
    { id: 'gob-b.react.bucket', slot: 'react', text: 'hic hic.', when: { event: 'kill', enemy: 'bucket' } },
    { id: 'gob-b.react.ale', slot: 'react', text: '...hic. hic hic hic.', when: { event: 'feat', feat: 'ale' } },
    { id: 'gob-b.react.licked', slot: 'react', text: '...hic... ...hic...', when: { flag: 'licked' } },

    {
      id: 'gob-b.topic.cure', slot: 'topic', text: '...hic.',
      choices: [{ label: 'Hold your breath.', to: 'gob-b.topic.held' }, { label: 'Boo.', to: 'gob-b.topic.boo' }, { label: 'Leave him to it.', action: 'close' }],
    },
    { id: 'gob-b.topic.held', slot: 'topic', text: '... ... ... ...hic.' },
    { id: 'gob-b.topic.boo', slot: 'topic', text: 'hic.' },

    { id: 'gob-b.bye.one', slot: 'bye', text: '...hic.' },
    { id: 'gob-b.bye.two', slot: 'bye', text: 'hic. ...hic.' },
    { id: 'gob-b.bye.almost', slot: 'bye', text: '...h— ...hic.', once: true, weight: 3 },

    { id: 'gob-b.bark.one', slot: 'bark', text: 'hic.' },
    { id: 'gob-b.bark.dots', slot: 'bark', text: '...hic.' },
    { id: 'gob-b.bark.two', slot: 'bark', text: 'hic. hic.' },
    { id: 'gob-b.bark.three', slot: 'bark', text: 'hic hic hic.', when: { event: 'kill' } },
  ],
};

// Goldgrin: asks after Young Lean and gets the name slightly wrong every time; at the end he finally says "There he is."
const GOLDGRIN: NpcDialogue = {
  persona: {
    id: 'cup-gnome', district: 'island', knows: ['galaxy', 'treehouse'], rumourDelay: 60, tone: 'warm',
    gag: 'Where is Young Lean? The name slips a little further each visit (met 1, 3, 6); at the ending: "There he is."',
    about: 'A gnome by the spawn road with a gold grill, a gold chain and two purple cups: one for him, one for when Young Lean shows up.',
  },
  lines: [
    { id: 'cup-gnome.greet.first', slot: 'greet', text: 'Where is Young Lean? Tall fella. Sad songs. Big coat. You seen him?', when: { metMax: 0 }, once: true },
    { id: 'cup-gnome.greet.lane', slot: 'greet', text: 'You again. Seen Yung Lane yet? Lane. Lean. The sad one, with the coat.', when: { metMin: 1, metMax: 2 } },
    { id: 'cup-gnome.greet.glean', slot: 'greet', text: 'Any word on Yon Glean? I asked a knight; the knight asked me back. We are both still here.', when: { metMin: 3, metMax: 5 } },
    { id: 'cup-gnome.greet.lien', slot: 'greet', text: 'Jung Lien. No. Yung Leen. No. The one with the throne. You know the one. Where.', when: { metMin: 6 } },
    { id: 'cup-gnome.greet.there', slot: 'greet', text: 'There he is.', when: { quest: ['silence', 'ended'] }, weight: 20 },

    { id: 'cup-gnome.react.skeleton', slot: 'react', text: 'You put out the campfire boys. They never knew where Young Lean was either, but they listened. Listening is rare.', when: { event: 'kill', enemy: 'skeleton' } },
    { id: 'cup-gnome.react.cyclops', slot: 'react', text: 'The big eye in the pond. Dead. Yung Lane did not walk out from behind it. I checked. I keep checking.', when: { event: 'kill', enemy: 'cyclops' } },
    { id: 'cup-gnome.react.lurker', slot: 'react', text: 'The thing in the lily pond. Gone. If he was under there, he can come up now. He was not under there. I hoped.', when: { event: 'kill', enemy: 'lurker' } },
    { id: 'cup-gnome.react.boss', slot: 'react', text: '{lastBoss}. A big one. Was Yon Glean watching? He likes big sad things. He would have liked that.', when: { event: 'kill', boss: true } },
    { id: 'cup-gnome.react.hurt', slot: 'react', text: 'You are bleeding. Have a sip. No, not that cup, that cup is his. This one. No. Also his. I will find a third.', when: { event: 'hurt' } },
    { id: 'cup-gnome.react.down', slot: 'react', text: 'You fell down out there. I did not come. The cup would have spilled, and it is his cup. Sorry. Priorities.', when: { event: 'down' } },
    { id: 'cup-gnome.react.sip', slot: 'react', text: 'You sip like him. Slow, looking at nothing. Are you him? No. He is taller. You are close, though.', when: { event: 'feat', feat: 'sip', hero: 'knight' } },
    { id: 'cup-gnome.react.cape', slot: 'react', text: 'Off the cape and over the road. From up there, did you see a tall sad man? Any tall sad man would do by now.', when: { event: 'feat', feat: 'fly', hero: 'knight' } },
    { id: 'cup-gnome.react.wizard', slot: 'react', text: 'A floating wizard. He floated once, in a song. I think. I have not heard the song. I have heard of the song.', when: { event: 'hero', hero: 'wizard' } },
    { id: 'cup-gnome.react.archer', slot: 'react', text: 'The girl with the bow. She rode it over my head. If you ride it past the portal, look for a coat. A big one.', when: { event: 'hero', hero: 'archer' } },
    { id: 'cup-gnome.react.ghoul', slot: 'react', text: 'They say you fought ghouls made of cups past the portal. Cups. He is close, then. Cups mean him.', when: { event: 'kill', enemy: 'styro-ghoul' } },
    { id: 'cup-gnome.react.king', slot: 'react', text: 'Someone beat the king on the porcelain throne, I heard. Was it him? Did you beat him? Did he say anything? About me?', when: { event: 'kill', enemy: 'rift-king' } },
    { id: 'cup-gnome.react.fountain', slot: 'react', text: 'You sipped from the fountains in his kingdom. What does it taste like. Tell me slowly. I have time. I have had time.', when: { flag: 'fountain' } },
    { id: 'cup-gnome.react.chest', slot: 'react', text: 'A chest. Was he in it? No. Too small. He is tall. I keep thinking he will be in things.', when: { event: 'feat', feat: 'chest' } },
    { id: 'cup-gnome.react.crit', slot: 'react', text: 'Good hit. He would have written a song about it. A short one. All of his are short, I am told. I have not heard them.', when: { event: 'feat', feat: 'crit' } },
    { id: 'cup-gnome.react.licked', slot: 'react', text: 'Your eyes. You licked the frog. Did you see him in there? People see things in there. Did you see a coat?', when: { flag: 'licked' } },

    { id: 'cup-gnome.topic.cups', slot: 'topic', text: 'Two cups. One for me, one for when he shows up. His has been full three winters. It does not go off. I checked. I check a lot.' },
    { id: 'cup-gnome.topic.brother', slot: 'topic', text: 'My brother Glintgrin lives in the tree house with the round door. He got the teeth; I got the cup. He wants a signed cup. I want the man. Fair split.' },
    { id: 'cup-gnome.topic.who', slot: 'topic', text: 'Tall. Sad songs. Big coat. Sits on a throne past the portal that is white and cracks. That is all I know, and I have known it three winters.' },
    { id: 'cup-gnome.topic.signed', slot: 'topic', text: 'That cup. His name is on it. In purple. He touched that cup. Hold it up. Higher. Thank you. You can go now.', when: { item: 'signed-cup' }, weight: 4 },

    { id: 'cup-gnome.bye.say', slot: 'bye', text: 'If you see him, say Goldgrin. He will not know it. Say it anyway.' },
    { id: 'cup-gnome.bye.here', slot: 'bye', text: 'Go on. I will be here. I am very good at being here.' },
    { id: 'cup-gnome.bye.word', slot: 'bye', text: 'Young... Lean. Lean. I have said it so often it has stopped being a word. Go. Find the word.', when: { metMin: 10 }, weight: 2 },

    { id: 'cup-gnome.bark.where', slot: 'bark', text: 'Where is Young Lean?' },
    { id: 'cup-gnome.bark.cups', slot: 'bark', text: 'Two cups. One is his.' },
    { id: 'cup-gnome.bark.tall', slot: 'bark', text: 'Tall fella. Sad songs.' },
    { id: 'cup-gnome.bark.coat', slot: 'bark', text: 'Big coat. See one from up there?', when: { event: 'feat', feat: 'fly' } },
    { id: 'cup-gnome.bark.there', slot: 'bark', text: 'There he is.', when: { quest: ['silence', 'ended'] }, weight: 20 },
  ],
};

// Grumble: lift him and he bites; the table was his before it was a table.
const GRUMBLE: NpcDialogue = {
  persona: {
    id: 'grumble', district: 'island', knows: ['dream', 'sunken'], rumourDelay: 120, tone: 'grim',
    gag: 'One bite per lift; nothing goes on the table.',
    about: 'An angry gnome in a red hat who guards one table in the mushroom-lamp tavern between the frog hollow and the pond, selling tea to people he would rather not see.',
  },
  lines: [
    { id: 'grumble.greet.first', slot: 'greet', text: 'Off my table. You are not on it; that is the only reason we are talking.', when: { metMax: 0 }, once: true },
    { id: 'grumble.greet.again', slot: 'greet', text: 'You. Hands where I can see them. At your sides. Not under my arms.', when: { metMin: 1, metMax: 2 } },
    { id: 'grumble.greet.regular', slot: 'greet', text: '{met} times. I have bitten people for less. I have bitten people for nothing. I am very fair that way.', when: { metMin: 3 } },
    { id: 'grumble.greet.wizard', slot: 'greet', text: 'A wizard who floats. Good. Floating things do not lift gnomes. Stay up there.', when: { hero: 'wizard' } },
    { id: 'grumble.greet.knight', slot: 'greet', text: 'Sir Aldric. Keep the cup or put it down, but not on the table. Nothing goes on the table.', when: { hero: 'knight', metMin: 1 } },

    { id: 'grumble.react.lurker', slot: 'react', text: 'The pond thing, dead. It never once touched my table. You have, twice. I keep a list.', when: { event: 'kill', enemy: 'lurker' } },
    { id: 'grumble.react.bloodeye', slot: 'react', text: 'The eye over the chasm. Dead. It watched this tavern for years and never once ordered. Good riddance.', when: { event: 'kill', enemy: 'blood-eye' } },
    { id: 'grumble.react.cyclops', slot: 'react', text: 'The Cyclops in the eye. I felt the stomp through the table. It is my table, so I felt it personally.', when: { event: 'kill', enemy: 'cyclops' } },
    { id: 'grumble.react.rivershade', slot: 'react', text: 'The thing in the witch stream. Gone. The troll will be glad. He fishes; I guard. We understand each other, at a distance.', when: { event: 'kill', enemy: 'rivershade' } },
    { id: 'grumble.react.boss', slot: 'react', text: '{lastBoss}. A big thing dies and little people come to drink about it. Not on the table.', when: { event: 'kill', boss: true } },
    { id: 'grumble.react.hurt', slot: 'react', text: 'Bleeding near the tables. Lotus tea, twenty-eight. It steadies the hand that is going to lift me; that is the price of knowing it.', when: { event: 'hurt' } },
    { id: 'grumble.react.down', slot: 'react', text: 'You went down out there. I did not. I am four feet of not going down. Tea. Twenty-eight.', when: { event: 'down' } },
    { id: 'grumble.react.bounce', slot: 'react', text: 'You bounced on a mushroom. The lamps are mushrooms. Bounce on one of those and I bite you in the air.', when: { event: 'feat', feat: 'bounce' } },
    { id: 'grumble.react.lick', slot: 'react', text: 'You licked the Frog King next door. Your eyes are the size of lamps. Do not look at my table; it will look back.', when: { event: 'feat', feat: 'lick' } },
    { id: 'grumble.react.chest', slot: 'react', text: 'A chest. You lifted its lid. I know how it feels. Everything in this valley gets lifted but me, if I can help it.', when: { event: 'feat', feat: 'chest' } },
    { id: 'grumble.react.crit', slot: 'react', text: 'Hard hit. Good. Hit harder, further from here.', when: { event: 'feat', feat: 'crit' } },
    { id: 'grumble.react.archer', slot: 'react', text: 'The girl who rides a bow and eats mushrooms off the ground. The lamps are mushrooms. Eat a lamp and we are done.', when: { event: 'hero', hero: 'archer' } },
    { id: 'grumble.react.wizard', slot: 'react', text: 'Orlan. Floating again. Everyone who floats thinks they are above biting. Nobody is above biting.', when: { event: 'hero', hero: 'wizard' } },
    { id: 'grumble.react.prism', slot: 'react', text: "They say you killed a wizard inside the frog's dream. Next door. I heard it through the floor, which is the ground, which is mine.", when: { event: 'kill', enemy: 'trip-wizard' } },
    { id: 'grumble.react.froggod', slot: 'react', text: 'The Frog God, dead in the dream. Word came up through the hollow. The frog is very calm about it. Too calm.', when: { event: 'kill', enemy: 'dmt-entity' } },
    { id: 'grumble.react.fishguard', slot: 'react', text: 'Down the whirlpool, I hear, you cut up fish in armour. Everything down there is wet. Do not bring it to my table.', when: { event: 'kill', enemy: 'fish-guard' } },

    { id: 'grumble.topic.table', slot: 'topic', text: 'I was here before the table. Then they built the table around where I stood. Now it is my table. That is how property works, whatever the King says.' },
    { id: 'grumble.topic.lamps', slot: 'topic', text: 'The lamps are mushrooms. The mushrooms are lamps. Nobody asks which came first. The one time someone did, I bit him, so we may never know.' },
    { id: 'grumble.topic.tea', slot: 'topic', text: 'Lotus tea steadies the blade hand. Moon dew puts the blood back. Buy, drink, leave. In that order, and not on the table.' },
    { id: 'grumble.topic.bite', slot: 'topic', text: 'Lift me again and I bite. It is not a threat. It is a schedule.' },

    { id: 'grumble.bye.hands', slot: 'bye', text: 'Go. Watch your hands.' },
    { id: 'grumble.bye.lamps', slot: 'bye', text: 'Out. The lamps do not like you either.' },
    { id: 'grumble.bye.rate', slot: 'bye', text: 'One bite per lift. Remember it.' },

    { id: 'grumble.bark.off', slot: 'bark', text: 'Off the table.' },
    { id: 'grumble.bark.hands', slot: 'bark', text: 'Hands.' },
    { id: 'grumble.bark.bite', slot: 'bark', text: 'I bite.' },
    { id: 'grumble.bark.before', slot: 'bark', text: 'Mine before it was a table.' },
    { id: 'grumble.bark.kill', slot: 'bark', text: 'Not on the table, whatever that was.', when: { event: 'kill' } },
  ],
};

// Grub: logs and soup are the only two things in the world; everything else is one or the other.
const GRUB: NpcDialogue = {
  persona: {
    id: 'grub', district: 'island', knows: ['graveyard', 'vale'], rumourDelay: 100, tone: 'warm',
    gag: 'Sorts the whole world into logs and soup.',
    about: 'The ogre who hauls logs up and down the village street for soup, and sorts everything he meets into logs or soup.',
  },
  lines: [
    { id: 'grub.greet.first', slot: 'greet', text: 'Logs. Heavy. Grub carry. You small. You not carry. Is fine.', when: { metMax: 0 }, once: true },
    { id: 'grub.greet.again', slot: 'greet', text: 'Small one again. Grub still carry. Logs do not carry themselves. Grub asked.', when: { metMin: 1, metMax: 2 } },
    { id: 'grub.greet.regular', slot: 'greet', text: '{met} times small one come. Grub count on logs. Logs run out before you do.', when: { metMin: 3 } },
    { id: 'grub.greet.knight', slot: 'greet', text: 'Cup knight. Cup is soup? No? Then cup is logs. Everything is one of two.', when: { hero: 'knight' } },
    { id: 'grub.greet.archer', slot: 'greet', text: 'Bow girl eats mushrooms. Mushroom is soup. Grub approve.', when: { hero: 'archer' } },

    { id: 'grub.react.skeleton', slot: 'react', text: 'Bone men at fire. Gone. They had kettle. No soup in kettle. Grub looked once. Sad kettle.', when: { event: 'kill', enemy: 'skeleton' } },
    { id: 'grub.react.loggiant', slot: 'react', text: 'You hit big one who carries whole forest. Big one carry more than Grub. Big one not get soup. Grub get soup. Grub wins.', when: { event: 'kill', enemy: 'loggiant' } },
    { id: 'grub.react.beast', slot: 'react', text: "Fog dog in west meadow. Dead. Fog dogs chase Grub's logs. Not Grub. Logs. Strange dogs.", when: { event: 'kill', enemy: 'beast' } },
    { id: 'grub.react.spider', slot: 'react', text: 'Church with legs. Dead. Grub always said church should not walk. Nobody listen to Grub. Grub was right.', when: { event: 'kill', enemy: 'spiderchapel' } },
    { id: 'grub.react.boss', slot: 'react', text: '{lastBoss}. Big. Big things fall like logs. Loud, then quiet, then someone carry pieces. Grub carry, if soup.', when: { event: 'kill', boss: true } },
    { id: 'grub.react.hurt', slot: 'react', text: 'Small one bleeding. Village has soup. Soup fix most. Not all. Most.', when: { event: 'hurt' } },
    { id: 'grub.react.down', slot: 'react', text: 'You fell down on the street. Grub stepped over. Logs heavy. Sorry. Grub came back after.', when: { event: 'down' } },
    { id: 'grub.react.fly', slot: 'react', text: 'You fly over Grub. Grub not fly. Logs not fly. Logs and Grub agree on this.', when: { event: 'feat', feat: 'fly' } },
    { id: 'grub.react.climb', slot: 'react', text: 'You climb like squirrel. Squirrels live in logs. Grub likes you more now.', when: { event: 'feat', feat: 'climb' } },
    { id: 'grub.react.sip', slot: 'react', text: 'Cup knight drink purple. Purple soup? Grub tried once. Grub saw colours. Grub stayed with soup.', when: { event: 'feat', feat: 'sip' } },
    { id: 'grub.react.wizard', slot: 'react', text: 'Floating man. Not log, not soup. Grub thinks a long time. Grub decides: soup. Steam floats.', when: { event: 'hero', hero: 'wizard' } },
    { id: 'grub.react.chest', slot: 'react', text: 'Box with things. Grub likes box. Box is logs that learned to close.', when: { event: 'feat', feat: 'chest' } },
    { id: 'grub.react.graveskel', slot: 'react', text: 'Behind the horned door, bone men got up. You put them down, Grub hears. Bones are logs for small fires. Grub does not carry those.', when: { event: 'kill', enemy: 'grave-skeleton' } },
    { id: 'grub.react.cyclopslord', slot: 'react', text: 'Big one-eye at the end of the alley of graves. Dead, Grub hears. One eye. Easy to sneak up on. Grub still would not.', when: { event: 'kill', enemy: 'cyclops-lord' } },
    { id: 'grub.react.level', slot: 'react', text: 'Small one bigger now. Still small. But bigger. Soon carry one log. Small log.', when: { event: 'feat', feat: 'levelup' } },
    { id: 'grub.react.ale', slot: 'react', text: "You drink the rowers' beer. Beer is soup that forgot the vegetables.", when: { flag: 'ale' } },

    { id: 'grub.topic.soup', slot: 'topic', text: 'Village pays Grub in soup. Good soup. Onion, bone, sometimes the bone is a friend. Grub does not ask.' },
    { id: 'grub.topic.logs', slot: 'topic', text: 'Logs come from west woods, go to village, go back? No. New logs. Grub carry forever. Is a job. Jobs are logs with soup at the end.' },
    { id: 'grub.topic.lantern', slot: 'topic', text: 'Lantern man walks same street. Says castle burns across the water. Grub looked. Grub saw water. Lantern man says that is the point. Grub has no points.' },
    { id: 'grub.topic.church', slot: 'topic', text: 'Church at end of street has horns. Door glows. Grub does not go in. Things with horns, Grub leaves. Logs do not have horns. Mostly.' },

    { id: 'grub.bye.carry', slot: 'bye', text: 'Grub carry now. Bye, small one.' },
    { id: 'grub.bye.soup', slot: 'bye', text: 'Go find soup.' },
    { id: 'grub.bye.same', slot: 'bye', text: 'Logs. Grub. Street. Same tomorrow.' },

    { id: 'grub.bark.heavy', slot: 'bark', text: 'Heavy.' },
    { id: 'grub.bark.logs', slot: 'bark', text: 'Logs.' },
    { id: 'grub.bark.carry', slot: 'bark', text: 'Grub carry.' },
    { id: 'grub.bark.hurt', slot: 'bark', text: 'Small one hurt? Soup later.', when: { event: 'hurt' } },
    { id: 'grub.bark.fly', slot: 'bark', text: 'Fly, fly. Logs stay.', when: { event: 'feat', feat: 'fly' } },
    { id: 'grub.bark.kill', slot: 'bark', text: 'Fell like log. Good.', when: { event: 'kill' } },
  ],
};

// Old Moss: three winters on one rock; nothing is worth standing up for, including the thing that rises beside him.
const MOSS: NpcDialogue = {
  persona: {
    id: 'moss', district: 'island', knows: ['treehouse', 'sunken'], rumourDelay: 240, tone: 'sleepy',
    gag: 'Counts in winters and fish, and never gets up.',
    about: 'A troll who has fished the witch stream from the same rock for three winters, counts in winters and fish, and does not get up.',
  },
  lines: [
    { id: 'moss.greet.first', slot: 'greet', text: 'Sat here three winters. River never stops. Sit, or do not; the fish cannot tell.', when: { metMax: 0 }, once: true },
    { id: 'moss.greet.again', slot: 'greet', text: 'Back. Caught nothing since you left. Caught nothing before, either. Consistent.', when: { metMin: 1, metMax: 2 } },
    { id: 'moss.greet.regular', slot: 'greet', text: '{met} visits. More than the fish. You are winning, if it was a contest. Not a contest. Too much standing.', when: { metMin: 3 } },
    { id: 'moss.greet.archer', slot: 'greet', text: 'Bow girl. Fish do not look up. Could ride that bow over the whole river and not scare one. Thought about this a lot.', when: { hero: 'archer' } },
    { id: 'moss.greet.knight', slot: 'greet', text: 'Cup knight. Sat here three winters and never once needed a cup. River comes to the mouth if you lean.', when: { hero: 'knight', metMin: 1 } },

    { id: 'moss.react.shade', slot: 'react', text: 'Killed the thing that rises out of the river. Right there. Rose every night, arms out. Scared the fish. Not me; I was sat.', when: { event: 'kill', enemy: 'rivershade' } },
    { id: 'moss.react.beast', slot: 'react', text: 'Fog dogs in the meadow behind. Dead. Drank here every night and never once said thanks. Dogs.', when: { event: 'kill', enemy: 'beast' } },
    { id: 'moss.react.loggiant', slot: 'react', text: 'The big one carrying trees. Dead. Walked behind me every day for a winter. Never once asked for a fish. Polite.', when: { event: 'kill', enemy: 'loggiant' } },
    { id: 'moss.react.troll', slot: 'react', text: 'Cousin. In the gorge. You killed cousin. We did not speak. He did not fish. Still. Cousin. Going to sit a while.', when: { event: 'kill', enemy: 'troll' } },
    { id: 'moss.react.boss', slot: 'react', text: '{lastBoss}. Far off. Fish went quiet. Fish go quiet for everything; I use them as a clock.', when: { event: 'kill', boss: true } },
    { id: 'moss.react.hurt', slot: 'react', text: 'Hurt. Sit. Rock is wide. I move over, once. Once is a lot.', when: { event: 'hurt' } },
    { id: 'moss.react.down', slot: 'react', text: 'Fell down out there. Saw a bit of it from here. Did not get up. Three winters; the rock has my shape now.', when: { event: 'down' } },
    { id: 'moss.react.swim', slot: 'react', text: 'Swam the river. Right past the line. Caught nothing again. Thank you.', when: { event: 'feat', feat: 'swim' } },
    { id: 'moss.react.bow', slot: 'react', text: 'Rode the bow over the water. Fish did not look up. Told you.', when: { event: 'feat', feat: 'fly', hero: 'archer' } },
    { id: 'moss.react.sip', slot: 'react', text: 'Sipping on the bank. Purple. I drink the river. River glows. Everything glows. Tastes the same.', when: { event: 'feat', feat: 'sip' } },
    { id: 'moss.react.wizard', slot: 'react', text: 'Floating wizard. Does not touch the bank. Does not scare fish. Could stay. Should stay. Will not ask twice.', when: { event: 'hero', hero: 'wizard' } },
    { id: 'moss.react.knight', slot: 'react', text: 'Knight with a cup, sits on a cape. I sit on a rock. Rock is better. Rock does not flap.', when: { event: 'hero', hero: 'knight' } },
    { id: 'moss.react.fishguard', slot: 'react', text: 'Heard it down the river. Fish with armour, under the lake, cut up. Wondered where the big ones went. Now I know. Not happy. Not anything.', when: { event: 'kill', enemy: 'fish-guard' } },
    { id: 'moss.react.angler', slot: 'react', text: 'Anglers. Under the lake. You killed anglers. I am an angler. Going to face the other way a bit.', when: { event: 'kill', enemy: 'angler' } },
    { id: 'moss.react.chest', slot: 'react', text: 'Box on the bank. Opened. Three winters next to it. Never opened. Not worth standing up.', when: { event: 'feat', feat: 'chest' } },
    { id: 'moss.react.ale', slot: 'react', text: "Rowers' beer. Under the bench. Had one, winter two. Rowed nowhere all night. Good beer.", when: { flag: 'ale' } },

    { id: 'moss.topic.fish', slot: 'topic', text: 'Fish glow here. Everything glows here. Tastes the same. Four caught in three winters. Ate two. Named two; threw those back. Names make it hard.' },
    { id: 'moss.topic.rock', slot: 'topic', text: 'This rock. Troll shape in it now. When I go, the rock keeps the shape. A grave, a slow one. Slow is good.' },
    { id: 'moss.topic.cousin', slot: 'topic', text: 'Troll in the gorge, under the stone bridge. Cousin. Red eyes. Throws rocks. I sit on rocks. Family is complicated.', when: { bossAlive: 'troll' } },
    { id: 'moss.topic.shade', slot: 'topic', text: 'The thing in the river. Rises at night, arms out, like it wants a hug. Nobody hugs it. Goes back down. I relate.', when: { bossAlive: 'rivershade' } },
    { id: 'moss.topic.upriver', slot: 'topic', text: 'River comes from the tree-house way, past me, under the lake. Everything goes under the lake eventually. Me too. Sitting.' },

    { id: 'moss.bye.quiet', slot: 'bye', text: 'Go. Quietly. Fish.' },
    { id: 'moss.bye.plan', slot: 'bye', text: 'I will be here. Always here. It is the whole plan.' },
    { id: 'moss.bye.fish', slot: 'bye', text: 'Bring a fish if you see one. I have not.' },

    { id: 'moss.bark.sh', slot: 'bark', text: 'Sh. Fish.' },
    { id: 'moss.bark.winters', slot: 'bark', text: 'Three winters.' },
    { id: 'moss.bark.nothing', slot: 'bark', text: 'Still nothing.' },
    { id: 'moss.bark.river', slot: 'bark', text: 'River never stops.' },
    { id: 'moss.bark.kill', slot: 'bark', text: 'Scared the fish, that.', when: { event: 'kill' } },
    { id: 'moss.bark.bite', slot: 'bark', text: '...bite? No.' },
  ],
};

// Sir Corvin: the unanswered proposal. He has held the rose out through everything, and the arm is going.
const CORVIN: NpcDialogue = {
  persona: {
    id: 'rose-knight', district: 'island', knows: ['galaxy'], rumourDelay: 200, tone: 'grim',
    gag: 'The proposal is still unanswered; the arm is fine, then it is not.',
    about: 'A dark-armoured knight who walked through the fog to offer Elowen a red rose, and is still offering it.',
  },
  lines: [
    { id: 'rose-knight.greet.first', slot: 'greet', text: 'Do not speak loudly. She has not said yes yet. She has not said no. I have an arm for each.', when: { metMax: 0 }, once: true },
    { id: 'rose-knight.greet.again', slot: 'greet', text: 'You again. Quietly. Still deciding. The arm is fine.', when: { metMin: 1, metMax: 2, quest: ['rose', ['none', 'active', 'worthy']] } },
    { id: 'rose-knight.greet.regular', slot: 'greet', text: '{met} times you have passed. The arm is not fine. Do not tell her about the arm.', when: { metMin: 3, quest: ['rose', ['none', 'active', 'worthy']] } },
    { id: 'rose-knight.greet.done', slot: 'greet', text: 'She said yes. I heard it. I am going to stay like this a moment longer; it took so long to get here.', when: { quest: ['rose', 'done'] }, weight: 5 },
    { id: 'rose-knight.greet.knight', slot: 'greet', text: 'A knight. Then you know. Hold a thing out long enough and it becomes the whole of you. Yours is a cup. Mine is a rose.', when: { hero: 'knight', metMin: 1 } },

    { id: 'rose-knight.react.cyclops', slot: 'react', text: 'The Cyclops in the eye. I heard it fall from here. She looked up. She has not looked up for me in a winter.', when: { event: 'kill', enemy: 'cyclops' } },
    { id: 'rose-knight.react.lurker', slot: 'react', text: 'The thing in the pond. Dead. It used to watch us from the water. I think it was rooting for me. I had no one else.', when: { event: 'kill', enemy: 'lurker' } },
    { id: 'rose-knight.react.skeleton', slot: 'react', text: 'The campfire three. Dead. They came past once and one of them whistled. I did not turn. The arm.', when: { event: 'kill', enemy: 'skeleton' } },
    { id: 'rose-knight.react.golem', slot: 'react', text: 'A golem in the dunes, shattered. Diamonds, I hear. If one of them was red I did not see it. I cannot turn.', when: { event: 'kill', enemy: 'crystalgolem' } },
    { id: 'rose-knight.react.boss', slot: 'react', text: '{lastBoss}. Another great one. She counts them, you know. She has never said what the number is.', when: { event: 'kill', boss: true } },
    { id: 'rose-knight.react.hurt', slot: 'react', text: 'You are hurt. I would help. I cannot lower the arm. If I lower the arm it has been for nothing.', when: { event: 'hurt' } },
    { id: 'rose-knight.react.down', slot: 'react', text: 'You went down out there, I hear. I have not gone down. I have thought about it. It would be a rest.', when: { event: 'down' } },
    { id: 'rose-knight.react.cape', slot: 'react', text: 'You rose off the cape and came back. I stand here and nothing comes back. Not a complaint. An observation. Quietly.', when: { event: 'feat', feat: 'fly', hero: 'knight' } },
    { id: 'rose-knight.react.bounce', slot: 'react', text: 'You bounced on a mushroom. Joy, I think that was. I remember the shape of it.', when: { event: 'feat', feat: 'bounce' } },
    { id: 'rose-knight.react.crit', slot: 'react', text: 'A hard hit, just now. Deeds. She asked for deeds. Louder than words, I am told; I have been silent a winter.', when: { event: 'feat', feat: 'crit' } },
    { id: 'rose-knight.react.archer', slot: 'react', text: 'The archer. You ride a bow. Bows bend; that is their whole art. I have not bent in a winter. The arm.', when: { event: 'hero', hero: 'archer' } },
    { id: 'rose-knight.react.wizard', slot: 'react', text: 'A wizard who floats. If you could float a rose two paces east I would owe you everything. Do not. It has to be me.', when: { event: 'hero', hero: 'wizard' } },
    { id: 'rose-knight.react.king', slot: 'react', text: 'They say you beat the king on the porcelain throne. Sad songs, that one. I asked him for a love song once, in my head. He did not answer.', when: { event: 'kill', enemy: 'rift-king' } },
    { id: 'rose-knight.react.level', slot: 'react', text: 'Stronger. She counts that too, I think. I count nothing. I hold.', when: { event: 'feat', feat: 'levelup' } },
    { id: 'rose-knight.react.licked', slot: 'react', text: 'Your eyes. You licked the Frog King. Did you see her say yes in there? Do not answer. Quietly.', when: { flag: 'licked' } },
    { id: 'rose-knight.react.chest', slot: 'react', text: 'A chest, opened. Something in it. Nothing in a chest has ever been a yes.', when: { event: 'feat', feat: 'chest' } },

    {
      id: 'rose-knight.topic.ask', slot: 'topic', text: 'She waits for a sign the world is worth the trouble. You kill the great things in it. Tell her. Quietly.',
      when: { quest: ['rose', 'none'] },
      choices: [{ label: "I'll speak for you.", action: 'quest:rose:active', to: 'rose-knight.topic.wait' }, { label: 'Not my business.', action: 'close' }],
    },
    { id: 'rose-knight.topic.wait', slot: 'topic', text: 'Thank you. Do not say I asked; do not mention the arm. Say what you have killed, and how large. She counts the great ones.', when: { quest: ['rose', 'active'] } },
    { id: 'rose-knight.topic.worthy', slot: 'topic', text: 'She looked at you differently just now. Go. Tell her the count. I will be here. I am always here.', when: { quest: ['rose', 'worthy'] }, weight: 3 },
    { id: 'rose-knight.topic.rose', slot: 'topic', text: 'A rose from the Last Garden. Red ones are rare here. You cannot see the garden from anywhere I know; believe me, it is all I ask of anyone.' },
    { id: 'rose-knight.topic.done', slot: 'topic', text: 'She said yes. I am going to lower the arm now. Slowly. If it comes off, say nothing.', when: { quest: ['rose', 'done'] } },

    { id: 'rose-knight.bye.quiet', slot: 'bye', text: 'Quietly, as you go.' },
    { id: 'rose-knight.bye.well', slot: 'bye', text: 'If she asks about me, I am well. The arm is well. Everything is well.' },
    { id: 'rose-knight.bye.large', slot: 'bye', text: 'Go. Kill something large. For me. For her.' },

    { id: 'rose-knight.bark.quiet', slot: 'bark', text: 'Quietly.' },
    { id: 'rose-knight.bark.notyet', slot: 'bark', text: 'Not yet.' },
    { id: 'rose-knight.bark.arm', slot: 'bark', text: 'The arm is fine.' },
    { id: 'rose-knight.bark.counts', slot: 'bark', text: 'She counts. Quietly.', when: { event: 'kill' } },
    { id: 'rose-knight.bark.shh', slot: 'bark', text: 'Shh. She is deciding.' },
  ],
};

// Elowen: the blue ones mean waiting, the red ones mean now; she decides by a stranger's deeds.
const ELOWEN: NpcDialogue = {
  persona: {
    id: 'maiden', district: 'island', knows: ['vale', 'galaxy'], rumourDelay: 160, tone: 'dry',
    gag: 'Blue means waiting, red means now; she keeps a count of the great ones the hero has killed.',
    about: 'The maiden of the flower garden, head bowed to a rose she has not taken, who will answer the knight by what the hero has killed.',
  },
  lines: [
    { id: 'maiden.greet.first', slot: 'greet', text: 'He walked through the fog for this. I am deciding. You may stand there; it does not speed me up.', when: { metMax: 0 }, once: true },
    { id: 'maiden.greet.again', slot: 'greet', text: 'You again. Still deciding. He is still holding. We are all very committed.', when: { metMin: 1, metMax: 2, quest: ['rose', ['none', 'active', 'worthy']] } },
    { id: 'maiden.greet.regular', slot: 'greet', text: '{met} visits. You have spent more time in this garden than he spent asking. Blue flowers, still.', when: { metMin: 3, quest: ['rose', ['none', 'active', 'worthy']] } },
    { id: 'maiden.greet.wizard', slot: 'greet', text: 'A wizard who does not touch the ground. He touches it too much. A middle would be nice.', when: { hero: 'wizard' } },
    { id: 'maiden.greet.done', slot: 'greet', text: 'I said yes. The red ones mean now. It is now. He is still holding the rose; someone should tell him.', when: { quest: ['rose', 'done'] }, weight: 5 },

    { id: 'maiden.react.cyclops', slot: 'react', text: 'The Cyclops in the eye. I heard it. That counts. The great ones count.', when: { event: 'kill', enemy: 'cyclops' } },
    { id: 'maiden.react.lurker', slot: 'react', text: 'The thing in the lily pond. Gone. Another great one. I keep the count. He does not know the number.', when: { event: 'kill', enemy: 'lurker' } },
    { id: 'maiden.react.skeleton', slot: 'react', text: 'The campfire three. Small bones. Those do not count. I am not being cruel; I am being exact.', when: { event: 'kill', enemy: 'skeleton' } },
    { id: 'maiden.react.golem', slot: 'react', text: 'A golem in the dunes. Pretty, dead. It does not count; it is not great, only loud.', when: { event: 'kill', enemy: 'crystalgolem' } },
    { id: 'maiden.react.boss', slot: 'react', text: '{lastBoss}. A great one. The count moves. The blue flowers do not, yet.', when: { event: 'kill', boss: true } },
    { id: 'maiden.react.hurt', slot: 'react', text: 'You are bleeding in the garden. The red ones mean now. Do not add to them.', when: { event: 'hurt' } },
    { id: 'maiden.react.down', slot: 'react', text: 'You fell, out there. He did not move; neither did I. We are each very good at one thing.', when: { event: 'down' } },
    { id: 'maiden.react.bow', slot: 'react', text: 'You rode a bow over the garden. The blue ones looked up. They mean waiting; now they mean waiting, surprised.', when: { event: 'feat', feat: 'fly', hero: 'archer' } },
    { id: 'maiden.react.sip', slot: 'react', text: 'You sip from a cup while he holds a rose. Two men, two hands, two things that do not go down. I notice.', when: { event: 'feat', feat: 'sip', hero: 'knight' } },
    { id: 'maiden.react.crit', slot: 'react', text: 'That was a hard one. Deeds, not words. Words are what he brought. A rose is a word.', when: { event: 'feat', feat: 'crit' } },
    { id: 'maiden.react.archer', slot: 'react', text: 'Wren. A girl who flies and eats mushrooms off the path. If he had offered me a mushroom I would have known what he meant.', when: { event: 'hero', hero: 'archer' } },
    { id: 'maiden.react.knight', slot: 'react', text: 'Sir Aldric. A knight with a cup. He has a rose. Between you there is almost a whole gesture.', when: { event: 'hero', hero: 'knight' } },
    { id: 'maiden.react.king', slot: 'react', text: 'They say you beat the sad king past the portal. Great, I suppose. Sad, certainly. It counts.', when: { event: 'kill', enemy: 'rift-king' } },
    { id: 'maiden.react.bucket', slot: 'react', text: 'Buckets with teeth, in the kingdom. They say you kicked one over. It does not count. It barely stood.', when: { event: 'kill', enemy: 'bucket' } },
    { id: 'maiden.react.level', slot: 'react', text: 'You have grown. Growth is not a deed. It is the receipt for one.', when: { event: 'feat', feat: 'levelup' } },
    { id: 'maiden.react.licked', slot: 'react', text: 'You licked the Frog King. Your eyes are red. Red means now. I will not hold you to it.', when: { flag: 'licked' } },

    {
      id: 'maiden.topic.deeds', slot: 'topic', text: 'He sent you. Of course he did. Tell me, then: what have you killed that was great? Three, and the red ones mean now.',
      when: { quest: ['rose', ['active', 'worthy']] }, weight: 3,
      choices: [
        { label: 'Three of the great ones, at least.', when: { quest: ['rose', 'worthy'] }, action: 'quest:rose:done', to: 'maiden.topic.yes' },
        { label: 'Not three yet.', when: { quest: ['rose', 'active'] }, to: 'maiden.topic.notyet' },
        { label: 'Leave her to decide.', action: 'close' },
      ],
    },
    { id: 'maiden.topic.yes', slot: 'topic', text: 'Yes. There. The red ones mean now. Tell him. He cannot hear from two paces; he has been listening to his arm.', when: { quest: ['rose', 'done'] } },
    { id: 'maiden.topic.notyet', slot: 'topic', text: 'Then the blue ones. Waiting. Come back when the fog has fewer great things in it.', when: { quest: ['rose', 'active'] } },
    { id: 'maiden.topic.flowers', slot: 'topic', text: "The blue ones mean waiting. The red ones mean now. Nobody has planted a colour for 'ask me again next winter'." },
    { id: 'maiden.topic.him', slot: 'topic', text: 'He walked through the fog for this. The fog has things in it. He walked through them. That is the point for him. The arm is the point against.' },

    { id: 'maiden.bye.great', slot: 'bye', text: 'Go. Kill something great.' },
    { id: 'maiden.bye.blue', slot: 'bye', text: 'The blue ones, still. Go.' },
    { id: 'maiden.bye.deciding', slot: 'bye', text: 'If he asks, I am deciding. I will always be deciding until I am not.' },

    { id: 'maiden.bark.deciding', slot: 'bark', text: 'Deciding.' },
    { id: 'maiden.bark.blue', slot: 'bark', text: 'Blue, still.' },
    { id: 'maiden.bark.count', slot: 'bark', text: 'That one counts.', when: { event: 'kill', boss: true } },
    { id: 'maiden.bark.red', slot: 'bark', text: 'Red means now. Not like that.', when: { event: 'hurt' } },
    { id: 'maiden.bark.hear', slot: 'bark', text: 'He says quietly. I hear everything.' },
  ],
};

/** Island, part B: the tavern yard and the shore, the spawn road, the mushroom tavern, the village street, the stream bank, the rose garden. */
export const ISLAND_B: DialogueBook = {
  cook: COOK,
  aldous: ALDOUS,
  mirren: MIRREN,
  'gob-a': SNIK,
  'gob-b': VRAK,
  'cup-gnome': GOLDGRIN,
  grumble: GRUMBLE,
  grub: GRUB,
  moss: MOSS,
  'rose-knight': CORVIN,
  maiden: ELOWEN,
};
