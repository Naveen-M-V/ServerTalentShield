# 🔍 Report Library PDF - Quick Debug Guide

## Problem: Blank PDF Generated

### Step 1: Check Report Generation ✅
Open browser console and generate report:

```
Looking for: ✅
[Report Generation] Total records: X (where X > 0)
[Report Generation] Sample record: { employeeId: "...", ... }

If X = 0:
→ Database query returned no results
→ Check date range and employee filters
→ Verify data exists in MongoDB

If no sample record shown:
→ Records array has empty objects
→ Check aggregation pipeline in backend controller
```

### Step 2: Check Export Request ✅
Click Export PDF and check browser console:

```
Looking for: ✅
[Export] Records: array with X items (where X > 0)
[Export] Report type: <report-type>
[Export] Sending PDF export request...
[Export] Response size: X bytes (where X > 10000)

If "Records: array with 0 items":
→ reportData state was cleared or corrupted
→ Check React component state

If response size < 5000 bytes:
→ Probably error JSON, not PDF
→ Check server console for error
```

### Step 3: Check Server Processing ✅
Check server/backend console:

```
Looking for: ✅
[PDF Export] reportData.records length: X (where X > 0)
[PDF Export] First record sample: { ... }
[PDF Generator] Total records: X
[PDF Export] PDF generated successfully, buffer size: X bytes

If "records length: 0":
→ Frontend sent empty records array
→ Check frontend validation logs

If "First record sample" shows empty object:
→ Database aggregation pipeline issue
→ Employee lookups might be failing
```

## Quick Fixes

### Fix 1: No Data in Database
```bash
# Check MongoDB
mongo
use hrms
db.leaverecords.find({ status: "approved" }).count()
db.employeeshubs.find({ isActive: true }).count()
```

### Fix 2: Date Range Mismatch
```javascript
// In ReportGenerationPanel.js, check:
console.log('Start:', startDate); // Should be before your test data
console.log('End:', endDate);     // Should be after your test data
```

### Fix 3: Employee Filter Too Restrictive
```javascript
// Try generating with NO employee filter (select all)
// If that works, issue is with employee ID matching
```

### Fix 4: Aggregation Pipeline Failure
```javascript
// In reportLibraryController.js, add after aggregation:
console.log('Raw aggregation result:', JSON.stringify(absenceData, null, 2));
// Check if _id fields match, if $lookup returned employee data
```

## Common Error Messages

| Error Message | Cause | Fix |
|--------------|-------|-----|
| "Report data is missing from request" | Frontend didn't send reportData | Check `handleExport()` payload |
| "Report data must contain a records array" | records field missing or not array | Check report generation endpoint response |
| "No records found for this report period" | Empty records array | Change date range or add test data |
| "Server returned error instead of PDF" | Backend threw error after setting headers | Check server logs for stack trace |

## Verification Checklist

- [ ] Browser console shows `[Report Generation]` logs
- [ ] Browser console shows `[Export]` logs
- [ ] Server console shows `[PDF Export]` logs
- [ ] Server console shows `[PDF Generator]` logs
- [ ] No error messages in either console
- [ ] PDF download size > 10KB
- [ ] Opening PDF shows data, not just header

## Test Data Creation

If no data exists:

```javascript
// Create test leave record in MongoDB
db.leaverecords.insertOne({
  user: ObjectId("..."), // Valid employee _id
  type: "annual",
  status: "approved",
  startDate: new Date("2026-01-10"),
  endDate: new Date("2026-01-12"),
  days: 3,
  reason: "Holiday",
  createdAt: new Date()
});
```

## Emergency Rollback

If issues persist:
```bash
git checkout HEAD~1 backend/controllers/reportLibraryController.js
git checkout HEAD~1 frontend/src/components/Reports/ReportGenerationPanel.js
git checkout HEAD~1 backend/utils/pdfExporter.js
```

## Get Help

Include in your report:
1. Browser console screenshot (from generation to export)
2. Server console logs (full export flow)
3. Report type and filters used
4. Sample database query showing data exists
5. PDF file size (if downloaded)

---
**For full documentation**: See `REPORT_LIBRARY_PDF_FIX.md`
