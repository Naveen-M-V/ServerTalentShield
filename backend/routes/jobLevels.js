const express = require('express');
const { MongoClient } = require('mongodb');
const router = express.Router();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Get all job levels
router.get('/', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('hrms');
    const collection = database.collection('joblevels');
    
    const jobLevels = await collection.find({}).toArray();
    res.json(jobLevels);
  } catch (error) {
    console.error('Error fetching job levels:', error);
    res.status(500).json({ error: 'Failed to fetch job levels' });
  } finally {
    await client.close();
  }
});

// Search job levels
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    await client.connect();
    const database = client.db('hrms');
    const collection = database.collection('joblevels');
    
    const jobLevels = await collection.find({
      name: { $regex: q, $options: 'i' }
    }).toArray();
    
    res.json(jobLevels);
  } catch (error) {
    console.error('Error searching job levels:', error);
    res.status(500).json({ error: 'Failed to search job levels' });
  } finally {
    await client.close();
  }
});

// Add new job level
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Job level name is required' });
    }

    await client.connect();
    const database = client.db('hrms');
    const collection = database.collection('joblevels');
    
    // Check if job level already exists
    const existingJobLevel = await collection.findOne({ 
      name: { $regex: `^${name.trim()}$`, $options: 'i' }
    });
    
    if (existingJobLevel) {
      return res.status(409).json({ error: 'Job level already exists' });
    }
    
    const newJobLevel = {
      name: name.trim(),
      description: description?.trim() || '',
      createdAt: new Date()
    };
    
    const result = await collection.insertOne(newJobLevel);
    const insertedJobLevel = await collection.findOne({ _id: result.insertedId });
    
    res.status(201).json(insertedJobLevel);
  } catch (error) {
    console.error('Error adding job level:', error);
    res.status(500).json({ error: 'Failed to add job level' });
  } finally {
    await client.close();
  }
});

// Update job level
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Job level name is required' });
    }

    await client.connect();
    const database = client.db('hrms');
    const collection = database.collection('joblevels');
    
    const result = await collection.updateOne(
      { _id: new require('mongodb').ObjectId(id) },
      { 
        $set: { 
          name: name.trim(),
          description: description?.trim() || '',
          updatedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Job level not found' });
    }
    
    const updatedJobLevel = await collection.findOne({ _id: new require('mongodb').ObjectId(id) });
    res.json(updatedJobLevel);
  } catch (error) {
    console.error('Error updating job level:', error);
    res.status(500).json({ error: 'Failed to update job level' });
  } finally {
    await client.close();
  }
});

// Delete job level
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await client.connect();
    const database = client.db('hrms');
    const collection = database.collection('joblevels');
    
    const result = await collection.deleteOne({ _id: new require('mongodb').ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Job level not found' });
    }
    
    res.json({ message: 'Job level deleted successfully' });
  } catch (error) {
    console.error('Error deleting job level:', error);
    res.status(500).json({ error: 'Failed to delete job level' });
  } finally {
    await client.close();
  }
});

module.exports = router;
