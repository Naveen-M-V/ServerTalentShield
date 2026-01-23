# Frontend Implementation Guidelines - Goals & Reviews

Guide for creating React components for the Goals and Reviews modules using existing patterns in the HRMS codebase.

## Project Structure

```
frontend/src/
├── pages/
│   ├── GoalsPage.js                    ← Create (main goals page)
│   ├── ReviewsPage.js                  ← Already exists, needs update
│   └── ... (other pages)
│
├── components/
│   ├── Goals/
│   │   ├── UserGoalsCard.js            ← Create (user CRUD)
│   │   ├── AdminGoalsCard.js           ← Create (admin mgmt)
│   │   ├── GoalForm.js                 ← Create (reusable form)
│   │   └── GoalsSummaryChart.js        ← Create (visualization)
│   │
│   ├── Reviews/
│   │   ├── UserReviewsCard.js          ← Create (user history)
│   │   ├── AdminReviewsCard.js         ← Create (admin mgmt)
│   │   ├── SelfAssessmentForm.js       ← Create (competency form)
│   │   └── ManagerFeedbackForm.js      ← Create (feedback form)
│   │
│   └── ... (existing components)
│
├── hooks/
│   ├── useGoals.js                     ← Create (custom hook)
│   ├── useReviews.js                   ← Create (custom hook)
│   └── ... (existing hooks)
│
└── ... (existing files)
```

## Common API Patterns (Use These Patterns)

### Building API URLs

```javascript
// Use buildApiUrl() helper (existing in codebase)
const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5003/api';

function buildApiUrl(endpoint) {
  return `${API_BASE}${endpoint}`;
}

// Usage:
const response = await axios.get(buildApiUrl('/goals/my'));
```

### Axios Configuration

```javascript
// Always use credentials for cookie-based auth
const response = await axios({
  method: 'get',
  url: buildApiUrl('/goals/my'),
  withCredentials: true,  // REQUIRED for session cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

// Or simplified:
axios.get(buildApiUrl('/goals/my'), { withCredentials: true })
```

### Error Handling Pattern

```javascript
import { toast } from 'react-toastify';

try {
  const response = await axios.get(buildApiUrl('/goals/my'), {
    withCredentials: true
  });
  
  if (response.data.success) {
    setGoals(response.data.data);
  } else {
    toast.error(response.data.message || 'Operation failed');
  }
} catch (error) {
  console.error('Error:', error);
  
  if (error.response?.status === 403) {
    toast.error('You do not have permission to perform this action');
  } else if (error.response?.status === 404) {
    toast.error('Resource not found');
  } else if (error.response?.status === 400) {
    toast.error(error.response.data.message || 'Invalid request');
  } else {
    toast.error('An error occurred. Please try again.');
  }
}
```

## Goals Module Components

### 1. GoalsPage.js (Main Page)

```javascript
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import UserGoalsCard from '../components/Goals/UserGoalsCard';
import AdminGoalsCard from '../components/Goals/AdminGoalsCard';
import useAuth from '../hooks/useAuth';  // Existing auth hook

export default function GoalsPage() {
  const { user, role } = useAuth();
  const [view, setView] = useState('user'); // 'user' or 'admin'
  
  const isAdmin = role === 'admin' || role === 'super-admin' || role === 'hr';
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Goals Management</h1>
        
        {isAdmin && (
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setView('user')}
              className={`px-4 py-2 rounded-lg ${
                view === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              My Goals
            </button>
            <button
              onClick={() => setView('admin')}
              className={`px-4 py-2 rounded-lg ${
                view === 'admin'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              All Goals (Admin)
            </button>
          </div>
        )}
        
        {view === 'user' && <UserGoalsCard />}
        {view === 'admin' && isAdmin && <AdminGoalsCard />}
      </div>
    </div>
  );
}
```

### 2. UserGoalsCard.js (User Dashboard)

```javascript
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import GoalForm from './GoalForm';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5003/api';

export default function UserGoalsCard() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  
  useEffect(() => {
    fetchGoals();
  }, []);
  
  const fetchGoals = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/goals/my`, {
        withCredentials: true
      });
      
      if (response.data.success) {
        setGoals(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
      toast.error('Failed to load goals');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async (goalId) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) return;
    
    try {
      const response = await axios.delete(`${API_BASE}/goals/${goalId}`, {
        withCredentials: true
      });
      
      if (response.data.success) {
        toast.success('Goal deleted successfully');
        setGoals(goals.filter(g => g._id !== goalId));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete goal');
    }
  };
  
  const statusColors = {
    'TO_DO': 'bg-gray-100 text-gray-800',
    'IN_PROGRESS': 'bg-blue-100 text-blue-800',
    'ACHIEVED': 'bg-green-100 text-green-800',
    'OVERDUE': 'bg-red-100 text-red-800'
  };
  
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">My Goals</h2>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + Create Goal
          </button>
        </div>
      </div>
      
      {showForm && (
        <GoalForm
          onSave={(goal) => {
            setGoals([goal, ...goals]);
            setShowForm(false);
            setEditingGoal(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingGoal(null);
          }}
          initialGoal={editingGoal}
        />
      )}
      
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : goals.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No goals yet. Create your first goal to get started!
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map(goal => (
              <div key={goal._id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{goal.title}</h3>
                    <p className="text-sm text-gray-600">{goal.description}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[goal.status]}`}>
                    {goal.status}
                  </span>
                </div>
                
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-sm font-bold text-gray-900">{goal.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${goal.progress}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                  <span>Deadline: {new Date(goal.deadline).toLocaleDateString()}</span>
                  {goal.adminApproved && (
                    <span className="text-green-600 font-medium">✓ Approved</span>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {!goal.adminApproved && (
                    <>
                      <button
                        onClick={() => {
                          setEditingGoal(goal);
                          setShowForm(true);
                        }}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(goal._id)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {goal.adminComments?.length > 0 && (
                    <div className="text-xs text-gray-600">
                      {goal.adminComments.length} comment(s)
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 3. GoalForm.js (Reusable Form)

```javascript
import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5003/api';

export default function GoalForm({ onSave, onCancel, initialGoal }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Other',
    deadline: '',
    progress: 0,
    status: 'TO_DO'
  });
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (initialGoal) {
      const { title, description, category, deadline, progress, status } = initialGoal;
      setFormData({
        title,
        description,
        category,
        deadline: new Date(deadline).toISOString().split('T')[0],
        progress,
        status
      });
    }
  }, [initialGoal]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'progress' ? parseInt(value) : value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const isEdit = !!initialGoal;
      const url = isEdit
        ? `${API_BASE}/goals/${initialGoal._id}`
        : `${API_BASE}/goals`;
      
      const method = isEdit ? 'PUT' : 'POST';
      
      const response = await axios({
        method,
        url,
        data: formData,
        withCredentials: true
      });
      
      if (response.data.success) {
        toast.success(isEdit ? 'Goal updated' : 'Goal created');
        onSave(response.data.data);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.message || 'Failed to save goal');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-gray-50 p-6 border-b border-gray-200">
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Goal Title *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            placeholder="Enter goal title"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            placeholder="Describe your goal"
          />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option>Technical</option>
              <option>Leadership</option>
              <option>Communication</option>
              <option>Project</option>
              <option>Personal Development</option>
              <option>Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deadline *
            </label>
            <input
              type="date"
              name="deadline"
              value={formData.deadline}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Progress: {formData.progress}%
            </label>
            <input
              type="range"
              name="progress"
              min="0"
              max="100"
              value={formData.progress}
              onChange={handleChange}
              className="w-full"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="TO_DO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ACHIEVED">Achieved</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </div>
        
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Goal'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
```

## Reviews Module Components

### 1. SelfAssessmentForm.js

```javascript
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5003/api';

export default function SelfAssessmentForm({ reviewId, onSubmit, initialData }) {
  const [competencies, setCompetencies] = useState(
    initialData || [
      { competency: '', rating: 3, summary: '' },
      { competency: '', rating: 3, summary: '' }
    ]
  );
  const [loading, setLoading] = useState(false);
  
  const handleCompetencyChange = (index, field, value) => {
    const updated = [...competencies];
    updated[index][field] = field === 'rating' ? parseInt(value) : value;
    setCompetencies(updated);
  };
  
  const addCompetency = () => {
    setCompetencies([...competencies, { competency: '', rating: 3, summary: '' }]);
  };
  
  const removeCompetency = (index) => {
    setCompetencies(competencies.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate
    if (competencies.some(c => !c.competency || c.rating < 1 || c.rating > 5)) {
      toast.error('Please fill all competencies with ratings 1-5');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await axios.post(
        `${API_BASE}/reviews/${reviewId}/self`,
        { selfAssessment: competencies },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        toast.success('Self-assessment submitted');
        onSubmit(response.data.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit assessment');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {competencies.map((comp, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="Competency name (e.g., Technical Skills)"
              value={comp.competency}
              onChange={(e) => handleCompetencyChange(idx, 'competency', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Rating:</label>
              <input
                type="range"
                min="1"
                max="5"
                value={comp.rating}
                onChange={(e) => handleCompetencyChange(idx, 'rating', e.target.value)}
                className="flex-1"
              />
              <span className="font-bold text-lg w-8 text-center">{comp.rating}</span>
            </div>
          </div>
          
          <textarea
            placeholder="Summary of this competency"
            value={comp.summary}
            onChange={(e) => handleCompetencyChange(idx, 'summary', e.target.value)}
            rows="2"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
          />
          
          {competencies.length > 1 && (
            <button
              type="button"
              onClick={() => removeCompetency(idx)}
              className="text-red-600 text-sm hover:underline"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      
      <button
        type="button"
        onClick={addCompetency}
        className="text-blue-600 hover:underline text-sm"
      >
        + Add Competency
      </button>
      
      <div className="flex gap-3 pt-6">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Assessment'}
        </button>
      </div>
    </form>
  );
}
```

## Custom Hooks

### useGoals.js

```javascript
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5003/api';

export function useGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchGoals();
  }, []);
  
  const fetchGoals = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/goals/my`, {
        withCredentials: true
      });
      setGoals(response.data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return { goals, loading, error, refetch: fetchGoals };
}
```

## Styling Guidelines

- Use **Tailwind CSS** (already configured)
- Use existing color scheme: `blue-600` for primary, `gray-*` for neutral
- Use `px-3 py-2` for standard padding
- Use `space-y-4` for vertical spacing
- Use `rounded-lg` for borders
- Use `shadow` for depth

## Key Implementation Notes

1. **Always use `withCredentials: true`** for all axios calls
2. **Check `response.data.success`** before using data
3. **Populate dropdowns** with enums: status, category, rating (1-5)
4. **Show progress bars** for goals (0-100%)
5. **Use star ratings** for reviews (visual 1-5 scale)
6. **Handle loading states** with spinners or skeleton
7. **Show empty states** when no data exists
8. **Validate dates** - deadline must be in future
9. **Confirm deletions** with modal dialog
10. **Log errors** to console for debugging

---

**Version:** 1.0
**Last Updated:** January 22, 2025
