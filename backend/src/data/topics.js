// The five topics the site explains, in the order a course usually meets them.
//
// `owner` is the teammate who builds that lesson's interactive page in the frontend.
// Two of them are mine; the other three are placeholders my teammates replace with their
// own names when they pick a lesson up. The backend does not care who owns what - the
// field is here so the topic list can show it and so nobody builds the same page twice.
//
// `cheatSheet` is the one-line summary shown in the topic list. The full sheet lives in
// data/cheatSheets/<id>.json and is served by GET /topics/:id/cheat-sheet.

export const topics = [
  {
    id: 'instruction-cycle',
    title: 'The instruction cycle',
    owner: 'alina',
    cheatSheet: 'Fetch, decode, execute, then check for interrupts - and repeat for ever.',
  },
  {
    id: 'pipelining',
    title: 'Pipelining',
    owner: 'sofia',
    cheatSheet: 'Overlap the stages of consecutive instructions; hazards are the price.',
  },
  {
    id: 'cache-memory-hierarchy',
    title: 'Cache and the memory hierarchy',
    owner: 'mykhailo',
    cheatSheet: 'Small and fast close to the CPU, large and slow far from it, locality in between.',
  },
  {
    id: 'number-representation',
    title: 'Number representation',
    owner: 'alina',
    cheatSheet: "Two's complement: flip every bit, add one, and subtraction becomes addition.",
  },
  {
    id: 'buses-interrupts',
    title: 'Buses and interrupts',
    owner: 'tbd',
    cheatSheet: 'Shared wires carry address, data and control; interrupts cut the CPU off mid-cycle.',
  },
];

export const topicIds = topics.map((topic) => topic.id);

export function findTopic(id) {
  return topics.find((topic) => topic.id === id);
}
