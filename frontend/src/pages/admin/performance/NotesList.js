import React, { useEffect, useState } from 'react';
import { notesApi } from '../../../utils/performanceApi';

const NotesList = () => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState('');



import React from 'react';

export default function NotesListRemoved() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Notes Page Removed</h1>
      <p>The admin Notes page has been removed.</p>
    </div>
  );
}
