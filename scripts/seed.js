import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Event from '../src/models/Event.js';
import Ticket from '../src/models/Ticket.js';
import { ticketToken } from '../src/utils/helpers.js';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
  console.error('Refusing to seed production. Set ALLOW_PRODUCTION_SEED=true only if you explicitly intend to seed it.');
  process.exit(1);
}
if (!process.env.MONGO_URI) { console.error('Missing MONGO_URI in backend/.env'); process.exit(1); }
const password = process.env.SEED_PASSWORD || 'Demo12345!';
const dateAfter = (days, hour = 17) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
};
const events = [
  { key: 'design-systems-lab', title: 'Design Systems Lab', category: 'Technology', venue: 'The Workshop Studio', city: 'Kathmandu', days: 8, time: 14, hours: 3, capacity: 75, tone: 'violet', description: 'A hands-on afternoon exploring components, tokens, and the small details that make products feel effortless. Bring your laptop, your curiosity, and a few ideas to share.' },
  { key: 'creative-mornings', title: 'Creative Mornings: Make & Meet', category: 'Arts', venue: 'The Makers Room', city: 'Pokhara', days: 12, time: 9, hours: 2, capacity: 40, tone: 'coral', description: 'Start your day with good coffee, interesting people, and creative experiments. Enjoy short talks, playful making sessions, and conversations with local creators.' },
  { key: 'startup-pitch', title: 'Founders & Ideas Pitch Night', category: 'Business', venue: 'Innovation Hall', city: 'Kathmandu', days: 18, time: 18, hours: 3, capacity: 120, tone: 'blue', description: 'Early-stage founders pitch fresh ideas, connect with makers, and get constructive feedback. Whether you are building or just curious, there is room for you.' },
  { key: 'city-sound', title: 'City Sound Sessions', category: 'Music', venue: 'Riverside Courtyard', city: 'Pokhara', days: 24, time: 17, hours: 4, capacity: 150, tone: 'rose', description: 'An intimate evening of live music, discovery, and community. Listen to emerging independent artists and enjoy a relaxed setting with fellow music lovers.' },
  { key: 'weekend-trail', title: 'Weekend Trail & Coffee Club', category: 'Community', venue: 'Lakeside Meeting Point', city: 'Pokhara', days: 31, time: 7, hours: 4, capacity: 35, tone: 'emerald', description: 'Meet people, explore an easy scenic trail, and finish the morning with coffee. A friendly community walk for beginners and regular hikers alike.' },
  { key: 'build-with-ai', title: 'Build Something with AI', category: 'Technology', venue: 'Tech Hub Central', city: 'Lalitpur', days: 36, time: 11, hours: 5, capacity: 90, tone: 'amber', description: 'Turn an idea into a small working prototype with modern development tools. Expect practical demos, team exercises, and a quick show-and-tell at the end.' },
  { key: 'demo-day', title: 'Community Demo Day — Archive', category: 'Community', venue: 'Open Community Hall', city: 'Kathmandu', days: -4, time: 11, hours: 3, capacity: 60, tone: 'blue', description: 'A past demo event included to show attendance history and completed check-ins in the organizer dashboard.' },
];

const upsertUser = async (name, email, role) => {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({ name, email, role, password });
};

try {
  await mongoose.connect(process.env.MONGO_URI);
  const organizer = await upsertUser('Jordan Lee', 'organizer@eventpass.dev', 'organizer');
  const attendee = await upsertUser('Sam Rivera', 'attendee@eventpass.dev', 'attendee');
  const guests = [];
  for (const [name, email] of [
    ['Alex Morgan', 'alex@eventpass.dev'], ['Mia Chen', 'mia@eventpass.dev'],
    ['Taylor Brooks', 'taylor@eventpass.dev'], ['Casey Bell', 'casey@eventpass.dev'],
  ]) guests.push(await upsertUser(name, email, 'attendee'));
  const people = [attendee, ...guests];
  let addedEvents = 0;
  let addedTickets = 0;
  for (const [index, item] of events.entries()) {
    let event = await Event.findOne({ seedKey: item.key }).select('+seedKey');
    if (!event) {
      const startsAt = dateAfter(item.days, item.time);
      const endsAt = new Date(startsAt.getTime() + item.hours * 60 * 60 * 1000);
      event = await Event.create({
        title: item.title, category: item.category, description: item.description,
        venue: item.venue, city: item.city, startsAt, endsAt,
        capacity: item.capacity, tone: item.tone, organizer: organizer._id,
        seedKey: item.key,
      });
      addedEvents++;
    }
    const numberOfAttendees = index === 6 ? 4 : Math.min(5, 2 + (index % 4));
    for (const guest of people.slice(0, numberOfAttendees)) {
      if (await Ticket.exists({ event: event._id, attendee: guest._id })) continue;
      const checkedIn = index === 6;
      await Ticket.create({
        event: event._id, attendee: guest._id, qrToken: ticketToken(),
        status: checkedIn ? 'checked_in' : 'registered',
        checkedInAt: checkedIn ? event.startsAt : null,
      });
      await Event.updateOne({ _id: event._id }, { $inc: { registeredCount: 1 } });
      addedTickets++;
    }
  }
  console.log(`\n✔ Seed finished: ${addedEvents} new events, ${addedTickets} new tickets.`);
  console.log('Demo users are created only if missing. Existing passwords and data are preserved.');
  console.log('Organizer: organizer@eventpass.dev');
  console.log('Attendee:  attendee@eventpass.dev');
  console.log(`Password for NEW demo users: ${password}`);
  console.log('Note: If accounts already existed, their passwords were not modified.\n');
} catch (err) { console.error('Seeding failed:', err); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
