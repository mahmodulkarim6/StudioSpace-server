import 'dotenv/config';
import { MongoClient } from 'mongodb';
export const client = new MongoClient(process.env.MONGODB_URI);
export const db = client.db('studiospace');
export const col = (name) => db.collection(name);