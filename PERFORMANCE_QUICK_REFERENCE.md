# 🎯 PERFORMANCE SYSTEM - QUICK REFERENCE GUIDE

**Last Updated:** January 25, 2026  
**Status:** Production Ready

---

## 📍 NAVIGATION

### **Admin Users**
- `/performance/goals` - Full goals management
- `/performance/reviews` - Full reviews management

### **Employees**
- `/user-dashboard?tab=performance` - Performance dashboard (ENHANCED)
- `/performance/goals` - Can also access full goals page
- `/performance/reviews` - Can also access reviews page (view only)

---

## 🎛️ BUTTON REFERENCE

### **Employee Performance Tab - Goals Section**

| Button | When Visible | What It Does |
|--------|-------------|--------------|
| **+ New Goal** | Always | Opens /performance/goals for creation |
| **View** | Always | Shows goal details + admin comments |
| **Edit** | Goal approval = "Pending" | Opens /performance/goals for editing |
| **Delete** | Goal approval = "Pending" | Deletes goal after confirmation |

**Approval Badges:**
- 🟡 **Pending** - Awaiting admin approval
- 🟢 **Approved** - Manager approved (cannot edit)
- 🔴 **Rejected** - Manager rejected

---

### **Employee Performance Tab - Reviews Section**

| Button | When Visible | What It Does |
|--------|-------------|--------------|
| **View** | Always | Shows review details |
| **Add Comment** | Review status = "SUBMITTED" | Opens modal to add employee feedback |

**Status Badges:**
- 🟡 **SUBMITTED** - Can add comments
- 🟢 **COMPLETED** - Read-only

---

### **Admin Goals Page**

| Button | Who Sees | When Active | What It Does |
|--------|----------|-------------|--------------|
| **+ New goal** | All | Always | Opens creation modal |
| **View** | All | Always | Shows goal details |
| **Edit** | Owner/Admin | Always | Opens edit modal |
| **Delete** | Owner/Admin | Always | Deletes goal |
| **Approve** | Admin only | Goal not approved | Approves goal |
| **Comment** | Admin only | Always | Adds manager comment |

---

### **Admin Reviews Page**

| Button | Who Sees | When Active | What It Does |
|--------|----------|-------------|--------------|
| **+ Create review** | Admin (Team tab) | Always | Opens creation modal |
| **View** | All | Always | Shows review details |
| **Edit** | Admin | Status = DRAFT | Opens edit modal |
| **Submit** | Admin | Status = DRAFT | Changes to SUBMITTED |
| **Close** | Admin | Status = SUBMITTED | Changes to COMPLETED |
| **Add comment** | Employee | Status = SUBMITTED | Adds employee feedback |

---

## 🔄 WORKFLOWS

### **Goal Approval Workflow**

```
Employee creates goal
    ↓
Status: Pending
    ↓
Admin reviews
    ↓
Admin clicks "Approve" → Approved ✅
    OR
Admin clicks "Reject" → Rejected ❌
    ↓
Employee can no longer edit/delete
```

### **Review Workflow**

```
Admin creates review → DRAFT
    ↓
Admin submits → SUBMITTED
    ↓
Employee sees in Performance Tab
    ↓
Employee adds comment (optional)
    ↓
Admin closes → COMPLETED
    ↓
Read-only for everyone
```

---

## 🛠️ API QUICK REFERENCE

### **Goals**
```javascript
// Employee can call:
GET    /api/performance/goals/my-goals    // Get my goals
POST   /api/performance/goals             // Create goal
PUT    /api/performance/goals/:id         // Update goal (pending only)
DELETE /api/performance/goals/:id         // Delete goal (pending only)

// Admin can call (additional):
POST   /api/performance/goals/:id/approve // Approve goal
POST   /api/performance/goals/:id/comment // Add comment
```

### **Reviews**
```javascript
// Employee can call:
GET    /api/reviews/my                    // Get my reviews
POST   /api/reviews/:id/comment           // Add comment (submitted only)

// Admin can call (additional):
POST   /api/reviews                       // Create review
PUT    /api/reviews/:id                   // Update review (draft only)
POST   /api/reviews/:id/submit            // Submit review
POST   /api/reviews/:id/close             // Close review
DELETE /api/reviews/:id                   // Delete review
```

---

## 🎨 STATUS COLORS

### **Goal Status**
- `Not started` - Gray
- `In progress` - Blue
- `Completed` - Green
- `Overdue` - Red

### **Goal Approval**
- `Pending` - Yellow
- `Approved` - Green
- `Rejected` - Red

### **Review Status**
- `DRAFT` - Yellow (employee never sees)
- `SUBMITTED` - Blue (employee can comment)
- `COMPLETED` - Green (read-only)

---

## ⚡ KEYBOARD SHORTCUTS

### **Modals**
- `Esc` - Close modal
- `Enter` (in textarea) - Line break
- `Tab` - Navigate between fields

---

## 🔒 PERMISSION MATRIX

| Action | Employee | Admin |
|--------|----------|-------|
| Create goal | ✅ | ✅ |
| Edit own pending goal | ✅ | ✅ |
| Edit own approved goal | ❌ | ✅ |
| Delete own pending goal | ✅ | ✅ |
| Delete own approved goal | ❌ | ✅ |
| Approve goal | ❌ | ✅ |
| Comment on goal | ❌ | ✅ |
| View own goals | ✅ | ✅ |
| View all goals | ❌ | ✅ |
| Create review | ❌ | ✅ |
| Edit review (draft) | ❌ | ✅ |
| Submit review | ❌ | ✅ |
| Close review | ❌ | ✅ |
| Comment on review (submitted) | ✅ | ✅ |
| View own reviews | ✅ | ✅ |
| View all reviews | ❌ | ✅ |

---

## 📱 RESPONSIVE DESIGN

### **Desktop (≥1024px)**
- Full table layout
- All columns visible
- Side-by-side filters

### **Tablet (768-1023px)**
- Scrollable tables
- Stacked filters
- Condensed actions

### **Mobile (<768px)**
- Card-based layout (recommended future enhancement)
- Full-width modals
- Touch-friendly buttons

---

## 🚨 TROUBLESHOOTING

### **"+ New Goal" button not working**
- Check navigation permissions
- Verify user is authenticated
- Check browser console for errors

### **Cannot edit goal**
- Check if goal is approved
- Only pending goals can be edited
- Admin can edit all goals

### **Cannot see SUBMITTED reviews**
- Check if reviews exist with SUBMITTED status
- Admin may not have submitted yet
- Refresh page to reload data

### **Comment button not appearing**
- Check review status (must be SUBMITTED)
- COMPLETED reviews are read-only
- DRAFT reviews are invisible to employees

### **Delete confirmation not showing**
- Browser may be blocking alerts
- Check console for errors
- Try different browser

---

## 📊 DATA REFRESH

### **Automatic Refresh**
- ❌ Not implemented yet
- Use browser refresh (F5) for now

### **Manual Refresh**
- Navigate away and back
- Or reload the page

### **Future Enhancement**
- Add auto-refresh every 30 seconds
- Add manual refresh button
- Add real-time updates via WebSocket

---

## 🎯 TIPS & BEST PRACTICES

### **For Employees**
1. Create goals early in the quarter
2. Keep descriptions clear and measurable
3. Add comments to reviews promptly
4. Check Performance Tab regularly

### **For Admins**
1. Review and approve goals within 48 hours
2. Add constructive comments to goals
3. Submit reviews before scheduled meetings
4. Close reviews after discussion

### **For Everyone**
1. Use descriptive goal titles
2. Set realistic deadlines
3. Update progress regularly
4. Communicate delays early

---

**END OF QUICK REFERENCE GUIDE**
