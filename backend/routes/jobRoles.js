const express = require('express');
const { MongoClient } = require('mongodb');
const router = express.Router();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
let db;

async function connectDb() {
  if (!db) {
    await client.connect();
    db = client.db('hrms');
    console.log('MongoDB connection established!');
  }
}
connectDb();

router.get('/', async (req, res) => {
  try {
    await connectDb();
    const collection = db.collection('jobroles');
    const jobRoles = await collection.find({}).sort({ name: 1 }).toArray();
    res.json(jobRoles);
  } catch (error) {
    console.error('Error fetching job roles:', error);
    res.status(500).json({ error: 'Failed to fetch job roles' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    await connectDb();
    const collection = db.collection('jobroles');
    const jobRoles = await collection.find({ name: { $regex: q, $options: 'i' } }).toArray();
    res.json(jobRoles);
  } catch (error) {
    console.error('Error searching job roles:', error);
    res.status(500).json({ error: 'Failed to search job roles' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Job role name is required' });
    }
    await connectDb();
    const collection = db.collection('jobroles');

    const existingJobRole = await collection.findOne({
  name: { $regex: `^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
});


    if (existingJobRole) {
      return res.status(409).json({ error: 'Job role already exists' });
    }

    const newJobRole = {
      name: name.trim(),
      description: description?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await collection.insertOne(newJobRole);
    const insertedJobRole = await collection.findOne({ _id: result.insertedId });
    res.status(201).json(insertedJobRole);
  } catch (error) {
    console.error('Error adding job role:', error);
    res.status(500).json({ error: 'Failed to add job role' });
  }
});

module.exports = router;
