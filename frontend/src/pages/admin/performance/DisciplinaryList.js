import React, { useEffect, useState } from 'react';
import { disciplinaryApi } from '../../../utils/performanceApi';

export default function DisciplinaryListRemoved() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Disciplinary Page Removed</h1>
      <p>The admin Disciplinary page has been removed.</p>
    </div>
  );
}
