// Every NPC with a dialogue book, talked to as the player does: walk up (teleport beside it), F through the game's own
// interactTarget/pressF, read #hud-dialog, click every choice on the rendered buttons, depth first, every node checked
// (lib.js checkNode: empty or garbled lines and labels, a label that repeats the NPC line, the same line twice in a
// row, a choice that does nothing, a topic that ends the talk, Escape that does not close). Quest steps are rolled
// back (sweep-quests.js plays them). `window.__only = ['king']` limits it. Prints lib.js report().
//#include lib.js
await sleep(1500);
G.inventory.shards = Math.max(G.inventory.shards, 5000);
const res = await exploreAll('start', window.__only);
const thin = res.filter((r) => r.nodes < 2).map((r) => r.id);
for (const id of thin) fail('conversation has fewer than two nodes', { id });
const books = Object.keys(G.story.book).length;
if (res.length < books - 2) fail('NPCs not reached', { reached: res.length, books });
return report({ npcs: res.length, books, nodes: res.reduce((a, r) => a + r.nodes, 0), clicks: res.reduce((a, r) => a + r.clicks, 0), advances: res.filter((r) => r.advances?.length).map((r) => ({ id: r.id, a: r.advances })) });
