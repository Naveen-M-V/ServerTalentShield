import React, { useState } from 'react';
import { notesApi } from '../../../utils/performanceApi';
import { toast } from 'react-toastify';

export default function NoteCreateRemoved() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Create Note Removed</h1>
      <p>The admin Create Note page has been removed.</p>
    </div>
  );
}
