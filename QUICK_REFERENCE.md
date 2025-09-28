# V2 Import - Quick Reference & Context

## 🎯 Current Mission
**Testing V2 Relationship Analyzer (Phase 3)** - Phase 1 & 2 working, need to verify relationship detection

## ✅ Known Working Components
- ✅ V2ImportService with 3-phase workflow
- ✅ PostgreSQL TEXT[] array handling (multipleRecordLinks)
- ✅ Phase 1: Schema creation with proper field types
- ✅ Phase 2: Data import without "malformed array literal" errors

## 🔧 Key Fixes Applied (Commit: ac9b07e)
1. **Array Handling**: `multipleRecordLinks → TEXT[]` (was TEXT)
2. **Data Insertion**: JavaScript arrays for PostgreSQL driver
3. **Result Format**: PostgreSQL vs SQLite compatibility
4. **Null Safety**: Fixed AdminSettings sessions view

## 🚀 Essential Commands

### Start & Monitor (RECOMMENDED)
```bash
./debug-v2.sh monitor    # Start app + comprehensive V2 monitoring
```

### Individual Monitoring
```bash
./view-logs.sh live      # Live log monitoring
./view-logs.sh status    # Quick status check
./view-logs.sh api-test  # Test API endpoints
```

### Quick Health Checks
```bash
curl localhost:3001/api/health     # Backend health
lsof -i :3000 :3001                # Check ports
pg_isready                         # Database status
```

## 🔍 V2 Import Testing Workflow
1. Run: `./debug-v2.sh monitor`
2. Browser: `http://localhost:3000/v2-import`
3. Select 3-5 tables for testing
4. **Phase 1**: Look for `multipleRecordLinks -> TEXT[]` in logs
5. **Phase 2**: Verify completion without array errors  
6. **Phase 3**: Should detect relationships (TESTING NOW)

## 📊 Expected Phase 3 Success
```
✅ Relationship analysis complete: X relationships detected
- Subscriptions → Contacts (1:many via contact_links TEXT[])
- Invoices → Subscriptions (1:many via subscription_id TEXT[])
```

## 🚨 Common Issues & Solutions
- **"0 relationships detected"**: Check if Phase 2 created TEXT[] columns
- **Array literal errors**: ✅ FIXED - proper array handling  
- **result.map errors**: ✅ FIXED - PostgreSQL result format
- **Null reference errors**: ✅ FIXED - added null safety

## 📁 Critical Files
- `backend/src/services/importDatabase.js` - Array handling logic
- `backend/src/services/RelationshipAnalyzer.js` - Relationship detection
- `backend/src/services/V2ImportService.js` - Main orchestrator
- `frontend/src/components/V2Import.tsx` - UI workflow

## 🎯 Next Steps After Phase 3 Testing
1. If relationships detected → Build Schema Applier (apply relationships)
2. If issues found → Debug with monitoring tools
3. Final validation → Test complete workflow end-to-end

---
**Current Status**: Ready to test Phase 3 relationship analysis  
**Monitoring**: Use `./debug-v2.sh monitor` for full visibility