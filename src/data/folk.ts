/**
 * The people who just live here: no quests, no books, a few lines each, and something to be getting on with. They walk
 * their rounds, sit at their work and mutter as you pass, so a village is a village and not a row of buildings.
 */
import type { NpcDef, NpcBehaviour } from '../world/NPCs';
import { PALETTE } from '../render/palette';

export interface Folk extends NpcDef {
  at: { x: number; z: number; dy?: number };
  /** Sits on a barrel of its own (World places it). */
  seat?: boolean;
}

const person = (id: string, name: string, title: string, model: string, at: Folk['at'], behaviour: NpcBehaviour, lines: string[], seat = false): Folk => ({
  id, name, title, model, at, behaviour, lines, seat, chatter: true, accent: PALETTE.rune, weapon: 'sword',
});
const stand = (yaw: number): NpcBehaviour => ({ kind: 'stand', yaw });
const walk = (path: Array<[number, number]>, speed = 1.2): NpcBehaviour => ({ kind: 'loop', path, speed });
const round = (x: number, z: number, r: number, n = 8): Array<[number, number]> => Array.from({ length: n }, (_, i) => [x + Math.cos((i / n) * Math.PI * 2) * r, z + Math.sin((i / n) * Math.PI * 2) * r]);

const X = 1000, Z = 900;

export const FOLK: Folk[] = [
  // ----- The Dragon's Vale -----
  person('folk-lamplighter', 'Tollie', 'Lamplighter', 'gnome', { x: X + 2, z: Z + 100 }, walk([[X + 2, Z + 100], [X + 3, Z + 76], [X - 1, Z + 62], [X - 7, Z + 34], [X - 4, Z + 12], [X - 7, Z + 34], [X - 1, Z + 62], [X + 3, Z + 76]], 1.1),
    ['Forty lamps. I have lit them all. They are all lit. I check anyway.', 'The dragon breathes on number nine. It has never once needed me.', 'People say it is a small job. It is. I am small.']),
  person('folk-porter', 'Hob', 'Porter', 'knight-npc', { x: X + 12, z: Z + 62 }, walk([[X + 12, Z + 62], [X + 11, Z + 50], [X + 2, Z + 40], [X - 9, Z + 44], [X + 2, Z + 40], [X + 11, Z + 50]], 1.5),
    ['Barrels to the square. Barrels from the square. Do not ask me why.', 'The armour is for the barrels. They fight back on the stairs.', 'Mind your feet. And mine.']),
  person('folk-wenna', 'Wenna', 'Who Is Out For A Walk', 'maiden', { x: X + 9, z: Z + 58 }, walk(round(X + 1, Z + 52, 8.5), 1),
    ['Round the tree, round the tree. It is good for the legs.', 'The tree was here before the dragon. The dragon does not like to be reminded.', 'Everyone says hello to the tree. You did not. I saw.']),
  person('folk-tam', 'Old Tam', 'Who Remembers', 'wanderer', { x: X - 22, z: Z + 44 }, walk([[X - 11, Z + 44], [X - 22, Z + 44], [X - 28, Z + 42], [X - 22, Z + 44]], 0.9),
    ['I used to walk to the bridge and back for my health. Now I do it for the bridge.', 'That river moved. Do not look at me like that. It moved.', 'Good walking weather. It is always this weather.']),
  person('folk-guard-a', 'Sergeant Brask', 'Of the Vale Watch', 'knight-npc', { x: X + 30, z: Z + 40 }, walk([[X + 24, Z + 50], [X + 46, Z + 22], [X + 62, Z + 8], [X + 80, Z - 4], [X + 62, Z + 8], [X + 46, Z + 22]], 1.5),
    ['Nothing to report. Nothing has been reported since the dragon.', 'The chains hold. I check them. I do not cross them.', 'Beasts in the north wood. Stay on the lane, or do not, I am off at dusk.']),
  person('folk-guard-b', 'Pike', 'Of the Vale Watch', 'knight-npc', { x: X - 5, z: Z + 108 }, walk([[X - 5, Z + 108], [X + 8, Z + 108], [X + 11, Z + 94], [X + 8, Z + 108]], 1.2),
    ['I guard the arch. It has never tried anything.', 'Sergeant says stand here. So I walk about here.', 'Welcome to the vale. Please do not wake the lizard.']),
  person('folk-fisher', 'Grell', 'Who Has Caught Something Once', 'troll-fisher', { x: 960.5, z: 982 }, stand(Math.PI),
    ['Shh. Oh, it does not matter. There are no fish.', 'I caught one in the spring. I told it everything.', 'The river runs south and it does not come back. I respect that.']),
  person('folk-reader', 'Brother Ambrel', 'Reading Under the Tree', 'frog-monk', { x: X - 8, z: Z + 50 }, walk([[X - 8, Z + 50], [X - 9, Z + 55], [X - 8, Z + 50]], 0.5),
    ['This book says the world ends. It has been saying so for eight hundred pages.', 'I pace when it gets good. It is getting good.', 'I have read it twice. The dragon has read it four times.']),
  person('folk-gardener', 'Marrit', 'Who Grows Sunflowers', 'witch-cook', { x: 966, z: 1006 }, walk([[966, 1006], [980, 1006], [980, 1015], [966, 1015]], 0.7),
    ['They face the moon here. I did not teach them that.', 'Pick one and I will know.', 'The stew needs seeds. The seeds need the sun. We have an arrangement with the moon.']),
  person('folk-kid-a', 'Pip', 'Who Is It', 'gnome', { x: X + 1, z: Z + 58 }, walk(round(X + 1, Z + 52, 5.5, 10), 2.4), ['You are it!', 'Cannot catch me!', 'Is that a real sword? Is it? Is it?']),
  person('folk-kid-b', 'Nib', 'Who Is Not It', 'gnome', { x: X + 1, z: Z + 46 }, walk(round(X + 1, Z + 52, 5.5, 10).reverse(), 2.6), ['I am not it!', 'Pip cheats!', 'Do you know the dragon? I know the dragon.']),
  person('folk-pilgrim', 'Sister Veil', 'Walking to the Head', 'robed-priest', { x: 936, z: 931 }, walk([[939, 934], [935, 931], [931, 929.5], [935, 931]], 0.7),
    ['Every day I walk to the king and ask him to wake.', 'He has not answered. He is very patient with me.', 'Mind the braziers. They are older than the fire in them.']),
  person('folk-tippler', 'Skerrit', 'Between Drinks', 'goblin', { x: X + 8, z: Z + 86 }, { kind: 'wander', x: X + 9, z: Z + 84, radius: 5, speed: 0.8 },
    ['Which way is the tavern?', 'Was it always that big? The tavern?', 'I have only had the one. The one barrel.']),
  person('folk-stall-a', 'Gorse', 'Sells Rope', 'wizard-npc', { x: X - 9.8, z: Z + 37 }, stand(0.3),
    ['Rope. Good rope. Why would you need rope? Nobody asks that.', 'The chains out east are mine. The rope, I mean. Under the chains.', 'Fifty years in rope. It has its ups and downs.']),
  person('folk-stall-b', 'Mother Tansy', 'Sells Pies', 'witch-cook', { x: X + 11.2, z: Z + 50.5 }, stand(Math.PI - 0.2),
    ['Pies! What is in them? Pie!', 'Do not ask about the crust. It asks about you.', 'One for the dragon every feast day. He has not eaten one yet.']),
  person('folk-dwarf', 'Durra', 'Late for the Tavern', 'dwarf', { x: X - 2, z: Z + 30 }, walk([[X - 2, Z + 30], [X + 1, Z + 44], [X + 5, Z + 62], [X + 9, Z + 72], [X + 5, Z + 62], [X + 1, Z + 44]], 1.3),
    ['Out of my way, I am behind.', 'Behind on what? Drinking. Keep up.', 'The candle fellow pours short. Everybody knows. Everybody goes.']),
  // ----- The island's village and the hamlet -----
  person('folk-il-baker', 'Bryn', 'Baker of the Lower Street', 'witch-cook', { x: -44, z: 71 }, walk([[-44, 71], [-34, 69.6], [-24, 70.6], [-34, 69.6]], 1),
    ['Bread at dawn. There has not been a dawn. Bread anyway.', 'The skeletons by the fire buy nothing and sit there. Good customers, compared.', 'Smell that? That is flour and regret.']),
  person('folk-il-kid', 'Wick', 'Who Is Supposed To Be Inside', 'gnome', { x: -30, z: 70 }, walk(round(-30, 70, 2.4, 8), 2.2), ['You have a sword!', 'I am not supposed to talk to heroes.', 'Have you seen the big head? It looked at me.']),
  person('folk-il-watch', 'Corporal Dunn', 'Of the Village Watch', 'knight-npc', { x: -56, z: 58 }, walk([[-56, 58], [-39, 58]], 1.3),
    ['All quiet. I am told this is a good thing.', 'The Stone Head has not moved. I look every evening. Mostly from here.', 'Mind the tavern on the way down. It leans.']),
  person('folk-il-monk', 'Brother Sedge', 'On His Way Somewhere', 'frog-monk', { x: 2, z: 44 }, walk([[2, 44], [2, 54], [12, 58], [2, 54]], 0.8),
    ['Croak. Excuse me. Prayer.', 'The road is the prayer. So I am told by the road.', 'Which way is the sea? No. Do not tell me.']),
  person('folk-ham-a', 'Ilse', 'Who Keeps Hens', 'maiden', { x: 16, z: -12 }, walk([[17, -12], [12, -11.5], [17, -10.5], [21, -11]], 0.8),
    ['Have you seen a hen? Not any hen. A particular hen.', 'The hamlet is small but it has opinions.', 'Up the steps, past the torch. That is the whole tour.']),
  // ----- The kingdom -----
  person('folk-k-a', 'Sir Clatter', 'Courtier', 'skeleton', { x: 990, z: -34 }, walk([[990, -34], [1006, -34], [1006, -21], [990, -21]], 1.1),
    ['I have been waiting on an audience for four hundred years.', 'Lovely plaza. I walk it for my bones. All of them.', 'The king will see you. The king sees everyone. He has the sockets for it.']),
  person('folk-k-b', 'Lady Hollowell', 'Courtier', 'skeleton', { x: 1006, z: 44 }, walk([[1006, 44], [1024, 50], [1036, 42], [1016, 36]], 1),
    ['One does so like a stroll after not eating.', 'That cup is the size of a cathedral. It is a bit much.', 'Do you dance? I have the legs for it. Just the legs.']),
  person('folk-k-c', 'Vesper', 'Star Seller', 'void-monk', { x: 950, z: 18 }, walk([[950, 18], [963, 24], [938, 26], [913, 26], [893, 24], [913, 26], [938, 26], [963, 24]], 0.9),
    ['Stars. Slightly used.', 'The street goes both ways. Do not trust it.', 'Buckets? I do not look at the buckets. They look at me.']),
  person('folk-k-d', 'Marshal Grim', 'Of the Bone Guard', 'skeleton', { x: 985, z: -96 }, walk([[985, -96], [1015, -96], [1015, -138], [985, -138]], 1.4),
    ['Halt. No, carry on. I just like saying it.', 'The court is secure. I have counted the court.', 'Treasury is that way. I did not tell you.']),
  person('folk-k-e', 'Old Nell', 'Sweeps the Snow', 'robed-priest', { x: 938, z: 118 }, walk([[938, 118], [958, 130], [948, 148], [928, 135]], 0.7),
    ['I sweep the graves. They snow over. I sweep the graves.', 'The chapel door is warm. Do not ask why.', 'It is a living. Not for them.']),
  // ----- The sunken city -----
  person('folk-s-a', 'Bubbles', 'Fishguard, Off Duty', 'fish-guard', { x: -996, z: 20 }, walk([[-997, 20], [-1001, 20], [-1001, -30], [-997, -30]], 1),
    ['Off duty. I am still wet.', 'The king says more guards. There are no more guards. I am two of them.', 'Lovely currents today. It is always today.']),
  person('folk-s-b', 'Murk', 'Who Sells Water', 'fish-guard', { x: -1016, z: 40 }, stand(0),
    ['Water! Fresh water! Nobody ever buys any.', 'It is a hard market.', 'I have a lot in stock.']),
  // ----- The alley of graves -----
  person('folk-g-a', 'Mother Lull', 'Who Visits', 'robed-priest', { x: 1.6, z: -930 }, walk([[1.6, -930], [1.6, -960], [1.6, -1000], [1.6, -960]], 0.7),
    ['I come every day. They appreciate the walk.', 'Most of them are in. A few are out.', 'If you hear digging, it is not me.']),
  person('folk-g-b', 'Thrum', 'Gravedigger', 'skeleton', { x: -2.4, z: -1040 }, stand(0),
    ['Digging my way out of a job.', 'This one is mine. For later. It has a nice view.', 'They all come back, you know. Bad for business.']),
];
