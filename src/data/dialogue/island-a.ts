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
      { id: 'stone-head.greet.knight', slot: 'greet', text: 'Sir Aldric. A thousand knights have looked up at me. You are the first to do it while drinking. Finish; I can wait.', when: { hero: 'knight', metMin: 1 }, weight: 1.2 },
      { id: 'stone-head.greet.wizard', slot: 'greet', text: 'No footprints on my causeway. Good. Everything else leaves them, and I am the one who has to look at them for an age.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },
      { id: 'stone-head.greet.archer', slot: 'greet', text: 'The girl on the bow. There is nothing up there that needs shooting. Except what does.', when: { hero: 'archer', metMin: 1 }, weight: 1.2 },
      { id: 'stone-head.greet.ended', slot: 'greet', text: 'Listen. That is the kingdom. It is not much, but it is back. Now, if you would move slightly to the left.', when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'stone-head.react.hollowking', slot: 'react', text: 'He is dead. I felt it in my jaw. The sound will take a moment; it has a long way to climb.', when: kill('hollowking'), weight: 4 },
      { id: 'stone-head.react.emberrider', slot: 'react', text: 'The rider in the dead wood. He burned past my chin every night for an age. The nights will be darker, and I prefer it.', when: kill('emberrider') },
      { id: 'stone-head.react.passbeast', slot: 'react', text: 'The beast of the pass. It ate the pilgrims who came to see me. I was never short of pilgrims. Now I will be.', when: kill('passbeast') },
      { id: 'stone-head.react.troll', slot: 'react', text: 'The troll under the bridge. It threw boulders at my left eye for sport. It never once hit. Say that at its grave.', when: kill('troll') },
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
      { id: 'stone-head.react.gravelord', slot: 'react', text: 'A cyclops died in the alley of graves. The skeleton who counts will pay you for that. He pays. I never understood paying.', when: kill('cyclops-lord') },
      { id: 'stone-head.react.boss', slot: 'react', text: '{lastBoss} is dead. I heard it fall. Everything that falls on this island falls in my ear.', when: BOSS },

      { id: 'stone-head.topic.silence', slot: 'topic', text: 'This kingdom had five voices. The Hollow King ate them and sat down on my shore to digest. That was an age ago. He is still digesting.', when: { quest: ['silence', 'none'] }, weight: 3, choices: [
        { label: 'Five voices?', to: 'stone-head.topic.five' },
        { label: 'What has that to do with me?', to: 'stone-head.topic.earn' },
        { label: 'I am only passing.', action: 'close' },
      ] },
      { id: 'stone-head.topic.five', slot: 'topic', text: 'Five kings kept the voice between them: the antlered one, the frog, the sad one on his porcelain, the fish under the lake, the skeleton who counts.', when: { quest: ['silence', ['none', 'told']] }, choices: [
        { label: 'And the voices?', to: 'stone-head.topic.earn', when: { quest: ['silence', 'none'] } },
        { label: 'Where do I begin?', to: 'stone-head.topic.begin' },
      ] },
      { id: 'stone-head.topic.earn', slot: 'topic', text: 'Each king still owes a voice. Do what each king asks and the voice is yours. Bring me five, and I will tell you how to wake what ate them.', when: { quest: ['silence', 'none'] }, choices: [
        { label: 'I will gather them.', action: 'quest:silence:told', to: 'stone-head.topic.begin' },
        { label: 'Not today.', action: 'close' },
      ] },
      { id: 'stone-head.topic.begin', slot: 'topic', text: 'The antlered one sits in the west, sulking at a castle he lost. Begin with him. He pays in silence; it is the one thing he has plenty of.', when: { quest: ['silence', 'told'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'stone-head.topic.told', slot: 'topic', text: 'Five voices. I hear each one arrive; you rattle a little more each time you climb my stairs.', when: { quest: ['silence', 'told'], metMin: 1 }, weight: 2, choices: [
        { label: 'The Antlered King has his throne.', to: 'stone-head.topic.v-throne', when: { quest: ['throne', 'done'] } },
        { label: 'The Frog King has his son.', to: 'stone-head.topic.v-croak', when: { quest: ['croak', 'done'], flag: 'licked' } },
        { label: 'The Frog King has his son.', to: 'stone-head.topic.v-croak-dry', when: { quest: ['croak', 'done'], notFlag: 'licked' } },
        { label: 'Yung Lean has his sound.', to: 'stone-head.topic.v-sound', when: { quest: ['sound', 'done'] } },
        { label: 'The Fish King has his bell.', to: 'stone-head.topic.v-bell', when: { quest: ['bell', 'done'] } },
        { label: 'The Grave Cyclops is dead.', to: 'stone-head.topic.v-grave', when: { quest: ['grave', 'done'] } },
        { label: 'Which kings are left?', to: 'stone-head.topic.five' },
        { label: 'Leave', action: 'close' },
      ] },
      { id: 'stone-head.topic.v-throne', slot: 'topic', text: 'Yes. I heard him laugh. It was not a good laugh, but it was a loud one, and loud is what I asked for.', when: { quest: ['throne', 'done'] }, choices: [{ label: 'Back', to: 'stone-head.topic.told' }] },
      { id: 'stone-head.topic.v-croak', slot: 'topic', text: 'The frog. I heard the sack open. Then I heard the rest. You did not have to lick him; nobody has to. They do.', when: { quest: ['croak', 'done'], flag: 'licked' }, choices: [{ label: 'Back', to: 'stone-head.topic.told' }] },
      { id: 'stone-head.topic.v-croak-dry', slot: 'topic', text: 'The frog. I heard the sack open. You did not lick him. Everyone else does. I watched you not do it; it was quieter.', when: { quest: ['croak', 'done'], notFlag: 'licked' }, choices: [{ label: 'Back', to: 'stone-head.topic.told' }] },
      { id: 'stone-head.topic.v-sound', slot: 'topic', text: 'The sad one. He gave you a blade and you gave him nothing back, and he called it even. A sound kept is a sound shared; he is wiser than his coat.', when: { quest: ['sound', 'done'] }, choices: [{ label: 'Back', to: 'stone-head.topic.told' }] },
      { id: 'stone-head.topic.v-bell', slot: 'topic', text: 'The bell. I heard it ring under a lake. Stone hears through water the way you hear through a wall: late, and all of it.', when: { quest: ['bell', 'done'] }, choices: [{ label: 'Back', to: 'stone-head.topic.told' }] },
      { id: 'stone-head.topic.v-grave', slot: 'topic', text: 'The cyclops lost the crown and the counter of coins let you keep it. He counted you instead. That is his voice.', when: { quest: ['grave', 'done'] }, choices: [{ label: 'Back', to: 'stone-head.topic.told' }] },
      { id: 'stone-head.topic.open', slot: 'topic', text: 'Five. I hear them in you; you rattle like a bell tower. Now the shore: my left, your right, along the sand. The one with a castle in his ribs. Wake him.', when: { quest: ['silence', 'five'] }, weight: 4, choices: [
        { label: 'I will wake him.', action: 'quest:silence:open', to: 'stone-head.topic.go' },
        { label: 'Not yet.', action: 'close' },
      ] },
      { id: 'stone-head.topic.go', slot: 'topic', text: 'Do not come back to tell me how it goes. If you win, I will hear. If you lose, I will hear that too; it is quieter.', when: { quest: ['silence', 'open'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'stone-head.topic.awake', slot: 'topic', text: 'He is awake, on the shore to my left. I can feel him breathing through the ground. You are wasting the breath.', when: { quest: ['silence', 'open'], metMin: 1 }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'stone-head.topic.after', slot: 'topic', text: 'The gnome found his singer. The plaza is loud. I can hear it from here, and I am a long way from caring, and I care.', when: { quest: ['silence', 'ended'] }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'stone-head.topic.self', slot: 'topic', text: 'I was a king\'s voice before I was stone. The voice is still in here. It is the stone that is new; it arrived an age ago and never left.', choices: [{ label: 'Leave', action: 'close' }] },

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
      { id: 'king.react.rivershade', slot: 'react', text: 'The shade in the witch\'s stream, dead. It flooded my cellar every spring. My cellar thanks you; it has never thanked anyone.', when: kill('rivershade') },
      { id: 'king.react.beast', slot: 'react', text: 'Fog beasts by the stream, dead. They ate my messengers. I had stopped sending messengers; now I may start.', when: kill('beast') },
      { id: 'king.react.loggiant', slot: 'react', text: 'You killed the log giant. He was carrying my firewood. He carried it for eleven years and never arrived, so: even.', when: kill('loggiant') },
      { id: 'king.react.spider', slot: 'react', text: 'The chapel on legs fell out of the sky over my cliffs. I had a bet with the witch that it would land on her. I lost the bet; I won the view.', when: kill('spiderchapel') },
      { id: 'king.react.hurt', slot: 'react', text: 'You are bleeding on my floor. Bleed on the candles; they like it.', when: HURT },
      { id: 'king.react.down', slot: 'react', text: 'You went down by the stream, I am told. The fog brings back what it finds. Not the shards. Never the shards.', when: DOWN },
      { id: 'king.react.lick', slot: 'react', text: 'You licked the frog. The frog is my neighbour. We do not speak; now I know why.', when: feat('lick') },
      { id: 'king.react.chest', slot: 'react', text: 'You opened a chest. If it was mine, I pay generously for its return. If it was not mine, it is now.', when: feat('chest') },
      { id: 'king.react.sip', slot: 'react', text: 'Sip while I speak and I will charge you for the air.', when: feat('sip', { hero: 'knight' }) },
      { id: 'king.react.float', slot: 'react', text: 'The floating. Stop the floating. A king should be the tallest thing in the room.', when: { hero: 'wizard', metMin: 1 } },
      { id: 'king.react.bucket', slot: 'react', text: 'I hear you broke a bucket in the skeleton\'s street. He pays you for that? I pay better. I pay in shards and in silence; he only has coins.', when: kill('bucket') },
      { id: 'king.react.leanking', slot: 'react', text: 'The sad king lost his throne for a minute, I heard. Mine was lost for a year. We are not the same.', when: kill('rift-king') },
      { id: 'king.react.gravelord', slot: 'react', text: 'The counter of coins sent you after a cyclops, and it died. He will call that a crown. I call it nine hundred shards he could have spent here.', when: kill('cyclops-lord') },
      { id: 'king.react.mythic', slot: 'react', text: 'That thing you carry is mythic. I can tell from here; the candles leaned toward it.', when: { flag: 'equipped-mythic' }, once: true },
      { id: 'king.react.boss', slot: 'react', text: '{lastBoss}. Dead. Whatever it dropped, bring it here first. The skeleton will only count it.', when: BOSS },

      { id: 'king.topic.ask', slot: 'topic', text: 'The Warden. My own antlered warden has taken my castle, and the throne within it. Kill it, and I will reward you... very generously.', voice: 'king-ask', when: { quest: ['throne', 'none'] }, weight: 3, choices: [
        { label: "I'll do it.", action: 'quest:throne:active', to: 'king.topic.go' },
        { label: 'What would I get?', to: 'king.topic.offer' },
        { label: 'Not now.', action: 'close' },
      ] },
      { id: 'king.topic.offer', slot: 'topic', text: 'Shards. A great many. And my signet, which makes any blade hungrier. Very generous, as I said.', when: { quest: ['throne', 'none'] }, choices: [
        { label: "I'll do it.", action: 'quest:throne:active', to: 'king.topic.go' },
        { label: 'Not now.', action: 'close' },
      ] },
      { id: 'king.topic.go', slot: 'topic', text: 'Then go. It sulks in the east forest, under the rain.', when: { quest: ['throne', 'active'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'king.topic.wait', slot: 'topic', text: 'The Warden still breathes. I can hear it chewing my furniture.', voice: 'king-wait', when: { quest: ['throne', 'active'], metMin: 1 }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'king.topic.thanks', slot: 'topic', text: 'It is dead? Then the castle is mine again. Take it, all of it. I said generously, and I meant it.', voice: 'king-thanks', when: { quest: ['throne', 'slain'] }, weight: 4, choices: [
        { label: 'Take the reward', action: 'quest:throne:done', to: 'king.topic.purse' },
      ] },
      { id: 'king.topic.purse', slot: 'topic', text: 'Fifteen hundred Moon Shards. Count them if you like; I did, twice, and it hurt both times.', when: { quest: ['throne', 'done'] }, once: true, choices: [
        { label: 'Take the shards', to: 'king.topic.signet' },
      ] },
      { id: 'king.topic.signet', slot: 'topic', text: 'The signet. My own seal. Any blade that carries it bites deeper. Wear it, sell it; I am past caring, which is what generosity is.', when: { quest: ['throne', 'done'] }, once: true, choices: [
        { label: 'Take the signet', to: 'king.topic.sealed' },
      ] },
      { id: 'king.topic.sealed', slot: 'topic', text: 'Now go and tell the skeleton beyond the portal what I paid. Slowly. He counts slowly.', when: { quest: ['throne', 'done'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'king.topic.crown', slot: 'topic', text: 'My crown was antlers before it was gold. Everything here was something else first. The Warden was my gardener.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'king.topic.buys', slot: 'topic', text: 'I buy what the great ones drop. Fangs, horns, scales, ribs. Bring them to the throne; I do not get up.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'king.topic.rival', slot: 'topic', text: 'The skeleton beyond the portal says he pays better. He pays in coins he took from people crossing his bridge. I pay in shards I took from nobody.', when: { metMin: 2 }, choices: [{ label: 'Leave', action: 'close' }] },

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
      about: 'The knight who knelt in the cloister when the last bell rang and has been listening since; two hundred shards and he walks beside you.',
    },
    lines: [
      { id: 'vigil.greet.first', slot: 'greet', text: 'I knelt here when the last bell rang. I am still listening. Walk toward the head, {hero}; it heard more than I did.', when: { metMax: 0 } },
      { id: 'vigil.greet.again', slot: 'greet', text: 'Back. Quieter. Either you learned or you are hurt. Do not say which; I am listening for it.', when: { metMin: 1, metMax: 2 } },
      { id: 'vigil.greet.old', slot: 'greet', text: 'Those footsteps. You have changed shoes twice since the first visit. I noticed; I did not get up.', when: { metMin: 3 } },
      { id: 'vigil.greet.wizard', slot: 'greet', text: 'Your boots make no sound. I had to open my eyes to know you were here. I resent that.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },
      { id: 'vigil.greet.knight', slot: 'greet', text: 'Sir Aldric. You carry that cup like a relic. Perhaps it is one; I never ask what is in relics.', when: { hero: 'knight', metMin: 1 }, weight: 1.2 },
      { id: 'vigil.greet.ended', slot: 'greet', text: 'The bell. I hear it. I can stand up now. I had forgotten how; it turns out the knees remember.', when: { quest: ['silence', 'ended'] }, weight: 3 },

      { id: 'vigil.react.golem', slot: 'react', text: 'The crystal men in the sand. I heard them shatter from here. It is the first new sound in a year.', when: kill('crystalgolem') },
      { id: 'vigil.react.cyclops', slot: 'react', text: 'The cyclops in the eye pool. I heard it go down. The water is still settling.', when: kill('cyclops') },
      { id: 'vigil.react.warden', slot: 'react', text: 'The antlered one in the east forest. It stopped. Even the rain seems to have noticed.', when: kill('warden') },
      { id: 'vigil.react.lurker', slot: 'react', text: 'The thing in the lily pond. I heard the splash and then I heard no splash. The second is the one I was waiting for.', when: kill('lurker') },
      { id: 'vigil.react.hurt', slot: 'react', text: 'You are hurt. I can hear it in your breathing. Sit. The stone is cold, but it is honest.', when: HURT },
      { id: 'vigil.react.down', slot: 'react', text: 'I heard you go down. All of it. The oath held me here, and I have never liked it less.', when: DOWN },
      { id: 'vigil.react.ale', slot: 'react', text: 'You drank the rowers\' beer. I can hear it in your footsteps. They have opinions now.', when: feat('ale') },
      { id: 'vigil.react.fly', slot: 'react', text: 'Something flew over the cloister just now. If it was you, you fly loudly.', when: feat('fly') },
      { id: 'vigil.react.bounce', slot: 'react', text: 'You bounced on a mushroom. I heard the mushroom. The mushroom is fine.', when: feat('bounce') },
      { id: 'vigil.react.archer', slot: 'react', text: 'Wren. Your bowstring hums when you walk. Tune it, or do not. I like the note.', when: { hero: 'archer', metMin: 1 } },
      { id: 'vigil.react.sip', slot: 'react', text: 'Drink. I will not look. The oath says nothing about cups.', when: feat('sip', { hero: 'knight' }) },
      { id: 'vigil.react.bell', slot: 'react', text: 'They say the bell under the lake is found. I heard nothing. I am listening harder.', when: { quest: ['bell', 'done'] }, once: true, weight: 2 },
      { id: 'vigil.react.grave', slot: 'react', text: 'Skeletons rising in the alley of graves, so I hear. Bones are loud. I am glad to be far from it.', when: kill('grave-skeleton') },
      { id: 'vigil.react.fishguard', slot: 'react', text: 'You fought the fish king\'s guards under the lake, they say. Fighting under water. It must be very quiet. I am jealous.', when: kill('fish-guard') },
      { id: 'vigil.react.boss', slot: 'react', text: '{lastBoss} fell somewhere. The island rang like a struck shield. I felt it in my knees.', when: BOSS },

      { id: 'vigil.topic.head', slot: 'topic', text: 'The head at the end of the causeway was a king\'s voice before it was stone. It is still a voice. Walk toward it; it will speak first.', when: { quest: ['silence', 'none'] }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'vigil.topic.bell', slot: 'topic', text: 'The last bell rang the day the giant sat down on the north shore. One note. I have been waiting for the second. Bells come in twos.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'vigil.topic.hire', slot: 'topic', text: 'My oath is cheap. My sword is not. Two hundred shards and I walk beside you; the oath can listen on its own for a while.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'vigil.topic.cloister', slot: 'topic', text: 'The cloister was a chapel once. The roof left. The arches stayed; arches are stubborn, like knees.', when: { metMin: 2 }, choices: [{ label: 'Leave', action: 'close' }] },

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
      { id: 'croak.greet.sacked', slot: 'greet', text: 'The sack. You carried me home in the sack. I have made peace with the sack. I have not made peace with you.', when: { quest: ['croak', ['returned', 'done']], metMin: 1 }, weight: 2 },

      { id: 'croak.react.rivershade', slot: 'react', text: 'The shade in the stream, gone. It floated past here at night and judged me. I get enough of that from my father.', when: kill('rivershade') },
      { id: 'croak.react.beast', slot: 'react', text: 'The fog beasts by the stream. They never bothered me. We had an arrangement. The arrangement was tea.', when: kill('beast') },
      { id: 'croak.react.spider', slot: 'react', text: 'The walking chapel came down. It crossed the castle every evening; I set my reading by it. Now I read when I like, which is always.', when: kill('spiderchapel') },
      { id: 'croak.react.warden', slot: 'react', text: 'You killed the antlered one in the east. The king will be insufferable. Was insufferable. Will remain.', when: kill('warden') },
      { id: 'croak.react.hurt', slot: 'react', text: 'Bleeding, by the look of it. Lotus tea, thirty shards. It does not stop the bleeding, but you stop minding.', when: HURT },
      { id: 'croak.react.down', slot: 'react', text: 'Down, by my wall. The fog brought you back and left you by my tea. The fog does not charge; it is bad for business.', when: DOWN },
      { id: 'croak.react.lick', slot: 'react', text: 'You licked my father. Everyone does, eventually. He calls it respect.', when: feat('lick') },
      { id: 'croak.react.ale', slot: 'react', text: 'The rowers\' beer. I sold them the yeast. Do not tell them what it was.', when: feat('ale') },
      { id: 'croak.react.knight', slot: 'react', text: 'That cup. What is in it? No. Do not tell me. I would have to sell you a better one.', when: { hero: 'knight', metMin: 1 } },
      { id: 'croak.react.sip', slot: 'react', text: 'You sipped. In front of a monk. The monk sells tea. Think about the order of things.', when: feat('sip', { hero: 'knight' }) },
      { id: 'croak.react.float', slot: 'react', text: 'Stop floating. The king can see over the wall when you float, and then he can see me.', when: { hero: 'wizard', metMin: 2 } },
      { id: 'croak.react.god', slot: 'react', text: 'You killed the Frog God in my father\'s dream, I hear. He is going to wake up so loud.', when: kill('dmt-entity') },
      { id: 'croak.react.bubble', slot: 'react', text: 'Lean bubbles popped in the dream, they say. Not mine. Nothing in there is mine. Most things out here are not mine either.', when: kill('lean-bubble') },
      { id: 'croak.react.ghoul', slot: 'react', text: 'Word from beyond the portal: you popped a styro-ghoul. Their cups are purple. Mine is tea. I would like that noted somewhere.', when: kill('styro-ghoul') },
      { id: 'croak.react.boss', slot: 'react', text: '{lastBoss}, dead. Tea afterwards. Thirty shards. The price is the same; the need is not.', when: BOSS },

      { id: 'croak.topic.busted', slot: 'topic', text: "Ribbit. Whatever my dad told you, it's not mine.", voice: 'croak-busted', when: { quest: ['croak', 'active'] }, weight: 4, choices: [
        { label: 'Your father wants you home.', to: 'croak.topic.moved' },
        { label: 'Put him in the bag', to: 'croak.topic.sacked' },
        { label: 'Leave', action: 'close' },
      ] },
      { id: 'croak.topic.moved', slot: 'topic', text: 'Ribbit. Tell him I moved to the lotus pond. Permanently.', when: { quest: ['croak', 'active'] }, choices: [
        { label: 'Into the sack.', to: 'croak.topic.sacked' },
        { label: 'Leave', action: 'close' },
      ] },
      { id: 'croak.topic.sacked', slot: 'topic', text: 'Hey! Hey! Not the sack again!', voice: 'croak-bagged', when: { quest: ['croak', 'active'] }, choices: [
        { label: 'In you go.', action: 'bag-croak' },
      ] },
      { id: 'croak.topic.king', slot: 'topic', text: 'The Frog King dreams in the hollow. Do not wake him with iron. Wake him with your tongue, like everyone else.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'croak.topic.tea', slot: 'topic', text: 'Lotus tea steadies the blade hand. Thirty shards. Moon dew, forty. I do not haggle; haggling is loud.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'croak.topic.shade', slot: 'topic', text: 'Why here? The castle wall has the best shade on the island. The king has never once looked at his own wall. Kings look out.', when: { metMin: 1 }, choices: [{ label: 'Leave', action: 'close' }] },

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
      { id: 'frogking.react.bloodeye', slot: 'react', text: 'The eye over the chasm closed. It watched the hollow for an age. I waved every morning. It never waved back.', when: kill('blood-eye') },
      { id: 'frogking.react.troll', slot: 'react', text: 'The troll in the gorge. Croak sold him something once. Whatever it was, it did not help him today.', when: kill('troll') },
      { id: 'frogking.react.cyclops', slot: 'react', text: 'The cyclops in the eye pool is dead. One eye. I have dreamed a thousand and never once dreamed one.', when: kill('cyclops') },
      { id: 'frogking.react.hurt', slot: 'react', text: 'You are hurt, stranger. Sit. The moss is clean; the hollow is old enough to be clean.', when: HURT },
      { id: 'frogking.react.down', slot: 'react', text: 'You went down in my hollow. The dreams nearly took you. They are polite dreams; they put you back.', when: DOWN },
      { id: 'frogking.react.lick', slot: 'react', text: 'You licked. Ribbit. Everyone says they will not, and then.', when: feat('lick') },
      { id: 'frogking.react.bounce', slot: 'react', text: 'You bounced on a mushroom. The mushrooms are mine too. They like it; they do not say so.', when: feat('bounce') },
      { id: 'frogking.react.swim', slot: 'react', text: 'You swam the pond. Croak swims it when he is avoiding me. So, often.', when: feat('swim') },
      { id: 'frogking.react.wizard', slot: 'react', text: 'You float like a thought. Thoughts are what I am made of, in there. Do not float into the wrong one.', when: { hero: 'wizard', metMin: 1 } },
      { id: 'frogking.react.archer', slot: 'react', text: 'The girl on the bow eats mushrooms. Not mine, I hope. Mine are for sitting on and for bouncing.', when: { hero: 'archer', metMin: 1 } },
      { id: 'frogking.react.painter', slot: 'react', text: 'You killed the painter in my dream. The colours will run for a while; let them.', when: kill('trip-wizard') },
      { id: 'frogking.react.god', slot: 'react', text: 'You slew my god. In my own dream. I woke with a headache the size of the moon. Ribbit.', when: kill('dmt-entity'), weight: 3 },
      { id: 'frogking.react.leanking', slot: 'react', text: 'I hear the sad king lets you fight him for his crown. In my dream you fight a god for an eye. We are both generous.', when: kill('rift-king') },
      { id: 'frogking.react.bagged', slot: 'react', text: 'My boy, in a sack, on your back. I can hear him complaining from here. That is how I know it is him.', when: { quest: ['croak', 'bagged'] }, weight: 3 },
      { id: 'frogking.react.boss', slot: 'react', text: '{lastBoss}, I heard. The hollow heard. The hollow hears everything; it is shaped like an ear.', when: BOSS },

      { id: 'frogking.topic.ask', slot: 'topic', text: "My son Croak has wandered off again. Find him, stranger. He might be dealing things he shouldn't be... again.", voice: 'frog-ask', when: { quest: ['croak', 'none'] }, weight: 3, choices: [
        { label: "I'll find him.", action: 'quest:croak:active', to: 'frogking.topic.where' },
        { label: 'Not my problem.', action: 'close' },
      ] },
      { id: 'frogking.topic.where', slot: 'topic', text: 'He likes shade; the king\'s castle casts a long one. Use the sack. He has never walked anywhere he was asked to. He got that from me, and I want it back.', when: { quest: ['croak', 'active'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'frogking.topic.wait', slot: 'topic', text: 'Croak is still out there. Try the shady places. He likes the shady places.', voice: 'frog-wait', when: { quest: ['croak', ['active', 'bagged']], metMin: 1 }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'frogking.topic.reward', slot: 'topic', text: 'My boy, home in a sack! You have my thanks, stranger. As a sign of respect... you may lick me.', voice: 'frog-reward', when: { quest: ['croak', 'returned'] }, weight: 4, choices: [
        { label: 'No, you must be sick or something', action: 'quest:croak:done', to: 'frogking.topic.declined' },
        { label: 'Uhh... sure', to: 'frogking.topic.licked' },
      ] },
      { id: 'frogking.topic.declined', slot: 'topic', text: 'Suit yourself. Here, take some shards instead.', voice: 'frog-declined', when: { quest: ['croak', 'done'], notFlag: 'licked' }, once: true, weight: 3, choices: [
        { label: 'Take the shards', action: 'close' },
      ] },
      { id: 'frogking.topic.licked', slot: 'topic', text: 'Hold still. This will only take about two minutes.', voice: 'frog-licked', when: { quest: ['croak', 'returned'] }, choices: [
        { label: '*lick*', action: 'lick' },
      ] },
      { id: 'frogking.topic.changed', slot: 'topic', text: 'Changed your mind? The offer stands. It has stood for an age; it is used to standing.', when: { quest: ['croak', 'done'], notFlag: 'licked', metMin: 1 }, weight: 2, choices: [
        { label: '*lick*', action: 'lick' },
        { label: 'Still no.', action: 'close' },
      ] },
      { id: 'frogking.topic.anytime', slot: 'topic', text: 'Ah, my friend. You can lick me any time you want.', voice: 'frog-anytime', when: { quest: ['trip', ['done', 'god']] }, weight: 2, choices: [
        { label: '*lick*', action: 'lick' },
        { label: 'Not today.', action: 'close' },
      ] },
      { id: 'frogking.topic.god', slot: 'topic', text: 'You killed my god and took his eye. Keep it. He has two more; he only ever opened the third for you.', when: { quest: ['trip', 'god'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'frogking.topic.skin', slot: 'topic', text: 'My skin remembers colours you have never seen. It remembers them on the tongue. There is no other way in; I have looked.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'frogking.topic.tadpole', slot: 'topic', text: 'Croak was such a good tadpole. Then he learned to read. Reading is where it starts; selling is where it ends up.', when: { metMin: 1 }, choices: [{ label: 'Leave', action: 'close' }] },

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
      gag: 'For three hundred shards he will stand. Everything else he does sitting down.',
      about: 'The knight who has sat on the cliff edge for a hundred years watching a castle whose windows are lit and whose doors never open; three hundred shards and he stands.',
    },
    lines: [
      { id: 'sentry.greet.first', slot: 'greet', text: 'Those windows have been lit for a hundred years. No one has come out. Sit, if you must; the cliff has room.', when: { metMax: 0 } },
      { id: 'sentry.greet.again', slot: 'greet', text: 'Back. I did not stand. That costs three hundred.', when: { metMin: 1, metMax: 2 } },
      { id: 'sentry.greet.old', slot: 'greet', text: '{hero}. {met} visits and no shards. I am starting to think you like the view.', when: { metMin: 3 } },
      { id: 'sentry.greet.knight', slot: 'greet', text: 'A sentinel. Weary, by the cup. I am weary by the cliff. Between us we could manage one whole knight.', when: { hero: 'knight', metMin: 1 }, weight: 1.2 },
      { id: 'sentry.greet.wizard', slot: 'greet', text: 'Over a cliff, floating. The cliff has waited a hundred years for someone to do that. It is unimpressed.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },

      { id: 'sentry.react.passbeast', slot: 'react', text: 'The beast in the pass. Dead. I told you: go around, or go with me. You went through. I am rewriting my advice.', when: kill('passbeast'), weight: 3 },
      { id: 'sentry.react.troll', slot: 'react', text: 'The troll under the bridge, gone. It bellowed every dusk. I will miss the punctuality.', when: kill('troll') },
      { id: 'sentry.react.emberrider', slot: 'react', text: 'The rider in the dead wood. I watched his fire from here each night. Tonight I will watch the dark, which is cheaper.', when: kill('emberrider') },
      { id: 'sentry.react.hollowking', slot: 'react', text: 'The giant on the shore is dead. I did not stand for it. I have stood for nothing in a hundred years. Well. I shifted.', when: kill('hollowking'), weight: 3 },
      { id: 'sentry.react.hurt', slot: 'react', text: 'You are bleeding on my cliff. Sit. It is the one thing I can recommend from experience.', when: HURT },
      { id: 'sentry.react.down', slot: 'react', text: 'Down in the pass. From up here it looked brief. Everything does, from up here; it is the cliff\'s one kindness.', when: DOWN },
      { id: 'sentry.react.fly', slot: 'react', text: 'You flew. Off a cliff. On purpose. Three hundred shards says I will not try it.', when: feat('fly') },
      { id: 'sentry.react.climb', slot: 'react', text: 'You climbed the cliff. There are stairs. I have watched people not find the stairs for a century.', when: feat('climb') },
      { id: 'sentry.react.skyeye', slot: 'react', text: 'Eyes in the sky, and you shot one. The sky has had eyes since the giant sat down. Nobody asked them to leave until you.', when: feat('skyeye') },
      { id: 'sentry.react.archer', slot: 'react', text: 'Wren. You ride a bow. I ride a cliff. Mine goes nowhere, but it has never dropped me.', when: { hero: 'archer', metMin: 1 } },
      { id: 'sentry.react.sip', slot: 'react', text: 'Sip. I will watch the windows. Someone has to, and it is not going to be the windows.', when: feat('sip', { hero: 'knight' }) },
      { id: 'sentry.react.mailknight', slot: 'react', text: 'Word came up the pass: you broke a chain-mail knight in the sad king\'s street. Chain mail. In this age. No wonder.', when: kill('mail-knight') },
      { id: 'sentry.react.carriage', slot: 'react', text: 'You rode the carriage round the sad king\'s castle, they say. It never arrives. I respect a thing that commits to sitting.', when: feat('carriage') },
      { id: 'sentry.react.hired', slot: 'react', text: 'You hired someone. Not me. I noticed; I notice everything from this rock. It is the rock\'s one gift.', when: { flag: 'hired', companions: 1 }, once: true },
      { id: 'sentry.react.boss', slot: 'react', text: '{lastBoss} is dead, I hear. The windows did not flicker. They never do.', when: BOSS },

      { id: 'sentry.topic.hire', slot: 'topic', text: 'I sit. I watch. For three hundred shards I will stand. Standing is where it gets expensive.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'sentry.topic.windows', slot: 'topic', text: 'A hundred years lit and no one has come out. Either they are very happy in there, or the candles are. I lean toward the candles.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'sentry.topic.pass', slot: 'topic', text: 'The pass below is the beast\'s. Go around, or go with me. Through is also a choice; it is the beast\'s favourite.', when: { bossAlive: 'passbeast' }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'sentry.topic.sword', slot: 'topic', text: 'The sword is point-down because that is how you rest a sword, and because it has been a hundred years and the point has gone in a little.', when: { metMin: 2 }, choices: [{ label: 'Leave', action: 'close' }] },

      { id: 'sentry.bye.sitting', slot: 'bye', text: 'Go. I will still be sitting.' },
      { id: 'sentry.bye.edge', slot: 'bye', text: 'Mind the edge. It minds nothing.' },
      { id: 'sentry.bye.price', slot: 'bye', text: 'Three hundred. The price does not sit.' },

      { id: 'sentry.bark.lit', slot: 'bark', text: 'Still lit.' },
      { id: 'sentry.bark.out', slot: 'bark', text: 'No one has come out.' },
      { id: 'sentry.bark.price', slot: 'bark', text: 'Three hundred shards.' },
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
      { id: 'standard.greet.first', slot: 'greet', text: 'The banner is for a kingdom that lost. I kept the banner. Are you here to enlist? Nobody is here to enlist.', when: { metMax: 0 } },
      { id: 'standard.greet.again', slot: 'greet', text: 'You came back. That makes you the army\'s most loyal member. Also its only.', when: { metMin: 1, metMax: 2 } },
      { id: 'standard.greet.old', slot: 'greet', text: '{hero}, reporting. {met} musters. I have begun a roll. Your name is on it, spelled wrong; the wind did that.', when: { metMin: 3 } },
      { id: 'standard.greet.wizard', slot: 'greet', text: 'A floating wizard. The army has never had one. The army has never had anyone. You would be the first of two things.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },
      { id: 'standard.greet.archer', slot: 'greet', text: 'An archer. An army with an archer can be told to hold the ridge. I have been holding it alone. It holds itself, mostly.', when: { hero: 'archer', metMin: 1 }, weight: 1.2 },

      { id: 'standard.react.passbeast', slot: 'react', text: 'The beast of the pass fell. I planted the banner a little harder for that. The wind planted it back.', when: kill('passbeast') },
      { id: 'standard.react.troll', slot: 'react', text: 'The troll under the bridge, dead. He once asked to join. I said the uniform was bones only. He took it badly.', when: kill('troll') },
      { id: 'standard.react.emberrider', slot: 'react', text: 'The rider burned through below. You put him out. I shall tell the aurora; it is the only one who listens.', when: kill('emberrider') },
      { id: 'standard.react.hollowking', slot: 'react', text: 'The giant with the castle in his chest is down. I bore the standard of the kingdom he ate. The banner outlasted him. Banners do.', when: kill('hollowking'), weight: 3 },
      { id: 'standard.react.hurt', slot: 'react', text: 'The army\'s first casualty. I have waited an age to say that; it is less fun than I thought.', when: HURT },
      { id: 'standard.react.down', slot: 'react', text: 'You fell in the pass. The roll says missing. I have crossed it out; the fog returns what it borrows.', when: DOWN },
      { id: 'standard.react.fly', slot: 'react', text: 'You flew past the banner. The banner saluted. It was the wind, but I am counting it.', when: feat('fly') },
      { id: 'standard.react.skyeye', slot: 'react', text: 'You shot an eye out of the sky. The sky is where I keep the aurora. Watch your aim; that is an order, and the first I have ever given.', when: feat('skyeye') },
      { id: 'standard.react.levelup', slot: 'react', text: 'The banner leaned toward you as you came up. It leans toward the wind too, so: a weak signal. But a signal.', when: feat('levelup') },
      { id: 'standard.react.sip', slot: 'react', text: 'You sip from a cup on duty. In my army that was a flogging. My army had no flogger, so: it was a frown.', when: feat('sip', { hero: 'knight' }) },
      { id: 'standard.react.hover', slot: 'react', text: 'You hover above the ridge. If you hover above the banner you outrank it. Do not outrank the banner.', when: { hero: 'wizard', metMin: 1 } },
      { id: 'standard.react.graveskel', slot: 'react', text: 'Risen skeletons in the alley of graves, and you put them back down. Cousins, distantly. Everyone with bones is.', when: kill('grave-skeleton') },
      { id: 'standard.react.galaxyknight', slot: 'react', text: 'A galaxy knight fell in the skeleton king\'s court, so they say. He has knights. I have a banner. We each got something.', when: kill('galaxy-knight') },
      { id: 'standard.react.boss', slot: 'react', text: '{lastBoss} fell. The aurora rippled. It does that for the great ones and for nothing else; it has taste.', when: BOSS },

      { id: 'standard.topic.wind', slot: 'topic', text: 'Wind up here never stops. Neither does the aurora. Neither do I. One of us will stop eventually. My shards are on the aurora.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'standard.topic.enlist', slot: 'topic', text: 'Enlist. There is no pay, no food, no orders, and the ridge is cold. The banner, however, is magnificent.', weight: 2, choices: [
        { label: 'I enlist.', action: 'journal:Enlisted in Hollow Jack\'s army of one, on the windy peak.', to: 'standard.topic.enlisted' },
        { label: 'I will think about it.', action: 'close' },
      ] },
      { id: 'standard.topic.enlisted', slot: 'topic', text: 'Welcome. Your duties are: none. Your rank is: the other one. Dismissed; that is also your first order.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'standard.topic.counter', slot: 'topic', text: 'The skeleton who counts coins sits on a throne beyond the portal. He offered me a job. Counting. I said I had a banner.', when: { metMin: 1 }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'standard.topic.kingdom', slot: 'topic', text: 'The kingdom lost when the giant sat down on the shore and ate its voices. I was holding the banner. I am still holding it. Nobody said stop.', when: { quest: ['silence', ['told', 'five', 'open']] }, choices: [{ label: 'Leave', action: 'close' }] },

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
      { id: 'priest.greet.first', slot: 'greet', text: 'The light runs up the bark like water runs down a hill. Backwards. Always backwards. You walk forwards; it looks strange here.', when: { metMax: 0 } },
      { id: 'priest.greet.again', slot: 'greet', text: 'You came back. The tree noticed first. It notices everything first; I notice it second, which is my job.', when: { metMin: 1, metMax: 2 } },
      { id: 'priest.greet.old', slot: 'greet', text: '{hero}. The stones have a name for you now. I have not carved it. I am waiting to see how you end.', when: { metMin: 3 } },
      { id: 'priest.greet.knight', slot: 'greet', text: 'The knight who drinks. The tree drinks too; it drinks light. Neither of you ever seems full.', when: { hero: 'knight', metMin: 1 }, weight: 1.2 },
      { id: 'priest.greet.wizard', slot: 'greet', text: 'Up. You go up, like the light. You are the only two things here that do; the tree is pleased.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },

      { id: 'priest.react.emberrider', slot: 'react', text: 'The rider is out. You put out the rider. I let him pass every night; it was easier. Now the nights will need a new habit.', when: kill('emberrider'), weight: 3 },
      { id: 'priest.react.yeti', slot: 'react', text: 'The yeti in the frozen grove fell. The snow there will melt slower now; it was afraid of him.', when: kill('yeti') },
      { id: 'priest.react.hollowking', slot: 'react', text: 'The giant on the shore is dead and the stones are loud. Every name on them is saying itself at once. Mine is not among them. Still.', when: kill('hollowking'), weight: 3 },
      { id: 'priest.react.passbeast', slot: 'react', text: 'The beast in the pass. I heard it from here, backwards: first the quiet, then the roar.', when: kill('passbeast') },
      { id: 'priest.react.hurt', slot: 'react', text: 'The roots noticed you bleeding before I did; they drink upward. You will be in the leaves by spring. It is a kind of being remembered.', when: HURT },
      { id: 'priest.react.down', slot: 'react', text: 'The dead wood put you down. The rider does that. The fog gave you back; the fog is not as choosy as the tree.', when: DOWN },
      { id: 'priest.react.skyeye', slot: 'react', text: 'An eye fell from the sky. Up here that is weather. You are the first weather that aims.', when: feat('skyeye') },
      { id: 'priest.react.levelup', slot: 'react', text: 'The light ran up the bark faster when you came in. You have grown; it noticed before I did. It notices everything first.', when: feat('levelup') },
      { id: 'priest.react.fly', slot: 'react', text: 'You flew over the grove. The tree has wanted to for an age. Do not tell it how.', when: feat('fly') },
      { id: 'priest.react.archer', slot: 'react', text: 'Wren. Mushrooms, as you walk. The roots eat the dead. Everyone eats something; you chose better.', when: { hero: 'archer', metMin: 1 } },
      { id: 'priest.react.sip', slot: 'react', text: 'Sip. The tree sips light the same way: slowly, and with the eyes closed.', when: feat('sip', { hero: 'knight' }) },
      { id: 'priest.react.gravelord', slot: 'react', text: 'The cyclops of the alley of graves is dead, they say. More stones for the alley. I keep the names here; they keep the bones.', when: kill('cyclops-lord') },
      { id: 'priest.react.fountain', slot: 'react', text: 'In the sad king\'s kingdom you drank from a fountain that pours lean, I heard. Up here the water runs upward. We would not know what to do with you.', when: feat('fountain') },
      { id: 'priest.react.boss', slot: 'react', text: '{lastBoss}. Gone. A name for the stones. I will carve it below yours, when yours is ready. Yours is not ready.', when: BOSS },

      { id: 'priest.topic.tree', slot: 'topic', text: 'The light in the bark is the kingdom\'s old voice, climbing. It has been climbing since the giant sat down. It is nearly at the leaves.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'priest.topic.stones', slot: 'topic', text: 'Every stone here has a name carved on it. Mine is not carved yet. I am waiting for a good death; the bad ones are all taken.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'priest.topic.rider', slot: 'topic', text: 'A rider burns through the dead wood at night. Let him pass. Or do not; the stones could use a rider.', when: { bossAlive: 'emberrider' }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'priest.topic.voices', slot: 'topic', text: 'The head sent you for five voices. The tree has listened for them for an age. It will not help; it is a tree. But it will know.', when: { quest: ['silence', ['told', 'five']] }, weight: 2, choices: [{ label: 'Leave', action: 'close' }] },

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
      { id: 'lantern-witch.greet.first', slot: 'greet', text: 'The city across the water has more bridges than people. Keep your lantern low. The aqueducts are listening.', when: { metMax: 0 } },
      { id: 'lantern-witch.greet.again', slot: 'greet', text: 'Back. You cannot see it either, then. Nobody can. I describe it anyway; someone should.', when: { metMin: 1, metMax: 2 } },
      { id: 'lantern-witch.greet.old', slot: 'greet', text: 'The city has noticed you, {hero}. It noticed on your second visit; it is a slow city.', when: { metMin: 3 } },
      { id: 'lantern-witch.greet.archer', slot: 'greet', text: 'A bow for a horse. The city has a bridge for every horse and no horses. You would do well there.', when: { hero: 'archer', metMin: 1 }, weight: 1.2 },
      { id: 'lantern-witch.greet.wizard', slot: 'greet', text: 'The city floats too, across the water, on nothing I can prove. You would be at home there.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },

      { id: 'lantern-witch.react.spider', slot: 'react', text: 'The chapel on legs is down. It walked between me and the city every evening. Now I can see the city. You cannot. That is not my fault.', when: kill('spiderchapel'), weight: 3 },
      { id: 'lantern-witch.react.rivershade', slot: 'react', text: 'The shade in the stream is dead. It rose at dusk and looked west with me. I will miss having someone to not talk to.', when: kill('rivershade') },
      { id: 'lantern-witch.react.beast', slot: 'react', text: 'Fog beasts in the meadow, gone. They howled at the city. The city never howled back; it is above that.', when: kill('beast') },
      { id: 'lantern-witch.react.warden', slot: 'react', text: 'The antlered one in the east forest. Dead. The king will want to tell you about it. Let him; it is the only story he has.', when: kill('warden') },
      { id: 'lantern-witch.react.hurt', slot: 'react', text: 'Blood. Lower the lantern. The aqueducts hear blood; they are built for it.', when: HURT },
      { id: 'lantern-witch.react.down', slot: 'react', text: 'The cliffs took you down. I watched the city while it happened. It did nothing. It is good at nothing.', when: DOWN },
      { id: 'lantern-witch.react.fly', slot: 'react', text: 'You flew out over the water. Did you see it? No. Nobody does. Keep flying; it is a long way to nothing.', when: feat('fly') },
      { id: 'lantern-witch.react.swim', slot: 'react', text: 'You swam the river. The river comes from the city, I say. It says nothing. Rivers are tactful.', when: feat('swim') },
      { id: 'lantern-witch.react.chest', slot: 'react', text: 'A chest. I heard the lid. The city has ten thousand chests and nobody to open them. I have counted none of them.', when: feat('chest') },
      { id: 'lantern-witch.react.sip', slot: 'react', text: 'Sip. The city drinks from its aqueducts; they are rude, but they are full.', when: feat('sip', { hero: 'knight' }) },
      { id: 'lantern-witch.react.mushrooms', slot: 'react', text: 'Wren. You eat mushrooms. Not the ones that glow by the stream; they are the stream\'s, and it counts them.', when: { hero: 'archer', metMin: 1 } },
      { id: 'lantern-witch.react.hollowstaff', slot: 'react', text: 'Old Hollowstaff fell in the bucket street, they say. He threw diamonds. The city throws nothing. It keeps.', when: kill('diamond-wizard') },
      { id: 'lantern-witch.react.angler', slot: 'react', text: 'An angler died under the lake, I hear. Down there the lanterns are jellyfish. Up here mine is oil, and it minds its business.', when: kill('angler') },
      { id: 'lantern-witch.react.boss', slot: 'react', text: '{lastBoss}. Dead. Across the water the spires did not move. They never do; that is how I know they are there.', when: BOSS },

      { id: 'lantern-witch.topic.city', slot: 'topic', text: 'Spires, aqueducts, a bridge for every citizen and six to spare. It is there when the fog thins. The fog has not thinned in my lifetime.', choices: [
        { label: 'I see nothing.', to: 'lantern-witch.topic.nothing' },
        { label: 'Leave', action: 'close' },
      ] },
      { id: 'lantern-witch.topic.nothing', slot: 'topic', text: 'Nor do I, most nights. I describe it from memory. The memory may also be the fog. It is a very good fog.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'lantern-witch.topic.falls', slot: 'topic', text: 'I came to see the waterfalls. That was a long time ago. The waterfalls are still there, I say; the city pours them for nobody.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'lantern-witch.topic.lantern', slot: 'topic', text: 'Keep your lantern low. The aqueducts are listening, and they repeat things to the spires, and the spires are tall.', when: { metMin: 1 }, choices: [{ label: 'Leave', action: 'close' }] },

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
      { id: 'wanderer.greet.again', slot: 'greet', text: 'The lantern knew you were coming; it dipped. Or the wind did it. The wind gets credit for a lot of my lantern.', when: { metMin: 1, metMax: 2 } },
      { id: 'wanderer.greet.old', slot: 'greet', text: 'We keep meeting on this street, {hero}. The street is short; the odds were always good.', when: { metMin: 3 } },
      { id: 'wanderer.greet.knight', slot: 'greet', text: 'You glide on a cape. I walk. One of us has seen the burning castle; it is not the one with the better coat.', when: { hero: 'knight', metMin: 1 }, weight: 1.2 },
      { id: 'wanderer.greet.wizard', slot: 'greet', text: 'Orlan. The lantern has never had anyone to light from below. It is confused.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },

      { id: 'wanderer.react.loggiant', slot: 'react', text: 'The log giant is dead. He walked this street with his logs every night, behind me. Now the street is mine. It is a worse street.', when: kill('loggiant'), weight: 3 },
      { id: 'wanderer.react.beast', slot: 'react', text: 'Fog beasts in the meadow. Dead. They followed the lantern sometimes. It only ever leads back down this street; they learned that.', when: kill('beast') },
      { id: 'wanderer.react.rivershade', slot: 'react', text: 'The shade in the stream, gone. It rose at dusk. My lantern and it had an understanding: neither looked at the other.', when: kill('rivershade') },
      { id: 'wanderer.react.skeleton', slot: 'react', text: 'You hit the skeletons by the fire. They were cooking. Nothing; they were cooking nothing. But it is the principle.', when: kill('skeleton') },
      { id: 'wanderer.react.hurt', slot: 'react', text: 'Walk it off. I have walked off worse on this street; the street is good for one thing.', when: HURT },
      { id: 'wanderer.react.down', slot: 'react', text: 'The fog carried you back. I have never seen the fog carry anyone to the castle. It knows.', when: DOWN },
      { id: 'wanderer.react.fly', slot: 'react', text: "You flew over the village. From up there you did not see the castle burn. That's the point.", when: feat('fly') },
      { id: 'wanderer.react.ale', slot: 'react', text: 'The rowers\' beer. The lantern is swaying, or you are. I will say the lantern; it is kinder.', when: feat('ale') },
      { id: 'wanderer.react.chest', slot: 'react', text: 'You opened a chest. Was there a castle in it? No. There never is.', when: feat('chest') },
      { id: 'wanderer.react.archer', slot: 'react', text: 'You eat mushrooms as you walk. The lantern eats oil as I walk. The street feeds everyone, badly.', when: { hero: 'archer', metMin: 1 } },
      { id: 'wanderer.react.sip', slot: 'react', text: 'Sip. I used to sip. Then the castle, and I found I preferred to look.', when: feat('sip', { hero: 'knight' }) },
      { id: 'wanderer.react.ghoul', slot: 'react', text: 'The styro-ghouls across the portal; I hear you popped a few. Their cups glow. Mine is a lantern; I am the original.', when: kill('styro-ghoul') },
      { id: 'wanderer.react.graveskel', slot: 'react', text: 'Skeletons in the alley of graves, so they say. Bones everywhere want to walk. I walk; I understand them.', when: kill('grave-skeleton') },
      { id: 'wanderer.react.boss', slot: 'react', text: '{lastBoss} died somewhere far. The castle did not stop burning. I checked; it is the one thing I check.', when: BOSS },

      { id: 'wanderer.topic.castle', slot: 'topic', text: 'Across the water a castle burns and never falls.', weight: 2, choices: [
        { label: "Where? I don't see it.", to: 'wanderer.topic.point' },
        { label: 'Why does it burn?', to: 'wanderer.topic.why' },
        { label: 'Leave', action: 'close' },
      ] },
      { id: 'wanderer.topic.point', slot: 'topic', text: "No. That's the point.", choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'wanderer.topic.why', slot: 'topic', text: 'I stopped asking. You will too. It takes about a year.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'wanderer.topic.lantern', slot: 'topic', text: 'Follow the lantern if you like. It only ever leads back down this street. Everything does, eventually; the street is honest about it.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'wanderer.topic.village', slot: 'topic', text: 'The village pays the ogre in soup and me in nothing. I did not ask. Asking is how you end up with soup.', when: { metMin: 1 }, choices: [{ label: 'Leave', action: 'close' }] },

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
      { id: 'bride.greet.bells', slot: 'greet', text: '...do you hear the bells? They are real. They are coming from the shore. He said the bells, and then the sand ends.', when: { quest: ['bell', 'done'] }, weight: 3 },
      { id: 'bride.greet.shore', slot: 'greet', text: 'You brought me to where the sand ends. It is wet. Nobody said it would be wet.', when: { quest: ['bride', 'done'] }, weight: 5 },

      { id: 'bride.react.golem', slot: 'react', text: 'The crystal men. You broke them. They walked beside me some nights; they never said where the sand ends either.', when: kill('crystalgolem'), weight: 2 },
      { id: 'bride.react.cyclops', slot: 'react', text: 'The one-eyed thing in the pool, gone. It looked at me. One eye, and it chose me. I was flattered, a little.', when: kill('cyclops') },
      { id: 'bride.react.warden', slot: 'react', text: 'The antlered one is dead in the east. He walked through the rain. I walk through the sand. We were going to compare.', when: kill('warden') },
      { id: 'bride.react.hurt', slot: 'react', text: 'The sand is drinking you. It drinks everything; it is why it never ends.', when: HURT },
      { id: 'bride.react.down', slot: 'react', text: 'The sand had you for a while; it has everything for a while. Then it gave you back. It has never given anything back for me.', when: DOWN },
      { id: 'bride.react.swim', slot: 'react', text: 'You swam. The sea. You reached the sea. Does the sand end there? Do not tell me. I want to walk it.', when: feat('swim') },
      { id: 'bride.react.fly', slot: 'react', text: 'You flew over the dunes. From up there, can you see the end? No. I thought not.', when: feat('fly') },
      { id: 'bride.react.bounce', slot: 'react', text: 'You bounced on a mushroom. There are no mushrooms in the sand. There is nothing in the sand. That is its charm.', when: feat('bounce') },
      { id: 'bride.react.archer', slot: 'react', text: 'Wren. You ride a bow. He rode a horse. It left too, before he did.', when: { hero: 'archer', metMin: 1 } },
      { id: 'bride.react.float', slot: 'react', text: 'Above the sand. It is furious; I can feel it through my feet. Nobody has ever been out of its reach.', when: { hero: 'wizard', metMin: 2 } },
      { id: 'bride.react.fishguard', slot: 'react', text: 'Under the lake you fought the fish king\'s guards, they say. Under the lake. Is that where the sand ends? Under?', when: kill('fish-guard') },
      { id: 'bride.react.angler', slot: 'react', text: 'Two anglers died in the sea castle, I hear, behind a throne. Something was glowing there. I hear a lot, for a woman nobody talks to.', when: kill('angler') },
      { id: 'bride.react.boss', slot: 'react', text: '{lastBoss}. Dead. I heard it from the sand. The sand hears everything that falls on it; everything does, eventually.', when: BOSS },

      { id: 'bride.topic.sand', slot: 'topic', text: 'The sand does not end. I have walked it to the cliff and back. The cliff is not the end; it is the sand standing up.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'bride.topic.him', slot: 'topic', text: 'He said he would meet me where the sand ends. He did not say which end. I have tried both.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'bride.topic.nobells', slot: 'topic', text: '...do you hear the bells? No. Nor do I. I keep asking in case it changes.', when: { quest: ['bell', ['none', 'active', 'found']] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'bride.topic.bells', slot: 'topic', text: 'The bells. From the shore. Walk with me; the sand ends where the bells are. He said.', when: { quest: ['bell', 'done'] }, weight: 4, choices: [
        { label: 'Walk with me.', action: 'follow', when: { quest: ['bride', 'none'] } },
        { label: 'Not yet.', action: 'close', when: { quest: ['bride', 'none'] } },
        { label: 'Leave', action: 'close', when: { quest: ['bride', ['walking', 'done']] } },
      ] },
      { id: 'bride.topic.walking', slot: 'topic', text: 'Do not stop. The bells stop when I stop; I have tested it twice, and twice was plenty.', when: { quest: ['bride', 'walking'] }, weight: 6, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'bride.topic.ended', slot: 'topic', text: 'The sand ended. He was not there. The bells were. I will take the bells; they, at least, kept the appointment.', when: { quest: ['bride', 'done'] }, weight: 8, choices: [{ label: 'Leave', action: 'close' }] },

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
      { id: 'pim.greet.first', slot: 'greet', text: 'The galaxy turns once every age. I have counted three turns. I am very old, or very bored. Do not touch the telescope.', when: { metMax: 0 } },
      { id: 'pim.greet.again', slot: 'greet', text: 'I had the telescope on you earlier. You walk like someone who has lost something small.', when: { metMin: 1, metMax: 2 } },
      { id: 'pim.greet.old', slot: 'greet', text: 'I have charted you, {hero}. A slow star with a wide orbit and a habit of coming back.', when: { metMin: 3 } },
      { id: 'pim.greet.wizard', slot: 'greet', text: 'Hold still, Orlan; you are the only thing in the sky tonight I have not named.', when: { hero: 'wizard', metMin: 1 }, weight: 1.2 },
      { id: 'pim.greet.archer', slot: 'greet', text: 'Wren. This hut is a mushroom. I have seen what you do to mushrooms. I would ask you not to.', when: { hero: 'archer', metMin: 1 }, weight: 1.2 },

      { id: 'pim.react.loggiant', slot: 'react', text: 'The log giant on the haul road, dead. He blocked my eastern sky every evening at the same minute. I will need something else to set the clock by.', when: kill('loggiant') },
      { id: 'pim.react.skeleton', slot: 'react', text: 'The skeletons by the fire. You scattered them. They sat under my balcony for an age and never once looked up. Nobody looks up.', when: kill('skeleton') },
      { id: 'pim.react.beast', slot: 'react', text: 'Fog beasts in the west meadow. Dead. They howled at the moon. The moon smiled. I told them not to look; they looked.', when: kill('beast') },
      { id: 'pim.react.lurker', slot: 'react', text: 'The thing in the lily pond is dead. I charted it as a star once. It moved. Bad star.', when: kill('lurker') },
      { id: 'pim.react.hurt', slot: 'react', text: 'I can see the blood from the balcony; it is the brightest thing on the road. Sit before you fall off my chart.', when: HURT },
      { id: 'pim.react.down', slot: 'react', text: 'I had the telescope on the galaxy and missed you fall. Three turns, and I still miss the important ones.', when: DOWN },
      { id: 'pim.react.fly', slot: 'react', text: 'You flew across my lens. For a moment I had charted a new comet. It was you. I have left the comet in.', when: feat('fly') },
      { id: 'pim.react.bounce', slot: 'react', text: 'You bounced on the mushrooms by the pond. From up here it looks like a very small moon trying to leave.', when: feat('bounce') },
      { id: 'pim.react.levelup', slot: 'react', text: 'Brighter. You are brighter than you were; I measure these things. Not much brighter. A planet, not a star.', when: feat('levelup') },
      { id: 'pim.react.sip', slot: 'react', text: 'You sip while you walk. The moon sips too, I think; it is why it smiles. Do not look at it when it does.', when: feat('sip', { hero: 'knight' }) },
      { id: 'pim.react.float', slot: 'react', text: 'Floating. If you drift up another forty metres I shall have to chart you, and charge for it.', when: { hero: 'wizard', metMin: 1 } },
      { id: 'pim.react.skyeyes', slot: 'react', text: 'Eyes in the sky over the north shore, and you shot one. I charted those eyes as stars for an age. I owe several people an apology.', when: feat('skyeye') },
      { id: 'pim.react.leanking', slot: 'react', text: 'You beat the sad king in his own hall, I hear. Through the telescope his kingdom is one bright smudge. It flickered.', when: kill('rift-king') },
      { id: 'pim.react.painter', slot: 'react', text: 'You killed something in the frog\'s dream, they say. The galaxy wobbled when you did. I wrote that down and then crossed it out.', when: kill('trip-wizard') },
      { id: 'pim.react.boss', slot: 'react', text: '{lastBoss}, dead. One less hunter on the chart. I draw them; I do not enjoy erasing. Mirren charges the same either way.', when: BOSS },

      { id: 'pim.topic.turns', slot: 'topic', text: 'Three turns of the galaxy. The first I slept through. The second I counted. The third I am watching, in case it does something.', choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'pim.topic.chart', slot: 'topic', text: 'A star chart marks where the great hunters of this land sleep. Mirren sells them; I draw them. I draw, he sells, the hunters hunt. It is a system.', when: { notItem: 'star-chart' }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'pim.topic.charted', slot: 'topic', text: 'You carry one of my charts. The hunters on it are where I drew them, unless they have died, in which case blame the hunters.', when: { item: 'star-chart' }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'pim.topic.moon', slot: 'topic', text: 'Do not look at the moon when it smiles. It smiles when something dies. Tonight it has been smiling at you quite a lot.', when: { metMin: 1 }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'pim.topic.eyes', slot: 'topic', text: 'The sky over the north shore is full of eyes tonight. He is awake. I have put the telescope away; some things you do not need magnified.', when: { quest: ['silence', 'open'] }, weight: 3, choices: [{ label: 'Leave', action: 'close' }] },

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
