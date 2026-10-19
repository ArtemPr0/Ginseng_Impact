/**
 * The kingdom (Yung Lean's realm: the plaza, the Skeleton Court, Bucket Street and the lean castle, the snow
 * chapel, the sky dock). Fifteen NPCs: personas and lines for the Mind (src/game/Mind.ts). Pure data.
 *
 * Quest flows carried here: 'sound' (Yung Lean: the Bittersweet Blade, the Lost Sound kept, the Signed Cup + 800),
 * 'lean' signed (he signs Glintgrin's cup), the challenge fight ('crown'), 'grave' (the Skeleton King: the Grave
 * Cyclops at the end of the Alley of Graves, 900 shards; the Grave Crown stays with the hero).
 */
import type { DialogueBook } from './types';

export const KINGDOM: DialogueBook = {
  // ---------------------------------------------------------------------------------------------------------------
  // Dunmar, the guard at the door of Yung Lean's hall. He stepped aside once, and has never recovered from it.
  'watcher-knight': {
    persona: {
      id: 'watcher-knight', district: 'galaxy', knows: ['island'], rumourDelay: 120, tone: 'dry',
      gag: "Whatever the hero does, he didn't know they were chill like that; by the end it is his whole vocabulary.",
      about: "The chain-mail guard at the door of Yung Lean's porcelain hall; he keeps the snow out and steps aside for anyone chill enough.",
    },
    lines: [
      { id: 'watcher-knight.greet.first', slot: 'greet', text: "You're in. I stepped aside. I didn't know you were chill like that; I'm still not sure. The step's done, though.", when: { metMax: 0 } },
      { id: 'watcher-knight.greet.again', slot: 'greet', text: "Back. Still chill, apparently. I asked the snow. The snow gets everywhere, so it knows.", when: { metMin: 1, metMax: 2 } },
      { id: 'watcher-knight.greet.regular', slot: 'greet', text: "I've told the whole plaza you're chill like that. The plaza is a ghoul and a whale. The whale nodded.", when: { metMin: 3, metMax: 5 } },
      { id: 'watcher-knight.greet.legend', slot: 'greet', text: "The hall calls you the chill one now. I started it. I regret it. It's stuck, like the snow.", when: { metMin: 6 } },
      { id: 'watcher-knight.greet.wizard', slot: 'greet', text: "The floating one. You never touch the step, so technically you never came in. The King says that's chill.", when: { hero: 'wizard', metMin: 1 } },

      { id: 'watcher-knight.react.ghoul', slot: 'react', text: "A ghoul down on the plaza. Its cup rolled to my step. I'll keep it; the hall is short on cups, somehow.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'watcher-knight.react.mail', slot: 'react', text: "You cut down a mail knight on the street. We trained together. He was never chill like that.", when: { event: 'kill', enemy: 'mail-knight' } },
      { id: 'watcher-knight.react.bucket', slot: 'react', text: "A mimic on the street. It had a face. You hit the face. I'd have hit the bucket; the face is the bit that minds.", when: { event: 'kill', enemy: 'bucket' } },
      { id: 'watcher-knight.react.chucker', slot: 'react', text: "The chucker in the dome stopped throwing cups. I can hear the snow land again. It's a small sound. It's mine.", when: { event: 'kill', enemy: 'lean-chucker' } },
      { id: 'watcher-knight.react.king-down', slot: 'react', text: "You put the King on his own porcelain and he sat back down. I didn't know you were chill like that. Nobody is.", when: { event: 'kill', enemy: 'rift-king' }, weight: 2 },
      { id: 'watcher-knight.react.hurt', slot: 'react', text: "You're bleeding on the step. Left side, please; the porcelain is new on the right.", when: { event: 'hurt' } },
      { id: 'watcher-knight.react.down', slot: 'react', text: "You went down out there. I stayed at the door. We both did our jobs. One of us did it lying down.", when: { event: 'down' } },
      { id: 'watcher-knight.react.fountain', slot: 'react', text: "You sipped the court's fountain and came through my door sideways. The door is narrow. You're not.", when: { event: 'feat', feat: 'fountain' } },
      { id: 'watcher-knight.react.fly', slot: 'react', text: "You flew over my door. The door is the whole point of me. I'll pretend I stepped aside.", when: { event: 'feat', feat: 'fly' } },
      { id: 'watcher-knight.react.carriage', slot: 'react', text: "You drove the Count's carriage. He never asks anyone to. He never asks anyone not to. That's the trick.", when: { event: 'feat', feat: 'carriage' } },
      { id: 'watcher-knight.react.knight', slot: 'react', text: "A knight with a cup, gliding on a cape. In the hall that's a uniform. Outside it's a cry for help.", when: { hero: 'knight' } },
      { id: 'watcher-knight.react.archer', slot: 'react', text: "The girl who rides her bow. The bow stays strung in the hall; the King likes a bit of tension.", when: { hero: 'archer' } },
      { id: 'watcher-knight.react.warden', slot: 'react', text: "They say the antlered giant in the island's river went down. A ghoul told me. Ghouls lie, but not about rivers.", when: { event: 'kill', enemy: 'warden' } },
      { id: 'watcher-knight.react.beasts', slot: 'react', text: "Word from the island: you've been cutting up fog beasts. {kills:beast} of them. The fog will have more. It always has more.", when: { event: 'kill', enemy: 'beast' } },
      { id: 'watcher-knight.react.boss', slot: 'react', text: "{lastBoss} is dead, I'm told. News walks faster than I do. I don't walk. That's the job.", when: { event: 'kill', boss: true } },
      { id: 'watcher-knight.react.levelup', slot: 'react', text: "You look taller. The hall measures everyone at the door. You were shorter. Now you're chill and tall.", when: { event: 'feat', feat: 'levelup' } },

      { id: 'watcher-knight.topic.snow', slot: 'topic', text: "I stand here so the snow stays out. It comes in anyway, in little squares. I count the squares. It's a job." },
      { id: 'watcher-knight.topic.king', slot: 'topic', text: "The King sits in there and is sad. That's a job too. He's better at his than I am at mine." },
      { id: 'watcher-knight.topic.silence', slot: 'topic', text: "The head on the island says our voices were swallowed, you tell me. I'd noticed the quiet. I thought it was the porcelain.", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },
      { id: 'watcher-knight.topic.ended', slot: 'topic', text: "The hall is loud again. The King sang. Everyone cried, in the chill way. I preferred the quiet. Don't tell him.", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'watcher-knight.bye.porcelain', slot: 'bye', text: "Mind the porcelain." },
      { id: 'watcher-knight.bye.here', slot: 'bye', text: "Go on. I'll be here. Being here is the arrangement." },
      { id: 'watcher-knight.bye.step', slot: 'bye', text: "Chill. Mind the step." },

      { id: 'watcher-knight.bark.chill', slot: 'bark', text: "I didn't know you were chill like that.", voice: 'guard-cool' },
      { id: 'watcher-knight.bark.porcelain', slot: 'bark', text: "Mind the porcelain." },
      { id: 'watcher-knight.bark.snow', slot: 'bark', text: "Snow's getting in." },
      { id: 'watcher-knight.bark.still', slot: 'bark', text: "Still chill." },
      { id: 'watcher-knight.bark.step', slot: 'bark', text: "The step's done." },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Sel, the mage at the head of Bucket Street, studying the square snow.
  'watcher-mage': {
    persona: {
      id: 'watcher-mage', district: 'galaxy', knows: ['island', 'sunken'], rumourDelay: 150, tone: 'sleepy',
      about: "A mage who came to study the kingdom's square snow and forgot to leave; she watches Bucket Street from its head and says the purple houses breathe.",
    },
    lines: [
      { id: 'watcher-mage.greet.first', slot: 'greet', text: "Hold still. A flake was going to land where you're standing. Fine. It will find somewhere else. They always do.", when: { metMax: 0 } },
      { id: 'watcher-mage.greet.again', slot: 'greet', text: "You again. The snow has fallen at a slant since you came. I'm not saying it's you. I'm writing it down.", when: { metMin: 1, metMax: 2 } },
      { id: 'watcher-mage.greet.regular', slot: 'greet', text: "Still here. Still watching the houses breathe. Stay long enough and you'll see it. Nobody stays long enough.", when: { metMin: 3 } },
      { id: 'watcher-mage.greet.wizard', slot: 'greet', text: "A wizard who floats. Does it feel like being snow? Don't answer. I've written 'yes'.", when: { hero: 'wizard' } },
      { id: 'watcher-mage.greet.archer', slot: 'greet', text: "You eat the mushrooms, I'm told. The snow here tastes of nothing. I've checked. Twice.", when: { hero: 'archer', metMin: 1 } },

      { id: 'watcher-mage.react.bucket', slot: 'react', text: "That mimic had been grinning at my corner for weeks. Thank you. I'll miss the grin. It was consistent.", when: { event: 'kill', enemy: 'bucket' } },
      { id: 'watcher-mage.react.mail', slot: 'react', text: "A mail knight down on the street. His mail had facets. I was counting them. I'll start again on the next one.", when: { event: 'kill', enemy: 'mail-knight' } },
      { id: 'watcher-mage.react.hollowstaff', slot: 'react', text: "Old Hollowstaff stopped throwing diamonds. The street is quieter and poorer. Both suit it.", when: { event: 'kill', enemy: 'diamond-wizard' } },
      { id: 'watcher-mage.react.ghoul', slot: 'react', text: "The ghoul's cup is still on the cobbles, leaking. Snow is falling into it. I'm calling that research.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'watcher-mage.react.hurt', slot: 'react', text: "You're bleeding in squares. No. That's the snow on you. Still: sit down. The snow is patient. Be patient.", when: { event: 'hurt' } },
      { id: 'watcher-mage.react.down', slot: 'react', text: "You went down by the purple houses. The houses breathed in. I wrote the time. I didn't write why.", when: { event: 'down' } },
      { id: 'watcher-mage.react.carriage', slot: 'react', text: "You drove the Count's carriage past my corner. It took the corner. The Count didn't notice. He never does.", when: { event: 'feat', feat: 'carriage' } },
      { id: 'watcher-mage.react.crit', slot: 'react', text: "That was a hard hit. The snow jumped. I didn't. I've been here too long to jump.", when: { event: 'feat', feat: 'crit' } },
      { id: 'watcher-mage.react.bounce', slot: 'react', text: "You bounced on a mushroom. They're not for bouncing. Nothing here is for what you use it for.", when: { event: 'feat', feat: 'bounce' } },
      { id: 'watcher-mage.react.wizard', slot: 'react', text: "You float. The snow lands on you anyway. Interesting. I'll need you to stay still for a year.", when: { hero: 'wizard' } },
      { id: 'watcher-mage.react.knight', slot: 'react', text: "The knight glides on his cape, and the snow lands in his cup, and he drinks it. I've watched him do it. Research.", when: { hero: 'knight' } },
      { id: 'watcher-mage.react.archer', slot: 'react', text: "The archer on her bow, through the snow. The flakes part for the bow. They don't part for me.", when: { hero: 'archer' } },
      { id: 'watcher-mage.react.cyclops', slot: 'react', text: "They say the cyclops in the island's eye pool went down. I'd have liked to measure it. One eye; easy to measure.", when: { event: 'kill', enemy: 'cyclops' } },
      { id: 'watcher-mage.react.bell', slot: 'react', text: "They say you fished a bell out of the sea castle under the lake. A bell is square snow for the ears. I'd like to hear it.", when: { quest: ['bell', ['found', 'done']] }, weight: 1.5 },
      { id: 'watcher-mage.react.boss', slot: 'react', text: "{lastBoss}. Gone, they say. I don't go there. Here is enough. Here is more than enough; I've measured.", when: { event: 'kill', boss: true } },
      { id: 'watcher-mage.react.levelup', slot: 'react', text: "You've grown. The snow has further to fall to reach your shoulders. It will manage.", when: { event: 'feat', feat: 'levelup' } },

      { id: 'watcher-mage.topic.squares', slot: 'topic', text: "The snow falls in little squares. The sky is porcelain, and it's cracking, and these are the chips. That's one theory. I have three." },
      { id: 'watcher-mage.topic.breathe', slot: 'topic', text: "The purple houses breathe. In when a mimic passes, out when it's gone. You think I'm half asleep. I'm fully patient." },
      { id: 'watcher-mage.topic.silence', slot: 'topic', text: "The kingdom is quiet, the head says. The snow makes no sound either. I came to study it. I think it's studying us.", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },
      { id: 'watcher-mage.topic.ended', slot: 'topic', text: "The sound came back. The snow makes a noise now, landing. A tiny one. I've started again from the beginning.", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'watcher-mage.bye.space', slot: 'bye', text: "Go. The snow needs the space." },
      { id: 'watcher-mage.bye.street', slot: 'bye', text: "Careful on the street. It's slippery and it has opinions." },

      { id: 'watcher-mage.bark.still', slot: 'bark', text: "Hold still." },
      { id: 'watcher-mage.bark.flakes', slot: 'bark', text: "Square flakes." },
      { id: 'watcher-mage.bark.breathe', slot: 'bark', text: "The houses breathe." },
      { id: 'watcher-mage.bark.step', slot: 'bark', text: "Don't step on that one." },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // The Skeleton King on the dragon throne: he counts coins, he pays better than the antlered fool, he wants his
  // Grave Crown back from the cyclops at the end of the Alley of Graves (quest 'grave').
  'skeleton-king': {
    persona: {
      id: 'skeleton-king', district: 'galaxy', knows: ['island', 'graveyard'], rumourDelay: 90, tone: 'dry',
      gag: "He pays better than the antlered fool on the island, and says so whenever money comes up, which is always.",
      about: "The crowned skeleton on the dragon throne at the head of the Skeleton Court, who counts every coin and wants the Grave Crown back from the cyclops.",
    },
    lines: [
      { id: 'skeleton-king.greet.first', slot: 'greet', text: "A visitor with pockets. Sit, stand, kneel; the throne doesn't mind. The ledger does. You're in it now.", when: { metMax: 0 } },
      { id: 'skeleton-king.greet.again', slot: 'greet', text: "Back again. You're carrying {shards} shards. I'm not saying they're mine. I'm saying they were.", when: { metMin: 1, metMax: 2 } },
      { id: 'skeleton-king.greet.regular', slot: 'greet', text: "You again. I stopped counting you. I count everything else; you're the exception, and it bothers me.", when: { metMin: 3 } },
      { id: 'skeleton-king.greet.knight', slot: 'greet', text: "A knight with a cup. The antlered fool would knight you. I'd pay you. Different kingdoms.", when: { hero: 'knight', metMin: 1 } },

      { id: 'skeleton-king.react.galaxy-knight', slot: 'react', text: "You killed a galaxy knight in my treasury. He was guarding it from you. Noted. Nothing is missing; I checked twice.", when: { event: 'kill', enemy: 'galaxy-knight' } },
      { id: 'skeleton-king.react.ghoul', slot: 'react', text: "A ghoul down on the plaza. It owed the court a cup. You've inherited the debt. Congratulations.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'skeleton-king.react.golem', slot: 'react', text: "A crystal golem, broken. The shards are mine. The shards are always mine; look at the floor.", when: { event: 'kill', enemy: 'crystalgolem' } },
      { id: 'skeleton-king.react.chucker', slot: 'react', text: "The chucker in the dome is dead. It threw my cups. I'll bill its estate. It has no estate. I'll bill you less.", when: { event: 'kill', enemy: 'lean-chucker' } },
      { id: 'skeleton-king.react.hurt', slot: 'react', text: "You're bleeding on my court. Blood is free. I'm told it keeps the stones warm. The stones have never said.", when: { event: 'hurt' } },
      { id: 'skeleton-king.react.down', slot: 'react', text: "You went down on my floor. I counted the coins while you lay there. All present. You weren't, for a bit.", when: { event: 'down' } },
      { id: 'skeleton-king.react.fountain', slot: 'react', text: "You sipped from my fountains and the court spun. The fountains are not free. I've opened a tab. It has your name.", when: { event: 'feat', feat: 'fountain' } },
      { id: 'skeleton-king.react.chest', slot: 'react', text: "You opened a chest. Whatever was in it was mine first. Everything was. Keep it; I like being owed.", when: { event: 'feat', feat: 'chest' } },
      { id: 'skeleton-king.react.wizard', slot: 'react', text: "The floating wizard. You never touch my floor, so you can't wear it out. The only guest I'd keep.", when: { hero: 'wizard' } },
      { id: 'skeleton-king.react.archer', slot: 'react', text: "The archer on her bow. Mushrooms, I hear. My court sells potions, not fungus. Grow up, financially.", when: { hero: 'archer' } },
      { id: 'skeleton-king.react.warden', slot: 'react', text: "The antlered fool's warden is dead, I hear. He'll pay you in silence and a ring. I pay in shards. Count them later.", when: { event: 'kill', enemy: 'warden' } },
      { id: 'skeleton-king.react.graves', slot: 'react', text: "You've been putting the Alley's dead back down. They're my subjects, technically. Do go on; they never paid.", when: { event: 'kill', enemy: 'grave-skeleton' } },
      { id: 'skeleton-king.react.boss', slot: 'react', text: "{lastBoss} fell. Whatever it dropped, bring it here first. The antlered fool will only sulk at it.", when: { event: 'kill', boss: true } },
      { id: 'skeleton-king.react.crit', slot: 'react', text: "That was a crit. I felt it through the throne. The throne is a dragon. It noticed too.", when: { event: 'feat', feat: 'crit' } },
      { id: 'skeleton-king.react.levelup', slot: 'react', text: "You've grown. Growing costs nothing. Everything else here does. I'm working on growing.", when: { event: 'feat', feat: 'levelup' } },

      // The quest 'grave': none -> active (here) -> slain (the Grave Cyclops dies) -> done (here, 900 shards).
      { id: 'skeleton-king.topic.grave-ask', slot: 'topic', text: "A cyclops at the end of the Alley of Graves wears a crown that was mine. Kill him. Nine hundred shards, counted, not promised.", when: { quest: ['grave', 'none'] }, weight: 8, choices: [
        { label: "I'll take his head.", action: 'quest:grave:active', to: 'skeleton-king.topic.grave-go' },
        { label: "What does it pay, again?", to: 'skeleton-king.topic.grave-pay' },
        { label: "Not now.", action: 'close' },
      ] },
      { id: 'skeleton-king.topic.grave-pay', slot: 'topic', text: "Nine hundred. The antlered fool pays fifteen for a warden. A warden is a tree. A cyclops throws graves. Do the sum.", when: { quest: ['grave', 'none'] }, choices: [
        { label: "Fine. I'll do it.", action: 'quest:grave:active', to: 'skeleton-king.topic.grave-go' },
        { label: "Not now.", action: 'close' },
      ] },
      { id: 'skeleton-king.topic.grave-go', slot: 'topic', text: "The Alley of Graves. Walk it slowly: the dead get up when you hurry. He's at the end, by the tower, throwing the graves.", when: { quest: ['grave', 'active'] }, choices: [
        { label: "On my way.", action: 'close' },
      ] },
      { id: 'skeleton-king.topic.grave-wait', slot: 'topic', text: "The crown is still on the wrong skull. Mine has the space for it; I've been keeping it clear.", when: { quest: ['grave', 'active'] }, weight: 6 },
      { id: 'skeleton-king.topic.grave-claim', slot: 'topic', text: "He's dead and the crown is on you. Keep it; two crowns on one skull looks desperate. Nine hundred, as counted.", when: { quest: ['grave', 'slain'] }, weight: 10, choices: [
        { label: "Take the shards.", action: 'reward:900', to: 'skeleton-king.topic.grave-paid' },
      ] },
      { id: 'skeleton-king.topic.grave-paid', slot: 'topic', text: "Counted. Tell the antlered fool what I paid. Tell him slowly; he's a tree.", when: { quest: ['grave', 'slain'] }, choices: [
        { label: "I'll tell him.", action: 'quest:grave:done' },
      ] },
      { id: 'skeleton-king.topic.coins', slot: 'topic', text: "Every coin on these stones was paid to cross the portal. Some paid twice. The second time is for the view." },
      { id: 'skeleton-king.topic.rival', slot: 'topic', text: "The antlered fool on the island pays in silence. I pay in shards. Silence is cheaper, and he knows it." },
      { id: 'skeleton-king.topic.trade', slot: 'topic', text: "I buy what the great ones drop. Twice what the antlered fool offers. He hasn't noticed. Don't tell him; I enjoy it." },
      { id: 'skeleton-king.topic.silence', slot: 'topic', text: "The Hollow King swallowed our voices, the head says. He never swallowed my coins. We'll see who's richer at the end.", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },
      { id: 'skeleton-king.topic.ended', slot: 'topic', text: "The sound is back and the court is loud. Every coin rings now. I'd forgotten they rang. I'm counting them again, by ear.", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'skeleton-king.bye.spend', slot: 'bye', text: "Go. Spend. Come back." },
      { id: 'skeleton-king.bye.mist', slot: 'bye', text: "Mind the mist on the floor. It's lean. It's mine." },
      { id: 'skeleton-king.bye.fool', slot: 'bye', text: "Tell the antlered fool I said nothing. He'll know what it means." },

      { id: 'skeleton-king.bark.counted', slot: 'bark', text: "Counted." },
      { id: 'skeleton-king.bark.mine', slot: 'bark', text: "That one's mine." },
      { id: 'skeleton-king.bark.fool', slot: 'bark', text: "The antlered fool pays less." },
      { id: 'skeleton-king.bark.mist', slot: 'bark', text: "Mind the mist." },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // The Star Brewer in the round tower at the corner of Bucket Street: pink potions, a copper kettle, meteors.
  'galaxy-wizard': {
    persona: {
      id: 'galaxy-wizard', district: 'galaxy', knows: ['island', 'dream'], rumourDelay: 200, tone: 'warm',
      about: "The galaxy-robed wizard of the round tower at Bucket Street's corner, who pours pink potions from a copper kettle and waits for a meteor to land.",
    },
    lines: [
      { id: 'galaxy-wizard.greet.first', slot: 'greet', text: "Mind the kettle. It's deciding. Pink means decided, blue means thinking, green means leave the tower.", when: { metMax: 0 } },
      { id: 'galaxy-wizard.greet.again', slot: 'greet', text: "You're back. The potion remembers you. It went a shade pinker when you came up the stair.", when: { metMin: 1, metMax: 2 } },
      { id: 'galaxy-wizard.greet.regular', slot: 'greet', text: "The regular. The kettle starts pouring itself when it hears your boots. I've stopped correcting it.", when: { metMin: 3 } },
      { id: 'galaxy-wizard.greet.wizard', slot: 'greet', text: "A wizard. Blue mountain, floating, a pipe. You brew? No? Then you're half a wizard. Sit. I'll do the other half.", when: { hero: 'wizard' } },
      { id: 'galaxy-wizard.greet.archer', slot: 'greet', text: "You eat your mushrooms raw, I hear. I'd have brewed them. Sit; there's a lot you don't know about mushrooms.", when: { hero: 'archer', metMin: 1 } },

      { id: 'galaxy-wizard.react.bucket', slot: 'react', text: "You broke a mimic on the street. Its crystals were blue. Blue means thinking. It isn't any more.", when: { event: 'kill', enemy: 'bucket' } },
      { id: 'galaxy-wizard.react.mail', slot: 'react', text: "A mail knight down outside my tower. His chain was gold. It's still gold; that's the thing about gold.", when: { event: 'kill', enemy: 'mail-knight' } },
      { id: 'galaxy-wizard.react.hollowstaff', slot: 'react', text: "Hollowstaff is gone. He threw diamonds at my window and I caught them. Free diamonds, for years. Now what.", when: { event: 'kill', enemy: 'diamond-wizard' } },
      { id: 'galaxy-wizard.react.ghoul', slot: 'react', text: "A ghoul fewer. Its cup spilled purple on my step. Purple is the colour of a potion with regrets.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'galaxy-wizard.react.hurt', slot: 'react', text: "You're bleeding on my floor. Red. The colour of a potion that has made up its mind about you.", when: { event: 'hurt' } },
      { id: 'galaxy-wizard.react.down', slot: 'react', text: "You went down on the street and the potion went blue. I didn't know it cared. I didn't know I did.", when: { event: 'down' } },
      { id: 'galaxy-wizard.react.fountain', slot: 'react', text: "You drank from the court's fountain and the city spun. I meant to warn you. I warned the kettle instead.", when: { event: 'feat', feat: 'fountain' } },
      { id: 'galaxy-wizard.react.carriage', slot: 'react', text: "You drove the carriage past my window. The Count waved. The horses, I remind you, left years ago.", when: { event: 'feat', feat: 'carriage' } },
      { id: 'galaxy-wizard.react.levelup', slot: 'react', text: "You've grown. The potion needs a bigger cup. Everything needs a bigger cup, in the end.", when: { event: 'feat', feat: 'levelup' } },
      { id: 'galaxy-wizard.react.wizard', slot: 'react', text: "You float a hand off my floor. That's the potion I've been trying to brew for years. Sit. Don't move. Let me look.", when: { hero: 'wizard' } },
      { id: 'galaxy-wizard.react.knight', slot: 'react', text: "The knight who glides on his cape and drinks from a cup. The cup is the wrong colour for gliding. Give it here.", when: { hero: 'knight' } },
      { id: 'galaxy-wizard.react.archer', slot: 'react', text: "The girl on the bow. There's a brew for people who fly. It's mostly for the landing.", when: { hero: 'archer' } },
      { id: 'galaxy-wizard.react.lick', slot: 'react', text: "They say you licked the Frog King on the island. Professionally, I'm jealous. Personally, also jealous.", when: { event: 'feat', feat: 'lick' } },
      { id: 'galaxy-wizard.react.frog-god', slot: 'react', text: "You killed the Frog God in his own dream, I hear. Pink, I'd bet. Everything in there has decided.", when: { event: 'kill', enemy: 'dmt-entity' } },
      { id: 'galaxy-wizard.react.boss', slot: 'react', text: "{lastBoss} is dead, the meteors say. Meteors don't say anything. I've been up here a long time.", when: { event: 'kill', boss: true } },
      { id: 'galaxy-wizard.react.crit', slot: 'react', text: "A crit. The kettle rattled. It only rattles for love and violence, and it has never seen love.", when: { event: 'feat', feat: 'crit' } },

      { id: 'galaxy-wizard.topic.meteors', slot: 'topic', text: "Meteors fall past my window every night. I stopped wishing years ago. One will land one day. I keep a bowl out." },
      { id: 'galaxy-wizard.topic.pink', slot: 'topic', text: "Pink is the colour of a potion that has made up its mind. Most people never get that far. Most potions don't either." },
      { id: 'galaxy-wizard.topic.trade', slot: 'topic', text: "Lotus tea, thirty shards. It steadies the hand. It does nothing for the head. Nothing here does; that's the charm." },
      { id: 'galaxy-wizard.topic.silence', slot: 'topic', text: "The head says the voices were swallowed. I brewed one once; it hummed in the kettle. Then the kingdom went quiet, and so did it.", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },
      { id: 'galaxy-wizard.topic.ended', slot: 'topic', text: "The sound is back. The kettle hums again. It's humming the song from the plaza. Badly. It's a kettle.", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'galaxy-wizard.bye.kettle', slot: 'bye', text: "Mind the kettle on the way out." },
      { id: 'galaxy-wizard.bye.sulk', slot: 'bye', text: "Go on. The potion will sulk, but it keeps." },

      { id: 'galaxy-wizard.bark.deciding', slot: 'bark', text: "It's deciding." },
      { id: 'galaxy-wizard.bark.pink', slot: 'bark', text: "Pink. Good." },
      { id: 'galaxy-wizard.bark.kettle', slot: 'bark', text: "Don't touch the kettle." },
      { id: 'galaxy-wizard.bark.blue', slot: 'bark', text: "Blue means thinking." },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Yung Lean on the porcelain throne: the 'sound' quest (the Bittersweet Blade, the Lost Sound kept, the Signed
  // Cup and 800), the signing for Glintgrin's 'lean', and the challenge fight ('crown' marks the first win).
  yunglean: {
    persona: {
      id: 'yunglean', district: 'galaxy', knows: ['island', 'treehouse'], rumourDelay: 180, tone: 'sleepy',
      gag: "Everything is bittersweet; he asks for iced tea; he never gets up, except to fight.",
      about: "The sad king on the porcelain throne at the north end of the plaza, who wants the Lost Sound back from the mist and signs any cup because it is all the same cup.",
    },
    lines: [
      { id: 'yunglean.greet.first', slot: 'greet', text: "Welcome to the palace. Keep your boots clean, the porcelain cracks easily... What brings you to the sad side of the world?", when: { metMax: 0 }, voice: 'lean-greet' },
      { id: 'yunglean.greet.again', slot: 'greet', text: "Bittersweet... you came back. Did you bring iced tea? No. Shame. Sit on the step; the throne is taken.", when: { metMin: 1, metMax: 2 } },
      { id: 'yunglean.greet.regular', slot: 'greet', text: "The regular of the sad side. The snow knows your name. I don't. I know your boots.", when: { metMin: 3 } },
      { id: 'yunglean.greet.knight', slot: 'greet', text: "A knight with a cup. You hold it like I hold mine: like it's the last one. It isn't. It never is.", when: { hero: 'knight', metMin: 1 } },
      { id: 'yunglean.greet.wizard', slot: 'greet', text: "The floating one. The porcelain thanks you. I'd float too, if I could be bothered. I can't. That's the sad side.", when: { hero: 'wizard', metMin: 1 } },

      { id: 'yunglean.react.ghoul', slot: 'react', text: "You killed a ghoul on the plaza. They aren't mine. They just stand near me. Everything does, for a while.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'yunglean.react.bubble', slot: 'react', text: "A bubble popped in the cups. I heard it from the throne. A small sound. I'll take any sound.", when: { event: 'kill', enemy: 'lean-bubble' } },
      { id: 'yunglean.react.chucker', slot: 'react', text: "The chucker in the dome stopped throwing cups. It's quieter. I thought I'd like quiet. I was wrong about that too.", when: { event: 'kill', enemy: 'lean-chucker' } },
      { id: 'yunglean.react.beaten', slot: 'react', text: "You put me on the floor. I sat back down. The throne doesn't care who's on it. I do, a little. Bittersweet.", when: { event: 'kill', enemy: 'rift-king' }, weight: 2 },
      { id: 'yunglean.react.hurt', slot: 'react', text: "You're bleeding on the porcelain. It will stain. Everything stains. There's room on the step; sit.", when: { event: 'hurt' } },
      { id: 'yunglean.react.down', slot: 'react', text: "You went down out there. I watched from the throne. I didn't get up. I never get up. That's the sad side.", when: { event: 'down' } },
      { id: 'yunglean.react.fountain', slot: 'react', text: "You sipped the court's fountain. The world spun for you. It spins for me without the fountain. Welcome.", when: { event: 'feat', feat: 'fountain' } },
      { id: 'yunglean.react.sip', slot: 'react', text: "You drink from your cup like it's medicine. It is. It isn't. Both. That's the whole kingdom.", when: { event: 'feat', feat: 'sip' } },
      { id: 'yunglean.react.fly', slot: 'react', text: "You flew over the plaza. Over the whale. The whale has seen stranger. It has seen me on a good day.", when: { event: 'feat', feat: 'fly' } },
      { id: 'yunglean.react.archer', slot: 'react', text: "A girl who rides her bow and eats mushrooms. You'd like the mist. The mist likes everyone; that's its problem.", when: { hero: 'archer' } },
      { id: 'yunglean.react.knight', slot: 'react', text: "The knight glides on a cape. I had a cape. I sat on it. Now it's a cushion. Everything becomes a cushion.", when: { hero: 'knight' } },
      { id: 'yunglean.react.wizard', slot: 'react', text: "You float. The snow goes through you, or round. I've been watching. It's the most that has happened today.", when: { hero: 'wizard' } },
      { id: 'yunglean.react.lick', slot: 'react', text: "They say you licked the Frog King on the island. I've licked a cup. Same thing. Different dream.", when: { event: 'feat', feat: 'lick' } },
      { id: 'yunglean.react.glintgrin', slot: 'react', text: "Goldgrin's brother in the tree house wants my cup signed, I hear. Everyone wants the cup. Nobody wants the hand.", when: { quest: ['lean', 'active'] }, weight: 1.5 },
      { id: 'yunglean.react.boss', slot: 'react', text: "{lastBoss} died. Somewhere. Someone will write a sad song about it. Not me. Probably me.", when: { event: 'kill', boss: true } },
      { id: 'yunglean.react.levelup', slot: 'react', text: "You've grown. I've been the same height since the abyss. The abyss doesn't do growth.", when: { event: 'feat', feat: 'levelup' } },

      // 'sound': none -> active (the blade) -> found (the Lost Sound, picked up on the far cup) -> done (here).
      { id: 'yunglean.topic.sound-why', slot: 'topic', text: "The world is getting quiet, stranger. The silence is creeping into the neon valleys. Take this blade, go into the mist, and bring back the sound.", when: { quest: ['sound', 'none'] }, weight: 8, voice: 'lean-quest', choices: [
        { label: "I'll bring it back.", action: 'quest:sound:active', to: 'yunglean.topic.sound-blade' },
        { label: "Not my problem.", action: 'close' },
      ] },
      { id: 'yunglean.topic.sound-blade', slot: 'topic', text: "Take the blade. It hums when it's quiet; it hasn't stopped humming in a year. The mist is over the cups, east. Don't drink the waves.", when: { quest: ['sound', 'active'] }, choices: [
        { label: "Take the blade.", action: 'give:mist-blade' },
      ] },
      { id: 'yunglean.topic.sound-lost', slot: 'topic', text: "You lost the Bittersweet Blade. Bittersweet. Here's another; there's a drawer. Don't lose the drawer.", when: { quest: ['sound', 'active'], notItem: 'mist-blade' }, weight: 9, choices: [
        { label: "Take the blade.", action: 'give:mist-blade' },
      ] },
      { id: 'yunglean.topic.sound-wait', slot: 'topic', text: "The silence is still creeping. Over the cups, in the mist. The blade hums louder near it. Follow the hum.", when: { quest: ['sound', 'active'], item: 'mist-blade' }, weight: 6 },
      { id: 'yunglean.topic.sound-found', slot: 'topic', text: "You found it. Listen... the snow is singing again. Here. Sign it? Sure. I sign everything. It's all the same cup.", when: { quest: ['sound', 'found'] }, weight: 10, voice: 'lean-sound', choices: [
        { label: "Take the signed cup.", action: 'give:signed-cup', to: 'yunglean.topic.sound-keep' },
      ] },
      { id: 'yunglean.topic.sound-keep', slot: 'topic', text: "Keep the sound. A sound kept is a sound shared. Eight hundred shards for the mist on your boots.", when: { quest: ['sound', 'found'] }, choices: [
        { label: "Take the shards.", action: 'reward:800', to: 'yunglean.topic.sound-done' },
      ] },
      { id: 'yunglean.topic.sound-done', slot: 'topic', text: "Now go. Or stay. The throne is always here. So am I; that's the difference between us and the sound.", when: { quest: ['sound', 'found'] }, choices: [
        { label: "Glintgrin will want this cup.", action: 'quest:sound:done', to: 'yunglean.topic.lean-signed', when: { quest: ['lean', 'active'] } },
        { label: "Thank you.", action: 'quest:sound:done', when: { quest: ['lean', ['none', 'signed', 'done']] } },
      ] },
      { id: 'yunglean.topic.lean-signed', slot: 'topic', text: "Glintgrin. The gnome with the teeth. Tell him the signature is real. Tell him it's all the same cup. He won't listen.", when: { quest: ['lean', 'active'] }, choices: [
        { label: "I'll tell him.", action: 'quest:lean:signed' },
      ] },
      { id: 'yunglean.topic.sign-later', slot: 'topic', text: "Sign a cup? Bring back the sound first. Then I sign anything.", when: { quest: ['lean', 'active'], notItem: 'signed-cup' }, weight: 3 },
      { id: 'yunglean.topic.sign-done', slot: 'topic', text: "I signed it already. Look at the cup. That's me, in purple. Take it to the gnome; tell him it's all the same cup.", when: { quest: ['lean', 'active'], item: 'signed-cup' }, weight: 9, choices: [
        { label: "I'll take it to him.", action: 'quest:lean:signed' },
      ] },
      // The challenge: he gets up from the throne (the Mind runs 'challenge'); the first win pays 600 ('crown').
      { id: 'yunglean.topic.challenge-offer', slot: 'topic', text: "You want the throne? Nobody wants the throne. Say it again and I'll stand up. I haven't stood up in a year.", when: { quest: ['sound', 'done'] }, weight: 2, choices: [
        { label: "I want the throne.", to: 'yunglean.topic.challenge-warlord' },
        { label: "I just wanted to sit.", action: 'close' },
      ] },
      { id: 'yunglean.topic.challenge-again', slot: 'topic', text: "Again? You borrowed the moment once. Borrow it again; I've nothing else to lend.", when: { quest: ['crown', 'done'] }, weight: 3, choices: [
        { label: "Fight.", action: 'challenge' },
        { label: "Maybe later.", action: 'close' },
      ] },
      { id: 'yunglean.topic.challenge-warlord', slot: 'topic', text: "Chaos follows me like a shadow. You think you know pain? I've been in the abyss since 2002. Shield your eyes, the digital snow is coming!", voice: 'lean-warlord', choices: [
        { label: "Fight.", action: 'challenge' },
        { label: "Maybe later.", action: 'close' },
      ] },
      { id: 'yunglean.topic.iced-tea', slot: 'topic', text: "Bittersweet... everything is bittersweet. Do you happen to have any iced tea on you? No? Shame.", voice: 'lean-idle' },
      { id: 'yunglean.topic.ended', slot: 'topic', text: "The sound is back. I sang on the plaza. Everyone heard. Don't tell them I liked it; they'd want it again, and I only had the one.", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'yunglean.bye.throne', slot: 'bye', text: "Now go. Or stay. The throne is always here." },
      { id: 'yunglean.bye.porcelain', slot: 'bye', text: "Mind the porcelain on the way out. It remembers." },
      { id: 'yunglean.bye.bittersweet', slot: 'bye', text: "Bittersweet. Go." },

      { id: 'yunglean.bark.bittersweet', slot: 'bark', text: "Bittersweet." },
      { id: 'yunglean.bark.soft', slot: 'bark', text: "Walk soft." },
      { id: 'yunglean.bark.tea', slot: 'bark', text: "Any iced tea? No. Shame." },
      { id: 'yunglean.bark.singing', slot: 'bark', text: "The snow is singing.", when: { quest: ['sound', 'done'] } },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // The Void Monk at the three ring portals on the plaza's south end. A different ring leads home every visit.
  'void-monk': {
    persona: {
      id: 'void-monk', district: 'galaxy', knows: ['island', 'dream'], rumourDelay: 120, tone: 'grim',
      gag: "Every visit he names a different ring as the one that leads home; by the fifth, none of them do and all of them do.",
      about: "The hooded monk whose face is a galaxy, keeper of the three ring portals at the plaza's south end; the middle one leads to the island.",
    },
    lines: [
      { id: 'void-monk.greet.first', slot: 'greet', text: "You've come to the rings. Everyone does, eventually. Most of them leave by one. I never worked out which.", when: { metMax: 0 } },
      { id: 'void-monk.greet.again', slot: 'greet', text: "Back. The rings noticed. They notice everything; it's what a hole is for.", when: { metMin: 1, metMax: 2 } },
      { id: 'void-monk.greet.regular', slot: 'greet', text: "Again. You and I are the only two things on this plaza that don't swirl.", when: { metMin: 3 } },
      { id: 'void-monk.greet.wizard', slot: 'greet', text: "A wizard who floats. Careful near the rings: they pull on things that aren't held down.", when: { hero: 'wizard', metMin: 1 } },

      { id: 'void-monk.react.golem', slot: 'react', text: "A crystal golem broke near the rings. Its shards fell in. Somewhere, it's raining glass on someone's home.", when: { event: 'kill', enemy: 'crystalgolem' } },
      { id: 'void-monk.react.ghoul', slot: 'react', text: "A ghoul died near my rings. Its cup went in. Something will drink it, somewhere else. Something always does.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'void-monk.react.galaxy-knight', slot: 'react', text: "You killed a galaxy knight. His armour had a sky on it. I have one on my face. We never spoke; two skies rarely do.", when: { event: 'kill', enemy: 'galaxy-knight' } },
      { id: 'void-monk.react.hurt', slot: 'react', text: "You're bleeding beside a door between worlds. Don't. The worlds argue about whose blood it is.", when: { event: 'hurt' } },
      { id: 'void-monk.react.down', slot: 'react', text: "You went down on the plaza. From here it looked like stepping through a ring that wasn't there.", when: { event: 'down' } },
      { id: 'void-monk.react.fly', slot: 'react', text: "You flew over the rings. They looked up. Nothing has looked up at them before; they're usually the thing looked into.", when: { event: 'feat', feat: 'fly' } },
      { id: 'void-monk.react.fountain', slot: 'react', text: "You sipped the fountain and the city spun. I live like that. My face is a spin. You get used to the stairs.", when: { event: 'feat', feat: 'fountain' } },
      { id: 'void-monk.react.wizard', slot: 'react', text: "You float. The rings approve; they've never had feet either.", when: { hero: 'wizard' } },
      { id: 'void-monk.react.knight', slot: 'react', text: "The knight glides on a cape. A cape is a door you wear. I'd know; I wear one on the front.", when: { hero: 'knight' } },
      { id: 'void-monk.react.archer', slot: 'react', text: "She rides a bow through the sky. The rings are jealous; they can't move. They can only be arrived at.", when: { hero: 'archer' } },
      { id: 'void-monk.react.blood-eye', slot: 'react', text: "They say the eye over the island's chasm closed. The rings blinked. Rings don't blink. I was looking right at them.", when: { event: 'kill', enemy: 'blood-eye' } },
      { id: 'void-monk.react.frog-god', slot: 'react', text: "You killed the Frog God in the dream, they say. Dreams are rings too. That one closes behind you.", when: { event: 'kill', enemy: 'dmt-entity' } },
      { id: 'void-monk.react.boss', slot: 'react', text: "{lastBoss} is dead. The sky in my face went one star darker. I can't see it; I'm told.", when: { event: 'kill', boss: true } },
      { id: 'void-monk.react.levelup', slot: 'react', text: "You've grown. The rings haven't. They don't need to; they're holes. A hole is already as big as what goes through it.", when: { event: 'feat', feat: 'levelup' } },

      // The gag, stepped by how often you have asked.
      { id: 'void-monk.topic.ring-left', slot: 'topic', text: "The left ring is the one that leads home. The others lead somewhere. Somewhere is not nowhere, but it's close.", when: { metMax: 0 }, weight: 4 },
      { id: 'void-monk.topic.ring-right', slot: 'topic', text: "The right ring leads home. Last time I said left. Last time it did. They move when I'm not looking, which is always.", when: { metMin: 1, metMax: 1 }, weight: 4 },
      { id: 'void-monk.topic.ring-middle', slot: 'topic', text: "The middle one. It leads home. It's the obvious one, which is why I didn't say it first. Doors resent being obvious.", when: { metMin: 2, metMax: 2 }, weight: 4 },
      { id: 'void-monk.topic.ring-behind', slot: 'topic', text: "The one behind you. Don't turn round; it's shy. Step backwards into it and think of the island.", when: { metMin: 3, metMax: 4 }, weight: 4 },
      { id: 'void-monk.topic.ring-none', slot: 'topic', text: "None of them lead home. Home leads to them. Step into any swirl and you'll find you were already there.", when: { metMin: 5 }, weight: 4 },
      { id: 'void-monk.topic.face', slot: 'topic', text: "My face? It was a face. Now it's a door. People look in and see stars. They used to look in and see me. Stars are more popular." },
      { id: 'void-monk.topic.silence', slot: 'topic', text: "The voices were swallowed, the head says. I heard them go. They went through the rings, one by one. The rings don't give back.", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },
      { id: 'void-monk.topic.ended', slot: 'topic', text: "The sound is back. It came through the rings. I'd have said it couldn't. I say a lot of things about the rings.", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'void-monk.bye.pick', slot: 'bye', text: "Pick a ring. Or don't; the rings pick, in the end." },
      { id: 'void-monk.bye.swirl', slot: 'bye', text: "Go. Mind the swirl: it's wet in a way that doesn't dry." },

      { id: 'void-monk.bark.left', slot: 'bark', text: "Left. No. Right." },
      { id: 'void-monk.bark.awake', slot: 'bark', text: "The swirl's awake." },
      { id: 'void-monk.bark.look', slot: 'bark', text: "Don't look in." },
      { id: 'void-monk.bark.step', slot: 'bark', text: "Step in. Any of them." },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Snaggle, goblin merchant of Bucket Street: a crystal ball that shows next Tuesday, and prices that crack.
  'market-a': {
    persona: {
      id: 'market-a', district: 'galaxy', knows: ['island', 'vale'], rumourDelay: 100, tone: 'dry',
      about: "The goblin behind the stall between the purple houses, whose crystal ball shows mostly next Tuesday and whose prices crack like the porcelain.",
    },
    lines: [
      { id: 'market-a.greet.first', slot: 'greet', text: "Crystal ball, slightly used. Shows mostly next Tuesday. You're in it, buying something.", when: { metMax: 0 } },
      { id: 'market-a.greet.again', slot: 'greet', text: "The ball said you'd be back. It also said Tuesday. It's Tuesday somewhere.", when: { metMin: 1, metMax: 2 } },
      { id: 'market-a.greet.regular', slot: 'greet', text: "My best customer. That isn't praise. The others are mimics.", when: { metMin: 3 } },
      { id: 'market-a.greet.archer', slot: 'greet', text: "Mushrooms? I don't sell mushrooms. I sell what you need after mushrooms. Moon Dew, thirty-two.", when: { hero: 'archer' } },
      { id: 'market-a.greet.knight', slot: 'greet', text: "A knight with a cup. I don't sell lean. I sell what you'll need after the cup. It's the same shelf.", when: { hero: 'knight', metMin: 1 } },

      { id: 'market-a.react.bucket', slot: 'react', text: "That mimic had been grinning at my stall for weeks. It took a customer once. The customer is fine. Probably.", when: { event: 'kill', enemy: 'bucket' } },
      { id: 'market-a.react.mail', slot: 'react', text: "A mail knight dead outside my stall. He was a regular. He never paid. Now you're the regular.", when: { event: 'kill', enemy: 'mail-knight' } },
      { id: 'market-a.react.hollowstaff', slot: 'react', text: "Hollowstaff is dead and his diamonds are rolling down the street. Mine. Mine. That one's mine too.", when: { event: 'kill', enemy: 'diamond-wizard' } },
      { id: 'market-a.react.ghoul', slot: 'react', text: "One ghoul fewer. It leaked on my salves. Rot Salve already smells like the pot; it didn't need help.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'market-a.react.hurt', slot: 'react', text: "You're bleeding on my cobbles. Rot Salve, twenty-eight. Bleed on the salve and I charge you twice.", when: { event: 'hurt' } },
      { id: 'market-a.react.down', slot: 'react', text: "You went down on the street. I was going to help, but the stall. Someone has to mind the stall.", when: { event: 'down' } },
      { id: 'market-a.react.carriage', slot: 'react', text: "You drove the Count's carriage past my stall. Mind the awning. The awning is the stall.", when: { event: 'feat', feat: 'carriage' } },
      { id: 'market-a.react.chest', slot: 'react', text: "You opened a chest. Anything porcelain in there, I'll buy. Anything cracked, I'll buy for less. It's all cracked.", when: { event: 'feat', feat: 'chest' } },
      { id: 'market-a.react.wizard', slot: 'react', text: "A floating customer. You don't stand in the queue, so I can't charge you for the queue. I'll think of something.", when: { hero: 'wizard' } },
      { id: 'market-a.react.archer', slot: 'react', text: "The girl on the bow. She eats mushrooms raw. I'd sell her a sauce if I had one. I have a salve. Close enough.", when: { hero: 'archer' } },
      { id: 'market-a.react.cyclops', slot: 'react', text: "Word from the island: you killed the cyclops by the eye pool. Nothing it dropped was porcelain. I asked.", when: { event: 'kill', enemy: 'cyclops' } },
      { id: 'market-a.react.penny', slot: 'react', text: "They say an old woman in the vale asks for shards and tells secrets. I'd tell secrets too, for shards. I don't have any. Secrets.", when: { quest: ['penny', ['none', 'active']] }, weight: 1.2 },
      { id: 'market-a.react.boss', slot: 'react', text: "{lastBoss} is dead. Its loot is already underpriced somewhere. Not here.", when: { event: 'kill', boss: true } },
      { id: 'market-a.react.levelup', slot: 'react', text: "You've grown. Grown customers pay grown prices. The ball saw it coming. Tuesday.", when: { event: 'feat', feat: 'levelup' } },

      { id: 'market-a.topic.porcelain', slot: 'topic', text: "Everything here is porcelain. Prices too: they crack. Drop one and I'll sell you the pieces." },
      { id: 'market-a.topic.waves', slot: 'topic', text: "Mind the lean waves between the cups. They have opinions. Mostly about swimmers." },
      { id: 'market-a.topic.tuesday', slot: 'topic', text: "The ball shows next Tuesday because next Tuesday is when I restock. Buy now; Tuesday is expensive." },
      { id: 'market-a.topic.trade', slot: 'topic', text: "Moon Dew, thirty-two. Rot Salve, twenty-eight. Grizzle says I overcharge. Grizzle sells lanterns to people who glow." },
      { id: 'market-a.topic.silence', slot: 'topic', text: "The voices were swallowed, the head says. Business was quiet. I thought it was me. Good to know it was a king.", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },

      { id: 'market-a.bye.tuesday', slot: 'bye', text: "Come back Tuesday." },
      { id: 'market-a.bye.mimics', slot: 'bye', text: "Mind the mimics. They look like buckets. Buckets look like them." },

      { id: 'market-a.bark.used', slot: 'bark', text: "Slightly used." },
      { id: 'market-a.bark.awning', slot: 'bark', text: "Mind the awning." },
      { id: 'market-a.bark.crack', slot: 'bark', text: "Prices crack." },
      { id: 'market-a.bark.tuesday', slot: 'bark', text: "Tuesday." },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Grizzle, the other goblin merchant: lanterns that remember where you left them, and he overcharges less.
  'market-b': {
    persona: {
      id: 'market-b', district: 'galaxy', knows: ['vale', 'sunken'], rumourDelay: 100, tone: 'manic',
      about: "The goblin at the second stall on Bucket Street, who sells lanterns that remember where you left them and overcharges less than Snaggle.",
    },
    lines: [
      { id: 'market-b.greet.first', slot: 'greet', text: "Lanterns! Lanterns that remember where you left them! You left one here. No, that's mine. Buy it!", when: { metMax: 0 } },
      { id: 'market-b.greet.again', slot: 'greet', text: "You're back! Snaggle's stall is that way. This is the better way! Shorter, too!", when: { metMin: 1, metMax: 2 } },
      { id: 'market-b.greet.regular', slot: 'greet', text: "My regular! I've told everyone. Everyone is Snaggle. He didn't care!", when: { metMin: 3 } },
      { id: 'market-b.greet.wizard', slot: 'greet', text: "A floating wizard! Need a lantern? You glow already! Buy one for the dark bits!", when: { hero: 'wizard' } },

      { id: 'market-b.react.bucket', slot: 'react', text: "You smashed a mimic! It was carrying my lantern! It remembered where it was: inside a bucket!", when: { event: 'kill', enemy: 'bucket' } },
      { id: 'market-b.react.mail', slot: 'react', text: "A knight down on the street! Sell me his chain! No? Then buy a lantern to look at it with!", when: { event: 'kill', enemy: 'mail-knight' } },
      { id: 'market-b.react.hollowstaff', slot: 'react', text: "Hollowstaff is down! His diamonds are everywhere! Snaggle has three already! Three!", when: { event: 'kill', enemy: 'diamond-wizard' } },
      { id: 'market-b.react.ghoul', slot: 'react', text: "A ghoul fewer! Their cups leak on my tea. Lotus tea, twenty-six, slightly purple!", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'market-b.react.hurt', slot: 'react', text: "You're bleeding! Lotus tea! It steadies the hand! It won't steady the blood, but one thing at a time!", when: { event: 'hurt' } },
      { id: 'market-b.react.down', slot: 'react', text: "You went down outside! I shouted! Snaggle didn't shout. Remember that when you're buying!", when: { event: 'down' } },
      { id: 'market-b.react.carriage', slot: 'react', text: "You drove the Count's carriage! Past my stall! Twice! The second time was slower! I appreciated that!", when: { event: 'feat', feat: 'carriage' } },
      { id: 'market-b.react.fountain', slot: 'react', text: "You drank from the court's fountain! The world spun! Buy a lantern; it'll spin too, but you'll see it!", when: { event: 'feat', feat: 'fountain' } },
      { id: 'market-b.react.knight', slot: 'react', text: "A knight who glides on his cape! With a cup! I don't sell cups. Lanterns! Hang one off the cup!", when: { hero: 'knight' } },
      { id: 'market-b.react.archer', slot: 'react', text: "The girl who rides her bow! Buy a lantern! Hang it off the bow! Fly by night! The night is purple here, but still!", when: { hero: 'archer' } },
      { id: 'market-b.react.penny', slot: 'react', text: "In the vale an old woman sells a secret for twenty shards, they say! I'd sell mine for ten! I don't have one!", when: { quest: ['penny', ['none', 'active']] }, weight: 1.2 },
      { id: 'market-b.react.bell', slot: 'react', text: "They say the Fish King under the lake lost a bell! A bell! I sell lanterns, not bells, but I could! I'd need a bell!", when: { quest: ['bell', ['active', 'found']] }, weight: 1.2 },
      { id: 'market-b.react.boss', slot: 'react', text: "{lastBoss} is dead! Did it drop a lantern? No? Then why are we talking about it!", when: { event: 'kill', boss: true } },
      { id: 'market-b.react.levelup', slot: 'react', text: "You've grown! Bigger customer! Same prices! I'm generous! Tell Snaggle!", when: { event: 'feat', feat: 'levelup' } },

      { id: 'market-b.topic.lanterns', slot: 'topic', text: "Each lantern remembers where you left it. It can't go back there. Neither can you. That's the sad part. Buy it!" },
      { id: 'market-b.topic.snaggle', slot: 'topic', text: "Snaggle overcharges. I overcharge less. Less is a number. It's a smaller number. Buy from the smaller number!" },
      { id: 'market-b.topic.silence', slot: 'topic', text: "The head says the voices were swallowed! I've still got mine! Loudest on the street! Ask Snaggle! He'll say yes! Quietly!", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },
      { id: 'market-b.topic.ended', slot: 'topic', text: "The sound is back! I was shouting the whole time! Nobody heard! Now they hear! They've asked me to stop!", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'market-b.bye.friends', slot: 'bye', text: "Come back! Bring friends! Bring Snaggle's friends!" },
      { id: 'market-b.bye.waves', slot: 'bye', text: "Mind the lean waves! They don't remember anything!" },

      { id: 'market-b.bark.lanterns', slot: 'bark', text: "Lanterns!" },
      { id: 'market-b.bark.cheaper', slot: 'bark', text: "Cheaper than Snaggle!" },
      { id: 'market-b.bark.purple', slot: 'bark', text: "Slightly purple!" },
      { id: 'market-b.bark.remember', slot: 'bark', text: "They remember!" },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // The Skeleton Lord on the pavilion's settee, in black fur, breathing purple smoke through diamond teeth.
  'skeleton-lord': {
    persona: {
      id: 'skeleton-lord', district: 'galaxy', knows: ['graveyard', 'island'], rumourDelay: 180, tone: 'grim',
      gag: "Every diamond in his teeth was a promise someone broke; he keeps count, and the count only goes up.",
      about: "The lord in the black fur cloak on the pavilion's settee in the Skeleton Court, who breathes purple smoke and counts broken promises in his teeth.",
    },
    lines: [
      { id: 'skeleton-lord.greet.first', slot: 'greet', text: "Sit. The smoke is free. The view costs. You can't afford the view; nobody can. Sit anyway.", when: { metMax: 0 } },
      { id: 'skeleton-lord.greet.again', slot: 'greet', text: "You came back for the smoke. Everyone says it's for the view.", when: { metMin: 1, metMax: 2 } },
      { id: 'skeleton-lord.greet.regular', slot: 'greet', text: "The regular. Cobalt has stopped reaching for his sword when you come in. That's affection, in here.", when: { metMin: 3 } },
      { id: 'skeleton-lord.greet.knight', slot: 'greet', text: "A knight with a cup. Cobalt has a goblet. Between the two of you, there's a bar.", when: { hero: 'knight', metMin: 1 } },

      { id: 'skeleton-lord.react.galaxy-knight', slot: 'react', text: "You killed a galaxy knight at the treasury. One more diamond for my teeth: he promised he'd hold it.", when: { event: 'kill', enemy: 'galaxy-knight' } },
      { id: 'skeleton-lord.react.ghoul', slot: 'react', text: "A ghoul down on the plaza. I heard the cup land. They always land upright. That's the saddest part.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'skeleton-lord.react.golem', slot: 'react', text: "A crystal golem broke. I'll have the shards set in my teeth. There's room. There's always room.", when: { event: 'kill', enemy: 'crystalgolem' } },
      { id: 'skeleton-lord.react.chucker', slot: 'react', text: "The chucker is gone. The dome is quiet. I'll smoke to it; it was good at its one thing.", when: { event: 'kill', enemy: 'lean-chucker' } },
      { id: 'skeleton-lord.react.hurt', slot: 'react', text: "You're bleeding on my settee. Fur drinks blood. The settee has drunk worse.", when: { event: 'hurt' } },
      { id: 'skeleton-lord.react.down', slot: 'react', text: "You went down in the court. I watched through the smoke. The smoke made it beautiful. I'm sorry about that.", when: { event: 'down' } },
      { id: 'skeleton-lord.react.fountain', slot: 'react', text: "You sipped from the fountains and the court spun. It does that. I had them built to spin. Nobody believes me.", when: { event: 'feat', feat: 'fountain' } },
      { id: 'skeleton-lord.react.carriage', slot: 'react', text: "You drove the Count's carriage. It brings guests to the castle. The castle keeps them. You drove away. Good.", when: { event: 'feat', feat: 'carriage' } },
      { id: 'skeleton-lord.react.wizard', slot: 'react', text: "The floating one. Your robe never touches my floor. Mind the smoke; it climbs.", when: { hero: 'wizard' } },
      { id: 'skeleton-lord.react.archer', slot: 'react', text: "The girl on the bow. You eat mushrooms. I smoke. We're both tasting the ground, one way or the other.", when: { hero: 'archer' } },
      { id: 'skeleton-lord.react.cyclops-lord', slot: 'react', text: "They say the Grave Cyclops fell at the end of the Alley. Its crown was promised to the King once. Another diamond, then.", when: { event: 'kill', enemy: 'cyclops-lord' } },
      { id: 'skeleton-lord.react.antlered', slot: 'react', text: "The antlered king on the island sits on bone, I hear, and his warden is dead. Mine is fur. Fur is warmer. Tell him.", when: { event: 'kill', enemy: 'warden' } },
      { id: 'skeleton-lord.react.boss', slot: 'react', text: "{lastBoss} fell. Everything falls. I promised the smoke I wouldn't. The smoke is still deciding.", when: { event: 'kill', boss: true } },
      { id: 'skeleton-lord.react.crit', slot: 'react', text: "A crit. I felt it in the teeth. All of them.", when: { event: 'feat', feat: 'crit' } },
      { id: 'skeleton-lord.react.levelup', slot: 'react', text: "You've grown. Growing is a promise your body keeps. Rare, in here.", when: { event: 'feat', feat: 'levelup' } },

      { id: 'skeleton-lord.topic.diamonds', slot: 'topic', text: "Every diamond in these teeth was a promise someone broke. I have forty-one. The forty-second is reserved." },
      { id: 'skeleton-lord.topic.smoke', slot: 'topic', text: "The smoke is purple because of what's in it. The view is purple because of the smoke. It's a system." },
      { id: 'skeleton-lord.topic.castle', slot: 'topic', text: "The carriage brings guests to the castle. The castle keeps them. I'm not a guest. I'm the reason there's a castle." },
      { id: 'skeleton-lord.topic.silence', slot: 'topic', text: "The Hollow King swallowed our voices, the head says. He didn't swallow mine. I never used it. I smoke.", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },
      { id: 'skeleton-lord.topic.ended', slot: 'topic', text: "The sound came back. The smoke moves differently now; it has something to move to. Forty-one. I'm keeping the count.", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'skeleton-lord.bye.smoke', slot: 'bye', text: "The smoke will miss you. I'll manage." },
      { id: 'skeleton-lord.bye.fur', slot: 'bye', text: "Go. Mind the fur on the way out. It bites." },

      { id: 'skeleton-lord.bark.sit', slot: 'bark', text: "Sit." },
      { id: 'skeleton-lord.bark.view', slot: 'bark', text: "The view costs." },
      { id: 'skeleton-lord.bark.count', slot: 'bark', text: "Forty-one." },
      { id: 'skeleton-lord.bark.fur', slot: 'bark', text: "Mind the fur." },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Sir Cobalt, on a stool at the lord's side: blue plate, a gold goblet of purple wine, a sword of ice.
  'court-knight': {
    persona: {
      id: 'court-knight', district: 'galaxy', knows: ['island', 'vale'], rumourDelay: 200, tone: 'warm',
      about: "The blue-plated knight on the stool beside the Skeleton Lord, many goblets into one goblet, whose sword is ice and never melts in there.",
    },
    lines: [
      { id: 'court-knight.greet.first', slot: 'greet', text: "I came for one goblet. That was many goblets ago. Pull up a stool; the lord says the view costs, but I've never been charged.", when: { metMax: 0 } },
      { id: 'court-knight.greet.again', slot: 'greet', text: "You're back. I'm still here. That isn't loyalty, it's furniture.", when: { metMin: 1, metMax: 2 } },
      { id: 'court-knight.greet.regular', slot: 'greet', text: "My friend. I say that to the goblet too, but with you I mean it slightly more.", when: { metMin: 3 } },
      { id: 'court-knight.greet.knight', slot: 'greet', text: "A fellow knight, with a cup. Mine's a goblet. Yours is foam. We'll not talk about it.", when: { hero: 'knight' } },
      { id: 'court-knight.greet.archer', slot: 'greet', text: "A hooded archer who rides her own bow. I ride a stool. Different disciplines.", when: { hero: 'archer', metMin: 1 } },

      { id: 'court-knight.react.galaxy-knight', slot: 'react', text: "You killed a galaxy knight at the treasury. Good men, galaxy knights. Bad at staying alive, apparently.", when: { event: 'kill', enemy: 'galaxy-knight' } },
      { id: 'court-knight.react.ghoul', slot: 'react', text: "A ghoul fewer on the plaza. I'd have helped, but my sword is ice and the plaza is warm.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'court-knight.react.chucker', slot: 'react', text: "The chucker in the dome. I was going to fight him. After this goblet. Then the next. You've saved me the goblets.", when: { event: 'kill', enemy: 'lean-chucker' } },
      { id: 'court-knight.react.golem', slot: 'react', text: "A crystal golem broke somewhere near. My sword heard. It's ice; it wants to meet the shards.", when: { event: 'kill', enemy: 'crystalgolem' } },
      { id: 'court-knight.react.hurt', slot: 'react', text: "You're hurt. I'd offer the goblet, but it's purple and it doesn't heal, it just stops you minding.", when: { event: 'hurt' } },
      { id: 'court-knight.react.down', slot: 'react', text: "You went down in the court. I stood up. First time in a week. Sat down again; you'd got up.", when: { event: 'down' } },
      { id: 'court-knight.react.fountain', slot: 'react', text: "You sipped the fountains and the court spun. I watched you walk in a circle. You looked content.", when: { event: 'feat', feat: 'fountain' } },
      { id: 'court-knight.react.sip', slot: 'react', text: "You drank from your cup. I drank from mine. That's a toast. We've done a toast; it counts.", when: { event: 'feat', feat: 'sip' } },
      { id: 'court-knight.react.wizard', slot: 'react', text: "You float. I lean. The lord smokes. The pavilion is a study in posture.", when: { hero: 'wizard' } },
      { id: 'court-knight.react.knight', slot: 'react', text: "The knight who glides on his cape. I tried that once, with the fur. The lord was still in it.", when: { hero: 'knight' } },
      { id: 'court-knight.react.rose', slot: 'react', text: "They say a maiden on the island got a rose from a knight and hasn't answered. Poor man. I'd have a goblet with him.", when: { quest: ['rose', ['none', 'active']] }, weight: 1.2 },
      { id: 'court-knight.react.dragon', slot: 'react', text: "In the vale a dragon sleeps behind the street, I hear, and someone reads to it. I sleep in front of this settee. Nobody reads.", when: { quest: ['books', ['none', 'active']] }, weight: 1.2 },
      { id: 'court-knight.react.boss', slot: 'react', text: "{lastBoss} fell. I'll raise the goblet. It's up. It's been up a while.", when: { event: 'kill', boss: true } },
      { id: 'court-knight.react.levelup', slot: 'react', text: "You've grown. The stool is the same. One of us has to be.", when: { event: 'feat', feat: 'levelup' } },

      { id: 'court-knight.topic.ice', slot: 'topic', text: "My sword is ice. It never melts in here: nothing does. If I took it outside I'd have a wet hand and a story." },
      { id: 'court-knight.topic.lord', slot: 'topic', text: "He talks in smoke. I nod. It works. Forty-one goblets in, I understood him once. I've been trying to get back there." },
      { id: 'court-knight.topic.silence', slot: 'topic', text: "The voices were swallowed, the head says. The lord's smoke went quiet too. I hadn't noticed smoke had a sound until it stopped.", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },
      { id: 'court-knight.topic.ended', slot: 'topic', text: "The sound is back. I heard the King sing from here. I raised the goblet. It was already up. I raised the other hand.", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'court-knight.bye.follow', slot: 'bye', text: "One more goblet, then I'll follow you. I won't." },
      { id: 'court-knight.bye.stool', slot: 'bye', text: "Go on. Mind the stool; it moves when you're not on it." },

      { id: 'court-knight.bark.more', slot: 'bark', text: "One more." },
      { id: 'court-knight.bark.cheers', slot: 'bark', text: "Cheers." },
      { id: 'court-knight.bark.melt', slot: 'bark', text: "It never melts." },
      { id: 'court-knight.bark.nod', slot: 'bark', text: "I nod." },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Merrow the Pourer at the court's long tables of galaxy bottles. Do not drink the one with the planet in it.
  'potion-brewer': {
    persona: {
      id: 'potion-brewer', district: 'galaxy', knows: ['dream', 'island'], rumourDelay: 150, tone: 'dry',
      about: "The keeper of the galaxy bottles on the Skeleton Court's long tables, who pours little night skies and guards the one with the planet in it.",
    },
    lines: [
      { id: 'potion-brewer.greet.first', slot: 'greet', text: "Each bottle holds a little night sky. Shake one and the stars rearrange. Don't shake the one with the planet in it.", when: { metMax: 0 } },
      { id: 'potion-brewer.greet.again', slot: 'greet', text: "Back. The planet bottle is still here. So am I. We're both waiting for someone to be stupid.", when: { metMin: 1, metMax: 2 } },
      { id: 'potion-brewer.greet.regular', slot: 'greet', text: "You again. The bottles know your step. Three of them went cloudy.", when: { metMin: 3 } },
      { id: 'potion-brewer.greet.wizard', slot: 'greet', text: "A wizard. Blue mountain, floating. You'd know what's in the planet bottle. Don't tell me. I like not knowing.", when: { hero: 'wizard' } },

      { id: 'potion-brewer.react.galaxy-knight', slot: 'react', text: "You killed a galaxy knight by the treasury. His armour had a sky on it. I could have bottled it.", when: { event: 'kill', enemy: 'galaxy-knight' } },
      { id: 'potion-brewer.react.ghoul', slot: 'react', text: "A ghoul died on the plaza. Its cup was a bad vintage. I'd have poured it out anyway.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'potion-brewer.react.golem', slot: 'react', text: "A crystal golem shattered nearby. Shards in my bottles. The skies are sharper tonight.", when: { event: 'kill', enemy: 'crystalgolem' } },
      { id: 'potion-brewer.react.chucker', slot: 'react', text: "The chucker is dead. It threw cups. I pour them. We were never going to be friends.", when: { event: 'kill', enemy: 'lean-chucker' } },
      { id: 'potion-brewer.react.hurt', slot: 'react', text: "You're bleeding on my tables. There's a bottle for that. It's the planet one. Don't.", when: { event: 'hurt' } },
      { id: 'potion-brewer.react.down', slot: 'react', text: "You went down in the court. The fountains kept pouring. They don't stop for anyone. I've asked.", when: { event: 'down' } },
      { id: 'potion-brewer.react.fountain', slot: 'react', text: "You sipped from the fountains and the court spun. I told you. I'll keep telling you; it's cheaper than a sign.", when: { event: 'feat', feat: 'fountain' } },
      { id: 'potion-brewer.react.chest', slot: 'react', text: "You opened a chest. Was there a bottle in it? There's always a bottle. Bring it; I'll say what sky it is.", when: { event: 'feat', feat: 'chest' } },
      { id: 'potion-brewer.react.knight', slot: 'react', text: "The knight with the cup. Foam, lean, a sword. You're a cocktail with a cape.", when: { hero: 'knight' } },
      { id: 'potion-brewer.react.archer', slot: 'react', text: "The archer who rides the bow and eats mushrooms. There's a bottle for mushrooms. It's blue. Everything is blue.", when: { hero: 'archer' } },
      { id: 'potion-brewer.react.prism', slot: 'react', text: "They say you killed the Prism Wizard in the frog's dream. I have a bottle that colour. I don't open it.", when: { event: 'kill', enemy: 'trip-wizard' } },
      { id: 'potion-brewer.react.lick', slot: 'react', text: "You licked the Frog King on the island, I hear. There's a bottle for that too. Same bottle, really.", when: { event: 'feat', feat: 'lick' } },
      { id: 'potion-brewer.react.third-eye', slot: 'react', text: "You're carrying the Frog God's eye. It's looking at my bottles. Tell it the planet one isn't for sale.", when: { item: 'third-eye' }, weight: 1.5 },
      { id: 'potion-brewer.react.boss', slot: 'react', text: "{lastBoss} is dead. Somewhere a sky got darker. I'll check the bottles.", when: { event: 'kill', boss: true } },
      { id: 'potion-brewer.react.levelup', slot: 'react', text: "You've grown. Grown things pour slower. I'm not sure that's true. It sounds it.", when: { event: 'feat', feat: 'levelup' } },

      { id: 'potion-brewer.topic.planet', slot: 'topic', text: "Do not drink the one with the planet in it. I've had it a hundred years. Nobody has drunk it. That's the only proof I have." },
      { id: 'potion-brewer.topic.fountains', slot: 'topic', text: "The fountains pour lean. Sip from the basins if you're brave; it spins the world. Spin it twice and you're back where you started." },
      { id: 'potion-brewer.topic.stars', slot: 'topic', text: "Shake a bottle and its stars rearrange. Shake it long enough and they spell something. Don't read it. Nothing good is spelt by stars." },
      { id: 'potion-brewer.topic.trade', slot: 'topic', text: "Lotus tea, thirty. The star chart, two hundred and ten: Pim's drawing of where the great ones sleep. I don't draw; I pour." },
      { id: 'potion-brewer.topic.silence', slot: 'topic', text: "The voices were swallowed, the head says. I bottled one once, I think. A hum in the blue bottle. It went quiet. Or I drank it.", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },
      { id: 'potion-brewer.topic.ended', slot: 'topic', text: "The sound is back. The blue bottle is humming again. So it wasn't me who drank it. I'd been feeling guilty for a year.", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'potion-brewer.bye.tables', slot: 'bye', text: "Mind the tables. Mind the planet." },
      { id: 'potion-brewer.bye.rearrange', slot: 'bye', text: "Go on. The bottles will rearrange without you." },

      { id: 'potion-brewer.bark.planet', slot: 'bark', text: "Not the planet one." },
      { id: 'potion-brewer.bark.shake', slot: 'bark', text: "Don't shake it." },
      { id: 'potion-brewer.bark.mist', slot: 'bark', text: "Mind the mist." },
      { id: 'potion-brewer.bark.slow', slot: 'bark', text: "Sip slowly." },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Old Ribs at the sky bar, a booth on chains at the sky dock's edge: ice, straw, a slice of orange.
  bartender: {
    persona: {
      id: 'bartender', district: 'galaxy', knows: ['island', 'sunken'], rumourDelay: 160, tone: 'dry',
      gag: "The dragon drinks on credit and the tab is kept on his tail; the edge of the dock has a regular who is still falling.",
      about: "The skeleton in fur who tends the sky bar hung on chains at the sky dock, serving lean with ice, a straw and a slice of orange, and keeping the dragon's tab.",
    },
    lines: [
      { id: 'bartender.greet.first', slot: 'greet', text: "Ice, straw, a slice of orange. House style. You can have it any other way, but then it isn't the house's.", when: { metMax: 0 } },
      { id: 'bartender.greet.again', slot: 'greet', text: "Back for the house style. The dragon is still on credit. You're not.", when: { metMin: 1, metMax: 2 } },
      { id: 'bartender.greet.regular', slot: 'greet', text: "My regular. Grillmaw is jealous. He thinks he's my regular. He's my debt.", when: { metMin: 3 } },
      { id: 'bartender.greet.knight', slot: 'greet', text: "A knight with his own cup. We don't allow outside cups. We allow knights. Hand it over; I'll ice it.", when: { hero: 'knight' } },
      { id: 'bartender.greet.archer', slot: 'greet', text: "A girl who rode her bow up here. The bow stays at the bar. The bar is on chains; it has held worse.", when: { hero: 'archer', metMin: 1 } },

      { id: 'bartender.react.bubble', slot: 'react', text: "A bubble popped in the cups. I heard it from the bar. They come up here sometimes; I serve them. They don't tip.", when: { event: 'kill', enemy: 'lean-bubble' } },
      { id: 'bartender.react.ghoul', slot: 'react', text: "A ghoul down on the plaza. They never come up. Too far to fly with a cup on your back. I respect the cup.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'bartender.react.chucker', slot: 'react', text: "The chucker in the dome is dead. It threw cups. I serve them. Civilisation wins, slowly.", when: { event: 'kill', enemy: 'lean-chucker' } },
      { id: 'bartender.react.hurt', slot: 'react', text: "You're bleeding on the dock. Mind the edge. The last fellow who leaned too far is still falling.", when: { event: 'hurt' } },
      { id: 'bartender.react.down', slot: 'react', text: "You went down up here. Up here is a long way down. You landed somewhere. Good instincts.", when: { event: 'down' } },
      { id: 'bartender.react.fly', slot: 'react', text: "You flew up to the bar. Most people take the waves. Flyers tip better; they're already giddy.", when: { event: 'feat', feat: 'fly' } },
      { id: 'bartender.react.swim', slot: 'react', text: "You swam the lean waves to get here. Wet customers. The dragon licks the floor after. Everyone wins.", when: { event: 'feat', feat: 'swim' } },
      { id: 'bartender.react.crit', slot: 'react', text: "That was a crit. Grillmaw opened one eye. He doesn't do that for me.", when: { event: 'feat', feat: 'crit' } },
      { id: 'bartender.react.wizard', slot: 'react', text: "A floating wizard at a floating bar. Mind the edge: there's no floor to float over past it.", when: { hero: 'wizard' } },
      { id: 'bartender.react.knight', slot: 'react', text: "The knight who glides on his cape. Glide off the edge once and the cape is a story.", when: { hero: 'knight' } },
      { id: 'bartender.react.fish-king', slot: 'react', text: "They say the Fish King under the lake runs a bar too. Under water. No ice. I don't see the point.", when: { quest: ['bell', ['active', 'found', 'done']] }, weight: 1.2 },
      { id: 'bartender.react.ale', slot: 'react', text: "You drank the rowers' beer on the island, I hear. Brewed under the bench. Mine is brewed in a cup. Standards.", when: { event: 'feat', feat: 'ale' } },
      { id: 'bartender.react.boss', slot: 'react', text: "{lastBoss} died. Grillmaw says he'd have eaten it. Grillmaw says a lot after a cup.", when: { event: 'kill', boss: true } },
      { id: 'bartender.react.levelup', slot: 'react', text: "You've grown. The stool is bolted. Sit careful.", when: { event: 'feat', feat: 'levelup' } },

      { id: 'bartender.topic.credit', slot: 'topic', text: "The dragon drinks on credit. Eleven hundred cups. I keep the tab on his tail; he hasn't noticed it getting longer." },
      { id: 'bartender.topic.edge', slot: 'topic', text: "Mind the edge. The last fellow who leaned too far is still falling. I send a cup down now and then. He's grateful." },
      { id: 'bartender.topic.style', slot: 'topic', text: "Ice, straw, a slice of orange. The orange is for the dragon. He likes the colour. He eats the slice. He eats the straw." },
      { id: 'bartender.topic.silence', slot: 'topic', text: "The voices were swallowed, the head says. The bar has been quiet for a year. I thought it was the altitude.", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },
      { id: 'bartender.topic.ended', slot: 'topic', text: "The sound is back. Grillmaw roared along with the song. Off key. He's a dragon; nobody told him.", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'bartender.bye.edge', slot: 'bye', text: "Mind the edge." },
      { id: 'bartender.bye.finish', slot: 'bye', text: "Go on. Grillmaw will finish yours." },

      { id: 'bartender.bark.style', slot: 'bark', text: "House style." },
      { id: 'bartender.bark.edge', slot: 'bark', text: "Mind the edge." },
      { id: 'bartender.bark.ice', slot: 'bark', text: "Ice, straw, orange." },
      { id: 'bartender.bark.credit', slot: 'bark', text: "On credit. Again." },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Sir Velvet, sipping beside Grillmaw the black dragon at the far side of the sky dock.
  'dock-knight': {
    persona: {
      id: 'dock-knight', district: 'galaxy', knows: ['island', 'vale'], rumourDelay: 220, tone: 'warm',
      gag: "One more cup and then they fly. Probably. They never fly.",
      about: "The blue knight who drinks beside Grillmaw, the black dragon lounging at the sky dock, waiting for the sun to set and for one more cup.",
    },
    lines: [
      { id: 'dock-knight.greet.first', slot: 'greet', text: "He's called Grillmaw. Don't stare at his teeth; he knows they're nice. Sit on the other side, he drips.", when: { metMax: 0 } },
      { id: 'dock-knight.greet.again', slot: 'greet', text: "You're back. We still haven't flown. One more cup first. Probably.", when: { metMin: 1, metMax: 2 } },
      { id: 'dock-knight.greet.regular', slot: 'greet', text: "My friend. Grillmaw has started saving you a slice of orange. He eats it when you don't come. He has eaten four.", when: { metMin: 3 } },
      { id: 'dock-knight.greet.archer', slot: 'greet', text: "You fly on a bow. He flies on wings. I sit. We all have our method.", when: { hero: 'archer' } },

      { id: 'dock-knight.react.bubble', slot: 'react', text: "A bubble popped in the cups below. Grillmaw sneezed. He doesn't like it when the lean fights back.", when: { event: 'kill', enemy: 'lean-bubble' } },
      { id: 'dock-knight.react.ghoul', slot: 'react', text: "A ghoul down on the plaza. Grillmaw says he'd have eaten it. He says that about everything. He ate the slice.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'dock-knight.react.chucker', slot: 'react', text: "The chucker is dead, they say. Grillmaw wanted to fly over and roar. One more cup first, I said. That was yesterday.", when: { event: 'kill', enemy: 'lean-chucker' } },
      { id: 'dock-knight.react.hurt', slot: 'react', text: "You're hurt. Grillmaw is licking his lips. That's concern. It is. Probably.", when: { event: 'hurt' } },
      { id: 'dock-knight.react.down', slot: 'react', text: "You went down. Grillmaw looked over the edge for a while. Then he had a cup. He grieves fast.", when: { event: 'down' } },
      { id: 'dock-knight.react.fly', slot: 'react', text: "You flew up here. Grillmaw sat up. First time in a month. Then he lay down. But he saw you.", when: { event: 'feat', feat: 'fly' } },
      { id: 'dock-knight.react.swim', slot: 'react', text: "You swam the lean waves to the dock. Grillmaw drinks from those. He says it tastes of you now.", when: { event: 'feat', feat: 'swim' } },
      { id: 'dock-knight.react.sip', slot: 'react', text: "You drank from your cup. Grillmaw drank from his. I drank from mine. That's a round. You're buying the next.", when: { event: 'feat', feat: 'sip' } },
      { id: 'dock-knight.react.wizard', slot: 'react', text: "A floating wizard. Grillmaw floats too, when he can be bothered. He's rarely bothered.", when: { hero: 'wizard' } },
      { id: 'dock-knight.react.knight', slot: 'react', text: "A knight with a cup, gliding on his cape. Grillmaw says the cape is a wing that gave up. Rude, but he's a dragon.", when: { hero: 'knight' } },
      { id: 'dock-knight.react.wyrm', slot: 'react', text: "They say the Moon Wyrm over the lonely towers died. Grillmaw sulked. They weren't close. Dragons just sulk.", when: { event: 'kill', enemy: 'wyrm' } },
      { id: 'dock-knight.react.verdigris', slot: 'react', text: "A green dragon sleeps behind the vale's street, I hear. Grillmaw says green is a phase. He went through purple.", when: { quest: ['books', ['none', 'active']] }, weight: 1.2 },
      { id: 'dock-knight.react.boss', slot: 'react', text: "{lastBoss} fell. We watched the sunset instead. It never quite sets. It's a long show.", when: { event: 'kill', boss: true } },
      { id: 'dock-knight.react.levelup', slot: 'react', text: "You've grown. Grillmaw noticed. He grew too, he says. He's lying down, so who knows.", when: { event: 'feat', feat: 'levelup' } },

      { id: 'dock-knight.topic.sunset', slot: 'topic', text: "We watch the sun go down from here. It never quite does. I've a theory it's waiting for us to leave first." },
      { id: 'dock-knight.topic.flying', slot: 'topic', text: "One more cup and then we fly. Probably. He has the wings; I have the cup. The cup is winning." },
      { id: 'dock-knight.topic.grillmaw', slot: 'topic', text: "He's called Grillmaw. The grill is the diamonds in his teeth. The maw is the rest. Don't stand in the rest." },
      { id: 'dock-knight.topic.silence', slot: 'topic', text: "The head says the voices were swallowed. Grillmaw has a roar he hasn't used in a year. I thought he was being polite.", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },
      { id: 'dock-knight.topic.ended', slot: 'topic', text: "The sound came back and Grillmaw roared. The giant cup on the tower rang. We still haven't flown. One more cup.", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'dock-knight.bye.fly', slot: 'bye', text: "One more cup. Then we fly. Probably." },
      { id: 'dock-knight.bye.drip', slot: 'bye', text: "Go on. He'll drip on your seat; it's a compliment." },

      { id: 'dock-knight.bark.teeth', slot: 'bark', text: "He knows they're nice." },
      { id: 'dock-knight.bark.probably', slot: 'bark', text: "Probably." },
      { id: 'dock-knight.bark.drip', slot: 'bark', text: "Mind the drip." },
      { id: 'dock-knight.bark.cup', slot: 'bark', text: "One more cup." },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // The Plague Doctor, lounging on his treasure chest among the snow chapel's graves.
  'plague-doctor': {
    persona: {
      id: 'plague-doctor', district: 'galaxy', knows: ['crypt-room', 'graveyard'], rumourDelay: 120, tone: 'dry',
      gag: "Every deed is a symptom and every death a diagnosis; the prescription is always another cup.",
      about: "The beak-masked doctor on the treasure chest in the snow chapel quarter, who prescribes the purple and makes house calls to graves.",
    },
    lines: [
      { id: 'plague-doctor.greet.first', slot: 'greet', text: "Symptoms? Slowness, purple vision, a cup in each hand. Diagnosis: you're in the right quarter. Sit on the chest; it's warm.", when: { metMax: 0 } },
      { id: 'plague-doctor.greet.again', slot: 'greet', text: "The patient returns. Still upright. I'll note it as progress and bill it as a visit.", when: { metMin: 1, metMax: 2 } },
      { id: 'plague-doctor.greet.regular', slot: 'greet', text: "My only living patient. The others are under the snow. Lovely people. Terrible pulse.", when: { metMin: 3 } },
      { id: 'plague-doctor.greet.wizard', slot: 'greet', text: "A floating patient. Posture excellent, pulse unknown, feet unaccounted for. I'll write 'fine'.", when: { hero: 'wizard' } },
      { id: 'plague-doctor.greet.archer', slot: 'greet', text: "Mushrooms. Raw. I'd prescribe them if you hadn't already. Side effects: flight, apparently.", when: { hero: 'archer', metMin: 1 } },

      { id: 'plague-doctor.react.mail', slot: 'react', text: "You killed a mail knight on the street. I'd have treated him. Prognosis: dead. It's always dead here.", when: { event: 'kill', enemy: 'mail-knight' } },
      { id: 'plague-doctor.react.ghoul', slot: 'react', text: "A ghoul down on the plaza. Cause of death: you. Contributing factor: the cup. I'll note both.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'plague-doctor.react.bucket', slot: 'react', text: "A mimic on the street, dead. It had a face. It had teeth. It had a bucket. It had everything but a pulse.", when: { event: 'kill', enemy: 'bucket' } },
      { id: 'plague-doctor.react.hollowstaff', slot: 'react', text: "Old Hollowstaff is gone. He threw diamonds. I'd call that a cry for help. Now he's quiet. Treated.", when: { event: 'kill', enemy: 'diamond-wizard' } },
      { id: 'plague-doctor.react.hurt', slot: 'react', text: "You're bleeding in the snow. The snow is taking notes. Rot Salve, twenty-four. Smells like the pot, works like the pot.", when: { event: 'hurt' } },
      { id: 'plague-doctor.react.down', slot: 'react', text: "You went down among the graves. The graves made room. I talked them out of it. You owe them a drink.", when: { event: 'down' } },
      { id: 'plague-doctor.react.chest', slot: 'react', text: "You opened a chest. Not mine. Mine is full of medicine. And gold. Mostly gold. Medicine is gold, here.", when: { event: 'feat', feat: 'chest' } },
      { id: 'plague-doctor.react.sip', slot: 'react', text: "You drank from your cup. Good. Dose: one cup. Repeat until purple. Stop before you're a patient.", when: { event: 'feat', feat: 'sip' } },
      { id: 'plague-doctor.react.knight', slot: 'react', text: "The knight who glides on his cape. Cape: fine. Cup: fine. Liver: I'd rather not look.", when: { hero: 'knight' } },
      { id: 'plague-doctor.react.wizard', slot: 'react', text: "You float. I'd check your feet, but there's nothing to check. I'll bill for the looking.", when: { hero: 'wizard' } },
      { id: 'plague-doctor.react.ledger', slot: 'react', text: "In the crypt bar below, they say a skeleton sold you a book. Reading. In a bar. I'd prescribe something stronger.", when: { item: 'old-ledger' }, weight: 1.5 },
      { id: 'plague-doctor.react.cyclops-lord', slot: 'react', text: "They say the Grave Cyclops fell at the Alley's end. Cause of death: you. I'll sign it. I sign everything; nobody checks.", when: { event: 'kill', enemy: 'cyclops-lord' } },
      { id: 'plague-doctor.react.boss', slot: 'react', text: "{lastBoss} is dead. I was never called. I'm never called. House calls, and the houses are all graves.", when: { event: 'kill', boss: true } },
      { id: 'plague-doctor.react.levelup', slot: 'react', text: "You've grown. I'll measure you against the chest. Yes. Taller than a chest. Healthy.", when: { event: 'feat', feat: 'levelup' } },

      { id: 'plague-doctor.topic.diagnosis', slot: 'topic', text: "Symptoms? Slowness. Purple vision. My diagnosis: you need another cup. My second diagnosis: another doctor. I'm the only one." },
      { id: 'plague-doctor.topic.chest', slot: 'topic', text: "The chest is full of medicine. And gold. Mostly gold. It's the colour of medicine from a distance, so it's medicine." },
      { id: 'plague-doctor.topic.calls', slot: 'topic', text: "I make house calls. The houses out here are all graves. The patients are patient. The snow does the rest." },
      { id: 'plague-doctor.topic.silence', slot: 'topic', text: "The Hollow King swallowed the kingdom's voices, the head says. I can't treat a swallowed voice. I can treat the king. With you, apparently.", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },
      { id: 'plague-doctor.topic.ended', slot: 'topic', text: "The sound is back. Half my patients sat up to listen. They lay down again. It's a start; I'm billing it as one.", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'plague-doctor.bye.cups', slot: 'bye', text: "Take two cups and see me never." },
      { id: 'plague-doctor.bye.graves', slot: 'bye', text: "Mind the graves. They're shallow, and so are the people in them." },

      { id: 'plague-doctor.bark.symptoms', slot: 'bark', text: "Symptoms?" },
      { id: 'plague-doctor.bark.cup', slot: 'bark', text: "Another cup." },
      { id: 'plague-doctor.bark.gold', slot: 'bark', text: "Mostly gold." },
      { id: 'plague-doctor.bark.pulse', slot: 'bark', text: "Terrible pulse." },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Count Rattlewheel in the black-and-gold carriage at the lean castle's bridge. Take the reins: it is yours.
  'carriage-count': {
    persona: {
      id: 'carriage-count', district: 'galaxy', knows: ['island', 'vale'], rumourDelay: 240, tone: 'warm',
      gag: "The road goes round the castle twice and back; the carriage never arrives, and the horses left years ago without it noticing.",
      about: "The skeleton count in the black-and-gold carriage before the lean castle's bridge, who offers a smoke, a drink and the reins to anyone who climbs up.",
    },
    lines: [
      { id: 'carriage-count.greet.first', slot: 'greet', text: "Climb up, climb up. Smoke? It's purple, it's free, it's terrible for you. A drink for the road; the road goes round the castle twice.", when: { metMax: 0 } },
      { id: 'carriage-count.greet.again', slot: 'greet', text: "Back again. We've been round the castle twice since you left. We never arrive. It's the charm of the thing.", when: { metMin: 1, metMax: 2 } },
      { id: 'carriage-count.greet.regular', slot: 'greet', text: "My favourite passenger. The others got out at the gate. The castle kept them. You keep getting out before the gate; clever.", when: { metMin: 3 } },
      { id: 'carriage-count.greet.driver', slot: 'greet', text: "You've driven her. Nobody drives her and stays a passenger. The bench is yours; the smoke is still mine.", when: { flag: 'carriage', metMin: 1 }, weight: 2 },
      { id: 'carriage-count.greet.knight', slot: 'greet', text: "A knight with a cup. You'll want the bench, then. The reins are there. The horses aren't. Don't let that stop you.", when: { hero: 'knight', metMin: 1 } },

      { id: 'carriage-count.react.reins', slot: 'react', text: "You took the reins. The horses left years ago; the carriage didn't notice. Neither did you. Marvellous.", when: { event: 'feat', feat: 'carriage' }, weight: 3 },
      { id: 'carriage-count.react.first-drive', slot: 'react', text: "The first time anyone has taken the reins since the horses. The carriage felt it. I felt the carriage.", when: { flag: 'carriage' }, once: true, weight: 2 },
      { id: 'carriage-count.react.bucket', slot: 'react', text: "You broke a mimic on the street. They walk under the wheels; the wheels don't mind. I do; it's the noise.", when: { event: 'kill', enemy: 'bucket' } },
      { id: 'carriage-count.react.mail', slot: 'react', text: "A mail knight down at the bridge. He used to salute the carriage. The carriage never saluted back. It's a carriage.", when: { event: 'kill', enemy: 'mail-knight' } },
      { id: 'carriage-count.react.hollowstaff', slot: 'react', text: "Hollowstaff is dead. He threw diamonds at the carriage once. Still in the paintwork. Adds value.", when: { event: 'kill', enemy: 'diamond-wizard' } },
      { id: 'carriage-count.react.ghoul', slot: 'react', text: "A ghoul fewer by the castle. Their cups go under the wheels. The road is sticky all the way round.", when: { event: 'kill', enemy: 'styro-ghoul' } },
      { id: 'carriage-count.react.hurt', slot: 'react', text: "You're bleeding on my upholstery. It's velvet. It has seen worse. The last guest never got out.", when: { event: 'hurt' } },
      { id: 'carriage-count.react.down', slot: 'react', text: "You went down by the moat. I'd have driven to you, but the road goes round the castle. It does not go to the moat.", when: { event: 'down' } },
      { id: 'carriage-count.react.swim', slot: 'react', text: "You swam the moat. It's lean, two metres deep. The castle pours it; the castle is generous. Towel? No towel.", when: { event: 'feat', feat: 'swim' } },
      { id: 'carriage-count.react.wizard', slot: 'react', text: "A floating passenger. You don't need the bench. Take it anyway; the view is better from the bench.", when: { hero: 'wizard' } },
      { id: 'carriage-count.react.archer', slot: 'react', text: "The girl who flies on her bow. You could outpace the carriage. Don't. It's rude to the carriage.", when: { hero: 'archer' } },
      { id: 'carriage-count.react.rider', slot: 'react', text: "They say a rider on a burning horse rode the island's dead wood, and you stopped him. A horse. Showing off.", when: { event: 'kill', enemy: 'emberrider' } },
      { id: 'carriage-count.react.vale', slot: 'react', text: "In the vale, I hear, the castle floats on a dragon's dreams. Mine sits on a rock and pours. Humbler. Wetter.", when: { quest: ['books', ['none', 'active']] }, weight: 1.2 },
      { id: 'carriage-count.react.boss', slot: 'react', text: "{lastBoss} fell. We drove past, probably. We drive past everything. Round, twice, back.", when: { event: 'kill', boss: true } },
      { id: 'carriage-count.react.levelup', slot: 'react', text: "You've grown. The bench will creak. It creaks anyway. Now it will have a reason.", when: { event: 'feat', feat: 'levelup' } },

      { id: 'carriage-count.topic.road', slot: 'topic', text: "The road goes round the castle twice and back. We never arrive. That's the point. Arriving is for people with horses." },
      { id: 'carriage-count.topic.horses', slot: 'topic', text: "The horses left years ago. The carriage didn't notice. I didn't tell it. It's doing so well." },
      { id: 'carriage-count.topic.castle', slot: 'topic', text: "The carriage brings guests to the castle. The castle keeps them. I keep the carriage. Everyone is kept by something." },
      { id: 'carriage-count.topic.silence', slot: 'topic', text: "The voices were swallowed, the head says. The castle still has its windows lit. Lit windows are a kind of talking. I listen.", when: { quest: ['silence', ['told', 'five', 'open']] }, weight: 2 },
      { id: 'carriage-count.topic.ended', slot: 'topic', text: "The sound is back. The carriage creaks in time now. Round the castle twice, in time, and back. We still don't arrive.", when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'carriage-count.bye.step', slot: 'bye', text: "Round again? No? Then mind the step; it's further down than it looks." },
      { id: 'carriage-count.bye.twice', slot: 'bye', text: "Off you go. We'll be round twice before you're back." },

      { id: 'carriage-count.bark.climb', slot: 'bark', text: "Climb up." },
      { id: 'carriage-count.bark.smoke', slot: 'bark', text: "Smoke? It's free." },
      { id: 'carriage-count.bark.arrive', slot: 'bark', text: "We never arrive." },
      { id: 'carriage-count.bark.round', slot: 'bark', text: "Round again." },
    ],
  },
};
