# Airtable Import V2 - Developer & Troubleshooting Guide

## 📋 Project Overview

This is a full-stack TypeScript/JavaScript application that imports Airtable bases into PostgreSQL databases with **V2 type-aware import system**, automatic table creation, real-time progress tracking, and relationship analysis.

**Key Purpose**: Provide a seamless way to migrate Airtable data to PostgreSQL with automatic schema detection, proper field type mapping, and intelligent relationship discovery.

## 🎯 V2 Import System Architecture

### Three-Phase Workflow
1. **Phase 1**: Schema Creation - Creates PostgreSQL tables with proper field types
2. **Phase 2**: Data Import - Imports records with type-aware transformations  
3. **Phase 3**: Relationship Analysis - Analyzes imported data to detect relationships

### Key Components
- **V2ImportService** (`backend/src/services/V2ImportService.js`) - Main orchestrator
- **RelationshipAnalyzer** (`backend/src/services/RelationshipAnalyzer.js`) - Detects relationships in imported data
- **FieldMapperFactory** (`backend/src/services/fieldMappers/`) - Maps Airtable types to PostgreSQL types
- **V2Import Component** (`frontend/src/components/V2Import.tsx`) - React UI for workflow
- **ImportDatabaseService** (`backend/src/services/importDatabase.js`) - Database operations

## 🔧 Critical Fixes Applied

### Array Handling Fix (RESOLVED ✅)
**Problem**: `multipleRecordLinks` fields were being mapped to `TEXT` instead of `TEXT[]`, breaking relationship analysis.

**Solution Applied**:
```javascript
// In mapAirtableTypeToSQL():
case 'multipleRecordLinks':
  return 'TEXT[]'; // ✅ Fixed: was 'TEXT'

// In data insertion:
if (shouldBeArray) {
  return value.map(item => String(item || '')); // ✅ JavaScript array for pg driver
} else {
  return JSON.stringify(value); // JSON string for non-array fields
}
```

**Files Modified**:
- `backend/src/services/importDatabase.js` - Field type mapping and data insertion
- `backend/src/services/RelationshipAnalyzer.js` - Database result format handling
- `frontend/src/components/admin/settings/AdminSettings.tsx` - Null safety fixes

## 🚀 Troubleshooting Tools

### 1. Enhanced Log Viewer (`./view-logs.sh`)
```bash
./view-logs.sh live        # Live monitoring of all logs
./view-logs.sh processes   # Monitor CPU/Memory usage
./view-logs.sh status      # Show current app status
./view-logs.sh api-test    # Test API endpoints
./view-logs.sh v2-debug    # V2-specific debugging
```

### 2. Ultimate V2 Troubleshooter (`./debug-v2.sh`)
```bash
./debug-v2.sh monitor      # RECOMMENDED: Start app + comprehensive monitoring
./debug-v2.sh test         # Test V2 API endpoints only
./debug-v2.sh logs         # Live log viewing
```

## 📊 Expected V2 Import Results

### Phase 1 Success Indicators
```
✅ Field type mappings for table "subscriptions":
  - "Contact Links" -> "contact_links": multipleRecordLinks -> TEXT[]
  - "Address" -> "address": singleLineText -> TEXT
  - "Active" -> "active": checkbox -> BOOLEAN
```

### Phase 2 Success Indicators
```
✅ Phase 2 completed: 26/26 tables imported
✅ Import completed for table 'subscriptions': 123 inserted, 0 updated, 0 skipped
```

### Phase 3 Success Indicators (Expected)
```
✅ Relationship analysis complete: X relationships detected
- Subscriptions → Contacts (1:many via contact_links)
- Invoices → Subscriptions (1:many via subscription_id)
```

## 🔍 Common Issues & Solutions

### Issue 1: "malformed array literal" Error
**Cause**: PostgreSQL receiving JSON strings instead of JavaScript arrays for TEXT[] columns
**Solution**: ✅ FIXED - Enhanced array detection and proper data formatting

### Issue 2: "0 relationships detected"
**Cause**: Link fields stored as TEXT instead of TEXT[]
**Solution**: ✅ FIXED - Corrected field type mapping

### Issue 3: "result.map is not a function"
**Cause**: PostgreSQL returns `{rows: [...]}` but SQLite returns arrays directly
**Solution**: ✅ FIXED - Added result normalization: `Array.isArray(result) ? result : (result.rows || [])`

### Issue 4: Null safety errors in sessions view
**Cause**: Missing null checks when accessing session results
**Solution**: ✅ FIXED - Added optional chaining: `result?.processedRecords`

## 🛠️ Development Workflow

### Testing V2 Import System
1. **Start monitoring**: `./debug-v2.sh monitor`
2. **Navigate to V2 Import**: `http://localhost:3000/v2-import`
3. **Select tables** (recommend 3-5 for testing)
4. **Run Phase 1** - Watch for proper TEXT[] field mappings
5. **Run Phase 2** - Verify no "malformed array literal" errors
6. **Run Phase 3** - Should detect relationships

### Debugging Phase Issues

#### Phase 1 Debug
- Check field type mappings in logs
- Verify TEXT[] columns for multipleRecordLinks
- Confirm table creation success

#### Phase 2 Debug
- Monitor CPU usage during import
- Check for array handling errors
- Verify record insertion counts

#### Phase 3 Debug
- Check if findAllLinkColumns() finds TEXT[] columns
- Verify relationship detection logic
- Monitor database query execution

## 📁 Key File Locations

### Backend Core Files
```
backend/src/services/
├── V2ImportService.js           # Main V2 orchestrator
├── RelationshipAnalyzer.js      # Relationship detection
├── importDatabase.js            # Database operations (CRITICAL)
└── fieldMappers/
    ├── FieldMapperFactory.js    # Field type mapping factory
    └── *.js                     # Specific field mappers

backend/src/routes/
└── v2-import.js                 # V2 API endpoints
```

### Frontend Core Files
```
frontend/src/components/
├── V2Import.tsx                 # Main V2 workflow UI
└── admin/settings/AdminSettings.tsx  # Settings with sessions view
```

## 🎯 Current Status & Next Steps

### ✅ Completed (Commit: ac9b07e)
- V2ImportService with 3-phase workflow
- Fixed array handling for PostgreSQL TEXT[] columns
- Real-time monitoring and debugging tools
- Complete UI workflow for V2 imports

### 🔄 In Progress
- **Testing Relationship Analyzer** - Phase 3 relationship detection
- Phase 2 completed successfully, Phase 3 should now work

### 📋 Remaining Work
- **Schema Applier** - Phase 3 module to apply approved relationships
- Additional relationship types (many-to-many, self-referencing)
- Enhanced UI for relationship approval workflow

## 🔧 Quick Reference Commands

### Start & Monitor
```bash
./start-all.sh                    # Start application
./debug-v2.sh monitor             # Start with comprehensive monitoring
./view-logs.sh live               # Live log monitoring
```

### Testing & Debugging
```bash
./view-logs.sh api-test           # Test API connectivity
./view-logs.sh status             # Check application status
curl -X GET localhost:3001/api/health  # Quick health check
```

### Git Workflow
```bash
git status                        # Check current changes
git add [files]                   # Stage specific files
git commit -m "feat: description" # Commit with descriptive message
```

## 🚨 Emergency Troubleshooting

### Application Won't Start
1. Check port conflicts: `lsof -i :3000 :3001`
2. Kill conflicting processes: `./stop-all.sh`
3. Check database connection: `pg_isready`
4. Restart: `./start-all.sh`

### V2 Import Stuck/Failed
1. Start monitoring: `./debug-v2.sh monitor`
2. Check backend CPU usage
3. Verify database connections
4. Check browser console for errors
5. Review Phase 1/2 results before proceeding

### Database Issues
1. Check PostgreSQL status: `pg_isready`
2. Verify DATABASE_URL in .env
3. Test connection via API: `./view-logs.sh api-test`
4. Check table structure in DBeaver

## 💡 Best Practices

### For Development
- Always use monitoring tools during testing
- Commit frequently with descriptive messages
- Test with small table sets first (3-5 tables)
- Stay on V2 Import page during entire workflow

### For Debugging
- Start with `./debug-v2.sh monitor` for comprehensive visibility
- Check Phase 1 field mappings before proceeding
- Verify Phase 2 completion before running Phase 3
- Use browser dev tools alongside terminal monitoring

### For Production
- Ensure proper environment variables
- Use full table imports only after testing
- Monitor system resources during large imports
- Keep backup of original Airtable data

---

**Last Updated**: September 2025  
**Version**: V2 with Array Handling Fixes  
**Status**: Phase 1 & 2 Working, Phase 3 Ready for Testing