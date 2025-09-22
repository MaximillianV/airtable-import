# Airtable Import Project - CI/CD Fix & Improvement Todo List

## 🚨 CRITICAL FIXES (Required for CI/CD to pass)

### Backend Dependencies
- [x] Add `pg` package to `backend/package.json` dependencies
  ```json
  "pg": "^8.11.3"
  ```
- [x] Add `supertest` package to `backend/package.json` devDependencies
  ```json
  "supertest": "^6.3.3"
  ```
- [x] Run `npm install` in backend directory to update package-lock.json

### Database Configuration Issue
- [x] Investigate database configuration mismatch:
  - Code imports `pg` (PostgreSQL)
  - CI environment uses `DATABASE_URL=sqlite::memory:`
  - Decide on single database solution or add proper abstraction layer
- [x] Update database service to handle both PostgreSQL and SQLite if needed
- [x] Ensure test environment database configuration is consistent

## 📋 HIGH PRIORITY UPDATES

### ESLint (Breaking/Security)
- [ ] Upgrade ESLint from v8.57.1 to v9.x
- [ ] Update ESLint configuration for v9 compatibility
- [ ] Fix any linting rule changes after upgrade
- [ ] Test CI pipeline after ESLint upgrade

### Critical Package Updates
- [ ] Update `glob` from v7.2.3 to v9.x or later
- [ ] Update `rimraf` from v3.0.2 to v4.x or later
- [ ] Run `npm audit fix` to address security vulnerabilities
- [ ] Test application after critical package updates

## 🔧 MEDIUM PRIORITY IMPROVEMENTS

### Babel Configuration Modernization
- [ ] Replace deprecated Babel plugins with modern equivalents:
  - `@babel/plugin-proposal-private-methods` → `@babel/plugin-transform-private-methods`
  - `@babel/plugin-proposal-optional-chaining` → `@babel/plugin-transform-optional-chaining`
  - `@babel/plugin-proposal-nullish-coalescing-operator` → `@babel/plugin-transform-nullish-coalescing-operator`
  - `@babel/plugin-proposal-numeric-separator` → `@babel/plugin-transform-numeric-separator`
  - `@babel/plugin-proposal-class-properties` → `@babel/plugin-transform-class-properties`
  - `@babel/plugin-proposal-private-property-in-object` → `@babel/plugin-transform-private-property-in-object`
- [ ] Update Babel configuration files
- [ ] Test build process after Babel updates

### Build Tool Updates
- [ ] Replace `rollup-plugin-terser` with `@rollup/plugin-terser`
- [ ] Update `@humanwhocodes/config-array` to `@eslint/config-array`
- [ ] Update `@humanwhocodes/object-schema` to `@eslint/object-schema`
- [ ] Update `sourcemap-codec` to `@jridgewell/sourcemap-codec`

## 🧹 LOW PRIORITY CLEANUP

### Memory Leak Prevention
- [ ] Replace `inflight@1.0.6` with `lru-cache` for async request coalescing
- [ ] Review code using `inflight` and refactor if necessary

### Native API Migration
- [ ] Replace `abab@2.0.6` usage with native `atob()` and `btoa()`
- [ ] Replace `domexception@2.0.1` with native `DOMException`
- [ ] Replace `w3c-hr-time@1.0.2` with native `performance.now()` and `performance.timeOrigin`

### Library Updates
- [ ] Update `svgo` from v1.3.2 to v2.x.x or later
- [ ] Replace `q@1.5.1` with native Promises where possible
- [ ] Update `stable@0.1.8` usage (Array.sort() is stable in modern JS)

### Workbox Updates (if using Service Workers)
- [ ] Update deprecated Workbox packages:
  - `workbox-cacheable-response@6.6.0`
  - `workbox-google-analytics@6.6.0` (consider removing if using GA v4+)

## 📝 PROCESS IMPROVEMENTS

### Testing Infrastructure
- [ ] Add proper test database setup/teardown scripts
- [ ] Ensure test isolation between unit tests
- [ ] Add integration tests for database operations
- [ ] Verify PostgreSQL service container usage in tests

### CI/CD Pipeline
- [ ] Add dependency vulnerability scanning step
- [ ] Add automated dependency update checks
- [ ] Consider adding build caching for faster CI runs
- [ ] Add notification on CI failures

### Documentation
- [x] Document database setup requirements
- [x] Create development environment setup guide
- [x] Document known deprecation warnings and resolution timeline
- [x] Update README with current dependency requirements

## ⚡ EXECUTION SEQUENCE

**Phase 1: Critical Fixes**
1. Fix missing dependencies (`pg`, `supertest`)
2. Resolve database configuration issue
3. Verify CI pipeline passes

**Phase 2: Security & Compatibility**
1. Update ESLint to v9
2. Update critical packages (glob, rimraf)
3. Run security audit fixes

**Phase 3: Modernization**
1. Update Babel configuration
2. Replace deprecated build tools
3. Migrate to native APIs where applicable

**Phase 4: Cleanup & Documentation**
1. Address remaining deprecation warnings
2. Update documentation
3. Implement process improvements

## 🎯 SUCCESS METRICS

- [ ] CI/CD pipeline passes all tests
- [ ] Zero high/critical security vulnerabilities
- [ ] All deprecation warnings addressed
- [ ] Build time maintained or improved
- [ ] Test coverage maintained or improved