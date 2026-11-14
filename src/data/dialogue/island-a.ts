/**
 * Island dialogue, book A: the north shore and the west (the Stone Head, the Antlered King's court, the hollow, the
 * lonely cliff, the world tree, the village street, the dunes). Pure data for the Mind (src/game/Mind.ts).
 *
 * QUEST GRAPH EXPECTATIONS (data/quests.ts pays these; lines only move stages):
 * silence: none→told (the Stone Head, talk) ; told→five (auto: throne, croak, sound, bell and grave all done) ;
 *   five→open (the head, talk: the Hollow King wakes) ; open→ended (kill hollowking: the sound returns, the concert, credits)
 * throne: none→active (the Antlered King, talk) ; active→slain (kill warden) ; slain→done (the king, talk): +1500 shards, +antler-signet
 * croak: none→active (the Frog King, talk) ; active→bagged ('bag-croak' on Brother Croak) ; bagged→returned (the bag is set down
 *   by the Frog King) ; returned→done by the choice 'No, you must be sick or something' (talk): +400 shards, OR by 'lick' while
 *   croak is 'returned': no shards, the dream begins (the Mind sets done as the lick starts)
 * trip: none→done (waking from the dream after a 'lick') ; done→god (kill dmt-entity in the dream): the Third Eye drops from the god
 * bride: none→walking ('follow' on the Pale Bride; the choice is offered once bell is done) ; walking→done (she reaches the shore)
 * No line in this book pays or gives anything: the stage advance sits on the first choice of each flow, so closing the panel
 * loses nothing and nothing can be collected twice.
 */
import type { Feat } from '../../game/Events';
import type { Cond, DialogueBook } from './types';

const kill = (enemy: string, more: Cond = {}): Cond => ({ event: 'kill', enemy, ...more });
const feat = (what: Feat, more: Cond = {}): Cond => ({ event: 'feat', feat: what, ...more });
const HURT: Cond = { event: 'hurt' };
const DOWN: Cond = { event: 'down' };
const BOSS: Cond = { event: 'kill', boss: true };

export const ISLAND_A: DialogueBook = {
  // ---------------------------------------------------------------------------------------------------------------
  // The Stone Head at the end of the causeway: the kingdom's last voice, and the giver of the main quest.
  // ---------------------------------------------------------------------------------------------------------------
  'stone-head': {
    persona: {
      id: 'stone-head', district: 'island', knows: ['galaxy', 'sunken', 'treehouse', 'dream', 'graveyard', 'vale', 'tavern-room', 'crypt-room'], rumourDelay: 60, tone: 'grim',
      gag: 'Everyone who comes to it is standing in its view.',
      about: 'The giant stone head at the end of the causeway: the last of the kingdom\'s voices, which has watched everything for eleven ages and would like you to move slightly to the left.',
    },
    lines: [
      { id: 'stone-head.greet.first', slot: 'greet', text: 'What are you doing here?', voice: 'head-doing-here', when: { metMax: 0 } },
      { id: 'stone-head.greet.again', slot: 'greet', text: 'You again. Stand to the left. The left is the view I can spare.', when: { metMin: 1, metMax: 2 } },
      { id: 'stone-head.greet.old', slot: 'greet', text: '{hero}. Sit, if you like. I have been sitting for eleven ages. It grows on you.', when: { metMin: 3 } },
      { id: 'stone-head.greet.knight', slot: 'greet', text: 'Sir Aldric. A thousand knights looked up at me. You are the first to do it mid-sip. Finish.', when: { hero: 'knight', metMin: 1 }, weight: 1.2 },
      { id: 'stone-head.greet.wizard', slot: 'greet', text: 'No footprints on my causeway. Good. The rest leave them, and I stare at them for an age.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },
      { id: 'stone-head.greet.archer', slot: 'greet', text: 'The girl on the bow. There is nothing up there that needs shooting. Except what does.', when: { hero: 'archer', metMin: 1 }, weight: 1.2 },
      { id: 'stone-head.greet.ended', slot: 'greet', text: 'Listen. That is the kingdom. Not much, but back. Now move slightly to the left.', when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'stone-head.react.hollowking', slot: 'react', text: 'He is dead. I felt it in my jaw. The sound will take a moment; it has a long way to climb.', when: kill('hollowking'), weight: 4 },
      { id: 'stone-head.react.emberrider', slot: 'react', text: 'The rider in the dead wood burned past my chin every night for an age. Darker now. I prefer it.', when: kill('emberrider') },
      { id: 'stone-head.react.passbeast', slot: 'react', text: 'The beast of the pass ate my pilgrims. Now they will arrive whole and stand in my view.', when: kill('passbeast') },
      { id: 'stone-head.react.troll', slot: 'react', text: 'The troll threw boulders at my left eye for sport. Never once hit. Say that at its grave.', when: kill('troll') },
      { id: 'stone-head.react.cyclops', slot: 'react', text: 'The one-eyed thing in the pool. One eye fewer in this kingdom. Mine are two. I am keeping count.', when: kill('cyclops') },
      { id: 'stone-head.react.hurt', slot: 'react', text: 'Hurt. I have watched eleven ages of it from here. It passes, or the hurt one does. Both are quiet.', when: HURT },
      { id: 'stone-head.react.down', slot: 'react', text: 'You fell. I watched. I have watched better knights fall slower.', when: DOWN },
      { id: 'stone-head.react.skyeye', slot: 'react', text: 'You shot an eye out of the sky. His eyes. He has more. So do I, but mine stay in my head.', when: feat('skyeye') },
      { id: 'stone-head.react.fly', slot: 'react', text: 'You flew past my ear. Nothing has flown past my ear since the wyrm, and the wyrm asked first.', when: feat('fly') },
      { id: 'stone-head.react.lick', slot: 'react', text: 'You licked the frog. I saw it. I saw it the first time too, an age ago. It went the same way.', when: feat('lick') },
      { id: 'stone-head.react.sip', slot: 'react', text: 'You drink from the cup while I talk. The last king did the same. Look where he sits.', when: feat('sip', { hero: 'knight' }) },
      { id: 'stone-head.react.hover', slot: 'react', text: 'You hover. Stop; the hovering is in my view.', when: { hero: 'wizard', metMin: 2 } },
      { id: 'stone-head.react.leanking', slot: 'react', text: 'I heard, late, as stone hears: the sad king got up from his porcelain and you put him back on it.', when: kill('rift-king') },
      { id: 'stone-head.react.anglers', slot: 'react', text: 'The fish under the lake lost an angler. News travels up through water slowly. It arrived.', when: kill('angler') },
      { id: 'stone-head.react.gravelord', slot: 'react', text: 'The Grave Cyclops is dead. The skeleton who counts will pay you. Stone never understood paying.', when: kill('cyclops-lord') },
      { id: 'stone-head.react.boss', slot: 'react', text: '{lastBoss} is dead. I heard it fall. Everything that falls on this island falls in my ear.', when: BOSS },

      { id: 'stone-head.topic.silence', slot: 'topic', ask: 'What of the five voices?', text: "The Hollow King ate the kingdom's five voices and sat on my shore to digest. Still digesting.", when: { quest: ['silence', 'none'] }, weight: 3, choices: [
        { label: 'Five voices?', to: 'stone-head.topic.five' },
        { label: 'What has that to do with me?', to: 'stone-head.topic.earn' },
        { label: 'I am only passing.', action: 'close' },
      ] },
      { id: 'stone-head.topic.five', slot: 'topic', ask: 'Who were the five kings?', text: 'Antlers. A frog. A sad one on his porcelain. A fish under the lake. A skeleton who counts.', when: { quest: ['silence', ['none', 'told']] }, choices: [
        { label: 'And the voices?', to: 'stone-head.topic.earn', when: { quest: ['silence', 'none'] } },
        { label: 'Where do I begin?', to: 'stone-head.topic.begin' },
      ] },
      { id: 'stone-head.topic.earn', slot: 'topic', ask: 'What must I do?', text: 'Help each king; each owes a voice. Bring me five and I will tell you how to wake what ate them.', when: { quest: ['silence', 'none'] }, choices: [
        { label: 'I will gather them.', action: 'quest:silence:told', to: 'stone-head.topic.begin' },
        { label: 'Not today.', action: 'close' },
      ] },
      { id: 'stone-head.topic.begin', slot: 'topic', ask: 'Where do I begin?', text: 'Begin with the antlered one, in the west, sulking at the castle he lost. He has silence to spare.', when: { quest: ['silence', 'told'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'stone-head.topic.told', slot: 'topic', ask: 'How are my voices?', text: 'Five voices. I hear each one arrive; you rattle a little more each time you climb my stairs.', when: { quest: ['silence', 'told'], metMin: 1 }, weight: 2, choices: [
        { label: 'The Antlered King has his throne.', to: 'stone-head.topic.v-throne', when: { quest: ['throne', 'done'] } },
        { label: 'The Frog King has his son.', to: 'stone-head.topic.v-croak', when: { quest: ['croak', 'done'], flag: 'licked' } },
        { label: 'The Frog King has his son.', to: 'stone-head.topic.v-croak-dry', when: { quest: ['croak', 'done'], notFlag: 'licked' } },
        { label: 'Yung Lean has his sound.', to: 'stone-head.topic.v-sound', when: { quest: ['sound', 'done'] } },
        { label: 'The Fish King has his bell.', to: 'stone-head.topic.v-bell', when: { quest: ['bell', 'done'] } },
        { label: 'The Grave Cyclops is dead.', to: 'stone-head.topic.v-grave', when: { quest: ['grave', 'done'] } },
        { label: 'Which kings are left?', to: 'stone-head.topic.five' },
        { label: 'Leave', action: 'close' },
      ] },
      { id: 'stone-head.topic.v-throne', slot: 'topic', ask: 'Did you hear the Antlered King?', text: 'I heard him laugh. Not a good laugh, but a loud one, and loud is what I asked for.', when: { quest: ['throne', 'done'] }, choices: [{ label: 'Back', to: 'stone-head.topic.told' }] },
      { id: 'stone-head.topic.v-croak', slot: 'topic', ask: 'Did you hear the Frog King?', text: 'I heard the sack open. Then the licking. Nobody has to lick him. Everybody does.', when: { quest: ['croak', 'done'], flag: 'licked' }, choices: [{ label: 'Back', to: 'stone-head.topic.told' }] },
      { id: 'stone-head.topic.v-croak-dry', slot: 'topic', ask: 'Did you hear the Frog King?', text: 'I heard the sack open, and no licking. Everyone licks. You did not. It was quieter.', when: { quest: ['croak', 'done'], notFlag: 'licked' }, choices: [{ label: 'Back', to: 'stone-head.topic.told' }] },
      { id: 'stone-head.topic.v-sound', slot: 'topic', ask: "Did you hear Yung Lean's sound?", text: 'The sad one gave you a blade for nothing and called it even. He is wiser than his coat.', when: { quest: ['sound', 'done'] }, choices: [{ label: 'Back', to: 'stone-head.topic.told' }] },
      { id: 'stone-head.topic.v-bell', slot: 'topic', ask: 'Did you hear the bell ring?', text: 'Under the lake, yes. Stone hears through water like you hear through a wall: late, but all of it.', when: { quest: ['bell', 'done'] }, choices: [{ label: 'Back', to: 'stone-head.topic.told' }] },
      { id: 'stone-head.topic.v-grave', slot: 'topic', ask: 'What of the Grave Crown?', text: 'The counter of coins let you keep the crown. A skeleton giving something away: that is his voice.', when: { quest: ['grave', 'done'] }, choices: [{ label: 'Back', to: 'stone-head.topic.told' }] },
      { id: 'stone-head.topic.open', slot: 'topic', ask: 'I have all five voices.', text: 'I hear them in you. The shore, my left, your right: a giant with a castle in his ribs. Wake him.', when: { quest: ['silence', 'five'] }, weight: 4, choices: [
        { label: 'I will wake him.', action: 'quest:silence:open', to: 'stone-head.topic.go' },
        { label: 'Not yet.', action: 'close' },
      ] },
      { id: 'stone-head.topic.go', slot: 'topic', ask: 'Wish me luck.', text: 'Luck is for things that move. Win, and I will hear. Lose, and it will be quieter.', when: { quest: ['silence', 'open'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'stone-head.topic.awake', slot: 'topic', ask: 'Where is he?', text: 'Awake, on the shore to my left. I feel him breathing through my chin. Why are you still here?', when: { quest: ['silence', 'open'], metMin: 1 }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'stone-head.topic.after', slot: 'topic', ask: 'Can you hear the kingdom now?', text: 'The gnome found his singer and the plaza is loud. I am stone. I should not care. I care.', when: { quest: ['silence', 'ended'] }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'stone-head.topic.self', slot: 'topic', ask: 'About you', text: "I was a king's voice first. The stone is a guest. It came an age ago and never left.", choices: [{ label: 'Leave', action: 'close' }] },

      { id: 'stone-head.bye.view', slot: 'bye', text: 'Go. The view is better without you in it.' },
      { id: 'stone-head.bye.here', slot: 'bye', text: 'Come back when you have something to say. I will still be here. It is the one thing I am sure of.' },
      { id: 'stone-head.bye.stairs', slot: 'bye', text: 'Go down the way you came up. The stairs are mine too; they remember.' },

      { id: 'stone-head.bark.view', slot: 'bark', text: "You're blocking my view!", voice: 'head-blocking' },
      { id: 'stone-head.bark.doing', slot: 'bark', text: 'What are you doing here?', voice: 'head-doing-here' },
      { id: 'stone-head.bark.left', slot: 'bark', text: 'Left. No. My left.' },
      { id: 'stone-head.bark.sleep', slot: 'bark', text: 'Stone does not sleep. It only looks like it.' },
      { id: 'stone-head.bark.still', slot: 'bark', text: 'Still here.' },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // The Antlered King on his throne of antlers and bone, west of the stream: quest 'throne', and a shop.
  // ---------------------------------------------------------------------------------------------------------------
  king: {
    persona: {
      id: 'king', district: 'island', knows: ['galaxy', 'graveyard'], rumourDelay: 120, tone: 'dry',
      gag: 'He is very generous, and says so; the Skeleton King beyond the portal claims to pay better.',
      about: 'The green-skinned king on the antler throne who lost his castle to his own warden and buys whatever the great ones drop, very generously.',
    },
    lines: [
      { id: 'king.greet.first', slot: 'greet', text: 'Kneel or do not. The candles do not care.', when: { metMax: 0 } },
      { id: 'king.greet.again', slot: 'greet', text: 'Twice now. The candles remember you. They are the only ones here who do.', when: { metMin: 1, metMax: 2 } },
      { id: 'king.greet.old', slot: 'greet', text: '{hero}. The candles lean when you come in now. I have told them it is unbecoming; they are candles.', when: { metMin: 3 } },
      { id: 'king.greet.knight', slot: 'greet', text: 'Sir Aldric. My court was knights with cups, once. The cups are still here. They were the loyal half.', when: { hero: 'knight', metMin: 1 }, weight: 1.2 },
      { id: 'king.greet.wizard', slot: 'greet', text: 'Orlan. Above my floor. The floor is the one thing the Warden left me; use it.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },
      { id: 'king.greet.archer', slot: 'greet', text: 'A girl on a bow. The last archer here shot a candle. I kept the candle. I did not keep the archer.', when: { hero: 'archer', metMin: 1 }, weight: 1.2 },

      { id: 'king.react.warden', slot: 'react', text: 'The Warden is dead. You walked through its antlers and it did not even sulk. Very satisfying. Very.', when: kill('warden'), weight: 3 },
      { id: 'king.react.rivershade', slot: 'react', text: "The shade in the witch's stream flooded my cellar every spring. My cellar thanks you. A first.", when: kill('rivershade') },
      { id: 'king.react.beast', slot: 'react', text: 'Fog beasts by the stream, dead. They ate my messengers. Now I must hire new ones. Generously.', when: kill('beast') },
      { id: 'king.react.loggiant', slot: 'react', text: 'The log giant carried my firewood for eleven years and never arrived. Now he is dead. Even.', when: kill('loggiant') },
      { id: 'king.react.spider', slot: 'react', text: 'The walking chapel fell. I bet the witch it would land on her. Lost the bet; won the view.', when: kill('spiderchapel') },
      { id: 'king.react.hurt', slot: 'react', text: 'You are bleeding on my floor. Bleed on the candles; they like it.', when: HURT },
      { id: 'king.react.down', slot: 'react', text: 'You went down by the stream. The fog brings back what it finds. Not the coins. Never the coins.', when: DOWN },
      { id: 'king.react.lick', slot: 'react', text: 'You licked the frog. The frog is my neighbour. We do not speak; now I know why.', when: feat('lick') },
      { id: 'king.react.chest', slot: 'react', text: 'You opened a chest. If it was mine, I pay generously for its return. If it was not mine, it is now.', when: feat('chest') },
      { id: 'king.react.sip', slot: 'react', text: 'Sip while I speak and I will charge you for the air.', when: feat('sip', { hero: 'knight' }) },
      { id: 'king.react.float', slot: 'react', text: 'The floating. Stop the floating. A king should be the tallest thing in the room.', when: { hero: 'wizard', metMin: 1 } },
      { id: 'king.react.bucket', slot: 'react', text: 'The skeleton pays you to break buckets? I pay better. In coins and in silence; he only has coins.', when: kill('bucket') },
      { id: 'king.react.leanking', slot: 'react', text: 'The sad king lost his throne for a minute, I heard. Mine was lost for a year. We are not the same.', when: kill('rift-king') },
      { id: 'king.react.gravelord', slot: 'react', text: 'A dead cyclops. The skeleton will pay nine hundred for it, coins he could have spent here.', when: kill('cyclops-lord') },
      { id: 'king.react.mythic', slot: 'react', text: 'That thing you carry is mythic. I can tell from here; the candles leaned toward it.', when: { flag: 'equipped-mythic' }, once: true },
      { id: 'king.react.boss', slot: 'react', text: '{lastBoss}. Dead. Whatever it dropped, bring it here first. The skeleton will only count it.', when: BOSS },

      { id: 'king.topic.ask', slot: 'topic', ask: 'About the Warden', text: 'The Warden. My own antlered warden has taken my castle, and the throne within it. Kill it, and I will reward you... very generously.', voice: 'king-ask', when: { quest: ['throne', 'none'] }, weight: 3, choices: [
        { label: "I'll do it.", action: 'quest:throne:active', to: 'king.topic.go' },
        { label: 'What would I get?', to: 'king.topic.offer' },
        { label: 'Not now.', action: 'close' },
      ] },
      { id: 'king.topic.offer', slot: 'topic', ask: 'What would I get?', text: 'Coins. A great many. And my signet, which makes any blade hungrier. Very generous, as I said.', when: { quest: ['throne', 'none'] }, choices: [
        { label: "I'll do it.", action: 'quest:throne:active', to: 'king.topic.go' },
        { label: 'Not now.', action: 'close' },
      ] },
      { id: 'king.topic.go', slot: 'topic', ask: 'Where is the Warden?', text: 'Then go. It sulks in the east forest, under the rain.', when: { quest: ['throne', 'active'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'king.topic.wait', slot: 'topic', ask: "I haven't found the Warden yet.", text: 'The Warden still breathes. I can hear it chewing my furniture.', voice: 'king-wait', when: { quest: ['throne', 'active'], metMin: 1 }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'king.topic.thanks', slot: 'topic', ask: 'The Warden is dead', text: 'It is dead? Then the castle is mine again. Take it, all of it. I said generously, and I meant it.', voice: 'king-thanks', when: { quest: ['throne', 'slain'] }, weight: 4, choices: [
        { label: 'Take the reward', action: 'quest:throne:done', to: 'king.topic.purse' },
      ] },
      { id: 'king.topic.purse', slot: 'topic', ask: 'Is the reward all here?', text: 'Fifteen hundred Gold Coins. Count them if you like; I did, twice, and it hurt both times.', when: { quest: ['throne', 'done'] }, once: true, choices: [
        { label: 'Take the coins', to: 'king.topic.signet' },
      ] },
      { id: 'king.topic.signet', slot: 'topic', ask: 'About the signet', text: 'My seal. Any blade wearing it bites deeper. Sell it; I am past caring. That is generosity.', when: { quest: ['throne', 'done'] }, once: true, choices: [
        { label: 'Take the signet', to: 'king.topic.sealed' },
      ] },
      { id: 'king.topic.sealed', slot: 'topic', ask: 'What now?', text: 'Now go and tell the skeleton beyond the portal what I paid. Slowly. He counts slowly.', when: { quest: ['throne', 'done'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'king.topic.crown', slot: 'topic', ask: 'About your crown', text: 'My crown was antlers before it was gold. The Warden was my gardener. Never trust a hedge.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'king.topic.buys', slot: 'topic', ask: 'What do you buy?', text: 'I buy what the great ones drop: fangs, horns, scales, ribs. Bring them here; I do not get up.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'king.topic.rival', slot: 'topic', ask: 'The Skeleton King', text: 'He says he pays better, in coins he took at his bridge. Mine I took from nobody. Mostly.', when: { metMin: 2 }, choices: [{ label: 'Leave', action: 'close' }] },

      { id: 'king.bye.gen', slot: 'bye', text: 'Go. Generously.' },
      { id: 'king.bye.candles', slot: 'bye', text: 'The candles will show you out. They have no other duties.' },
      { id: 'king.bye.skeleton', slot: 'bye', text: 'Tell the skeleton nothing. He writes it down.' },

      { id: 'king.bark.candles', slot: 'bark', text: 'Bring it to the throne.' },
      { id: 'king.bark.pay', slot: 'bark', text: 'I pay better. Remember that.' },
      { id: 'king.bark.throne', slot: 'bark', text: 'The throne is in use.' },
      { id: 'king.bark.kneel', slot: 'bark', text: 'Kneel or do not.' },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // The Vigil, kneeling in the cloister by the tavern yard: listening for the bell, for hire.
  // ---------------------------------------------------------------------------------------------------------------
  vigil: {
    persona: {
      id: 'vigil', district: 'island', knows: ['sunken', 'graveyard'], rumourDelay: 150, tone: 'warm',
      gag: 'He hears everything and gets up for nothing.',
      about: 'The knight who knelt in the cloister when the last bell rang and has been listening since; two hundred coins and he walks beside you.',
    },
    lines: [
      { id: 'vigil.greet.first', slot: 'greet', text: 'I knelt when the last bell rang. Still listening. Walk to the stone head, {hero}; it heard more.', when: { metMax: 0 } },
      { id: 'vigil.greet.again', slot: 'greet', text: 'Back. Quieter. Either you learned or you are hurt. Do not say which; I am listening for it.', when: { metMin: 1, metMax: 2 } },
      { id: 'vigil.greet.old', slot: 'greet', text: 'Those footsteps. You have changed shoes twice since the first visit. I noticed; I did not get up.', when: { metMin: 3 } },
      { id: 'vigil.greet.wizard', slot: 'greet', text: 'Your boots make no sound. I had to open my eyes to know you were here. I resent that.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },
      { id: 'vigil.greet.knight', slot: 'greet', text: 'Sir Aldric. You carry that cup like a relic. Perhaps it is one; I never ask what is in relics.', when: { hero: 'knight', metMin: 1 }, weight: 1.2 },
      { id: 'vigil.greet.ended', slot: 'greet', text: 'The bell. I hear it. I can stand up now. I had forgotten how; it turns out the knees remember.', when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'vigil.react.golem', slot: 'react', text: 'The crystal men in the sand. I heard them shatter from here. It is the first new sound in a year.', when: kill('crystalsentry') },
      { id: 'vigil.react.cyclops', slot: 'react', text: 'The cyclops in the eye pool. I heard it go down. The water is still settling.', when: kill('cyclops') },
      { id: 'vigil.react.warden', slot: 'react', text: 'The antlered one in the east forest. It stopped. Even the rain seems to have noticed.', when: kill('warden') },
      { id: 'vigil.react.lurker', slot: 'react', text: 'The thing in the lily pond: a splash, then no splash. That second sound was lovely.', when: kill('lurker') },
      { id: 'vigil.react.hurt', slot: 'react', text: 'You are hurt. I can hear it in your breathing. Sit. The stone is cold, but it is honest.', when: HURT },
      { id: 'vigil.react.down', slot: 'react', text: 'I heard you go down. All of it. The oath held me here, and I have never liked it less.', when: DOWN },
      { id: 'vigil.react.ale', slot: 'react', text: 'You drank the rowers\' beer. I can hear it in your footsteps. They have opinions now.', when: feat('ale') },
      { id: 'vigil.react.fly', slot: 'react', text: 'Something flew over the cloister just now. If it was you, you fly loudly.', when: feat('fly') },
      { id: 'vigil.react.bounce', slot: 'react', text: 'You bounced on a mushroom. I heard the mushroom. The mushroom is fine.', when: feat('bounce') },
      { id: 'vigil.react.archer', slot: 'react', text: 'Wren. Your bowstring hums when you walk. Tune it, or do not. I like the note.', when: { hero: 'archer', metMin: 1 } },
      { id: 'vigil.react.sip', slot: 'react', text: 'Drink. I will not look. The oath says nothing about cups.', when: feat('sip', { hero: 'knight' }) },
      { id: 'vigil.react.bell', slot: 'react', text: 'They say the bell under the lake is found. I heard nothing. I am listening harder.', when: { quest: ['bell', 'done'] }, once: true, weight: 2 },
      { id: 'vigil.react.grave', slot: 'react', text: 'Skeletons rising in the alley of graves, so I hear. Bones are loud. I am glad to be far from it.', when: kill('grave-skeleton') },
      { id: 'vigil.react.fishguard', slot: 'react', text: "You fought the fish king's guards under the lake. Under water it must be so quiet. I am jealous.", when: kill('fish-guard') },
      { id: 'vigil.react.boss', slot: 'react', text: '{lastBoss} fell somewhere. The island rang like a struck shield. I felt it in my knees.', when: BOSS },

      { id: 'vigil.topic.head', slot: 'topic', ask: 'About the stone head', text: "The head at the end of the causeway was a king's voice. Still is. Walk up; it speaks first.", when: { quest: ['silence', 'none'] }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'vigil.topic.bell', slot: 'topic', ask: 'About the last bell', text: 'It rang once, the day the giant sat on the north shore. I wait for the second. Bells come in twos.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'vigil.topic.hire', slot: 'topic', ask: 'About hiring your sword', text: 'My oath is cheap; my sword is not. Two hundred coins and I get up; nothing else has managed it.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'vigil.topic.cloister', slot: 'topic', ask: 'About this cloister', text: 'The cloister was a chapel once. The roof left. The arches stayed; arches are stubborn, like knees.', when: { metMin: 2 }, choices: [{ label: 'Leave', action: 'close' }] },

      { id: 'vigil.bye.quiet', slot: 'bye', text: 'Go quietly.' },
      { id: 'vigil.bye.hear', slot: 'bye', text: 'I will hear you coming back.' },
      { id: 'vigil.bye.head', slot: 'bye', text: 'Walk toward the head.' },

      { id: 'vigil.bark.listening', slot: 'bark', text: 'Listening.' },
      { id: 'vigil.bark.quieter', slot: 'bark', text: 'Quieter.' },
      { id: 'vigil.bark.bell', slot: 'bark', text: 'Was that a bell? No.' },
      { id: 'vigil.bark.kneel', slot: 'bark', text: 'Still kneeling.' },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // Brother Croak, reading in the castle's shadow: the target of 'croak', and a tea seller who denies everything.
  // ---------------------------------------------------------------------------------------------------------------
  croak: {
    persona: {
      id: 'croak', district: 'island', knows: ['dream', 'galaxy'], rumourDelay: 180, tone: 'dry',
      gag: 'Whatever it is, it is not his.',
      about: 'The Frog King\'s son, a monk who reads in the shady places and sells tea, and who has never once owned anything you found on him.',
    },
    lines: [
      { id: 'croak.greet.first', slot: 'greet', text: 'The lotus opens for the moon, not for you. Sit anyway.', when: { metMax: 0 } },
      { id: 'croak.greet.again', slot: 'greet', text: 'Still here. I have not moved. Moving is how they find you.', when: { metMin: 1, metMax: 2 } },
      { id: 'croak.greet.old', slot: 'greet', text: 'Ribbit. You keep finding me. Nobody else manages it; I am taking it personally. Tea?', when: { metMin: 3 } },
      { id: 'croak.greet.archer', slot: 'greet', text: 'Wren. You eat mushrooms as you walk. I respect a diet.', when: { hero: 'archer', metMin: 1 }, weight: 1.2 },
      { id: 'croak.greet.wizard', slot: 'greet', text: 'Orlan. I would float too, but then they would see me over the wall.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },
      { id: 'croak.greet.sacked', slot: 'greet', text: 'You carried me home in a sack. I have made peace with the sack. Not with you.', when: { quest: ['croak', ['returned', 'done']], metMin: 1 }, weight: 2 },

      { id: 'croak.react.rivershade', slot: 'react', text: 'The stream shade floated past at night and judged me. I get enough of that from my father.', when: kill('rivershade') },
      { id: 'croak.react.beast', slot: 'react', text: 'The fog beasts never bothered me. We had an arrangement. The arrangement was tea.', when: kill('beast') },
      { id: 'croak.react.spider', slot: 'react', text: 'The walking chapel came down. I set my reading by it. Now I read when I like, which is always.', when: kill('spiderchapel') },
      { id: 'croak.react.warden', slot: 'react', text: 'You killed the Warden. The king will be insufferable. Was insufferable. Will remain.', when: kill('warden') },
      { id: 'croak.react.hurt', slot: 'react', text: 'Bleeding? Lotus tea, thirty coins. It does not stop the bleeding, but you stop minding.', when: HURT },
      { id: 'croak.react.down', slot: 'react', text: 'The fog left you by my tea. Free of charge. Terrible for business.', when: DOWN },
      { id: 'croak.react.lick', slot: 'react', text: 'You licked my father. Everyone does, eventually. He calls it respect.', when: feat('lick') },
      { id: 'croak.react.ale', slot: 'react', text: 'The rowers\' beer. I sold them the yeast. Do not tell them what it was.', when: feat('ale') },
      { id: 'croak.react.knight', slot: 'react', text: 'That cup. What is in it? No. Do not tell me. I would have to sell you a better one.', when: { hero: 'knight', metMin: 1 } },
      { id: 'croak.react.sip', slot: 'react', text: 'You sipped. In front of a monk. The monk sells tea. Think about the order of things.', when: feat('sip', { hero: 'knight' }) },
      { id: 'croak.react.float', slot: 'react', text: 'Stop floating. The king can see over the wall when you float, and then he can see me.', when: { hero: 'wizard', metMin: 2 } },
      { id: 'croak.react.god', slot: 'react', text: 'You killed the Frog God in my father\'s dream, I hear. He is going to wake up so loud.', when: kill('dmt-entity') },
      { id: 'croak.react.bubble', slot: 'react', text: 'Lean bubbles popped in the dream, they say. Not mine. Nothing in there is mine. Or out here.', when: kill('lean-bubble') },
      { id: 'croak.react.ghoul', slot: 'react', text: 'You popped a styro-ghoul, I hear. Their cups are purple. Mine is tea. For the record.', when: kill('styro-ghoul') },
      { id: 'croak.react.boss', slot: 'react', text: '{lastBoss}, dead. Tea afterwards. Thirty coins. The price is the same; the need is not.', when: BOSS },

      { id: 'croak.topic.busted', slot: 'topic', ask: 'Your father sent me', text: "Ribbit. Whatever my dad told you, it's not mine.", voice: 'croak-busted', when: { quest: ['croak', 'active'] }, weight: 4, choices: [
        { label: 'Your father wants you home.', to: 'croak.topic.moved' },
        { label: 'Put him in the bag', to: 'croak.topic.sacked' },
        { label: 'Leave', action: 'close' },
      ] },
      { id: 'croak.topic.moved', slot: 'topic', ask: 'He wants you home', text: 'Ribbit. Tell him I moved to the lotus pond. Permanently.', when: { quest: ['croak', 'active'] }, choices: [
        { label: 'Into the sack.', to: 'croak.topic.sacked' },
        { label: 'Leave', action: 'close' },
      ] },
      { id: 'croak.topic.sacked', slot: 'topic', ask: 'Into the sack', text: 'Hey! Hey! Not the sack again!', voice: 'croak-bagged', when: { quest: ['croak', 'active'] }, choices: [
        { label: 'In you go.', action: 'bag-croak' },
      ] },
      { id: 'croak.topic.king', slot: 'topic', ask: 'Your father the Frog King', text: 'He dreams in the hollow. Do not wake him with iron. Use your tongue, like everyone else.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'croak.topic.tea', slot: 'topic', ask: 'About lotus tea', text: 'Lotus tea steadies the blade hand. Thirty coins. Moon dew, forty. I do not haggle; haggling is loud.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'croak.topic.shade', slot: 'topic', ask: 'Why hide here?', text: 'Hide? I am reading. The king has never once looked at his own wall. Kings look out.', when: { metMin: 1 }, choices: [{ label: 'Leave', action: 'close' }] },

      { id: 'croak.bye.unseen', slot: 'bye', text: 'Ribbit. You did not see me.' },
      { id: 'croak.bye.wall', slot: 'bye', text: 'Keep to the wall. The king has never once looked at it.' },
      { id: 'croak.bye.read', slot: 'bye', text: 'Read something. Not to me.' },

      { id: 'croak.bark.mine', slot: 'bark', text: "...it's not mine." },
      { id: 'croak.bark.shh', slot: 'bark', text: 'Shh.' },
      { id: 'croak.bark.page', slot: 'bark', text: 'Page forty.' },
      { id: 'croak.bark.tea', slot: 'bark', text: 'Tea?' },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // The Frog King in the hollow: quest 'croak', the lick into his dream, and the god you kill there.
  // ---------------------------------------------------------------------------------------------------------------
  frogking: {
    persona: {
      id: 'frogking', district: 'island', knows: ['dream', 'galaxy'], rumourDelay: 90, tone: 'warm',
      gag: 'As a sign of respect, you may lick him.',
      about: 'The old frog whose skin is a door into his own dream, who wants his son home and will accept a lick as thanks.',
    },
    lines: [
      { id: 'frogking.greet.first', slot: 'greet', text: 'Ribbit. The hollow is mine, and the dreams in it. You are standing in one. Tread softly; it bruises.', when: { metMax: 0 } },
      { id: 'frogking.greet.again', slot: 'greet', text: 'Stranger. Back again. The colours missed you.', when: { metMin: 1, metMax: 2 } },
      { id: 'frogking.greet.old', slot: 'greet', text: 'My friend. Ribbit. The colours have learned your name. They say it wrong, but fondly.', when: { metMin: 3 } },
      { id: 'frogking.greet.licked', slot: 'greet', text: 'Ah. You have the look of one who has seen the inside of my skin. It never quite leaves the eyes.', when: { flag: 'licked', metMin: 1 }, weight: 1.5 },
      { id: 'frogking.greet.knight', slot: 'greet', text: 'Sir Aldric. Is the cup purple? My skin does purple. My skin does everything, given a tongue.', when: { hero: 'knight', metMin: 1 }, weight: 1.2 },

      { id: 'frogking.react.lurker', slot: 'react', text: 'The thing in the lily pond, dead. It ate my lotuses and never once said they were good.', when: kill('lurker') },
      { id: 'frogking.react.bloodeye', slot: 'react', text: 'The eye over the chasm closed. I waved at it every morning for an age. It never waved back.', when: kill('blood-eye') },
      { id: 'frogking.react.troll', slot: 'react', text: 'The troll in the gorge. Croak sold him something once. Whatever it was, it did not help him today.', when: kill('troll') },
      { id: 'frogking.react.cyclops', slot: 'react', text: 'The cyclops in the eye pool is dead. One eye. I have dreamed a thousand and never once dreamed one.', when: kill('cyclops') },
      { id: 'frogking.react.hurt', slot: 'react', text: 'You are hurt, stranger. Sit. The moss is clean; the hollow is old enough to be clean.', when: HURT },
      { id: 'frogking.react.down', slot: 'react', text: 'You went down in my hollow. The dreams nearly took you. They are polite dreams; they put you back.', when: DOWN },
      { id: 'frogking.react.lick', slot: 'react', text: 'You licked. Ribbit. Everyone says they will not, and then.', when: feat('lick') },
      { id: 'frogking.react.bounce', slot: 'react', text: 'You bounced on a mushroom. The mushrooms are mine too. They like it; they do not say so.', when: feat('bounce') },
      { id: 'frogking.react.swim', slot: 'react', text: 'You swam the pond. Croak swims it when he is avoiding me. So, often.', when: feat('swim') },
      { id: 'frogking.react.wizard', slot: 'react', text: 'You float like a thought. In there, I am made of thoughts. Do not float into the wrong one.', when: { hero: 'wizard', metMin: 1 } },
      { id: 'frogking.react.archer', slot: 'react', text: 'The girl on the bow eats mushrooms. Not mine, I hope. Mine are for sitting on and for bouncing.', when: { hero: 'archer', metMin: 1 } },
      { id: 'frogking.react.painter', slot: 'react', text: 'You killed the painter in my dream. The colours will run for a while; let them.', when: kill('trip-wizard') },
      { id: 'frogking.react.god', slot: 'react', text: 'You slew my god. In my own dream. I woke with a headache the size of the moon. Ribbit.', when: kill('dmt-entity'), weight: 3 },
      { id: 'frogking.react.leanking', slot: 'react', text: 'The sad king lets you fight for his crown; I let you fight a god for an eye. We are both generous.', when: kill('rift-king') },
      { id: 'frogking.react.bagged', slot: 'react', text: 'My boy, in a sack, on your back. I can hear him complaining from here. That is how I know it is him.', when: { quest: ['croak', 'bagged'] }, weight: 3 },
      { id: 'frogking.react.boss', slot: 'react', text: '{lastBoss}, I heard. The hollow heard. The hollow hears everything; it is shaped like an ear.', when: BOSS },

      { id: 'frogking.topic.ask', slot: 'topic', ask: 'About your son Croak', text: "My son Croak has wandered off again. Find him, stranger. He might be dealing things he shouldn't be... again.", voice: 'frog-ask', when: { quest: ['croak', 'none'] }, weight: 3, choices: [
        { label: "I'll find him.", action: 'quest:croak:active', to: 'frogking.topic.where' },
        { label: 'Not my problem.', action: 'close' },
      ] },
      { id: 'frogking.topic.where', slot: 'topic', ask: 'Where is Croak?', text: "Try the shade of the king's castle. Use the sack; he never walks where he is told. Gets it from me.", when: { quest: ['croak', 'active'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'frogking.topic.wait', slot: 'topic', ask: "I haven't found Croak yet.", text: 'Croak is still out there. Try the shady places. He likes the shady places.', voice: 'frog-wait', when: { quest: ['croak', ['active', 'bagged']], metMin: 1 }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'frogking.topic.reward', slot: 'topic', ask: 'Croak is home', text: 'My boy, home in a sack! You have my thanks, stranger. As a sign of respect... you may lick me.', voice: 'frog-reward', when: { quest: ['croak', 'returned'] }, weight: 4, choices: [
        { label: 'No, you must be sick or something', action: 'quest:croak:done', to: 'frogking.topic.declined' },
        { label: 'Uhh... sure', to: 'frogking.topic.licked' },
      ] },
      { id: 'frogking.topic.declined', slot: 'topic', ask: "I'd rather not lick you.", text: 'Suit yourself. Here, take some coins instead.', voice: 'frog-declined', when: { quest: ['croak', 'done'], notFlag: 'licked' }, once: true, weight: 3, choices: [
        { label: 'Take the coins', action: 'close' },
      ] },
      { id: 'frogking.topic.licked', slot: 'topic', ask: 'May I lick you?', text: 'Hold still. This will only take about two minutes.', voice: 'frog-licked', when: { quest: ['croak', 'returned'] }, choices: [
        { label: '*lick*', action: 'lick' },
      ] },
      { id: 'frogking.topic.changed', slot: 'topic', ask: 'About that lick...', text: 'Changed your mind? The offer stands. It has stood for an age; it is used to standing.', when: { quest: ['croak', 'done'], notFlag: 'licked', metMin: 1 }, weight: 2, choices: [
        { label: '*lick*', action: 'lick' },
        { label: 'Still no.', action: 'close' },
      ] },
      { id: 'frogking.topic.anytime', slot: 'topic', ask: 'May I lick you again?', text: 'Ah, my friend. You can lick me any time you want.', voice: 'frog-anytime', when: { quest: ['trip', ['done', 'god']] }, weight: 2, choices: [
        { label: '*lick*', action: 'lick' },
        { label: 'Not today.', action: 'close' },
      ] },
      { id: 'frogking.topic.god', slot: 'topic', ask: 'The god you lost', text: 'You killed my god and took his eye. Keep it. He has two more; he only ever opened the third for you.', when: { quest: ['trip', 'god'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'frogking.topic.skin', slot: 'topic', ask: 'Your dreaming skin', text: 'My skin holds colours you have never seen. The only door is a tongue. I have looked for another.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'frogking.topic.tadpole', slot: 'topic', ask: 'Croak as a tadpole', text: 'Croak was such a good tadpole. Then he learned to read. Reading leads to selling.', when: { metMin: 1 }, choices: [{ label: 'Leave', action: 'close' }] },

      { id: 'frogking.bye.colours', slot: 'bye', text: 'Ribbit. Mind the colours on the way out.' },
      { id: 'frogking.bye.croak', slot: 'bye', text: 'Go, stranger. Tell Croak nothing; he already knows.' },
      { id: 'frogking.bye.dream', slot: 'bye', text: 'The hollow will dream of you. Badly, but fondly.' },

      { id: 'frogking.bark.ribbit', slot: 'bark', text: 'Ribbit.' },
      { id: 'frogking.bark.tadpole', slot: 'bark', text: 'Croak was such a good tadpole.' },
      { id: 'frogking.bark.colours', slot: 'bark', text: 'The colours are restless today.' },
      { id: 'frogking.bark.lick', slot: 'bark', text: 'You may lick me. Later.' },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // Sir Halvard, sitting on the lonely cliff above the pass with his greatsword, watching the lit windows: for hire.
  // ---------------------------------------------------------------------------------------------------------------
  sentry: {
    persona: {
      id: 'sentry', district: 'island', knows: ['galaxy', 'crypt-room'], rumourDelay: 200, tone: 'grim',
      gag: 'For three hundred coins he will stand. Everything else he does sitting down.',
      about: 'The knight who has sat on the cliff edge for a hundred years watching a castle whose windows are lit and whose doors never open; three hundred coins and he stands.',
    },
    lines: [
      { id: 'sentry.greet.first', slot: 'greet', text: 'Lit for a hundred years, those windows, and no one has come out. Sit; the cliff has room.', when: { metMax: 0 } },
      { id: 'sentry.greet.again', slot: 'greet', text: 'Back. I did not stand. That costs three hundred.', when: { metMin: 1, metMax: 2 } },
      { id: 'sentry.greet.old', slot: 'greet', text: '{hero}. {met} visits and no coins. I am starting to think you like the view.', when: { metMin: 3 } },
      { id: 'sentry.greet.knight', slot: 'greet', text: 'A sentinel. Weary, by the cup. I am weary by the cliff. Between us we could manage one whole knight.', when: { hero: 'knight', metMin: 1 }, weight: 1.2 },
      { id: 'sentry.greet.wizard', slot: 'greet', text: 'Floating over my cliff. It waited a hundred years for someone to do that. It is unimpressed.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },

      { id: 'sentry.react.passbeast', slot: 'react', text: 'The pass beast, dead. I said go around, or go with me. You went through. I am rewriting my advice.', when: kill('passbeast'), weight: 3 },
      { id: 'sentry.react.troll', slot: 'react', text: 'The troll under the bridge, gone. It bellowed every dusk. I will miss the punctuality.', when: kill('troll') },
      { id: 'sentry.react.emberrider', slot: 'react', text: "I watched the rider's fire in the dead wood every night. Tonight I watch the dark. It is cheaper.", when: kill('emberrider') },
      { id: 'sentry.react.hollowking', slot: 'react', text: 'The giant on the shore is dead. A hundred years I have not stood for anything. For this, I shifted.', when: kill('hollowking'), weight: 3 },
      { id: 'sentry.react.hurt', slot: 'react', text: 'You are bleeding on my cliff. Sit. It is the one thing I can recommend from experience.', when: HURT },
      { id: 'sentry.react.down', slot: 'react', text: 'You went down in the pass. From up here it looked brief. The cliff is kind that way.', when: DOWN },
      { id: 'sentry.react.fly', slot: 'react', text: 'You flew. Off a cliff. On purpose. Three hundred coins says I will not try it.', when: feat('fly') },
      { id: 'sentry.react.climb', slot: 'react', text: 'You climbed the cliff. There are stairs. I have watched people not find the stairs for a century.', when: feat('climb') },
      { id: 'sentry.react.skyeye', slot: 'react', text: 'The sky has had eyes since the giant sat down. Nobody asked them to leave until you shot one.', when: feat('skyeye') },
      { id: 'sentry.react.archer', slot: 'react', text: 'Wren. You ride a bow. I ride a cliff. Mine goes nowhere, but it has never dropped me.', when: { hero: 'archer', metMin: 1 } },
      { id: 'sentry.react.sip', slot: 'react', text: 'Sip. I will watch the windows. Someone has to, and it is not going to be the windows.', when: feat('sip', { hero: 'knight' }) },
      { id: 'sentry.react.mailknight', slot: 'react', text: "You broke a chain-mail knight in the sad king's street. Chain mail. In this age. No wonder.", when: kill('mail-knight') },
      { id: 'sentry.react.carriage', slot: 'react', text: 'You rode the carriage that never arrives. I respect a thing that commits to sitting.', when: feat('carriage') },
      { id: 'sentry.react.hired', slot: 'react', text: 'You hired someone. Not me. I noticed. From this rock, I notice everything.', when: { flag: 'hired', companions: 1 }, once: true },
      { id: 'sentry.react.boss', slot: 'react', text: '{lastBoss} is dead, I hear. The windows did not flicker. They never do.', when: BOSS },

      { id: 'sentry.topic.hire', slot: 'topic', ask: 'About hiring you', text: 'I sit. I watch. For three hundred coins I will stand. Standing is where it gets expensive.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'sentry.topic.windows', slot: 'topic', ask: 'Those lit windows', text: 'Lit a hundred years, and no one out. Either they are very happy in there, or the candles are.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'sentry.topic.pass', slot: 'topic', ask: 'The pass beast', text: "The pass is the beast's. Go around, or go with me. Going through alone is its favourite.", when: { bossAlive: 'passbeast' }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'sentry.topic.sword', slot: 'topic', ask: 'Your greatsword', text: 'Point-down is how you rest a sword. After a hundred years, the point has gone in a little.', when: { metMin: 2 }, choices: [{ label: 'Leave', action: 'close' }] },

      { id: 'sentry.bye.sitting', slot: 'bye', text: 'Go. I will still be sitting.' },
      { id: 'sentry.bye.edge', slot: 'bye', text: 'Mind the edge. It minds nothing.' },
      { id: 'sentry.bye.price', slot: 'bye', text: 'Three hundred. The price does not sit.' },

      { id: 'sentry.bark.lit', slot: 'bark', text: 'Still lit.' },
      { id: 'sentry.bark.out', slot: 'bark', text: 'No one has come out.' },
      { id: 'sentry.bark.price', slot: 'bark', text: 'Three hundred coins.' },
      { id: 'sentry.bark.sitting', slot: 'bark', text: 'Sitting.' },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // Hollow Jack, the skeleton with the trident and the banner on the windy peak under the aurora.
  // ---------------------------------------------------------------------------------------------------------------
  standard: {
    persona: {
      id: 'standard', district: 'island', knows: ['galaxy', 'graveyard'], rumourDelay: 120, tone: 'dry',
      gag: 'He is recruiting for an army of one, and keeps a muster roll with the wind.',
      about: 'The standard-bearer of a kingdom that lost, who kept the banner, the ridge and the aurora, and would like you to enlist.',
    },
    lines: [
      { id: 'standard.greet.first', slot: 'greet', text: 'This banner is for a kingdom that lost. I kept it. Here to enlist? Nobody is here to enlist.', when: { metMax: 0 } },
      { id: 'standard.greet.again', slot: 'greet', text: 'You came back. That makes you the army\'s most loyal member. Also its only.', when: { metMin: 1, metMax: 2 } },
      { id: 'standard.greet.old', slot: 'greet', text: '{hero}, reporting. {met} musters. Your name is on my roll, spelled wrong; the wind did that.', when: { metMin: 3 } },
      { id: 'standard.greet.wizard', slot: 'greet', text: 'A floating wizard. The army has never had one. It has never had anyone. You would be both.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },
      { id: 'standard.greet.archer', slot: 'greet', text: 'An archer. Now the army can hold the ridge. I have held it alone; it mostly holds itself.', when: { hero: 'archer', metMin: 1 }, weight: 1.2 },

      { id: 'standard.react.passbeast', slot: 'react', text: 'The beast of the pass fell. I planted the banner a little harder for that. The wind planted it back.', when: kill('passbeast') },
      { id: 'standard.react.troll', slot: 'react', text: 'The troll is dead. He once asked to enlist. I said the uniform was bones only. He took it badly.', when: kill('troll') },
      { id: 'standard.react.emberrider', slot: 'react', text: 'You put out the rider below. I shall tell the aurora; it is the only one who listens.', when: kill('emberrider') },
      { id: 'standard.react.hollowking', slot: 'react', text: 'The giant who ate my kingdom is down. The banner outlasted him. Banners do.', when: kill('hollowking'), weight: 3 },
      { id: 'standard.react.hurt', slot: 'react', text: 'The army\'s first casualty. I have waited an age to say that; it is less fun than I thought.', when: HURT },
      { id: 'standard.react.down', slot: 'react', text: 'You fell in the pass. The roll says missing. I have crossed it out; the fog returns what it borrows.', when: DOWN },
      { id: 'standard.react.fly', slot: 'react', text: 'You flew past the banner. The banner saluted. It was the wind, but I am counting it.', when: feat('fly') },
      { id: 'standard.react.skyeye', slot: 'react', text: 'You shot an eye out of my sky. Mind the aurora. That is an order; my first ever.', when: feat('skyeye') },
      { id: 'standard.react.levelup', slot: 'react', text: 'Promoted! The banner leaned your way. It leans at the wind too, so: a weak signal. But a signal.', when: feat('levelup') },
      { id: 'standard.react.sip', slot: 'react', text: 'Sipping on duty. In my army that meant a flogging. We had no flogger, so: a frown.', when: feat('sip', { hero: 'knight' }) },
      { id: 'standard.react.hover', slot: 'react', text: 'You hover above the ridge. If you hover above the banner you outrank it. Do not outrank the banner.', when: { hero: 'wizard', metMin: 1 } },
      { id: 'standard.react.graveskel', slot: 'react', text: 'You put the risen skeletons back down. Distant cousins. Everyone with bones is.', when: kill('grave-skeleton') },
      { id: 'standard.react.galaxyknight', slot: 'react', text: 'A galaxy knight fell, I hear. The skeleton king has knights; I have a banner. I would not trade.', when: kill('galaxy-knight') },
      { id: 'standard.react.boss', slot: 'react', text: '{lastBoss} fell. The aurora rippled. It only does that for the great ones; it has taste.', when: BOSS },

      { id: 'standard.topic.wind', slot: 'topic', ask: 'The wind and aurora', text: 'Wind, aurora and I never stop. One of us will, eventually. My coins are on the aurora.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'standard.topic.enlist', slot: 'topic', ask: 'Enlist with you', text: 'No pay, no food, no orders, and the ridge is cold. The banner, however, is magnificent.', weight: 2, choices: [
        { label: 'I enlist.', action: 'journal:Enlisted in Hollow Jack\'s army of one, on the windy peak.', to: 'standard.topic.enlisted' },
        { label: 'I will think about it.', action: 'close' },
      ] },
      { id: 'standard.topic.enlisted', slot: 'topic', ask: 'About my enlistment', text: 'Welcome. Duties: none. Rank: the other one. Dismissed; that is also your first order.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'standard.topic.counter', slot: 'topic', ask: 'The coin counter', text: 'The skeleton on the throne beyond the portal offered me a job. Counting. I said I had a banner.', when: { metMin: 1 }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'standard.topic.kingdom', slot: 'topic', ask: 'The kingdom you lost', text: 'A giant sat on the shore and ate our voices. I was holding the banner. Nobody said stop.', when: { quest: ['silence', ['told', 'five', 'open']] }, choices: [{ label: 'Leave', action: 'close' }] },

      { id: 'standard.bye.dismissed', slot: 'bye', text: 'Dismissed.' },
      { id: 'standard.bye.ridge', slot: 'bye', text: 'Hold the ridge. It holds itself; do not interrupt it.' },
      { id: 'standard.bye.remember', slot: 'bye', text: 'The banner will remember you. It is all it does.' },

      { id: 'standard.bark.holds', slot: 'bark', text: 'The banner holds.' },
      { id: 'standard.bark.enlist', slot: 'bark', text: 'Enlist.' },
      { id: 'standard.bark.wind', slot: 'bark', text: 'Wind.' },
      { id: 'standard.bark.nobody', slot: 'bark', text: 'Nobody is here to enlist.' },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // The Root Priest at the world tree above the dead wood: the light climbs the bark, the stones carry names.
  // ---------------------------------------------------------------------------------------------------------------
  priest: {
    persona: {
      id: 'priest', district: 'island', knows: ['graveyard', 'galaxy', 'vale'], rumourDelay: 180, tone: 'sleepy',
      gag: 'Everything here runs backwards, and his own name is not carved yet.',
      about: 'The robed keeper of the tree veined with light, who carves a name on a stone for everything that dies and is waiting for a good enough death to carve his own.',
    },
    lines: [
      { id: 'priest.greet.first', slot: 'greet', text: 'Light runs up the bark here. Backwards, always backwards. You walk forwards. It looks strange.', when: { metMax: 0 } },
      { id: 'priest.greet.again', slot: 'greet', text: 'You came back. The tree noticed first. It always does. I notice second; that is my job.', when: { metMin: 1, metMax: 2 } },
      { id: 'priest.greet.old', slot: 'greet', text: '{hero}. The stones have a name for you now. I have not carved it. I am waiting to see how you end.', when: { metMin: 3 } },
      { id: 'priest.greet.knight', slot: 'greet', text: 'The knight who drinks. The tree drinks too; it drinks light. Neither of you ever seems full.', when: { hero: 'knight', metMin: 1 }, weight: 1.2 },
      { id: 'priest.greet.wizard', slot: 'greet', text: 'Up. You go up, like the light. You are the only two things here that do; the tree is pleased.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },

      { id: 'priest.react.emberrider', slot: 'react', text: 'You put out the rider. I let him pass every night; it was easier. Now the nights need a new habit.', when: kill('emberrider'), weight: 3 },
      { id: 'priest.react.yeti', slot: 'react', text: 'The yeti in the frozen grove fell. The snow there will melt slower now; it was afraid of him.', when: kill('yeti') },
      { id: 'priest.react.hollowking', slot: 'react', text: 'The giant is dead. Every name on the stones is saying itself at once. Mine is still not there.', when: kill('hollowking'), weight: 3 },
      { id: 'priest.react.passbeast', slot: 'react', text: 'The beast in the pass. I heard it from here, backwards: first the quiet, then the roar.', when: kill('passbeast') },
      { id: 'priest.react.hurt', slot: 'react', text: 'You are bleeding. The roots drink upward; a little of you will be in the leaves by spring.', when: HURT },
      { id: 'priest.react.down', slot: 'react', text: 'The dead wood put you down. The fog gave you back; it is less choosy than the tree.', when: DOWN },
      { id: 'priest.react.skyeye', slot: 'react', text: 'An eye fell from the sky. Up here that is weather. You are the first weather that aims.', when: feat('skyeye') },
      { id: 'priest.react.levelup', slot: 'react', text: 'The light ran faster up the bark just now. You have grown. Upward, like everything here.', when: feat('levelup') },
      { id: 'priest.react.fly', slot: 'react', text: 'You flew over the grove. The tree has wanted to for an age. Do not tell it how.', when: feat('fly') },
      { id: 'priest.react.archer', slot: 'react', text: 'Wren. Mushrooms, as you walk. The roots eat the dead. Everyone eats something; you chose better.', when: { hero: 'archer', metMin: 1 } },
      { id: 'priest.react.sip', slot: 'react', text: 'Sip. The tree sips light the same way: slowly, and with the eyes closed.', when: feat('sip', { hero: 'knight' }) },
      { id: 'priest.react.gravelord', slot: 'react', text: 'The Grave Cyclops is dead, they say. I will keep its name here; the alley can keep the bones.', when: kill('cyclops-lord') },
      { id: 'priest.react.fountain', slot: 'react', text: "You drank from the sad king's lean fountain. Here it would pour upward. Into the nose, mostly.", when: feat('fountain') },
      { id: 'priest.react.boss', slot: 'react', text: '{lastBoss}. Gone. A name for the stones. I will carve it below yours. Yours is not ready.', when: BOSS },

      { id: 'priest.topic.tree', slot: 'topic', ask: 'The world tree', text: "That light is the kingdom's old voice, climbing since the giant sat down. Almost at the leaves.", choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'priest.topic.stones', slot: 'topic', ask: 'The name stones', text: 'A name on every stone but mine. I am waiting for a good death; the bad ones are all taken.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'priest.topic.rider', slot: 'topic', ask: 'The night rider', text: 'A rider burns through the dead wood at night. Let him pass. Or do not; the stones could use a rider.', when: { bossAlive: 'emberrider' }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'priest.topic.voices', slot: 'topic', ask: 'The five voices', text: 'The tree has waited an age for those voices. It will not help; it is a tree. But it will know.', when: { quest: ['silence', ['told', 'five']] }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },

      { id: 'priest.bye.downhill', slot: 'bye', text: 'Go downhill. Everything else here goes up.' },
      { id: 'priest.bye.roots', slot: 'bye', text: 'The roots know your weight now. Go lightly; they remember.' },
      { id: 'priest.bye.carve', slot: 'bye', text: 'I will carve nothing yet.' },

      { id: 'priest.bark.backwards', slot: 'bark', text: 'Backwards.' },
      { id: 'priest.bark.climbs', slot: 'bark', text: 'The light climbs.' },
      { id: 'priest.bark.carved', slot: 'bark', text: 'Not carved yet.' },
      { id: 'priest.bark.pass', slot: 'bark', text: 'Let him pass.' },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // The Lantern Witch on the west cliffs, describing a city of spires across the water that nobody can see.
  // ---------------------------------------------------------------------------------------------------------------
  'lantern-witch': {
    persona: {
      id: 'lantern-witch', district: 'island', knows: ['galaxy', 'sunken'], rumourDelay: 160, tone: 'dry',
      gag: 'The spire city across the water has more bridges than people, and the aqueducts are listening.',
      about: 'The witch with the lantern who came to the west cliffs to see the waterfalls of a city across the water, and describes it to everyone who cannot see it.',
    },
    lines: [
      { id: 'lantern-witch.greet.first', slot: 'greet', text: 'The city across the water has more bridges than people. Lantern low. The aqueducts are listening.', when: { metMax: 0 } },
      { id: 'lantern-witch.greet.again', slot: 'greet', text: 'Back. You cannot see it either, then. Nobody can. I describe it anyway; someone should.', when: { metMin: 1, metMax: 2 } },
      { id: 'lantern-witch.greet.old', slot: 'greet', text: 'The city has noticed you, {hero}. It noticed on your second visit; it is a slow city.', when: { metMin: 3 } },
      { id: 'lantern-witch.greet.archer', slot: 'greet', text: 'A bow for a horse. The city has a bridge for every horse and no horses. You would do well there.', when: { hero: 'archer', metMin: 1 }, weight: 1.2 },
      { id: 'lantern-witch.greet.wizard', slot: 'greet', text: 'The city floats too, across the water, on nothing I can prove. You would be at home there.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },

      { id: 'lantern-witch.react.spider', slot: 'react', text: 'The walking chapel blocked my view of the city. Now I can see it. You cannot. Not my fault.', when: kill('spiderchapel'), weight: 3 },
      { id: 'lantern-witch.react.rivershade', slot: 'react', text: 'The stream shade looked west with me every dusk. I will miss having someone to not talk to.', when: kill('rivershade') },
      { id: 'lantern-witch.react.beast', slot: 'react', text: 'The fog beasts howled at the city. The city never howled back; it is above that.', when: kill('beast') },
      { id: 'lantern-witch.react.warden', slot: 'react', text: 'The Warden is dead. The king will want to tell you about it. Let him; it is his only story.', when: kill('warden') },
      { id: 'lantern-witch.react.hurt', slot: 'react', text: 'Blood. Lower the lantern. The aqueducts hear blood; they are built for it.', when: HURT },
      { id: 'lantern-witch.react.down', slot: 'react', text: 'The cliffs took you down. I watched the city meanwhile. It did nothing. It is good at nothing.', when: DOWN },
      { id: 'lantern-witch.react.fly', slot: 'react', text: 'You flew out over the water. Did you see it? No. Nobody does. It is a long way to nothing.', when: feat('fly') },
      { id: 'lantern-witch.react.swim', slot: 'react', text: 'You swam the river. The river comes from the city, I say. It says nothing. Rivers are tactful.', when: feat('swim') },
      { id: 'lantern-witch.react.chest', slot: 'react', text: 'A chest lid. The city has ten thousand chests and nobody to open them. I have counted none.', when: feat('chest') },
      { id: 'lantern-witch.react.sip', slot: 'react', text: 'Sip. The city drinks from its aqueducts; they are rude, but they are full.', when: feat('sip', { hero: 'knight' }) },
      { id: 'lantern-witch.react.mushrooms', slot: 'react', text: 'Wren. Eat any mushroom but the ones that glow by the stream. The stream counts them.', when: { hero: 'archer', metMin: 1 } },
      { id: 'lantern-witch.react.hollowstaff', slot: 'react', text: 'Old Hollowstaff fell in the bucket street. He threw diamonds. The city throws nothing. It keeps.', when: kill('diamond-wizard') },
      { id: 'lantern-witch.react.angler', slot: 'react', text: 'An angler died under the lake. Its lantern grew out of its head. Mine is oil. Much tidier.', when: kill('angler') },
      { id: 'lantern-witch.react.boss', slot: 'react', text: '{lastBoss}, dead. The spires across the water never moved. That is how I know they are there.', when: BOSS },

      { id: 'lantern-witch.topic.city', slot: 'topic', ask: 'What is out past the lake?', text: 'Spires, aqueducts, a bridge per citizen and six spare. Visible when the fog thins. It never thins.', choices: [
        { label: 'I see nothing.', to: 'lantern-witch.topic.nothing' },
        { label: 'Leave', action: 'close' },
      ] },
      { id: 'lantern-witch.topic.nothing', slot: 'topic', ask: 'I see nothing', text: 'Nor do I, most nights. I describe it from memory. The memory may be fog too. Very good fog.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'lantern-witch.topic.falls', slot: 'topic', ask: 'The waterfalls', text: 'I came here for the waterfalls, long ago. Still there, I say. The city pours them for nobody.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'lantern-witch.topic.lantern', slot: 'topic', ask: 'Your lantern', text: 'Keep it low. The aqueducts listen, and they gossip to the spires, and the spires are tall.', when: { metMin: 1 }, choices: [{ label: 'Leave', action: 'close' }] },

      { id: 'lantern-witch.bye.low', slot: 'bye', text: 'Lantern low.' },
      { id: 'lantern-witch.bye.version', slot: 'bye', text: 'If you see it, do not tell me how. I prefer my version.' },
      { id: 'lantern-witch.bye.leave', slot: 'bye', text: 'Go. The city will watch you leave. It watches everyone leave; nobody arrives.' },

      { id: 'lantern-witch.bark.lower', slot: 'bark', text: 'Lower.' },
      { id: 'lantern-witch.bark.bridges', slot: 'bark', text: 'More bridges than people.' },
      { id: 'lantern-witch.bark.heard', slot: 'bark', text: 'The aqueducts heard that.' },
      { id: 'lantern-witch.bark.there', slot: 'bark', text: 'Still there.' },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // The Lanternbearer, up and down the village street, who has seen the castle across the water burn.
  // ---------------------------------------------------------------------------------------------------------------
  wanderer: {
    persona: {
      id: 'wanderer', district: 'island', knows: ['galaxy', 'graveyard'], rumourDelay: 140, tone: 'sleepy',
      gag: 'The burning castle across the water, which you can never see. That\'s the point.',
      about: 'The hooded walker with the lantern who paces the village street and has stopped asking why the castle across the water burns and never falls.',
    },
    lines: [
      { id: 'wanderer.greet.first', slot: 'greet', text: 'Across the water a castle burns and never falls. I stopped asking why. You will ask. Everyone asks.', when: { metMax: 0 } },
      { id: 'wanderer.greet.again', slot: 'greet', text: 'The lantern dipped; it knew you were coming. Or the wind did. The wind gets credit for a lot.', when: { metMin: 1, metMax: 2 } },
      { id: 'wanderer.greet.old', slot: 'greet', text: 'We keep meeting on this street, {hero}. The street is short; the odds were always good.', when: { metMin: 3 } },
      { id: 'wanderer.greet.knight', slot: 'greet', text: 'You glide on a cape; I walk. One of us has seen the burning castle. Not the one with the cape.', when: { hero: 'knight', metMin: 1 }, weight: 1.2 },
      { id: 'wanderer.greet.wizard', slot: 'greet', text: 'Orlan. The lantern has never had anyone to light from below. It is confused.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },

      { id: 'wanderer.react.loggiant', slot: 'react', text: 'The log giant walked behind me every night. Now the street is all mine. It is a worse street.', when: kill('loggiant'), weight: 3 },
      { id: 'wanderer.react.beast', slot: 'react', text: 'The fog beasts followed my lantern sometimes. It only leads back down this street. They learned.', when: kill('beast') },
      { id: 'wanderer.react.rivershade', slot: 'react', text: 'The stream shade, gone. My lantern and it had an understanding: neither looked at the other.', when: kill('rivershade') },
      { id: 'wanderer.react.skeleton', slot: 'react', text: 'You hit the skeletons by the fire while they were cooking. Cooking nothing. Still: manners.', when: kill('skeleton') },
      { id: 'wanderer.react.hurt', slot: 'react', text: 'Walk it off. I have walked off worse on this street; the street is good for one thing.', when: HURT },
      { id: 'wanderer.react.down', slot: 'react', text: 'The fog carried you back. I have never seen the fog carry anyone to the castle. It knows.', when: DOWN },
      { id: 'wanderer.react.fly', slot: 'react', text: "You flew over the village. From up there you did not see the castle burn. That's the point.", when: feat('fly') },
      { id: 'wanderer.react.ale', slot: 'react', text: 'The rowers\' beer. The lantern is swaying, or you are. I will say the lantern; it is kinder.', when: feat('ale') },
      { id: 'wanderer.react.chest', slot: 'react', text: 'You opened a chest. Was there a castle in it? No. There never is.', when: feat('chest') },
      { id: 'wanderer.react.archer', slot: 'react', text: 'You eat mushrooms as you walk. The lantern eats oil as I walk. The street feeds everyone, badly.', when: { hero: 'archer', metMin: 1 } },
      { id: 'wanderer.react.sip', slot: 'react', text: 'Sip. I used to sip. Then the castle, and I found I preferred to look.', when: feat('sip', { hero: 'knight' }) },
      { id: 'wanderer.react.ghoul', slot: 'react', text: 'You popped some styro-ghouls, I hear. Their cups glow. My lantern glowed first. Copycats.', when: kill('styro-ghoul') },
      { id: 'wanderer.react.graveskel', slot: 'react', text: 'Skeletons walking in the alley of graves, they say. Bones want to walk. I walk. I understand.', when: kill('grave-skeleton') },
      { id: 'wanderer.react.boss', slot: 'react', text: '{lastBoss} died somewhere far. The castle kept burning. I checked; it is the one thing I check.', when: BOSS },

      { id: 'wanderer.topic.castle', slot: 'topic', ask: 'What do you see out there?', text: 'Across the water a castle burns and never falls.', weight: 2, choices: [
        { label: "Where? I don't see it.", to: 'wanderer.topic.point' },
        { label: 'Why does it burn?', to: 'wanderer.topic.why' },
        { label: 'Leave', action: 'close' },
      ] },
      { id: 'wanderer.topic.point', slot: 'topic', ask: 'Can it be seen from here?', text: "No. That's the point.", choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'wanderer.topic.why', slot: 'topic', ask: 'Why does it burn?', text: 'I stopped asking. You will too. It takes about a year.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'wanderer.topic.lantern', slot: 'topic', ask: 'Follow your lantern', text: 'Go ahead. It only leads back down this street. Everything does, eventually.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'wanderer.topic.village', slot: 'topic', ask: 'This village', text: 'The village pays the ogre in soup and me in nothing. I never asked. Asking is how you get soup.', when: { metMin: 1 }, choices: [{ label: 'Leave', action: 'close' }] },

      { id: 'wanderer.bye.street', slot: 'bye', text: 'The street will bring you back.' },
      { id: 'wanderer.bye.logs', slot: 'bye', text: 'The ogre\'s logs come through at dusk. Be thin.' },
      { id: 'wanderer.bye.water', slot: 'bye', text: 'Keep looking at the water. Not for the castle; just looking.' },

      { id: 'wanderer.bark.point', slot: 'bark', text: "That's the point." },
      { id: 'wanderer.bark.burning', slot: 'bark', text: 'Still burning.' },
      { id: 'wanderer.bark.street', slot: 'bark', text: 'Back down this street.' },
      { id: 'wanderer.bark.left', slot: 'bark', text: 'Lantern says left. Lantern is wrong.' },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // The Pale Bride, walking the dunes toward the sea for someone who said he would meet her where the sand ends.
  // ---------------------------------------------------------------------------------------------------------------
  bride: {
    persona: {
      id: 'bride', district: 'island', knows: ['sunken'], rumourDelay: 90, tone: 'sleepy',
      gag: 'The sand does not end. After the Drowned Bell is found she hears the bells, and will walk to the shore with you.',
      about: 'The ghost in white who walks the dunes toward the sea, because he said he would meet her where the sand ends, and the sand does not end.',
    },
    lines: [
      { id: 'bride.greet.first', slot: 'greet', text: 'He said he would meet me where the sand ends. The sand does not end. I keep walking.', when: { metMax: 0 } },
      { id: 'bride.greet.again', slot: 'greet', text: 'Did you find where the sand ends? No. Neither did it.', when: { metMin: 1, metMax: 2 } },
      { id: 'bride.greet.old', slot: 'greet', text: '{hero}. I know your footsteps now. They are the only ones here that leave a mark.', when: { metMin: 3 } },
      { id: 'bride.greet.wizard', slot: 'greet', text: 'The sand cannot hold you. I envy that; it holds me very well.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },
      { id: 'bride.greet.knight', slot: 'greet', text: 'A knight. He was a knight. He had a cup too, I think. Everyone did, that year.', when: { hero: 'knight', metMin: 1 }, weight: 1.2 },
      { id: 'bride.greet.bells', slot: 'greet', text: '...do you hear the bells? Real ones, from the shore. He said: first the bells, then the sand ends.', when: { quest: ['bell', 'done'] }, weight: 3 },
      { id: 'bride.greet.shore', slot: 'greet', text: 'You brought me to where the sand ends. It is wet. Nobody said it would be wet.', when: { quest: ['bride', 'done'] }, weight: 5 },

      { id: 'bride.react.golem', slot: 'react', text: 'The crystal men walked with me some nights. They did not know where the sand ends either.', when: kill('crystalsentry'), weight: 2 },
      { id: 'bride.react.cyclops', slot: 'react', text: 'The cyclops in the pool, gone. One eye, and it chose to look at me. I was a little flattered.', when: kill('cyclops') },
      { id: 'bride.react.warden', slot: 'react', text: 'The antlered one walked the rain; I walk the sand. We were going to compare notes.', when: kill('warden') },
      { id: 'bride.react.hurt', slot: 'react', text: 'The sand is drinking you. It drinks everything; it is why it never ends.', when: HURT },
      { id: 'bride.react.down', slot: 'react', text: 'The sand had you a while, then gave you back. It has never given anything back for me.', when: DOWN },
      { id: 'bride.react.swim', slot: 'react', text: 'You reached the sea. Does the sand end there? Do not tell me. I want to walk it.', when: feat('swim') },
      { id: 'bride.react.fly', slot: 'react', text: 'You flew over the dunes. From up there, can you see the end? No. I thought not.', when: feat('fly') },
      { id: 'bride.react.bounce', slot: 'react', text: 'A mushroom bounce. The sand has no mushrooms. It has nothing at all. That is its charm.', when: feat('bounce') },
      { id: 'bride.react.archer', slot: 'react', text: 'Wren. You ride a bow. He rode a horse. It left too, before he did.', when: { hero: 'archer', metMin: 1 } },
      { id: 'bride.react.float', slot: 'react', text: 'Above the sand. It is furious; I can feel it through my feet. Nobody has ever been out of its reach.', when: { hero: 'wizard', metMin: 2 } },
      { id: 'bride.react.fishguard', slot: 'react', text: "You fought the fish king's guards under the lake, they say. Is that where the sand ends? Under?", when: kill('fish-guard') },
      { id: 'bride.react.angler', slot: 'react', text: 'Nobody talks to me, yet I hear: anglers died behind the sea throne. Something glows there.', when: kill('angler') },
      { id: 'bride.react.boss', slot: 'react', text: '{lastBoss}, dead. The sand heard it fall. Everything falls on the sand, eventually.', when: BOSS },

      { id: 'bride.topic.sand', slot: 'topic', ask: 'The sand never ends', text: 'I walked it to the cliff and back. The cliff is not the end; it is just the sand standing up.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'bride.topic.him', slot: 'topic', ask: 'Who are you waiting for?', text: 'He said he would meet me where the sand ends. He did not say which end. I have tried both.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'bride.topic.nobells', slot: 'topic', ask: 'Do you hear bells?', text: '...do you hear the bells? No. Nor do I. I keep asking in case it changes.', when: { quest: ['bell', ['none', 'active', 'found']] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'bride.topic.bells', slot: 'topic', ask: 'Do you hear the bells now?', text: 'The bells. From the shore. Walk with me; the sand ends where the bells are. He said.', when: { quest: ['bell', 'done'] }, weight: 4, choices: [
        { label: 'Walk with me.', action: 'follow', when: { quest: ['bride', 'none'] } },
        { label: 'Not yet.', action: 'close', when: { quest: ['bride', 'none'] } },
        { label: 'Leave', action: 'close', when: { quest: ['bride', ['walking', 'done']] } },
      ] },
      { id: 'bride.topic.walking', slot: 'topic', ask: 'Are we close?', text: 'Do not stop. The bells stop when I stop; I have tested it twice, and twice was plenty.', when: { quest: ['bride', 'walking'] }, weight: 6, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'bride.topic.ended', slot: 'topic', ask: 'We reached the shore', text: 'The sand ended. He was not there. The bells were. At least the bells kept the appointment.', when: { quest: ['bride', 'done'] }, weight: 8, choices: [{ label: 'Leave', action: 'close' }] },

      { id: 'bride.bye.walking', slot: 'bye', text: 'I keep walking.' },
      { id: 'bride.bye.mark', slot: 'bye', text: 'If you find where the sand ends, leave a mark.' },
      { id: 'bride.bye.notice', slot: 'bye', text: 'Go. The sand will not notice; it only notices me.' },

      { id: 'bride.bark.bells', slot: 'bark', text: '...do you hear the bells?' },
      { id: 'bride.bark.sand', slot: 'bark', text: 'The sand does not end.' },
      { id: 'bride.bark.him', slot: 'bark', text: 'He said he would meet me.' },
      { id: 'bride.bark.walking', slot: 'bark', text: 'Still walking.' },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // Pim, the gnome at the telescope on the mushroom hut's balcony, who draws the star charts Mirren sells.
  // ---------------------------------------------------------------------------------------------------------------
  pim: {
    persona: {
      id: 'pim', district: 'island', knows: ['galaxy', 'dream'], rumourDelay: 100, tone: 'dry',
      gag: 'Three turns of the galaxy counted; very old, or very bored. Nobody looks up.',
      about: 'The gnome astronomer who has watched the galaxy turn three times from his balcony, charts the hunters of the land, and asks you not to touch the telescope.',
    },
    lines: [
      { id: 'pim.greet.first', slot: 'greet', text: 'I have counted three turns of the galaxy. Very old, or very bored. Do not touch the telescope.', when: { metMax: 0 } },
      { id: 'pim.greet.again', slot: 'greet', text: 'I had the telescope on you earlier. You walk like someone who has lost something small.', when: { metMin: 1, metMax: 2 } },
      { id: 'pim.greet.old', slot: 'greet', text: 'I have charted you, {hero}. A slow star with a wide orbit and a habit of coming back.', when: { metMin: 3 } },
      { id: 'pim.greet.wizard', slot: 'greet', text: 'Hold still, Orlan; you are the only thing in the sky tonight I have not named.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },
      { id: 'pim.greet.archer', slot: 'greet', text: 'Wren. This hut is a mushroom. I have seen what you do to mushrooms. I would ask you not to.', when: { hero: 'archer', metMin: 1 }, weight: 1.2 },

      { id: 'pim.react.loggiant', slot: 'react', text: 'The log giant blocked my eastern sky at seven sharp, nightly. What do I set the clock by now?', when: kill('loggiant') },
      { id: 'pim.react.skeleton', slot: 'react', text: 'Those skeletons sat under my balcony for an age and never once looked up. Nobody looks up.', when: kill('skeleton') },
      { id: 'pim.react.beast', slot: 'react', text: 'The fog beasts howled at the moon. The moon smiled. I told them not to look. They looked.', when: kill('beast') },
      { id: 'pim.react.lurker', slot: 'react', text: 'The thing in the lily pond is dead. I charted it as a star once. It moved. Bad star.', when: kill('lurker') },
      { id: 'pim.react.hurt', slot: 'react', text: 'Your blood is the brightest thing on the road from up here. Sit before you fall off my chart.', when: HURT },
      { id: 'pim.react.down', slot: 'react', text: 'Missed your fall; the telescope was on the galaxy. Three turns, and I still miss the good bits.', when: DOWN },
      { id: 'pim.react.fly', slot: 'react', text: 'You flew across my lens and I charted a new comet. It was you. I have left the comet in.', when: feat('fly') },
      { id: 'pim.react.bounce', slot: 'react', text: 'You bounced on the pond mushrooms. From up here: a very small moon trying to leave.', when: feat('bounce') },
      { id: 'pim.react.levelup', slot: 'react', text: 'You are brighter than you were; I measure these things. Not much. A planet, not a star.', when: feat('levelup') },
      { id: 'pim.react.sip', slot: 'react', text: 'You sip as you walk. The moon sips too, I think; that is why it smiles. Do not look at it.', when: feat('sip', { hero: 'knight' }) },
      { id: 'pim.react.float', slot: 'react', text: 'Floating. If you drift up another forty metres I shall have to chart you, and charge for it.', when: { hero: 'wizard', metMin: 1 } },
      { id: 'pim.react.skyeyes', slot: 'react', text: 'You shot an eye out of the sky. I charted those eyes as stars for an age. I owe people apologies.', when: feat('skyeye') },
      { id: 'pim.react.leanking', slot: 'react', text: 'You beat the sad king, I hear. In my telescope his kingdom is one purple smudge. It flickered.', when: kill('rift-king') },
      { id: 'pim.react.painter', slot: 'react', text: "Something died in the frog's dream. The galaxy wobbled. I wrote it down, then crossed it out.", when: kill('trip-wizard') },
      { id: 'pim.react.boss', slot: 'react', text: '{lastBoss}, dead. One hunter less on my chart. I hate erasing. Mirren charges the same either way.', when: BOSS },

      { id: 'pim.topic.turns', slot: 'topic', ask: 'About the galaxy turns', text: 'The first I slept through. The second I counted. The third I watch, in case it does something.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'pim.topic.chart', slot: 'topic', ask: 'Star charts', text: 'My charts show where the great hunters sleep. I draw, Mirren sells, the hunters hunt. A system.', when: { notItem: 'star-chart' }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'pim.topic.charted', slot: 'topic', ask: 'I have one of your charts.', text: 'The hunters on it are where I drew them. Unless they died. Then blame the hunters, not the chart.', when: { item: 'star-chart' }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'pim.topic.moon', slot: 'topic', ask: 'The smiling moon', text: 'It smiles when something dies. Do not look at it. Tonight it has smiled at you quite a lot.', when: { metMin: 1 }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'pim.topic.eyes', slot: 'topic', ask: 'Eyes in the sky', text: 'Eyes over the north shore. He is awake. I have put the telescope away; some things are big enough.', when: { quest: ['silence', 'open'] }, weight: 3, choices: [{ label: 'Leave', action: 'close' }] },

      { id: 'pim.bye.sky', slot: 'bye', text: 'Go. The sky is not going anywhere; I have checked.' },
      { id: 'pim.bye.ladder', slot: 'bye', text: 'Mind the ladder; the mushroom gets slippery when it thinks.' },
      { id: 'pim.bye.late', slot: 'bye', text: 'Tell Mirren the charts are late. They are always late; the sky keeps moving.' },

      { id: 'pim.bark.turns', slot: 'bark', text: 'Three turns.' },
      { id: 'pim.bark.telescope', slot: 'bark', text: "Don't touch the telescope." },
      { id: 'pim.bark.up', slot: 'bark', text: 'Nobody looks up.' },
      { id: 'pim.bark.moon', slot: 'bark', text: "The moon is smiling. Don't." },
    ],
  },
};
