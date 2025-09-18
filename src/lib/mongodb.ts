import { MongoClient, Db } from 'mongodb';
import * as bcrypt from 'bcrypt';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = 'school';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env');
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function seedDefaultUsers(db: Db) {
    const usersCollection = db.collection('users');
    
    const usersToSeed = [
        { username: 'bluebell', password: 'bluebell123', role: 'admin' },
        { username: 'account', password: 'bluebellacc', role: 'accountant' },
        { username: 'exam', password: 'bluebellexam', role: 'exam' }
    ];

    for (const userData of usersToSeed) {
        const userExists = await usersCollection.findOne({ username: userData.username });
        if (!userExists) {
            console.log(`Seeding user: ${userData.username}`);
            const passwordHash = await bcrypt.hash(userData.password, 10);
            await usersCollection.insertOne({
                username: userData.username,
                passwordHash: passwordHash,
                role: userData.role
            });
            console.log(`User '${userData.username}' created with role '${userData.role}'.`);
        }
    }

    // Ensure the original admin user has the 'admin' role if it exists from a previous version
    const adminUser = await usersCollection.findOne({ username: 'bluebell' });
    if (adminUser && !adminUser.role) {
        await usersCollection.updateOne({ _id: adminUser._id }, { $set: { role: 'admin' } });
        console.log("Updated 'bluebell' user to have 'admin' role.");
    }
}


export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI!, {
    tlsAllowInvalidCertificates: true,
  });

  await client.connect();

  const db = client.db(MONGODB_DB);

  // Seed the database with default users if they don't exist
  await seedDefaultUsers(db);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
