import React, { useState, useEffect } from 'react';
import { pipsApi } from '../../../utils/performanceApi';

const PipsList = () => {
  const [pips, setPips] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchPips = async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const res = await pipsApi.getForEmployee(employeeId);
      setPips(Array.isArray(res) ? res : (res && res.pips) || []);
    } catch (err) {
      console.error(err);
      setPips([]);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ if(employeeId) fetchPips(); }, [employeeId]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Improvement Plans (PIPs)</h1>
      <div className="mb-4">
        <input value={employeeId} onChange={e=>setEmployeeId(e.target.value)} placeholder="Employee ID" className="px-3 py-2 border rounded w-64" />
        <button onClick={fetchPips} className="ml-2 px-3 py-2 bg-blue-600 text-white rounded">Load</button>
      </div>

      {loading ? <p>Loading...</p> : (
        <div className="space-y-2">
          {pips.length === 0 ? <p className="text-sm text-gray-500">No plans found.</p> : pips.map(p=> (
            <div key={p._id} className="p-3 bg-white rounded border">
              <div className="font-medium">{new Date(p.startDate).toLocaleDateString()} — {p.endDate ? new Date(p.endDate).toLocaleDateString() : 'Ongoing'}</div>
              <div className="text-sm mt-2">{p.goals?.map((g,i)=> <div key={i}>• {g.description}</div>)}</div>
              <div className="text-xs text-gray-500 mt-2">Status: {p.status} — Outcome: {p.outcome}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React from 'react';

export default function PipsListRemoved() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">PIPs Page Removed</h1>
      <p>The admin PIPs page has been removed.</p>
    </div>
  );
}
